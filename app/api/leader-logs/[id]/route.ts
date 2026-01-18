import { NextResponse, type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { deleteLeaderLog, getLeaderLogById, hasLeaderLogPhotos, updateLeaderLog } from '@/lib/server/leaderLogStore'

const canEditAllLeaderLogs = async () => await hasPermission('leader-log:edit-all')

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日志编辑权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再更新日志' }, { status: 401 })
  }

  const { id } = await context.params
  const logId = Number(id)
  if (!Number.isFinite(logId)) {
    return NextResponse.json({ message: '日志编号无效' }, { status: 400 })
  }

  let payload: { contentRaw?: unknown }
  try {
    payload = (await request.json()) as { contentRaw?: unknown }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const contentRaw =
    typeof payload.contentRaw === 'string' ? payload.contentRaw.trim() : ''

  const log = await getLeaderLogById(logId)
  if (!log) {
    return NextResponse.json({ message: '日志不存在' }, { status: 404 })
  }

  const canEditAll = await canEditAllLeaderLogs()
  if (!canEditAll && log.supervisorId !== sessionUser.id) {
    return NextResponse.json({ message: '只能编辑自己的日志' }, { status: 403 })
  }

  try {
    if (!contentRaw) {
      const hasPhotos = await hasLeaderLogPhotos(logId)
      if (!hasPhotos) {
        await deleteLeaderLog({ id: logId })
        return NextResponse.json({ deleted: true })
      }
    }
    const updated = await updateLeaderLog({
      id: logId,
      contentRaw,
      userId: sessionUser.id,
    })
    return NextResponse.json({ log: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: '日志不存在' }, { status: 404 })
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '更新日志失败' },
      { status: 500 },
    )
  }
}
