import { Prisma, type RoadCrossSectionStatus as PrismaRoadCrossSectionStatus } from '@prisma/client'

import { resolveRoadLabels } from '@/lib/i18n/roadDictionary'
import { prisma } from '@/lib/prisma'
import type {
  RoadCrossSectionDTO,
  RoadCrossSectionPayload,
  RoadCrossSectionStatus,
  RoadSectionDTO,
} from '@/lib/progressTypes'

export const ROAD_CROSS_SECTION_STATUSES: RoadCrossSectionStatus[] = [
  'APPROVED',
  'ASSUMED_FROM_REFERENCE',
  'NEEDS_CONFIRMATION',
  'SUPERSEDED',
]

const ROAD_CROSS_SECTION_STATUS_SET = new Set<string>(ROAD_CROSS_SECTION_STATUSES)

const crossSectionInclude = {
  sourceDocument: {
    select: {
      id: true,
      documentName: true,
      versionTag: true,
      coverageScope: true,
    },
  },
  referenceRoad: {
    select: {
      id: true,
      projectId: true,
      slug: true,
      name: true,
      startPk: true,
      endPk: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.RoadCrossSectionInclude

type RoadCrossSectionRow = Prisma.RoadCrossSectionGetPayload<{
  include: typeof crossSectionInclude
}>

const decimal = (value: number) => new Prisma.Decimal(value)

const normalizeNumber = (value: unknown, fieldName: string) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName}必须是有效数字`)
  }
  return number
}

const normalizeOptionalNumber = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = normalizeNumber(value, fieldName)
  if (number < 0) {
    throw new Error(`${fieldName}不能为负数`)
  }
  return number
}

const normalizeOptionalText = (value: unknown) => {
  const text = String(value ?? '').trim()
  return text || null
}

const normalizeOptionalId = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${fieldName}无效`)
  }
  return id
}

const normalizePayload = (payload: RoadCrossSectionPayload): RoadCrossSectionPayload => {
  const status = (payload.status || 'NEEDS_CONFIRMATION') as RoadCrossSectionStatus
  if (!ROAD_CROSS_SECTION_STATUS_SET.has(status)) {
    throw new Error('横断面状态无效')
  }

  const normalized: RoadCrossSectionPayload = {
    startPk: normalizeNumber(payload.startPk, '起点桩号'),
    endPk: normalizeNumber(payload.endPk, '终点桩号'),
    profileCode: String(payload.profileCode ?? '').trim(),
    carriagewayWidthM: normalizeNumber(payload.carriagewayWidthM, '车行道宽度'),
    leftShoulderWidthM: normalizeOptionalNumber(payload.leftShoulderWidthM, '左侧路肩宽度'),
    rightShoulderWidthM: normalizeOptionalNumber(payload.rightShoulderWidthM, '右侧路肩宽度'),
    totalWidthM: normalizeNumber(payload.totalWidthM, '总宽度'),
    status,
    sourceDocumentId: normalizeOptionalId(payload.sourceDocumentId, '来源文件 ID'),
    sourcePage: normalizeOptionalText(payload.sourcePage),
    sourceVersion: normalizeOptionalText(payload.sourceVersion),
    referenceRoadId: normalizeOptionalId(payload.referenceRoadId, '参照道路 ID'),
    note: normalizeOptionalText(payload.note),
  }

  if (!normalized.profileCode) {
    throw new Error('横断面编号不能为空')
  }
  if (normalized.endPk < normalized.startPk) {
    throw new Error('终点桩号不能小于起点桩号')
  }
  if (normalized.carriagewayWidthM < 0 || normalized.totalWidthM < 0) {
    throw new Error('宽度不能为负数')
  }
  if (normalized.status === 'ASSUMED_FROM_REFERENCE' && !normalized.referenceRoadId) {
    throw new Error('参照其他道路时必须选择参照道路')
  }
  if (normalized.profileCode.length > 120) {
    throw new Error('横断面编号请控制在 120 字以内')
  }
  if ((normalized.sourcePage?.length ?? 0) > 120 || (normalized.sourceVersion?.length ?? 0) > 120) {
    throw new Error('来源页码或版本字段过长')
  }
  if ((normalized.note?.length ?? 0) > 1000) {
    throw new Error('备注请控制在 1000 字以内')
  }

  return normalized
}

