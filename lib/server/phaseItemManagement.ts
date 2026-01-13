import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import type { IntervalSide } from '@/lib/progressTypes'
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
  PhaseIntervalManagementRow,
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

const buildPointStructureKey = (startPk: number, endPk: number, side: IntervalSide) => {
  const [start, end] = normalizeRange(startPk, endPk)
  const startKey = Math.round(start * 1000)
  const endKey = Math.round(end * 1000)
  return `${startKey}-${endKey}-${side ?? 'BOTH'}`
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
  interval: { startPk: number; endPk: number; side: IntervalSide; layers?: string[] | null; layerIds?: number[] | null }
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
    const key = buildPointStructureKey(interval.startPk, interval.endPk, side)
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

export const listPhaseIntervalManagementRows = async (): Promise<PhaseIntervalManagementRow[]> => {
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

  const phaseProgressMap = new Map<
    number,
    { inspections: { startPk: number; endPk: number; side: IntervalSide }[] }
  >()
  progressRoads.forEach((road) => {
    road.phases.forEach((phase) => {
      phaseProgressMap.set(phase.phaseId, {
        inspections: (phase.inspections ?? []).map((inspection) => ({
          startPk: inspection.startPk,
          endPk: inspection.endPk,
          side: ensureIntervalSide(inspection.side),
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
          layerName: true,
          checkName: true,
        },
      })
    : []

  const entriesByPhase = new Map<
    number,
    Array<{ startPk: number; endPk: number; side: IntervalSide; layerName: string; checkName: string }>
  >()
  pointEntries.forEach((entry) => {
    const list = entriesByPhase.get(entry.phaseId) ?? []
    list.push({
      startPk: entry.startPk,
      endPk: entry.endPk,
      side: ensureIntervalSide(entry.side),
      layerName: entry.layerName,
      checkName: entry.checkName,
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
      const key = buildPointStructureKey(entry.startPk, entry.endPk, entry.side)
      const layerKey = normalizeLabel(canonicalizeSingle('layer', entry.layerName))
      const checkKey = normalizeLabel(canonicalizeSingle('check', entry.checkName))
      if (!key || !layerKey || !checkKey) return
      const list = entriesByStructure.get(key) ?? []
      list.push({ layerKey, checkKey })
      entriesByStructure.set(key, list)
    })
    const inspections = phaseProgressMap.get(phase.id)?.inspections ?? []

    phase.intervals.forEach((interval) => {
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
              interval,
              fallbackLayers,
              layerNameById,
              workflowChecksByLayer,
              entriesByStructure,
            })
          : calcLinearIntervalPercent(interval, inspections)

      rows.push({
        intervalId: interval.id,
        phaseId: phase.id,
        phaseName: phase.name,
        measure: phase.measure,
        roadId: phase.road.id,
        roadName: phase.road.name,
        roadSlug: phase.road.slug,
        projectId: phase.road.projectId ?? null,
        projectName: phase.road.project?.name ?? null,
        projectCode: phase.road.project?.code ?? null,
        startPk: interval.startPk,
        endPk: interval.endPk,
        side: interval.side,
        quantity,
        rawQuantity,
        quantityOverridden,
        completedPercent,
        updatedAt: interval.updatedAt.toISOString(),
      })
    })
  })

  return rows
}

export const getRoadPhaseQuantityDetail = async (
  phaseId: number,
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
      intervals: { orderBy: [{ startPk: 'asc' }, { endPk: 'asc' }, { side: 'asc' }] },
      phaseDefinition: { select: { id: true, name: true } },
    },
  })

  if (!phase) return null

  const projectId = phase.road.projectId ?? null
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
      projectId: phase.road.projectId ?? null,
      projectName: phase.road.project?.name ?? null,
      projectCode: phase.road.project?.code ?? null,
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
