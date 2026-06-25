import {
  Prisma,
  type IntervalSide,
  SiteVariationMeasurementReason,
  SiteVariationMeasurementStatus,
  SiteVariationMeasurementType,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE } from '@/lib/value/siteVariationMeasurements'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

export type SiteVariationMeasurementAttachmentState = 'all' | 'withFiles' | 'withoutFiles'
export type SiteVariationMeasurementSortField =
  | 'id'
  | 'occurredAt'
  | 'updatedAt'
  | 'status'
  | 'projectName'
  | 'estimatedAmount'
export type SiteVariationMeasurementSortDir = 'asc' | 'desc'

export type SiteVariationMeasurementListFilters = {
  search?: string
  projectId?: number | null
  roadSectionId?: number | null
  boqItemId?: number | null
  status?: string
  changeType?: string
  attachmentState?: SiteVariationMeasurementAttachmentState
  sortBy?: SiteVariationMeasurementSortField
  sortDir?: SiteVariationMeasurementSortDir
  page?: number
  pageSize?: number
}

export type SiteVariationMeasurementWriteInput = {
  projectId: number
  roadSectionId: number | null
  mainRoadSectionId: number | null
  boqItemId: number | null
  measurementDetailId: number | null
  status: SiteVariationMeasurementStatus
  changeType: SiteVariationMeasurementType
  reason: SiteVariationMeasurementReason | null
  structureName: string | null
  phaseName: string | null
  spec: string | null
  unit: string | null
  startPk: string | null
  endPk: string | null
  side: IntervalSide | null
  designDescription: string | null
  fieldDescription: string | null
  differenceDescription: string | null
  designQuantity: string | null
  actualQuantity: string | null
  deltaQuantity: string | null
  proposedQuantity: string | null
  unitPrice: string | null
  estimatedAmount: string | null
  occurredAt: Date | null
  discoveredByText: string | null
  measurementPeriod: Date | null
  measuredAt: Date | null
  attachmentComplete: boolean
  remark: string | null
}

export type SiteVariationMeasurementFormalInput = {
  id: number
  boqItemId?: number | null
  roadId?: number | null
  period?: Date | null
  quantity?: string | null
  amount?: string | null
  note?: string | null
}

type VariationRow = Prisma.SiteVariationMeasurementGetPayload<{
  include: {
    project: { select: { id: true; name: true; code: true } }
    roadSection: { select: { id: true; name: true; slug: true; projectId: true } }
    mainRoadSection: { select: { id: true; name: true; slug: true; projectId: true } }
    boqItem: {
      select: {
        id: true
        code: true
        designationZh: true
        designationFr: true
        unit: true
        unitPrice: true
      }
    }
    measurementDetail: {
      select: {
        id: true
        period: true
        quantity: true
        manualAmount: true
        roadId: true
        boqItemId: true
      }
    }
    creator: { select: { id: true; name: true; username: true } }
    updater: { select: { id: true; name: true; username: true } }
  }
}>

type FileSummary = {
  attachments: Array<{
    id: number
    originalName: string
    mimeType: string
    size: number
    createdAt: string
  }>
  attachmentCount: number
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const decimalOrNull = (value: string | null | undefined) =>
  value === null || value === undefined || value === '' ? null : value

const dateToIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

const normalizePageSize = (value?: number) => {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value as number)))
}

const isStatus = (value: string): value is SiteVariationMeasurementStatus =>
  Object.values(SiteVariationMeasurementStatus).includes(value as SiteVariationMeasurementStatus)

const isChangeType = (value: string): value is SiteVariationMeasurementType =>
  Object.values(SiteVariationMeasurementType).includes(value as SiteVariationMeasurementType)

