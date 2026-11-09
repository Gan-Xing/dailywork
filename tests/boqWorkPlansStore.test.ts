import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../lib/prisma'
import { saveBoqWorkPlan, sourceWorkItems, workBaselineHash } from '../lib/server/boqWorkPlanStore'
import { buildBoqWorkSummary } from '../lib/value/boqWorkPlanRules'
import type { SignedCalculationItem } from '../lib/value/signedBillCalculations'
import type { BoqWorkConfirmedSnapshot, BoqWorkDraft, BoqWorkPlanPostInput, BoqWorkScope } from '../lib/value/boqWorkPlans'

const scope: BoqWorkScope = { id: '1e2d3c4b-1234-4567-89ab-abcdef123456', description: '独立测试路段左侧', roadId: 11, startPk: '0', endPk: '10', side: 'LEFT', spec: null, unit: 'ml', completionState: 'COMPLETED', scopeBasis: 'ORIGINAL', quantity: '10.123456789012345678', quantityConfirmed: true, quantityEvidence: '用户逐项确认', approvalEvidence: '', price: null }
const price = { unitPrice: '45.12', confirmed: true, basis: 'ORIGINAL' as const, evidence: '独立测试合同价证据' }
const revision = { id: 23, projectId: 3313, project: { code: 'agni' }, periodIndex: 7, status: 'SIGNED', isCurrent: true, contentSha256: 'a'.repeat(64), calculationFileId: null, calculationFile: null, linesJson: [{ key: 'xlsx-row-70', boqItemId: null, sourceCode: null, designation: '无全局价号的源项目', unit: 'ml', unitPrice: null, previousQuantity: '100', quantity: '20', cumulativeQuantity: '120', cumulativeAmount: '4500', previousAmount: null, amount: null }] }
const baseline = workBaselineHash({ revisions: [revision], manifests: [], recordSources: [] })
const pricedRevision = { ...revision, linesJson: revision.linesJson.map((line) => ({ ...line, sourceCode: '001', unitPrice: '60000000' })) }
const templateItem: SignedCalculationItem = { lineKey: 'xlsx-row-85', sourceRow: 85, code: '401i', designation: '底稿模板项，正式签字主表无该行', unit: 'ml', unitPrice: null, previousQuantity: null, currentQuantity: '15', cumulativeQuantity: '15', previousAmountHt: null, currentAmountHt: null, cumulativeAmountHt: '750', archivedLine: false }
const templateRevision = { ...revision, calculationFileId: 668, calculationFile: { id: 668, checksum: 'b'.repeat(64) }, linesJson: [] }
const templateLinks = [{ fileId: 668, entityId: '23', meta: { format: 'SIGNED_CALCULATION_V1', projectId: 3313, periodIndex: 7, sourceSha256: 'b'.repeat(64), reviewKey: 'template-source', items: [templateItem] } }]
const templateBaseline = workBaselineHash({ revisions: [templateRevision], manifests: templateLinks, recordSources: [] })
const input = (overrides: Partial<BoqWorkPlanPostInput> = {}): BoqWorkPlanPostInput => ({ lineKey: 'xlsx-row-70', expectedVersion: null, action: 'confirm', scopeComplete: true, scopes: [scope], price, reason: '确认剩余范围', baselineHash: baseline, ...overrides })
type Saved = { id: number; version: number; state: string; draftJson: BoqWorkDraft; confirmedSnapshotJson: BoqWorkConfirmedSnapshot | null; updatedAt: Date; anchorLineKey: string }

