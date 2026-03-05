export const FINANCE_LEDGER_STAGES = [
  'SITE_SIGNED',
  'HQ_BILL_RECEIVED',
  'BE_CONFIRMED',
  'BE_DELIVERED',
  'HQ_INVOICE_RECEIVED',
  'CHEQUE_ISSUED',
  'CHEQUE_RECEIVED',
] as const

export type FinanceLedgerStageKey = (typeof FINANCE_LEDGER_STAGES)[number]

export const FINANCE_LEDGER_CASE_STATUSES = ['IN_PROGRESS', 'DONE', 'BLOCKED'] as const

export type FinanceLedgerCaseStatusKey = (typeof FINANCE_LEDGER_CASE_STATUSES)[number]

export const FINANCE_LEDGER_SORT_FIELDS = [
  'sequence',
  'project',
  'section',
  'period',
  'constructionStartedAt',
  'constructionFinishedAt',
  'stage',
  'status',
  'accountAmount',
  'invoiceAmount',
  'chequeAmount',
  'waitingDays',
  'overdueDays',
  'updatedAt',
  'remark',
] as const

export type FinanceLedgerSortField = (typeof FINANCE_LEDGER_SORT_FIELDS)[number]
export type FinanceLedgerSortOrder = 'asc' | 'desc'

export type FinanceLedgerSortSpec = {
  field: FinanceLedgerSortField
  order: FinanceLedgerSortOrder
}

export const DEFAULT_FINANCE_LEDGER_SORT_STACK: FinanceLedgerSortSpec[] = [
  { field: 'updatedAt', order: 'desc' },
]

export const FINANCE_LEDGER_DEFAULT_SLA_DAYS: Record<string, number> = {
  SITE_SIGNED__HQ_BILL_RECEIVED: 7,
  HQ_BILL_RECEIVED__BE_CONFIRMED: 5,
  BE_CONFIRMED__BE_DELIVERED: 3,
  BE_DELIVERED__HQ_INVOICE_RECEIVED: 7,
  HQ_INVOICE_RECEIVED__CHEQUE_ISSUED: 14,
  CHEQUE_ISSUED__CHEQUE_RECEIVED: 3,
}

export const buildLedgerTransitionKey = (fromStage: string, toStage: string) =>
  `${fromStage}__${toStage}`

export const getLedgerStageIndex = (stage: string | null | undefined) =>
  stage ? FINANCE_LEDGER_STAGES.indexOf(stage as FinanceLedgerStageKey) : -1

export const getNextLedgerStage = (stage: string | null | undefined): FinanceLedgerStageKey | null => {
  const index = getLedgerStageIndex(stage)
  if (index < 0) return FINANCE_LEDGER_STAGES[0]
  return FINANCE_LEDGER_STAGES[index + 1] ?? null
}
