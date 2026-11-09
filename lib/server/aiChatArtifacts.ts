import { createHash, randomUUID } from 'node:crypto'

import { prisma } from '@/lib/prisma'
import {
  deleteObject,
  downloadObjectBuffer,
  getR2Config,
  uploadObjectBuffer,
} from '@/lib/server/r2'
import { buildWeeklyPlanPdf } from '@/lib/server/weeklyPlanPdfExport'

export { getWeeklyPlanVersion } from '@/lib/server/weeklyPlanPdfExport'

const PDF_MIME_TYPE = 'application/pdf'
const artifactPrefix = (userId: number) => `files/attachment/ai-chat/${userId}/`
const sha256 = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex')

const assertId = (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid artifact owner or resource ID')
}

const assertPdf = (buffer: Uint8Array) => {
  if (!/^%PDF-\d\.\d/.test(Buffer.from(buffer.subarray(0, 8)).toString('latin1'))) {
    throw new Error('Artifact must contain a PDF document')
  }
}

const normalizeFilename = (filename: string) => {
  const basename = filename.split(/[/\\]/).pop()?.replace(/[\u0000-\u001f\u007f";]/g, '').trim()
  if (!basename) return 'weekly-plan.pdf'
  return `${basename.replace(/\.pdf$/i, '').slice(0, 180)}.pdf`
}

// The trusted caller must authorize material:view and signature:use before invoking this service.
export const buildAiWeeklyPlanPdf = async (
  planId: number,
  signed: boolean,
): Promise<{ buffer: Uint8Array; filename: string; sourceVersion: string }> => {
  assertId(planId)
  if (typeof signed !== 'boolean') throw new Error('Signed export selection must be a boolean')
  const result = await buildWeeklyPlanPdf(planId, { signed, requireActiveSignatures: true })
  if (!result) throw new Error('Weekly plan not found')
  return result
}

export const storeAiPdfArtifact = async (
  userId: number,
  buffer: Uint8Array,
  filename: string,
): Promise<{ fileAssetId: number }> => {
  assertId(userId)
  const bytes = Uint8Array.from(buffer)
  assertPdf(bytes)
  const checksum = sha256(bytes)
  const { bucket } = getR2Config()
  const where = {
    ownerUserId: userId,
    createdById: userId,
    mimeType: PDF_MIME_TYPE,
    category: 'attachment',
    bucket,
    checksum,
    storageKey: { startsWith: artifactPrefix(userId) },
  }
  const existing = await prisma.fileAsset.findFirst({ where, select: { id: true } })
  if (existing) return { fileAssetId: existing.id }

  // Unique object keys keep a losing upload's cleanup from deleting a winner's data.
  const storageKey = `${artifactPrefix(userId)}${randomUUID()}.pdf`
  let file: { id: number; storageKey: string }
  try {
    await uploadObjectBuffer(storageKey, bytes, PDF_MIME_TYPE)
    file = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dailywork:ai-pdf'), hashtext(${`${userId}:${checksum}`}))`
      const duplicate = await tx.fileAsset.findFirst({ where, select: { id: true, storageKey: true } })
      if (duplicate) return duplicate
      return tx.fileAsset.create({
        data: {
          category: 'attachment',
          storageKey,
          bucket,
          originalName: normalizeFilename(filename),
          mimeType: PDF_MIME_TYPE,
          size: bytes.byteLength,
          checksum,
          ownerUserId: userId,
          createdById: userId,
        },
        select: { id: true, storageKey: true },
      })
    }, { timeout: 30_000 })
  } catch (error) {
    try {
      await deleteObject(storageKey)
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'PDF artifact save and R2 cleanup failed')
    }
    throw error
  }
  if (file.storageKey !== storageKey) await deleteObject(storageKey)
  return { fileAssetId: file.id }
}

export const loadAiPdfArtifact = async (
  userId: number,
  fileAssetId: number,
): Promise<{ buffer: Uint8Array; filename: string }> => {
  assertId(userId)
  assertId(fileAssetId)
  const { bucket } = getR2Config()
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileAssetId, ownerUserId: userId, mimeType: PDF_MIME_TYPE, bucket },
  })
  if (!file || file.ownerUserId !== userId || file.mimeType !== PDF_MIME_TYPE || file.bucket !== bucket) {
    throw new Error('PDF artifact not found')
  }
  const buffer = await downloadObjectBuffer(file.storageKey)
  assertPdf(buffer)
  if (file.checksum && sha256(buffer) !== file.checksum) {
    throw new Error('PDF artifact checksum mismatch')
  }
  return { buffer, filename: normalizeFilename(file.originalName) }
}
