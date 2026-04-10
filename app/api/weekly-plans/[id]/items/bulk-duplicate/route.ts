import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

const normalizeIds = (value: unknown): number[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0),
        ),
      )
    : []

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 })

  const { id } = await params
  const planId = Number(id)

  try {
    const body = (await req.json()) as { ids?: number[] }
    const ids = normalizeIds(body.ids)
    if (!ids.length) {
      return NextResponse.json({ message: '缺少要复制的行' }, { status: 400 })
    }

    const items = await prisma.weeklyDeliveryPlanItem.findMany({
      where: { id: { in: ids }, planId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    if (items.length !== ids.length) {
      return NextResponse.json({ message: '部分计划明细不存在或不属于当前周计划' }, { status: 404 })
    }

    const last = await prisma.weeklyDeliveryPlanItem.findFirst({
      where: { planId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const duplicated = await prisma.$transaction(async (tx) => {
      let nextSortOrder = (last?.sortOrder ?? -1) + 1

      const created = []
      for (const item of items) {
        const duplicate = await tx.weeklyDeliveryPlanItem.create({
          data: {
            planId,
            sortOrder: nextSortOrder,
            deliveryDate: item.deliveryDate,
            supplier: item.supplier,
            goodsName: item.goodsName,
            goodsNameKey: item.goodsNameKey,
            model:
              item.model === null || item.model === undefined
                ? Prisma.JsonNull
                : (item.model as Prisma.InputJsonValue),
            modelKey: item.modelKey,
            unit: item.unit,
            status: item.status,
            plannedQty: item.plannedQty,
            transporter: item.transporter,
            headPlateNumber: item.headPlateNumber,
            tailPlateNumber: item.tailPlateNumber,
            phone: item.phone,
            actualQty: item.actualQty,
            unitPrice: item.unitPrice,
            note: item.note,
          },
          select: { id: true },
        })
        created.push(duplicate)
        nextSortOrder += 1
      }

      await tx.weeklyDeliveryPlan.update({
        where: { id: planId },
        data: { updatedById: session.id },
      })

      return created
    })

    return NextResponse.json({ duplicatedCount: duplicated.length })
  } catch (error) {
    console.error('[weekly-plans/[id]/items/bulk-duplicate POST]', error)
    return NextResponse.json({ message: '批量复制失败' }, { status: 500 })
  }
}
