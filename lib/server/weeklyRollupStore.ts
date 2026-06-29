import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  WEEKLY_ROLLUP_ENTITY_TYPE,
  WEEKLY_ROLLUP_PURPOSE,
  buildReportPeriodFromKey,
} from '@/lib/weeklyRollups'
import { downloadObjectBuffer } from '@/lib/server/r2'

export type WeeklyRollupRecord = {
  periodKey: string
  title: string
  reportPeriod: string
  weekLabel: string | null
  description: string | null
  projectNames: string[]
  fileId: number
  originalName: string
  size: number
  updatedAt: string
  createdAt: string
}

type WeeklyRollupLinkRow = Prisma.FileAssetLinkGetPayload<{
  include: {
    file: {
      select: {
        id: true
        originalName: true
        size: true
        updatedAt: true
        createdAt: true
        storageKey: true
        previewStorageKey: true
        mimeType: true
        checksum: true
      }
    }
  }
}>

type WeeklyRollupMeta = {
  title?: string
  reportPeriod?: string
  weekLabel?: string
  description?: string
  projectNames?: string[]
  sourceFilename?: string
  sourceRelativePath?: string
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeStringList = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item))
}

const normalizeMeta = (value: Prisma.JsonValue | null): WeeklyRollupMeta => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const objectValue = value as Prisma.JsonObject
  return {
    title: normalizeString(objectValue.title) ?? undefined,
    reportPeriod: normalizeString(objectValue.reportPeriod) ?? undefined,
    weekLabel: normalizeString(objectValue.weekLabel) ?? undefined,
    description: normalizeString(objectValue.description) ?? undefined,
    projectNames: normalizeStringList(objectValue.projectNames),
    sourceFilename: normalizeString(objectValue.sourceFilename) ?? undefined,
    sourceRelativePath: normalizeString(objectValue.sourceRelativePath) ?? undefined,
  }
}

const fallbackTitleFromFilename = (filename: string, reportPeriod: string) => {
  const normalized = filename.replace(/\.html?$/i, '')
  const prefix = normalized.replace(/^\d{8}-\d{8}_?/, '').replace(/_/g, ' ').trim()
  if (prefix) return `${prefix} - ${reportPeriod}`
  return `负责人周完成产值汇总 - ${reportPeriod}`
}

const toWeeklyRollupRecord = (row: WeeklyRollupLinkRow): WeeklyRollupRecord => {
  const meta = normalizeMeta(row.meta)
  const periodKey = row.entityId
  const reportPeriod = meta.reportPeriod ?? buildReportPeriodFromKey(periodKey)
  const title = meta.title ?? fallbackTitleFromFilename(row.file.originalName, reportPeriod)

  return {
    periodKey,
    title,
    reportPeriod,
    weekLabel: meta.weekLabel ?? null,
    description: meta.description ?? null,
    projectNames: meta.projectNames ?? [],
    fileId: row.file.id,
    originalName: row.file.originalName,
    size: row.file.size,
    updatedAt: row.file.updatedAt.toISOString(),
    createdAt: row.file.createdAt.toISOString(),
  }
}

const findWeeklyRollupLinks = async () =>
  prisma.fileAssetLink.findMany({
    where: {
      entityType: WEEKLY_ROLLUP_ENTITY_TYPE,
      purpose: WEEKLY_ROLLUP_PURPOSE,
    },
    include: {
      file: {
        select: {
          id: true,
          originalName: true,
          size: true,
          updatedAt: true,
          createdAt: true,
          storageKey: true,
          previewStorageKey: true,
          mimeType: true,
          checksum: true,
        },
      },
    },
    orderBy: [
      { entityId: 'desc' },
      { id: 'desc' },
    ],
  })

export async function listWeeklyRollups(): Promise<WeeklyRollupRecord[]> {
  const rows = await findWeeklyRollupLinks()
  const deduped = new Map<string, WeeklyRollupLinkRow>()

  for (const row of rows) {
    if (!deduped.has(row.entityId)) {
      deduped.set(row.entityId, row)
    }
  }

  return Array.from(deduped.values()).map(toWeeklyRollupRecord)
}

export async function getWeeklyRollup(periodKey: string) {
  const rows = await prisma.fileAssetLink.findMany({
    where: {
      entityType: WEEKLY_ROLLUP_ENTITY_TYPE,
      purpose: WEEKLY_ROLLUP_PURPOSE,
      entityId: periodKey,
    },
    include: {
      file: {
        select: {
          id: true,
          originalName: true,
          size: true,
          updatedAt: true,
          createdAt: true,
          storageKey: true,
          previewStorageKey: true,
          mimeType: true,
          checksum: true,
        },
      },
    },
    orderBy: [{ id: 'desc' }],
    take: 1,
  })

  const row = rows[0]
  if (!row) return null

  const record = toWeeklyRollupRecord(row)
  const htmlBuffer = await downloadObjectBuffer(row.file.storageKey)

  return {
    ...record,
    html: htmlBuffer.toString('utf-8'),
  }
}
