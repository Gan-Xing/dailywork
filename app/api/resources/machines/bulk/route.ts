import { NextResponse, type NextRequest } from 'next/server'

import { Prisma } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateMachineAsset } from '@/lib/server/machineStore'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Missing bulk update payload' }, { status: 400 })
  }

  const results: Array<{ id: number; ok: boolean; error?: string }> = []

  for (const item of items) {
    const machineId = Number(item?.id)
    if (!Number.isFinite(machineId) || machineId <= 0) {
      results.push({ id: machineId || 0, ok: false, error: 'Missing machine ID' })
      continue
    }
    const patch = isRecord(item?.patch) ? item.patch : null
    if (!patch) {
      results.push({ id: machineId, ok: false, error: 'Missing update payload' })
      continue
    }

    try {
      await updateMachineAsset(machineId, patch, {
        updatedById: session.id,
        allowManageFields: canManage,
      })
      results.push({ id: machineId, ok: true })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        results.push({ id: machineId, ok: false, error: '机械不存在' })
      } else {
        results.push({ id: machineId, ok: false, error: (error as Error).message })
      }
    }
  }

  return NextResponse.json({ results })
}

