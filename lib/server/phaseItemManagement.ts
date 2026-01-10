import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
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
  RoadPhaseManagementRow,
  RoadPhaseQuantityDetailDTO,
} from '@/lib/phaseItemTypes'

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

export const listRoadPhaseManagementRows = async (): Promise<RoadPhaseManagementRow[]> => {
  const phases = await prisma.roadPhase.findMany({
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
      phaseDefinition: { select: { name: true } },
      _count: { select: { intervals: true } },
    },
    orderBy: [{ roadId: 'asc' }, { name: 'asc' }],
  })

  return phases.map((phase) => ({
    phaseId: phase.id,
    phaseName: phase.name,
    definitionName: phase.phaseDefinition.name,
    measure: phase.measure,
    roadId: phase.road.id,
    roadName: phase.road.name,
    roadSlug: phase.road.slug,
    projectId: phase.road.projectId ?? null,
    projectName: phase.road.project?.name ?? null,
    projectCode: phase.road.project?.code ?? null,
    intervalCount: phase._count.intervals,
    updatedAt: phase.updatedAt.toISOString(),
  }))
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
          sheetType: 'CONTRACT',
          tone: 'ITEM',
          isActive: true,
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
    select: { startPk: true, endPk: true, side: true },
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
      values: payload.values,
    })
    const result = evaluateFormulaExpression(phaseItem.formula.expression, variables)
    computedQuantity = result.value
    computedError = result.error ?? null
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
    include: { interval: { select: { startPk: true, endPk: true, side: true } } },
  })

  await Promise.all(
    inputs.map(async (input) => {
      const values = normalizeInputValues(input.values)
      const variables = buildFormulaVariables({
        startPk: input.interval.startPk,
        endPk: input.interval.endPk,
        side: input.interval.side,
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
        sheetType: 'CONTRACT',
        tone: 'ITEM',
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
