import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { buildFileStorageKey, createPresignedUrl } from '@/lib/server/r2'
import { validateMachinePhotoUploadRequest } from '@/lib/server/machinePhotoStore'

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

  const machine = await prisma.machineAsset.findUnique({
    where: { id: machineId },
    select: { id: true },
  })
  if (!machine) {
    return NextResponse.json({ error: '机械不存在' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as
    | { filename?: unknown; contentType?: unknown; size?: unknown }
    | null
  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  try {
    const { safeFilename, safeContentType } = validateMachinePhotoUploadRequest({
      filename: typeof body.filename === 'string' ? body.filename : String(body.filename ?? ''),
      contentType:
        typeof body.contentType === 'string' ? body.contentType : String(body.contentType ?? ''),
      size: typeof body.size === 'number' ? body.size : Number(body.size),
    })

    const storageKey = buildFileStorageKey('machine-photo', safeFilename)
    const uploadUrl = createPresignedUrl({
      method: 'PUT',
      storageKey,
      expiresInSeconds: 600,
    })

    return NextResponse.json({
      uploadUrl,
      storageKey,
      requiredHeaders: {
        'Content-Type': safeContentType,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
