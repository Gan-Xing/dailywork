import { PaymentStatus } from '@prisma/client'

import {
  FINANCE_SORT_FIELDS,
  type FinanceSortField,
  type FinanceSortSpec,
} from '@/lib/finance/constants'
import { FinanceEntryFilterOptions } from '@/lib/server/financeStore'

const toNumber = (value: string | null) => {
  if (!value) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

const toNumberArray = (values: string[]) =>
  values
    .map((value) => Number(value))
    .filter((num) => Number.isFinite(num))

const toPaymentStatuses = (values: string[]) =>
  values.filter((value): value is PaymentStatus => value === 'PENDING' || value === 'PAID')

const financeSortFieldSet = new Set<FinanceSortField>(FINANCE_SORT_FIELDS)

const parseSortStack = (values: string[]): FinanceSortSpec[] => {
  const stack: FinanceSortSpec[] = []
  values.forEach((value) => {
    const [fieldRaw, orderRaw] = value.split(':')
    const field = fieldRaw?.trim() as FinanceSortField
    const order = orderRaw?.trim()
    if (!financeSortFieldSet.has(field)) return
    if (order !== 'asc' && order !== 'desc') return
    stack.push({ field, order })
  })
  return stack
}

export const parseFinanceFilters = (searchParams: URLSearchParams): FinanceEntryFilterOptions => {
  const projectIds = toNumberArray(searchParams.getAll('projectId'))
  const unitIds = toNumberArray(searchParams.getAll('unitId'))
  const paymentTypeIds = toNumberArray(searchParams.getAll('paymentTypeId'))
  const handlerIds = toNumberArray(searchParams.getAll('handlerId'))
  const createdByIds = toNumberArray(searchParams.getAll('createdBy'))
  const updatedByIds = toNumberArray(searchParams.getAll('updatedBy'))
  const paymentStatuses = toPaymentStatuses(searchParams.getAll('paymentStatus'))
  const amountMin = toNumber(searchParams.get('amountMin'))
  const amountMax = toNumber(searchParams.get('amountMax'))
  const taxMin = toNumber(searchParams.get('taxMin'))
  const taxMax = toNumber(searchParams.get('taxMax'))
  const sequenceMin = toNumber(searchParams.get('sequenceMin'))
  const sequenceMax = toNumber(searchParams.get('sequenceMax'))
  const page = toNumber(searchParams.get('page'))
  const pageSize = toNumber(searchParams.get('pageSize'))
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const updatedFrom = searchParams.get('updatedFrom') || undefined
  const updatedTo = searchParams.get('updatedTo') || undefined
  const categoryKeys = searchParams
    .getAll('categoryKey')
    .map((key) => key.trim())
    .filter(Boolean)
  const reasonKeyword = searchParams.get('reasonKeyword')?.trim() || undefined
  const remarkKeyword = searchParams.get('remarkKeyword')?.trim() || undefined
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const sortStack = parseSortStack(searchParams.getAll('sort'))
  const sortField = (searchParams.get('sortField') as FinanceEntryFilterOptions['sortField']) || undefined
  const sortDir = (searchParams.get('sortDir') as FinanceEntryFilterOptions['sortDir']) || undefined

  return {
    projectIds: projectIds.length ? projectIds : undefined,
    unitIds: unitIds.length ? unitIds : undefined,
    paymentTypeIds: paymentTypeIds.length ? paymentTypeIds : undefined,
    paymentStatuses: paymentStatuses.length ? paymentStatuses : undefined,
    handlerIds: handlerIds.length ? handlerIds : undefined,
    createdByIds: createdByIds.length ? createdByIds : undefined,
    updatedByIds: updatedByIds.length ? updatedByIds : undefined,
    amountMin,
    amountMax,
    taxMin,
    taxMax,
    sequenceMin,
    sequenceMax,
    page: page && page > 0 ? page : undefined,
    pageSize: pageSize && pageSize > 0 ? pageSize : undefined,
    dateFrom,
    dateTo,
    updatedFrom,
    updatedTo,
    categoryKeys: categoryKeys.length ? categoryKeys : undefined,
    reasonKeyword,
    remarkKeyword,
    includeDeleted,
    sortStack: sortStack.length ? sortStack : undefined,
    sortField,
    sortDir,
  }
}
