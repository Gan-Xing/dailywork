import path from 'path'
import { pathToFileURL } from 'url'

/**
 * Dynamically import the template-parser from the project lib directory.
 * This avoids ESM/TS path alias resolution issues when running from node.
 */
export async function buildPlaceholderFields(html: string) {
  const moduleUrl = pathToFileURL(path.resolve('lib/documents/template-parser.ts')).href
  const mod = await import(moduleUrl)
  return (mod.buildPlaceholderFields as (html: string) => { key: string; path: string }[])(html)
}
