import 'server-only'

const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g

export interface PlaceholderField {
  key: string
  path: string
}

/**
 * Extract all unique placeholder keys from a template string.
 * Placeholders follow the {{path}} convention (e.g. {{documentMeta.projectName}}).
 */
export function extractPlaceholderKeys(html: string): string[] {
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER_REGEX.exec(html))) {
    const rawKey = match[1].trim()
    if (!rawKey) continue
    keys.add(rawKey)
  }
  return Array.from(keys)
}

/**
 * Build a basic placeholder descriptor list that can be enriched elsewhere.
 */
export function buildPlaceholderFields(html: string): PlaceholderField[] {
  return extractPlaceholderKeys(html).map((key) => ({
    key,
    path: key,
  }))
}
