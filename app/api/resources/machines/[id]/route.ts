import { NextResponse, type NextRequest } from 'next/server'

import { Prisma } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateMachineAsset } from '@/lib/server/machineStore'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const machineId = Number(id)
  if (!Number.isFinite(machineId) || machineId <= 0) {
    return NextResponse.json({ error: '缺少机械 ID' }, { status: 400 })
  }

  const [canUpdate, canManage] = await Promise.all([
    hasPermission('machine:update'),
    hasPermission('machine:manage'),
  ])
  if (!canUpdate && !canManage) {
    return NextResponse.json({ error: '缺少机械更新权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  try {
    const machine = await updateMachineAsset(machineId, body, {
      updatedById: session.id,
      allowManageFields: canManage,
    })
    return NextResponse.json({ machine })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '机械不存在' }, { status: 404 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

