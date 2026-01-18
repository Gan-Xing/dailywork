import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const normalizeList = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

export async function GET(request: NextRequest) {
  const [canView, canManage] = await Promise.all([
    hasPermission('file:view'),
    hasPermission('file:manage'),
  ])
  if (!canView && !canManage) {
    return NextResponse.json({ message: '缺少文件查看权限' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const entityTypes = normalizeList(searchParams.get('entityType'))

  const where: { purpose: { not: null }; entityType?: { in: string[] } } = {
    purpose: { not: null },
  }
  if (entityTypes.length) {
    where.entityType = { in: entityTypes }
  }

  const items = await prisma.fileAssetLink.findMany({
    where,
    distinct: ['purpose'],
    select: { purpose: true },
    orderBy: { purpose: 'asc' },
  })

  const purposes = Array.from(
    new Set(items.map((item) => item.purpose?.trim() ?? '').filter(Boolean)),
  )

  return NextResponse.json({ purposes })
}
