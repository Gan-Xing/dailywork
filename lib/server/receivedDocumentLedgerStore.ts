import type { Prisma, ReceivedDocumentLedgerStatus } from '@prisma/client'

import {
  RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
  RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN,
  type ReceivedDocumentLedgerCategory,
} from '@/lib/documents/receivedLedger'
import { prisma } from '@/lib/prisma'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

export type ReceivedDocumentLedgerListFilters = {
  search?: string
  category?: string
  projectId?: number | null
  roadSectionId?: number | null
  status?: string
  sortBy?: ReceivedDocumentLedgerSortField
  sortDir?: ReceivedDocumentLedgerSortDir
  page?: number
  pageSize?: number
}

export type ReceivedDocumentLedgerSortField =
  | 'id'
  | 'documentName'
  | 'projectName'
  | 'category'
  | 'status'
  | 'receivedAt'
  | 'updatedAt'

export type ReceivedDocumentLedgerSortDir = 'asc' | 'desc'

export type ReceivedDocumentLedgerMainPdf = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

export type ReceivedDocumentLedgerListItem = {
  id: number
  category: string
  projectId: number
  projectName: string
  roadSectionId: number | null
  roadSectionName: string | null
  structureName: string | null
  sizeSpec: string | null
  versionTag: string | null
  documentName: string
  documentCode: string | null
  coverageScope: string | null
  sourceOrg: string | null
  receivedAt: string
  receivedById: number | null
  receivedByName: string | null
  receivedByText: string | null
  status: ReceivedDocumentLedgerStatus
  remark: string | null
  mainPdf: ReceivedDocumentLedgerMainPdf | null
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

export type ReceivedDocumentLedgerListResult = {
  items: ReceivedDocumentLedgerListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ReceivedDocumentLedgerWriteInput = {
  category: ReceivedDocumentLedgerCategory
  projectId: number
  roadSectionId: number | null
  structureName: string | null
  sizeSpec: string | null
  versionTag: string | null
  documentName: string
  documentCode: string | null
  coverageScope: string | null
  sourceOrg: string | null
  receivedAt: Date
  receivedById: number | null
  receivedByText: string | null
  status: ReceivedDocumentLedgerStatus
  remark: string | null
}

type RowWithRelations = Prisma.ReceivedDocumentLedgerGetPayload<{
  include: {
    project: { select: { id: true; name: true } }
    roadSection: { select: { id: true; name: true } }
    receivedBy: { select: { id: true; name: true; username: true } }
  }
}>

const normalizePageSize = (value?: number) => {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value as number)))
}

