import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

const allowedStatuses = new Set(['PENDING', 'DONE'])

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再更新路线' }, { status: 401 })
  }
  if (!user.permissions.includes('roadmap:update')) {
    return NextResponse.json({ message: '缺少开发路线编辑权限' }, { status: 403 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ message: '无效的路线 ID' }, { status: 400 })
  }

  let payload: { status?: unknown; details?: unknown }
  try {
    payload = (await request.json()) as { status?: unknown; details?: unknown }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const updates: {
    status?: 'PENDING' | 'DONE'
    details?: string | null
    completedAt?: Date | null
    updatedById?: number
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
