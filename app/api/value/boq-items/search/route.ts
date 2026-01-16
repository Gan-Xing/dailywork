import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const toLimit = (value: string | null) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return NextResponse.json({ message: '缺少产值查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = search ? toLimit(searchParams.get('limit')) : null

  const items = await prisma.boqItem.findMany({
    where: {
      sheetType: 'ACTUAL',
      tone: 'ITEM',
      isActive: true,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { designationZh: { contains: search, mode: 'insensitive' } },
              { designationFr: { contains: search, mode: 'insensitive' } },
              { project: { name: { contains: search, mode: 'insensitive' } } },
              { project: { code: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { code: 'asc' }, { id: 'asc' }],
    ...(limit ? { take: limit } : {}),
  })

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      code: item.code,
      designationZh: item.designationZh,
      designationFr: item.designationFr,
      unit: item.unit,
      projectId: item.projectId,
      project: item.project,
    })),
  })
}
