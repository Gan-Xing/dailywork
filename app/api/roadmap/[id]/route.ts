import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

const allowedStatuses = new Set(['PENDING', 'DONE'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再更新路线' }, { status: 401 })
  }
  if (!user.permissions.includes('roadmap:update')) {
    return NextResponse.json({ message: '缺少开发路线编辑权限' }, { status: 403 })
  }

  const id = Number(idParam)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ message: '无效的路线 ID' }, { status: 400 })
  }

  let payload: {
    status?: unknown
    details?: unknown
    priority?: unknown
    importance?: unknown
    difficulty?: unknown
    title?: unknown
  }
  try {
    payload = (await request.json()) as {
      status?: unknown
      details?: unknown
      priority?: unknown
      importance?: unknown
      difficulty?: unknown
      title?: unknown
    }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const updates: {
    status?: 'PENDING' | 'DONE'
    details?: string | null
    completedAt?: Date | null
    updatedById?: number
    priority?: number
    importance?: number
    difficulty?: number
    title?: string
  } = {}

  if (payload.status !== undefined) {
    if (typeof payload.status !== 'string' || !allowedStatuses.has(payload.status)) {
      return NextResponse.json({ message: '状态值不合法' }, { status: 400 })
    }
    updates.status = payload.status as 'PENDING' | 'DONE'
    updates.completedAt = updates.status === 'DONE' ? new Date() : null
  }

  if (payload.details !== undefined) {
    const details =
      typeof payload.details === 'string' ? payload.details.trim() : null
    updates.details = details || null
  }

  if (payload.title !== undefined) {
    const title =
      typeof payload.title === 'string' ? payload.title.trim() : ''
    if (!title) {
      return NextResponse.json({ message: '标题不能为空' }, { status: 400 })
    }
    updates.title = title
  }

  const validateScore = (value: unknown) => {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null
  }

  if (payload.priority !== undefined) {
    const parsed = validateScore(payload.priority)
    if (parsed === null) {
      return NextResponse.json({ message: '优先级需为 1-5 的整数' }, { status: 400 })
    }
    updates.priority = parsed
  }

  if (payload.importance !== undefined) {
    const parsed = validateScore(payload.importance)
    if (parsed === null) {
      return NextResponse.json({ message: '重要度需为 1-5 的整数' }, { status: 400 })
    }
    updates.importance = parsed
  }

  if (payload.difficulty !== undefined) {
    const parsed = validateScore(payload.difficulty)
    if (parsed === null) {
      return NextResponse.json({ message: '难度需为 1-5 的整数' }, { status: 400 })
    }
    updates.difficulty = parsed
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ message: '没有可更新的字段' }, { status: 400 })
  }

  updates.updatedById = user.id

  try {
    const item = await prisma.roadmapIdea.update({
      where: { id },
      data: updates,
    })
    return NextResponse.json({ item })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ message: '未找到对应的路线记录' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再删除路线' }, { status: 401 })
  }
  if (!user.permissions.includes('roadmap:delete')) {
    return NextResponse.json({ message: '缺少开发路线删除权限' }, { status: 403 })
  }

  const id = Number(idParam)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ message: '无效的路线 ID' }, { status: 400 })
  }

  try {
    const existing = await prisma.roadmapIdea.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ message: '未找到对应的路线记录' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '仅待开发的路线可删除' }, { status: 400 })
    }

    await prisma.roadmapIdea.delete({ where: { id } })
    return NextResponse.json({ item: existing })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
