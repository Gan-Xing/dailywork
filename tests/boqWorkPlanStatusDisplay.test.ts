import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SignedBillWorkPlanPanel, WorkPlanDraftScopes } from '../components/value/SignedBillWorkPlanPanel'
import { changedWorkDraftScopes, formatWorkQuantity, sourceActivityRecords, unassignedWorkCalculationRecords, workPlanAllowedActions, workPlanReadiness, workScopeReadiness } from '../lib/value/boqWorkPlanDisplay'
import type { BoqWorkDraft, BoqWorkPlanItemDto, BoqWorkPrice, BoqWorkScope } from '../lib/value/boqWorkPlans'
import type { SignedCalculationRecord } from '../lib/value/signedBillCalculations'

const rate: BoqWorkPrice = { unitPrice: '11000', confirmed: true, basis: 'ORIGINAL', evidence: 'Exact signed source rate' }
const scope = (overrides: Partial<BoqWorkScope> = {}): BoqWorkScope => ({ id: 'scope-a', description: 'Verified remaining scope', roadId: 1, startPk: '10', endPk: '20', side: 'CD', spec: null, unit: 'm3', completionState: 'COMPLETED', scopeBasis: 'ORIGINAL', quantity: '3.185', quantityConfirmed: true, quantityEvidence: 'Verified dimensions', approvalEvidence: '', price: null, ...overrides })
const draft = (scopes: BoqWorkScope[], price: BoqWorkPrice | null = rate): BoqWorkDraft => ({ scopeComplete: false, scopes, price, baselineHash: 'baseline' })
const item = (): BoqWorkPlanItemDto => ({ lineKey: 'xlsx-row-26', sourceKind: 'SIGNED_LINE', sourceRow: 26, boqItemId: null, code: '105b', designation: 'Concrete demolition', unit: 'm3', sourceUnitPrice: '11000', previousQuantity: '600', currentQuantity: '100', cumulativeQuantity: '700', cumulativeAmountHt: '7000000', state: 'UNCONFIRMED', plan: null, summary: { signedCumulativeQuantity: '700', completedUnbilledQuantity: null, notCompletedUnbilledQuantity: null, unknownCompletionQuantity: null, approvedRemainingQuantity: null, pendingRemainingQuantity: null, remainingQuantity: null, forecastFinalQuantity: null, forecastIncludingPendingQuantity: null, remainingAmountHt: null, pendingAmountHt: null, forecastFinalAmountHt: null, missingPriceCount: 0, ready: false } })
const draftedItem = (scopes: BoqWorkScope[], price: BoqWorkPrice | null = rate): BoqWorkPlanItemDto => ({ ...item(), state: 'DRAFT', plan: { id: 1, version: 1, state: 'DRAFT', draft: draft(scopes, price), confirmedSnapshot: null, updatedAt: '2026-10-24T00:00:00Z' } })
const moneyFormat = (value: string | null | undefined) => value == null ? '—' : Number(value).toFixed(2)
const render = (source: BoqWorkPlanItemDto) => renderToStaticMarkup(createElement(SignedBillWorkPlanPanel, { item: source, revisionId: 23, baselineHash: 'baseline', roads: [{ id: 1, name: 'Voie 1 A', slug: 'voie-1-a' }], editAllowed: true, readOnlyReason: null, locale: 'zh', formatValue: moneyFormat, onSaved: () => {} }))

test('work quantities preserve significant decimals and do not round through Number', () => {
  for (const value of ['3.185', '28.065', '200.123400000000000001', '99999999999999999999.123456789012345678']) assert.equal(formatWorkQuantity(value), value)
  assert.equal(formatWorkQuantity('03.185000'), '3.185')
  assert.equal(formatWorkQuantity('0.000'), '0')
  assert.equal(formatWorkQuantity('-0.000'), '0')
  assert.equal(formatWorkQuantity('-3.185'), '-3.185')
  assert.equal(formatWorkQuantity(null, '未确认'), '未确认')
  assert.equal(formatWorkQuantity('invalid'), '—')
})

