import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createPresignedUrl, getR2Config } from '@/lib/server/r2'
import { SIGNATURE_ALLOWED_MIME_TYPES, SIGNATURE_MAX_SIZE } from '@/lib/server/signatureConfig'
import { prisma } from '@/lib/prisma'

const SIGNATURE_URL_TTL = 300

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }

  const canView = await hasPermission('signature:view')
  if (!canView) {
    return NextResponse.json({ error: '缺少签名查看权限' }, { status: 403 })
  }

  const signatures = await prisma.userSignature.findMany({
    where: { userId },
    include: {
      file: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  })

  const response = signatures.map((signature) => ({
    id: signature.id,
    version: signature.version,
    isActive: signature.isActive,
    createdAt: signature.createdAt.toISOString(),
    createdBy: signature.createdBy
      ? {
          id: signature.createdBy.id,
          name: signature.createdBy.name,
          username: signature.createdBy.username,
        }
      : null,
    file: {
      id: signature.file.id,
      originalName: signature.file.originalName,
      mimeType: signature.file.mimeType,
      size: signature.file.size,
      url: createPresignedUrl({
        method: 'GET',
        storageKey: signature.file.storageKey,
        expiresInSeconds: SIGNATURE_URL_TTL,
      }),
    },
  }))

  return NextResponse.json({ signatures: response })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const canUpload = await hasPermission('signature:upload')
  if (!canUpload) {
    return NextResponse.json({ error: '缺少签名上传权限' }, { status: 403 })
  }

  const body = await request.json()
  const { storageKey, originalName, mimeType, size } = body ?? {}
  const safeStorageKey = typeof storageKey === 'string' ? storageKey.trim() : ''
  const safeName = typeof originalName === 'string' ? originalName.trim() : ''
  const safeMimeType = typeof mimeType === 'string' ? mimeType.trim() : ''
  const parsedSize = typeof size === 'number' ? size : Number(size)

  if (!safeStorageKey || !safeName || !safeMimeType || !Number.isFinite(parsedSize)) {
    return NextResponse.json({ error: '签名文件信息不完整' }, { status: 400 })
  }
  if (!safeStorageKey.startsWith(`members/${userId}/signatures/`)) {
    return NextResponse.json({ error: '签名文件路径无效' }, { status: 400 })
  }
  if (!SIGNATURE_ALLOWED_MIME_TYPES.has(safeMimeType)) {
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

  const { bucket } = getR2Config()

  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.userSignature.aggregate({
      where: { userId },
      _max: { version: true },
    })
    const nextVersion = (latest._max.version ?? 0) + 1

    await tx.userSignature.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    })

    const file = await tx.fileAsset.create({
      data: {
        category: 'signature',
        storageKey: safeStorageKey,
        bucket,
        originalName: safeName,
        mimeType: safeMimeType,
        size: parsedSize,
        ownerUserId: userId,
        createdById: sessionUser.id,
      },
    })

    const signature = await tx.userSignature.create({
      data: {
        userId,
        fileId: file.id,
        version: nextVersion,
        isActive: true,
        createdById: sessionUser.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    })

    return { file, signature }
  })

  return NextResponse.json({
    signature: {
      id: result.signature.id,
      version: result.signature.version,
      isActive: result.signature.isActive,
      createdAt: result.signature.createdAt.toISOString(),
      createdBy: result.signature.createdBy
        ? {
            id: result.signature.createdBy.id,
            name: result.signature.createdBy.name,
            username: result.signature.createdBy.username,
          }
        : null,
      file: {
        id: result.file.id,
        originalName: result.file.originalName,
        mimeType: result.file.mimeType,
        size: result.file.size,
        url: createPresignedUrl({
          method: 'GET',
          storageKey: result.file.storageKey,
          expiresInSeconds: SIGNATURE_URL_TTL,
        }),
      },
    },
  })
}
