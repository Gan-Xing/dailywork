import 'server-only'

import { prisma } from '@/lib/prisma'
import { processImageAsset } from '@/lib/server/imageProcessing'
import { createPresignedUrl, deleteObject, getR2Config } from '@/lib/server/r2'
import { SIGNATURE_ALLOWED_MIME_TYPES, SIGNATURE_MAX_SIZE } from '@/lib/server/signatureConfig'

const MACHINE_PHOTO_ENTITY_TYPE = 'machine-asset'
const MACHINE_PHOTO_CATEGORY = 'machine-photo'
const MACHINE_PHOTO_PURPOSE = 'machine-photo'

const PHOTO_URL_TTL = 300

export type MachinePhotoDTO = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  url: string
  previewUrl: string | null
}

export async function listMachinePhotos(machineId: number): Promise<MachinePhotoDTO[]> {
  if (!Number.isFinite(machineId) || machineId <= 0) return []

  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: MACHINE_PHOTO_ENTITY_TYPE,
      entityId: String(machineId),
      file: { category: MACHINE_PHOTO_CATEGORY },
    },
    include: {
      file: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return links.map((link) => ({
    id: link.file.id,
    originalName: link.file.originalName,
    mimeType: link.file.mimeType,
    size: link.file.size,
    createdAt: link.file.createdAt.toISOString(),
    url: createPresignedUrl({
      method: 'GET',
      storageKey: link.file.storageKey,
      expiresInSeconds: PHOTO_URL_TTL,
    }),
    previewUrl: link.file.previewStorageKey
      ? createPresignedUrl({
          method: 'GET',
          storageKey: link.file.previewStorageKey,
          expiresInSeconds: PHOTO_URL_TTL,
        })
      : null,
  }))
}

export async function createMachinePhoto(
  machineId: number,
  {
    storageKey,
    originalName,
    mimeType,
    size,
  }: { storageKey: string; originalName: string; mimeType: string; size: number },
  { createdById }: { createdById?: number | null },
): Promise<MachinePhotoDTO> {
  if (!Number.isFinite(machineId) || machineId <= 0) {
    throw new Error('机械 ID 无效')
  }

  const safeStorageKey = storageKey.trim()
  const safeName = originalName.trim()
  const safeMimeType = mimeType.trim()
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeStorageKey || !safeName || !safeMimeType || !Number.isFinite(parsedSize)) {
    throw new Error('图片信息不完整')
  }
  if (!safeStorageKey.startsWith(`files/${MACHINE_PHOTO_CATEGORY}/`)) {
    throw new Error('图片存储路径无效')
  }
  if (!SIGNATURE_ALLOWED_MIME_TYPES.has(safeMimeType)) {
    throw new Error('图片类型不支持')
  }
  if (parsedSize > SIGNATURE_MAX_SIZE) {
    throw new Error('图片过大')
  }

  const machine = await prisma.machineAsset.findUnique({
    where: { id: machineId },
    select: { id: true },
  })
  if (!machine) {
    throw new Error('机械不存在')
  }

  const { bucket } = getR2Config()
  let processedName = safeName
  let processedMimeType = safeMimeType
  let processedSize = parsedSize
  let preview: { storageKey: string; mimeType: string; size: number } | undefined

  try {
    const processed = await processImageAsset({
      storageKey: safeStorageKey,
      originalName: safeName,
      mimeType: safeMimeType,
      size: parsedSize,
      category: MACHINE_PHOTO_CATEGORY,
    })
    if (processed) {
      processedName = processed.original.originalName
      processedMimeType = processed.original.mimeType
      processedSize = processed.original.size
      preview = processed.preview
    }
  } catch (error) {
    try {
      await deleteObject(safeStorageKey)
    } catch (cleanupError) {
      console.error('[Machine Photo Upload] Cleanup failed', cleanupError)
    }
    throw new Error((error as Error).message || '图片处理失败')
  }

  const created = await prisma.$transaction(async (tx) => {
    const file = await tx.fileAsset.create({
      data: {
        category: MACHINE_PHOTO_CATEGORY,
        storageKey: safeStorageKey,
        bucket,
        originalName: processedName,
        mimeType: processedMimeType,
        size: processedSize,
        previewStorageKey: preview?.storageKey ?? null,
        previewMimeType: preview?.mimeType ?? null,
        previewSize: preview?.size ?? null,
        createdById: createdById ?? null,
      },
    })

    await tx.fileAssetLink.create({
      data: {
        fileId: file.id,
        entityType: MACHINE_PHOTO_ENTITY_TYPE,
        entityId: String(machineId),
        purpose: MACHINE_PHOTO_PURPOSE,
        createdById: createdById ?? null,
      },
    })

    return file
  })

  return {
    id: created.id,
    originalName: created.originalName,
    mimeType: created.mimeType,
    size: created.size,
    createdAt: created.createdAt.toISOString(),
    url: createPresignedUrl({
      method: 'GET',
      storageKey: created.storageKey,
      expiresInSeconds: PHOTO_URL_TTL,
    }),
    previewUrl: created.previewStorageKey
      ? createPresignedUrl({
          method: 'GET',
          storageKey: created.previewStorageKey,
          expiresInSeconds: PHOTO_URL_TTL,
        })
      : null,
  }
}