test('missing quantity, unit and effective price are red before known positive remainder is yellow', () => {
  assert.deepEqual(workScopeReadiness(scope(), 'm³', rate), { state: 'remaining', missing: [] })
  assert.deepEqual(workScopeReadiness(scope({ quantity: null, quantityConfirmed: false }), 'm3', rate), { state: 'missing', missing: ['quantity'] })
  assert.deepEqual(workScopeReadiness(scope({ quantityConfirmed: false }), 'm3', rate), { state: 'missing', missing: ['quantity'] })
  for (const missing of [scope({ unit: null }), scope({ unit: 'ml' })]) assert.deepEqual(workScopeReadiness(missing, 'm3', rate), { state: 'missing', missing: ['unit'] })
  assert.deepEqual(workScopeReadiness(scope(), null, rate), { state: 'missing', missing: ['unit'] })
  for (const missing of [null, { ...rate, confirmed: false }, { ...rate, unitPrice: null }, { ...rate, basis: 'UNKNOWN' as const }]) assert.deepEqual(workScopeReadiness(scope(), 'm3', missing), { state: 'missing', missing: ['price'] })
  assert.deepEqual(workScopeReadiness(scope({ scopeBasis: 'APPROVED_CHANGE' }), 'm3', rate), { state: 'missing', missing: ['price'] }, 'An original rate must not silently price a changed scope')
  assert.equal(workScopeReadiness(scope({ completionState: 'UNKNOWN' }), 'm3', rate).state, 'remaining', 'Completion stays a separate explicit state')
})

test('explicit zero quantity and price are known values, with no yellow remainder at zero', () => {
  assert.deepEqual(workScopeReadiness(scope({ quantity: '0.000' }), 'm3', { ...rate, unitPrice: '0' }), { state: 'none', missing: [] })
  assert.deepEqual(workScopeReadiness(scope(), 'm3', { ...rate, unitPrice: '0.000' }), { state: 'remaining', missing: [] })
  assert.equal(workScopeReadiness(scope({ quantity: '0', quantityConfirmed: false }), 'm3', rate).state, 'missing')
  assert.equal(workPlanReadiness(item()), 'none')
  const noRemaining = draftedItem([])
  noRemaining.state = 'CONFIRMED_NONE'
  assert.equal(workPlanReadiness(noRemaining), 'none')
})

test('draft-only missing dimensions are visible by default as red scopes without implying zero or changing data', () => {
  const source = draftedItem([scope({ quantity: null, quantityConfirmed: false, quantityEvidence: '缺尺寸，待现场复核' })], null)
  source.sourceKind = 'TEMPLATE_ITEM'
  source.summary.signedCumulativeQuantity = null
  const before = structuredClone(source)
  const html = render(source)
  assert.match(html, /草稿待核 \(1\)/)
  assert.match(html, /未计入已确认合计/)
  assert.match(html, /data-scope-version="draft"/)
  assert.match(html, /data-work-state="missing"/)
  assert.match(html, /数量待核 · 单价待核/)
  assert.match(html, /缺尺寸，待现场复核/)
  assert.match(html, /<details[^>]*open=""/)
  assert.doesNotMatch(html, />0 m3</)
  assert.doesNotMatch(html, /<input|<textarea|type="submit"/)
  assert.deepEqual(source, before)
})

