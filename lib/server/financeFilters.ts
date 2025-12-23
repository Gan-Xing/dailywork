import { PaymentStatus } from '@prisma/client'

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

const toPaymentStatus = (value: string | null): PaymentStatus | undefined =>
  value === 'PENDING' || value === 'PAID' ? value : undefined

export const parseFinanceFilters = (searchParams: URLSearchParams): FinanceEntryFilterOptions => {
  const projectIds = toNumberArray(searchParams.getAll('projectId'))
  const paymentTypeIds = toNumberArray(searchParams.getAll('paymentTypeId'))
  const handlerIds = toNumberArray(searchParams.getAll('handlerId'))
  const paymentStatus = toPaymentStatus(searchParams.get('paymentStatus'))
  const amountMin = toNumber(searchParams.get('amountMin'))
  const amountMax = toNumber(searchParams.get('amountMax'))
  const page = toNumber(searchParams.get('page'))
  const pageSize = toNumber(searchParams.get('pageSize'))
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const categoryKeys = searchParams
    .getAll('categoryKey')
    .map((key) => key.trim())
    .filter(Boolean)
  const reasonKeyword = searchParams.get('reasonKeyword')?.trim() || undefined
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const sortField = (searchParams.get('sortField') as FinanceEntryFilterOptions['sortField']) || undefined
  const sortDir = (searchParams.get('sortDir') as FinanceEntryFilterOptions['sortDir']) || undefined

  return {
    projectIds: projectIds.length ? projectIds : undefined,
    paymentTypeIds: paymentTypeIds.length ? paymentTypeIds : undefined,
    paymentStatus,
    handlerIds: handlerIds.length ? handlerIds : undefined,
    amountMin,
    amountMax,
    page: page && page > 0 ? page : undefined,
    pageSize: pageSize && pageSize > 0 ? pageSize : undefined,
    dateFrom,
    dateTo,
    categoryKeys: categoryKeys.length ? categoryKeys : undefined,
    reasonKeyword,
    includeDeleted,
    sortField,
    sortDir,
  }
}