const splitSearchTokens = (value: string) =>
  value
    .split(/[\s,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const buildWhere = (filters: ReceivedDocumentLedgerListFilters): Prisma.ReceivedDocumentLedgerWhereInput => {
  const where: Prisma.ReceivedDocumentLedgerWhereInput = {}
  const category = filters.category?.trim()
  const status = filters.status?.trim()
  const search = filters.search?.trim()

  if (category) {
    where.category = category
  }
  if (status) {
    where.status = status as ReceivedDocumentLedgerStatus
  }
  if (Number.isInteger(filters.projectId) && (filters.projectId as number) > 0) {
    where.projectId = filters.projectId as number
  }
  if (Number.isInteger(filters.roadSectionId) && (filters.roadSectionId as number) > 0) {
    where.roadSectionId = filters.roadSectionId as number
  }

  if (search) {
    const tokens = splitSearchTokens(search)
    if (tokens.length) {
      where.AND = tokens.map((token) => ({
        OR: [
          { documentName: { contains: token, mode: 'insensitive' } },
          { documentCode: { contains: token, mode: 'insensitive' } },
          { structureName: { contains: token, mode: 'insensitive' } },
          { sizeSpec: { contains: token, mode: 'insensitive' } },
          { versionTag: { contains: token, mode: 'insensitive' } },
          { coverageScope: { contains: token, mode: 'insensitive' } },
          { sourceOrg: { contains: token, mode: 'insensitive' } },
          { remark: { contains: token, mode: 'insensitive' } },
          { receivedByText: { contains: token, mode: 'insensitive' } },
          { category: { contains: token, mode: 'insensitive' } },
          { project: { name: { contains: token, mode: 'insensitive' } } },
          { project: { code: { contains: token, mode: 'insensitive' } } },
          { roadSection: { name: { contains: token, mode: 'insensitive' } } },
          { roadSection: { slug: { contains: token, mode: 'insensitive' } } },
          { receivedBy: { name: { contains: token, mode: 'insensitive' } } },
          { receivedBy: { username: { contains: token, mode: 'insensitive' } } },
        ],
      }))
    }
  }

  return where
}

const buildOrderBy = (filters: ReceivedDocumentLedgerListFilters): Prisma.ReceivedDocumentLedgerOrderByWithRelationInput[] => {
  const dir: Prisma.SortOrder = filters.sortDir === 'asc' ? 'asc' : 'desc'

  switch (filters.sortBy) {
    case 'id':
      return [{ id: dir }]
    case 'documentName':
      return [{ documentName: dir }, { id: 'desc' }]
    case 'projectName':
      return [{ project: { name: dir } }, { receivedAt: 'desc' }, { id: 'desc' }]
    case 'category':
      return [{ category: dir }, { receivedAt: 'desc' }, { id: 'desc' }]
    case 'status':
      return [{ status: dir }, { receivedAt: 'desc' }, { id: 'desc' }]
    case 'updatedAt':
      return [{ updatedAt: dir }, { id: 'desc' }]
    case 'receivedAt':
    default:
      return [{ receivedAt: dir }, { id: 'desc' }]
  }
}

const loadFileSummaryMap = async (ids: number[]) => {
  const map = new Map<string, { mainPdf: ReceivedDocumentLedgerMainPdf | null; attachmentCount: number }>()
  if (!ids.length) return map

  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
      entityId: { in: ids.map((id) => String(id)) },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      entityId: true,
      purpose: true,
      file: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      },
    },
  })

  links.forEach((link) => {
    const key = link.entityId
    const current = map.get(key) ?? { mainPdf: null, attachmentCount: 0 }
    current.attachmentCount += 1
    if (!current.mainPdf && link.purpose === RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN) {
      current.mainPdf = {
        id: link.file.id,
        originalName: link.file.originalName,
        mimeType: link.file.mimeType,
        size: link.file.size,
        createdAt: link.file.createdAt.toISOString(),
      }
    }
    map.set(key, current)
  })

  return map
}

