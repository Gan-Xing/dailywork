import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { createPresignedUrl, deleteObject } from '@/lib/server/r2'
import { prisma } from '@/lib/prisma'

const SIGNATURE_URL_TTL = 300

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string; signatureId: string }> }) {
  const { id, signatureId } = await params
  const userId = Number(id)
  const sigId = Number(signatureId)
  if (!userId || !sigId) {
    return NextResponse.json({ error: '缺少签名 ID' }, { status: 400 })
  }

  const canUpload = await hasPermission('signature:upload')
  if (!canUpload) {
    return NextResponse.json({ error: '缺少签名上传权限' }, { status: 403 })
  }

  const signature = await prisma.userSignature.findUnique({
    where: { id: sigId },
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
  })
  if (!signature || signature.userId !== userId) {
    return NextResponse.json({ error: '签名不存在' }, { status: 404 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.userSignature.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    })
    return tx.userSignature.update({
      where: { id: sigId },
      data: { isActive: true },
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
    })
  })

  return NextResponse.json({
    signature: {
      id: updated.id,
      version: updated.version,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      createdBy: updated.createdBy
        ? {
            id: updated.createdBy.id,
            name: updated.createdBy.name,
            username: updated.createdBy.username,
          }
        : null,
      file: {
        id: updated.file.id,
        originalName: updated.file.originalName,
        mimeType: updated.file.mimeType,
        size: updated.file.size,
        previewUrl: updated.file.previewStorageKey
          ? createPresignedUrl({
              method: 'GET',
              storageKey: updated.file.previewStorageKey,
              expiresInSeconds: SIGNATURE_URL_TTL,
            })
          : null,
        url: createPresignedUrl({
          method: 'GET',
          storageKey: updated.file.storageKey,
          expiresInSeconds: SIGNATURE_URL_TTL,
        }),
      },
    },
  })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; signatureId: string }> }) {
  const { id, signatureId } = await params
  const userId = Number(id)
  const sigId = Number(signatureId)
  if (!userId || !sigId) {
    return NextResponse.json({ error: '缺少签名 ID' }, { status: 400 })
  }

  const canDelete = await hasPermission('signature:delete')
  if (!canDelete) {
    return NextResponse.json({ error: '缺少签名删除权限' }, { status: 403 })
  }

  const signature = await prisma.userSignature.findUnique({
    where: { id: sigId },
    include: {
      file: true,
    },
  })
  if (!signature || signature.userId !== userId) {
    return NextResponse.json({ error: '签名不存在' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSignature.delete({ where: { id: sigId } })
    await tx.fileAsset.delete({ where: { id: signature.fileId } })
    if (signature.isActive) {
      const fallback = await tx.userSignature.findFirst({
        where: { userId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      })
      if (fallback) {
        await tx.userSignature.update({
          where: { id: fallback.id },
          data: { isActive: true },
        })
      }
    }
  })

  try {
    await deleteObject(signature.file.storageKey)
    if (signature.file.previewStorageKey) {
      await deleteObject(signature.file.previewStorageKey)
    }
  } catch (error) {
    console.error('[Signature Delete] R2 cleanup failed', error)
  }

  return NextResponse.json({ ok: true })
}
