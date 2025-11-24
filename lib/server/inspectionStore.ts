import type { Prisma } from '@prisma/client'
import { InspectionStatus, IntervalSide } from '@prisma/client'

import type { InspectionDTO, InspectionPayload } from '@/lib/progressTypes'
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
