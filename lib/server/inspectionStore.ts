import { InspectionStatus, IntervalSide, Prisma } from '@prisma/client'

import type {
  InspectionBulkPayload,
  InspectionDTO,
  InspectionFilter,
  InspectionListItem,
  InspectionListResponse,
  InspectionPayload,
} from '@/lib/progressTypes'
import { getProgressCopy } from '@/lib/i18n/progress'
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
  row: Prisma.InspectionRequestGetPayload<{
    include: { creator: true; submitter: true; updater: true }
  }>,
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
  submissionOrder: row.submissionOrder ?? undefined,
  remark: row.remark ?? undefined,
  status: row.status,
  appointmentDate: row.appointmentDate?.toISOString(),
  submittedAt: row.submittedAt.toISOString(),
  submittedBy: row.submitter ? { id: row.submitter.id, username: row.submitter.username } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  createdBy: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
  updatedBy: row.updater ? { id: row.updater.id, username: row.updater.username } : null,
})

const mapInspectionListItem = (
  row: Prisma.InspectionRequestGetPayload<{
    include: { road: true; phase: true; creator: true; submitter: true; updater: true }
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
  submissionOrder: row.submissionOrder ?? undefined,
  status: row.status,
  remark: row.remark ?? undefined,
  appointmentDate: row.appointmentDate?.toISOString(),
  submittedAt: row.submittedAt.toISOString(),
  submittedBy: row.submitter ? { id: row.submitter.id, username: row.submitter.username } : null,
  createdBy: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updater ? { id: row.updater.id, username: row.updater.username } : null,
})

const inspectionErrors = getProgressCopy('zh').phase.errors

const assertRequiredFields = (payload: InspectionPayload) => {
  if (!payload.layers || payload.layers.length === 0) {
    throw new Error(inspectionErrors.submitLayerMissing)
  }
  if (!payload.checks || payload.checks.length === 0) {
    throw new Error(inspectionErrors.submitCheckMissing)
  }
  if (!payload.types || payload.types.length === 0) {
    throw new Error(inspectionErrors.submitTypeMissing)
  }
}

export const listInspections = async (filter: InspectionFilter): Promise<InspectionListResponse> => {
  const page = Math.max(1, filter.page || 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize || 20))
  const skip = (page - 1) * pageSize
  const sortField = filter.sortField ?? 'updatedAt'
  const sortOrder = filter.sortOrder ?? 'desc'
  const orderBy: Prisma.InspectionRequestOrderByWithRelationInput = (() => {
    switch (sortField) {
      case 'road':
        return { road: { name: sortOrder } }
      case 'phase':
        return { phase: { name: sortOrder } }
      case 'side':
        return { side: sortOrder }
      case 'appointmentDate':
        return { appointmentDate: sortOrder }
      case 'createdAt':
        return { createdAt: sortOrder }
      case 'updatedAt':
      default:
        return { updatedAt: sortOrder }
    }
  })()

  const where: Prisma.InspectionRequestWhereInput = {}
  if (filter.roadSlug) {
    where.road = { slug: filter.roadSlug }
  }
  if (filter.phaseId) {
    where.phaseId = filter.phaseId
  }
  if (filter.phaseDefinitionId) {
    where.phase = {
      is: {
        phaseDefinitionId: filter.phaseDefinitionId,
      },
    }
  }
  if (filter.status && filter.status.length) {
    where.status = { in: filter.status as InspectionStatus[] }
  }
  if (filter.side) {
    where.side = filter.side as IntervalSide
  }
  if (filter.types && filter.types.length) {
    where.types = { hasSome: filter.types }
  }
  if (filter.check) {
    where.checks = { has: filter.check }
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
      include: { road: true, phase: true, creator: true, submitter: true, updater: true },
      orderBy,
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
  assertRequiredFields(payload)

  const side = normalizeSide(payload.side)
  const range = normalizeRange(payload.startPk, payload.endPk)
  const appointmentDate = payload.appointmentDate ? new Date(payload.appointmentDate) : null

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
      submissionOrder: payload.submissionOrder ?? undefined,
      remark: payload.remark,
      status: (payload.status as InspectionStatus | undefined) ?? InspectionStatus.SCHEDULED,
      appointmentDate: appointmentDate ?? undefined,
      submittedAt: new Date(),
      submittedBy: userId ?? undefined,
      createdBy: userId ?? undefined,
      updatedBy: userId ?? undefined,
    },
    include: { creator: true, submitter: true, updater: true },
  })

  return mapInspection(inspection)
}

export const updateInspection = async (
  id: number,
  payload: InspectionPayload,
  userId: number | null,
): Promise<InspectionListItem> => {
  assertRequiredFields(payload)

  const existing = await prisma.inspectionRequest.findUnique({
    where: { id },
    include: { road: true },
  })
  if (!existing) {
    throw new Error('报检记录不存在或已删除')
  }

  const phase = await prisma.roadPhase.findFirst({
    where: { id: payload.phaseId, roadId: existing.roadId },
  })
  if (!phase) {
    throw new Error('分项不存在或不属于当前路段')
  }

  const side = normalizeSide(payload.side)
  const range = normalizeRange(payload.startPk, payload.endPk)
  const appointmentDate = payload.appointmentDate ? new Date(payload.appointmentDate) : null
  const submittedAt = payload.submittedAt ? new Date(payload.submittedAt) : null

  const inspection = await prisma.inspectionRequest.update({
    where: { id },
    data: {
      phaseId: phase.id,
      side: side as IntervalSide,
      startPk: range.startPk,
      endPk: range.endPk,
      layers: payload.layers,
      checks: payload.checks,
      types: payload.types,
      status: (payload.status as InspectionStatus | undefined) ?? existing.status,
      submissionOrder: payload.submissionOrder ?? undefined,
      remark: payload.remark,
      appointmentDate: appointmentDate ?? undefined,
      submittedAt: submittedAt ?? existing.submittedAt,
      updatedBy: userId ?? undefined,
    },
    include: { road: true, phase: true, creator: true, submitter: true, updater: true },
  })

  return mapInspectionListItem(inspection)
}

