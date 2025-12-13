import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
  PhaseDTO,
  RoadPhaseProgressDTO,
  RoadSectionDTO,
  RoadSectionPayload,
  RoadSectionProgressDTO,
  RoadSectionWithPhasesDTO,
} from '@/lib/progressTypes'
import { resolveRoadLabels } from '@/lib/i18n/roadDictionary'
import { listPhases } from './progressStore'

const normalizeValue = (value: string) => value.trim()

const normalizePayload = (payload: RoadSectionPayload): RoadSectionPayload => ({
  slug: normalizeValue(payload.slug),
  name: normalizeValue(payload.name),
  startPk: normalizeValue(payload.startPk),
  endPk: normalizeValue(payload.endPk),
})

const validatePayload = (payload: RoadSectionPayload) => {
  if (!payload.slug) {
    throw new Error('路由标识不能为空')
  }
  if (!/^[a-z0-9-]+$/.test(payload.slug)) {
    throw new Error('路由标识仅允许小写字母、数字和连字符')
  }
  if (!payload.name) {
    throw new Error('路段名称不能为空')
  }
  if (!payload.startPk || !payload.endPk) {
    throw new Error('起点和终点不能为空')
  }
  if (payload.name.length > 120) {
    throw new Error('路段名称请控制在 120 字以内')
  }
  if (payload.startPk.length > 60 || payload.endPk.length > 60) {
    throw new Error('起点或终点字段过长')
  }
}

const mapToDTO = (row: {
  id: number
  slug: string
  name: string
  startPk: string
  endPk: string
  createdAt: Date
  updatedAt: Date
}): RoadSectionDTO => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  labels: resolveRoadLabels({ slug: row.slug, name: row.name }),
  startPk: row.startPk,
  endPk: row.endPk,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const listRoadSections = async () => {
  const rows = await prisma.roadSection.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapToDTO)
}

export const listRoadSectionsWithPhases = async (): Promise<RoadSectionWithPhasesDTO[]> => {
  const roads = await listRoadSections()
  const phasesByRoad = await Promise.all(
    roads.map(async (road) => {
      const phases = (await listPhases(road.id)) as PhaseDTO[]
      return { ...road, phases }
    }),
  )
  return phasesByRoad
}

const normalizeSegment = (startPk: number, endPk: number) => {
  const start = Number.isFinite(startPk) ? startPk : 0
  const end = Number.isFinite(endPk) ? endPk : start
  return start <= end ? [start, end] : [end, start]
}

const calcCompletedLinearLength = (
  inspections: { startPk: number; endPk: number; side: string }[],
) => {
  return inspections.reduce((sum, item) => {
    const [start, end] = normalizeSegment(item.startPk, item.endPk)
    const raw = end - start
    const base = raw === 0 ? 1 : Math.max(raw, 0)
    const factor = item.side === 'BOTH' ? 2 : 1
    return sum + base * factor
  }, 0)
}

const buildPointStructureKey = (startPk: number, endPk: number, side: string) => {
  const [start, end] = normalizeSegment(startPk, endPk)
  const startKey = Math.round(start * 1000)
  const endKey = Math.round(end * 1000)
  return `${startKey}-${endKey}-${side ?? 'BOTH'}`
}

const resolvePhaseLayers = (phase: {
  layerLinks: { layerDefinition: { name: string } }[]
  phaseDefinition?: {
    defaultLayers: { layerDefinition: { name: string } }[]
  } | null
}) => {
  const instanceLayers = phase.layerLinks
    .map((link) => link.layerDefinition?.name)
    .filter(Boolean)
  if (instanceLayers.length) {
    return Array.from(new Set(instanceLayers))
  }
  const defaultLayers = phase.phaseDefinition?.defaultLayers
    ?.map((item) => item.layerDefinition?.name)
    .filter(Boolean) ?? []
  return Array.from(new Set(defaultLayers))
}

const calcCompletedPointStructures = (
  inspections: { startPk: number; endPk: number; side: string; layers: string[] }[],
  resolvedLayers: string[],
) => {
  if (!inspections.length) return 0
  const resolvedSet = new Set(resolvedLayers.filter(Boolean))
  const structureLayers = new Map<string, Set<string>>()
  const fallbackLayers = new Set<string>()

  inspections.forEach((inspection) => {
    const key = buildPointStructureKey(inspection.startPk, inspection.endPk, inspection.side)
    if (!key) return
    const layers = Array.isArray(inspection.layers) ? inspection.layers : []
    const layerSet = structureLayers.get(key) ?? new Set<string>()
    layers.forEach((layer) => {
      const normalized = `${layer}`.trim()
      if (!normalized) return
      if (resolvedSet.size && !resolvedSet.has(normalized)) return
      layerSet.add(normalized)
      if (resolvedSet.size === 0) {
        fallbackLayers.add(normalized)
      }
    })
    structureLayers.set(key, layerSet)
  })

  const layerCount = resolvedSet.size || fallbackLayers.size
  if (layerCount <= 0) {
    return structureLayers.size
  }

  let total = 0
  structureLayers.forEach((layers) => {
    if (!layers.size) return
    total += Math.min(1, layers.size / layerCount)
  })
  return total
}

