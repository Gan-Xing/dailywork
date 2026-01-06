import 'server-only'

import fs from 'fs/promises'
import path from 'path'

type PresenceVariant = 'ctj' | 'cdd'

export type PresenceRow = {
  date: string
  isWeekend: boolean
}

export type PresencePage = {
  employeeName: string
  employeeRole: string
  periodStart: string
  periodEnd: string
  rows: PresenceRow[]
}

type TemplateParts = {
  pageTemplate: string
  headTemplate: string
  css: string
}

const TEMPLATE_CONFIG: Record<
  PresenceVariant,
  { templatePath: string; cssPath: string; rowsPerPage: number }
> = {
  ctj: {
    templatePath: path.resolve('module/presence.html'),
    cssPath: path.resolve('module/presence.css'),
    rowsPerPage: 16,
  },
  cdd: {
    templatePath: path.resolve('module/presence-cdd.html'),
    cssPath: path.resolve('module/presence-cdd.css'),
    rowsPerPage: 31,
  },
}

const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g
const cachedTemplates: Partial<Record<PresenceVariant, TemplateParts>> = {}
const FONT_FAMILY = 'PresenceReport'
const FALLBACK_FONTS =
  '"Times New Roman", Times, "Noto Serif CJK SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "SimHei", serif'
const FONT_CANDIDATES = [
  process.env.PRESENCE_PDF_FONT_PATH,
  process.env.SALARY_PDF_FONT_PATH,
]
let cachedFontCss: string | null = null

export const PRESENCE_ROWS_PER_PAGE = {
  ctj: TEMPLATE_CONFIG.ctj.rowsPerPage,
  cdd: TEMPLATE_CONFIG.cdd.rowsPerPage,
} as const

export async function renderPresenceReportHtml(
  pages: PresencePage[],
  variant: PresenceVariant,
): Promise<string> {
  const { pageTemplate, headTemplate, css } = await loadTemplateParts(variant)
  const fontCss = await loadFontCss()
  const content = pages
    .map((page) => fillTemplate(pageTemplate, page))
    .filter(Boolean)
    .join('\n')
  const headContent = [headTemplate, `<style>${css}\n${fontCss}</style>`]
    .filter(Boolean)
    .join('\n')

  return [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    headContent,
    '</head>',
    '<body>',
    content,
    '</body>',
    '</html>',
  ].join('\n')
}

async function loadTemplateParts(variant: PresenceVariant): Promise<TemplateParts> {
  if (cachedTemplates[variant]) return cachedTemplates[variant] as TemplateParts
  const config = TEMPLATE_CONFIG[variant]
  const [html, css] = await Promise.all([
    fs.readFile(config.templatePath, 'utf-8'),
    fs.readFile(config.cssPath, 'utf-8').catch(() => ''),
  ])
  const headTemplate = extractHead(html)
  const pageTemplate = extractBody(html)
  const template = { pageTemplate, headTemplate, css }
  cachedTemplates[variant] = template
  return template
}

function extractHead(html: string) {
  const match = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  if (match && match[1]) return match[1].trim()
  return ''
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
  for (const candidate of FONT_CANDIDATES) {
    if (!candidate) continue
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

function resolveFontFormat(fontPath: string) {
  const ext = path.extname(fontPath).toLowerCase()
  if (ext === '.otf') return { mime: 'font/otf', format: 'opentype' }
  if (ext === '.woff2') return { mime: 'font/woff2', format: 'woff2' }
  if (ext === '.woff') return { mime: 'font/woff', format: 'woff' }
  return { mime: 'font/ttf', format: 'truetype' }
}

function fillTemplate(template: string, page: PresencePage) {
  const rowsHtml = renderRows(page.rows)
  const replacements: Record<string, string> = {
    employeeName: escapeHtml(page.employeeName),
    employeeRole: escapeHtml(page.employeeRole),
    periodStart: escapeHtml(page.periodStart),
    periodEnd: escapeHtml(page.periodEnd),
    rows: rowsHtml,
  }

  return template.replace(PLACEHOLDER_REGEX, (_, rawKey: string) => {
    const key = rawKey.trim()
    if (!key) return ''
    return replacements[key] ?? ''
  })
}

function renderRows(rows: PresenceRow[]) {
  return rows
    .map((row) => {
      const rowClass = row.isWeekend ? ' class="bg-gray"' : ''
      const slashClass = row.isWeekend ? ' class="slash-cell"' : ''
      const timeValue = row.date ? '-' : ''
      return [
        `<tr${rowClass}>`,
        `<td>${formatCell(row.date)}</td>`,
        `<td>${formatCell(timeValue)}</td>`,
        `<td>${formatCell(timeValue)}</td>`,
        `<td${slashClass}>${formatCell('')}</td>`,
        `<td>${formatCell('')}</td>`,
        `<td>${formatCell('')}</td>`,
        `<td>${formatCell('')}</td>`,
        `<td>${formatCell('')}</td>`,
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
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
