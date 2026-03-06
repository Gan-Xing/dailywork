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
  excludeProjectIds?: number[]
  roadSectionId?: number | null
  status?: string
  attachmentState?: ReceivedDocumentLedgerAttachmentState
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

export type ReceivedDocumentLedgerAttachmentState = 'all' | 'withMain' | 'withoutMain'

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
  summary: {
    missingMainPdfCount: number
    withMainPdfCount: number
  }
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

const normalizeAttachmentState = (
  value: ReceivedDocumentLedgerListFilters['attachmentState'],
): ReceivedDocumentLedgerAttachmentState =>
  value === 'withMain' || value === 'withoutMain' ? value : 'all'

const combineWhereConditions = (
  ...parts: Array<Prisma.ReceivedDocumentLedgerWhereInput | undefined>
): Prisma.ReceivedDocumentLedgerWhereInput => {
  const valid = parts.filter((part) => part && Object.keys(part).length) as Prisma.ReceivedDocumentLedgerWhereInput[]
  if (!valid.length) return {}
  if (valid.length === 1) return valid[0]
  return { AND: valid }
}

const buildWhere = (filters: ReceivedDocumentLedgerListFilters): Prisma.ReceivedDocumentLedgerWhereInput => {
  const where: Prisma.ReceivedDocumentLedgerWhereInput = {}
  const andConditions: Prisma.ReceivedDocumentLedgerWhereInput[] = []
  const category = filters.category?.trim()
  const status = filters.status?.trim()
  const search = filters.search?.trim()
  const insensitiveMode: Prisma.QueryMode = 'insensitive'
  const selectedProjectId =
    Number.isInteger(filters.projectId) && (filters.projectId as number) > 0
      ? (filters.projectId as number)
      : null
  const excludedProjectIds = Array.from(
    new Set(
      (filters.excludeProjectIds ?? [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  )

  if (category) {
    where.category = category
  }
  if (status) {
    where.status = status as ReceivedDocumentLedgerStatus
  }
  if (selectedProjectId) {
    if (excludedProjectIds.includes(selectedProjectId)) {
      return { id: -1 }
    }
    andConditions.push({ projectId: selectedProjectId })
  } else if (excludedProjectIds.length) {
    andConditions.push({ projectId: { notIn: excludedProjectIds } })
  }
  if (Number.isInteger(filters.roadSectionId) && (filters.roadSectionId as number) > 0) {
    where.roadSectionId = filters.roadSectionId as number
  }

  if (search) {
    const tokens = splitSearchTokens(search)
    if (tokens.length) {
      andConditions.push(
        ...tokens.map((token) => ({
          OR: [
            { documentName: { contains: token, mode: insensitiveMode } },
            { documentCode: { contains: token, mode: insensitiveMode } },
            { structureName: { contains: token, mode: insensitiveMode } },
            { sizeSpec: { contains: token, mode: insensitiveMode } },
            { versionTag: { contains: token, mode: insensitiveMode } },
            { coverageScope: { contains: token, mode: insensitiveMode } },
            { sourceOrg: { contains: token, mode: insensitiveMode } },
            { remark: { contains: token, mode: insensitiveMode } },
            { receivedByText: { contains: token, mode: insensitiveMode } },
            { category: { contains: token, mode: insensitiveMode } },
            { project: { name: { contains: token, mode: insensitiveMode } } },
            { project: { code: { contains: token, mode: insensitiveMode } } },
            { roadSection: { name: { contains: token, mode: insensitiveMode } } },
            { roadSection: { slug: { contains: token, mode: insensitiveMode } } },
            { receivedBy: { name: { contains: token, mode: insensitiveMode } } },
            { receivedBy: { username: { contains: token, mode: insensitiveMode } } },
          ],
        })),
      )
    }
  }

  if (andConditions.length) {
    where.AND = andConditions
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

const loadMainPdfLedgerIdList = async () => {
  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
      purpose: RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN,
    },
    select: {
      entityId: true,
    },
    distinct: ['entityId'],
  })

  return links
    .map((link) => Number(link.entityId))
    .filter((value) => Number.isInteger(value) && value > 0)
}

const buildAttachmentWhere = (
  attachmentState: ReceivedDocumentLedgerAttachmentState,
  mainPdfLedgerIds: number[],
): Prisma.ReceivedDocumentLedgerWhereInput | undefined => {
  if (attachmentState === 'withMain') {
    return {
      id: {
        in: mainPdfLedgerIds.length ? mainPdfLedgerIds : [-1],
      },
    }
  }
  if (attachmentState === 'withoutMain') {
    if (!mainPdfLedgerIds.length) return undefined
    return {
      id: {
        notIn: mainPdfLedgerIds,
      },
    }
  }
  return undefined
}

const buildMissingMainPdfWhere = (
  mainPdfLedgerIds: number[],
): Prisma.ReceivedDocumentLedgerWhereInput | undefined => {
  if (!mainPdfLedgerIds.length) return undefined
  return {
    id: {
      notIn: mainPdfLedgerIds,
    },
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
  const baseWhere = buildWhere(filters)
  const orderBy = buildOrderBy(filters)
  const attachmentState = normalizeAttachmentState(filters.attachmentState)
  const mainPdfLedgerIds = await loadMainPdfLedgerIdList()
  const attachmentWhere = buildAttachmentWhere(attachmentState, mainPdfLedgerIds)
  const where = combineWhereConditions(baseWhere, attachmentWhere)
  const missingMainPdfWhere = combineWhereConditions(
    baseWhere,
    buildMissingMainPdfWhere(mainPdfLedgerIds),
  )

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
  let missingMainPdfCount = 0

  if (attachmentState === 'withoutMain') {
    missingMainPdfCount = total
  } else if (attachmentState === 'withMain') {
    missingMainPdfCount = 0
  } else if (mainPdfLedgerIds.length) {
    missingMainPdfCount = await prisma.receivedDocumentLedger.count({
      where: missingMainPdfWhere,
    })
  } else {
    missingMainPdfCount = total
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    summary: {
      missingMainPdfCount,
      withMainPdfCount: Math.max(0, total - missingMainPdfCount),
    },
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