const mapRoadToDTO = (row: NonNullable<RoadCrossSectionRow['referenceRoad']>): RoadSectionDTO => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  labels: resolveRoadLabels({ slug: row.slug, name: row.name }),
  startPk: row.startPk,
  endPk: row.endPk,
  projectId: row.projectId ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const mapToDTO = (row: RoadCrossSectionRow): RoadCrossSectionDTO => ({
  id: row.id,
  roadId: row.roadId,
  startPk: row.startPk,
  endPk: row.endPk,
  profileCode: row.profileCode,
  carriagewayWidthM: Number(row.carriagewayWidthM),
  leftShoulderWidthM: row.leftShoulderWidthM === null ? null : Number(row.leftShoulderWidthM),
  rightShoulderWidthM: row.rightShoulderWidthM === null ? null : Number(row.rightShoulderWidthM),
  totalWidthM: Number(row.totalWidthM),
  status: row.status as RoadCrossSectionStatus,
  sourceDocumentId: row.sourceDocumentId,
  sourcePage: row.sourcePage,
  sourceVersion: row.sourceVersion,
  referenceRoadId: row.referenceRoadId,
  note: row.note,
  sourceDocument: row.sourceDocument,
  referenceRoad: row.referenceRoad ? mapRoadToDTO(row.referenceRoad) : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const ensureRoadExists = async (roadId: number) => {
  if (!Number.isInteger(roadId) || roadId <= 0) {
    throw new Error('无效的路段 ID')
  }
  await prisma.roadSection.findUniqueOrThrow({
    where: { id: roadId },
    select: { id: true },
  })
}

const buildWriteData = (payload: RoadCrossSectionPayload) => ({
  startPk: payload.startPk,
  endPk: payload.endPk,
  profileCode: payload.profileCode,
  carriagewayWidthM: decimal(payload.carriagewayWidthM),
  leftShoulderWidthM:
    payload.leftShoulderWidthM === null || payload.leftShoulderWidthM === undefined
      ? null
      : decimal(payload.leftShoulderWidthM),
  rightShoulderWidthM:
    payload.rightShoulderWidthM === null || payload.rightShoulderWidthM === undefined
      ? null
      : decimal(payload.rightShoulderWidthM),
  totalWidthM: decimal(payload.totalWidthM),
  status: payload.status as PrismaRoadCrossSectionStatus,
  sourceDocumentId: payload.sourceDocumentId,
  sourcePage: payload.sourcePage,
  sourceVersion: payload.sourceVersion,
  referenceRoadId: payload.referenceRoadId,
  note: payload.note,
})

export const listRoadCrossSections = async (roadId: number): Promise<RoadCrossSectionDTO[]> => {
  await ensureRoadExists(roadId)
  const rows = await prisma.roadCrossSection.findMany({
    where: { roadId },
    include: crossSectionInclude,
    orderBy: [{ startPk: 'asc' }, { endPk: 'asc' }, { id: 'asc' }],
  })
  return rows.map(mapToDTO)
}

export const createRoadCrossSection = async (roadId: number, payload: RoadCrossSectionPayload) => {
  await ensureRoadExists(roadId)
  const normalized = normalizePayload(payload)
  if (normalized.referenceRoadId === roadId) {
    throw new Error('参照道路不能选择当前道路')
  }
  const created = await prisma.roadCrossSection.create({
    data: {
      roadId,
      ...buildWriteData(normalized),
    },
    include: crossSectionInclude,
  })
  return mapToDTO(created)
}

export const updateRoadCrossSection = async (
  roadId: number,
  id: number,
  payload: RoadCrossSectionPayload,
) => {
  await ensureRoadExists(roadId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的横断面记录 ID')
  }
  await prisma.roadCrossSection.findFirstOrThrow({
    where: { id, roadId },
    select: { id: true },
  })
  const normalized = normalizePayload(payload)
  if (normalized.referenceRoadId === roadId) {
    throw new Error('参照道路不能选择当前道路')
  }
  const updated = await prisma.roadCrossSection.update({
    where: { id },
    data: buildWriteData(normalized),
    include: crossSectionInclude,
  })
  return mapToDTO(updated)
}

export const deleteRoadCrossSection = async (roadId: number, id: number) => {
  await ensureRoadExists(roadId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的横断面记录 ID')
  }
  await prisma.roadCrossSection.findFirstOrThrow({
    where: { id, roadId },
    select: { id: true },
  })
  await prisma.roadCrossSection.delete({
    where: { id },
  })
}

export const isRoadCrossSectionRecordNotFound = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}
