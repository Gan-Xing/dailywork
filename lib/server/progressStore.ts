import { IntervalSide, PhaseMeasure, Prisma } from '@prisma/client'

import type { PhaseDTO, PhasePayload } from '@/lib/progressTypes'
import { prisma } from '@/lib/prisma'

const normalizeInterval = (interval: PhasePayload['intervals'][number]) => {
  const start = Number(interval.startPk)
  const end = Number(interval.endPk)
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
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

const calcDesignLength = (intervals: { startPk: number; endPk: number; side: IntervalSide }[]) => {
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
  if (payload.measure !== 'LINEAR') {
    throw new Error('仅支持延米显示方式')
  }
  if (!payload.intervals || payload.intervals.length === 0) {
    throw new Error('请至少填写一个起点-终点区间')
  }

  const normalizedIntervals = payload.intervals.map(normalizeInterval)
  const designLength = calcDesignLength(normalizedIntervals)

  const phase = await prisma.roadPhase.create({
    data: {
      roadId,
      name: payload.name,
      measure: PhaseMeasure.LINEAR,
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
