import { FinanceLedgerCaseStatus, FinanceLedgerStage, Prisma } from '@prisma/client'

import {
  DEFAULT_FINANCE_LEDGER_SORT_STACK,
  FINANCE_LEDGER_CASE_STATUSES,
  FINANCE_LEDGER_DEFAULT_SLA_DAYS,
  FINANCE_LEDGER_SORT_FIELDS,
  FINANCE_LEDGER_STAGES,
  buildLedgerTransitionKey,
  getLedgerStageIndex,
  getNextLedgerStage,
  type FinanceLedgerSortField,
  type FinanceLedgerSortSpec,
} from '@/lib/finance/ledgerConstants'
import { prisma } from '@/lib/prisma'
import { resolveRoadLabels } from '@/lib/i18n/roadDictionary'
import { ensureFinanceDefaults } from './financeStore'

const DAY_MS = 24 * 60 * 60 * 1000

const ledgerCaseInclude = {
  project: true,
  section: true,
  events: {
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.FinanceLedgerCaseInclude

type FinanceLedgerCaseRow = Prisma.FinanceLedgerCaseGetPayload<{ include: typeof ledgerCaseInclude }>

type FinanceLedgerStageDates = Record<FinanceLedgerStage, string | null>

type FinanceLedgerSnapshotInput = Partial<{
  accountAmount: number | null
  invoiceAmount: number | null
  advanceAmount: number | null
  chequeAmount: number | null
  invoiceNumber: string | null
  receiptChequeNumber: string | null
  remark: string | null
}>

export type FinanceLedgerMetadata = {
  projects: { id: number; name: string; code: string | null }[]
  sections: {
    id: number
    projectId: number | null
    slug: string
    name: string
    labels: { zh: string; fr: string }
    startPk: string
    endPk: string
  }[]
  stages: FinanceLedgerStage[]
  statuses: FinanceLedgerCaseStatus[]
}

export type FinanceLedgerEventDTO = {
  id: number
  caseId: number
  stage: FinanceLedgerStage
  occurredAt: string
  note: string | null
  payload: Record<string, unknown>
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
}

export type FinanceLedgerCaseDTO = {
  id: number
  sequence: number
  projectId: number
  projectName: string
  projectCode: string | null
  sectionId: number | null
  sectionName: string | null
  sectionSlug: string | null
  sectionLabelFr: string | null
  periodIndex: number
  status: FinanceLedgerCaseStatus
  currentStage: FinanceLedgerStage | null
  nextStage: FinanceLedgerStage | null
  enteredCurrentStageAt: string | null
  accountAmount: number | null
  invoiceAmount: number | null
  advanceAmount: number | null
  chequeAmount: number | null
  invoiceNumber: string | null
  receiptChequeNumber: string | null
  remark: string | null
  waitingDays: number
  overdueDays: number
  isOverdue: boolean
  cycleDays: number | null
  stageDates: FinanceLedgerStageDates
  events: FinanceLedgerEventDTO[]
  createdAt: string
  updatedAt: string
}

export type FinanceLedgerCaseFilterOptions = {
  projectIds?: number[]
  sectionIds?: number[]
  statuses?: FinanceLedgerCaseStatus[]
  stages?: FinanceLedgerStage[]
  overdue?: boolean
  search?: string
  periodMin?: number
  periodMax?: number
  updatedFrom?: string
  updatedTo?: string
  includeDeleted?: boolean
  sortStack?: FinanceLedgerSortSpec[]
  page?: number
  pageSize?: number
}

export type FinanceLedgerCaseListResult = {
  items: FinanceLedgerCaseDTO[]
  total: number
  page: number
  pageSize: number
}

export type FinanceLedgerCreateCaseInput = {
  projectId: number
  periodIndex: number
  sectionId?: number | null
}

export type FinanceLedgerUpdateCaseInput = FinanceLedgerSnapshotInput & {
  sectionId?: number | null
  status?: FinanceLedgerCaseStatus
}

export type FinanceLedgerCreateEventInput = FinanceLedgerSnapshotInput & {
  stage: FinanceLedgerStage
  occurredAt: string
  note?: string | null
}

export type FinanceLedgerUpdateEventInput = FinanceLedgerSnapshotInput & {
  occurredAt?: string
  note?: string | null
}

export type FinanceLedgerInsights = {
  summary: {
    caseCount: number
    totalAccountAmount: number
    totalInvoiceAmount: number
    totalChequeAmount: number
    receiptRate: number
    averageCycleDays: number
    overdueCount: number
  }
  stageFunnel: {
    stage: FinanceLedgerStage
    count: number
    amount: number
  }[]
  projectProgress: {
    projectId: number
    projectName: string
    projectCode: string | null
    stageCounts: { stage: FinanceLedgerStage; count: number; amount: number }[]
  }[]
  monthlyFlow: {
    month: string
    invoiceAmount: number
    chequeAmount: number
    cumulativeInvoiceAmount: number
    cumulativeChequeAmount: number
  }[]
  agingBuckets: {
    bucket: '0-7' | '8-15' | '16-30' | '31-60' | '60+'
    count: number
    amount: number
  }[]
  transitionStats: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
  bottlenecks: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
}

const assertFinanceLedgerModels = () => {
  const client = prisma as unknown as Record<string, unknown>
  if (!client.financeLedgerCase || !client.financeLedgerEvent || !client.financeLedgerSla) {
    throw new Error('Prisma Client 未包含财务台账模型，请先执行 `prisma migrate deploy && prisma generate`')
  }
}

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const toDecimalOrNull = (value: number | null | undefined) => {
  if (value == null) return null
  if (!Number.isFinite(value)) throw new Error('金额字段必须是数字')
  return new Prisma.Decimal(value)
}

const toNumberOrNull = (value: Prisma.Decimal | null | undefined) =>
  value == null ? null : new Prisma.Decimal(value).toNumber()

const normalizeDate = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const diffDays = (start: Date, end: Date) => {
  const startDay = normalizeDate(start).getTime()
  const endDay = normalizeDate(end).getTime()
  const delta = Math.floor((endDay - startDay) / DAY_MS)
  return delta > 0 ? delta : 0
}

const parseDateInput = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('日期格式无效')
  }
  return date
}

