import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { FILE_CATEGORIES } from '@/lib/constants/fileCategories'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getR2Config } from '@/lib/server/r2'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const normalizeList = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

export async function GET(request: NextRequest) {
  const [canView, canManage] = await Promise.all([
    hasPermission('file:view'),
    hasPermission('file:manage'),
  ])
  if (!canView && !canManage) {
    return NextResponse.json({ message: '缺少文件查看权限' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() ?? ''
  const categoryParam = searchParams.get('category')
  const categories = normalizeList(categoryParam).filter((item) =>
    FILE_CATEGORIES.includes(item as (typeof FILE_CATEGORIES)[number]),
  )
  const entityTypes = normalizeList(searchParams.get('entityType'))
  const entityIds = normalizeList(searchParams.get('entityId'))
  const createdFrom = searchParams.get('createdFrom')?.trim() ?? ''
  const createdTo = searchParams.get('createdTo')?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  )

  const where: any = {}
  if (categories.length) {
    where.category = { in: categories }
  }
  if (entityTypes.length || entityIds.length) {
    where.links = {
      some: {
        ...(entityTypes.length ? { entityType: { in: entityTypes } } : null),
        ...(entityIds.length ? { entityId: { in: entityIds } } : null),
      },
    }
  }
  if (createdFrom || createdTo) {
    where.createdAt = {}
    if (createdFrom) where.createdAt.gte = new Date(createdFrom)
    if (createdTo) where.createdAt.lte = new Date(createdTo)
  }
  if (search) {
    where.OR = [
      { originalName: { contains: search, mode: 'insensitive' } },
      { storageKey: { contains: search, mode: 'insensitive' } },
      { createdBy: { username: { contains: search, mode: 'insensitive' } } },
      { createdBy: { name: { contains: search, mode: 'insensitive' } } },
      { ownerUser: { username: { contains: search, mode: 'insensitive' } } },
      { ownerUser: { name: { contains: search, mode: 'insensitive' } } },
      { links: { some: { label: { contains: search, mode: 'insensitive' } } } },
      { links: { some: { entityId: { contains: search, mode: 'insensitive' } } } },
      { links: { some: { entityType: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const [total, items] = await prisma.$transaction([
    prisma.fileAsset.count({ where }),
    prisma.fileAsset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
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
          },
          orderBy: { id: 'desc' },
        },
        _count: { select: { links: true, signatures: true } },
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rows = items.map((item) => ({
    id: item.id,
    category: item.category,
    originalName: item.originalName,
    mimeType: item.mimeType,
    size: item.size,
    bucket: item.bucket,
    storageKey: item.storageKey,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: item.createdBy,
    ownerUser: item.ownerUser,
    links: item.links,
    counts: item._count,
  }))

  return NextResponse.json({
    items: rows,
    total,
    page,
    pageSize,
    totalPages,
  })
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再上传' }, { status: 401 })
  }

  const [canUpload, canManage] = await Promise.all([
    hasPermission('file:upload'),
    hasPermission('file:manage'),
  ])
  if (!canUpload && !canManage) {
    return NextResponse.json({ message: '缺少文件上传权限' }, { status: 403 })
  }

  let payload: {
    storageKey?: unknown
    originalName?: unknown
    mimeType?: unknown
    size?: unknown
    category?: unknown
    ownerUserId?: unknown
    checksum?: unknown
    links?: unknown
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const storageKey = typeof payload.storageKey === 'string' ? payload.storageKey.trim() : ''
  const originalName = typeof payload.originalName === 'string' ? payload.originalName.trim() : ''
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.trim() : ''
  const category = typeof payload.category === 'string' ? payload.category.trim() : ''
  const checksum = typeof payload.checksum === 'string' ? payload.checksum.trim() : ''
  const parsedSize = typeof payload.size === 'number' ? payload.size : Number(payload.size)
  const ownerUserId = typeof payload.ownerUserId === 'number'
    ? payload.ownerUserId
    : Number(payload.ownerUserId)

  if (!storageKey || !originalName || !mimeType || !category || !Number.isFinite(parsedSize)) {
    return NextResponse.json({ message: '文件信息不完整' }, { status: 400 })
  }
  if (!FILE_CATEGORIES.includes(category as (typeof FILE_CATEGORIES)[number])) {
    return NextResponse.json({ message: '文件分类不支持' }, { status: 400 })
  }
  if (!storageKey.startsWith(`files/${category}/`)) {
    return NextResponse.json({ message: '文件存储路径无效' }, { status: 400 })
  }

  const linksInput = Array.isArray(payload.links) ? payload.links : []
  const normalizedLinks = linksInput.map((link) => {
    if (!link || typeof link !== 'object') return null
    const record = link as Record<string, unknown>
    const entityType = typeof record.entityType === 'string' ? record.entityType.trim() : ''
    const entityId =
      typeof record.entityId === 'string'
        ? record.entityId.trim()
        : typeof record.entityId === 'number'
          ? String(record.entityId)
          : ''
    const purpose = typeof record.purpose === 'string' ? record.purpose.trim() : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    const meta = record.meta ?? null
    if (!entityType || !entityId) return null
    return {
      entityType,
      entityId,
      purpose: purpose || null,
      label: label || null,
      meta,
    }
  })

  if (normalizedLinks.some((item) => item === null)) {
    return NextResponse.json({ message: '关联信息不完整' }, { status: 400 })
  }

  const validLinks = normalizedLinks as Exclude<(typeof normalizedLinks)[number], null>[]

  const { bucket } = getR2Config()

  const result = await prisma.$transaction(async (tx) => {
    const file = await tx.fileAsset.create({
      data: {
        category,
        storageKey,
        bucket,
        originalName,
        mimeType,
        size: parsedSize,
        checksum: checksum || null,
        ownerUserId: Number.isFinite(ownerUserId) ? ownerUserId : null,
        createdById: sessionUser.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
        ownerUser: { select: { id: true, name: true, username: true } },
      },
    })

    if (validLinks.length) {
      await tx.fileAssetLink.createMany({
        data: validLinks.map((link) => ({
          fileId: file.id,
          entityType: link.entityType,
          entityId: link.entityId,
          purpose: link.purpose,
          label: link.label,
          meta: link.meta ?? undefined,
          createdById: sessionUser.id,
        })),
      })
    }

    const links = validLinks.length
      ? await tx.fileAssetLink.findMany({
          where: { fileId: file.id },
          orderBy: { id: 'desc' },
          select: {
            id: true,
            entityType: true,
            entityId: true,
            purpose: true,
            label: true,
          },
        })
      : []

    return { file, links }
  })

  return NextResponse.json(
    {
      file: {
        id: result.file.id,
        category: result.file.category,
        originalName: result.file.originalName,
        mimeType: result.file.mimeType,
        size: result.file.size,
        bucket: result.file.bucket,
        storageKey: result.file.storageKey,
        createdAt: result.file.createdAt.toISOString(),
        updatedAt: result.file.updatedAt.toISOString(),
        createdBy: result.file.createdBy,
        ownerUser: result.file.ownerUser,
      },
      links: result.links,
    },
    { status: 201 },
  )
}
