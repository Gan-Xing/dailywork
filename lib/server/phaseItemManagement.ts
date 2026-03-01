import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import type { IntervalSide, LevelCrossingSide } from '@/lib/progressTypes'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'
import { getWorkflowByPhaseDefinitionId } from '@/lib/server/workflowStore'
import {
  buildFormulaVariables,
  evaluateFormulaExpression,
  normalizeInputValues,
  parseFormulaExpression,
} from '@/lib/phaseItemFormula'
import type {
  PhaseItemBoqBindingDTO,
  PhaseItemDTO,
  PhaseItemInputDTO,
  PhaseIntervalDTO,
  PhaseIntervalFilter,
  PhaseIntervalManagementFacet,
  PhaseIntervalManagementListResponse,
  PhaseIntervalManagementRow,
  PhaseIntervalBindingStatus,
  PhaseIntervalQuantitySource,
  PhaseIntervalSortField,
  PhaseIntervalSortSpec,
  IntervalBoundPhaseItemDTO,
  RoadPhaseQuantityDetailDTO,
} from '@/lib/phaseItemTypes'

export class PhaseItemInputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhaseItemInputValidationError'
  }
}

export const isPhaseItemInputValidationError = (
  error: unknown,
): error is PhaseItemInputValidationError => error instanceof PhaseItemInputValidationError

const toOptionalNumber = (value: number | Prisma.Decimal | null | undefined) => {
  if (value == null) return null
  return Number(value)
}

const normalizeInputSchema = (value: unknown | null | undefined) => {
  if (value === undefined) return undefined
  if (value === null) return Prisma.DbNull
  return value as Prisma.InputJsonValue
}

const hasInputFields = (schema: unknown) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return false
  }
  const fields = (schema as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return false
  return fields.some((field) => {
    if (!field || typeof field !== 'object') return false
    const key = (field as { key?: unknown }).key
    return typeof key === 'string' && Boolean(key.trim())
  })
}

const formatBoqItem = (item: {
  id: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: Prisma.Decimal | null
}): PhaseItemBoqBindingDTO => ({
  boqItemId: item.id,
  code: item.code,
  designationZh: item.designationZh,
  designationFr: item.designationFr,
  unit: item.unit,
  unitPrice: toOptionalNumber(item.unitPrice),
})

const normalizeLabel = (value: string) => value.trim().toLowerCase()

const canonicalizeSingle = (kind: 'layer' | 'check', value: string) =>
  canonicalizeProgressList(kind, [value]).at(0) ?? value

const ensureIntervalSide = (value?: string | null): IntervalSide =>
  value === 'LEFT' || value === 'RIGHT' || value === 'BOTH' ? value : 'BOTH'

const normalizeRange = (startPk: number, endPk: number): [number, number] => {
  const start = Number.isFinite(startPk) ? startPk : 0
  const end = Number.isFinite(endPk) ? endPk : start
  return start <= end ? [start, end] : [end, start]
}

const calcLinearQuantity = (startPk: number, endPk: number, side: IntervalSide) => {
  const [start, end] = normalizeRange(startPk, endPk)
  const raw = end - start
  const base = raw === 0 ? 1 : Math.max(raw, 0)
  const factor = side === 'BOTH' ? 2 : 1
  return base * factor
}

const buildPointStructureKey = (
  startPk: number,
  endPk: number,
  side: IntervalSide,
  locationRoadId?: number | null,
  levelCrossingSide?: LevelCrossingSide | null,
  intervalId?: number | null,
) => {
  const [start, end] = normalizeRange(startPk, endPk)
  const startKey = Math.round(start * 1000)
  const endKey = Math.round(end * 1000)
  const intervalKey = levelCrossingSide ? (intervalId ?? 'default') : 'default'
  return `${intervalKey}-${startKey}-${endKey}-${side ?? 'BOTH'}-${locationRoadId ?? 'default'}-${levelCrossingSide ?? 'default'}`
}

const resolvePhaseLayers = (phase: {
  layerLinks: { layerDefinition?: { name: string } | null }[]
  phaseDefinition?: { defaultLayers?: { layerDefinition?: { name: string } | null }[] } | null
}) => {
  const instanceLayers = phase.layerLinks
    .map((link) => link.layerDefinition?.name)
    .filter((value): value is string => Boolean(value))
  if (instanceLayers.length) {
    return Array.from(new Set(instanceLayers))
  }
  const defaultLayers =
    phase.phaseDefinition?.defaultLayers
      ?.map((item) => item.layerDefinition?.name)
      .filter((value): value is string => Boolean(value)) ?? []
  return Array.from(new Set(defaultLayers))
}

const resolveIntervalLayers = (
  interval: { layers?: string[] | null; layerIds?: number[] | null },
  fallbackLayers: string[],
  layerNameById: Map<number, string>,
) => {
  const fromNames = Array.isArray(interval.layers) ? interval.layers : []
  const normalizedNames = canonicalizeProgressList('layer', fromNames)
    .map((item) => normalizeLabel(item))
    .filter(Boolean)
  if (normalizedNames.length) return normalizedNames
  const fromIds = Array.isArray(interval.layerIds)
    ? interval.layerIds
        .map((id) => layerNameById.get(id))
        .filter((value): value is string => Boolean(value))
    : []
  const normalizedIds = canonicalizeProgressList('layer', fromIds as string[])
    .map((item) => normalizeLabel(item))
    .filter(Boolean)
  if (normalizedIds.length) return normalizedIds
  return canonicalizeProgressList('layer', fallbackLayers)
    .map((item) => normalizeLabel(item))
    .filter(Boolean)
}

