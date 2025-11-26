import { FinanceEntryFilterOptions } from '@/lib/server/financeStore'

const toNumber = (value: string | null) => {
  if (!value) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export const parseFinanceFilters = (searchParams: URLSearchParams): FinanceEntryFilterOptions => {
  const projectId = toNumber(searchParams.get('projectId'))
  const paymentTypeId = toNumber(searchParams.get('paymentTypeId'))
  const amountMin = toNumber(searchParams.get('amountMin'))
  const amountMax = toNumber(searchParams.get('amountMax'))
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const categoryKey = searchParams.get('categoryKey') || undefined
  const reasonKeyword = searchParams.get('reasonKeyword')?.trim() || undefined
  const includeDeleted = searchParams.get('includeDeleted') === 'true'

  return {
    projectId,
    paymentTypeId,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    categoryKey,
    reasonKeyword,
    includeDeleted,
  }
}
