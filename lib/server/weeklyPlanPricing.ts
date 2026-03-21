import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  buildGoodsNameKey,
  buildMaterialModelKey,
  normalizeGoodsName,
} from '@/app/resources/weekly-plans/materialsConfig'

type PriceSyncPayload = {
  goodsName: string | null | undefined
  model: unknown
  unitPrice: unknown
  sourceItemId: number
}

type PriceTransaction = Pick<typeof prisma, 'weeklyMaterialLatestPrice' | 'weeklyMaterialPriceHistory'>

const normalizeUnitPrice = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const stringValue = String(value).trim()
  return stringValue ? stringValue : null
}

export async function syncWeeklyPlanLatestPrice(
  tx: PriceTransaction,
  payload: PriceSyncPayload,
): Promise<void> {
  const goodsName = normalizeGoodsName(payload.goodsName)
  const goodsNameKey = buildGoodsNameKey(payload.goodsName)
  const modelKey = buildMaterialModelKey(payload.model)
  const unitPrice = normalizeUnitPrice(payload.unitPrice)

  if (!goodsName || !goodsNameKey || !unitPrice) return

  const existing = await tx.weeklyMaterialLatestPrice.findUnique({
    where: {
      goodsNameKey_modelKey: {
        goodsNameKey,
        modelKey,
      },
    },
  })

  if (!existing) {
    await tx.weeklyMaterialLatestPrice.create({
      data: {
        goodsName,
        goodsNameKey,
        model: payload.model ?? Prisma.JsonNull,
        modelKey,
        unitPrice,
        sourceItemId: payload.sourceItemId,
      },
    })
    return
  }

  if (String(existing.unitPrice) !== unitPrice) {
    await tx.weeklyMaterialPriceHistory.create({
      data: {
        goodsName: existing.goodsName,
        goodsNameKey: existing.goodsNameKey,
        model: existing.model ?? Prisma.JsonNull,
        modelKey: existing.modelKey,
        unitPrice: existing.unitPrice,
        sourceItemId: existing.sourceItemId,
      },
    })
  }

  await tx.weeklyMaterialLatestPrice.update({
    where: { id: existing.id },
    data: {
      goodsName,
      goodsNameKey,
      model: payload.model ?? Prisma.JsonNull,
      modelKey,
      unitPrice,
      sourceItemId: payload.sourceItemId,
    },
  })
}
