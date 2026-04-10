import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { purgeWeeklyPlanReceiptsForItemIds } from '@/lib/server/weeklyPlanReceiptStore'

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
  if (!(await hasPermission('material:delete'))) {
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
      return NextResponse.json({ message: '缺少要删除的行' }, { status: 400 })
    }

    const items = await prisma.weeklyDeliveryPlanItem.findMany({
      where: { id: { in: ids }, planId },
      select: { id: true },
    })

    if (items.length !== ids.length) {
      return NextResponse.json({ message: '部分计划明细不存在或不属于当前周计划' }, { status: 404 })
    }

    const itemIds = items.map((item) => item.id)

    await purgeWeeklyPlanReceiptsForItemIds(itemIds)

    await prisma.$transaction(async (tx) => {
      await tx.weeklyDeliveryPlanItem.deleteMany({
        where: { id: { in: itemIds }, planId },
      })
      await tx.weeklyDeliveryPlan.update({
        where: { id: planId },
        data: { updatedById: session.id },
      })
    })

    return NextResponse.json({ deletedCount: itemIds.length })
  } catch (error) {
    console.error('[weekly-plans/[id]/items/bulk-delete POST]', error)
    return NextResponse.json({ message: '批量删除失败' }, { status: 500 })
  }
}