const splitSearchTokens = (value: string) =>
  value
    .split(/[\s,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const combineWhereConditions = (
  ...parts: Array<Prisma.SiteVariationMeasurementWhereInput | undefined>
): Prisma.SiteVariationMeasurementWhereInput => {
  const valid = parts.filter((part) => part && Object.keys(part).length) as Prisma.SiteVariationMeasurementWhereInput[]
  if (!valid.length) return {}
  if (valid.length === 1) return valid[0]
  return { AND: valid }
}

const buildWhere = (
  filters: SiteVariationMeasurementListFilters,
): Prisma.SiteVariationMeasurementWhereInput => {
  const where: Prisma.SiteVariationMeasurementWhereInput = {}
  const andConditions: Prisma.SiteVariationMeasurementWhereInput[] = []
  const search = filters.search?.trim()
  const insensitiveMode: Prisma.QueryMode = 'insensitive'

  if (filters.projectId && Number.isInteger(filters.projectId) && filters.projectId > 0) {
    andConditions.push({ projectId: filters.projectId })
  }
  if (filters.roadSectionId && Number.isInteger(filters.roadSectionId) && filters.roadSectionId > 0) {
    andConditions.push({
      OR: [
        { roadSectionId: filters.roadSectionId },
        { mainRoadSectionId: filters.roadSectionId },
      ],
    })
  }
  if (filters.boqItemId && Number.isInteger(filters.boqItemId) && filters.boqItemId > 0) {
    where.boqItemId = filters.boqItemId
  }
  if (filters.status && isStatus(filters.status)) {
    where.status = filters.status
  }
  if (filters.changeType && isChangeType(filters.changeType)) {
    where.changeType = filters.changeType
  }
  if (search) {
    andConditions.push(
      ...splitSearchTokens(search).map((token) => ({
        OR: [
          { structureName: { contains: token, mode: insensitiveMode } },
          { phaseName: { contains: token, mode: insensitiveMode } },
          { spec: { contains: token, mode: insensitiveMode } },
          { startPk: { contains: token, mode: insensitiveMode } },
          { endPk: { contains: token, mode: insensitiveMode } },
          { designDescription: { contains: token, mode: insensitiveMode } },
          { fieldDescription: { contains: token, mode: insensitiveMode } },
          { differenceDescription: { contains: token, mode: insensitiveMode } },
          { discoveredByText: { contains: token, mode: insensitiveMode } },
          { remark: { contains: token, mode: insensitiveMode } },
          { project: { name: { contains: token, mode: insensitiveMode } } },
          { project: { code: { contains: token, mode: insensitiveMode } } },
          { roadSection: { name: { contains: token, mode: insensitiveMode } } },
          { mainRoadSection: { name: { contains: token, mode: insensitiveMode } } },
          { boqItem: { code: { contains: token, mode: insensitiveMode } } },
          { boqItem: { designationZh: { contains: token, mode: insensitiveMode } } },
          { boqItem: { designationFr: { contains: token, mode: insensitiveMode } } },
        ],
      })),
    )
  }

  if (andConditions.length) {
    where.AND = andConditions
  }

  return where
}

const buildOrderBy = (
  filters: SiteVariationMeasurementListFilters,
): Prisma.SiteVariationMeasurementOrderByWithRelationInput[] => {
  const dir: Prisma.SortOrder = filters.sortDir === 'asc' ? 'asc' : 'desc'

  switch (filters.sortBy) {
    case 'id':
      return [{ id: dir }]
    case 'status':
      return [{ status: dir }, { updatedAt: 'desc' }, { id: 'desc' }]
    case 'projectName':
      return [{ project: { name: dir } }, { occurredAt: 'desc' }, { id: 'desc' }]
    case 'estimatedAmount':
      return [{ estimatedAmount: dir }, { id: 'desc' }]
    case 'updatedAt':
      return [{ updatedAt: dir }, { id: 'desc' }]
    case 'occurredAt':
    default:
      return [{ occurredAt: dir }, { id: 'desc' }]
  }
}

const loadLedgerIdsWithFiles = async () => {
  const links = await prisma.fileAssetLink.findMany({
    where: { entityType: SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE },
    select: { entityId: true },
    distinct: ['entityId'],
  })

  return links
    .map((link) => Number(link.entityId))
    .filter((value) => Number.isInteger(value) && value > 0)
}

const buildAttachmentWhere = (
  attachmentState: SiteVariationMeasurementAttachmentState | undefined,
  ledgerIdsWithFiles: number[],
): Prisma.SiteVariationMeasurementWhereInput | undefined => {
  if (attachmentState === 'withFiles') {
    return { id: { in: ledgerIdsWithFiles.length ? ledgerIdsWithFiles : [-1] } }
  }
  if (attachmentState === 'withoutFiles') {
    return ledgerIdsWithFiles.length ? { id: { notIn: ledgerIdsWithFiles } } : undefined
  }
  return undefined
}

const loadFileSummaryMap = async (ids: number[]) => {
  const map = new Map<string, FileSummary>()
  if (!ids.length) return map

  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE,
      entityId: { in: ids.map((id) => String(id)) },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      entityId: true,
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
    const current = map.get(link.entityId) ?? { attachments: [], attachmentCount: 0 }
    current.attachmentCount += 1
    current.attachments.push({
      id: link.file.id,
      originalName: link.file.originalName,
      mimeType: link.file.mimeType,
      size: link.file.size,
      createdAt: link.file.createdAt.toISOString(),
    })
    map.set(link.entityId, current)
  })

  return map
}