const extractStageDates = (row: FinanceLedgerCaseRow): Record<FinanceLedgerStage, Date | null> => ({
  SITE_SIGNED: row.ptoSiteSignedAt,
  HQ_BILL_RECEIVED: row.ptoHqBillReceivedAt,
  BE_CONFIRMED: row.ptoBeConfirmedAt,
  BE_DELIVERED: row.ptoBeDeliveredAt,
  HQ_INVOICE_RECEIVED: row.ptoHqInvoiceReceivedAt,
  CHEQUE_ISSUED: row.chequeIssuedAt,
  CHEQUE_RECEIVED: row.chequeReceivedAt,
})

const mapEvent = (event: {
  id: number
  caseId: number
  stage: FinanceLedgerStage
  occurredAt: Date
  note: string | null
  payloadJson: Prisma.JsonValue | null
  createdBy: number | null
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}): FinanceLedgerEventDTO => ({
  id: event.id,
  caseId: event.caseId,
  stage: event.stage,
  occurredAt: event.occurredAt.toISOString(),
  note: event.note ?? null,
  payload:
    event.payloadJson && typeof event.payloadJson === 'object' && !Array.isArray(event.payloadJson)
      ? (event.payloadJson as Record<string, unknown>)
      : {},
  createdBy: event.createdBy ?? null,
  updatedBy: event.updatedBy ?? null,
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
})

const p90 = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1)
  return sorted[index] ?? 0
}

type SlaMap = {
  global: Map<string, number>
  byProject: Map<number, Map<string, number>>
}

const listSlaMap = async (projectIds: number[]): Promise<SlaMap> => {
  const rows = await prisma.financeLedgerSla.findMany({
    where: {
      active: true,
      OR: [{ projectId: null }, projectIds.length ? { projectId: { in: projectIds } } : undefined].filter(
        Boolean,
      ) as Prisma.FinanceLedgerSlaWhereInput[],
    },
  })
  const global = new Map<string, number>()
  const byProject = new Map<number, Map<string, number>>()

  rows.forEach((row) => {
    const key = buildLedgerTransitionKey(row.fromStage, row.toStage)
    if (row.projectId == null) {
      global.set(key, row.maxDays)
      return
    }
    if (!byProject.has(row.projectId)) {
      byProject.set(row.projectId, new Map())
    }
    byProject.get(row.projectId)!.set(key, row.maxDays)
  })

  return { global, byProject }
}

const resolveSlaDays = (slaMap: SlaMap, projectId: number, fromStage: FinanceLedgerStage, toStage: FinanceLedgerStage) => {
  const key = buildLedgerTransitionKey(fromStage, toStage)
  const projectValue = slaMap.byProject.get(projectId)?.get(key)
  if (projectValue !== undefined) return projectValue
  const globalValue = slaMap.global.get(key)
  if (globalValue !== undefined) return globalValue
  return FINANCE_LEDGER_DEFAULT_SLA_DAYS[key] ?? 0
}