export const deleteInspection = async (id: number) => {
  const existing = await prisma.inspectionRequest.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('报检记录不存在或已删除')
  }
  await prisma.inspectionRequest.delete({ where: { id } })
}

export const updateInspectionStatuses = async (
  ids: Array<number | string>,
  status: InspectionStatus,
  userId: number | null,
): Promise<InspectionListItem[]> => {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  if (uniqueIds.length === 0) {
    throw new Error('请选择需要更新的报检记录')
  }

  try {
    const updates = await prisma.$transaction(
      uniqueIds.map((id) =>
        prisma.inspectionRequest.update({
          where: { id },
          data: { status, updatedBy: userId ?? undefined },
          include: { road: true, phase: true, creator: true, submitter: true, updater: true },
        }),
      ),
    )
    return updates.map(mapInspectionListItem)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('部分报检记录不存在或已删除')
    }
    throw error
  }
}

export const updateInspectionsBulk = async (
  ids: Array<number | string>,
  patch: InspectionBulkPayload,
  userId: number | null,
): Promise<InspectionListItem[]> => {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  if (uniqueIds.length === 0) {
    throw new Error('请选择需要更新的报检记录')
  }

  const hasAnyField = Object.values(patch).some((value) => value !== undefined && value !== '')
  if (!hasAnyField) {
    throw new Error('请至少填写一个需要批量修改的字段')
  }

  const rangeProvided = patch.startPk !== undefined || patch.endPk !== undefined
  if (rangeProvided && (patch.startPk === undefined || patch.endPk === undefined)) {
    throw new Error('批量修改里程时请同时填写起点和终点')
  }

  if (patch.submittedAt) {
    const submittedAt = new Date(patch.submittedAt)
    if (Number.isNaN(submittedAt.getTime())) {
      throw new Error('送检时间格式无效')
    }
  }
  if (patch.appointmentDate) {
    const appointmentDate = new Date(patch.appointmentDate)
    if (Number.isNaN(appointmentDate.getTime())) {
      throw new Error('预约日期格式无效')
    }
  }
  if (patch.layers && patch.layers.length === 0) {
    throw new Error(inspectionErrors.submitLayerMissing)
  }
  if (patch.checks && patch.checks.length === 0) {
    throw new Error(inspectionErrors.submitCheckMissing)
  }
  if (patch.types && patch.types.length === 0) {
    throw new Error(inspectionErrors.submitTypeMissing)
  }

  const rows = await prisma.inspectionRequest.findMany({
    where: { id: { in: uniqueIds } },
    include: { road: true, phase: true, creator: true, submitter: true, updater: true },
  })
  if (rows.length === 0) {
    throw new Error('报检记录不存在或已删除')
  }

  const updates = await prisma.$transaction(async (tx) => {
    const results: typeof rows = []
    for (const row of rows) {
      const nextPhaseId = patch.phaseId ?? row.phaseId
      if (patch.phaseId) {
        const phase = await tx.roadPhase.findFirst({
          where: { id: patch.phaseId, roadId: row.roadId },
        })
        if (!phase) {
          throw new Error(`所选分项不属于路段 ${row.road.name}`)
        }
      }

      const side = patch.side ? normalizeSide(patch.side) : row.side
      const range = rangeProvided
        ? normalizeRange(Number(patch.startPk), Number(patch.endPk))
        : { startPk: row.startPk, endPk: row.endPk }
      const appointmentDate =
        patch.appointmentDate === undefined ? row.appointmentDate : patch.appointmentDate ? new Date(patch.appointmentDate) : null
      const submittedAt =
        patch.submittedAt === undefined ? row.submittedAt : patch.submittedAt ? new Date(patch.submittedAt) : null
      const submissionOrder =
        patch.submissionOrder === undefined ? row.submissionOrder : patch.submissionOrder ?? null

      const updated = await tx.inspectionRequest.update({
        where: { id: row.id },
        data: {
          phaseId: nextPhaseId,
          side: side as IntervalSide,
          startPk: range.startPk,
          endPk: range.endPk,
          layers: patch.layers ?? row.layers,
          checks: patch.checks ?? row.checks,
          types: patch.types ?? row.types,
          status: patch.status ?? row.status,
          submissionOrder,
          remark: patch.remark ?? row.remark,
          appointmentDate: appointmentDate ?? undefined,
          submittedAt: submittedAt ?? row.submittedAt,
          updatedBy: userId ?? undefined,
        },
        include: { road: true, phase: true, creator: true, submitter: true, updater: true },
      })
      results.push(updated)
    }
    return results
  })

  return updates.map(mapInspectionListItem)
}

export const getInspectionListItem = async (id: number): Promise<InspectionListItem> => {
  const row = await prisma.inspectionRequest.findUnique({
    where: { id },
    include: { road: true, phase: true, creator: true, submitter: true, updater: true },
  })
  if (!row) {
    throw new Error('报检记录不存在或已删除')
  }
  return mapInspectionListItem(row)
}

export const getInspectionsByIds = async (ids: Array<number | string>): Promise<InspectionListItem[]> => {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  if (uniqueIds.length === 0) {
    return []
  }

  const rows = await prisma.inspectionRequest.findMany({
    where: { id: { in: uniqueIds } },
    include: { road: true, phase: true, creator: true, submitter: true, updater: true },
    orderBy: { submittedAt: 'desc' },
  })

  return rows.map(mapInspectionListItem)
}
