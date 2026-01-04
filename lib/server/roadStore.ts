import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
  IntervalSide,
  PhaseDTO,
  RoadPhaseProgressDTO,
  RoadSectionDTO,
  RoadSectionPayload,
  RoadSectionProgressDTO,
  RoadSectionWithPhasesDTO,
} from '@/lib/progressTypes'
import { resolveRoadLabels } from '@/lib/i18n/roadDictionary'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import type { WorkflowBinding } from '@/lib/progressWorkflow'
import { listPhases } from './progressStore'
import { getWorkflowByPhaseDefinitionId } from './workflowStore'

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

const EARTHWORK_PHASE_NAME = '土方'
const SUBBASE_PHASE_NAME = '垫层'
const SUBBASE_LAYER_NAME = '路基垫层'

const normalizePhaseName = (value: string) => value.trim()
const normalizeLabel = (value: string) => value.trim().toLowerCase()
const canonicalizeSingle = (kind: 'layer' | 'check', value: string) =>
  canonicalizeProgressList(kind, [value]).at(0) ?? value

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

const resolveIntervalLayers = (
  interval: { layers?: string[] | null; layerIds?: number[] | null },
  fallbackLayers: string[],
  layerNameById: Map<number, string>,
) => {
  const fromNames = Array.isArray(interval.layers) ? interval.layers : []
  const normalizedNames = canonicalizeProgressList('layer', fromNames)
  if (normalizedNames.length) return normalizedNames
  const fromIds = Array.isArray(interval.layerIds)
    ? interval.layerIds
        .map((id) => layerNameById.get(id))
        .filter(Boolean) as string[]
    : []
  const normalizedIds = canonicalizeProgressList('layer', fromIds)
  if (normalizedIds.length) return normalizedIds
  return canonicalizeProgressList('layer', fallbackLayers)
}

const buildIntervalLayerMap = (
  intervals: { startPk: number; endPk: number; side: string; layers?: string[] | null; layerIds?: number[] | null }[],
  fallbackLayers: string[],
  layerNameById: Map<number, string>,
) => {
  const map = new Map<
    string,
    { startPk: number; endPk: number; side: IntervalSide; layers: string[] }
  >()
  intervals.forEach((interval) => {
    const [start, end] = normalizeSegment(interval.startPk, interval.endPk)
    const side = (interval.side ?? 'BOTH') as IntervalSide
    const key = buildPointStructureKey(start, end, side)
    if (!key) return
    const layers = resolveIntervalLayers(interval, fallbackLayers, layerNameById)
    map.set(key, {
      startPk: start,
      endPk: end,
      side,
      layers: layers.map((layer) => normalizeLabel(canonicalizeSingle('layer', layer))).filter(Boolean),
    })
  })
  return map
}

const buildWorkflowStageByLayer = (workflow?: WorkflowBinding | null) => {
  const map = new Map<string, number>()
  if (!workflow?.layers?.length) return map
  workflow.layers.forEach((layer) => {
    const key = normalizeLabel(canonicalizeSingle('layer', layer.name))
    if (!key) return
    map.set(key, Number.isFinite(layer.stage) ? layer.stage : 0)
  })
  return map
}

const resolveTerminalLayers = (
  allowedLayers: string[],
  stageByLayer: Map<string, number>,
  fallbackLayers: string[],
) => {
  const candidateLayers = allowedLayers.length ? allowedLayers : fallbackLayers
  const normalized = candidateLayers
    .map((layer) => normalizeLabel(canonicalizeSingle('layer', layer)))
    .filter(Boolean)
  if (!normalized.length) return []
  let maxStage = -Infinity
  normalized.forEach((layer) => {
    const stage = stageByLayer.get(layer)
    if (stage === undefined) return
    if (stage > maxStage) maxStage = stage
  })
  if (maxStage === -Infinity) {
    const stages = Array.from(stageByLayer.values())
    if (!stages.length) return normalized
    maxStage = Math.max(...stages)
  }
  return normalized.filter((layer) => (stageByLayer.get(layer) ?? maxStage) === maxStage)
}

const buildTerminalLayerMap = (
  intervalLayers: Map<string, { startPk: number; endPk: number; side: IntervalSide; layers: string[] }>,
  stageByLayer: Map<string, number>,
  fallbackLayers: string[],
) => {
  const map = new Map<string, string[]>()
  intervalLayers.forEach((interval, key) => {
    const terminalLayers = resolveTerminalLayers(interval.layers, stageByLayer, fallbackLayers)
    if (!terminalLayers.length) return
    map.set(key, terminalLayers)
  })
  return map
}

const buildWorkflowChecksByLayer = (workflow?: WorkflowBinding | null) => {
  const map = new Map<string, Set<string>>()
  if (!workflow?.layers?.length) return map
  workflow.layers.forEach((layer) => {
    const layerKey = normalizeLabel(canonicalizeSingle('layer', layer.name))
    if (!layerKey) return
    const checks = canonicalizeProgressList(
      'check',
      layer.checks.map((check) => check.name),
    )
    const checkSet = new Set(checks.map((check) => normalizeLabel(check)).filter(Boolean))
    if (!checkSet.size) return
    map.set(layerKey, checkSet)
  })
  return map
}

