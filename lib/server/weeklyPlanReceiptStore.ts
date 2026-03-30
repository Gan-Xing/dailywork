import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { processImageAsset } from '@/lib/server/imageProcessing'
import { createPresignedUrl, deleteObject, getR2Config } from '@/lib/server/r2'

export const WEEKLY_PLAN_RECEIPT_ENTITY_TYPE = 'weekly-plan-item'
export const WEEKLY_PLAN_RECEIPT_CATEGORY = 'weekly-plan-receipt'
export const WEEKLY_PLAN_RECEIPT_PURPOSE = 'receipt'

const RECEIPT_URL_TTL = 300
const WEEKLY_PLAN_RECEIPT_MAX_SIZE = 20 * 1024 * 1024
const WEEKLY_PLAN_RECEIPT_ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
])

type ReceiptCleanupTarget = {
  storageKey: string
  previewStorageKey: string | null
}

export type WeeklyPlanReceiptDTO = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  url: string
  previewUrl: string | null
}

const normalizeMimeType = (mimeType: string) => mimeType.trim().toLowerCase()

const isReceiptImage = (mimeType: string) => normalizeMimeType(mimeType).startsWith('image/')

const mapReceiptLink = (
  link: {
    file: {
      id: number
      originalName: string
      mimeType: string
      size: number
      createdAt: Date
      storageKey: string
      previewStorageKey: string | null
    }
  },
): WeeklyPlanReceiptDTO => ({
  id: link.file.id,
  originalName: link.file.originalName,
  mimeType: link.file.mimeType,
  size: link.file.size,
  createdAt: link.file.createdAt.toISOString(),
  url: createPresignedUrl({
    method: 'GET',
    storageKey: link.file.storageKey,
    expiresInSeconds: RECEIPT_URL_TTL,
  }),
  previewUrl: link.file.previewStorageKey
    ? createPresignedUrl({
        method: 'GET',
        storageKey: link.file.previewStorageKey,
        expiresInSeconds: RECEIPT_URL_TTL,
      })
    : null,
})

const ensureWeeklyPlanItem = async (
  planId: number,
  itemId: number,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  if (!Number.isInteger(planId) || planId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    throw new Error('周计划明细不存在')
  }

  const item = await client.weeklyDeliveryPlanItem.findUnique({
    where: { id: itemId },
    select: { id: true, planId: true },
  })

  if (!item || item.planId !== planId) {
    throw new Error('周计划明细不存在')
  }

  return item
}

const collectReceiptCleanupTargets = async (
  tx: Prisma.TransactionClient,
  itemIds: number[],
  fileId?: number,
  requireMatch = false,
): Promise<ReceiptCleanupTarget[]> => {
  const normalizedItemIds = Array.from(
    new Set(itemIds.filter((itemId) => Number.isInteger(itemId) && itemId > 0)),
  )
  if (!normalizedItemIds.length) return []

  const links = await tx.fileAssetLink.findMany({
    where: {
      entityType: WEEKLY_PLAN_RECEIPT_ENTITY_TYPE,
      entityId: { in: normalizedItemIds.map((itemId) => String(itemId)) },
      purpose: WEEKLY_PLAN_RECEIPT_PURPOSE,
      ...(fileId ? { fileId } : {}),
      file: { category: WEEKLY_PLAN_RECEIPT_CATEGORY },
    },
    include: {
      file: {
        select: {
          id: true,
          storageKey: true,
          previewStorageKey: true,
        },
      },
    },
  })

  if (!links.length) {
    if (requireMatch) {
      throw new Error('收货单不存在')
    }
    return []
  }

  await tx.fileAssetLink.deleteMany({
    where: {
      id: { in: links.map((link) => link.id) },
    },
  })

  const linkedFileIds = Array.from(new Set(links.map((link) => link.file.id)))
  const fileRows = await tx.fileAsset.findMany({
    where: { id: { in: linkedFileIds } },
    select: {
      id: true,
      storageKey: true,
      previewStorageKey: true,
      _count: { select: { links: true, signatures: true } },
    },
  })

  const cleanupTargets: ReceiptCleanupTarget[] = []

  for (const file of fileRows) {
    if (file._count.links === 0 && file._count.signatures === 0) {
      await tx.fileAsset.delete({ where: { id: file.id } })
      cleanupTargets.push({
        storageKey: file.storageKey,
        previewStorageKey: file.previewStorageKey,
      })
    }
  }

  return cleanupTargets
}

const cleanupReceiptObjects = async (targets: ReceiptCleanupTarget[]) => {
  for (const target of targets) {
    try {
      await deleteObject(target.storageKey)
      if (target.previewStorageKey) {
        await deleteObject(target.previewStorageKey)
      }
    } catch (error) {
      console.error('[Weekly Plan Receipt] R2 cleanup failed', error)
    }
  }
}

export const validateWeeklyPlanReceiptUploadRequest = ({
  filename,
  contentType,
  size,
}: {
  filename: string
  contentType: string
  size: number
}) => {
  const safeFilename = filename.trim()
  const safeContentType = normalizeMimeType(contentType)
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeFilename || !safeContentType || !Number.isFinite(parsedSize)) {
    throw new Error('收货单文件信息不完整')
  }
  if (!WEEKLY_PLAN_RECEIPT_ALLOWED_MIME_TYPES.has(safeContentType)) {
    throw new Error('仅支持图片或 PDF 文件')
  }
  if (parsedSize > WEEKLY_PLAN_RECEIPT_MAX_SIZE) {
    throw new Error('收货单文件不能超过 20MB')
  }

  return { safeFilename, safeContentType, parsedSize }
}

