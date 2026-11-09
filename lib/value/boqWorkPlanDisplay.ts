import { workScopePrice } from './boqWorkPriceDefaults'
import type { BoqWorkPlanItemDto, BoqWorkPlanPostInput, BoqWorkPrice, BoqWorkScope } from './boqWorkPlans'
import type { SignedCalculationRecord } from './signedBillCalculations'

export type WorkScopeDisplayState = 'missing' | 'remaining' | 'none'
export type WorkScopeMissingField = 'quantity' | 'unit' | 'price'
const nonnegative = (value: string | null | undefined): value is string => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
const positive = (value: string) => /[1-9]/.test(value)
const normalizeUnit = (unit: string) => unit.toLowerCase().replace(/\s/g, '').replace(/²/g, '2').replace(/³/g, '3').replace(/^ml$/, 'm')

export { addWorkQuantities, formatWorkQuantity, normalizeWorkQuantity } from '@/lib/boq/quantityDecimal'

export function workScopeReadiness(scope: BoqWorkScope, itemUnit: string | null, planPrice: BoqWorkPrice | null): { state: WorkScopeDisplayState; missing: WorkScopeMissingField[] } {
  const missing: WorkScopeMissingField[] = []
  if (!scope.quantityConfirmed || !nonnegative(scope.quantity)) missing.push('quantity')
  if (!scope.unit?.trim() || !itemUnit?.trim() || normalizeUnit(scope.unit) !== normalizeUnit(itemUnit)) missing.push('unit')
  const price = workScopePrice(scope, planPrice)
  if (!price?.confirmed || !nonnegative(price.unitPrice) || price.basis === 'UNKNOWN' || !price.evidence.trim()) missing.push('price')
  return { state: missing.length ? 'missing' : positive(scope.quantity!) ? 'remaining' : 'none', missing }
}

const priceFields = (price: BoqWorkPrice | null) => price === null ? null : [price.unitPrice, price.confirmed, price.basis, price.evidence]
const scopeFields = (scope: BoqWorkScope, planPrice: BoqWorkPrice | null) => [scope.description, scope.roadId, scope.startPk, scope.endPk, scope.side, scope.spec, scope.unit, scope.completionState, scope.scopeBasis, scope.quantity, scope.quantityConfirmed, scope.quantityEvidence, scope.approvalEvidence, priceFields(scope.price), priceFields(workScopePrice(scope, planPrice))]

/** UUID identifies the scope; unchanged saved fields are not repeated under the draft. */
export function changedWorkDraftScopes(item: BoqWorkPlanItemDto): BoqWorkScope[] {
  if (!item.plan) return []
  const confirmed = new Map((item.plan.confirmedSnapshot?.scopes ?? []).map((scope) => [scope.id, scope]))
  return item.plan.draft.scopes.filter((scope) => {
    const prior = confirmed.get(scope.id)
    return !prior || JSON.stringify(scopeFields(prior, item.plan!.confirmedSnapshot?.price ?? null)) !== JSON.stringify(scopeFields(scope, item.plan!.draft.price))
  })
}

export function workPlanReadiness(item: BoqWorkPlanItemDto | undefined): WorkScopeDisplayState {
  if (item?.sourceKind === 'SOURCE_ACTIVITY') return 'missing'
  if (!item?.plan) return 'none'
  const snapshot = item.plan.confirmedSnapshot
  const states = [
    ...(snapshot?.scopes ?? []).map((scope) => workScopeReadiness(scope, item.unit, snapshot?.price ?? null).state),
    ...changedWorkDraftScopes(item).map((scope) => workScopeReadiness(scope, item.unit, item.plan!.draft.price).state),
  ]
  return states.includes('missing') ? 'missing' : states.includes('remaining') ? 'remaining' : 'none'
}

export function workPlanAllowedActions(item: Pick<BoqWorkPlanItemDto, 'sourceKind'>): BoqWorkPlanPostInput['action'][] {
  return item.sourceKind === 'SOURCE_ACTIVITY' ? ['save-draft'] : ['save-draft', 'confirm', 'confirm-none']
}

/** Only the server-declared source identities establish this read-only relationship. */
export function sourceActivityRecords(item: BoqWorkPlanItemDto, records: SignedCalculationRecord[]): SignedCalculationRecord[] {
  if (item.sourceKind !== 'SOURCE_ACTIVITY') return []
  const recordIds = new Set(item.sourceRecordIds ?? [])
  return records.filter((record) => recordIds.has(record.recordId) && record.rowType === 'DETAIL' && record.lineKeys.length === 0)
}

/** Activity cards already display their declared rows; keep other unmapped rows available for review. */
export function unassignedWorkCalculationRecords(records: SignedCalculationRecord[], items: BoqWorkPlanItemDto[]): SignedCalculationRecord[] {
  const displayed = new Set(items.flatMap((item) => sourceActivityRecords(item, records).map((record) => record.recordId)))
  return records.filter((record) => !displayed.has(record.recordId) && record.lineKeys.length === 0 && (record.rowType === 'DETAIL' || (record.rowType === 'ITEM_HEADER' && (record.billingState === 'MEASURED' || record.billingState === 'ADJUSTMENT'))))
}

export function workPlanReadinessClass(state: WorkScopeDisplayState) {
  return state === 'missing' ? 'border-rose-200 bg-rose-50 text-rose-800' : state === 'remaining' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'
}
