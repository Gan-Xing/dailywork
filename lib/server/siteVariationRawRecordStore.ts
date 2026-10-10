import {
  Prisma,
  SiteVariationRawRecordStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

export type SiteVariationRawRecordSortField =
  | 'id'
  | 'recordDate'
  | 'updatedAt'
  | 'status'
  | 'projectName'
export type SiteVariationRawRecordSortDir = 'asc' | 'desc'

export type SiteVariationRawRecordListFilters = {
  search?: string
  projectId?: number | null
  roadSectionId?: number | null
  status?: string
  sortBy?: SiteVariationRawRecordSortField
  sortDir?: SiteVariationRawRecordSortDir
  page?: number
  pageSize?: number
}

export type SiteVariationRawRecordWriteInput = {
  title: string
  rawContent: string
  recordDate: Date | null
  projectId: number | null
  roadSectionId: number | null
  status: SiteVariationRawRecordStatus
  extractedJson: Prisma.InputJsonValue | null
  reviewNote: string | null
  convertedVariationId: number | null
}

const includeForRow = {
  project: { select: { id: true, name: true, code: true } },
  roadSection: { select: { id: true, name: true, slug: true, projectId: true } },
  convertedVariation: {
    select: {
      id: true,
      structureName: true,
      phaseName: true,
      status: true,
    },
  },
  creator: { select: { id: true, name: true, username: true } },
  updater: { select: { id: true, name: true, username: true } },
} satisfies Prisma.SiteVariationRawRecordInclude

type RawRecordRow = Prisma.SiteVariationRawRecordGetPayload<{
  include: typeof includeForRow
}>

const normalizePageSize = (value?: number) => {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value as number)))
}

const isStatus = (value: string): value is SiteVariationRawRecordStatus =>
  Object.values(SiteVariationRawRecordStatus).includes(value as SiteVariationRawRecordStatus)

