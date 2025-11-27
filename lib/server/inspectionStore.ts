import type { Prisma } from '@prisma/client'
import { InspectionStatus, IntervalSide } from '@prisma/client'

import type {
  InspectionDTO,
  InspectionFilter,
  InspectionListItem,
  InspectionListResponse,
  InspectionPayload,
} from '@/lib/progressTypes'
import { prisma } from '@/lib/prisma'

const normalizeSide = (side: string | undefined) =>
  side === 'LEFT' || side === 'RIGHT' || side === 'BOTH' ? side : 'BOTH'

const normalizeRange = (start: number, end: number) => {
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  const ordered = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
  return { startPk: ordered[0], endPk: ordered[1] }
}

const mapInspection = (
  row: Prisma.InspectionRequestGetPayload<{ include: { creator: true } }>,
): InspectionDTO => ({
  id: row.id,
  roadId: row.roadId,
  phaseId: row.phaseId,
  side: row.side,
  startPk: row.startPk,
  endPk: row.endPk,
  layers: row.layers,
  checks: row.checks,
  types: row.types,
  remark: row.remark ?? undefined,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  createdBy: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
})

const mapInspectionListItem = (
  row: Prisma.InspectionRequestGetPayload<{
    include: { road: true; phase: true; creator: true }
  }>,
): InspectionListItem => ({
  id: row.id,
  roadId: row.roadId,
  roadName: row.road.name,
  roadSlug: row.road.slug,
  phaseId: row.phaseId,
  phaseName: row.phase.name,
  side: row.side,
  startPk: row.startPk,
  endPk: row.endPk,
  layers: row.layers,
  checks: row.checks,
  types: row.types,
  status: row.status,
  remark: row.remark ?? undefined,
  createdBy: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const listInspections = async (filter: InspectionFilter): Promise<InspectionListResponse> => {
  const page = Math.max(1, filter.page || 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize || 20))
  const skip = (page - 1) * pageSize
  const sortField = filter.sortField ?? 'updatedAt'
  const sortOrder = filter.sortOrder ?? 'desc'

  const where: Prisma.InspectionRequestWhereInput = {}
  if (filter.roadSlug) {
    where.road = { slug: filter.roadSlug }
  }
  if (filter.phaseId) {
    where.phaseId = filter.phaseId
  }
  if (filter.status && filter.status.length) {
    where.status = { in: filter.status as InspectionStatus[] }
  }
  if (filter.side) {
    where.side = filter.side as IntervalSide
  }
  if (filter.type) {
    where.types = { has: filter.type }
  }
  if (filter.keyword) {
    where.OR = [
      { remark: { contains: filter.keyword, mode: 'insensitive' } },
      { checks: { has: filter.keyword } },
      { types: { has: filter.keyword } },
      { phase: { name: { contains: filter.keyword, mode: 'insensitive' } } },
      { road: { name: { contains: filter.keyword, mode: 'insensitive' } } },
    ]
  }
  if (filter.startDate || filter.endDate) {
    where.createdAt = {
      gte: filter.startDate ? new Date(filter.startDate) : undefined,
      lte: filter.endDate ? new Date(filter.endDate) : undefined,
    }
  }

  const [total, rows] = await prisma.$transaction([
    prisma.inspectionRequest.count({ where }),
    prisma.inspectionRequest.findMany({
      where,
      include: { road: true, phase: true, creator: true },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: pageSize,
    }),
  ])

  return {
    items: rows.map(mapInspectionListItem),
    total,
    page,
    pageSize,
  }
}

export const createInspection = async (
  roadId: number,
  phaseId: number,
  payload: InspectionPayload,
  userId: number | null,
) => {
  if (!payload.layers || payload.layers.length === 0) {
    throw new Error('请选择至少一个层次')
  }
  if (!payload.checks || payload.checks.length === 0) {
    throw new Error('请选择至少一个验收内容')
  }
  if (!payload.types || payload.types.length === 0) {
    throw new Error('请选择至少一个验收类型')
  }

  const side = normalizeSide(payload.side)
  const range = normalizeRange(payload.startPk, payload.endPk)

  const inspection = await prisma.inspectionRequest.create({
    data: {
      roadId,
      phaseId,
      side: side as IntervalSide,
      startPk: range.startPk,
      endPk: range.endPk,
      layers: payload.layers,
      checks: payload.checks,
      types: payload.types,
      remark: payload.remark,
      status: InspectionStatus.IN_PROGRESS,
      createdBy: userId ?? undefined,
    },
    include: { creator: true },
  })

  return mapInspection(inspection)
}
