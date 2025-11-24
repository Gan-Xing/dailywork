import { IntervalSide, PhaseMeasure, Prisma } from '@prisma/client'

import type { CheckDefinitionDTO, LayerDefinitionDTO, PhaseDTO, PhaseDefinitionDTO, PhasePayload } from '@/lib/progressTypes'
import { prisma } from '@/lib/prisma'

const normalizeCommonList = (value?: string[] | null) =>
  Array.isArray(value) ? value.map((item) => `${item}`.trim()).filter(Boolean) : []

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

const mapDefinitionToDTO = (
  definition: Prisma.PhaseDefinitionGetPayload<{
    include: { defaultLayers: { include: { layerDefinition: true } }; defaultChecks: { include: { checkDefinition: true } } }
  }>,
): PhaseDefinitionDTO => ({
  id: definition.id,
  name: definition.name,
  measure: definition.measure,
  defaultLayers: definition.defaultLayers.map((l) => l.layerDefinition.name),
  defaultChecks: definition.defaultChecks.map((c) => c.checkDefinition.name),
  isActive: definition.isActive,
  createdAt: definition.createdAt.toISOString(),
  updatedAt: definition.updatedAt.toISOString(),
})

const mapLayerDefinitionToDTO = (layer: Prisma.LayerDefinition) => ({
  id: layer.id,
  name: layer.name,
  isActive: layer.isActive,
})

const mapCheckDefinitionToDTO = (check: Prisma.CheckDefinition) => ({
  id: check.id,
  name: check.name,
  isActive: check.isActive,
})

const mapPhaseToDTO = (
  phase: Prisma.RoadPhaseGetPayload<{
    include: {
      intervals: true
      layerLinks: { include: { layerDefinition: true } }
      checkLinks: { include: { checkDefinition: true } }
      phaseDefinition: {
        include: {
          defaultLayers: { include: { layerDefinition: true } }
          defaultChecks: { include: { checkDefinition: true } }
        }
      }
    }
  }>,
): PhaseDTO => {
  const instanceLayers = phase.layerLinks.map((l) => l.layerDefinition)
  const instanceChecks = phase.checkLinks.map((c) => c.checkDefinition)
  const defaultLayers = phase.phaseDefinition.defaultLayers.map((l) => l.layerDefinition)
  const defaultChecks = phase.phaseDefinition.defaultChecks.map((c) => c.checkDefinition)

  const resolvedLayers = instanceLayers.length ? instanceLayers : defaultLayers
  const resolvedChecks = instanceChecks.length ? instanceChecks : defaultChecks

  return {
    id: phase.id,
    name: phase.name,
    measure: phase.measure,
    designLength: phase.designLength,
    resolvedLayers: resolvedLayers.map((l) => l.name),
    resolvedChecks: resolvedChecks.map((c) => c.name),
    definitionName: phase.phaseDefinition.name,
    definitionId: phase.phaseDefinitionId,
    definitionLayerIds: defaultLayers.map((l) => l.id),
    definitionCheckIds: defaultChecks.map((c) => c.id),
    layerIds: instanceLayers.map((l) => l.id),
    checkIds: instanceChecks.map((c) => c.id),
    intervals: phase.intervals.map((i) => ({
      startPk: i.startPk,
      endPk: i.endPk,
      side: i.side,
    })),
    createdAt: phase.createdAt.toISOString(),
    updatedAt: phase.updatedAt.toISOString(),
  }
}

const ensureLayerDefinitions = async (names: string[], tx: Prisma.TransactionClient) => {
  const unique = [...new Set(normalizeCommonList(names))]
  if (!unique.length) return [] as Prisma.LayerDefinition[]
  await Promise.all(
    unique.map((name) =>
      tx.layerDefinition.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
      }),
    ),
  )
  return tx.layerDefinition.findMany({ where: { name: { in: unique } } })
}

const ensureCheckDefinitions = async (names: string[], tx: Prisma.TransactionClient) => {
  const unique = [...new Set(normalizeCommonList(names))]
  if (!unique.length) return [] as Prisma.CheckDefinition[]
  await Promise.all(
    unique.map((name) =>
      tx.checkDefinition.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
      }),
    ),
  )
  return tx.checkDefinition.findMany({ where: { name: { in: unique } } })
}

const ensurePhaseDefinition = async (
  tx: Prisma.TransactionClient,
  payload: { phaseDefinitionId?: number; name: string; measure: PhaseMeasure; defaultLayers?: string[]; defaultChecks?: string[] },
) => {
  if (payload.phaseDefinitionId) {
    const definition = await tx.phaseDefinition.findUnique({ where: { id: payload.phaseDefinitionId } })
    if (!definition) {
      throw new Error('分项模板不存在')
    }
    return definition
  }

  const definition = await tx.phaseDefinition.findUnique({ where: { name: payload.name } })
  if (definition) {
    return definition
  }

  const layerDefs = await ensureLayerDefinitions(payload.defaultLayers ?? [], tx)
  const checkDefs = await ensureCheckDefinitions(payload.defaultChecks ?? [], tx)

  const created = await tx.phaseDefinition.create({
    data: {
      name: payload.name,
      measure: payload.measure,
      defaultLayers: {
        create: layerDefs.map((layer) => ({ layerDefinitionId: layer.id })),
      },
      defaultChecks: {
        create: checkDefs.map((check) => ({ checkDefinitionId: check.id })),
      },
    },
  })
  return created
}

