import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  createLeaderLog,
  listLeaderLogDatesForMonth,
  listLeaderLogsForDate,
  listRecentLeaderLogs,
} from '@/lib/server/leaderLogStore'

const canViewLeaderLogs = async () =>
  (await hasPermission('report:view')) || (await hasPermission('report:edit'))

const isAdminUser = (user: { roles?: { name: string }[] }) =>
  user.roles?.some((role) => role.name === 'Admin') ?? false

export async function GET(request: Request) {
  if (!(await canViewLeaderLogs())) {
    return NextResponse.json({ message: '缺少日志查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const month = searchParams.get('month')
  const limitParam = searchParams.get('limit')

  try {
    if (date) {
      const logs = await listLeaderLogsForDate(date)
      return NextResponse.json({ logs })
    }
    if (month) {
      const dates = await listLeaderLogDatesForMonth(month)
      return NextResponse.json({ dates })
    }
    if (limitParam) {
      const limit = Number(limitParam)
      const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 5
      const logs = await listRecentLeaderLogs(effectiveLimit)
      return NextResponse.json({ logs })
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '加载日志失败' },
      { status: 400 },
    )
  }

  return NextResponse.json({ message: '缺少查询参数' }, { status: 400 })
}

export async function POST(request: Request) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日志编辑权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再提交日志' }, { status: 401 })
  }

  let payload: { logDate?: unknown; supervisorId?: unknown; contentRaw?: unknown }
  try {
    payload = (await request.json()) as {
      logDate?: unknown
      supervisorId?: unknown
      contentRaw?: unknown
    }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const logDate = typeof payload.logDate === 'string' ? payload.logDate.trim() : ''
  const contentRaw =
    typeof payload.contentRaw === 'string' ? payload.contentRaw.trim() : ''
  const supervisorIdInput = Number(payload.supervisorId)

  if (!logDate) {
    return NextResponse.json({ message: '日志日期必填' }, { status: 400 })
  }
  if (!contentRaw) {
    return NextResponse.json({ message: '日志内容必填' }, { status: 400 })
  }

  const isAdmin = isAdminUser(sessionUser)
  if (!isAdmin && payload.supervisorId && supervisorIdInput !== sessionUser.id) {
    return NextResponse.json({ message: '只能提交自己的日志' }, { status: 403 })
  }
  if (isAdmin && !Number.isFinite(supervisorIdInput)) {
    return NextResponse.json({ message: '负责人必填' }, { status: 400 })
  }

  const supervisorId = isAdmin ? supervisorIdInput : sessionUser.id

  try {
    const log = await createLeaderLog({
      dateKey: logDate,
      supervisorId,
      contentRaw,
      userId: sessionUser.id,
    })
    return NextResponse.json({ log }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: '该负责人当日日志已存在' }, { status: 409 })
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '创建日志失败' },
      { status: 500 },
    )
  }
}