const ensureIntervalSide = (value?: string | null): IntervalSide =>
  value === 'LEFT' || value === 'RIGHT' || value === 'BOTH' ? value : 'BOTH'

const buildInspectionRangesFromEntries = (
  entries: { startPk: number; endPk: number; side: string }[],
) => {
  const map = new Map<string, { startPk: number; endPk: number; side: IntervalSide }>()
  entries.forEach((entry) => {
    const key = buildPointStructureKey(entry.startPk, entry.endPk, entry.side)
    if (!key || map.has(key)) return
    const [start, end] = normalizeSegment(entry.startPk, entry.endPk)
    map.set(key, { startPk: start, endPk: end, side: ensureIntervalSide(entry.side) })
  })
  return Array.from(map.values())
}

const isEarthworkPhase = (phase: { name: string }) =>
  normalizePhaseName(phase.name) === EARTHWORK_PHASE_NAME

const isSubbasePhase = (phase: {
  name: string
  layerLinks: { layerDefinition: { name: string } }[]
  phaseDefinition?: { defaultLayers: { layerDefinition: { name: string } }[] } | null
}) => {
  if (normalizePhaseName(phase.name) !== SUBBASE_PHASE_NAME) return false
  const layers = resolvePhaseLayers(phase)
  return layers.includes(SUBBASE_LAYER_NAME)
}