export async function deleteMachinePhoto(machineId: number, fileId: number) {
  if (!Number.isFinite(machineId) || machineId <= 0) {
    throw new Error('机械 ID 无效')
  }
  if (!Number.isFinite(fileId) || fileId <= 0) {
    throw new Error('图片 ID 无效')
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const link = await tx.fileAssetLink.findFirst({
      where: {
        entityType: MACHINE_PHOTO_ENTITY_TYPE,
        entityId: String(machineId),
        fileId,
        file: { category: MACHINE_PHOTO_CATEGORY },
      },
      include: { file: true },
    })
    if (!link) {
      throw new Error('图片不存在')
    }

    await tx.fileAssetLink.deleteMany({
      where: {
        entityType: MACHINE_PHOTO_ENTITY_TYPE,
        entityId: String(machineId),
        fileId,
      },
    })

    const remaining = await tx.fileAsset.findUnique({
      where: { id: fileId },
      include: { _count: { select: { links: true, signatures: true } } },
    })

    if (!remaining) {
      return {
        shouldDeleteObjects: true,
        storageKey: link.file.storageKey,
        previewStorageKey: link.file.previewStorageKey,
      }
    }

    const shouldDeleteObjects = remaining._count.links === 0 && remaining._count.signatures === 0
    if (shouldDeleteObjects) {
      await tx.fileAsset.delete({ where: { id: fileId } })
    }

    return {
      shouldDeleteObjects,
      storageKey: remaining.storageKey,
      previewStorageKey: remaining.previewStorageKey,
    }
  })

  if (deleted.shouldDeleteObjects) {
    try {
      await deleteObject(deleted.storageKey)
      if (deleted.previewStorageKey) {
        await deleteObject(deleted.previewStorageKey)
      }
    } catch (error) {
      console.error('[Machine Photo Delete] R2 cleanup failed', error)
    }
  }

  return { ok: true }
}

export const validateMachinePhotoUploadRequest = ({
  filename,
  contentType,
  size,
}: {
  filename: string
  contentType: string
  size: number
}) => {
  const safeFilename = filename.trim()
  const safeContentType = contentType.trim()
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeFilename || !safeContentType || !Number.isFinite(parsedSize)) {
    throw new Error('图片文件信息不完整')
  }
  if (!SIGNATURE_ALLOWED_MIME_TYPES.has(safeContentType)) {
    throw new Error('图片文件类型不支持')
  }
  if (parsedSize > SIGNATURE_MAX_SIZE) {
    throw new Error('图片文件过大')
  }

  return { safeFilename, safeContentType, parsedSize }
}
