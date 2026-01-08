export const FINANCE_SORT_FIELDS = [
  'sequence',
  'project',
  'category',
  'reason',
  'amount',
  'unit',
  'paymentType',
  'paymentDate',
  'paymentStatus',
  'handler',
  'createdBy',
  'updatedBy',
  'remark',
  'tax',
  'updatedAt',
] as const

export type FinanceSortField = (typeof FINANCE_SORT_FIELDS)[number]

export type FinanceSortOrder = 'asc' | 'desc'

export type FinanceSortSpec = {
  field: FinanceSortField
  order: FinanceSortOrder
}

export const DEFAULT_FINANCE_SORT_STACK: FinanceSortSpec[] = [
  { field: 'paymentDate', order: 'desc' },
]
