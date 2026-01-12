import type { BoqItemTone, BoqSheetType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

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
