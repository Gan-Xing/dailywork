import { IntervalSide, PhaseMeasure, Prisma } from '@prisma/client'

import type { PhaseDTO, PhasePayload } from '@/lib/progressTypes'
import { prisma } from '@/lib/prisma'

const normalizeInterval = (interval: PhasePayload['intervals'][number], measure: PhasePayload['measure']) => {
  const start = Number(interval.startPk)
  const end = Number(interval.endPk)
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = measure === 'POINT' ? safeStart : Number.isFinite(end) ? end : safeStart
  const ordered = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]

  const side = interval.side ?? 'BOTH'
  const normalizedSide =
    side === 'LEFT' || side === 'RIGHT' || side === 'BOTH' ? side : 'BOTH'

  return {
    startPk: ordered[0],
    endPk: ordered[1],
    side: normalizedSide as IntervalSide,
  }
}

const calcDesignLength = (
  measure: PhasePayload['measure'],
  intervals: { startPk: number; endPk: number; side: IntervalSide }[],
) => {
  if (measure === 'POINT') {
    return intervals.length
  }
  return intervals.reduce((sum, item) => {
    const raw = item.endPk - item.startPk
    const base = raw === 0 ? 1 : Math.max(raw, 0)
    const factor = item.side === 'BOTH' ? 2 : 1
    return sum + base * factor
  }, 0)
}

const mapPhaseToDTO = (phase: Prisma.RoadPhaseGetPayload<{ include: { intervals: true } }>): PhaseDTO => ({
  id: phase.id,
  name: phase.name,
  measure: phase.measure,
  designLength: phase.designLength,
  intervals: phase.intervals.map((i) => ({
    startPk: i.startPk,
    endPk: i.endPk,
    side: i.side,
  })),
  createdAt: phase.createdAt.toISOString(),
  updatedAt: phase.updatedAt.toISOString(),
})

export const listPhases = async (roadId: number) => {
  const phases = await prisma.roadPhase.findMany({
    where: { roadId },
    include: { intervals: true },
    orderBy: { createdAt: 'asc' },
  })
  return phases.map(mapPhaseToDTO)
}

export const createPhase = async (roadId: number, payload: PhasePayload) => {
  if (!payload.name) {
    throw new Error('分项名称不能为空')
  }
  if (payload.measure !== 'LINEAR' && payload.measure !== 'POINT') {
    throw new Error('仅支持延米或单体显示方式')
  }
  if (!payload.intervals || payload.intervals.length === 0) {
    throw new Error('请至少填写一个起点-终点区间')
  }

  const normalizedIntervals = payload.intervals.map((i) => normalizeInterval(i, payload.measure))
  const designLength = calcDesignLength(payload.measure, normalizedIntervals)

  const duplicate = await prisma.roadPhase.findFirst({
    where: { roadId, name: payload.name },
  })
  if (duplicate) {
    throw new Error('分项名称已存在，请更换')
  }

  const phase = await prisma.roadPhase.create({
    data: {
      roadId,
      name: payload.name,
      measure: payload.measure === 'POINT' ? PhaseMeasure.POINT : PhaseMeasure.LINEAR,
      designLength,
      intervals: {
        create: normalizedIntervals.map((item) => ({
          startPk: item.startPk,
          endPk: item.endPk,
          side: item.side,
        })),
      },
    },
    include: { intervals: true },
  })

  return mapPhaseToDTO(phase)
}

export const updatePhase = async (roadId: number, phaseId: number, payload: PhasePayload) => {
  if (!payload.name) {
    throw new Error('分项名称不能为空')
  }
  if (payload.measure !== 'LINEAR' && payload.measure !== 'POINT') {
    throw new Error('仅支持延米或单体显示方式')
  }
  if (!payload.intervals || payload.intervals.length === 0) {
    throw new Error('请至少填写一个起点-终点区间')
  }
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    throw new Error('无效的分项 ID')
  }

  const normalizedIntervals = payload.intervals.map((i) => normalizeInterval(i, payload.measure))
  const designLength = calcDesignLength(payload.measure, normalizedIntervals)

  const duplicate = await prisma.roadPhase.findFirst({
    where: { roadId, name: payload.name, NOT: { id: phaseId } },
  })
  if (duplicate) {
    throw new Error('分项名称已存在，请更换')
  }

  const phase = await prisma.$transaction(async (tx) => {
    const updated = await tx.roadPhase.update({
      where: { id: phaseId, roadId },
      data: {
        name: payload.name,
        measure: payload.measure === 'POINT' ? PhaseMeasure.POINT : PhaseMeasure.LINEAR,
        designLength,
      },
    })

    await tx.phaseInterval.deleteMany({ where: { phaseId } })
    await tx.phaseInterval.createMany({
      data: normalizedIntervals.map((item) => ({
        phaseId: updated.id,
        startPk: item.startPk,
        endPk: item.endPk,
        side: item.side,
      })),
    })

    return tx.roadPhase.findUniqueOrThrow({
      where: { id: phaseId },
      include: { intervals: true },
    })
  })

  return mapPhaseToDTO(phase)
}
