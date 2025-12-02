import { Prisma, type PhaseMeasure } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface PhasePriceItem {
  id: number
  phaseDefinitionId: number
  phaseDefinitionName: string
  priceableName: string
  spec: string | null
  measure: PhaseMeasure
  unitString: string | null
  description: string | null
  unitPrice: number | null
  isActive: boolean
}

export interface PhasePricingGroup {
  phaseDefinitionId: number
  definitionName: string
  measure: PhaseMeasure
  defaultUnitPrice: number | null
  priceItems: PhasePriceItem[]
  specOptions: string[]
}

const toOptionalNumber = (value: number | Prisma.Decimal | null | undefined) => {
  if (value == null) {
    return null
  }
  return Number(value)
}

export const listPhasePricing = async (): Promise<PhasePricingGroup[]> => {
  const definitions = await prisma.phaseDefinition.findMany({
    where: { isActive: true },
    include: {
      priceItems: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
    return definitions.map((definition) => ({
      phaseDefinitionId: definition.id,
      definitionName: definition.name,
      measure: definition.measure,
      defaultUnitPrice: toOptionalNumber(definition.unitPrice),
      priceItems: definition.priceItems.map((item) => ({
        id: item.id,
      phaseDefinitionId: definition.id,
      phaseDefinitionName: definition.name,
      priceableName: item.name,
      spec: item.spec,
      measure: item.measure,
      unitString: item.unitString,
      description: item.description,
      unitPrice: toOptionalNumber(item.unitPrice),
      isActive: item.isActive,
      })),
      specOptions: [],
    }))
  }

export const createPhasePriceItem = async (payload: {
  phaseDefinitionId: number
  name: string
  spec?: string | null
  measure: PhaseMeasure
  unitString?: string | null
  description?: string | null
  unitPrice?: number | null
}) => {
  const created = await prisma.phasePriceItem.create({
    data: {
      phaseDefinitionId: payload.phaseDefinitionId,
      name: payload.name,
      spec: payload.spec ?? null,
      measure: payload.measure,
      unitString: payload.unitString ?? null,
      description: payload.description ?? null,
      unitPrice: payload.unitPrice ?? null,
    },
    include: {
      phaseDefinition: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  })
  return {
    id: created.id,
    phaseDefinitionId: created.phaseDefinitionId,
    phaseDefinitionName: created.phaseDefinition.name,
    priceableName: created.name,
    spec: created.spec,
    measure: created.measure,
    unitString: created.unitString,
    description: created.description,
    unitPrice: toOptionalNumber(created.unitPrice),
    isActive: created.isActive,
  }
}

export const updatePhasePriceItem = async (
  priceItemId: number,
  payload: {
    name?: string
    spec?: string | null
    unitString?: string | null
    description?: string | null
    unitPrice?: number | null
    isActive?: boolean
  },
) => {
  try {
    const updated = await prisma.phasePriceItem.update({
      where: { id: priceItemId },
      data: {
        name: payload.name,
        spec: payload.spec === undefined ? undefined : payload.spec,
        unitString: payload.unitString === undefined ? undefined : payload.unitString,
        description: payload.description === undefined ? undefined : payload.description,
        unitPrice: payload.unitPrice === undefined ? undefined : payload.unitPrice,
        isActive: payload.isActive,
      },
      include: {
        phaseDefinition: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return {
      id: updated.id,
      phaseDefinitionId: updated.phaseDefinitionId,
      phaseDefinitionName: updated.phaseDefinition.name,
      priceableName: updated.name,
      spec: updated.spec,
      measure: updated.measure,
      unitString: updated.unitString,
      description: updated.description,
      unitPrice: toOptionalNumber(updated.unitPrice),
      isActive: updated.isActive,
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new Error('可报价分项不存在')
    }
    throw error
  }
}

export const deactivatePhasePriceItem = async (priceItemId: number) => {
  try {
    const updated = await prisma.phasePriceItem.update({
      where: { id: priceItemId },
      data: { isActive: false },
      include: {
        phaseDefinition: {
          select: { id: true, name: true },
        },
      },
    })
    return {
      id: updated.id,
      phaseDefinitionId: updated.phaseDefinitionId,
      phaseDefinitionName: updated.phaseDefinition.name,
      priceableName: updated.name,
      spec: updated.spec,
      measure: updated.measure,
      unitString: updated.unitString,
      description: updated.description,
      unitPrice: toOptionalNumber(updated.unitPrice),
      isActive: updated.isActive,
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new Error('可报价分项不存在')
    }
    throw error
  }
}

export const updatePhaseDefinitionUnitPrice = async (
  definitionId: number,
  unitPrice: number | null,
) => {
  try {
    const updated = await prisma.phaseDefinition.update({
      where: { id: definitionId },
      data: { unitPrice: unitPrice ?? null },
      select: { id: true, unitPrice: true },
    })
    return toOptionalNumber(updated.unitPrice)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new Error('分项定义不存在')
    }
    throw error
  }
}
