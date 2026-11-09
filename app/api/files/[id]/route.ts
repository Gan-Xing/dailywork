import { NextResponse, type NextRequest } from 'next/server'

import type { Prisma } from '@prisma/client'

import { FILE_CATEGORIES, type FileCategory } from '@/lib/constants/fileCategories'
import { mutableFileLinkReplacements, ReservedFileLinkError, SIGNED_BILL_FILE_LINK_ENTITY } from '@/lib/files/reservedFileLinks'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createPresignedUrl, deleteObject } from '@/lib/server/r2'
import { isAiChatArtifact } from '@/lib/files/aiChatArtifacts'

const FILE_URL_TTL = 300

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fileId = Number(id)
  if (!fileId) {
    return NextResponse.json({ message: '缺少文件 ID' }, { status: 400 })
  }

  const [canView, canManage] = await Promise.all([
    hasPermission('file:view'),
    hasPermission('file:manage'),
  ])
  if (!canView && !canManage) {
    return NextResponse.json({ message: '缺少文件查看权限' }, { status: 403 })
  }

  const includeUrl = ['1', 'true'].includes(request.nextUrl.searchParams.get('includeUrl') ?? '')

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    include: {
      createdBy: { select: { id: true, name: true, username: true } },
      ownerUser: { select: { id: true, name: true, username: true } },
      links: {
        select: {
          id: true,
          entityType: true,
          entityId: true,
          purpose: true,
          label: true,
          meta: true,
          createdAt: true,
        },
        orderBy: { id: 'desc' },
      },
      _count: { select: { links: true, signatures: true } },
    },
  })

  if (!file || isAiChatArtifact(file.storageKey)) {
    return NextResponse.json({ message: '文件不存在' }, { status: 404 })
  }

  return NextResponse.json({
    file: {
      id: file.id,
      category: file.category,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      bucket: file.bucket,
      storageKey: file.storageKey,
      previewStorageKey: file.previewStorageKey ?? null,
      previewMimeType: file.previewMimeType ?? null,
      previewSize: file.previewSize ?? null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      createdBy: file.createdBy,
      ownerUser: file.ownerUser,
      links: file.links.map((link) => ({
        id: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        purpose: link.purpose,
        label: link.label,
        meta: link.meta,
        createdAt: link.createdAt.toISOString(),
      })),
      counts: file._count,
      url: includeUrl
        ? createPresignedUrl({
            method: 'GET',
            storageKey: file.storageKey,
            expiresInSeconds: FILE_URL_TTL,
          })
        : null,
      previewUrl:
        includeUrl && file.previewStorageKey
          ? createPresignedUrl({
              method: 'GET',
              storageKey: file.previewStorageKey,
              expiresInSeconds: FILE_URL_TTL,
            })
          : null,
    },
  })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fileId = Number(id)
  if (!fileId) {
    return NextResponse.json({ message: '缺少文件 ID' }, { status: 400 })
  }

  const [canDelete, canManage] = await Promise.all([
    hasPermission('file:delete'),
    hasPermission('file:manage'),
  ])
  if (!canDelete && !canManage) {
    return NextResponse.json({ message: '缺少文件删除权限' }, { status: 403 })
  }

  const result = await prisma.$transaction(async (tx) => {
    // FK inserts take KEY SHARE on this row. Hold UPDATE through the reference
    // recheck and deletion so an archive cannot commit dangling JSON evidence.
    await tx.$queryRaw`SELECT "id" FROM "FileAsset" WHERE "id" = ${fileId} FOR UPDATE`
    const file = await tx.fileAsset.findUnique({
      where: { id: fileId },
      include: {
        _count: { select: { links: true, signatures: true } },
      },
    })

    if (!file || isAiChatArtifact(file.storageKey)) {
      return { message: '文件不存在', status: 404 }
    }

    // Keep JSON evidence even if its generic link was relabelled or removed.
    const archivedBill = await tx.boqBillRevision.findFirst({
      where: {
        OR: [
          { signedPdfFileId: fileId },
          { calculationFileId: fileId },
          { sourceJson: { path: ['files'], array_contains: [{ fileId }] } },
        ],
      },
      select: { id: true },
    })
    if (archivedBill) {
      return { message: '文件已作为不可变账单原件或证据归档，无法删除', status: 409 }
    }

    if (file._count.links > 0 || file._count.signatures > 0) {
      return { message: '文件已被引用，无法删除', status: 409 }
    }

    await tx.fileAsset.delete({ where: { id: fileId } })
    return { file }
  }, { isolationLevel: 'ReadCommitted' })

  if ('message' in result) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  const { file } = result

  try {
    await deleteObject(file.storageKey)
    if (file.previewStorageKey) {
      await deleteObject(file.previewStorageKey)
    }
  } catch (error) {
    console.error('[FileAsset Delete] R2 cleanup failed', error)
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fileId = Number(id)
  if (!fileId) {
    return NextResponse.json({ message: '缺少文件 ID' }, { status: 400 })
  }

  const [canUpdate, canManage] = await Promise.all([
    hasPermission('file:update'),
    hasPermission('file:manage'),
  ])
  if (!canUpdate && !canManage) {
    return NextResponse.json({ message: '缺少文件更新权限' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    originalName?: string
    category?: string
    links?: Array<{ entityType: string; entityId: string; purpose?: string; label?: string; meta?: unknown }>
  }
  const originalName = body.originalName?.trim()
  const category = typeof body.category === 'string' ? body.category.trim() : undefined

  if (!originalName) {
    return NextResponse.json({ message: '文件名不能为空' }, { status: 400 })
  }
  if (category !== undefined) {
    if (!category) {
      return NextResponse.json({ message: '文件分类不能为空' }, { status: 400 })
    }
    if (!FILE_CATEGORIES.includes(category as FileCategory)) {
      return NextResponse.json({ message: '文件分类无效' }, { status: 400 })
    }
  }

  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } })
  if (!file || isAiChatArtifact(file.storageKey)) {
    return NextResponse.json({ message: '文件不存在' }, { status: 404 })
  }

  const sessionUser = await getSessionUser()
  const userId = sessionUser?.id

  const result = await prisma.$transaction(async (tx) => {
    const existingReserved = Array.isArray(body.links)
      ? await tx.fileAssetLink.findMany({ where: { fileId, entityType: SIGNED_BILL_FILE_LINK_ENTITY } })
      : []
    const mutableLinks = Array.isArray(body.links) ? mutableFileLinkReplacements(body.links, existingReserved) : null
    const updatedFile = await tx.fileAsset.update({
      where: { id: fileId },
      data: {
        originalName,
        ...(category ? { category } : {}),
      },
    })

    let currentLinks = []

    if (mutableLinks) {
      // Keep archived revision evidence and calculation manifests in their original rows.
      await tx.fileAssetLink.deleteMany({ where: { fileId, entityType: { not: SIGNED_BILL_FILE_LINK_ENTITY } } })

      const newLinks = mutableLinks
        .map((link) => {
          const eType = link.entityType?.trim()
          const eId = link.entityId?.trim()
          if (!eType || !eId) return null
          const meta = link.meta === null || link.meta === undefined ? undefined : (link.meta as Prisma.InputJsonValue)
          return {
            fileId,
            entityType: eType,
            entityId: eId,
            purpose: link.purpose?.trim() || null,
            label: link.label?.trim() || null,
            meta,
            createdById: userId,
          }
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)

      if (newLinks.length > 0) {
        await tx.fileAssetLink.createMany({ data: newLinks })
      }
    }

    currentLinks = await tx.fileAssetLink.findMany({
      where: { fileId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        purpose: true,
        label: true,
        meta: true,
        createdAt: true,
      },
    })

    return { file: updatedFile, links: currentLinks }
  }).catch((error: unknown) => {
    if (error instanceof ReservedFileLinkError) return error
    throw error
  })

  if (result instanceof ReservedFileLinkError) {
    return NextResponse.json({ message: result.message }, { status: 409 })
  }

  return NextResponse.json({
    file: {
      id: result.file.id,
      originalName: result.file.originalName,
      links: result.links.map((link) => ({
        id: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        purpose: link.purpose,
        label: link.label,
        meta: link.meta,
        createdAt: link.createdAt.toISOString(),
      })),
    },
  })
}
