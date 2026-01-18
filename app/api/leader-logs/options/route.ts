import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

const parseLimit = (value: string | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

const formatDateKey = (value: Date) => value.toISOString().split('T')[0]

export async function GET(request: Request) {
  if (!(await hasPermission('report:view')) && !(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日志查看权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再查看日志' }, { status: 401 })
  }

  const canViewAll =
    (await hasPermission('leader-log:view-all')) || (await hasPermission('leader-log:edit-all'))

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = parseLimit(searchParams.get('limit'))

  const where: Record<string, unknown> = {}
  if (!canViewAll) {
    where.supervisorId = sessionUser.id
  }

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(search) ? search : ''
  if (dateMatch) {
    const start = new Date(`${dateMatch}T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 1)
    where.logDate = { gte: start, lt: end }
  } else if (search) {
    where.OR = [
      { supervisorName: { contains: search, mode: 'insensitive' } },
      { contentRaw: { contains: search, mode: 'insensitive' } },
    ]
  }

  const logs = await prisma.leaderDailyLog.findMany({
    where,
    orderBy: [{ logDate: 'desc' }, { supervisorName: 'asc' }],
    take: limit,
    select: {
      id: true,
      logDate: true,
      supervisorId: true,
      supervisorName: true,
    },
  })

  return NextResponse.json({
    items: logs.map((log) => ({
      id: log.id,
      date: formatDateKey(log.logDate),
      supervisorId: log.supervisorId,
      supervisorName: log.supervisorName,
    })),
  })
}
