import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  emptyWorkScope,
  initialWorkPlanDraft,
  SignedBillWorkPlanPanel,
  WorkPlanConfirmedScopes,
  WorkPlanQuantitySummary,
  workPlanInputError,
  workPlanPostInput,
} from '../components/value/SignedBillWorkPlanPanel'
import type { BoqWorkDraft, BoqWorkPlanItemDto, BoqWorkScope } from '../lib/value/boqWorkPlans'

const format = (value: string | null | undefined) => value ?? '—'
const scope = (overrides: Partial<BoqWorkScope> = {}): BoqWorkScope => ({
  ...emptyWorkScope('m3', 'scope-1'), description: 'Voie A · partie restante', roadId: 1,
  startPk: '10', endPk: '20', side: 'G', completionState: 'COMPLETED',
  quantity: '200.123400000000000001', quantityConfirmed: true, quantityEvidence: 'Mesure vérifiée', ...overrides,
})
const item = (overrides: Partial<BoqWorkPlanItemDto> = {}): BoqWorkPlanItemDto => ({
  lineKey: 'source-row-17', sourceKind: 'SIGNED_LINE', sourceRow: 17, boqItemId: 1,
  code: '101a', designation: 'Excavation', unit: 'm3', sourceUnitPrice: '123.456789012345678',
  previousQuantity: '600', currentQuantity: '100', cumulativeQuantity: '700', cumulativeAmountHt: '70000',
  state: 'UNCONFIRMED', plan: null,
  summary: { signedCumulativeQuantity: '700', completedUnbilledQuantity: null, notCompletedUnbilledQuantity: null,
    unknownCompletionQuantity: null, approvedRemainingQuantity: null, pendingRemainingQuantity: null,
    remainingQuantity: null, forecastFinalQuantity: null, forecastIncludingPendingQuantity: null,
    remainingAmountHt: null, pendingAmountHt: null, forecastFinalAmountHt: null, missingPriceCount: 0, ready: false },
  ...overrides,
})
const draft = (overrides: Partial<BoqWorkDraft> = {}): BoqWorkDraft => ({ scopeComplete: false, scopes: [], price: null, baselineHash: 'baseline-a', ...overrides })
const confirmed = (action: 'confirm' | 'confirm-none' = 'confirm'): BoqWorkPlanItemDto => {
  const source = item()
  const snapshot = { ...draft({ scopeComplete: true, scopes: action === 'confirm-none' ? [] : [scope()] }), action,
    version: 1, signedCumulativeQuantity: '700', signedCumulativeAmountHt: '70000', confirmedAt: '2026-01-01T00:00:00.000Z', confirmedById: 1, reason: 'Verified site scope' }
  return { ...source, state: action === 'confirm-none' ? 'CONFIRMED_NONE' : 'CONFIRMED',
    plan: { id: 1, version: 1, state: action === 'confirm-none' ? 'CONFIRMED_NONE' : 'CONFIRMED', draft: snapshot, confirmedSnapshot: snapshot, updatedAt: snapshot.confirmedAt },
    summary: { ...source.summary, completedUnbilledQuantity: action === 'confirm-none' ? '0' : '200.123400000000000001',
      notCompletedUnbilledQuantity: '0', remainingQuantity: action === 'confirm-none' ? '0' : '200.123400000000000001',
      forecastFinalQuantity: action === 'confirm-none' ? '700' : '900.123400000000000001' } }
}

test('initial remaining quantities are unconfirmed, while signed cumulative remains visible', () => {
  const html = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: item(), locale: 'zh', formatValue: format }))
  assert.match(html, /累计已计量/)
  assert.match(html, /700 m3/)
  assert.match(html, /已完成待计量/)
  assert.match(html, /未完成待计量/)
  assert.equal((html.match(/未确认/g) ?? []).length, 6)
  assert.doesNotMatch(html, />0 m3</)
})