export const listRoadSectionsWithProgress = async (): Promise<RoadSectionProgressDTO[]> => {
  const roads = await prisma.roadSection.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      startPk: true,
      endPk: true,
      createdAt: true,
      updatedAt: true,
          phases: {
            select: {
              id: true,
              name: true,
              measure: true,
              phaseDefinitionId: true,
              designLength: true,
          updatedAt: true,
          inspections: {
            where: { status: 'APPROVED' },
            orderBy: { updatedAt: 'desc' },
            select: { startPk: true, endPk: true, side: true, layers: true, updatedAt: true },
          },
          intervals: {
            select: {
              startPk: true,
              endPk: true,
              side: true,
              spec: true,
            },
          },
          layerLinks: {
            select: {
              layerDefinition: {
                select: {
                  name: true,
                },
              },
            },
          },
          phaseDefinition: {
            select: {
              defaultLayers: {
                select: {
                  layerDefinition: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  return roads.map((road) => {
      const phases: RoadPhaseProgressDTO[] = road.phases.map((phase) => {
        const designLength = Math.max(0, phase.designLength || 0)
        const resolvedLayers = phase.measure === 'POINT' ? resolvePhaseLayers(phase) : []
      const rawCompletedLength =
        phase.measure === 'POINT'
          ? calcCompletedPointStructures(phase.inspections, resolvedLayers)
          : calcCompletedLinearLength(phase.inspections)
      const cappedCompletedLength =
        designLength > 0 ? Math.min(designLength, rawCompletedLength) : rawCompletedLength
      const completedPercent =
        designLength > 0 ? Math.min(100, Math.round((cappedCompletedLength / designLength) * 100)) : 0
      const latestUpdate = phase.inspections[0]?.updatedAt ?? phase.updatedAt
      const intervalSpecs = phase.intervals?.map((interval) => ({
        startPk: interval.startPk,
        endPk: interval.endPk,
        side: interval.side,
        spec: interval.spec ?? null,
        layers: (interval as { layers?: string[] }).layers ?? [],
        layerIds: (interval as { layerIds?: number[] }).layerIds ?? [],
      })) ?? []
      const inspectionRanges = phase.inspections.map((inspection) => ({
        startPk: inspection.startPk,
        endPk: inspection.endPk,
        side: inspection.side,
      }))
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        phaseMeasure: phase.measure,
        phaseDefinitionId: phase.phaseDefinitionId,
        designLength,
        completedLength: cappedCompletedLength,
        completedPercent,
        updatedAt: latestUpdate.toISOString(),
        intervals: intervalSpecs,
        inspections: inspectionRanges,
      }
    })

    return {
      id: road.id,
      slug: road.slug,
      name: road.name,
      labels: resolveRoadLabels({ slug: road.slug, name: road.name }),
      startPk: road.startPk,
      endPk: road.endPk,
      createdAt: road.createdAt.toISOString(),
      updatedAt: road.updatedAt.toISOString(),
      phases,
    }
  })
}

export const createRoadSection = async (payload: RoadSectionPayload) => {
  const normalized = normalizePayload(payload)
  validatePayload(normalized)
  const created = await prisma.roadSection.create({
    data: normalized,
  })
  return mapToDTO(created)
}

export const updateRoadSection = async (id: number, payload: RoadSectionPayload) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的路段 ID')
  }
  const normalized = normalizePayload(payload)
  validatePayload(normalized)
  const updated = await prisma.roadSection.update({
    where: { id },
    data: normalized,
  })
  return mapToDTO(updated)
}

export const deleteRoadSection = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的路段 ID')
  }
  await prisma.roadSection.delete({
    where: { id },
  })
}

export const isRecordNotFound = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export const isUniqueConstraintError = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export const getRoadBySlug = async (slug: string) => {
  const row = await prisma.roadSection.findUnique({
    where: { slug },
  })
  return row ? mapToDTO(row) : null
}