const resolveEstimatedAmount = (row: {
  estimatedAmount: unknown
  proposedQuantity: unknown
  unitPrice: unknown
}) => {
  const explicit = toNumber(row.estimatedAmount)
  if (explicit !== null) return explicit
  const quantity = toNumber(row.proposedQuantity)
  const unitPrice = toNumber(row.unitPrice)
  if (quantity === null || unitPrice === null) return null
  return quantity * unitPrice
}

const mapUser = (user: { id: number; name: string; username: string } | null) =>
  user
    ? {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
      }
    : null

const mapRow = (row: VariationRow, fileSummary?: FileSummary) => {
  const estimatedAmount = resolveEstimatedAmount(row)
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    projectCode: row.project.code,
    roadSectionId: row.roadSectionId,
    roadSectionName: row.roadSection?.name ?? null,
    roadSectionSlug: row.roadSection?.slug ?? null,
    mainRoadSectionId: row.mainRoadSectionId,
    mainRoadSectionName: row.mainRoadSection?.name ?? null,
    mainRoadSectionSlug: row.mainRoadSection?.slug ?? null,
    boqItemId: row.boqItemId,
    boqItem: row.boqItem
      ? {
          id: row.boqItem.id,
          code: row.boqItem.code,
          designationZh: row.boqItem.designationZh,
          designationFr: row.boqItem.designationFr,
          unit: row.boqItem.unit,
          unitPrice: toNumber(row.boqItem.unitPrice),
        }
      : null,
    measurementDetail: row.measurementDetail
      ? {
          id: row.measurementDetail.id,
          period: row.measurementDetail.period.toISOString(),
          quantity: toNumber(row.measurementDetail.quantity) ?? 0,
          manualAmount: toNumber(row.measurementDetail.manualAmount),
          roadId: row.measurementDetail.roadId,
          boqItemId: row.measurementDetail.boqItemId,
        }
      : null,
    measurementDetailId: row.measurementDetailId,
    status: row.status,
    changeType: row.changeType,
    reason: row.reason,
    structureName: row.structureName,
    phaseName: row.phaseName,
    spec: row.spec,
    unit: row.unit,
    startPk: row.startPk,
    endPk: row.endPk,
    side: row.side,
    designDescription: row.designDescription,
    fieldDescription: row.fieldDescription,
    differenceDescription: row.differenceDescription,
    designQuantity: toNumber(row.designQuantity),
    actualQuantity: toNumber(row.actualQuantity),
    deltaQuantity: toNumber(row.deltaQuantity),
    proposedQuantity: toNumber(row.proposedQuantity),
    unitPrice: toNumber(row.unitPrice),
    estimatedAmount,
    occurredAt: dateToIso(row.occurredAt),
    discoveredByText: row.discoveredByText,
    measurementPeriod: dateToIso(row.measurementPeriod),
    measuredAt: dateToIso(row.measuredAt),
    attachmentComplete: row.attachmentComplete,
    remark: row.remark,
    attachments: fileSummary?.attachments ?? [],
    attachmentCount: fileSummary?.attachmentCount ?? 0,
    creator: mapUser(row.creator),
    updater: mapUser(row.updater),
    archivedAt: dateToIso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const groupKey = (value: string | number | null | undefined, fallback = '未填写') =>
  value === null || value === undefined || value === '' ? fallback : String(value)

const buildSummary = (rows: VariationRow[], fileMap: Map<string, FileSummary>) => {
  const byProject = new Map<string, any>()
  const byRoad = new Map<string, any>()
  const byPhase = new Map<string, any>()
  const byStatus = new Map<string, any>()
  const initial = () => ({
    count: 0,
    measuredCount: 0,
    unmeasuredCount: 0,
    measuredAmount: 0,
    unmeasuredAmount: 0,
    missingAttachmentCount: 0,
  })
  const bump = (map: Map<string, any>, key: string, label: string, row: VariationRow, amount: number, measured: boolean) => {
    const current = map.get(key) ?? { key, label, ...initial() }
    current.count += 1
    if (measured) {
      current.measuredCount += 1
      current.measuredAmount += amount
    } else {
      current.unmeasuredCount += 1
      current.unmeasuredAmount += amount
    }
    if (!fileMap.get(String(row.id))?.attachmentCount) {
      current.missingAttachmentCount += 1
    }
    map.set(key, current)
  }

  const total = initial()
  rows.forEach((row) => {
    if (row.status === SiteVariationMeasurementStatus.VOID) return
    const amount = resolveEstimatedAmount(row) ?? 0
    const measured = row.status === SiteVariationMeasurementStatus.MEASURED || !!row.measurementDetailId
    total.count += 1
    if (measured) {
      total.measuredCount += 1
      total.measuredAmount += amount
    } else {
      total.unmeasuredCount += 1
      total.unmeasuredAmount += amount
    }
    if (!fileMap.get(String(row.id))?.attachmentCount) {
      total.missingAttachmentCount += 1
    }

    bump(byProject, String(row.projectId), row.project.name, row, amount, measured)
    bump(
      byRoad,
      groupKey(row.roadSectionId ?? row.mainRoadSectionId),
      row.roadSection?.name ?? row.mainRoadSection?.name ?? '未填写路段',
      row,
      amount,
      measured,
    )
    bump(byPhase, groupKey(row.phaseName), row.phaseName ?? '未填写分项', row, amount, measured)
    bump(byStatus, row.status, row.status, row, amount, measured)
  })

  const sortGroups = (items: Map<string, any>) =>
    Array.from(items.values()).sort((a, b) => b.unmeasuredAmount - a.unmeasuredAmount || b.count - a.count)

  return {
    ...total,
    byProject: sortGroups(byProject),
    byRoad: sortGroups(byRoad),
    byPhase: sortGroups(byPhase),
    byStatus: sortGroups(byStatus),
  }
}

const includeForRow = {
  project: { select: { id: true, name: true, code: true } },
  roadSection: { select: { id: true, name: true, slug: true, projectId: true } },
  mainRoadSection: { select: { id: true, name: true, slug: true, projectId: true } },
  boqItem: {
    select: {
      id: true,
      code: true,
      designationZh: true,
      designationFr: true,
      unit: true,
      unitPrice: true,
    },
  },
  measurementDetail: {
    select: {
      id: true,
      period: true,
      quantity: true,
      manualAmount: true,
      roadId: true,
      boqItemId: true,
    },
  },
  creator: { select: { id: true, name: true, username: true } },
  updater: { select: { id: true, name: true, username: true } },
} satisfies Prisma.SiteVariationMeasurementInclude

export const listSiteVariationMeasurements = async (filters: SiteVariationMeasurementListFilters) => {
  const page = Math.max(1, Number(filters.page ?? 1) || 1)
  const pageSize = normalizePageSize(filters.pageSize)
  const baseWhere = buildWhere(filters)
  const orderBy = buildOrderBy(filters)
  const ledgerIdsWithFiles = await loadLedgerIdsWithFiles()
  const attachmentWhere = buildAttachmentWhere(filters.attachmentState, ledgerIdsWithFiles)
  const where = combineWhereConditions(baseWhere, attachmentWhere)

  const [total, rows, summaryRows] = await prisma.$transaction([
    prisma.siteVariationMeasurement.count({ where }),
    prisma.siteVariationMeasurement.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: includeForRow,
    }),
    prisma.siteVariationMeasurement.findMany({
      where,
      include: includeForRow,
      orderBy: [{ id: 'asc' }],
    }),
  ])

  const fileMap = await loadFileSummaryMap([
    ...rows.map((row) => row.id),
    ...summaryRows.map((row) => row.id),
  ])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items: rows.map((row) => mapRow(row, fileMap.get(String(row.id)))),
    total,
    page,
    pageSize,
    totalPages,
    summary: buildSummary(summaryRows, fileMap),
  }
}