test('POST isolates planning writes, preserves confirmations in drafts and rejects stale or allocated changes', async () => {
  const client = prisma as unknown as { $transaction: (callback: unknown, options?: unknown) => Promise<unknown> }, original = client.$transaction
  let saved: Saved | null = null, race = false, hasAllocation = false, templateMode = false, signedPriceMode = false
  const writes: string[] = []
  const tx = {
    $executeRaw: async () => 1,
    boqBillRevision: { findUnique: async () => templateMode ? templateRevision : signedPriceMode ? pricedRevision : revision, findMany: async () => [templateMode ? templateRevision : signedPriceMode ? pricedRevision : revision] },
    fileAssetLink: { findMany: async () => templateMode ? templateLinks : [] }, valueBillReview: { findMany: async () => templateMode ? [{ id: 1, key: 'template-source', projectCode: 'agni', sourceSha256: 'b'.repeat(64), attachmentNumber: 7 }] : [] }, valueBillReviewRecord: { findMany: async () => [] },
    roadSection: { findMany: async () => [{ id: 11, name: '测试道路', slug: 'test' }] },
    boqWorkPlan: {
      findMany: async () => saved ? [saved] : [],
      create: async ({ data }: { data: Omit<Saved, 'id' | 'updatedAt'> }) => { writes.push('plan:create'); saved = { ...data, id: 41, updatedAt: new Date() }; return saved },
      updateMany: async ({ where, data }: { where: { version: number }; data: Partial<Saved> }) => { if (race || where.version !== saved?.version) return { count: 0 }; writes.push('plan:update'); saved = { ...saved!, ...data, updatedAt: new Date() }; return { count: 1 } },
      findUniqueOrThrow: async () => saved,
    },
    boqWorkBinding: { create: async () => { writes.push('binding:create') } },
    boqWorkScope: { findMany: async () => saved ? [{ id: scope.id }] : [], count: async () => 0, updateMany: async () => { writes.push('scope:inactive') }, upsert: async ({ create }: { create: { quantity: { toFixed(): string } } }) => { assert.equal(create.quantity.toFixed(), scope.quantity); writes.push('scope:upsert') } },
    boqWorkAllocation: { findMany: async () => hasAllocation ? [{ scopeId: scope.id }] : [] },
    boqWorkEvent: { create: async () => { writes.push('event:create') } },
  }
  client.$transaction = async (callback, options) => { assert.deepEqual(options, { isolationLevel: 'Serializable', timeout: 30000 }); return (callback as (context: typeof tx) => unknown)(tx) }
  try {
    const created = await saveBoqWorkPlan(23, input(), 1)
    assert.equal(created.item.plan?.version, 1)
    assert.deepEqual(writes, ['plan:create', 'binding:create', 'scope:inactive', 'scope:upsert', 'event:create'])
    assert.equal(created.item.summary.remainingQuantity, scope.quantity)
    const confirmation = structuredClone(created.item.plan?.confirmedSnapshot)
    writes.length = 0
    const draftInput = input({ action: 'save-draft', expectedVersion: 1, scopeComplete: false }); delete draftInput.price
    const draft = await saveBoqWorkPlan(23, draftInput, 1)
    assert.equal(draft.item.state, 'DRAFT')
    assert.deepEqual(draft.item.plan?.confirmedSnapshot, confirmation)
    assert.deepEqual(draft.item.plan?.draft.price, price)
    assert.equal(draft.item.summary.forecastFinalQuantity, created.item.summary.forecastFinalQuantity)
    assert.deepEqual(writes, ['plan:update', 'scope:inactive', 'scope:upsert', 'event:create'])
    writes.length = 0
    await assert.rejects(saveBoqWorkPlan(23, input({ expectedVersion: 1 }), 1), /其他人更新/)
    await assert.rejects(saveBoqWorkPlan(23, input({ expectedVersion: 2, baselineHash: 'b'.repeat(64) }), 1), /原件核查数据已变化/)
    await assert.rejects(saveBoqWorkPlan(23, input({ expectedVersion: 2, scopes: [{ ...scope, roadId: 999 }] }), 1), /不属于本项目/)
    assert.deepEqual(writes, [])
    race = true
    await assert.rejects(saveBoqWorkPlan(23, input({ expectedVersion: 2 }), 1), /版本冲突/)
    assert.deepEqual(writes, [])
    race = false; hasAllocation = true
    await assert.rejects(saveBoqWorkPlan(23, input({ expectedVersion: 2, action: 'confirm-none', scopes: [] }), 1), /已有核销量/)
    assert.deepEqual(writes, [])
    saved = null; hasAllocation = false; templateMode = true
    const templateSaved = await saveBoqWorkPlan(23, input({ lineKey: templateItem.lineKey, baselineHash: templateBaseline }), 1)
    assert.equal(templateSaved.item.cumulativeQuantity, '15', 'Original template values remain visible and unchanged')
    assert.equal(templateSaved.item.cumulativeAmountHt, '750')
    assert.equal(templateSaved.item.plan?.confirmedSnapshot?.signedCumulativeQuantity, null)
    assert.equal(templateSaved.item.plan?.confirmedSnapshot?.signedCumulativeAmountHt, null)
    assert.equal(templateSaved.item.summary.signedCumulativeQuantity, null)
    assert.equal(templateSaved.item.summary.forecastFinalQuantity, null)
    assert.equal(templateSaved.item.summary.forecastFinalAmountHt, null)
    saved = null; templateMode = false; signedPriceMode = true
    const originalSigned = structuredClone(pricedRevision)
    const inherited = await saveBoqWorkPlan(23, input({ price: null }), 1)
    assert.equal(inherited.item.plan?.draft.price?.unitPrice, '60000000')
    assert.equal(inherited.item.plan?.draft.price?.confirmed, true)
    assert.equal(inherited.item.plan?.confirmedSnapshot?.price?.basis, 'ORIGINAL')
    assert.match(inherited.item.plan!.confirmedSnapshot!.price!.evidence, /#23.*001.*xlsx-row-70/)
    const independent = { unitPrice: '65000000', confirmed: false, basis: 'ORIGINAL' as const, evidence: '自定义价待核' }
    const custom = await saveBoqWorkPlan(23, input({ expectedVersion: 1, price: independent }), 1)
    assert.deepEqual(custom.item.plan?.draft.price, independent)
    assert.deepEqual(pricedRevision, originalSigned)
    saved = null
    const pending = await saveBoqWorkPlan(23, input({ price: null, scopes: [{ ...scope, scopeBasis: 'PENDING_CHANGE' }] }), 1)
    assert.equal(pending.item.plan?.draft.price, null)
    assert.equal(pending.item.summary.pendingAmountHt, null)
  } finally { client.$transaction = original }
})

test('supplementary template quantities never become signed measurement or forecast baselines', () => {
  const items = sourceWorkItems(revision as never, [templateItem]), signed = items[0], template = items[1]
  assert.equal(signed.summary.signedCumulativeQuantity, '120')
  assert.equal(template.cumulativeQuantity, '15')
  assert.equal(template.cumulativeAmountHt, '750')
  assert.equal(template.summary.signedCumulativeQuantity, null)
  const snapshot: BoqWorkConfirmedSnapshot = { action: 'confirm', version: 1, scopeComplete: true, scopes: [scope], price, baselineHash: baseline, signedCumulativeQuantity: '15', signedCumulativeAmountHt: '750', confirmedAt: '2026-10-23T00:00:00Z', confirmedById: 1, reason: 'fixture with untrusted template baseline' }
  for (const editAllowed of [true, false]) {
    const summary = buildBoqWorkSummary(template, snapshot, baseline, editAllowed)
    assert.equal(summary.signedCumulativeQuantity, null)
    assert.equal(summary.remainingQuantity, scope.quantity)
    assert.equal(summary.forecastFinalQuantity, null)
    assert.equal(summary.forecastIncludingPendingQuantity, null)
    assert.equal(summary.forecastFinalAmountHt, null)
  }
  const signedSummary = buildBoqWorkSummary(signed, snapshot, baseline, true)
  assert.equal(signedSummary.signedCumulativeQuantity, '120')
  assert.notEqual(signedSummary.forecastFinalQuantity, null)
  assert.notEqual(signedSummary.forecastFinalAmountHt, null)
})
