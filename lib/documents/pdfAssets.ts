import fs from 'node:fs/promises'
import path from 'node:path'

const IMAGE_SOURCE_REGEX = /(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi
const INLINE_ASSETS = new Map([
  ['logo_rb.png', 'image/png'],
  ['rb.png', 'image/png'],
])

export async function inlineSubmissionPdfAssets(
  html: string,
  publicDirectory = path.join(process.cwd(), 'public'),
): Promise<string> {
  const referencedAssets = new Set<string>()

  IMAGE_SOURCE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = IMAGE_SOURCE_REGEX.exec(html)) !== null) {
    const assetName = getAssetName(match[2])
    if (assetName && INLINE_ASSETS.has(assetName)) referencedAssets.add(assetName)
  }

  if (referencedAssets.size === 0) return html

  const dataUrls = new Map<string, string>()
  await Promise.all(
    Array.from(referencedAssets).map(async (assetName) => {
      const mimeType = INLINE_ASSETS.get(assetName)
      if (!mimeType) return
      const fileName = assetName === 'rb.png' ? 'RB.png' : assetName
      const contents = await fs.readFile(path.join(publicDirectory, fileName))
      dataUrls.set(assetName, `data:${mimeType};base64,${contents.toString('base64')}`)
    }),
  )

  return html.replace(IMAGE_SOURCE_REGEX, (fullMatch, prefix: string, source: string, suffix: string) => {
    const assetName = getAssetName(source)
    const dataUrl = assetName ? dataUrls.get(assetName) : undefined
    return dataUrl ? `${prefix}${dataUrl}${suffix}` : fullMatch
  })
}

function getAssetName(source: string): string | null {
  if (source.startsWith('data:')) return null
  try {
    const pathname = new URL(source, 'http://dailywork.local').pathname
    const fileName = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase()
    return fileName || null
  } catch {
    return null
  }
}
