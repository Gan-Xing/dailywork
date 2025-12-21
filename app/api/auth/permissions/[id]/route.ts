import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUSES = new Set(['ACTIVE', 'ARCHIVED'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const permissionId = Number(id)
  if (!Number.isInteger(permissionId) || permissionId <= 0) {
    return NextResponse.json({ error: '无效的权限 ID' }, { status: 400 })
  }
  if (!(await hasPermission('permission:update'))) {
    return NextResponse.json({ error: '缺少权限更新权限' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const status = typeof body.status === 'string' ? body.status : ''
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: '无效的权限状态' }, { status: 400 })
  }

  try {
    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: { status },
      select: { id: true, code: true, name: true, status: true },
    })
    return NextResponse.json({ permission })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '权限不存在' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新权限失败' },
      { status: 500 },
    )
  }
}
