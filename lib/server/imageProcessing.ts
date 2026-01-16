import 'server-only'

import sharp from 'sharp'

import {
  buildFilePreviewStorageKey,
  downloadObjectBuffer,
  uploadObjectBuffer,
} from '@/lib/server/r2'

const MAX_ORIGINAL_SIZE_BYTES = 5 * 1024 * 1024
const PREVIEW_MAX_EDGE = 1600
const PREVIEW_QUALITY = 80
const MIN_QUALITY = 60
const QUALITY_STEP = 4
const SCALE_STEP = 0.1
const MIN_SCALE = 0.6

const normalizeMimeType = (mimeType: string) => mimeType.trim().toLowerCase()

const isProcessableImage = (mimeType: string) => {
  if (!mimeType.startsWith('image/')) return false
  return !mimeType.includes('svg') && !mimeType.includes('gif')
}

const stripExtension = (filename: string) => {
  const index = filename.lastIndexOf('.')
  if (index <= 0) return filename
  return filename.slice(0, index)
}

const updateFilenameExtension = (filename: string, extension: string) => {
  const safeName = filename.trim() || 'file'
  const normalizedExt = extension.startsWith('.') ? extension.slice(1) : extension
  const baseName = stripExtension(safeName)
  return `${baseName}.${normalizedExt}`
}

const encodeImage = async (
  input: Buffer,
  {
    format,
    quality,
    width,
    height,
  }: {
    format: 'jpeg' | 'webp'
    quality: number
    width?: number
    height?: number
  },
) => {
  let pipeline = sharp(input, { failOnError: false }).rotate()
  if (width && height) {
    pipeline = pipeline.resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  if (format === 'jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
  }
  return pipeline.webp({ quality }).toBuffer()
}

const compressImageToTarget = async (
  input: Buffer,
  mimeType: string,
  originalName: string,
  maxBytes: number,
) => {
  const metadata = await sharp(input, { failOnError: false }).metadata()
  const hasAlpha = Boolean(metadata.hasAlpha)
  const normalizedMime = normalizeMimeType(mimeType)
  const outputFormat: 'jpeg' | 'webp' =
    normalizedMime === 'image/webp' || (normalizedMime === 'image/png' && hasAlpha)
      ? 'webp'
      : 'jpeg'
  const outputMimeType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg'
  const outputExtension = outputFormat === 'webp' ? 'webp' : 'jpg'
  const isSameMime =
    normalizedMime === outputMimeType ||
    (normalizedMime === 'image/jpg' && outputMimeType === 'image/jpeg')
  const nextName = isSameMime
    ? originalName
    : updateFilenameExtension(originalName, outputExtension)

  let quality = outputFormat === 'webp' ? 80 : 82
  let buffer = await encodeImage(input, { format: outputFormat, quality })

  while (buffer.length > maxBytes && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP
    buffer = await encodeImage(input, { format: outputFormat, quality })
  }

  if (buffer.length > maxBytes && metadata.width && metadata.height) {
    const finalQuality = Math.max(quality, MIN_QUALITY)
    let scale = 1 - SCALE_STEP
    while (buffer.length > maxBytes && scale >= MIN_SCALE) {
      const width = Math.max(1, Math.round(metadata.width * scale))
      const height = Math.max(1, Math.round(metadata.height * scale))
      buffer = await encodeImage(input, {
        format: outputFormat,
        quality: finalQuality,
        width,
        height,
      })
      scale -= SCALE_STEP
    }
  }

  if (buffer.length > maxBytes) {
    throw new Error('Image compression failed')
  }

  return {
    buffer,
    mimeType: outputMimeType,
    originalName: nextName,
  }
}

export type ImageProcessResult = {
  original: {
    mimeType: string
    size: number
    originalName: string
  }
  preview?: {
    storageKey: string
    mimeType: string
    size: number
  }
}

export const processImageAsset = async ({
  storageKey,
  originalName,
  mimeType,
  size,
  category,
}: {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
  category: string
}): Promise<ImageProcessResult | null> => {
  const normalizedMime = normalizeMimeType(mimeType)
  if (!isProcessableImage(normalizedMime)) return null

  const originalBuffer: Buffer = await downloadObjectBuffer(storageKey)
  const actualSize = originalBuffer.length || size

  let finalBuffer: Buffer = originalBuffer
  let finalMimeType = normalizedMime
  let finalName = originalName

  if (actualSize > MAX_ORIGINAL_SIZE_BYTES) {
    const compressed = await compressImageToTarget(
      originalBuffer,
      normalizedMime,
      originalName,
      MAX_ORIGINAL_SIZE_BYTES,
    )
    await uploadObjectBuffer(storageKey, compressed.buffer, compressed.mimeType)
    finalBuffer = compressed.buffer
    finalMimeType = compressed.mimeType
    finalName = compressed.originalName
  }

  let preview: ImageProcessResult['preview']
  try {
    const previewBuffer = await sharp(finalBuffer, { failOnError: false })
      .rotate()
      .resize({
        width: PREVIEW_MAX_EDGE,
        height: PREVIEW_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer()

    const previewName = `${stripExtension(finalName)}-preview.webp`
    const previewStorageKey = buildFilePreviewStorageKey(category, previewName)
    await uploadObjectBuffer(previewStorageKey, previewBuffer, 'image/webp')
    preview = {
      storageKey: previewStorageKey,
      mimeType: 'image/webp',
      size: previewBuffer.length,
    }
  } catch (error) {
    console.error('[FileAsset Preview] Image processing failed', error)
  }

  return {
    original: {
      mimeType: finalMimeType,
      size: finalBuffer.length,
      originalName: finalName,
    },
    preview,
  }
}
