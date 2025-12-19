import fs from 'fs/promises'
import path from 'path'

const templatePath = path.resolve('module/bordereau.html')
const cssPath = path.resolve('module/bordereau.css')

export type LoadedTemplate = {
  id: string
  name: string
  version: number
  status: string
  language?: string
  html: string
  updatedAt: Date
  placeholders: Array<{ key: string; path?: string }>
}

export async function loadBordereauTemplateFromFile(): Promise<LoadedTemplate> {
  const html = await fs.readFile(templatePath, 'utf-8')
  const css = await readCssSafe()
  const combined = css ? `<style>${css}</style>\n${html}` : html
  return {
    id: 'file-bordereau',
    name: 'Bordereau (file)',
    version: 1,
    status: 'PUBLISHED',
    language: 'fr',
    html: combined,
    updatedAt: new Date(),
    placeholders: extractPlaceholderKeys(html),
  }
}

export function extractPlaceholderKeys(html: string) {
  const regex = /{{\s*([^{}]+?)\s*}}/g
  const keys = new Set<string>()
  let match
  while ((match = regex.exec(html))) {
    const key = (match[1] || '').trim()
    if (key) keys.add(key)
  }
  return Array.from(keys).map((key) => ({ key, path: key }))
}

async function readCssSafe() {
  try {
    return await fs.readFile(cssPath, 'utf-8')
  } catch {
    return ''
  }
}
