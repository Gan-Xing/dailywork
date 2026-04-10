import { NextResponse } from 'next/server'

import {
  addDays,
  formatDateInput,
  normalizeWeeklyPlanItemStatus,
  parseDateInput,
} from '@/app/resources/weekly-plans/materialsConfig'
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

const trimOptional = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 })

  const { id } = await params
  const planId = Number(id)

  try {
    const body = (await req.json()) as {
      ids?: number[]
      payload?: {
        deliveryDate?: string | null
        shiftDays?: number | string | null
        status?: string | null
        supplier?: string | null
        transporter?: string | null
        headPlateNumber?: string | null
        tailPlateNumber?: string | null
        phone?: string | null
      }
    }

    const ids = normalizeIds(body.ids)
    if (!ids.length) {
      return NextResponse.json({ message: '缺少要更新的行' }, { status: 400 })
    }

    const payload = body.payload ?? {}
    const rawDeliveryDate = trimOptional(payload.deliveryDate)
    const rawShiftDays =
      payload.shiftDays === null || payload.shiftDays === undefined || payload.shiftDays === ''
        ? undefined
        : Number(payload.shiftDays)

    if (rawDeliveryDate && rawShiftDays !== undefined) {
      return NextResponse.json({ message: '不能同时设置统一日期和顺延天数' }, { status: 400 })
    }

    const deliveryDate =
      rawDeliveryDate !== undefined ? formatDateInput(parseDateInput(rawDeliveryDate)) : undefined
    if (rawDeliveryDate !== undefined && !deliveryDate) {
      return NextResponse.json({ message: '日期格式不正确' }, { status: 400 })
    }

    if (rawShiftDays !== undefined && !Number.isInteger(rawShiftDays)) {
      return NextResponse.json({ message: '顺延天数必须是整数' }, { status: 400 })
    }

    const status = trimOptional(payload.status)
      ? normalizeWeeklyPlanItemStatus(payload.status)
      : undefined
    const supplier = trimOptional(payload.supplier)
    const transporter = trimOptional(payload.transporter)
    const headPlateNumber = trimOptional(payload.headPlateNumber)
    const tailPlateNumber = trimOptional(payload.tailPlateNumber)
    const phone = trimOptional(payload.phone)

    if (
      deliveryDate === undefined &&
      rawShiftDays === undefined &&
      status === undefined &&
      supplier === undefined &&
      transporter === undefined &&
      headPlateNumber === undefined &&
      tailPlateNumber === undefined &&
      phone === undefined
    ) {
      return NextResponse.json({ message: '没有可更新的字段' }, { status: 400 })
    }

    const items = await prisma.weeklyDeliveryPlanItem.findMany({
      where: { id: { in: ids }, planId },
      select: { id: true, deliveryDate: true },
    })

    if (items.length !== ids.length) {
      return NextResponse.json({ message: '部分计划明细不存在或不属于当前周计划' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedCount = 0
      let skippedCount = 0

      for (const item of items) {
        const data: Record<string, string> = {}

        if (deliveryDate !== undefined) {
          data.deliveryDate = deliveryDate
        } else if (rawShiftDays !== undefined) {
          const parsedDate = parseDateInput(item.deliveryDate)
          if (!parsedDate) {
            skippedCount += 1
            continue
          }
          data.deliveryDate = formatDateInput(addDays(parsedDate, rawShiftDays))
        }

        if (status !== undefined) data.status = status
        if (supplier !== undefined) data.supplier = supplier
        if (transporter !== undefined) data.transporter = transporter
        if (headPlateNumber !== undefined) data.headPlateNumber = headPlateNumber
        if (tailPlateNumber !== undefined) data.tailPlateNumber = tailPlateNumber
        if (phone !== undefined) data.phone = phone

        if (!Object.keys(data).length) {
          skippedCount += 1
          continue
        }

        await tx.weeklyDeliveryPlanItem.update({
          where: { id: item.id },
          data,
        })
        updatedCount += 1
      }

      if (updatedCount > 0) {
        await tx.weeklyDeliveryPlan.update({
          where: { id: planId },
          data: { updatedById: session.id },
        })
      }

      return { updatedCount, skippedCount }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[weekly-plans/[id]/items/bulk-edit POST]', error)
    return NextResponse.json({ message: '批量更新失败' }, { status: 500 })
  }
}
