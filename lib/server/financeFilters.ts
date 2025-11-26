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

export const parseFinanceFilters = (searchParams: URLSearchParams): FinanceEntryFilterOptions => {
  const projectIds = toNumberArray(searchParams.getAll('projectId'))
  const paymentTypeIds = toNumberArray(searchParams.getAll('paymentTypeId'))
  const handlerIds = toNumberArray(searchParams.getAll('handlerId'))
  const amountMin = toNumber(searchParams.get('amountMin'))
  const amountMax = toNumber(searchParams.get('amountMax'))
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const categoryKeys = searchParams
    .getAll('categoryKey')
    .map((key) => key.trim())
    .filter(Boolean)
  const reasonKeyword = searchParams.get('reasonKeyword')?.trim() || undefined
  const includeDeleted = searchParams.get('includeDeleted') === 'true'

  return {
    projectIds: projectIds.length ? projectIds : undefined,
    paymentTypeIds: paymentTypeIds.length ? paymentTypeIds : undefined,
    handlerIds: handlerIds.length ? handlerIds : undefined,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    categoryKeys: categoryKeys.length ? categoryKeys : undefined,
    reasonKeyword,
    includeDeleted,
  }
}