const calcCompletedPointStructures = (
  entries: { startPk: number; endPk: number; side: string; layerName: string; checkName: string }[],
  intervalLayers: Map<string, { startPk: number; endPk: number; side: IntervalSide; layers: string[] }>,
  workflow?: WorkflowBinding | null,
) => {
  if (!intervalLayers.size || !workflow?.layers?.length) return 0

  const workflowChecksByLayer = buildWorkflowChecksByLayer(workflow)
  if (!workflowChecksByLayer.size) return 0

  const entriesByStructure = new Map<string, Array<{ layerKey: string; checkKey: string }>>()
  entries.forEach((entry) => {
    const key = buildPointStructureKey(entry.startPk, entry.endPk, entry.side)
    if (!key) return
    const layerKey = normalizeLabel(canonicalizeSingle('layer', entry.layerName))
    const checkKey = normalizeLabel(canonicalizeSingle('check', entry.checkName))
    if (!layerKey || !checkKey) return
    const list = entriesByStructure.get(key) ?? []
    list.push({ layerKey, checkKey })
    entriesByStructure.set(key, list)
  })

  let total = 0
  intervalLayers.forEach((interval) => {
    if (!interval.layers.length) return
    let totalChecks = 0
    const checksByLayer = new Map<string, Set<string>>()
    interval.layers.forEach((layerKey) => {
      const checks = workflowChecksByLayer.get(layerKey)
      if (!checks || checks.size === 0) return
      checksByLayer.set(layerKey, checks)
      totalChecks += checks.size
    })
    if (totalChecks <= 0) return

    const completed = new Set<string>()
    const candidateSides =
      interval.side === 'BOTH'
        ? (['BOTH', 'LEFT', 'RIGHT'] as string[])
        : ([interval.side, 'BOTH'] as string[])
    candidateSides.forEach((candidateSide) => {
      const key = buildPointStructureKey(interval.startPk, interval.endPk, candidateSide)
      if (!key) return
      const structureEntries = entriesByStructure.get(key) ?? []
      structureEntries.forEach((entry) => {
        const allowedChecks = checksByLayer.get(entry.layerKey)
        if (!allowedChecks) return
        if (!allowedChecks.has(entry.checkKey)) return
        completed.add(`${entry.layerKey}::${entry.checkKey}`)
      })
    })
    total += Math.min(1, completed.size / totalChecks)
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
            where: { status: { in: ['SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED'] } },
            orderBy: { updatedAt: 'desc' },
            select: { startPk: true, endPk: true, side: true, layers: true, updatedAt: true, status: true },
          },
          entries: {
            where: { status: 'APPROVED' },
            select: {
              startPk: true,
              endPk: true,
              side: true,
              layerName: true,
              checkName: true,
            },
          },
          intervals: {
            select: {
              startPk: true,
              endPk: true,
              side: true,
              spec: true,
              layers: true,
              layerIds: true,
            },
          },
          layerLinks: {
            select: {
              layerDefinition: {
                select: {
                  id: true,
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
                      id: true,
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

  const phaseDefinitionIds = Array.from(
    new Set(
      roads.flatMap((road) => road.phases.map((phase) => phase.phaseDefinitionId)),
    ),
  )
  const workflowEntries = await Promise.all(
    phaseDefinitionIds.map(async (id) => [id, await getWorkflowByPhaseDefinitionId(id)] as const),
  )
  const workflowByDefinitionId = new Map<number, WorkflowBinding>()
  workflowEntries.forEach(([id, workflow]) => {
    if (workflow) {
      workflowByDefinitionId.set(id, workflow)
    }
  })

  return roads.map((road) => {
    const subbasePhase = road.phases.find((phase) => isSubbasePhase(phase))
    const subbaseInspections = subbasePhase
      ? subbasePhase.inspections.filter((inspection) => inspection.status !== 'PENDING')
      : []
    const phases: RoadPhaseProgressDTO[] = road.phases.map((phase) => {
      const designLength = Math.max(0, phase.designLength || 0)
      const workflow = workflowByDefinitionId.get(phase.phaseDefinitionId) ?? null
      const resolvedLayers =
        phase.measure === 'POINT' || phase.measure === 'LINEAR' ? resolvePhaseLayers(phase) : []
      let fallbackLayerKeys = canonicalizeProgressList('layer', resolvedLayers)
        .map((layer) => normalizeLabel(layer))
        .filter(Boolean)
      if (!fallbackLayerKeys.length && workflow?.layers?.length) {
        fallbackLayerKeys = canonicalizeProgressList(
          'layer',
          workflow.layers.map((layer) => layer.name),
        )
          .map((layer) => normalizeLabel(layer))
          .filter(Boolean)
      }
      const layerNameById = new Map<number, string>()
      phase.layerLinks.forEach((link) => {
        if (link.layerDefinition?.id) {
          layerNameById.set(link.layerDefinition.id, link.layerDefinition.name)
        }
      })
      phase.phaseDefinition?.defaultLayers?.forEach((item) => {
        if (!item.layerDefinition?.id) return
        if (!layerNameById.has(item.layerDefinition.id)) {
          layerNameById.set(item.layerDefinition.id, item.layerDefinition.name)
        }
      })
      const intervalLayerMap =
        phase.measure === 'POINT' || phase.measure === 'LINEAR'
          ? buildIntervalLayerMap(phase.intervals ?? [], resolvedLayers, layerNameById)
          : new Map<string, { startPk: number; endPk: number; side: IntervalSide; layers: string[] }>()
      const stageByLayer = phase.measure === 'LINEAR' ? buildWorkflowStageByLayer(workflow) : new Map()
      const terminalLayerMap =
        phase.measure === 'LINEAR'
          ? buildTerminalLayerMap(intervalLayerMap, stageByLayer, fallbackLayerKeys)
          : new Map<string, string[]>()
      const approvedEntries = phase.entries ?? []
      const approvedInspections = phase.inspections.filter((inspection) => inspection.status === 'APPROVED')
      // Earthwork progress is driven by subbase (Couche de forme) scheduled ranges.
      const sourceInspections =
        isEarthworkPhase(phase) && subbasePhase ? subbaseInspections : approvedInspections
      const filteredLinearEntries =
        phase.measure === 'LINEAR' && !isEarthworkPhase(phase)
          ? approvedEntries.filter((entry) => {
              const key = buildPointStructureKey(entry.startPk, entry.endPk, entry.side)
              const candidateKey = key ?? ''
              const bothKey =
                entry.side !== 'BOTH'
                  ? buildPointStructureKey(entry.startPk, entry.endPk, 'BOTH')
                  : null
              const terminalLayers =
                terminalLayerMap.get(candidateKey) ??
                (bothKey ? terminalLayerMap.get(bothKey) : null) ??
                resolveTerminalLayers(fallbackLayerKeys, stageByLayer, fallbackLayerKeys)
              if (!terminalLayers.length) return true
              const layerKey = normalizeLabel(canonicalizeSingle('layer', entry.layerName))
              return terminalLayers.includes(layerKey)
            })
          : approvedEntries
      const rawCompletedLength =
        phase.measure === 'POINT'
          ? calcCompletedPointStructures(approvedEntries, intervalLayerMap, workflow)
          : phase.measure === 'LINEAR' && !isEarthworkPhase(phase)
            ? calcCompletedLinearLength(buildInspectionRangesFromEntries(filteredLinearEntries))
            : calcCompletedLinearLength(sourceInspections)
      const cappedCompletedLength =
        designLength > 0 ? Math.min(designLength, rawCompletedLength) : rawCompletedLength
      const completedPercent =
        designLength > 0 ? Math.min(100, Math.round((cappedCompletedLength / designLength) * 100)) : 0
      const latestUpdate = sourceInspections[0]?.updatedAt ?? phase.updatedAt
      const intervalSpecs = phase.intervals?.map((interval) => ({
        startPk: interval.startPk,
        endPk: interval.endPk,
        side: interval.side,
        spec: interval.spec ?? null,
        layers: (interval as { layers?: string[] }).layers ?? [],
        layerIds: (interval as { layerIds?: number[] }).layerIds ?? [],
      })) ?? []
      const inspectionRanges =
        phase.measure === 'POINT'
          ? buildInspectionRangesFromEntries(approvedEntries)
          : phase.measure === 'LINEAR' && !isEarthworkPhase(phase)
            ? buildInspectionRangesFromEntries(filteredLinearEntries)
            : sourceInspections.map((inspection) => ({
                startPk: inspection.startPk,
                endPk: inspection.endPk,
                side: ensureIntervalSide(inspection.side),
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