const deriveProgressFromEvents = (
  events: Array<{ stage: FinanceLedgerStage; occurredAt: Date }>,
  baseStatus: FinanceLedgerCaseStatus,
) => {
  const stageDates = new Map<FinanceLedgerStage, Date>()
  events.forEach((event) => stageDates.set(event.stage, event.occurredAt))

  let currentStage: FinanceLedgerStage | null = null
  FINANCE_LEDGER_STAGES.forEach((stage) => {
    if (stageDates.has(stage)) {
      currentStage = stage
    }
  })

  const enteredCurrentStageAt = currentStage ? stageDates.get(currentStage) ?? null : null
  const status: FinanceLedgerCaseStatus =
    currentStage === 'CHEQUE_RECEIVED'
      ? 'DONE'
      : baseStatus === 'BLOCKED'
        ? 'BLOCKED'
        : 'IN_PROGRESS'

  const stageUpdate: Prisma.FinanceLedgerCaseUpdateInput = {
    ptoSiteSignedAt: stageDates.get('SITE_SIGNED') ?? null,
    ptoHqBillReceivedAt: stageDates.get('HQ_BILL_RECEIVED') ?? null,
    ptoBeConfirmedAt: stageDates.get('BE_CONFIRMED') ?? null,
    ptoBeDeliveredAt: stageDates.get('BE_DELIVERED') ?? null,
    ptoHqInvoiceReceivedAt: stageDates.get('HQ_INVOICE_RECEIVED') ?? null,
    chequeIssuedAt: stageDates.get('CHEQUE_ISSUED') ?? null,
    chequeReceivedAt: stageDates.get('CHEQUE_RECEIVED') ?? null,
  }

  return {
    ...stageUpdate,
    currentStage,
    enteredCurrentStageAt,
    status,
  } satisfies Prisma.FinanceLedgerCaseUpdateInput
}

const applySnapshotPatch = (target: Prisma.FinanceLedgerCaseUpdateInput, patch: FinanceLedgerSnapshotInput) => {
  if (hasOwn(patch, 'accountAmount') && patch.accountAmount !== undefined) {
    target.accountAmount = toDecimalOrNull(patch.accountAmount)
  }
  if (hasOwn(patch, 'invoiceAmount') && patch.invoiceAmount !== undefined) {
    target.invoiceAmount = toDecimalOrNull(patch.invoiceAmount)
  }
  if (hasOwn(patch, 'advanceAmount') && patch.advanceAmount !== undefined) {
    target.advanceAmount = toDecimalOrNull(patch.advanceAmount)
  }
  if (hasOwn(patch, 'chequeAmount') && patch.chequeAmount !== undefined) {
    target.chequeAmount = toDecimalOrNull(patch.chequeAmount)
  }
  if (hasOwn(patch, 'invoiceNumber') && patch.invoiceNumber !== undefined) {
    target.invoiceNumber = normalizeOptionalText(patch.invoiceNumber)
  }
  if (hasOwn(patch, 'receiptChequeNumber') && patch.receiptChequeNumber !== undefined) {
    target.receiptChequeNumber = normalizeOptionalText(patch.receiptChequeNumber)
  }
  if (hasOwn(patch, 'remark') && patch.remark !== undefined) {
    target.remark = normalizeOptionalText(patch.remark)
  }
}

const buildEventPayloadJson = (patch: FinanceLedgerSnapshotInput) => {
  const payload: Record<string, unknown> = {}
  if (hasOwn(patch, 'accountAmount') && patch.accountAmount !== undefined) payload.accountAmount = patch.accountAmount ?? null
  if (hasOwn(patch, 'invoiceAmount') && patch.invoiceAmount !== undefined) payload.invoiceAmount = patch.invoiceAmount ?? null
  if (hasOwn(patch, 'advanceAmount') && patch.advanceAmount !== undefined) payload.advanceAmount = patch.advanceAmount ?? null
  if (hasOwn(patch, 'chequeAmount') && patch.chequeAmount !== undefined) payload.chequeAmount = patch.chequeAmount ?? null
  if (hasOwn(patch, 'invoiceNumber') && patch.invoiceNumber !== undefined) payload.invoiceNumber = normalizeOptionalText(patch.invoiceNumber)
  if (hasOwn(patch, 'receiptChequeNumber')) {
    if (patch.receiptChequeNumber !== undefined) {
      payload.receiptChequeNumber = normalizeOptionalText(patch.receiptChequeNumber)
    }
  }
  if (hasOwn(patch, 'remark') && patch.remark !== undefined) payload.remark = normalizeOptionalText(patch.remark)
  return payload
}

const buildSearchableText = (row: FinanceLedgerCaseDTO) =>
  [
    String(row.sequence),
    row.projectName,
    row.projectCode ?? '',
    row.sectionName ?? '',
    row.sectionSlug ?? '',
    `P${row.periodIndex}`,
    row.invoiceNumber ?? '',
    row.receiptChequeNumber ?? '',
    row.remark ?? '',
  ]
    .join(' ')
    .toLowerCase()

