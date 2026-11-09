import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBoqWorkSummary, emptyBoqWorkSummary, normalizeWorkUnit, parseBoqWorkPlanInput, workDecimal } from '../lib/value/boqWorkPlanRules'
import type { BoqWorkConfirmedSnapshot, BoqWorkPlanPostInput, BoqWorkPrice, BoqWorkScope } from '../lib/value/boqWorkPlans'

const baseline = 'a'.repeat(64)
const scopeA = '1e2d3c4b-1234-4567-89ab-abcdef123456'
const scopeB = '2e2d3c4b-1234-4567-89ab-abcdef123456'
const scopeC = '3e2d3c4b-1234-4567-89ab-abcdef123456'
const price = (overrides: Partial<BoqWorkPrice> = {}): BoqWorkPrice => ({ unitPrice: '50000', confirmed: true, basis: 'ORIGINAL', evidence: 'Synthetic approved price evidence', ...overrides })
const scope = (overrides: Partial<BoqWorkScope> = {}): BoqWorkScope => ({
  id: scopeA, description: 'Synthetic road A left side PK 0–80', roadId: 1, startPk: '0', endPk: '80', side: 'LEFT', spec: null, unit: 'ml',
  completionState: 'COMPLETED', scopeBasis: 'ORIGINAL', quantity: '80', quantityConfirmed: true, quantityEvidence: 'Synthetic manual range confirmation', approvalEvidence: '', price: null, ...overrides,
})
const input = (overrides: Partial<BoqWorkPlanPostInput> = {}): BoqWorkPlanPostInput => ({ lineKey: 'xlsx-row-70', expectedVersion: null, action: 'confirm', scopeComplete: true, scopes: [scope()], price: price(), reason: 'Synthetic deliberate manual confirmation', baselineHash: baseline, ...overrides })
const snapshot = (overrides: Partial<BoqWorkConfirmedSnapshot> = {}): BoqWorkConfirmedSnapshot => ({
  action: 'confirm', version: 1, scopeComplete: true, scopes: [scope()], price: price(), baselineHash: baseline,
  signedCumulativeQuantity: '1000', signedCumulativeAmountHt: '45000000', confirmedAt: '2026-10-23T12:00:00.000Z', confirmedById: 1, reason: 'Synthetic confirmation', ...overrides,
})
const item = { cumulativeQuantity: '1000', cumulativeAmountHt: '45000000' }

test('an absent confirmation remains unknown rather than an inferred zero remainder', () => {
  const summary = buildBoqWorkSummary(item, null, baseline, true)
  assert.equal(summary.signedCumulativeQuantity, '1000')
  for (const value of [summary.completedUnbilledQuantity, summary.notCompletedUnbilledQuantity, summary.remainingQuantity, summary.remainingAmountHt, summary.forecastFinalQuantity, summary.forecastFinalAmountHt]) assert.equal(value, null)
  assert.equal(summary.ready, false)
  assert.equal(emptyBoqWorkSummary(null).signedCumulativeQuantity, null)
})

test('incomplete scope coverage or an unconfirmed scope quantity cannot establish a final forecast', () => {
  for (const current of [snapshot({ scopeComplete: false }), snapshot({ scopes: [scope(), scope({ id: scopeB, quantity: null, quantityConfirmed: false })] })]) {
    const summary = buildBoqWorkSummary(item, current, baseline, true)
    assert.equal(summary.ready, false)
    assert.equal(summary.remainingQuantity, null)
    assert.equal(summary.forecastFinalQuantity, null)
    assert.equal(summary.forecastFinalAmountHt, null)
  }
})

