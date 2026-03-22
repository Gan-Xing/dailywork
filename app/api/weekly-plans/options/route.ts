import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

type OptionField =
  | 'supplier'
  | 'goodsName'
  | 'unit'
  | 'transporter'
  | 'headPlateNumber'
  | 'tailPlateNumber'
  | 'phone'

const normalizeOptionValue = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().replace(/\s+/g, ' ') ?? ''
  return trimmed ? trimmed : null
}

const collectOptions = <
  T extends Record<OptionField, string | null>,
>(
  records: T[],
  field: OptionField,
): string[] => {
  const seen = new Set<string>()
  const values: string[] = []

  for (const record of records) {
    const normalized = normalizeOptionValue(record[field])
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    values.push(normalized)
  }

  return values
}

export async function GET(req: Request) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectIds = Array.from(
    new Set(
      searchParams
        .getAll('projectId')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  )

  try {
    const records = await prisma.weeklyDeliveryPlanItem.findMany({
      where: projectIds.length
        ? {
            plan: {
              OR: [
                { projectId: { in: projectIds } },
                { projects: { some: { projectId: { in: projectIds } } } },
              ],
            },
          }
        : undefined,
      select: {
        supplier: true,
        goodsName: true,
        unit: true,
        transporter: true,
        headPlateNumber: true,
        tailPlateNumber: true,
        phone: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 500,
    })

    return NextResponse.json({
      options: {
        supplier: collectOptions(records, 'supplier'),
        goodsName: collectOptions(records, 'goodsName'),
        unit: collectOptions(records, 'unit'),
        transporter: collectOptions(records, 'transporter'),
        headPlateNumber: collectOptions(records, 'headPlateNumber'),
        tailPlateNumber: collectOptions(records, 'tailPlateNumber'),
        phone: collectOptions(records, 'phone'),
      },
    })
  } catch (error) {
    console.error('[weekly-plans/options GET]', error)
    return NextResponse.json({ message: '查询失败' }, { status: 500 })
  }
}
