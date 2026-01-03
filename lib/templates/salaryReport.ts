import 'server-only'

import fs from 'fs/promises'
import path from 'path'

const templatePath = path.resolve('module/salary.html')
const cssPath = path.resolve('module/salary.css')
const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g

export type SalaryRow = {
  index: number | string
  matricule: string
  name: string
  amount: string
  advance: string
  paid: string
}

export type SalaryPage = {
  teamLabel: string
  unitName: string
  periodStart: string
  periodEnd: string
  rows: SalaryRow[]
  totalAmount: string
  totalAdvance: string
  totalPaid: string
  pageNumber: number
  pageCount: number
}

type TemplateParts = {
  pageTemplate: string
  css: string
}

let cachedTemplate: TemplateParts | null = null

export async function renderSalaryReportHtml(pages: SalaryPage[]): Promise<string> {
  const { pageTemplate, css } = await loadTemplateParts()
  const content = pages
    .map((page) => fillTemplate(pageTemplate, page))
    .filter(Boolean)
    .join('\n')

  return [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<style>${css}</style>`,
    '</head>',
    '<body>',
    content,
    '</body>',
    '</html>',
  ].join('\n')
}

async function loadTemplateParts(): Promise<TemplateParts> {
  if (cachedTemplate) return cachedTemplate
  const [html, css] = await Promise.all([
    fs.readFile(templatePath, 'utf-8'),
    fs.readFile(cssPath, 'utf-8').catch(() => ''),
  ])
  const pageTemplate = extractBody(html)
  cachedTemplate = { pageTemplate, css }
  return cachedTemplate
}

function extractBody(html: string) {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  if (match && match[1]) return match[1].trim()
  return html
}

function fillTemplate(template: string, page: SalaryPage) {
  const rowsHtml = renderRows(page.rows)
  const replacements: Record<string, string> = {
    teamLabel: escapeHtml(page.teamLabel),
    unitName: escapeHtml(page.unitName),
    periodStart: escapeHtml(page.periodStart),
    periodEnd: escapeHtml(page.periodEnd),
    rows: rowsHtml,
    totalAmount: escapeHtml(page.totalAmount),
    totalAdvance: escapeHtml(page.totalAdvance),
    totalPaid: escapeHtml(page.totalPaid),
    pageNumber: escapeHtml(page.pageNumber),
    pageCount: escapeHtml(page.pageCount),
  }

  return template.replace(PLACEHOLDER_REGEX, (_, rawKey: string) => {
    const key = rawKey.trim()
    if (!key) return ''
    return replacements[key] ?? ''
  })
}

function renderRows(rows: SalaryRow[]) {
  return rows
    .map((row) => {
      return [
        '<tr>',
        `<td>${formatCell(row.index)}</td>`,
        `<td>${formatCell(row.matricule)}</td>`,
        `<td>${formatCell(row.name)}</td>`,
        `<td>${formatCell(row.amount)}</td>`,
        `<td>${formatCell(row.advance)}</td>`,
        `<td>${formatCell(row.paid)}</td>`,
        '<td></td>',
        '</tr>',
      ].join('')
    })
    .join('\n')
}

function formatCell(value: unknown) {
  const text = escapeHtml(value)
  return text === '' ? '&nbsp;' : text
}

function escapeHtml(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