test('partial physical completion and pending change quantities stay separate and conserve the manually confirmed remainder', () => {
  const current = snapshot({ scopes: [scope(), scope({ id: scopeB, completionState: 'NOT_COMPLETED', quantity: '220' }), scope({ id: scopeC, completionState: 'UNKNOWN', quantity: '60', scopeBasis: 'PENDING_CHANGE', price: price({ unitPrice: '60000', basis: 'PROVISIONAL' }) })] })
  const before = structuredClone(current)
  const summary = buildBoqWorkSummary(item, current, baseline, true)
  assert.equal(summary.completedUnbilledQuantity, '80')
  assert.equal(summary.notCompletedUnbilledQuantity, '220')
  assert.equal(summary.unknownCompletionQuantity, '60')
  assert.equal(summary.approvedRemainingQuantity, '300')
  assert.equal(summary.pendingRemainingQuantity, '60')
  assert.equal(summary.remainingQuantity, '360')
  assert.equal(summary.forecastFinalQuantity, '1300')
  assert.equal(summary.forecastIncludingPendingQuantity, '1360')
  assert.equal(summary.remainingAmountHt, '15000000')
  assert.equal(summary.pendingAmountHt, '3600000')
  // Historical 1000 ml stay valued at their signed 45 million, not the new 50,000 rate.
  assert.equal(summary.forecastFinalAmountHt, '60000000')
  assert.deepEqual(current, before)
})

test('a provisional price cannot enter approved forecast amount even after its estimate is manually confirmed', () => {
  const summary = buildBoqWorkSummary(item, snapshot({ price: price({ basis: 'PROVISIONAL' }) }), baseline, true)
  assert.equal(summary.approvedRemainingQuantity, '80')
  assert.equal(summary.forecastFinalQuantity, '1080')
  assert.equal(summary.remainingAmountHt, null)
  assert.equal(summary.forecastFinalAmountHt, null)
  assert.equal(summary.missingPriceCount, 1)
})

test('unknown prices remain unknown, while an explicitly confirmed zero price remains a real zero', () => {
  for (const unresolved of [null, price({ unitPrice: null, confirmed: false, basis: 'UNKNOWN', evidence: '' }), price({ confirmed: false })]) {
    const summary = buildBoqWorkSummary(item, snapshot({ price: unresolved }), baseline, true)
    assert.equal(summary.remainingAmountHt, null)
    assert.equal(summary.forecastFinalAmountHt, null)
  }
  const zero = buildBoqWorkSummary(item, snapshot({ price: price({ unitPrice: '0', evidence: 'Explicit synthetic zero price' }) }), baseline, true)
  assert.equal(zero.remainingAmountHt, '0')
  assert.equal(zero.forecastFinalAmountHt, '45000000')
})

test('confirm-none is deliberate and cannot fill an unknown signed baseline with zero', () => {
  assert.throws(() => parseBoqWorkPlanInput(input({ action: 'confirm-none', scopes: [], scopeComplete: false })))
  assert.throws(() => parseBoqWorkPlanInput(input({ action: 'confirm-none' })))
  const accepted = parseBoqWorkPlanInput(input({ action: 'confirm-none', scopes: [], price: null }))
  const current = snapshot({ action: 'confirm-none', scopes: [], price: null })
  const summary = buildBoqWorkSummary(item, current, baseline, true)
  assert.equal(accepted.action, 'confirm-none')
  assert.equal(summary.remainingQuantity, '0')
  assert.equal(summary.forecastFinalQuantity, '1000')
  assert.equal(summary.forecastFinalAmountHt, '45000000')
  const unknownBaseline = buildBoqWorkSummary({ cumulativeQuantity: null, cumulativeAmountHt: null }, current, baseline, true)
  assert.equal(unknownBaseline.forecastFinalQuantity, null)
  assert.equal(unknownBaseline.forecastFinalAmountHt, null)
})

test('a changed baseline invalidates the forecast for the current editable context', () => {
  const summary = buildBoqWorkSummary(item, snapshot(), 'b'.repeat(64), true)
  assert.equal(summary.ready, false)
  assert.equal(summary.remainingQuantity, null)
  assert.equal(summary.forecastFinalAmountHt, null)
})

test('historical read-only views retain the confirmed historical baseline and label that summary', () => {
  const summary = buildBoqWorkSummary({ cumulativeQuantity: '3000', cumulativeAmountHt: '180000000' }, snapshot(), 'b'.repeat(64), false)
  assert.equal('historical' in summary && summary.historical, true)
  assert.equal(summary.ready, true)
  assert.equal(summary.signedCumulativeQuantity, '1000')
  assert.equal(summary.remainingQuantity, '80')
  assert.equal(summary.forecastFinalQuantity, '1080')
  assert.equal(summary.forecastFinalAmountHt, '49000000')
  const unconfirmedHistory = buildBoqWorkSummary(item, null, baseline, false)
  assert.equal(unconfirmedHistory.ready, false)
  assert.equal(unconfirmedHistory.forecastFinalQuantity, null)
})

