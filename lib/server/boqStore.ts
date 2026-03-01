import type { BoqItemTone, BoqSheetType, IntervalSide, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { listPhaseIntervalManagementRows } from '@/lib/server/phaseItemManagement'

export type BoqItemCreateInput = {
  projectId: number
  sheetType: BoqSheetType
  code: string
  designationZh: string
  designationFr: string
  unit?: string | null
  unitPrice?: string | null
  quantity?: string | null
  totalPrice?: string | null
  tone: BoqItemTone
  sortOrder: number
  contractItemId?: number | null
}

export type BoqItemUpdateInput = {
  code?: string
  designationZh?: string
  designationFr?: string
  unit?: string | null
  unitPrice?: string | null
  quantity?: string | null
  totalPrice?: string | null
  tone?: BoqItemTone
  sortOrder?: number
  contractItemId?: number | null
  isActive?: boolean
}

export const listBoqProjects = async () =>
  prisma.project.findMany({
    where: { isActive: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  })

export const listBoqItems = async (params: {
  projectId: number
  sheetType: BoqSheetType
  includeInactive?: boolean
  tone?: BoqItemTone | null
}) => {
  const { projectId, sheetType, includeInactive = false, tone = null } = params
  return prisma.boqItem.findMany({
    where: {
      projectId,
      sheetType,
      ...(tone ? { tone } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
}

export const listBoqItemsWithProject = async (params: {
  sheetType: BoqSheetType
  includeInactive?: boolean
  tone?: BoqItemTone | null
}) => {
  const { sheetType, includeInactive = false, tone = null } = params
  return prisma.boqItem.findMany({
    where: {
      sheetType,
      ...(tone ? { tone } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
  })
}

export const createBoqItem = async (payload: BoqItemCreateInput) =>
  prisma.boqItem.create({
    data: {
      projectId: payload.projectId,
      sheetType: payload.sheetType,
      code: payload.code,
      designationZh: payload.designationZh,
      designationFr: payload.designationFr,
      unit: payload.unit ?? null,
      unitPrice: payload.unitPrice ?? null,
      quantity: payload.quantity ?? null,
      totalPrice: payload.totalPrice ?? null,
      tone: payload.tone,
      sortOrder: payload.sortOrder,
      contractItemId: payload.contractItemId ?? null,
    },
  })

export const updateBoqItem = async (id: number, payload: BoqItemUpdateInput) =>
  prisma.boqItem.update({
    where: { id },
    data: {
      code: payload.code,
      designationZh: payload.designationZh,
      designationFr: payload.designationFr,
      unit: payload.unit,
      unitPrice: payload.unitPrice,
      quantity: payload.quantity,
      totalPrice: payload.totalPrice,
      tone: payload.tone,
      sortOrder: payload.sortOrder,
      contractItemId: payload.contractItemId,
      isActive: payload.isActive,
    },
  })

export const deactivateBoqItem = async (id: number) =>
  prisma.boqItem.update({
    where: { id },
    data: { isActive: false },
  })

export type BoqMeasurementUpsertInput = {
  projectId: number
  boqItemId: number
  period: Date
  quantity: string
  unitPrice?: string | null
  amount?: string | null
  note?: string | null
}

export const upsertBoqMeasurement = async (payload: BoqMeasurementUpsertInput) =>
  prisma.boqMeasurement.upsert({
    where: {
      boqItemId_period: {
        boqItemId: payload.boqItemId,
        period: payload.period,
      },
    },
    create: {
      projectId: payload.projectId,
      boqItemId: payload.boqItemId,
      period: payload.period,
      quantity: payload.quantity,
      unitPrice: payload.unitPrice ?? null,
      amount: payload.amount ?? null,
      note: payload.note ?? null,
    },
    update: {
      quantity: payload.quantity,
      unitPrice: payload.unitPrice ?? null,
      amount: payload.amount ?? null,
      note: payload.note ?? null,
    },
  })

export const listBoqMeasurements = async (params: {
  projectId: number
  from?: Date
  to?: Date
}) => {
  const { projectId, from, to } = params
  const periodFilter: Prisma.DateTimeFilter = {}
  if (from) periodFilter.gte = from
  if (to) periodFilter.lte = to

  return prisma.boqMeasurement.findMany({
    where: {
      projectId,
      ...(from || to ? { period: periodFilter } : {}),
    },
    orderBy: [{ period: 'asc' }, { id: 'asc' }],
  })
}

export type BoqCompletionRecord = {
  boqItemId: number
  bindingCount: number
  designQuantity: number | null
  completedQuantity: number | null
}

const toOptionalNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const buildIntervalCompletionMap = async (intervalIds: number[]) => {
  const normalized = Array.from(
    new Set(intervalIds.filter((id) => Number.isInteger(id) && id > 0)),
  )
  if (!normalized.length) return new Map<number, number>()
  const rows = await listPhaseIntervalManagementRows()
  const targets = new Set(normalized)
  const map = new Map<number, number>()
  rows.forEach((row) => {
    if (targets.has(row.intervalId)) {
      map.set(row.intervalId, row.completedPercent ?? 0)
    }
  })
  return map
}

const resolveEffectiveQuantity = (
  manualQuantity: Prisma.Decimal | number | null,
  computedQuantity: Prisma.Decimal | number | null,
) => {
  const manual = toOptionalNumber(manualQuantity)
  if (manual !== null) return manual
  const computed = toOptionalNumber(computedQuantity)
  return computed ?? 0
}

export const listBoqCompletion = async (params: {
  projectId: number
  sheetType?: BoqSheetType
}): Promise<BoqCompletionRecord[]> => {
  const { projectId, sheetType = 'ACTUAL' } = params
  const boqItems = await prisma.boqItem.findMany({
    where: {
      projectId,
      sheetType,
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  if (!boqItems.length) return []

  const sourceIdList = boqItems.map((item) => item.id)
  if (!sourceIdList.length) {
    return boqItems.map((item) => ({
      boqItemId: item.id,
      bindingCount: 0,
      designQuantity: 0,
      completedQuantity: 0,
    }))
  }

  const bindings = await prisma.phaseItemBoqItem.findMany({
    where: {
      boqItemId: { in: sourceIdList },
      isActive: true,
      phaseItem: { isActive: true },
    },
    select: { boqItemId: true, phaseItemId: true },
  })

  if (!bindings.length) {
    return boqItems.map((item) => ({
      boqItemId: item.id,
      bindingCount: 0,
      designQuantity: 0,
      completedQuantity: 0,
    }))
  }

  const bindingMap = new Map<number, Set<number>>()
  bindings.forEach((binding) => {
    const set = bindingMap.get(binding.boqItemId) ?? new Set<number>()
    set.add(binding.phaseItemId)
    bindingMap.set(binding.boqItemId, set)
  })

  const phaseItemIds = Array.from(
    new Set(bindings.map((binding) => binding.phaseItemId)),
  )

  const inputs = await prisma.phaseItemInput.findMany({
    where: {
      phaseItemId: { in: phaseItemIds },
      interval: {
        OR: [
          { locationRoad: { is: { projectId } } },
          {
            locationRoad: { is: { projectId: null } },
            phase: { road: { projectId } },
          },
          { locationRoadId: null, phase: { road: { projectId } } },
        ],
      },
    },
    select: {
      phaseItemId: true,
      manualQuantity: true,
      computedQuantity: true,
      intervalId: true,
    },
  })

  const intervalCompletionMap = await buildIntervalCompletionMap(
    inputs.map((input) => input.intervalId),
  )

  const phaseItemTotals = new Map<number, { designQuantity: number; completedQuantity: number }>()
  inputs.forEach((input) => {
    const designQuantity = resolveEffectiveQuantity(input.manualQuantity, input.computedQuantity)
    const completionPercent = intervalCompletionMap.get(input.intervalId) ?? 0
    const completedQuantity = designQuantity * (completionPercent / 100)
    const existing = phaseItemTotals.get(input.phaseItemId) ?? { designQuantity: 0, completedQuantity: 0 }
    existing.designQuantity += designQuantity
    existing.completedQuantity += completedQuantity
    phaseItemTotals.set(input.phaseItemId, existing)
  })

  return boqItems.map((item) => {
    const phaseItemSet = new Set<number>()
    const bound = bindingMap.get(item.id)
    if (bound) {
      bound.forEach((phaseItemId) => phaseItemSet.add(phaseItemId))
    }

    if (!phaseItemSet.size) {
      return { boqItemId: item.id, bindingCount: 0, designQuantity: 0, completedQuantity: 0 }
    }

    let designQuantity = 0
    let completedQuantity = 0
    phaseItemSet.forEach((phaseItemId) => {
      const totals = phaseItemTotals.get(phaseItemId)
      if (!totals) return
      designQuantity += totals.designQuantity
      completedQuantity += totals.completedQuantity
    })

    return {
      boqItemId: item.id,
      bindingCount: phaseItemSet.size,
      designQuantity,
      completedQuantity,
    }
  })
}

export type BoqCompletionDetailRecord = {
  boqItemId: number
  inputId: number
  phaseItemId: number
  phaseItemName: string
  phaseItemSpec: string | null
  intervalId: number
  intervalStartPk: number
  intervalEndPk: number
  intervalSide: IntervalSide
  intervalSpec: string | null
  roadId: number
  roadName: string
  roadSlug: string
  manualQuantity: number | null
  computedQuantity: number | null
  effectiveQuantity: number
  completionPercent: number
  completedQuantity: number
  unit: string | null
}

export const listBoqCompletionDetails = async (params: {
  projectId: number
  boqItemId: number
}): Promise<BoqCompletionDetailRecord[]> => {
  const { projectId, boqItemId } = params
  const boqItem = await prisma.boqItem.findFirst({
    where: { id: boqItemId, projectId, sheetType: 'ACTUAL', isActive: true },
    select: { id: true, unit: true },
  })
  if (!boqItem) {
    return []
  }

  const bindings = await prisma.phaseItemBoqItem.findMany({
    where: {
      boqItemId,
      isActive: true,
      phaseItem: { isActive: true },
    },
    select: { phaseItemId: true },
  })
  if (!bindings.length) return []

  const phaseItemIds = bindings.map((binding) => binding.phaseItemId)
  const inputs = await prisma.phaseItemInput.findMany({
    where: {
      phaseItemId: { in: phaseItemIds },
      interval: {
        OR: [
          { locationRoad: { is: { projectId } } },
          {
            locationRoad: { is: { projectId: null } },
            phase: { road: { projectId } },
          },
          { locationRoadId: null, phase: { road: { projectId } } },
        ],
      },
    },
    select: {
      id: true,
      phaseItemId: true,
      manualQuantity: true,
      computedQuantity: true,
      interval: {
        select: {
          id: true,
          startPk: true,
          endPk: true,
          side: true,
          spec: true,
          locationRoadId: true,
          locationRoad: { select: { id: true, name: true, slug: true } },
          phase: {
            select: {
              id: true,
              name: true,
              road: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      phaseItem: {
        select: {
          name: true,
          spec: true,
        },
      },
    },
  })

  const intervalCompletionMap = await buildIntervalCompletionMap(
    inputs.map((input) => input.interval.id),
  )

  const details = inputs.map((input) => {
    const manualQuantity = toOptionalNumber(input.manualQuantity)
    const computedQuantity = toOptionalNumber(input.computedQuantity)
    const effectiveQuantity = resolveEffectiveQuantity(input.manualQuantity, input.computedQuantity)
    const completionPercent = intervalCompletionMap.get(input.interval.id) ?? 0
    const completedQuantity = effectiveQuantity * (completionPercent / 100)
    const resolvedLocationRoad =
      input.interval.locationRoad ??
      (input.interval.locationRoadId && input.interval.locationRoadId === input.interval.phase.road.id
        ? input.interval.phase.road
        : null)
    return {
      boqItemId: boqItem.id,
      inputId: input.id,
      phaseItemId: input.phaseItemId,
      phaseItemName: input.phaseItem.name,
      phaseItemSpec: input.phaseItem.spec ?? null,
      intervalId: input.interval.id,
      intervalStartPk: input.interval.startPk,
      intervalEndPk: input.interval.endPk,
      intervalSide: input.interval.side,
      intervalSpec: input.interval.spec ?? null,
      roadId: input.interval.phase.road.id,
      roadName: resolvedLocationRoad?.name ?? input.interval.phase.road.name,
      roadSlug: resolvedLocationRoad?.slug ?? input.interval.phase.road.slug,
      manualQuantity,
      computedQuantity,
      effectiveQuantity,
      completionPercent,
      completedQuantity,
      unit: boqItem.unit ?? null,
    }
  })

  return details.sort((a, b) => {
    if (a.roadName !== b.roadName) {
      return a.roadName.localeCompare(b.roadName, 'zh-CN', { sensitivity: 'base' })
    }
    if (a.intervalStartPk !== b.intervalStartPk) return a.intervalStartPk - b.intervalStartPk
    if (a.intervalEndPk !== b.intervalEndPk) return a.intervalEndPk - b.intervalEndPk
    return a.intervalId - b.intervalId
  })
}