const mapRow = (
  row: RowWithRelations,
  fileSummary: { mainPdf: ReceivedDocumentLedgerMainPdf | null; attachmentCount: number } | undefined,
): ReceivedDocumentLedgerListItem => ({
  id: row.id,
  category: row.category,
  projectId: row.projectId,
  projectName: row.project.name,
  roadSectionId: row.roadSectionId ?? null,
  roadSectionName: row.roadSection?.name ?? null,
  structureName: row.structureName ?? null,
  sizeSpec: row.sizeSpec ?? null,
  versionTag: row.versionTag ?? null,
  documentName: row.documentName,
  documentCode: row.documentCode ?? null,
  coverageScope: row.coverageScope ?? null,
  sourceOrg: row.sourceOrg ?? null,
  receivedAt: row.receivedAt.toISOString(),
  receivedById: row.receivedById ?? null,
  receivedByName: row.receivedBy?.name || row.receivedBy?.username || null,
  receivedByText: row.receivedByText ?? null,
  status: row.status,
  remark: row.remark ?? null,
  mainPdf: fileSummary?.mainPdf ?? null,
  attachmentCount: fileSummary?.attachmentCount ?? 0,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const validateReferences = async (input: ReceivedDocumentLedgerWriteInput) => {
  const [project, roadSection, receivedBy] = await Promise.all([
    prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } }),
    input.roadSectionId
      ? prisma.roadSection.findUnique({
          where: { id: input.roadSectionId },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(null),
    input.receivedById
      ? prisma.user.findUnique({ where: { id: input.receivedById }, select: { id: true } })
      : Promise.resolve(null),
  ])

  if (!project) {
    throw new Error('所选项目不存在')
  }
  if (input.roadSectionId && !roadSection) {
    throw new Error('所选路段不存在')
  }
  if (roadSection?.projectId && roadSection.projectId !== input.projectId) {
    throw new Error('路段不属于当前项目')
  }
  if (input.receivedById && !receivedBy) {
    throw new Error('接收人不存在')
  }
}

export const listReceivedDocumentLedgers = async (
  filters: ReceivedDocumentLedgerListFilters,
): Promise<ReceivedDocumentLedgerListResult> => {
  const page = Math.max(1, Number(filters.page ?? 1) || 1)
  const pageSize = normalizePageSize(filters.pageSize)
  const where = buildWhere(filters)
  const orderBy = buildOrderBy(filters)

  const [total, rows] = await prisma.$transaction([
    prisma.receivedDocumentLedger.count({ where }),
    prisma.receivedDocumentLedger.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        project: { select: { id: true, name: true } },
        roadSection: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, username: true } },
      },
    }),
  ])

  const fileSummaryMap = await loadFileSummaryMap(rows.map((row) => row.id))
  const items = rows.map((row) => mapRow(row, fileSummaryMap.get(String(row.id))))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  }
}

export const createReceivedDocumentLedger = async (
  input: ReceivedDocumentLedgerWriteInput,
  userId: number,
): Promise<ReceivedDocumentLedgerListItem> => {
  await validateReferences(input)

  const row = await prisma.receivedDocumentLedger.create({
    data: {
      category: input.category,
      projectId: input.projectId,
      roadSectionId: input.roadSectionId,
      structureName: input.structureName,
      sizeSpec: input.sizeSpec,
      versionTag: input.versionTag,
      documentName: input.documentName,
      documentCode: input.documentCode,
      coverageScope: input.coverageScope,
      sourceOrg: input.sourceOrg,
      receivedAt: input.receivedAt,
      receivedById: input.receivedById,
      receivedByText: input.receivedByText,
      status: input.status,
      remark: input.remark,
      createdById: userId,
      updatedById: userId,
    },
    include: {
      project: { select: { id: true, name: true } },
      roadSection: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true, username: true } },
    },
  })

  return mapRow(row, undefined)
}

export const updateReceivedDocumentLedger = async (
  id: number,
  input: ReceivedDocumentLedgerWriteInput,
  userId: number,
): Promise<ReceivedDocumentLedgerListItem> => {
  await validateReferences(input)

  const row = await prisma.receivedDocumentLedger.update({
    where: { id },
    data: {
      category: input.category,
      projectId: input.projectId,
      roadSectionId: input.roadSectionId,
      structureName: input.structureName,
      sizeSpec: input.sizeSpec,
      versionTag: input.versionTag,
      documentName: input.documentName,
      documentCode: input.documentCode,
      coverageScope: input.coverageScope,
      sourceOrg: input.sourceOrg,
      receivedAt: input.receivedAt,
      receivedById: input.receivedById,
      receivedByText: input.receivedByText,
      status: input.status,
      remark: input.remark,
      updatedById: userId,
    },
    include: {
      project: { select: { id: true, name: true } },
      roadSection: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true, username: true } },
    },
  })

  const fileSummaryMap = await loadFileSummaryMap([id])
  return mapRow(row, fileSummaryMap.get(String(id)))
}

export const deleteReceivedDocumentLedger = async (id: number) => {
  await prisma.$transaction(async (tx) => {
    await tx.fileAssetLink.deleteMany({
      where: {
        entityType: RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
        entityId: String(id),
      },
    })
    await tx.receivedDocumentLedger.delete({ where: { id } })
  })
}
