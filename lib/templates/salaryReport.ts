import 'server-only'

import fs from 'fs/promises'
import path from 'path'

const templatePath = path.resolve('module/salary.html')
const cssPath = path.resolve('module/salary.css')
const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g
const FONT_FAMILY = 'SalaryReport'
const FALLBACK_FONTS =
  "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', Arial, Helvetica, sans-serif"
const FONT_CANDIDATES = [
  process.env.SALARY_PDF_FONT_PATH,
]

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
  teamZh: string
  teamFr: string
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
let cachedFontCss: string | null = null

export async function renderSalaryReportHtml(pages: SalaryPage[]): Promise<string> {
  const { pageTemplate, css } = await loadTemplateParts()
  const fontCss = await loadFontCss()
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
    `<style>${css}\n${fontCss}</style>`,
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

async function loadFontCss(): Promise<string> {
  if (cachedFontCss !== null) return cachedFontCss
  const embedded = await resolveFontEmbed()
  const fontFamily = embedded ? `'${FONT_FAMILY}', ${FALLBACK_FONTS}` : FALLBACK_FONTS
  const bodyCss = `body { font-family: ${fontFamily}; }`
  cachedFontCss = [embedded?.css ?? '', bodyCss].filter(Boolean).join('\n')
  return cachedFontCss
}

async function resolveFontEmbed(): Promise<{ css: string } | null> {
  const fontPath = await findFontPath()
  if (!fontPath) return null
  try {
    const data = await fs.readFile(fontPath)
    const { mime, format } = resolveFontFormat(fontPath)
    const base64 = data.toString('base64')
    const css = [
      `@font-face {`,
      `  font-family: '${FONT_FAMILY}';`,
      `  src: url(data:${mime};base64,${base64}) format('${format}');`,
      `  font-weight: normal;`,
      `  font-style: normal;`,
      `  font-display: swap;`,
      `}`,
    ].join('\n')
    return { css }
  } catch {
    return null
  }
}

async function findFontPath() {
  console.log('[SalaryPDF] Looking for font in:', FONT_CANDIDATES)
  for (const candidate of FONT_CANDIDATES) {
    if (!candidate) continue
    try {
      await fs.access(candidate)
      console.log('[SalaryPDF] Found font at:', candidate)
      return candidate
    } catch {
      console.log('[SalaryPDF] Font not found at:', candidate)
      continue
    }
  }
  console.warn('[SalaryPDF] No suitable font found, using fallback system fonts.')
  return null
}

function resolveFontFormat(fontPath: string) {
  const ext = path.extname(fontPath).toLowerCase()
  if (ext === '.otf') return { mime: 'font/otf', format: 'opentype' }
  if (ext === '.woff2') return { mime: 'font/woff2', format: 'woff2' }
  if (ext === '.woff') return { mime: 'font/woff', format: 'woff' }
  return { mime: 'font/ttf', format: 'truetype' }
}

function fillTemplate(template: string, page: SalaryPage) {
  const rowsHtml = renderRows(page.rows)
  const replacements: Record<string, string> = {
    teamLabel: escapeHtml(page.teamLabel),
    teamZh: escapeHtml(page.teamZh),
    teamFr: escapeHtml(page.teamFr),
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