const compareNullableNumbers = (left: number | null, right: number | null) => {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

const compareNullableText = (collator: Intl.Collator, left: string | null, right: string | null) => {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  return collator.compare(left, right)
}

const compareBySortField = (
  collator: Intl.Collator,
  field: FinanceLedgerSortField,
  left: FinanceLedgerCaseDTO,
  right: FinanceLedgerCaseDTO,
) => {
  switch (field) {
    case 'sequence':
      return left.sequence - right.sequence
    case 'project':
      return collator.compare(left.projectName, right.projectName)
    case 'section':
      return compareNullableText(collator, left.sectionLabelFr, right.sectionLabelFr)
    case 'period':
      return left.periodIndex - right.periodIndex
    case 'stage':
      return getLedgerStageIndex(left.currentStage) - getLedgerStageIndex(right.currentStage)
    case 'status':
      return FINANCE_LEDGER_CASE_STATUSES.indexOf(left.status) - FINANCE_LEDGER_CASE_STATUSES.indexOf(right.status)
    case 'accountAmount':
      return compareNullableNumbers(left.accountAmount, right.accountAmount)
    case 'invoiceAmount':
      return compareNullableNumbers(left.invoiceAmount, right.invoiceAmount)
    case 'chequeAmount':
      return compareNullableNumbers(left.chequeAmount, right.chequeAmount)
    case 'waitingDays':
      return left.waitingDays - right.waitingDays
    case 'overdueDays':
      return left.overdueDays - right.overdueDays
    case 'remark':
      return compareNullableText(collator, left.remark, right.remark)
    case 'updatedAt':
    default:
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
  }
}

const mapCase = (
  row: FinanceLedgerCaseRow,
  slaMap: SlaMap,
  now: Date,
): FinanceLedgerCaseDTO => {
  const stageDatesRaw = extractStageDates(row)
  const stageDates = FINANCE_LEDGER_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = stageDatesRaw[stage]?.toISOString() ?? null
      return acc
    },
    {} as FinanceLedgerStageDates,
  )

  const currentStage = row.currentStage ?? null
  const nextStage = getNextLedgerStage(currentStage)
  const enteredAt = row.enteredCurrentStageAt
  const waitingDays =
    !currentStage || row.status === 'DONE' || currentStage === 'CHEQUE_RECEIVED' || !enteredAt
      ? 0
      : diffDays(enteredAt, now)
  const overdueDays =
    !currentStage || !nextStage || row.status === 'DONE'
      ? 0
      : Math.max(0, waitingDays - resolveSlaDays(slaMap, row.projectId, currentStage, nextStage))

  const cycleStart = stageDatesRaw.SITE_SIGNED
  const cycleEnd = stageDatesRaw.CHEQUE_RECEIVED ?? (cycleStart ? now : null)
  const cycleDays = cycleStart && cycleEnd ? diffDays(cycleStart, cycleEnd) : null
  const sectionLabels = row.section
    ? resolveRoadLabels({ slug: row.section.slug, name: row.section.name })
    : null

  return {
    id: row.id,
    sequence: row.sequence,
    projectId: row.projectId,
    projectName: row.project.name,
    projectCode: row.project.code,
    sectionId: row.sectionId ?? null,
    sectionName: row.section?.name ?? null,
    sectionSlug: row.section?.slug ?? null,
    sectionLabelFr: sectionLabels?.fr ?? null,
    periodIndex: row.periodIndex,
    status: row.status,
    currentStage,
    nextStage,
    enteredCurrentStageAt: row.enteredCurrentStageAt?.toISOString() ?? null,
    accountAmount: toNumberOrNull(row.accountAmount),
    invoiceAmount: toNumberOrNull(row.invoiceAmount),
    advanceAmount: toNumberOrNull(row.advanceAmount),
    chequeAmount: toNumberOrNull(row.chequeAmount),
    invoiceNumber: row.invoiceNumber ?? null,
    receiptChequeNumber: row.receiptChequeNumber ?? null,
    remark: row.remark ?? null,
    waitingDays,
    overdueDays,
    isOverdue: overdueDays > 0,
    cycleDays,
    stageDates,
    events: row.events.map(mapEvent),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const buildCaseWhere = (filters: FinanceLedgerCaseFilterOptions): Prisma.FinanceLedgerCaseWhereInput => {
  const andConditions: Prisma.FinanceLedgerCaseWhereInput[] = []
  if (filters.periodMin !== undefined) {
    andConditions.push({ periodIndex: { gte: filters.periodMin } })
  }
  if (filters.periodMax !== undefined) {
    andConditions.push({ periodIndex: { lte: filters.periodMax } })
  }
  if (filters.updatedFrom) {
    andConditions.push({ updatedAt: { gte: new Date(filters.updatedFrom) } })
  }
  if (filters.updatedTo) {
    andConditions.push({ updatedAt: { lte: new Date(filters.updatedTo) } })
  }
  if (filters.search?.trim()) {
    andConditions.push({
      OR: [
        { invoiceNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { receiptChequeNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { remark: { contains: filters.search.trim(), mode: 'insensitive' } },
      ],
    })
  }

  return {
    projectId: filters.projectIds?.length ? { in: filters.projectIds } : undefined,
    sectionId: filters.sectionIds?.length ? { in: filters.sectionIds } : undefined,
    status: filters.statuses?.length ? { in: filters.statuses } : undefined,
    currentStage: filters.stages?.length ? { in: filters.stages } : undefined,
    isDeleted: filters.includeDeleted ? undefined : false,
    AND: andConditions.length ? andConditions : undefined,
  }
}

const listDerivedCases = async (filters: FinanceLedgerCaseFilterOptions): Promise<FinanceLedgerCaseDTO[]> => {
  assertFinanceLedgerModels()
  const where = buildCaseWhere(filters)
  const rows = await prisma.financeLedgerCase.findMany({
    where,
    include: ledgerCaseInclude,
  })

  const projectIds = Array.from(new Set(rows.map((item) => item.projectId)))
  const slaMap = await listSlaMap(projectIds)
  const now = new Date()
  let mapped = rows.map((row) => mapCase(row, slaMap, now))

  if (filters.search?.trim()) {
    const tokens = filters.search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    mapped = mapped.filter((row) => {
      const searchable = buildSearchableText(row)
      return tokens.every((token) => searchable.includes(token))
    })
  }

  if (filters.overdue !== undefined) {
    mapped = mapped.filter((row) => row.isOverdue === filters.overdue)
  }

  const sortStack = filters.sortStack?.length ? filters.sortStack : DEFAULT_FINANCE_LEDGER_SORT_STACK
  const collator = new Intl.Collator('fr-FR', { numeric: true, sensitivity: 'base' })
  mapped.sort((left, right) => {
    for (const sort of sortStack) {
      const cmp = compareBySortField(collator, sort.field, left, right)
      if (cmp !== 0) {
        return sort.order === 'asc' ? cmp : -cmp
      }
    }
    return right.id - left.id
  })

  return mapped
}

const validateSectionOwnership = async (projectId: number, sectionId: number | null | undefined) => {
  if (sectionId == null) return null
  const section = await prisma.roadSection.findUnique({
    where: { id: sectionId },
    select: { id: true, projectId: true },
  })
  if (!section) {
    throw new Error('Section inexistante')
  }
  if (section.projectId != null && section.projectId !== projectId) {
    throw new Error('La section sélectionnée ne correspond pas au projet')
  }
  return section
}

const ensureLedgerProject = async (projectId: number) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, isActive: true },
  })
  if (!project || !project.isActive) {
    throw new Error('Projet introuvable ou inactif')
  }
  return project
}

