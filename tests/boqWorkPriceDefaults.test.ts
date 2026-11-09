import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBoqWorkSummary } from '../lib/value/boqWorkPlanRules'
import { defaultBoqWorkPlanPrice, isSignedWorkPrice, signedWorkPrice, workScopePrice } from '../lib/value/boqWorkPriceDefaults'
import type { BoqWorkConfirmedSnapshot, BoqWorkPlanItemDto, BoqWorkPrice, BoqWorkScope } from '../lib/value/boqWorkPlans'

const item = { sourceKind: 'SIGNED_LINE' as const, sourceUnitPrice: '60000000.000000000000000001', lineKey: 'xlsx-row-16', code: '001', unit: 'Fft' }
const scope = (patch: Partial<BoqWorkScope> = {}): BoqWorkScope => ({ id: '1e2d3c4b-1234-4567-89ab-abcdef123456', description: 'Remaining original scope', roadId: null, startPk: null, endPk: null, side: null, spec: null, unit: 'Fft', completionState: 'NOT_COMPLETED', scopeBasis: 'ORIGINAL', quantity: '0.2', quantityConfirmed: true, quantityEvidence: 'User confirmation', approvalEvidence: '', price: null, ...patch })
const candidate = (patch: Partial<BoqWorkPrice> = {}): BoqWorkPrice => ({ unitPrice: null, confirmed: false, basis: 'UNKNOWN', evidence: '', ...patch })

test('original remaining work inherits only the selected signed line exact rate without another price confirmation', () => {
  for (const price of [null, candidate(), candidate({ unitPrice: item.sourceUnitPrice, basis: 'ORIGINAL' })]) {
    const before = structuredClone({ item, price })
    const inherited = defaultBoqWorkPlanPrice(item, 23, [scope()], price)
    assert.equal(inherited?.unitPrice, item.sourceUnitPrice)
    assert.equal(inherited?.confirmed, true)
    assert.equal(inherited?.basis, 'ORIGINAL')
    assert.match(inherited!.evidence, /#23.*001.*xlsx-row-16/)
    assert.ok(isSignedWorkPrice(item, inherited))
    assert.deepEqual({ item, price }, before)
  }
  const equivalent = defaultBoqWorkPlanPrice({ ...item, sourceUnitPrice: '60000000' }, 23, [scope()], candidate({ unitPrice: '060000000.00', basis: 'ORIGINAL' }))
  assert.equal(equivalent?.unitPrice, '60000000')
  assert.equal(equivalent?.confirmed, true)
})

test('custom, explicitly confirmed, variation and independent scope prices are preserved', () => {
  const independent = candidate({ unitPrice: '62000000', confirmed: true, basis: 'APPROVED_CHANGE', evidence: 'Approved special rate' })
  for (const price of [candidate({ unitPrice: '60000001', basis: 'ORIGINAL' }), candidate({ unitPrice: item.sourceUnitPrice, confirmed: true, basis: 'ORIGINAL', evidence: 'Existing explicit evidence' }), candidate({ basis: 'APPROVED_CHANGE' }), candidate({ basis: 'PROVISIONAL' })]) {
    assert.strictEqual(defaultBoqWorkPlanPrice(item, 23, [scope()], price), price)
  }
  const row = scope({ price: independent })
  const inherited = defaultBoqWorkPlanPrice(item, 23, [row], null)
  assert.strictEqual(workScopePrice(row, inherited), independent)
  assert.strictEqual(row.price, independent)
})

test('missing signed prices, template-only items and variation-only plans are not auto priced', () => {
  for (const source of [{ ...item, sourceKind: 'TEMPLATE_ITEM' as const }, { ...item, sourceUnitPrice: null }, { ...item, sourceUnitPrice: 'NaN' }, { ...item, sourceUnitPrice: '-1' }]) {
    assert.equal(signedWorkPrice(source, 23), null)
    assert.equal(defaultBoqWorkPlanPrice(source, 23, [scope()], null), null)
  }
  for (const scopeBasis of ['APPROVED_CHANGE', 'PENDING_CHANGE'] as const) {
    assert.equal(defaultBoqWorkPlanPrice(item, 23, [scope({ scopeBasis })], null), null)
    assert.equal(workScopePrice(scope({ scopeBasis }), signedWorkPrice(item, 23)), null)
  }
  const zero = signedWorkPrice({ ...item, sourceUnitPrice: '0' }, 23)
  assert.equal(zero?.unitPrice, '0')
  assert.equal(zero?.confirmed, true)
})

test('original rate values only original scopes and keeps pending or approved changes separately unresolved', () => {
  const baseline = 'a'.repeat(64)
  const snapshot: BoqWorkConfirmedSnapshot = { scopes: [scope(), scope({ id: '2e2d3c4b-1234-4567-89ab-abcdef123456', scopeBasis: 'PENDING_CHANGE', quantity: '0.1' })], scopeComplete: true, price: signedWorkPrice({ ...item, sourceUnitPrice: '60000000' }, 23), baselineHash: baseline, action: 'confirm', version: 1, signedCumulativeQuantity: '0.8', signedCumulativeAmountHt: '48000000', confirmedAt: '2026-10-23T00:00:00Z', confirmedById: 1, reason: 'Confirmed scope' }
  const source: Pick<BoqWorkPlanItemDto, 'cumulativeQuantity' | 'cumulativeAmountHt' | 'sourceKind'> = { sourceKind: 'SIGNED_LINE', cumulativeQuantity: '0.8', cumulativeAmountHt: '48000000' }
  const summary = buildBoqWorkSummary(source, snapshot, baseline, true)
  assert.equal(summary.remainingAmountHt, '12000000')
  assert.equal(summary.forecastFinalAmountHt, '60000000')
  assert.equal(summary.pendingAmountHt, null)
  assert.equal(summary.missingPriceCount, 1)
  snapshot.scopes[1].scopeBasis = 'APPROVED_CHANGE'
  const approved = buildBoqWorkSummary(source, snapshot, baseline, true)
  assert.equal(approved.remainingAmountHt, null)
  assert.equal(approved.forecastFinalAmountHt, null)
})
