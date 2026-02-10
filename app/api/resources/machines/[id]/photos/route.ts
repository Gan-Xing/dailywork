import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createMachinePhoto, listMachinePhotos } from '@/lib/server/machinePhotoStore'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const machineId = Number(id)
  if (!Number.isFinite(machineId) || machineId <= 0) {
    return NextResponse.json({ error: '缺少机械 ID' }, { status: 400 })
  }

  if (!(await hasPermission('machine:view'))) {
    return NextResponse.json({ error: '缺少机械查看权限' }, { status: 403 })
  }

  try {
    const photos = await listMachinePhotos(machineId)
    return NextResponse.json({ photos })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = (await request.json().catch(() => null)) as
    | { storageKey?: unknown; originalName?: unknown; mimeType?: unknown; size?: unknown }
    | null
  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const storageKey = typeof body.storageKey === 'string' ? body.storageKey.trim() : ''
  const originalName = typeof body.originalName === 'string' ? body.originalName.trim() : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : ''
  const parsedSize = typeof body.size === 'number' ? body.size : Number(body.size)

  try {
    const photo = await createMachinePhoto(
      machineId,
      {
        storageKey,
        originalName,
        mimeType,
        size: parsedSize,
      },
      { createdById: session.id },
    )
    return NextResponse.json({ photo }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