const getCaseByIdRaw = async (id: number, includeDeleted = false) => {
  const row = await prisma.financeLedgerCase.findFirst({
    where: { id, ...(includeDeleted ? {} : { isDeleted: false }) },
    include: ledgerCaseInclude,
  })
  if (!row) {
    throw new Error('Enregistrement introuvable')
  }
  return row
}

export const listFinanceLedgerMetadata = async (): Promise<FinanceLedgerMetadata> => {
  assertFinanceLedgerModels()
  await ensureFinanceDefaults()

  const [projects, sections] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, code: true },
    }),
    prisma.roadSection.findMany({
      orderBy: [{ projectId: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        projectId: true,
        slug: true,
        name: true,
        startPk: true,
        endPk: true,
      },
    }),
  ])

  return {
    projects,
    sections: sections.map((item) => ({
      ...item,
      labels: resolveRoadLabels({ slug: item.slug, name: item.name }),
    })),
    stages: [...FINANCE_LEDGER_STAGES] as FinanceLedgerStage[],
    statuses: [...FINANCE_LEDGER_CASE_STATUSES] as FinanceLedgerCaseStatus[],
  }
}

export const listFinanceLedgerCases = async (
  filters: FinanceLedgerCaseFilterOptions,
): Promise<FinanceLedgerCaseListResult> => {
  const allRows = await listDerivedCases(filters)
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 20, 200))
  const start = (page - 1) * pageSize
  const end = start + pageSize

  return {
    items: allRows.slice(start, end),
    total: allRows.length,
    page,
    pageSize,
  }
}

export const getFinanceLedgerCase = async (id: number): Promise<FinanceLedgerCaseDTO> => {
  assertFinanceLedgerModels()
  const row = await getCaseByIdRaw(id)
  const slaMap = await listSlaMap([row.projectId])
  return mapCase(row, slaMap, new Date())
}

export const createFinanceLedgerCase = async (
  payload: FinanceLedgerCreateCaseInput,
  userId?: number | null,
): Promise<FinanceLedgerCaseDTO> => {
  assertFinanceLedgerModels()
  if (!Number.isInteger(payload.periodIndex) || payload.periodIndex < 0) {
    throw new Error('La période doit être un entier positif')
  }
  await ensureLedgerProject(payload.projectId)
  await validateSectionOwnership(payload.projectId, payload.sectionId ?? null)

  try {
    const created = await prisma.financeLedgerCase.create({
      data: {
        projectId: payload.projectId,
        periodIndex: payload.periodIndex,
        sectionId: payload.sectionId ?? null,
        createdBy: userId ?? null,
      },
      include: ledgerCaseInclude,
    })
    const slaMap = await listSlaMap([created.projectId])
    return mapCase(created, slaMap, new Date())
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new Error('Ce projet et cette période existent déjà')
    }
    throw error
  }
}