const buildWorkflowChecksByLayer = (
  workflow: Awaited<ReturnType<typeof getWorkflowByPhaseDefinitionId>>,
) => {
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

const calcLinearIntervalPercent = (
  interval: { startPk: number; endPk: number; side: IntervalSide },
  inspections: { startPk: number; endPk: number; side: IntervalSide }[],
) => {
  const total = calcLinearQuantity(interval.startPk, interval.endPk, interval.side)
  if (total <= 0) return 0
  const [start, end] = normalizeRange(interval.startPk, interval.endPk)
  const intervalSides = interval.side === 'BOTH' ? (['LEFT', 'RIGHT'] as IntervalSide[]) : [interval.side]
  let completed = 0

  inspections.forEach((inspection) => {
    const [inspStart, inspEnd] = normalizeRange(inspection.startPk, inspection.endPk)
    const inspectionSides =
      inspection.side === 'BOTH'
        ? (['LEFT', 'RIGHT'] as IntervalSide[])
        : [inspection.side]
    intervalSides.forEach((side) => {
      if (!inspectionSides.includes(side)) return
      const rawOverlap = Math.min(end, inspEnd) - Math.max(start, inspStart)
      if (rawOverlap <= 0) {
        if (Math.abs(rawOverlap) < 1e-6) {
          completed += 1
        }
        return
      }
      completed += rawOverlap
    })
  })

  if (completed <= 0) return 0
  const percent = (Math.min(completed, total) / total) * 100
  return Math.min(100, Math.round(percent))
}

const calcPointIntervalPercent = (params: {
  interval: {
    id?: number
    startPk: number
    endPk: number
    side: IntervalSide
    layers?: string[] | null
    layerIds?: number[] | null
    locationRoadId?: number | null
    levelCrossingSide?: LevelCrossingSide | null
  }
  fallbackLayers: string[]
  layerNameById: Map<number, string>
  workflowChecksByLayer: Map<string, Set<string>>
  entriesByStructure: Map<string, Array<{ layerKey: string; checkKey: string }>>
}) => {
  const { interval, fallbackLayers, layerNameById, workflowChecksByLayer, entriesByStructure } = params
  if (!workflowChecksByLayer.size) return 0
  const allowedLayerKeys = new Set(
    resolveIntervalLayers(interval, fallbackLayers, layerNameById),
  )
  if (!allowedLayerKeys.size) return 0
  let totalChecks = 0
  allowedLayerKeys.forEach((layerKey) => {
    const checks = workflowChecksByLayer.get(layerKey)
    if (checks) {
      totalChecks += checks.size
    }
  })
  if (!totalChecks) return 0
  const completed = new Set<string>()
  const candidateSides =
    interval.side === 'BOTH'
      ? (['BOTH', 'LEFT', 'RIGHT'] as IntervalSide[])
      : ([interval.side, 'BOTH'] as IntervalSide[])
  candidateSides.forEach((side) => {
    const key = buildPointStructureKey(
      interval.startPk,
      interval.endPk,
      side,
      interval.locationRoadId ?? null,
      interval.levelCrossingSide ?? null,
      interval.id ?? null,
    )
    const entries = entriesByStructure.get(key) ?? []
    entries.forEach((entry) => {
      if (!allowedLayerKeys.has(entry.layerKey)) return
      const checks = workflowChecksByLayer.get(entry.layerKey)
      if (!checks || !checks.has(entry.checkKey)) return
      completed.add(`${entry.layerKey}::${entry.checkKey}`)
    })
  })
  const percent = (completed.size / totalChecks) * 100
  return Math.min(100, Math.round(percent))
}

const sideSortWeight: Record<string, number> = {
  LEFT: 1,
  RIGHT: 2,
  BOTH: 3,
}

const displaySortLabels: Record<string, string> = {
  LINEAR: '延米',
  POINT: '单体',
}

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'zh-CN', { sensitivity: 'base' })

const resolveEffectiveProject = (params: {
  phaseRoadProjectId: number | null | undefined
  phaseRoadProjectName: string | null | undefined
  phaseRoadProjectCode: string | null | undefined
  locationRoadProjectId?: number | null
  locationRoadProjectName?: string | null
  locationRoadProjectCode?: string | null
}) => {
  if (params.locationRoadProjectId) {
    return {
      projectId: params.locationRoadProjectId,
      projectName: params.locationRoadProjectName ?? null,
      projectCode: params.locationRoadProjectCode ?? null,
    }
  }
  return {
    projectId: params.phaseRoadProjectId ?? null,
    projectName: params.phaseRoadProjectName ?? null,
    projectCode: params.phaseRoadProjectCode ?? null,
  }
}

const toSortStack = (sort?: PhaseIntervalSortSpec[]): PhaseIntervalSortSpec[] =>
  sort?.length ? sort : [{ field: 'updatedAt', order: 'desc' }]

const NO_PROJECT = '__none__'

const formatUpdatedDate = (value: string) => value.slice(0, 10)

const getCompletionBucket = (percent: number) => {
  if (percent >= 100) return '100%'
  if (percent >= 50) return '50-99%'
  if (percent > 0) return '1-49%'
  return '0%'
}

const getProjectKey = (row: PhaseIntervalManagementRow) =>
  row.projectId ? String(row.projectId) : NO_PROJECT

const getBindingStatus = (row: PhaseIntervalManagementRow): PhaseIntervalBindingStatus =>
  row.hasBoundItems ? 'BOUND' : 'UNBOUND'

const getQuantitySource = (row: PhaseIntervalManagementRow): PhaseIntervalQuantitySource =>
  row.quantityOverridden ? 'MANUAL' : 'AUTO'

const normalizeFilterNumbers = (values: number[] | undefined) =>
  values?.filter((value) => Number.isFinite(value)) ?? []

const normalizeFilterStrings = (values: string[] | undefined) =>
  values?.map((value) => value.trim()).filter(Boolean) ?? []