export const listPhases = async (roadId: number) => {
  const phases = await prisma.roadPhase.findMany({
    where: { roadId },
    include: {
      intervals: true,
      layerLinks: { include: { layerDefinition: true } },
      checkLinks: { include: { checkDefinition: true } },
      phaseDefinition: {
        include: {
          defaultLayers: { include: { layerDefinition: true } },
          defaultChecks: { include: { checkDefinition: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  return phases.map(mapPhaseToDTO)
}

export const listPhaseDefinitions = async () => {
  const definitions = await prisma.phaseDefinition.findMany({
    where: { isActive: true },
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
    orderBy: { name: 'asc' },
  })
  return definitions.map(mapDefinitionToDTO)
}

export const listLayerDefinitions = async (): Promise<LayerDefinitionDTO[]> => {
  const layers = await prisma.layerDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  return layers.map(mapLayerDefinitionToDTO)
}

export const listCheckDefinitions = async (): Promise<CheckDefinitionDTO[]> => {
  const checks = await prisma.checkDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  return checks.map(mapCheckDefinitionToDTO)
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

  const phase = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.roadPhase.findFirst({
      where: { roadId, name: payload.name },
    })
    if (duplicate) {
      throw new Error('分项名称已存在，请更换')
    }

    const definition = await ensurePhaseDefinition(tx, {
      phaseDefinitionId: payload.phaseDefinitionId,
      name: payload.name,
      measure: payload.measure === 'POINT' ? PhaseMeasure.POINT : PhaseMeasure.LINEAR,
      defaultLayers: payload.newLayers,
      defaultChecks: payload.newChecks,
    })

    const layerIds = payload.layerIds ?? []
    const checkIds = payload.checkIds ?? []
    const newLayerDefs = await ensureLayerDefinitions(payload.newLayers ?? [], tx)
    const newCheckDefs = await ensureCheckDefinitions(payload.newChecks ?? [], tx)
    const resolvedLayerIds = [...new Set([...layerIds, ...newLayerDefs.map((l) => l.id)])]
    const resolvedCheckIds = [...new Set([...checkIds, ...newCheckDefs.map((c) => c.id)])]

    const created = await tx.roadPhase.create({
      data: {
        roadId,
        phaseDefinitionId: definition.id,
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
        layerLinks: resolvedLayerIds.length
          ? {
              create: resolvedLayerIds.map((id) => ({ layerDefinitionId: id })),
            }
          : undefined,
        checkLinks: resolvedCheckIds.length
          ? {
              create: resolvedCheckIds.map((id) => ({ checkDefinitionId: id })),
            }
          : undefined,
      },
      include: {
        intervals: true,
        layerLinks: { include: { layerDefinition: true } },
        checkLinks: { include: { checkDefinition: true } },
        phaseDefinition: {
          include: {
            defaultLayers: { include: { layerDefinition: true } },
            defaultChecks: { include: { checkDefinition: true } },
          },
        },
      },
    })

    return created
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

  const phase = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.roadPhase.findFirst({
      where: { roadId, name: payload.name, NOT: { id: phaseId } },
    })
    if (duplicate) {
      throw new Error('分项名称已存在，请更换')
    }

    const existing = await tx.roadPhase.findUnique({ where: { id: phaseId, roadId } })
    if (!existing) {
      throw new Error('分项不存在或不属于当前路段')
    }

    const definition = await ensurePhaseDefinition(tx, {
      phaseDefinitionId: payload.phaseDefinitionId ?? existing.phaseDefinitionId,
      name: payload.name,
      measure: payload.measure === 'POINT' ? PhaseMeasure.POINT : PhaseMeasure.LINEAR,
      defaultLayers: payload.newLayers,
      defaultChecks: payload.newChecks,
    })

    const layerIds = payload.layerIds ?? []
    const checkIds = payload.checkIds ?? []
    const newLayerDefs = await ensureLayerDefinitions(payload.newLayers ?? [], tx)
    const newCheckDefs = await ensureCheckDefinitions(payload.newChecks ?? [], tx)
    const resolvedLayerIds = [...new Set([...layerIds, ...newLayerDefs.map((l) => l.id)])]
    const resolvedCheckIds = [...new Set([...checkIds, ...newCheckDefs.map((c) => c.id)])]

    const updated = await tx.roadPhase.update({
      where: { id: phaseId, roadId },
      data: {
        phaseDefinitionId: definition.id,
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

    await tx.roadPhaseLayer.deleteMany({ where: { roadPhaseId: phaseId } })
    if (resolvedLayerIds.length) {
      await tx.roadPhaseLayer.createMany({
        data: resolvedLayerIds.map((id) => ({ roadPhaseId: phaseId, layerDefinitionId: id })),
      })
    }

    await tx.roadPhaseCheck.deleteMany({ where: { roadPhaseId: phaseId } })
    if (resolvedCheckIds.length) {
      await tx.roadPhaseCheck.createMany({
        data: resolvedCheckIds.map((id) => ({ roadPhaseId: phaseId, checkDefinitionId: id })),
      })
    }

    return tx.roadPhase.findUniqueOrThrow({
      where: { id: phaseId },
      include: {
        intervals: true,
        layerLinks: { include: { layerDefinition: true } },
        checkLinks: { include: { checkDefinition: true } },
        phaseDefinition: {
          include: {
            defaultLayers: { include: { layerDefinition: true } },
            defaultChecks: { include: { checkDefinition: true } },
          },
        },
      },
    })
  })

  return mapPhaseToDTO(phase)
}

export const deletePhase = async (roadId: number, phaseId: number) => {
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    throw new Error('无效的分项 ID')
  }

  const removed = await prisma.$transaction(async (tx) => {
    const phase = await tx.roadPhase.findFirst({ where: { id: phaseId, roadId } })
    if (!phase) {
      throw new Error('分项不存在或不属于当前路段')
    }

    await tx.roadPhase.delete({ where: { id: phaseId } })
    return phase
  })

  return removed.id
}