const validateReferences = async (input: SiteVariationMeasurementWriteInput) => {
  const [project, roadSection, mainRoadSection, boqItem, measurementDetail] = await Promise.all([
    prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } }),
    input.roadSectionId
      ? prisma.roadSection.findUnique({
          where: { id: input.roadSectionId },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(null),
    input.mainRoadSectionId
      ? prisma.roadSection.findUnique({
          where: { id: input.mainRoadSectionId },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(null),
    input.boqItemId
      ? prisma.boqItem.findFirst({
          where: {
            id: input.boqItemId,
            projectId: input.projectId,
            sheetType: 'ACTUAL',
            tone: 'ITEM',
            isActive: true,
          },
          select: { id: true, unit: true, unitPrice: true },
        })
      : Promise.resolve(null),
    input.measurementDetailId
      ? prisma.boqMeasurementDetail.findFirst({
          where: { id: input.measurementDetailId, projectId: input.projectId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  if (!project) throw new Error('项目不存在')
  if (input.roadSectionId && !roadSection) throw new Error('路段不存在')
  if (input.mainRoadSectionId && !mainRoadSection) throw new Error('主路段不存在')
  if (roadSection?.projectId && roadSection.projectId !== input.projectId) {
    throw new Error('路段不属于当前项目')
  }
  if (mainRoadSection?.projectId && mainRoadSection.projectId !== input.projectId) {
    throw new Error('主路段不属于当前项目')
  }
  if (input.boqItemId && !boqItem) throw new Error('清单条目无效')
  if (input.measurementDetailId && !measurementDetail) throw new Error('计量明细无效')

  return { boqItem }
}

const normalizeWriteData = async (input: SiteVariationMeasurementWriteInput) => {
  const { boqItem } = await validateReferences(input)
  const designQuantity = toNumber(input.designQuantity)
  const actualQuantity = toNumber(input.actualQuantity)
  const explicitDelta = toNumber(input.deltaQuantity)
  const deltaQuantity =
    explicitDelta !== null
      ? input.deltaQuantity
      : designQuantity !== null && actualQuantity !== null
        ? String(actualQuantity - designQuantity)
        : null
  const resolvedUnitPrice = input.unitPrice ?? (boqItem?.unitPrice ? String(boqItem.unitPrice) : null)
  const proposedQuantity = toNumber(input.proposedQuantity)
  const unitPriceNumber = toNumber(resolvedUnitPrice)
  const estimatedAmount =
    input.estimatedAmount ??
    (proposedQuantity !== null && unitPriceNumber !== null ? String(proposedQuantity * unitPriceNumber) : null)

  return {
    projectId: input.projectId,
    roadSectionId: input.roadSectionId,
    mainRoadSectionId: input.mainRoadSectionId,
    boqItemId: input.boqItemId,
    measurementDetailId: input.measurementDetailId,
    status: input.status,
    changeType: input.changeType,
    reason: input.reason,
    structureName: input.structureName,
    phaseName: input.phaseName,
    spec: input.spec,
    unit: input.unit ?? boqItem?.unit ?? null,
    startPk: input.startPk,
    endPk: input.endPk,
    side: input.side,
    designDescription: input.designDescription,
    fieldDescription: input.fieldDescription,
    differenceDescription: input.differenceDescription,
    designQuantity: decimalOrNull(input.designQuantity),
    actualQuantity: decimalOrNull(input.actualQuantity),
    deltaQuantity: decimalOrNull(deltaQuantity),
    proposedQuantity: decimalOrNull(input.proposedQuantity),
    unitPrice: decimalOrNull(resolvedUnitPrice),
    estimatedAmount: decimalOrNull(estimatedAmount),
    occurredAt: input.occurredAt,
    discoveredByText: input.discoveredByText,
    measurementPeriod: input.measurementPeriod,
    measuredAt: input.measuredAt,
    attachmentComplete: input.attachmentComplete,
    remark: input.remark,
  }
}

export const createSiteVariationMeasurement = async (
  input: SiteVariationMeasurementWriteInput,
  userId: number,
) => {
  const data = await normalizeWriteData(input)
  const row = await prisma.siteVariationMeasurement.create({
    data: {
      ...data,
      createdById: userId,
      updatedById: userId,
      ...(data.status === SiteVariationMeasurementStatus.ARCHIVED
        ? { archivedById: userId, archivedAt: new Date() }
        : {}),
    },
    include: includeForRow,
  })
  return mapRow(row)
}

export const updateSiteVariationMeasurement = async (
  id: number,
  input: SiteVariationMeasurementWriteInput,
  userId: number,
) => {
  const existing = await prisma.siteVariationMeasurement.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new Error('现场变更计量记录不存在')
  const data = await normalizeWriteData(input)
  const row = await prisma.siteVariationMeasurement.update({
    where: { id },
    data: {
      ...data,
      updatedById: userId,
      ...(data.status === SiteVariationMeasurementStatus.ARCHIVED
        ? { archivedById: userId, archivedAt: new Date() }
        : {}),
      ...(data.status === SiteVariationMeasurementStatus.MEASURED && !data.measuredAt
        ? { measuredAt: new Date() }
        : {}),
    },
    include: includeForRow,
  })
  const fileMap = await loadFileSummaryMap([id])
  return mapRow(row, fileMap.get(String(id)))
}

export const updateSiteVariationMeasurementStatus = async (
  id: number,
  status: SiteVariationMeasurementStatus,
  userId: number,
) => {
  const row = await prisma.siteVariationMeasurement.update({
    where: { id },
    data: {
      status,
      updatedById: userId,
      ...(status === SiteVariationMeasurementStatus.ARCHIVED
        ? { archivedById: userId, archivedAt: new Date() }
        : {}),
      ...(status === SiteVariationMeasurementStatus.MEASURED ? { measuredAt: new Date() } : {}),
    },
    include: includeForRow,
  })
  const fileMap = await loadFileSummaryMap([id])
  return mapRow(row, fileMap.get(String(id)))
}

const buildMeasurementNote = (row: VariationRow, note: string | null | undefined) => {
  const parts = [
    `现场变更计量台账 #${row.id}`,
    row.structureName,
    row.phaseName,
    row.spec,
    row.differenceDescription,
    row.remark,
    note,
  ].filter(Boolean)
  return parts.join(' · ')
}

export const createFormalMeasurementFromVariation = async (
  input: SiteVariationMeasurementFormalInput,
  userId: number,
) => {
  const row = await prisma.siteVariationMeasurement.findUnique({
    where: { id: input.id },
    include: includeForRow,
  })
  if (!row) throw new Error('现场变更计量记录不存在')

  const boqItemId = input.boqItemId ?? row.boqItemId
  const roadId = input.roadId ?? row.roadSectionId ?? row.mainRoadSectionId
  const period = input.period ?? row.measurementPeriod
  const quantity =
    decimalOrNull(input.quantity ?? null) ??
    decimalOrNull(row.proposedQuantity ? String(row.proposedQuantity) : null) ??
    decimalOrNull(row.actualQuantity ? String(row.actualQuantity) : null) ??
    decimalOrNull(row.deltaQuantity ? String(row.deltaQuantity) : null)
  const amount = decimalOrNull(input.amount ?? null) ?? (row.estimatedAmount ? String(row.estimatedAmount) : null)

  if (!boqItemId) throw new Error('请先选择清单条目')
  if (!roadId) throw new Error('请先选择用于正式计量的路段')
  if (!period) throw new Error('请先填写计量期次')
  if (!quantity || (toNumber(quantity) ?? 0) <= 0) throw new Error('计量数量必须大于 0')

  const [boqItem, road] = await Promise.all([
    prisma.boqItem.findFirst({
      where: {
        id: boqItemId,
        projectId: row.projectId,
        sheetType: 'ACTUAL',
        tone: 'ITEM',
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.roadSection.findFirst({
      where: {
        id: roadId,
        OR: [{ projectId: row.projectId }, { projectId: null }],
      },
      select: { id: true },
    }),
  ])
  if (!boqItem) throw new Error('清单条目无效')
  if (!road) throw new Error('路段无效')

  const result = await prisma.$transaction(async (tx) => {
    const detail = await tx.boqMeasurementDetail.create({
      data: {
        projectId: row.projectId,
        boqItemId,
        roadId,
        startPk: row.startPk,
        endPk: row.endPk,
        side: row.side,
        period,
        quantity,
        manualAmount: amount,
        note: buildMeasurementNote(row, input.note),
      },
    })
    const updated = await tx.siteVariationMeasurement.update({
      where: { id: row.id },
      data: {
        boqItemId,
        roadSectionId: roadId,
        measurementPeriod: period,
        measurementDetailId: detail.id,
        status: SiteVariationMeasurementStatus.MEASURED,
        measuredAt: new Date(),
        updatedById: userId,
      },
      include: includeForRow,
    })

    return { detail, updated }
  })

  const fileMap = await loadFileSummaryMap([row.id])
  return {
    item: mapRow(result.updated, fileMap.get(String(row.id))),
    measurementDetailId: result.detail.id,
  }
}