const applyPhaseIntervalFilters = (
  rows: PhaseIntervalManagementRow[],
  filter?: PhaseIntervalFilter,
) => {
  if (!filter) return rows

  const projectSet = new Set(normalizeFilterStrings(filter.projectKeys))
  const roadSet = new Set(normalizeFilterNumbers(filter.roadIds).map((value) => String(value)))
  const phaseSet = new Set(normalizeFilterStrings(filter.phases))
  const startPkSet = new Set(normalizeFilterNumbers(filter.startPks).map((value) => String(value)))
  const endPkSet = new Set(normalizeFilterNumbers(filter.endPks).map((value) => String(value)))
  const sideSet = new Set(normalizeFilterStrings(filter.sides))
  const displaySet = new Set(normalizeFilterStrings(filter.displays))
  const completionSet = new Set(normalizeFilterStrings(filter.completions))
  const updatedDateSet = new Set(normalizeFilterStrings(filter.updatedDates))
  const bindingSet = new Set(normalizeFilterStrings(filter.bindings))
  const quantitySourceSet = new Set(normalizeFilterStrings(filter.quantitySources))

  return rows.filter((row) => {
    if (projectSet.size && !projectSet.has(getProjectKey(row))) return false
    if (roadSet.size && !roadSet.has(String(row.locationRoadId ?? row.roadId))) return false
    if (phaseSet.size && !phaseSet.has(row.phaseName)) return false
    if (startPkSet.size && !startPkSet.has(String(row.startPk))) return false
    if (endPkSet.size && !endPkSet.has(String(row.endPk))) return false
    if (sideSet.size && !sideSet.has(row.side)) return false
    if (displaySet.size && !displaySet.has(row.measure)) return false
    if (completionSet.size && !completionSet.has(getCompletionBucket(row.completedPercent))) return false
    if (updatedDateSet.size && !updatedDateSet.has(formatUpdatedDate(row.updatedAt))) return false
    if (bindingSet.size && !bindingSet.has(getBindingStatus(row))) return false
    if (quantitySourceSet.size && !quantitySourceSet.has(getQuantitySource(row))) return false
    return true
  })
}

const buildPhaseIntervalFacets = (rows: PhaseIntervalManagementRow[]): PhaseIntervalManagementFacet => {
  const projects = new Map<
    string,
    { key: string; projectId: number | null; projectName: string | null; projectCode: string | null }
  >()
  const roads = new Map<number, { id: number; name: string; slug: string }>()
  const phases = new Set<string>()
  const startPks = new Set<number>()
  const endPks = new Set<number>()
  const sides = new Set<IntervalSide>()
  const displays = new Set<'LINEAR' | 'POINT'>()
  const completions = new Set<string>()
  const updatedDates = new Set<string>()
  const bindings = new Set<PhaseIntervalBindingStatus>()
  const quantitySources = new Set<PhaseIntervalQuantitySource>()

  rows.forEach((row) => {
    const projectKey = getProjectKey(row)
    if (!projects.has(projectKey)) {
      projects.set(projectKey, {
        key: projectKey,
        projectId: row.projectId,
        projectName: row.projectName,
        projectCode: row.projectCode,
      })
    }
    const roadId = row.locationRoadId ?? row.roadId
    if (!roads.has(roadId)) {
      roads.set(roadId, {
        id: roadId,
        name: row.locationRoadName ?? row.roadName,
        slug: row.locationRoadSlug ?? row.roadSlug,
      })
    }
    phases.add(row.phaseName)
    startPks.add(row.startPk)
    endPks.add(row.endPk)
    sides.add(row.side)
    displays.add(row.measure)
    completions.add(getCompletionBucket(row.completedPercent))
    updatedDates.add(formatUpdatedDate(row.updatedAt))
    bindings.add(getBindingStatus(row))
    quantitySources.add(getQuantitySource(row))
  })

  return {
    projects: Array.from(projects.values()).sort((left, right) =>
      compareText(
        left.projectName ? `${left.projectName}${left.projectCode ? `（${left.projectCode}）` : ''}` : '未绑定项目',
        right.projectName ? `${right.projectName}${right.projectCode ? `（${right.projectCode}）` : ''}` : '未绑定项目',
      ),
    ),
    roads: Array.from(roads.values()).sort((left, right) => compareText(left.name, right.name)),
    phases: Array.from(phases).sort(compareText),
    startPks: Array.from(startPks).sort((a, b) => a - b),
    endPks: Array.from(endPks).sort((a, b) => a - b),
    sides: Array.from(sides.values()).sort(
      (left, right) => (sideSortWeight[left] ?? 99) - (sideSortWeight[right] ?? 99),
    ),
    displays: Array.from(displays.values()).sort((left, right) =>
      compareText(displaySortLabels[left] ?? left, displaySortLabels[right] ?? right),
    ),
    completions: Array.from(completions.values()).sort(compareText),
    updatedDates: Array.from(updatedDates.values()).sort((a, b) => b.localeCompare(a)),
    bindings: Array.from(bindings.values()).sort(compareText),
    quantitySources: Array.from(quantitySources.values()).sort(compareText),
  }
}

const comparePhaseRows = (
  left: PhaseIntervalManagementRow,
  right: PhaseIntervalManagementRow,
  field: PhaseIntervalSortField,
) => {
  switch (field) {
    case 'project': {
      const leftLabel = left.projectName
        ? left.projectCode
          ? `${left.projectName}（${left.projectCode}）`
          : left.projectName
        : '未绑定项目'
      const rightLabel = right.projectName
        ? right.projectCode
          ? `${right.projectName}（${right.projectCode}）`
          : right.projectName
        : '未绑定项目'
      return compareText(leftLabel, rightLabel)
    }
    case 'road':
      return compareText(left.locationRoadName ?? left.roadName, right.locationRoadName ?? right.roadName)
    case 'phase':
      return compareText(left.phaseName, right.phaseName)
    case 'startPk':
      return left.startPk - right.startPk
    case 'endPk':
      return left.endPk - right.endPk
    case 'side':
      return (sideSortWeight[left.side] ?? 99) - (sideSortWeight[right.side] ?? 99)
    case 'quantity':
      return left.quantity - right.quantity
    case 'display':
      return compareText(
        displaySortLabels[left.measure] ?? left.measure,
        displaySortLabels[right.measure] ?? right.measure,
      )
    case 'completed':
      return left.completedPercent - right.completedPercent
    case 'updatedAt':
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    default:
      return 0
  }
}