test('drafts can preserve uncertainty; confirmation requires explicit quantity and scope units', () => {
  const draft = parseBoqWorkPlanInput(input({ action: 'save-draft', scopeComplete: false, scopes: [scope({ quantity: null, quantityConfirmed: false, unit: null })], price: null }))
  assert.equal(draft.scopes[0].quantity, null)
  assert.equal(draft.scopes[0].quantityConfirmed, false)
  assert.throws(() => parseBoqWorkPlanInput({ ...draft, action: 'confirm' }))
  const explicitZero = parseBoqWorkPlanInput(input({ scopes: [scope({ quantity: '0' })] }))
  assert.equal(explicitZero.scopes[0].quantity, '0')
})

test('optional remarks retain action audit records without inventing quantity evidence', () => {
  for (const reason of ['', '  ', null, undefined]) {
    const accepted = parseBoqWorkPlanInput({ ...input({ scopes: [scope({ quantityEvidence: '' })] }), reason })
    assert.equal(accepted.reason, '页面确认待计量范围')
    assert.equal(accepted.scopes[0].quantityEvidence, '页面逐行确认数量')
    assert.equal(accepted.scopes[0].quantity, '80')
  }
  assert.equal(parseBoqWorkPlanInput(input({ action: 'save-draft', reason: '' })).reason, '页面保存待计量草稿')
  assert.equal(parseBoqWorkPlanInput(input({ action: 'confirm-none', scopes: [], reason: '' })).reason, '页面确认无剩余')
  const remarked = parseBoqWorkPlanInput(input({ reason: '  现场复核  ', scopes: [scope({ quantityEvidence: '' })] }))
  assert.equal(remarked.reason, '现场复核')
  assert.equal(remarked.scopes[0].quantityEvidence, '现场复核')
  for (const reason of [1, {}, [], 'bad\0remark', 'a'.repeat(2001)]) assert.throws(() => parseBoqWorkPlanInput({ ...input(), reason }))
  assert.throws(() => parseBoqWorkPlanInput(input({ reason: '', scopes: [scope({ quantityConfirmed: false })] })))
})

test('remaining quantities cannot be negative reversals or imprecise JavaScript numbers', () => {
  for (const invalid of ['-1', '1e3', '', 'NaN', 'Infinity', 0, 1.25, undefined, '100000000000000000000', '0.1234567890123456789']) {
    assert.throws(() => parseBoqWorkPlanInput(input({ scopes: [scope({ quantity: invalid as string })] })))
  }
  const precise = '99999999999999999999.123456789012345678'
  assert.equal(workDecimal(precise, 'Synthetic quantity'), precise)
  assert.equal(workDecimal('-1.25', 'Synthetic reversal preflight', true), '-1.25')
})

test('UUID identity is case independent just as PostgreSQL UUID identity, preventing double counted snapshot scopes', () => {
  assert.throws(() => parseBoqWorkPlanInput(input({ scopes: [scope(), scope({ id: scopeA.toUpperCase(), quantity: '20' })] })))
  const parsed = parseBoqWorkPlanInput(input({ scopes: [scope({ id: scopeA.toUpperCase() })] }))
  assert.equal(parsed.scopes[0].id, scopeA)
})

test('approved changes require approval evidence and source line identity remains explicit', () => {
  assert.throws(() => parseBoqWorkPlanInput(input({ scopes: [scope({ scopeBasis: 'APPROVED_CHANGE', approvalEvidence: '' })] })))
  const approved = parseBoqWorkPlanInput(input({ lineKey: 'xlsx-row-85', scopes: [scope({ scopeBasis: 'APPROVED_CHANGE', approvalEvidence: 'Synthetic approved variation' })] }))
  assert.equal(approved.lineKey, 'xlsx-row-85')
  assert.equal(approved.scopes[0].scopeBasis, 'APPROVED_CHANGE')
  assert.equal(normalizeWorkUnit('m²'), normalizeWorkUnit('m2'))
  assert.equal(normalizeWorkUnit(' ml '), normalizeWorkUnit('m'))
  assert.notEqual(normalizeWorkUnit('个'), normalizeWorkUnit('ml'))
  assert.notEqual(normalizeWorkUnit('m3'), normalizeWorkUnit('m2'))
})