test('stable UUID comparison hides unchanged draft rows and keeps new or changed scopes separate from old confirmed totals', () => {
  const unchanged = scope({ id: 'old-a', description: 'UNIQUE_UNCHANGED_SCOPE', quantity: '1' })
  const originalChanged = scope({ id: 'old-b', description: 'Changed scope', quantity: '2' })
  const source = draftedItem([structuredClone(unchanged), { ...originalChanged, quantity: '3.185' }, scope({ id: 'new-c', description: 'New scope', quantity: '28.065' })])
  source.plan!.confirmedSnapshot = { ...draft([unchanged, originalChanged]), action: 'confirm', version: 1, signedCumulativeQuantity: '700', signedCumulativeAmountHt: '7000000', confirmedAt: '2026-10-23T00:00:00Z', confirmedById: 1, reason: 'Earlier confirmation' }
  source.summary.completedUnbilledQuantity = '3'
  source.summary.remainingQuantity = '3'
  source.summary.forecastFinalQuantity = '703'
  assert.deepEqual(changedWorkDraftScopes(source).map((row) => row.id), ['old-b', 'new-c'])
  const before = structuredClone(source), html = render(source)
  assert.equal((html.match(/UNIQUE_UNCHANGED_SCOPE/g) ?? []).length, 1)
  assert.match(html, /草稿待核 \(2\)/)
  assert.match(html, /3.185 m3/)
  assert.match(html, /28.065 m3/)
  assert.doesNotMatch(html, /3.19 m3|28.07 m3/)
  assert.match(html, /703 m3/)
  assert.equal((html.match(/<div class="sbwp-confirmed-scope" data-work-state="remaining"/g) ?? []).length, 4)
  assert.ok(html.indexOf('sbwp-confirmed-note') > html.indexOf('完成状态 / 单价'))
  assert.deepEqual(source, before)
  source.plan!.draft.scopes = structuredClone(source.plan!.confirmedSnapshot.scopes)
  assert.equal(renderToStaticMarkup(createElement(WorkPlanDraftScopes, { item: source, roads: [], locale: 'zh', formatValue: moneyFormat })), '')
})

test('red aggregate status takes priority over known yellow scopes without inventing source anchors', () => {
  const source = draftedItem([scope(), scope({ id: 'unknown', quantity: null, quantityConfirmed: false })])
  assert.equal(workPlanReadiness(source), 'missing')
  assert.equal(source.lineKey, 'xlsx-row-26')
  source.plan!.draft.scopes = [scope({ quantity: '0' })]
  assert.equal(workPlanReadiness(source), 'none')
})

test('price-only drafts show inheriting rows and missing status without repricing the confirmed snapshot', () => {
  const confirmedPrice = { ...rate, unitPrice: '10' }
  const source = draftedItem([scope()], { ...rate, unitPrice: '20', confirmed: false })
  source.plan!.confirmedSnapshot = { ...draft([scope()], confirmedPrice), action: 'confirm', version: 1, signedCumulativeQuantity: '700', signedCumulativeAmountHt: '7000', confirmedAt: '2026-10-23T00:00:00Z', confirmedById: 1, reason: '' }
  source.summary.remainingAmountHt = '31.85'
  source.summary.forecastFinalAmountHt = '7031.85'
  const before = structuredClone(source)
  assert.deepEqual(changedWorkDraftScopes(source).map((row) => row.id), ['scope-a'])
  assert.equal(workPlanReadiness(source), 'missing')
  const html = render(source)
  assert.match(html, /草稿待核 \(1\)/)
  assert.match(html, /data-work-state="missing" data-scope-version="draft"/)
  assert.match(html, /单价待核/)
  assert.match(html, /20.00/)
  assert.match(html, /7031.85/)
  assert.deepEqual(source, before)
  source.plan!.draft.price!.confirmed = true
  assert.equal(workPlanReadiness(source), 'remaining')
  const independent = scope({ price: { ...rate, unitPrice: '30' } })
  source.plan!.draft.scopes = [independent]
  source.plan!.confirmedSnapshot.scopes = [structuredClone(independent)]
  assert.deepEqual(changedWorkDraftScopes(source), [], 'Independent scope rates must not inherit a plan-only price delta')
  source.plan!.draft.scopes = [scope({ scopeBasis: 'PENDING_CHANGE' })]
  source.plan!.confirmedSnapshot.scopes = structuredClone(source.plan!.draft.scopes)
  assert.deepEqual(changedWorkDraftScopes(source), [], 'Inapplicable original rates must not price changed scopes')
})