test('new original form uses the signed rate with no extra price verification and does not infer remaining quantities', () => {
  const source = item()
  const before = structuredClone(source)
  const initial = initialWorkPlanDraft(source, 23, 'baseline-a')
  assert.equal(initial.price?.unitPrice, source.sourceUnitPrice)
  assert.equal(initial.price?.confirmed, true)
  assert.equal(initial.price?.basis, 'ORIGINAL')
  assert.match(initial.price!.evidence, /#23.*101a.*source-row-17/)
  assert.deepEqual(initial.scopes, [])
  assert.equal(initial.scopeComplete, false)
  assert.deepEqual(source, before)
  const payload = workPlanPostInput(source, { ...initial, scopes: [scope()] }, 'confirm', 'User confirms quantity', 'baseline-a')
  assert.equal(workPlanInputError(payload, 'zh'), null)
  assert.equal(payload.price?.confirmed, true)
  const template = initialWorkPlanDraft(item({ sourceKind: 'TEMPLATE_ITEM' }), 23, 'baseline-a')
  assert.equal(template.price, null)
})

test('template-only source values are labelled as unverified measured scope in Chinese and French', () => {
  const template = item({ sourceKind: 'TEMPLATE_ITEM', cumulativeQuantity: '15', summary: { ...item().summary, signedCumulativeQuantity: null } })
  const props = { item: template, revisionId: 7, baselineHash: 'baseline-a', roads: [], editAllowed: false, readOnlyReason: null, formatValue: format, onSaved: () => {} }
  const zh = renderToStaticMarkup(createElement(SignedBillWorkPlanPanel, { ...props, locale: 'zh' }))
  assert.match(zh, /未关联签字行，已计量及最终量待核/)
  assert.doesNotMatch(zh, /15 m3/)
  const fr = renderToStaticMarkup(createElement(SignedBillWorkPlanPanel, { ...props, locale: 'fr' }))
  assert.match(fr, /Ligne signée non associée/)
  assert.match(fr, /cumul mesuré et quantité finale à vérifier/)
  assert.equal(template.cumulativeQuantity, '15')
})

test('explicit no remaining displays zero and changed drafts stay outside confirmed totals', () => {
  const none = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: confirmed('confirm-none'), locale: 'fr', formatValue: format }))
  assert.match(none, /0 m3/)
  const saved = confirmed()
  saved.state = 'DRAFT'
  saved.plan = { ...saved.plan!, state: 'DRAFT', version: 2, draft: draft({ scopes: [scope({ quantity: '99999' })] }) }
  const html = renderToStaticMarkup(createElement(SignedBillWorkPlanPanel, { item: saved, revisionId: 7, baselineHash: 'baseline-a', roads: [{ id: 1, name: 'Voie A', slug: 'a' }], editAllowed: false, readOnlyReason: null, locale: 'zh', formatValue: format, onSaved: () => {} }))
  assert.match(html, /200.123400000000000001 m3/)
  const confirmedSummary = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: saved, locale: 'zh', formatValue: format }))
  assert.doesNotMatch(confirmedSummary, /99999/)
  assert.match(html, /草稿待核 \(1\)/)
  assert.match(html, /99999 m3/)
  assert.match(html, /未计入已确认合计/)
  assert.match(html, /草稿未计入/)
  assert.doesNotMatch(html, /<input|<textarea|type="submit"/)
})

test('confirmed detail is visible read-only with location, completion, separate price, and remarks last', () => {
  const saved = confirmed()
  saved.plan!.confirmedSnapshot!.scopes = [scope({ price: { unitPrice: '123.456789012345678', confirmed: true, basis: 'ORIGINAL', evidence: 'Prix du marché' } })]
  const html = renderToStaticMarkup(createElement(WorkPlanConfirmedScopes, { item: saved, roads: [{ id: 1, name: 'Voie A', slug: 'a' }], locale: 'zh', formatValue: format }))
  assert.match(html, /Voie A/)
  assert.match(html, /PK 10 → 20/)
  assert.match(html, /已完成/)
  assert.match(html, /123.456789012345678/)
  assert.match(html, /原合同范围/)
  assert.ok(html.indexOf('sbwp-confirmed-note') > html.indexOf('完成状态 / 单价'))
  assert.match(html, /Mesure vérifiée/)
  assert.doesNotMatch(html, /原件定位/)
})

test('stale baseline cannot appear as valid current remaining or forecast', () => {
  const stale = { ...confirmed(), state: 'NEEDS_REVIEW' as const }
  const html = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: stale, locale: 'zh', formatValue: format }))
  assert.match(html, /700 m3/)
  assert.doesNotMatch(html, /200.123400000000000001|900.123400000000000001/)
  assert.match(html, /未确认/)
})

