import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { listLeaderUsers } from '@/lib/server/leaderLogStore'
import { listLeaderLogPrompts, upsertLeaderLogPrompt } from '@/lib/server/logExtractionStore'

const canView = async () => (await hasPermission('report:view')) || (await hasPermission('report:edit'))
const canViewAll = async () =>
  (await hasPermission('leader-log:view-all')) || (await hasPermission('leader-log:edit-all'))
const canEditAll = async () => await hasPermission('leader-log:edit-all')

export async function GET() {
  if (!(await canView())) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再查看提示词' }, { status: 401 })
  }

  const leaders = await listLeaderUsers()
  const allowAll = await canViewAll()
  const visibleLeaders = allowAll
    ? leaders
    : leaders.filter((leader) => leader.id === sessionUser.id)

  const prompts = await listLeaderLogPrompts(visibleLeaders.map((leader) => leader.id))

  return NextResponse.json({
    leaders: visibleLeaders,
    prompts: prompts.map((prompt) => ({
      supervisorId: prompt.supervisorId,
      promptText: prompt.promptText,
      updatedAt: prompt.updatedAt.toISOString(),
      updatedById: prompt.updatedById,
    })),
  })
}

export async function PUT(request: Request) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日报编辑权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再更新提示词' }, { status: 401 })
  }

  let payload: { supervisorId?: unknown; promptText?: unknown }
  try {
    payload = (await request.json()) as { supervisorId?: unknown; promptText?: unknown }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const supervisorId = Number(payload.supervisorId)
  if (!Number.isFinite(supervisorId) || supervisorId <= 0) {
    return NextResponse.json({ message: '负责人无效' }, { status: 400 })
  }

  const allowAll = await canEditAll()
  if (!allowAll && supervisorId !== sessionUser.id) {
    return NextResponse.json({ message: '只能编辑自己的提示词' }, { status: 403 })
  }

  const promptText = typeof payload.promptText === 'string' ? payload.promptText : ''

  const record = await upsertLeaderLogPrompt({
    supervisorId,
    promptText,
    userId: sessionUser.id,
  })

  return NextResponse.json({
    supervisorId: record.supervisorId,
    promptText: record.promptText,
    updatedAt: record.updatedAt.toISOString(),
    updatedById: record.updatedById,
  })
}