export const updateFinanceLedgerCase = async (
  id: number,
  payload: FinanceLedgerUpdateCaseInput,
  userId?: number | null,
): Promise<FinanceLedgerCaseDTO> => {
  assertFinanceLedgerModels()
  const existing = await getCaseByIdRaw(id, true)
  if (existing.isDeleted) {
    throw new Error('Enregistrement supprimé')
  }

  if (payload.sectionId !== undefined) {
    await validateSectionOwnership(existing.projectId, payload.sectionId)
  }
  if (payload.status) {
    if (payload.status === 'DONE' && existing.currentStage !== 'CHEQUE_RECEIVED') {
      throw new Error('Le statut DONE nécessite une étape finale CHEQUE_RECEIVED')
    }
    if (payload.status === 'IN_PROGRESS' && existing.currentStage === 'CHEQUE_RECEIVED') {
      throw new Error('Le dossier finalisé doit rester en statut DONE')
    }
  }

  const data: Prisma.FinanceLedgerCaseUpdateInput = {
    updatedBy: userId ?? null,
  }
  if (payload.sectionId !== undefined) data.sectionId = payload.sectionId
  if (payload.status !== undefined) data.status = payload.status
  applySnapshotPatch(data, payload)

  const updated = await prisma.financeLedgerCase.update({
    where: { id },
    data,
    include: ledgerCaseInclude,
  })
  const slaMap = await listSlaMap([updated.projectId])
  return mapCase(updated, slaMap, new Date())
}

export const softDeleteFinanceLedgerCase = async (id: number, userId?: number | null) => {
  assertFinanceLedgerModels()
  await getCaseByIdRaw(id, true)
  await prisma.financeLedgerCase.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ?? null,
      updatedBy: userId ?? null,
    },
  })
}

export const createFinanceLedgerEvent = async (
  caseId: number,
  payload: FinanceLedgerCreateEventInput,
  userId?: number | null,
): Promise<FinanceLedgerCaseDTO> => {
  assertFinanceLedgerModels()
  const row = await getCaseByIdRaw(caseId, true)
  if (row.isDeleted) {
    throw new Error('Enregistrement supprimé')
  }

  const stageIndex = getLedgerStageIndex(payload.stage)
  if (stageIndex < 0) {
    throw new Error('Étape invalide')
  }

  const maxExistingIndex = row.events.reduce((max, item) => Math.max(max, getLedgerStageIndex(item.stage)), -1)
  if (stageIndex !== maxExistingIndex + 1) {
    throw new Error('Les étapes doivent être renseignées dans l’ordre')
  }

  if (row.events.some((item) => item.stage === payload.stage)) {
    throw new Error('Cette étape est déjà renseignée')
  }

  const occurredAt = parseDateInput(payload.occurredAt)
  const payloadJson = buildEventPayloadJson(payload)

  const updatedCase = await prisma.$transaction(async (tx) => {
    await tx.financeLedgerEvent.create({
      data: {
        caseId,
        stage: payload.stage,
        occurredAt,
        note: normalizeOptionalText(payload.note),
        payloadJson: payloadJson,
        createdBy: userId ?? null,
      },
    })

    const events = await tx.financeLedgerEvent.findMany({
      where: { caseId },
      select: { stage: true, occurredAt: true },
    })
    const data: Prisma.FinanceLedgerCaseUpdateInput = {
      updatedBy: userId ?? null,
      ...deriveProgressFromEvents(events, row.status),
    }
    applySnapshotPatch(data, payload)

    return tx.financeLedgerCase.update({
      where: { id: caseId },
      data,
      include: ledgerCaseInclude,
    })
  })

  const slaMap = await listSlaMap([updatedCase.projectId])
  return mapCase(updatedCase, slaMap, new Date())
}

export const updateFinanceLedgerEvent = async (
  eventId: number,
  payload: FinanceLedgerUpdateEventInput,
  userId?: number | null,
): Promise<FinanceLedgerCaseDTO> => {
  assertFinanceLedgerModels()
  const event = await prisma.financeLedgerEvent.findUnique({
    where: { id: eventId },
    include: {
      ledgerCase: {
        select: {
          id: true,
          projectId: true,
          status: true,
          isDeleted: true,
        },
      },
    },
  })
  if (!event) {
    throw new Error('Événement introuvable')
  }
  if (event.ledgerCase.isDeleted) {
    throw new Error('Enregistrement supprimé')
  }

  const existingPayload =
    event.payloadJson && typeof event.payloadJson === 'object' && !Array.isArray(event.payloadJson)
      ? { ...(event.payloadJson as Record<string, unknown>) }
      : {}
  const patchPayload = buildEventPayloadJson(payload)
  const nextPayloadJson = { ...existingPayload, ...patchPayload }

  const updatedCase = await prisma.$transaction(async (tx) => {
    await tx.financeLedgerEvent.update({
      where: { id: eventId },
      data: {
        occurredAt: payload.occurredAt ? parseDateInput(payload.occurredAt) : undefined,
        note: payload.note !== undefined ? normalizeOptionalText(payload.note) : undefined,
        payloadJson: nextPayloadJson,
        updatedBy: userId ?? null,
      },
    })

    const events = await tx.financeLedgerEvent.findMany({
      where: { caseId: event.caseId },
      select: { stage: true, occurredAt: true },
    })
    const data: Prisma.FinanceLedgerCaseUpdateInput = {
      updatedBy: userId ?? null,
      ...deriveProgressFromEvents(events, event.ledgerCase.status),
    }
    applySnapshotPatch(data, payload)

    return tx.financeLedgerCase.update({
      where: { id: event.caseId },
      data,
      include: ledgerCaseInclude,
    })
  })

  const slaMap = await listSlaMap([updatedCase.projectId])
  return mapCase(updatedCase, slaMap, new Date())
}