test('historical confirmed forecast stays visible with an explicit historical label', () => {
  const historical = confirmed()
  historical.summary = { ...historical.summary, historical: true }
  const html = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: historical, locale: 'fr', formatValue: format }))
  assert.match(html, /Instantané historique/)
  assert.match(html, /non la prévision actuelle/)
  assert.match(html, /900.123400000000000001 m3/)
})

test('partial completion is submitted as separate stable scopes, without changing signed quantities or adopting prices', () => {
  const source = item()
  const form = draft({ scopes: [scope(), scope({ id: 'scope-2', completionState: 'NOT_COMPLETED', quantity: '300' })] })
  const payload = workPlanPostInput(source, form, 'confirm', ' Site verification ', 'baseline-a')
  assert.deepEqual(payload.scopes.map((row) => [row.id, row.completionState, row.quantity]), [['scope-1', 'COMPLETED', '200.123400000000000001'], ['scope-2', 'NOT_COMPLETED', '300']])
  assert.equal(payload.lineKey, 'source-row-17')
  assert.equal(payload.expectedVersion, null)
  assert.equal(payload.price, null)
  assert.equal(payload.reason, 'Site verification')
  assert.equal(source.cumulativeQuantity, '700')
  assert.equal(source.sourceUnitPrice, '123.456789012345678')
  assert.equal(workPlanInputError(payload, 'zh'), null)
})

test('blank stays null, draft quantity does not become confirmed, and explicit none is the only zero remainder action', () => {
  const source = item()
  const form = draft({ scopes: [scope({ quantity: ' ', quantityConfirmed: false })] })
  const payload = workPlanPostInput(source, form, 'save-draft', 'Working draft', 'baseline-a')
  assert.equal(payload.scopes[0].quantity, null)
  assert.equal(payload.scopes[0].quantityConfirmed, false)
  assert.equal(workPlanInputError(payload, 'fr'), null)
  assert.match(workPlanInputError({ ...payload, action: 'confirm' }, 'fr')!, /vérifiez les quantités/)
  const none = workPlanPostInput(confirmed(), form, 'confirm-none', 'No remaining scope', 'baseline-a')
  assert.deepEqual(none.scopes, [])
  assert.equal(none.scopeComplete, true)
  assert.equal(none.expectedVersion, 1)
  assert.equal(workPlanInputError(none, 'zh'), null)
})

test('price confirmation requires its own basis and evidence, independent from quantity', () => {
  const payload = workPlanPostInput(item(), draft({ scopes: [scope()], price: { unitPrice: '10', confirmed: false, basis: 'UNKNOWN', evidence: '' } }), 'confirm', 'Quantity confirmed only', 'baseline-a')
  assert.equal(workPlanInputError(payload, 'zh'), null)
  assert.match(workPlanInputError({ ...payload, price: { ...payload.price!, confirmed: true } }, 'zh')!, /单价前/)
  assert.match(workPlanInputError({ ...payload, scopes: [scope({ quantity: '-2' })] }, 'zh')!, /非负十进制/)
  assert.match(workPlanInputError({ ...payload, scopes: [scope({ quantity: '1,000' })] }, 'fr')!, /décimaux/)
})

test('optional remarks submit as trimmed text without blocking quantity confirmation', () => {
  for (const locale of ['zh', 'fr'] as const) {
    const payload = workPlanPostInput(item(), draft({ scopes: [scope()] }), 'confirm', '  ', 'baseline-a')
    assert.equal(payload.reason, '')
    assert.equal(workPlanInputError(payload, locale), null)
    assert.equal(workPlanPostInput(item(), draft(), 'save-draft', '  Note  ', 'baseline-a').reason, 'Note')
  }
})

test('pending changes have their own forecast scenario and do not relabel the approved forecast', () => {
  const pending = confirmed()
  pending.summary = { ...pending.summary, forecastFinalQuantity: '900', pendingRemainingQuantity: '50', forecastIncludingPendingQuantity: '950', pendingAmountHt: '5000' }
  const html = renderToStaticMarkup(createElement(WorkPlanQuantitySummary, { item: pending, locale: 'zh', formatValue: format }))
  assert.match(html, /已批准范围预计最终量/)
  assert.match(html, /900 m3/)
  assert.match(html, /含待批范围的预计最终量/)
  assert.match(html, /950 m3/)
  assert.match(html, /待批范围情景估值 HT/)
})