export async function assertWeeklyPlanReceiptTarget(planId: number, itemId: number) {
  await ensureWeeklyPlanItem(planId, itemId)
}

export async function listWeeklyPlanReceipts(
  planId: number,
  itemId: number,
): Promise<WeeklyPlanReceiptDTO[]> {
  await ensureWeeklyPlanItem(planId, itemId)

  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: WEEKLY_PLAN_RECEIPT_ENTITY_TYPE,
      entityId: String(itemId),
      purpose: WEEKLY_PLAN_RECEIPT_PURPOSE,
      file: { category: WEEKLY_PLAN_RECEIPT_CATEGORY },
    },
    include: {
      file: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          createdAt: true,
          storageKey: true,
          previewStorageKey: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return links.map(mapReceiptLink)
}

export async function createWeeklyPlanReceipt(
  planId: number,
  itemId: number,
  {
    storageKey,
    originalName,
    mimeType,
    size,
  }: { storageKey: string; originalName: string; mimeType: string; size: number },
  { createdById }: { createdById?: number | null },
): Promise<WeeklyPlanReceiptDTO> {
  await ensureWeeklyPlanItem(planId, itemId)

  const safeStorageKey = storageKey.trim()
  const safeOriginalName = originalName.trim()
  const safeMimeType = normalizeMimeType(mimeType)
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeStorageKey || !safeOriginalName || !safeMimeType || !Number.isFinite(parsedSize)) {
    throw new Error('收货单文件信息不完整')
  }
  if (!safeStorageKey.startsWith(`files/${WEEKLY_PLAN_RECEIPT_CATEGORY}/`)) {
    throw new Error('收货单存储路径无效')
  }
  if (!WEEKLY_PLAN_RECEIPT_ALLOWED_MIME_TYPES.has(safeMimeType)) {
    throw new Error('仅支持图片或 PDF 文件')
  }
  if (parsedSize > WEEKLY_PLAN_RECEIPT_MAX_SIZE) {
    throw new Error('收货单文件不能超过 20MB')
  }

  const { bucket } = getR2Config()
  let processedName = safeOriginalName
  let processedMimeType = safeMimeType
  let processedSize = parsedSize
  let preview: { storageKey: string; mimeType: string; size: number } | undefined

  try {
    if (isReceiptImage(safeMimeType)) {
      const processed = await processImageAsset({
        storageKey: safeStorageKey,
        originalName: safeOriginalName,
        mimeType: safeMimeType,
        size: parsedSize,
        category: WEEKLY_PLAN_RECEIPT_CATEGORY,
      })
      if (processed) {
        processedName = processed.original.originalName
        processedMimeType = processed.original.mimeType
        processedSize = processed.original.size
        preview = processed.preview
      }
    }
  } catch (error) {
    try {
      await deleteObject(safeStorageKey)
    } catch (cleanupError) {
      console.error('[Weekly Plan Receipt Upload] Cleanup failed', cleanupError)
    }
    throw new Error((error as Error).message || '收货单处理失败')
  }

  const createdFile = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const file = await tx.fileAsset.create({
          data: {
            category: WEEKLY_PLAN_RECEIPT_CATEGORY,
            storageKey: safeStorageKey,
            bucket,
            originalName: processedName,
            mimeType: processedMimeType,
            size: processedSize,
            previewStorageKey: preview?.storageKey ?? null,
            previewMimeType: preview?.mimeType ?? null,
            previewSize: preview?.size ?? null,
            ownerUserId: createdById ?? null,
            createdById: createdById ?? null,
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true,
            storageKey: true,
            previewStorageKey: true,
          },
        })

        await tx.fileAssetLink.create({
          data: {
            fileId: file.id,
            entityType: WEEKLY_PLAN_RECEIPT_ENTITY_TYPE,
            entityId: String(itemId),
            purpose: WEEKLY_PLAN_RECEIPT_PURPOSE,
            label: processedName,
            createdById: createdById ?? null,
          },
        })

        return file
      })
    } catch (error) {
      try {
        await deleteObject(safeStorageKey)
        if (preview?.storageKey) {
          await deleteObject(preview.storageKey)
        }
      } catch (cleanupError) {
        console.error('[Weekly Plan Receipt Upload] Transaction cleanup failed', cleanupError)
      }
      throw error
    }
  })()

  return mapReceiptLink({ file: createdFile })
}

export async function deleteWeeklyPlanReceipt(planId: number, itemId: number, fileId: number) {
  await ensureWeeklyPlanItem(planId, itemId)
  if (!Number.isInteger(fileId) || fileId <= 0) {
    throw new Error('收货单不存在')
  }

  const cleanupTargets = await prisma.$transaction((tx) =>
    collectReceiptCleanupTargets(tx, [itemId], fileId, true),
  )

  await cleanupReceiptObjects(cleanupTargets)
  return { ok: true }
}

export async function purgeWeeklyPlanReceiptsForItemIds(itemIds: number[]) {
  const cleanupTargets = await prisma.$transaction((tx) =>
    collectReceiptCleanupTargets(tx, itemIds),
  )
  await cleanupReceiptObjects(cleanupTargets)
}