export const getFinanceLedgerInsights = async (
  filters: FinanceLedgerCaseFilterOptions,
): Promise<FinanceLedgerInsights> => {
  const items = await listDerivedCases({ ...filters, page: undefined, pageSize: undefined })
  const stagePairs = FINANCE_LEDGER_STAGES.slice(0, -1).map((stage, index) => ({
    fromStage: stage,
    toStage: FINANCE_LEDGER_STAGES[index + 1],
  }))

  const totalAccountAmount = items.reduce((sum, item) => sum + (item.accountAmount ?? 0), 0)
  const totalInvoiceAmount = items.reduce((sum, item) => sum + (item.invoiceAmount ?? 0), 0)
  const totalChequeAmount = items.reduce((sum, item) => sum + (item.chequeAmount ?? 0), 0)
  const cycleValues = items.map((item) => item.cycleDays).filter((value): value is number => value !== null)
  const averageCycleDays = cycleValues.length
    ? Math.round((cycleValues.reduce((sum, item) => sum + item, 0) / cycleValues.length) * 10) / 10
    : 0
  const overdueCount = items.filter((item) => item.isOverdue).length

  const stageFunnel = FINANCE_LEDGER_STAGES.map((stage) => {
    const stageCases = items.filter((item) => item.currentStage === stage)
    return {
      stage,
      count: stageCases.length,
      amount: Math.round(
        stageCases.reduce((sum, item) => sum + (item.invoiceAmount ?? item.accountAmount ?? 0), 0) * 100,
      ) / 100,
    }
  })

  const projectProgressMap = new Map<
    number,
    {
      projectId: number
      projectName: string
      projectCode: string | null
      counts: Map<FinanceLedgerStage, { count: number; amount: number }>
    }
  >()
  items.forEach((item) => {
    if (!projectProgressMap.has(item.projectId)) {
      projectProgressMap.set(item.projectId, {
        projectId: item.projectId,
        projectName: item.projectName,
        projectCode: item.projectCode,
        counts: new Map(),
      })
    }
    if (!item.currentStage) return
    const stageValue = projectProgressMap.get(item.projectId)!.counts.get(item.currentStage)
    const amount = item.invoiceAmount ?? item.accountAmount ?? 0
    if (stageValue) {
      stageValue.count += 1
      stageValue.amount += amount
    } else {
      projectProgressMap.get(item.projectId)!.counts.set(item.currentStage, { count: 1, amount })
    }
  })
  const projectProgress = Array.from(projectProgressMap.values())
    .map((item) => ({
      projectId: item.projectId,
      projectName: item.projectName,
      projectCode: item.projectCode,
      stageCounts: FINANCE_LEDGER_STAGES.map((stage) => ({
        stage,
        count: item.counts.get(stage)?.count ?? 0,
        amount: Math.round((item.counts.get(stage)?.amount ?? 0) * 100) / 100,
      })),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, 'fr-FR'))

  const monthMap = new Map<string, { invoiceAmount: number; chequeAmount: number }>()
  items.forEach((item) => {
    const invoiceDate = item.stageDates.HQ_INVOICE_RECEIVED
    if (invoiceDate) {
      const date = new Date(invoiceDate)
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      if (!monthMap.has(key)) monthMap.set(key, { invoiceAmount: 0, chequeAmount: 0 })
      monthMap.get(key)!.invoiceAmount += item.invoiceAmount ?? item.accountAmount ?? 0
    }
    const chequeDate = item.stageDates.CHEQUE_RECEIVED
    if (chequeDate) {
      const date = new Date(chequeDate)
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      if (!monthMap.has(key)) monthMap.set(key, { invoiceAmount: 0, chequeAmount: 0 })
      monthMap.get(key)!.chequeAmount += item.chequeAmount ?? item.invoiceAmount ?? item.accountAmount ?? 0
    }
  })
  let cumulativeInvoice = 0
  let cumulativeCheque = 0
  const monthlyFlow = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, values]) => {
      cumulativeInvoice += values.invoiceAmount
      cumulativeCheque += values.chequeAmount
      return {
        month,
        invoiceAmount: Math.round(values.invoiceAmount * 100) / 100,
        chequeAmount: Math.round(values.chequeAmount * 100) / 100,
        cumulativeInvoiceAmount: Math.round(cumulativeInvoice * 100) / 100,
        cumulativeChequeAmount: Math.round(cumulativeCheque * 100) / 100,
      }
    })

  const agingBuckets: FinanceLedgerInsights['agingBuckets'] = [
    { bucket: '0-7', count: 0, amount: 0 },
    { bucket: '8-15', count: 0, amount: 0 },
    { bucket: '16-30', count: 0, amount: 0 },
    { bucket: '31-60', count: 0, amount: 0 },
    { bucket: '60+', count: 0, amount: 0 },
  ]

  items
    .filter((item) => item.status !== 'DONE')
    .forEach((item) => {
      const amount = item.invoiceAmount ?? item.accountAmount ?? 0
      if (item.waitingDays <= 7) {
        agingBuckets[0].count += 1
        agingBuckets[0].amount += amount
      } else if (item.waitingDays <= 15) {
        agingBuckets[1].count += 1
        agingBuckets[1].amount += amount
      } else if (item.waitingDays <= 30) {
        agingBuckets[2].count += 1
        agingBuckets[2].amount += amount
      } else if (item.waitingDays <= 60) {
        agingBuckets[3].count += 1
        agingBuckets[3].amount += amount
      } else {
        agingBuckets[4].count += 1
        agingBuckets[4].amount += amount
      }
    })

  agingBuckets.forEach((bucket) => {
    bucket.amount = Math.round(bucket.amount * 100) / 100
  })

  const transitionAgg = new Map<
    string,
    {
      fromStage: FinanceLedgerStage
      toStage: FinanceLedgerStage
      count: number
      durations: number[]
      totalDays: number
      overdueCount: number
      impactAmount: number
      overdueImpactAmount: number
      slaDays: number
    }
  >()
  const insightProjectIds = Array.from(new Set(items.map((item) => item.projectId)))
  const insightSlaMap = await listSlaMap(insightProjectIds)

  items.forEach((item) => {
    stagePairs.forEach((pair) => {
      const startText = item.stageDates[pair.fromStage]
      const endText = item.stageDates[pair.toStage]
      if (!startText || !endText) return
      const duration = diffDays(new Date(startText), new Date(endText))
      const key = buildLedgerTransitionKey(pair.fromStage, pair.toStage)
      const amount = item.invoiceAmount ?? item.accountAmount ?? 0
      const slaDays = resolveSlaDays(insightSlaMap, item.projectId, pair.fromStage, pair.toStage)
      if (!transitionAgg.has(key)) {
        transitionAgg.set(key, {
          fromStage: pair.fromStage,
          toStage: pair.toStage,
          count: 0,
          durations: [],
          totalDays: 0,
          overdueCount: 0,
          impactAmount: 0,
          overdueImpactAmount: 0,
          slaDays,
        })
      }
      const slot = transitionAgg.get(key)!
      slot.count += 1
      slot.totalDays += duration
      slot.durations.push(duration)
      slot.impactAmount += amount
      if (duration > slot.slaDays) {
        slot.overdueCount += 1
        slot.overdueImpactAmount += amount
      }
    })
  })

  const transitionOrder = new Map<string, number>()
  stagePairs.forEach((pair, index) => {
    transitionOrder.set(buildLedgerTransitionKey(pair.fromStage, pair.toStage), index)
  })

  const transitionStats = Array.from(transitionAgg.entries())
    .map(([key, value]) => ({
      fromStage: value.fromStage,
      toStage: value.toStage,
      count: value.count,
      averageDays: value.count ? Math.round((value.totalDays / value.count) * 10) / 10 : 0,
      p90Days: p90(value.durations),
      slaDays: value.slaDays,
      overdueCount: value.overdueCount,
      overdueRate: value.count ? Math.round((value.overdueCount / value.count) * 1000) / 10 : 0,
      impactAmount: Math.round(value.impactAmount * 100) / 100,
      overdueImpactAmount: Math.round(value.overdueImpactAmount * 100) / 100,
      __order: transitionOrder.get(key) ?? 999,
    }))
    .sort((a, b) => a.__order - b.__order)
    .map(({ __order, ...rest }) => rest)

  const bottlenecks = [...transitionStats]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.overdueRate !== a.overdueRate) return b.overdueRate - a.overdueRate
      if (b.p90Days !== a.p90Days) return b.p90Days - a.p90Days
      return b.overdueImpactAmount - a.overdueImpactAmount
    })
    .slice(0, 5)

  return {
    summary: {
      caseCount: items.length,
      totalAccountAmount: Math.round(totalAccountAmount * 100) / 100,
      totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
      totalChequeAmount: Math.round(totalChequeAmount * 100) / 100,
      receiptRate: totalInvoiceAmount > 0 ? Math.round((totalChequeAmount / totalInvoiceAmount) * 1000) / 10 : 0,
      averageCycleDays,
      overdueCount,
    },
    stageFunnel,
    projectProgress,
    monthlyFlow,
    agingBuckets,
    transitionStats,
    bottlenecks,
  }
}

export const financeLedgerSortFieldSet = new Set<FinanceLedgerSortField>(FINANCE_LEDGER_SORT_FIELDS)
