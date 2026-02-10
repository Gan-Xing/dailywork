import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { deleteMachinePhoto } from '@/lib/server/machinePhotoStore'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params
  const machineId = Number(id)
  const photoId = Number(fileId)
  if (!Number.isFinite(machineId) || machineId <= 0) {
    return NextResponse.json({ error: '缺少机械 ID' }, { status: 400 })
  }
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: '缺少图片 ID' }, { status: 400 })
  }

  const [canUpdate, canManage] = await Promise.all([
    hasPermission('machine:update'),
    hasPermission('machine:manage'),
  ])
  if (!canUpdate && !canManage) {
    return NextResponse.json({ error: '缺少机械更新权限' }, { status: 403 })
  }

  try {
    await deleteMachinePhoto(machineId, photoId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