const activityRecord = (id: number, overrides: Partial<SignedCalculationRecord> = {}): SignedCalculationRecord => ({ id, recordId: `original-pipe-${id}`, lineKeys: [], rowType: 'DETAIL', road: 'Voie 3', structure: 'Buse', description: 'Original unpriced pipe', side: 'CD', pkStart: '100', pkEnd: '119', unit: 'ml', dimensions: [], calculatedQuantity: '19', formula: `=F${id}`, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null, billingState: 'UNKNOWN', completionState: 'UNKNOWN', completionEvidence: null, sourceNote: null, note: '单价待核', updatedAt: '2026-10-24T00:00:00Z', sourceSheet: 'DETAILS CALCULS 7', sourceRow: id, sourceRange: `A${id}:Q${id}`, ...overrides })
const activityItem = (): BoqWorkPlanItemDto => ({ ...item(), sourceKind: 'SOURCE_ACTIVITY', lineKey: 'original-pipe-header', sourceRecordIds: ['original-pipe-140', 'original-pipe-142'], boqItemId: null, code: null, designation: 'Original pipe activity', unit: 'ml', sourceUnitPrice: null, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null, cumulativeAmountHt: null, summary: { ...item().summary, signedCumulativeQuantity: null } })

test('source activities allow only a draft action and remain red before any plan is saved', () => {
  assert.deepEqual(workPlanAllowedActions(activityItem()), ['save-draft'])
  assert.equal(workPlanReadiness(activityItem()), 'missing')
  for (const sourceKind of ['SIGNED_LINE', 'TEMPLATE_ITEM'] as const) assert.deepEqual(workPlanAllowedActions({ sourceKind }), ['save-draft', 'confirm', 'confirm-none'])
})

test('source activities link only exact server-declared unmapped DETAIL identities', () => {
  const activity = activityItem()
  const records = [activityRecord(140), activityRecord(142), activityRecord(143), activityRecord(144, { recordId: 'original-pipe-140', rowType: 'SUBTOTAL' }), activityRecord(145, { recordId: 'original-pipe-142', lineKeys: ['already-priced-item'] })]
  assert.deepEqual(sourceActivityRecords(activity, records).map((record) => record.id), [140, 142])
  assert.deepEqual(sourceActivityRecords({ ...activity, sourceKind: 'TEMPLATE_ITEM' }, records), [])
  assert.deepEqual(sourceActivityRecords({ ...activity, sourceRecordIds: [] }, records), [])
})

test('unassigned review rows exclude only the source details already shown in activity cards', () => {
  const records = [activityRecord(140), activityRecord(142), activityRecord(143), activityRecord(144, { rowType: 'ITEM_HEADER', billingState: 'MEASURED' }), activityRecord(145, { rowType: 'SUBTOTAL' }), activityRecord(146, { lineKeys: ['signed-line'] })]
  const before = structuredClone(records)
  assert.deepEqual(unassignedWorkCalculationRecords(records, [activityItem()]).map((record) => record.id), [143, 144])
  assert.deepEqual(unassignedWorkCalculationRecords(records, []).map((record) => record.id), [140, 142, 143, 144])
  assert.deepEqual(records, before)
})

test('unpriced activity cards display two original 19 ml calculations while keeping paid columns blank and forecasts absent', () => {
  const source = activityItem(), records = [activityRecord(140), activityRecord(142), activityRecord(999)]
  const before = structuredClone({ source, records })
  const html = renderToStaticMarkup(createElement(SignedBillWorkPlanPanel, { item: source, revisionId: 23, baselineHash: 'baseline', roads: [], editAllowed: true, readOnlyReason: null, sourceRecords: records, locale: 'zh', formatValue: moneyFormat, onSaved: () => {} }))
  assert.match(html, /未定价待核事项/)
  assert.match(html, /仅可暂存，不计入正式量价/)
  assert.match(html, /data-source-kind="SOURCE_ACTIVITY"/)
  assert.equal((html.match(/>19 ml</g) ?? []).length, 2)
  assert.equal((html.match(/以前：—/g) ?? []).length, 2)
  assert.equal((html.match(/本期：—/g) ?? []).length, 2)
  assert.equal((html.match(/累计：—/g) ?? []).length, 2)
  assert.doesNotMatch(html, /累计已计量|预计最终量|预计最终金额|已完成/)
  assert.doesNotMatch(html, /data-source-record-id="original-pipe-999"/)
  assert.equal(source.boqItemId, null)
  assert.equal(source.lineKey, 'original-pipe-header')
  assert.deepEqual({ source, records }, before)
})
