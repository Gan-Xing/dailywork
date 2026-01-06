import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { buildSignatureStorageKey, createPresignedUrl } from '@/lib/server/r2'
import { SIGNATURE_ALLOWED_MIME_TYPES, SIGNATURE_MAX_SIZE } from '@/lib/server/signatureConfig'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }

  const canUpload = await hasPermission('signature:upload')
  if (!canUpload) {
    return NextResponse.json({ error: '缺少签名上传权限' }, { status: 403 })
  }

  const body = await request.json()
  const { filename, contentType, size } = body ?? {}
  const safeFilename = typeof filename === 'string' ? filename.trim() : ''
  const safeContentType = typeof contentType === 'string' ? contentType.trim() : ''
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeFilename || !safeContentType || !Number.isFinite(parsedSize)) {
    return NextResponse.json({ error: '签名文件信息不完整' }, { status: 400 })
  }
  if (!SIGNATURE_ALLOWED_MIME_TYPES.has(safeContentType)) {
    return NextResponse.json({ error: '签名文件类型不支持' }, { status: 400 })
  }
  if (parsedSize > SIGNATURE_MAX_SIZE) {
    return NextResponse.json({ error: '签名文件过大' }, { status: 400 })
  }

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!member) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  }

  const storageKey = buildSignatureStorageKey(userId, safeFilename)
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
}