const splitSearchTokens = (value: string) =>
  value
    .split(/[\s,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const buildWhere = (
  filters: SiteVariationRawRecordListFilters,
): Prisma.SiteVariationRawRecordWhereInput => {
  const where: Prisma.SiteVariationRawRecordWhereInput = {}
  const andConditions: Prisma.SiteVariationRawRecordWhereInput[] = []
  const search = filters.search?.trim()
  const insensitiveMode: Prisma.QueryMode = 'insensitive'

  if (filters.projectId && Number.isInteger(filters.projectId) && filters.projectId > 0) {
    andConditions.push({ projectId: filters.projectId })
  }
  if (filters.roadSectionId && Number.isInteger(filters.roadSectionId) && filters.roadSectionId > 0) {
    andConditions.push({ roadSectionId: filters.roadSectionId })
  }
  if (filters.status && isStatus(filters.status)) {
    where.status = filters.status
  }
  if (search) {
    andConditions.push(
      ...splitSearchTokens(search).map((token) => ({
        OR: [
          { title: { contains: token, mode: insensitiveMode } },
          { rawContent: { contains: token, mode: insensitiveMode } },
          { reviewNote: { contains: token, mode: insensitiveMode } },
          { project: { name: { contains: token, mode: insensitiveMode } } },
          { project: { code: { contains: token, mode: insensitiveMode } } },
          { roadSection: { name: { contains: token, mode: insensitiveMode } } },
        ],
      })),
    )
  }

  if (andConditions.length) where.AND = andConditions
  return where
}

const buildOrderBy = (
  filters: SiteVariationRawRecordListFilters,
): Prisma.SiteVariationRawRecordOrderByWithRelationInput[] => {
  const dir: Prisma.SortOrder = filters.sortDir === 'asc' ? 'asc' : 'desc'
  switch (filters.sortBy) {
    case 'id':
      return [{ id: dir }]
    case 'status':
      return [{ status: dir }, { updatedAt: 'desc' }, { id: 'desc' }]
    case 'projectName':
      return [{ project: { name: dir } }, { recordDate: 'desc' }, { id: 'desc' }]
    case 'updatedAt':
      return [{ updatedAt: dir }, { id: 'desc' }]
    case 'recordDate':
    default:
      return [{ recordDate: dir }, { id: 'desc' }]
  }
}

const mapUser = (user: { id: number; name: string; username: string } | null) =>
  user
    ? {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
      }
    : null

const dateToIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

const mapRow = (row: RawRecordRow) => ({
  id: row.id,
  title: row.title,
  rawContent: row.rawContent,
  recordDate: dateToIso(row.recordDate),
  projectId: row.projectId,
  projectName: row.project?.name ?? null,
  projectCode: row.project?.code ?? null,
  roadSectionId: row.roadSectionId,
  roadSectionName: row.roadSection?.name ?? null,
  roadSectionSlug: row.roadSection?.slug ?? null,
  status: row.status,
  extractedJson: row.extractedJson,
  reviewNote: row.reviewNote,
  convertedVariationId: row.convertedVariationId,
  convertedVariation: row.convertedVariation
    ? {
        id: row.convertedVariation.id,
        structureName: row.convertedVariation.structureName,
        phaseName: row.convertedVariation.phaseName,
        status: row.convertedVariation.status,
      }
    : null,
  creator: mapUser(row.creator),
  updater: mapUser(row.updater),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const normalizeJsonForWrite = (value: Prisma.InputJsonValue | null) =>
  value === null ? Prisma.DbNull : value

const buildSummary = (
  rows: Array<{ status: SiteVariationRawRecordStatus; convertedVariationId: number | null }>,
) => {
  const byStatus = new Map<string, { key: string; count: number }>()
  rows.forEach((row) => {
    const current = byStatus.get(row.status) ?? { key: row.status, count: 0 }
    current.count += 1
    byStatus.set(row.status, current)
  })
  return {
    count: rows.length,
    linkedCount: rows.filter((row) => row.convertedVariationId).length,
    byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  }
}

export const listSiteVariationRawRecords = async (filters: SiteVariationRawRecordListFilters) => {
  const page = Math.max(1, Number(filters.page ?? 1) || 1)
  const pageSize = normalizePageSize(filters.pageSize)
  const where = buildWhere(filters)
  const orderBy = buildOrderBy(filters)

  const [total, rows, summaryRows] = await prisma.$transaction([
    prisma.siteVariationRawRecord.count({ where }),
    prisma.siteVariationRawRecord.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: includeForRow,
    }),
    prisma.siteVariationRawRecord.findMany({
      where,
      select: { status: true, convertedVariationId: true },
      orderBy: [{ id: 'asc' }],
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    items: rows.map(mapRow),
    total,
    page,
    pageSize,
    totalPages,
    summary: buildSummary(summaryRows),
  }
}

const validateReferences = async (input: SiteVariationRawRecordWriteInput) => {
  const [project, roadSection, convertedVariation] = await Promise.all([
    input.projectId
      ? prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } })
      : Promise.resolve(null),
    input.roadSectionId
      ? prisma.roadSection.findUnique({
          where: { id: input.roadSectionId },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(null),
    input.convertedVariationId
      ? prisma.siteVariationMeasurement.findUnique({
          where: { id: input.convertedVariationId },
          select: { id: true, projectId: true, roadSectionId: true, mainRoadSectionId: true },
        })
      : Promise.resolve(null),
  ])

  if (input.projectId && !project) throw new Error('项目不存在')
  if (input.roadSectionId && !roadSection) throw new Error('路段不存在')
  if (input.convertedVariationId && !convertedVariation) throw new Error('正式变更记录不存在')
  if (input.projectId && roadSection?.projectId && roadSection.projectId !== input.projectId) {
    throw new Error('路段不属于当前项目')
  }
  if (input.projectId && convertedVariation?.projectId && convertedVariation.projectId !== input.projectId) {
    throw new Error('正式变更记录不属于当前项目')
  }
}

const normalizeWriteData = async (input: SiteVariationRawRecordWriteInput) => {
  await validateReferences(input)
  const title = input.title.trim()
  const rawContent = input.rawContent.trim()
  if (!title) throw new Error('标题不能为空')
  if (!rawContent) throw new Error('原始内容不能为空')
  return {
    title,
    rawContent,
    recordDate: input.recordDate,
    projectId: input.projectId,
    roadSectionId: input.roadSectionId,
    status: input.status,
    extractedJson: normalizeJsonForWrite(input.extractedJson),
    reviewNote: input.reviewNote,
    convertedVariationId: input.convertedVariationId,
  }
}

export const createSiteVariationRawRecord = async (
  input: SiteVariationRawRecordWriteInput,
  userId: number,
) => {
  const data = await normalizeWriteData(input)
  const row = await prisma.siteVariationRawRecord.create({
    data: {
      ...data,
      createdById: userId,
      updatedById: userId,
    },
    include: includeForRow,
  })
  return mapRow(row)
}

export const createSiteVariationRawRecords = async (
  inputs: SiteVariationRawRecordWriteInput[],
  userId: number,
) => {
  if (!inputs.length) return []
  if (inputs.length > 200) throw new Error('单次最多导入 200 条原始记录')
  const data: Awaited<ReturnType<typeof normalizeWriteData>>[] = []
  for (const input of inputs) {
    data.push(await normalizeWriteData(input))
  }

  const rows = await prisma.$transaction(
    data.map((item) =>
      prisma.siteVariationRawRecord.create({
        data: {
          ...item,
          createdById: userId,
          updatedById: userId,
        },
        include: includeForRow,
      }),
    ),
  )
  return rows.map(mapRow)
}

export const updateSiteVariationRawRecord = async (
  id: number,
  input: SiteVariationRawRecordWriteInput,
  userId: number,
) => {
  const existing = await prisma.siteVariationRawRecord.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new Error('现场变更原始记录不存在')
  const data = await normalizeWriteData(input)
  const row = await prisma.siteVariationRawRecord.update({
    where: { id },
    data: {
      ...data,
      updatedById: userId,
    },
    include: includeForRow,
  })
  return mapRow(row)
}

export const updateSiteVariationRawRecordStatus = async (
  id: number,
  status: SiteVariationRawRecordStatus,
  userId: number,
) => {
  const existing = await prisma.siteVariationRawRecord.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new Error('现场变更原始记录不存在')
  const row = await prisma.siteVariationRawRecord.update({
    where: { id },
    data: {
      status,
      updatedById: userId,
    },
    include: includeForRow,
  })
  return mapRow(row)
}
