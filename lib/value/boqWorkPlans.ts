/** Work plans are independent of signed bills. All decimal values are exact strings. */
export type BoqWorkCompletionState = 'COMPLETED' | 'NOT_COMPLETED' | 'UNKNOWN'
export type BoqWorkScopeBasis = 'ORIGINAL' | 'APPROVED_CHANGE' | 'PENDING_CHANGE'
export type BoqWorkPriceBasis = 'ORIGINAL' | 'APPROVED_CHANGE' | 'PROVISIONAL' | 'UNKNOWN'
export type BoqWorkPlanState = 'UNCONFIRMED' | 'DRAFT' | 'CONFIRMED' | 'CONFIRMED_NONE' | 'NEEDS_REVIEW'

export type BoqWorkPrice = {
  unitPrice: string | null
  confirmed: boolean
  basis: BoqWorkPriceBasis
  evidence: string
}

export type BoqWorkScope = {
  /** Stable UUID supplied by the client or generated on first save. */
  id: string
  description: string
  roadId: number | null
  startPk: string | null
  endPk: string | null
  side: string | null
  spec: string | null
  unit: string | null
  completionState: BoqWorkCompletionState
  scopeBasis: BoqWorkScopeBasis
  quantity: string | null
  quantityConfirmed: boolean
  quantityEvidence: string
  approvalEvidence: string
  /** Null means use the plan price; a scope price is otherwise independent. */
  price: BoqWorkPrice | null
}

export type BoqWorkDraft = {
  scopeComplete: boolean
  scopes: BoqWorkScope[]
  price: BoqWorkPrice | null
  baselineHash: string
}

export type BoqWorkConfirmedSnapshot = BoqWorkDraft & {
  action: 'confirm' | 'confirm-none'
  version: number
  signedCumulativeQuantity: string | null
  signedCumulativeAmountHt: string | null
  confirmedAt: string
  confirmedById: number
  reason: string
}

export type BoqWorkPlanDto = {
  id: number
  version: number
  state: BoqWorkPlanState
  draft: BoqWorkDraft
  confirmedSnapshot: BoqWorkConfirmedSnapshot | null
  updatedAt: string
}

export type BoqWorkSummary = {
  historical?: boolean
  signedCumulativeQuantity: string | null
  completedUnbilledQuantity: string | null
  notCompletedUnbilledQuantity: string | null
  unknownCompletionQuantity: string | null
  approvedRemainingQuantity: string | null
  pendingRemainingQuantity: string | null
  remainingQuantity: string | null
  /** Approved/original remaining scope only; pending changes are a separate scenario. */
  forecastFinalQuantity: string | null
  forecastIncludingPendingQuantity: string | null
  remainingAmountHt: string | null
  pendingAmountHt: string | null
  forecastFinalAmountHt: string | null
  missingPriceCount: number
  ready: boolean
}

export type BoqWorkPlanItemDto = {
  lineKey: string
  sourceKind: 'SIGNED_LINE' | 'TEMPLATE_ITEM' | 'SOURCE_ACTIVITY'
  /** Unmapped original DETAIL record identities belonging to a SOURCE_ACTIVITY header. */
  sourceRecordIds?: string[]
  sourceRow: number | null
  boqItemId: number | null
  code: string | null
  designation: string
  unit: string | null
  sourceUnitPrice: string | null
  previousQuantity: string | null
  currentQuantity: string | null
  cumulativeQuantity: string | null
  cumulativeAmountHt: string | null
  state: BoqWorkPlanState
  plan: BoqWorkPlanDto | null
  summary: BoqWorkSummary
}

export type BoqWorkPlansResponse = {
  revisionId: number
  projectId: number
  periodIndex: number
  editAllowed: boolean
  readOnlyReason: string | null
  baselineHash: string
  items: BoqWorkPlanItemDto[]
  roads: Array<{ id: number; name: string; slug: string }>
}

export type BoqWorkPlanPostInput = {
  lineKey: string
  expectedVersion: number | null
  action: 'save-draft' | 'confirm' | 'confirm-none'
  scopeComplete: boolean
  scopes: BoqWorkScope[]
  price?: BoqWorkPrice | null
  reason: string
  baselineHash: string
}

export type BoqWorkPlanPostResponse = { item: BoqWorkPlanItemDto; baselineHash: string }

export type BoqWorkMatchPreflightInput = {
  lineKey: string
  expectedVersion: number
  baselineHash: string
  proposals: Array<{ scopeId: string; signedRevisionId: number; lineKey: string; deltaQuantity: string }>
}

export type BoqWorkMatchPreflightResponse = {
  /** Only an empty preflight can be valid until successor binding is supported. */
  valid: boolean
  matched: false
  unsupportedReason: string | null
  errors: string[]
  proposals: BoqWorkMatchPreflightInput['proposals']
  /** Diagnostic arithmetic only, not verified matching or an authorized allocation. */
  signedDeltaTotal: string
  allocatedDeltaTotal: string
  remainingAfter: Array<{ scopeId: string; quantity: string | null }>
  written: false
}

export class BoqWorkPlanError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'BoqWorkPlanError' }
}
