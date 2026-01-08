import { prisma } from '@/lib/prisma'
import { FILE_CATEGORIES, type FileCategory } from '@/lib/constants/fileCategories'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { FilesPageClient } from './FilesPageClient'
import type { FileRow, FilesQuery } from './types'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const parseList = (value?: string | string[]) => {
  if (!value) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default async function FilesPage({ searchParams }: { searchParams: Promise<FilesQuery> }) {
  const query = await searchParams
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('file:view') || permissions.includes('file:manage')
  const canUpload = permissions.includes('file:upload') || permissions.includes('file:manage')
  const canDelete = permissions.includes('file:delete') || permissions.includes('file:manage')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['file:view']} variant="filesList" />
  }

  const categories = parseList(query.category).filter((item) =>
    FILE_CATEGORIES.includes(item as FileCategory),
  )
  const entityTypes = parseList(query.entityType)
  const entityIds = parseList(query.entityId)
  const createdFrom = typeof query.createdFrom === 'string' ? query.createdFrom.trim() : ''
  const createdTo = typeof query.createdTo === 'string' ? query.createdTo.trim() : ''
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
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
  const fallbackCreator = sessionUser?.username ?? ''

  const rows: FileRow[] = items.map((item) => ({
    id: item.id,
    category: item.category,
    originalName: item.originalName,
    mimeType: item.mimeType,
    size: item.size,
    storageKey: item.storageKey,
    createdAt: item.createdAt.toISOString(),
    createdBy: item.createdBy?.name || item.createdBy?.username || fallbackCreator,
    createdById: item.createdBy?.id ?? null,
    ownerUser: item.ownerUser?.name || item.ownerUser?.username || '',
    ownerUserId: item.ownerUser?.id ?? null,
    links: item.links,
    linkCount: item._count.links,
    signatureCount: item._count.signatures,
  }))

  return (
    <FilesPageClient
      query={query}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      canUpload={canUpload}
      canDelete={canDelete}
      categories={FILE_CATEGORIES}
    />
  )
}
