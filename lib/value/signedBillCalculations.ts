/** Source values are decimal strings; an empty source cell is null, never zero. */
export type CalculationBillingState = 'MEASURED' | 'UNMEASURED' | 'ADJUSTMENT' | 'UNKNOWN'
export type CalculationCompletionState = 'COMPLETED' | 'UNKNOWN'
export type CalculationQuantityField = 'previousQuantity' | 'currentQuantity' | 'cumulativeQuantity' | 'calculatedQuantity'
export type SignedCalculationQuantityCorrection = {
  field: CalculationQuantityField
  cell: string
  oldNumericValue: string | null
  newNumericValue: string | null
  reason: string
  evidence: string
}
export type SignedCalculationUnitCorrection = {
  oldUnit: string | null
  newUnit: string
  reason: string
  evidence: string
}
export type SignedCalculationItem = {
  lineKey: string
  sourceRow: number
  code: string
  designation: string
  unit: string | null
  unitPrice: string | null
  previousQuantity: string | null
  currentQuantity: string | null
  cumulativeQuantity: string | null
  previousAmountHt: string | null
  currentAmountHt: string | null
  cumulativeAmountHt: string | null
  archivedLine: boolean
  notes?: string[]
}
export type SignedCalculationRecord = {
  id: number
  recordId: string
  lineKeys: string[]
  rowType: string
  road: string | null
  structure: string | null
  description: string | null
  side: string | null
  pkStart: string | null
  pkEnd: string | null
  locationNote?: string | null
  unit: string | null
  dimensions: Array<{ label: string; value: string | null; cell: string }>
  calculatedQuantity: string | null
  formula: string | null
  previousQuantity: string | null
  currentQuantity: string | null
  cumulativeQuantity: string | null
  billingState: CalculationBillingState
  billingNote?: string | null
  correctionNote?: string | null
  quantityCorrections?: SignedCalculationQuantityCorrection[]
  unitCorrection?: SignedCalculationUnitCorrection | null
  completionState: CalculationCompletionState
  completionEvidence: string | null
  sourceNote: string | null
  note: string | null
  updatedAt: string
  sourceSheet: string
  sourceRow: number
  sourceRange: string
}
export type SignedCalculationReviewDto = {
  revisionId: number
  available: boolean
  reviewKey?: string
  sourceFileId?: number
  sourceFileName?: string
  sourceSha256?: string
  importedAt?: string
  sourceVerification?: string
  items: SignedCalculationItem[]
  records: SignedCalculationRecord[]
  coverage?: { sourceRows: number; detailRows: number; subtotalRows: number; templateItems: number; pricedItems: number }
  completionCandidates?: Array<{ id: number; code: string; road: string | null; side: string | null; pkStart: string | null; pkEnd: string | null; quantity: string | null; unit: string | null; note: string; status: string }>
}

export function classifyCalculationBilling(previous: string | null, current: string | null, cumulative: string | null): CalculationBillingState {
  const values = [previous, current, cumulative].filter((value): value is string => value !== null)
  if (values.some((value) => /^-/.test(value) && !/^-0+(?:\.0+)?$/.test(value))) return 'ADJUSTMENT'
  if (values.some((value) => !/^[+-]?0+(?:\.0+)?$/.test(value))) return 'MEASURED'
  return cumulative !== null ? 'UNMEASURED' : 'UNKNOWN'
}
