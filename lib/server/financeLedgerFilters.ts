import { FinanceLedgerCaseStatus, FinanceLedgerStage } from '@prisma/client'

import { type FinanceLedgerSortSpec } from '@/lib/finance/ledgerConstants'
import { financeLedgerSortFieldSet, type FinanceLedgerCaseFilterOptions } from '@/lib/server/financeLedgerStore'

const toNumber = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toNumberArray = (values: string[]) =>
  values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

const isLedgerStatus = (value: string): value is FinanceLedgerCaseStatus =>
  value === 'IN_PROGRESS' || value === 'DONE' || value === 'BLOCKED'

const isLedgerStage = (value: string): value is FinanceLedgerStage =>
  value === 'SITE_SIGNED' ||
  value === 'HQ_BILL_RECEIVED' ||
  value === 'BE_CONFIRMED' ||
  value === 'BE_DELIVERED' ||
  value === 'HQ_INVOICE_RECEIVED' ||
  value === 'CHEQUE_ISSUED' ||
  value === 'CHEQUE_RECEIVED'

const parseSortStack = (values: string[]): FinanceLedgerSortSpec[] => {
  const stack: FinanceLedgerSortSpec[] = []
  values.forEach((value) => {
    const [fieldRaw, orderRaw] = value.split(':')
    const field = fieldRaw?.trim()
    const order = orderRaw?.trim()
    if (!field || !financeLedgerSortFieldSet.has(field as FinanceLedgerSortSpec['field'])) return
    if (order !== 'asc' && order !== 'desc') return
    stack.push({
      field: field as FinanceLedgerSortSpec['field'],
      order,
    })
  })
  return stack
}

export const parseFinanceLedgerFilters = (searchParams: URLSearchParams): FinanceLedgerCaseFilterOptions => {
  const projectIds = toNumberArray(searchParams.getAll('projectId'))
  const sectionIds = toNumberArray(searchParams.getAll('sectionId'))
  const statuses = searchParams.getAll('status').filter(isLedgerStatus)
  const stages = searchParams.getAll('stage').filter(isLedgerStage)
  const overdueRaw = searchParams.get('overdue')
  const overdue = overdueRaw === 'true' ? true : overdueRaw === 'false' ? false : undefined
  const search = searchParams.get('search')?.trim() || undefined
  const periodMin = toNumber(searchParams.get('periodMin'))
  const periodMax = toNumber(searchParams.get('periodMax'))
  const page = toNumber(searchParams.get('page'))
  const pageSize = toNumber(searchParams.get('pageSize'))
  const updatedFrom = searchParams.get('updatedFrom') || undefined
  const updatedTo = searchParams.get('updatedTo') || undefined
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const sortStack = parseSortStack(searchParams.getAll('sort'))

  return {
    projectIds: projectIds.length ? projectIds : undefined,
    sectionIds: sectionIds.length ? sectionIds : undefined,
    statuses: statuses.length ? statuses : undefined,
    stages: stages.length ? stages : undefined,
    overdue,
    search,
    periodMin,
    periodMax,
    page: page && page > 0 ? page : undefined,
    pageSize: pageSize && pageSize > 0 ? pageSize : undefined,
    updatedFrom,
    updatedTo,
    includeDeleted,
    sortStack: sortStack.length ? sortStack : undefined,
  }
}

