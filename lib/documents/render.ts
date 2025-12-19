import 'server-only'

import { SubmissionData, SubmissionItem } from '@/types/documents'

const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g

export interface RenderOptions {
  /**
   * Minimal number of rows in the items table; blanks will be padded to preserve layout.
   */
  minItemRows?: number
  /**
   * Maximum number of rows in the items table; extra items are truncated to preserve layout.
   */
  maxItemRows?: number
  /**
   * Text for the watermark/page number placeholder.
   */
  pageNumberText?: string
  /**
   * Absolute base URL for static assets (e.g., https://dailywork-pearl.vercel.app).
   */
  baseUrl?: string
}

/**
 * Render the Bordereau template using {{path}} placeholders.
 * Items are rendered as a table body; other placeholders are resolved via dotted paths.
 */
export function renderBordereauTemplate(
  template: string,
  data: SubmissionData,
  options?: RenderOptions,
): string {
  const normalizedTemplate = normalizeAssets(template, options?.baseUrl)
  const minRows = options?.minItemRows ?? 12
  const maxRows = options?.maxItemRows ?? undefined
  const pageNumber = options?.pageNumberText ?? ''
  const itemsHtml = renderItemsTable(data.items ?? [], minRows, maxRows)

  const rendered = normalizedTemplate.replace(PLACEHOLDER_REGEX, (_, rawKey: string) => {
    const key = rawKey.trim()
    if (!key) return ''
    if (key === 'itemsTable') return itemsHtml
    if (key === 'pageNumber') return pageNumber
    if (key === 'comments') {
      const value = resolvePath(data, key)
      const commentText = value === undefined || value === null ? '' : String(value)
      return escapeHtml(commentText)
    }
    if (key === 'documentMeta.contractNumbers') {
      return formatContractNumbers(data.documentMeta?.contractNumbers)
    }
    const value = resolvePath(data, key)
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  })

  return rendered
}

function normalizeAssets(template: string, baseUrl?: string): string {
  const prefix = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const isAbsolute = (value: string) => /^https?:\/\//i.test(value) || value.startsWith('data:')
  const toAbs = (path: string) => {
    if (!path) return path
    if (isAbsolute(path)) return path
    if (!prefix) return path.startsWith('/') ? path : `/${path}`
    return `${prefix}${path.startsWith('/') ? path : `/${path}`}`
  }
  return template
    .replace(/href="([^"]+bordereau\.css)"/gi, (m, p1) => `href="${toAbs(p1)}"`)
    .replace(/src="([^"]+\.png)"/gi, (m, p1) => `src="${toAbs(p1)}"`)
}

function renderItemsTable(items: SubmissionItem[], minRows: number, maxRows?: number): string {
  const rows: string[] = []
  const safeItems = items ?? []
  const paddedLength = Math.max(minRows, safeItems.length)
  const finalLength = maxRows !== undefined ? Math.min(maxRows, paddedLength) : paddedLength

  for (let i = 0; i < finalLength; i += 1) {
    const item = safeItems[i]
    const designation = item?.designation ?? ''
    const quantity = item?.quantity ?? ''
    const observation = item?.observation ?? ''
    rows.push(
      [
        '<tr>',
        `<td class="col-num-cell">${i + 1}</td>`,
        `<td>${escapeHtml(designation)}</td>`,
        `<td>${escapeHtml(quantity)}</td>`,
        `<td>${escapeHtml(observation)}</td>`,
        '</tr>',
      ].join(''),
    )
  }

  return rows.join('\n')
}

function formatContractNumbers(numbers?: string[]): string {
  if (!numbers || !numbers.length) return ''
  if (numbers.length === 1) return numbers[0]
  return numbers.join(' ET ')
}

function resolvePath(source: unknown, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) return undefined
  let current: any = source
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined
    current = current[segment]
  }
  return current
}

function escapeHtml(input: unknown): string {
  if (input === undefined || input === null) return ''
  const value = String(input)
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