export const listPhaseIntervalManagementRows = async (options?: {
  filter?: PhaseIntervalFilter
  sort?: PhaseIntervalSortSpec[]
}): Promise<PhaseIntervalManagementRow[]> => {
  const [progressRoads, phases] = await Promise.all([
    listRoadSectionsWithProgress(),
    prisma.roadPhase.findMany({
      include: {
        road: {
          select: {
            id: true,
            name: true,
            slug: true,
            projectId: true,
            project: { select: { name: true, code: true } },
          },
        },
        intervals: {
          orderBy: [{ startPk: 'asc' }, { endPk: 'asc' }, { side: 'asc' }],
          include: {
            locationRoad: {
              select: {
                id: true,
                name: true,
                slug: true,
                projectId: true,
                project: { select: { name: true, code: true } },
              },
            },
          },
        },
        layerLinks: { include: { layerDefinition: { select: { id: true, name: true } } } },
        phaseDefinition: {
          select: {
            id: true,
            defaultLayers: { include: { layerDefinition: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: [{ roadId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
  ])

  const intervalIds = phases.flatMap((phase) => phase.intervals.map((interval) => interval.id))
  const boundCounts = intervalIds.length
    ? await prisma.phaseItemInput.groupBy({
        by: ['intervalId'],
        where: { intervalId: { in: intervalIds } },
        _count: { intervalId: true },
      })
    : []
  const boundCountByInterval = new Map<number, number>()
  boundCounts.forEach((entry) => {
    boundCountByInterval.set(entry.intervalId, entry._count.intervalId ?? 0)
  })

  const phaseProgressMap = new Map<
    number,
    {
      inspections: {
        startPk: number
        endPk: number
        side: IntervalSide
        intervalId?: number | null
        locationRoadId?: number | null
        levelCrossingSide?: LevelCrossingSide | null
      }[]
    }
  >()
  progressRoads.forEach((road) => {
    road.phases.forEach((phase) => {
      phaseProgressMap.set(phase.phaseId, {
        inspections: (phase.inspections ?? []).map((inspection) => ({
          startPk: inspection.startPk,
          endPk: inspection.endPk,
          side: ensureIntervalSide(inspection.side),
          intervalId: (inspection as { intervalId?: number | null }).intervalId ?? null,
          locationRoadId: inspection.locationRoadId ?? road.id,
          levelCrossingSide: inspection.levelCrossingSide ?? null,
        })),
      })
    })
  })

  const pointPhaseIds = phases.filter((phase) => phase.measure === 'POINT').map((phase) => phase.id)
  const pointEntries = pointPhaseIds.length
    ? await prisma.inspectionEntry.findMany({
        where: {
          phaseId: { in: pointPhaseIds },
          status: 'APPROVED',
        },
        select: {
          phaseId: true,
          startPk: true,
          endPk: true,
          side: true,
          intervalId: true,
          layerName: true,
          checkName: true,
          locationRoadId: true,
          levelCrossingSide: true,
        },
      })
    : []

  const entriesByPhase = new Map<
    number,
    Array<{
      startPk: number
      endPk: number
      side: IntervalSide
      intervalId?: number | null
      layerName: string
      checkName: string
      locationRoadId?: number | null
      levelCrossingSide?: LevelCrossingSide | null
    }>
  >()
  pointEntries.forEach((entry) => {
    const list = entriesByPhase.get(entry.phaseId) ?? []
    list.push({
      startPk: entry.startPk,
      endPk: entry.endPk,
      side: ensureIntervalSide(entry.side),
      intervalId: entry.intervalId ?? null,
      layerName: entry.layerName,
      checkName: entry.checkName,
      locationRoadId: entry.locationRoadId ?? null,
      levelCrossingSide: entry.levelCrossingSide ?? null,
    })
    entriesByPhase.set(entry.phaseId, list)
  })

  const workflowIds = Array.from(new Set(phases.map((phase) => phase.phaseDefinitionId)))
  const workflowEntries = await Promise.all(
    workflowIds.map(async (id) => [id, await getWorkflowByPhaseDefinitionId(id)] as const),
  )
  const workflowByDefinitionId = new Map<number, Awaited<ReturnType<typeof getWorkflowByPhaseDefinitionId>>>(
    workflowEntries,
  )

  const rows: PhaseIntervalManagementRow[] = []

  phases.forEach((phase) => {
    const fallbackLayers = resolvePhaseLayers(phase)
    const layerNameById = new Map<number, string>()
    phase.layerLinks.forEach((link) => {
      if (link.layerDefinition?.id) {
        layerNameById.set(link.layerDefinition.id, link.layerDefinition.name)
      }
    })
    phase.phaseDefinition?.defaultLayers?.forEach((item) => {
      if (item.layerDefinition?.id && !layerNameById.has(item.layerDefinition.id)) {
        layerNameById.set(item.layerDefinition.id, item.layerDefinition.name)
      }
    })
    const workflow = workflowByDefinitionId.get(phase.phaseDefinitionId) ?? null
    const workflowChecksByLayer = buildWorkflowChecksByLayer(workflow)
    const entries = entriesByPhase.get(phase.id) ?? []
    const entriesByStructure = new Map<string, Array<{ layerKey: string; checkKey: string }>>()
    entries.forEach((entry) => {
      const key = buildPointStructureKey(
        entry.startPk,
        entry.endPk,
        entry.side,
        entry.locationRoadId ?? null,
        entry.levelCrossingSide ?? null,
        entry.intervalId ?? null,
      )
      const layerKey = normalizeLabel(canonicalizeSingle('layer', entry.layerName))
      const checkKey = normalizeLabel(canonicalizeSingle('check', entry.checkName))
      if (!key || !layerKey || !checkKey) return
      const list = entriesByStructure.get(key) ?? []
      list.push({ layerKey, checkKey })
      entriesByStructure.set(key, list)
    })
    const inspections = phaseProgressMap.get(phase.id)?.inspections ?? []

    phase.intervals.forEach((interval) => {
      const intervalLocationRoadId = interval.locationRoadId ?? phase.road.id
      const intervalLevelCrossingSide = interval.levelCrossingSide ?? null
      const intervalInspections = inspections.filter(
        (inspection) =>
          (inspection.locationRoadId ?? phase.road.id) === intervalLocationRoadId &&
          (inspection.levelCrossingSide ?? null) === intervalLevelCrossingSide,
      )
      const resolvedLocationRoad =
        interval.locationRoad ??
        (intervalLocationRoadId === phase.road.id ? phase.road : null)
      const effectiveProject = resolveEffectiveProject({
        phaseRoadProjectId: phase.road.projectId ?? null,
        phaseRoadProjectName: phase.road.project?.name ?? null,
        phaseRoadProjectCode: phase.road.project?.code ?? null,
        locationRoadProjectId: interval.locationRoad?.projectId ?? null,
        locationRoadProjectName: interval.locationRoad?.project?.name ?? null,
        locationRoadProjectCode: interval.locationRoad?.project?.code ?? null,
      })
      const rawQuantity =
        phase.measure === 'POINT'
          ? 1
          : calcLinearQuantity(interval.startPk, interval.endPk, interval.side)
      const hasBillQuantity =
        phase.measure !== 'POINT' &&
        typeof interval.billQuantity === 'number' &&
        Number.isFinite(interval.billQuantity)
      const quantity =
        phase.measure === 'POINT'
          ? 1
          : hasBillQuantity
            ? (interval.billQuantity as number)
            : rawQuantity
      const quantityOverridden =
        phase.measure !== 'POINT' &&
        hasBillQuantity &&
        Math.abs((interval.billQuantity as number) - rawQuantity) > 1e-6
      const completedPercent =
        phase.measure === 'POINT'
          ? calcPointIntervalPercent({
              interval: {
                ...interval,
                id: interval.id,
                locationRoadId: intervalLocationRoadId,
                levelCrossingSide: intervalLevelCrossingSide,
              },
              fallbackLayers,
              layerNameById,
              workflowChecksByLayer,
              entriesByStructure,
            })
          : calcLinearIntervalPercent(interval, intervalInspections)

      rows.push({
        intervalId: interval.id,
        phaseId: phase.id,
        phaseName: phase.name,
        spec: interval.spec ?? null,
        measure: phase.measure,
        roadId: phase.road.id,
        roadName: phase.road.name,
        roadSlug: phase.road.slug,
        locationRoadId: intervalLocationRoadId,
        locationRoadName: resolvedLocationRoad?.name ?? null,
        locationRoadSlug: resolvedLocationRoad?.slug ?? null,
        levelCrossingSide: intervalLevelCrossingSide,
        projectId: effectiveProject.projectId,
        projectName: effectiveProject.projectName,
        projectCode: effectiveProject.projectCode,
        startPk: interval.startPk,
        endPk: interval.endPk,
        side: interval.side,
        quantity,
        rawQuantity,
        quantityOverridden,
        completedPercent,
        hasBoundItems: (boundCountByInterval.get(interval.id) ?? 0) > 0,
        updatedAt: interval.updatedAt.toISOString(),
      })
    })
  })

  const filteredRows = applyPhaseIntervalFilters(rows, options?.filter)
  const sortStack = toSortStack(options?.sort)
  return filteredRows.sort((left, right) => {
    for (const spec of sortStack) {
      const direction = spec.order === 'asc' ? 1 : -1
      const result = comparePhaseRows(left, right, spec.field)
      if (result !== 0) {
        return result * direction
      }
    }
    return left.intervalId - right.intervalId
  })
}

export const listPhaseIntervalManagementPage = async (options?: {
  filter?: PhaseIntervalFilter
  sort?: PhaseIntervalSortSpec[]
  page?: number
  pageSize?: number
}): Promise<PhaseIntervalManagementListResponse> => {
  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, Math.min(200, options?.pageSize ?? 20))

  const allRows = await listPhaseIntervalManagementRows({ sort: options?.sort })
  const filteredRows = applyPhaseIntervalFilters(allRows, options?.filter)
  const facets = buildPhaseIntervalFacets(allRows)
  const total = filteredRows.length
  const unfilteredTotal = allRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  const items = filteredRows.slice(offset, offset + pageSize)

  return {
    items,
    total,
    unfilteredTotal,
    page: safePage,
    pageSize,
    facets,
  }
}

export const listIntervalBoundPhaseItems = async (
  intervalId: number,
): Promise<IntervalBoundPhaseItemDTO[]> => {
  if (!Number.isInteger(intervalId) || intervalId <= 0) {
    throw new Error('区间无效')
  }

  const inputs = await prisma.phaseItemInput.findMany({
    where: { intervalId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      intervalId: true,
      phaseItemId: true,
      manualQuantity: true,
      computedQuantity: true,
      updatedAt: true,
      interval: { select: { spec: true } },
      phaseItem: {
        select: {
          name: true,
          spec: true,
          boqLinks: {
            where: { isActive: true },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            select: {
              boqItem: {
                select: {
                  id: true,
                  code: true,
                  unit: true,
                  sheetType: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return inputs.map((input) => {
    const actualLink = input.phaseItem.boqLinks.find((link) => link.boqItem.sheetType === 'ACTUAL')
    const fallbackLink = input.phaseItem.boqLinks[0]
    const boqItem = (actualLink ?? fallbackLink)?.boqItem ?? null
    const manualQuantity = toOptionalNumber(input.manualQuantity)
    const computedQuantity = toOptionalNumber(input.computedQuantity)
    const effectiveQuantity = manualQuantity ?? computedQuantity
    return {
      inputId: input.id,
      intervalId: input.intervalId,
      intervalSpec: input.interval.spec ?? null,
      phaseItemId: input.phaseItemId,
      phaseItemName: input.phaseItem.name,
      phaseItemSpec: input.phaseItem.spec ?? null,
      manualQuantity,
      computedQuantity,
      effectiveQuantity,
      unit: boqItem?.unit ?? null,
      boqItemId: boqItem?.id ?? null,
      boqCode: boqItem?.code ?? null,
      updatedAt: input.updatedAt.toISOString(),
    }
  })
}

export const listIntervalsBoundPhaseItems = async (
  intervalIds: number[],
): Promise<Map<number, IntervalBoundPhaseItemDTO[]>> => {
  const ids = Array.from(
    new Set(
      intervalIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  )
  if (!ids.length) return new Map()

  const inputs = await prisma.phaseItemInput.findMany({
    where: { intervalId: { in: ids } },
    orderBy: [{ intervalId: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      intervalId: true,
      phaseItemId: true,
      manualQuantity: true,
      computedQuantity: true,
      updatedAt: true,
      interval: { select: { spec: true } },
      phaseItem: {
        select: {
          name: true,
          spec: true,
          boqLinks: {
            where: { isActive: true },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            select: {
              boqItem: {
                select: {
                  id: true,
                  code: true,
                  unit: true,
                  sheetType: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const map = new Map<number, IntervalBoundPhaseItemDTO[]>()
  inputs.forEach((input) => {
    const actualLink = input.phaseItem.boqLinks.find((link) => link.boqItem.sheetType === 'ACTUAL')
    const fallbackLink = input.phaseItem.boqLinks[0]
    const boqItem = (actualLink ?? fallbackLink)?.boqItem ?? null
    const manualQuantity = toOptionalNumber(input.manualQuantity)
    const computedQuantity = toOptionalNumber(input.computedQuantity)
    const effectiveQuantity = manualQuantity ?? computedQuantity
    const dto: IntervalBoundPhaseItemDTO = {
      inputId: input.id,
      intervalId: input.intervalId,
      intervalSpec: input.interval.spec ?? null,
      phaseItemId: input.phaseItemId,
      phaseItemName: input.phaseItem.name,
      phaseItemSpec: input.phaseItem.spec ?? null,
      manualQuantity,
      computedQuantity,
      effectiveQuantity,
      unit: boqItem?.unit ?? null,
      boqItemId: boqItem?.id ?? null,
      boqCode: boqItem?.code ?? null,
      updatedAt: input.updatedAt.toISOString(),
    }
    const list = map.get(input.intervalId) ?? []
    list.push(dto)
    map.set(input.intervalId, list)
  })

  return map
}

export const deletePhaseItemInput = async (inputId: number) => {
  if (!Number.isInteger(inputId) || inputId <= 0) {
    throw new Error('输入记录无效')
  }
  await prisma.phaseItemInput.delete({ where: { id: inputId } })
}

export const getRoadPhaseQuantityDetail = async (
  phaseId: number,
  options?: { intervalId?: number | null },
): Promise<RoadPhaseQuantityDetailDTO | null> => {
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    throw new Error('分项 ID 无效')
  }

  const phase = await prisma.roadPhase.findUnique({
    where: { id: phaseId },
    include: {
      road: {
        select: {
          id: true,
          name: true,
          slug: true,
          projectId: true,
          project: { select: { name: true, code: true } },
        },
      },
      intervals: {
        orderBy: [{ startPk: 'asc' }, { endPk: 'asc' }, { side: 'asc' }],
        include: {
          locationRoad: {
            select: {
              id: true,
              name: true,
              slug: true,
              projectId: true,
              project: { select: { name: true, code: true } },
            },
          },
        },
      },
      phaseDefinition: { select: { id: true, name: true } },
    },
  })

  if (!phase) return null

  const contextIntervalId = options?.intervalId ?? null
  const contextInterval =
    contextIntervalId && Number.isInteger(contextIntervalId)
      ? phase.intervals.find((interval) => interval.id === contextIntervalId) ?? null
      : null
  const effectiveProject = resolveEffectiveProject({
    phaseRoadProjectId: phase.road.projectId ?? null,
    phaseRoadProjectName: phase.road.project?.name ?? null,
    phaseRoadProjectCode: phase.road.project?.code ?? null,
    locationRoadProjectId: contextInterval?.locationRoad?.projectId ?? null,
    locationRoadProjectName: contextInterval?.locationRoad?.project?.name ?? null,
    locationRoadProjectCode: contextInterval?.locationRoad?.project?.code ?? null,
  })
  const projectId = effectiveProject.projectId
  const phaseItems = await prisma.phaseItem.findMany({
    where: { phaseDefinitionId: phase.phaseDefinitionId, isActive: true },
    include: {
      formula: true,
      boqLinks: {
        where: {
          isActive: true,
          boqItem: { projectId: projectId ?? -1 },
        },
        include: { boqItem: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const phaseItemDtos: PhaseItemDTO[] = phaseItems.map((item) => {
    const boqBinding = item.boqLinks[0]?.boqItem
      ? formatBoqItem(item.boqLinks[0].boqItem)
      : null
    return {
      id: item.id,
      name: item.name,
      spec: item.spec,
      measure: item.measure,
      unitString: item.unitString,
      description: item.description,
      unitPrice: toOptionalNumber(item.unitPrice),
      formula: item.formula
        ? {
            expression: item.formula.expression,
            inputSchema: item.formula.inputSchema ?? null,
            unitString: item.formula.unitString ?? null,
          }
        : null,
      boqBinding,
    }
  })

  const intervals: PhaseIntervalDTO[] = phase.intervals.map((interval) => ({
    id: interval.id,
    startPk: interval.startPk,
    endPk: interval.endPk,
    side: interval.side,
    levelCrossingSide: interval.levelCrossingSide ?? null,
    spec: interval.spec,
    billQuantity: interval.billQuantity ?? null,
  }))

  const intervalMap = new Map(intervals.map((interval) => [interval.id, interval]))
  const phaseItemFormulaMap = new Map(
    phaseItems.map((item) => [item.id, item.formula?.expression ?? null]),
  )

  const inputRecords = await prisma.phaseItemInput.findMany({
    where: {
      phaseItemId: { in: phaseItems.map((item) => item.id) },
      intervalId: { in: intervals.map((interval) => interval.id) },
    },
  })

  const inputs: PhaseItemInputDTO[] = inputRecords.map((input) => {
    const interval = intervalMap.get(input.intervalId)
    const values = normalizeInputValues(input.values)
    let computedQuantity = toOptionalNumber(input.computedQuantity)
    let computedError: string | null = null
    const expression = phaseItemFormulaMap.get(input.phaseItemId)
    if (interval && expression) {
      const variables = buildFormulaVariables({
        startPk: interval.startPk,
        endPk: interval.endPk,
        side: interval.side,
        billQuantity: interval.billQuantity ?? null,
        values,
      })
      const result = evaluateFormulaExpression(expression, variables)
      computedQuantity = result.value
      computedError = result.error ?? null
    }
    return {
      id: input.id,
      phaseItemId: input.phaseItemId,
      intervalId: input.intervalId,
      values,
      computedQuantity,
      manualQuantity: toOptionalNumber(input.manualQuantity),
      computedError,
    }
  })

  const boqItems = projectId
    ? await prisma.boqItem.findMany({
        where: {
          projectId,
          tone: 'ITEM',
          isActive: true,
          sheetType: 'ACTUAL',
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      })
    : []

  return {
    phase: {
      id: phase.id,
      name: phase.name,
      measure: phase.measure,
      definitionId: phase.phaseDefinition.id,
      definitionName: phase.phaseDefinition.name,
    },
    road: {
      id: phase.road.id,
      name: phase.road.name,
      slug: phase.road.slug,
      projectId: effectiveProject.projectId,
      projectName: effectiveProject.projectName,
      projectCode: effectiveProject.projectCode,
    },
    intervals,
    phaseItems: phaseItemDtos,
    inputs,
    boqItems: boqItems.map(formatBoqItem),
  }
}

export const upsertPhaseItemInput = async (payload: {
  phaseItemId: number
  intervalId: number
  values: Record<string, number>
  manualQuantity: number | null
}) => {
  const phaseItem = await prisma.phaseItem.findUnique({
    where: { id: payload.phaseItemId },
    include: { formula: true },
  })
  if (!phaseItem) {
    throw new Error('分项名称不存在')
  }

  const interval = await prisma.phaseInterval.findUnique({
    where: { id: payload.intervalId },
    select: { startPk: true, endPk: true, side: true, billQuantity: true },
  })
  if (!interval) {
    throw new Error('区间不存在')
  }

  let computedQuantity: number | null = null
  let computedError: string | null = null
  if (phaseItem.formula?.expression) {
    const variables = buildFormulaVariables({
      startPk: interval.startPk,
      endPk: interval.endPk,
      side: interval.side,
      billQuantity: interval.billQuantity ?? null,
      values: payload.values,
    })
    const result = evaluateFormulaExpression(phaseItem.formula.expression, variables)
    computedQuantity = result.value
    computedError = result.error ?? null
  } else if (payload.manualQuantity === null) {
    throw new PhaseItemInputValidationError('未配置公式时必须填写手动值')
  }

  const input = await prisma.phaseItemInput.upsert({
    where: {
      phaseItemId_intervalId: {
        phaseItemId: payload.phaseItemId,
        intervalId: payload.intervalId,
      },
    },
    create: {
      phaseItemId: payload.phaseItemId,
      intervalId: payload.intervalId,
      values: payload.values,
      computedQuantity: computedQuantity ?? null,
      manualQuantity: payload.manualQuantity ?? null,
    },
    update: {
      values: payload.values,
      computedQuantity: computedQuantity ?? null,
      manualQuantity: payload.manualQuantity ?? null,
    },
  })

  return {
    input: {
      id: input.id,
      phaseItemId: input.phaseItemId,
      intervalId: input.intervalId,
      values: normalizeInputValues(input.values),
      computedQuantity,
      manualQuantity: toOptionalNumber(input.manualQuantity),
      computedError,
    },
  }
}

export const batchUpsertPhaseItemInputsForInterval = async (payload: {
  phaseId: number
  intervalId: number
}) => {
  if (!Number.isInteger(payload.phaseId) || payload.phaseId <= 0) {
    throw new Error('分项无效')
  }
  if (!Number.isInteger(payload.intervalId) || payload.intervalId <= 0) {
    throw new Error('区间无效')
  }

  const interval = await prisma.phaseInterval.findUnique({
    where: { id: payload.intervalId },
    include: {
      phase: { select: { id: true, phaseDefinitionId: true } },
    },
  })
  if (!interval) {
    throw new Error('区间不存在')
  }
  if (interval.phaseId !== payload.phaseId) {
    throw new Error('区间不属于当前分项')
  }

  const phaseItems = await prisma.phaseItem.findMany({
    where: { phaseDefinitionId: interval.phase.phaseDefinitionId, isActive: true },
    include: { formula: true },
    orderBy: { name: 'asc' },
  })

  if (!phaseItems.length) {
    return { inputs: [], skipped: [], failed: [] }
  }

  const existingInputs = await prisma.phaseItemInput.findMany({
    where: {
      intervalId: payload.intervalId,
      phaseItemId: { in: phaseItems.map((item) => item.id) },
    },
  })
  const existingMap = new Map(existingInputs.map((input) => [input.phaseItemId, input]))

  const inputs: PhaseItemInputDTO[] = []
  const skipped: { phaseItemId: number; reason: string }[] = []
  const failed: { phaseItemId: number; error: string }[] = []

  for (const item of phaseItems) {
    const expression = item.formula?.expression ?? ''
    if (!expression) {
      skipped.push({ phaseItemId: item.id, reason: '无公式' })
      continue
    }

    const requiresInput = hasInputFields(item.formula?.inputSchema ?? null)
    const existing = existingMap.get(item.id)
    if (requiresInput && !existing) {
      skipped.push({ phaseItemId: item.id, reason: '缺少输入字段' })
      continue
    }

    const values = existing ? normalizeInputValues(existing.values) : {}
    const manualQuantity = existing ? toOptionalNumber(existing.manualQuantity) : null

    const variables = buildFormulaVariables({
      startPk: interval.startPk,
      endPk: interval.endPk,
      side: interval.side,
      billQuantity: interval.billQuantity ?? null,
      values,
    })
    const result = evaluateFormulaExpression(expression, variables)
    if (result.error) {
      failed.push({ phaseItemId: item.id, error: result.error })
      continue
    }

    const saved = await upsertPhaseItemInput({
      phaseItemId: item.id,
      intervalId: payload.intervalId,
      values,
      manualQuantity,
    })
    inputs.push(saved.input)
  }

  return { inputs, skipped, failed }
}

export const upsertPhaseItemFormula = async (payload: {
  phaseItemId: number
  expression: string | null
  inputSchema?: unknown | null
  unitString?: string | null
}) => {
  const phaseItem = await prisma.phaseItem.findUnique({
    where: { id: payload.phaseItemId },
    select: { id: true },
  })
  if (!phaseItem) {
    throw new Error('分项名称不存在')
  }

  const expression = payload.expression?.trim() ?? ''

  if (!expression) {
    await prisma.phaseItemFormula.deleteMany({ where: { phaseItemId: payload.phaseItemId } })
    await prisma.phaseItemInput.updateMany({
      where: { phaseItemId: payload.phaseItemId },
      data: { computedQuantity: null },
    })
    return { formula: null, updatedCount: 0 }
  }

  const parsed = parseFormulaExpression(expression)
  if ('error' in parsed) {
    throw new Error(parsed.error)
  }

  const inputSchema = normalizeInputSchema(payload.inputSchema)
  const formula = await prisma.phaseItemFormula.upsert({
    where: { phaseItemId: payload.phaseItemId },
    create: {
      phaseItemId: payload.phaseItemId,
      expression,
      inputSchema,
      unitString: payload.unitString ?? null,
    },
    update: {
      expression,
      inputSchema,
      unitString: payload.unitString ?? null,
    },
  })

  const inputs = await prisma.phaseItemInput.findMany({
    where: { phaseItemId: payload.phaseItemId },
    include: { interval: { select: { startPk: true, endPk: true, side: true, billQuantity: true } } },
  })

  await Promise.all(
    inputs.map(async (input) => {
      const values = normalizeInputValues(input.values)
      const variables = buildFormulaVariables({
        startPk: input.interval.startPk,
        endPk: input.interval.endPk,
        side: input.interval.side,
        billQuantity: input.interval.billQuantity ?? null,
        values,
      })
      const result = evaluateFormulaExpression(expression, variables)
      await prisma.phaseItemInput.update({
        where: { id: input.id },
        data: { computedQuantity: result.value ?? null },
      })
    }),
  )

  return {
    formula: {
      expression: formula.expression,
      inputSchema: formula.inputSchema ?? null,
      unitString: formula.unitString ?? null,
    },
    updatedCount: inputs.length,
  }
}

export const setPhaseItemBoqBinding = async (payload: {
  phaseItemId: number
  projectId: number
  boqItemId: number | null
}) => {
  const phaseItem = await prisma.phaseItem.findUnique({
    where: { id: payload.phaseItemId },
    select: { id: true },
  })
  if (!phaseItem) {
    throw new Error('分项名称不存在')
  }

  if (!Number.isInteger(payload.projectId) || payload.projectId <= 0) {
    throw new Error('项目编号无效')
  }

  let boqItem: PhaseItemBoqBindingDTO | null = null
  if (payload.boqItemId) {
    const record = await prisma.boqItem.findFirst({
      where: {
        id: payload.boqItemId,
        projectId: payload.projectId,
        tone: 'ITEM',
        isActive: true,
        sheetType: 'ACTUAL',
      },
    })
    if (!record) {
      throw new Error('工程量清单条目无效')
    }
    boqItem = formatBoqItem(record)
  }

  await prisma.phaseItemBoqItem.deleteMany({
    where: {
      phaseItemId: payload.phaseItemId,
      boqItem: { projectId: payload.projectId },
    },
  })

  if (payload.boqItemId) {
    await prisma.phaseItemBoqItem.create({
      data: {
        phaseItemId: payload.phaseItemId,
        boqItemId: payload.boqItemId,
      },
    })
  }

  return { boqItem }
}

export const setPhaseItemBoqBindings = async (payload: {
  phaseItemId: number
  boqItemIds: number[]
}) => {
  const phaseItem = await prisma.phaseItem.findUnique({
    where: { id: payload.phaseItemId },
    select: { id: true },
  })
  if (!phaseItem) {
    throw new Error('分项名称不存在')
  }

  const normalizedIds = Array.from(
    new Set(payload.boqItemIds.filter((id) => Number.isInteger(id) && id > 0)),
  )

  if (!normalizedIds.length) {
    await prisma.phaseItemBoqItem.deleteMany({
      where: { phaseItemId: payload.phaseItemId },
    })
    return { boqItemIds: [] }
  }

  const records = await prisma.boqItem.findMany({
    where: {
      id: { in: normalizedIds },
      tone: 'ITEM',
      isActive: true,
      sheetType: 'ACTUAL',
    },
    select: { id: true, projectId: true },
  })

  if (records.length !== normalizedIds.length) {
    throw new Error('工程量清单条目无效')
  }

  const projectMap = new Map<number, number>()
  records.forEach((record) => {
    if (projectMap.has(record.projectId)) {
      throw new Error('同一项目只能绑定一个清单条目')
    }
    projectMap.set(record.projectId, record.id)
  })

  await prisma.phaseItemBoqItem.deleteMany({
    where: {
      phaseItemId: payload.phaseItemId,
      boqItemId: { notIn: normalizedIds },
    },
  })

  await prisma.phaseItemBoqItem.createMany({
    data: normalizedIds.map((boqItemId) => ({
      phaseItemId: payload.phaseItemId,
      boqItemId,
    })),
    skipDuplicates: true,
  })

  return { boqItemIds: normalizedIds }
}
