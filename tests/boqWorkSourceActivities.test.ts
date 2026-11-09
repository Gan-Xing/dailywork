import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { listBoqWorkPlans, previewBoqWorkMatch, saveBoqWorkPlan, sourceActivityWorkItems, workBaselineHash } from '../lib/server/boqWorkPlanStore'
import { defaultBoqWorkPlanPrice } from '../lib/value/boqWorkPriceDefaults'
import type { BoqWorkPlanPostInput, BoqWorkScope } from '../lib/value/boqWorkPlans'

const raw = (recordId: string, sourceRow: number, rowType: string, extra: Record<string, unknown> = {}, unit: string | null = null) => ({ recordId, unit, data: { sourceSheet: 'DETAILS CALCULS 7', sourceRow, rowType, templateLeafRows: [], ...extra } })
const header = raw('actual-header-128', 128, 'ITEM_HEADER', { descriptionOriginal: 'Démolition ou dépose et mise en dépôt de buses', unit: { value: 'ml' } })
const details = [raw('actual-detail-130', 130, 'DETAIL'), raw('actual-detail-132', 132, 'DETAIL')]
const records = [header, ...details]

test('unpriced source activities require a real unmapped header and DETAIL rows in the same source block', () => {
  const rows = [...records, raw('mapped-detail', 131, 'DETAIL', { templateLeafRows: [29] }), raw('next-mapped-header', 137, 'ITEM_HEADER', { descriptionOriginal: 'Existing priced header', templateLeafRows: [28] }), raw('after-boundary', 138, 'DETAIL'), raw('road-label', 140, 'ITEM_HEADER', { descriptionOriginal: 'Voie 3', roadNameOriginal: 'Voie 3' }), raw('road-detail', 141, 'DETAIL'), raw('empty-header', 150, 'ITEM_HEADER', { descriptionOriginal: 'No detail on this sheet' }), raw('another-sheet-detail', 151, 'DETAIL', { sourceSheet: 'Another sheet' })]
  const before = JSON.stringify(rows), result = sourceActivityWorkItems([...rows].reverse())
  assert.equal(result.length, 1)
  assert.equal(result[0].lineKey, header.recordId, 'The real source record identity is the anchor')
  assert.equal(result[0].sourceKind, 'SOURCE_ACTIVITY')
  assert.deepEqual(result[0].sourceRecordIds, details.map((row) => row.recordId))
  assert.equal(result[0].unit, 'ml')
  for (const field of ['boqItemId', 'code', 'sourceUnitPrice', 'previousQuantity', 'currentQuantity', 'cumulativeQuantity', 'cumulativeAmountHt'] as const) assert.equal(result[0][field], null)
  assert.equal(result[0].summary.signedCumulativeQuantity, null)
  assert.equal(defaultBoqWorkPlanPrice(result[0], 23, [], null), null)
  assert.equal(JSON.stringify(rows), before)
  const noUnit = sourceActivityWorkItems([{ ...header, data: { ...header.data, unit: null } }, ...details])
  assert.equal(noUnit[0].unit, null, 'Do not infer a unit from the activity name or its detail rows')
  assert.equal(sourceActivityWorkItems([raw('invented', 1, 'DETAIL', { descriptionOriginal: 'Unmapped activity without a real header' }), ...details]).length, 0)
  assert.equal(sourceActivityWorkItems([header, raw('mapped-only', 130, 'DETAIL', { templateLeafRows: [29] })]).length, 0)
})

function fixture() {
  const sourceSha = 'b'.repeat(64)
  const revision = { id: 23, projectId: 3313, project: { code: 'agni' }, periodIndex: 7, status: 'SIGNED', isCurrent: true, contentSha256: 'a'.repeat(64), calculationFileId: 668, calculationFile: { id: 668, checksum: sourceSha }, linesJson: [] }
  const links = [{ id: 1, fileId: 668, entityId: '23', meta: { format: 'SIGNED_CALCULATION_V1', projectId: 3313, periodIndex: 7, reviewKey: 'selected-review', sourceSha256: sourceSha, items: [] } }]
  const reviews = [{ id: 154, key: 'selected-review', projectCode: 'agni', sourceSha256: sourceSha, attachmentNumber: 7 }]
  const recordSources = records.map((record) => ({ recordId: record.recordId, source: { sourceSha256: sourceSha } }))
  const baseline = workBaselineHash({ revisions: [revision], manifests: links, recordSources })
  const scope: BoqWorkScope = { id: '1e2d3c4b-1234-4567-89ab-abcdef123456', description: 'Existing source pipe removal', roadId: 20, startPk: '626', endPk: '645', side: 'CG', spec: 'Ø1000', unit: 'ml', completionState: 'UNKNOWN', scopeBasis: 'ORIGINAL', quantity: '19', quantityConfirmed: true, quantityEvidence: 'Original geometry, price unassigned', approvalEvidence: '', price: null }
  const input = (overrides: Partial<BoqWorkPlanPostInput> = {}): BoqWorkPlanPostInput => ({ lineKey: header.recordId, expectedVersion: null, baselineHash: baseline, action: 'save-draft', scopeComplete: false, scopes: [scope], price: null, reason: 'Missing price code and price', ...overrides })
  const writes: string[] = [], reads: string[] = []
  const models = {
    boqBillRevision: { findUnique: async () => revision, findMany: async () => [revision] },
    fileAssetLink: { findMany: async () => links },
    valueBillReview: { findMany: async () => reviews },
    valueBillReviewRecord: { findMany: async ({ where, select }: { where: { reviewId: unknown }; select: { data?: boolean } }) => { if (select.data) { assert.equal(where.reviewId, 154, 'Only the selected, verified review supplies activity anchors'); reads.push('selected-source-data'); return records }; return recordSources } },
    roadSection: { findMany: async () => [{ id: 20, name: 'Voie 3', slug: 'voie3' }] },
    boqWorkPlan: { findMany: async () => [], create: async ({ data }: { data: { confirmedSnapshotJson: unknown } }) => { writes.push('plan'); return { ...data, confirmedSnapshotJson: data.confirmedSnapshotJson === Prisma.DbNull ? null : data.confirmedSnapshotJson, id: 41, updatedAt: new Date('2026-10-24T00:00:00Z') } } },
    boqWorkScope: { count: async () => 0, updateMany: async () => { writes.push('scope:inactive') }, upsert: async () => { writes.push('scope') } },
    boqWorkBinding: { create: async ({ data }: { data: { sourceKind: string; lineKey: string } }) => { assert.equal(data.sourceKind, 'SOURCE_ACTIVITY'); assert.equal(data.lineKey, header.recordId); writes.push('binding') } },
    boqWorkEvent: { create: async () => { writes.push('event') } },
  }
  const forbidden = new Proxy({}, { get() { throw new Error('Source activities must not touch measurements, signed bills or allocations') } })
  const tx = { ...models, $executeRaw: async () => 1, boqMeasurement: forbidden, boqMeasurementDetail: forbidden, boqWorkAllocation: forbidden }
  const clientModels = { ...models, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx), boqMeasurement: forbidden, boqMeasurementDetail: forbidden, boqWorkAllocation: forbidden }
  return { models: clientModels, revision, links, records, writes, reads, input, baseline }
}

async function withDb(run: (value: ReturnType<typeof fixture>) => Promise<void>) {
  const f = fixture(), client = prisma as unknown as Record<string, unknown>
  const originals = Object.fromEntries(Object.keys(f.models).map((key) => [key, client[key]]))
  try { Object.assign(client, f.models); await run(f) } finally { Object.assign(client, originals) }
}

test('source-activity GET is pure read and exposes no paid quantity or inherited price', async () => {
  await withDb(async (f) => {
    const before = JSON.stringify([f.revision, f.links, f.records])
    const result = await listBoqWorkPlans(23)
    assert.equal(result.baselineHash, f.baseline)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].lineKey, header.recordId)
    assert.deepEqual(result.items[0].sourceRecordIds, details.map((row) => row.recordId))
    assert.deepEqual(f.writes, [])
    assert.equal(JSON.stringify([f.revision, f.links, f.records]), before)
  })
})

test('source activities only save drafts; confirmations, invented anchors and allocation previews fail without writes', async () => {
  await withDb(async (f) => {
    await assert.rejects(saveBoqWorkPlan(23, f.input({ action: 'confirm' }), 1), /只能暂存待核/)
    await assert.rejects(saveBoqWorkPlan(23, f.input({ action: 'confirm-none', scopeComplete: true, scopes: [] }), 1), /只能暂存待核/)
    await assert.rejects(saveBoqWorkPlan(23, f.input({ lineKey: 'xlsx-row-128' }), 1), /不属于所选原件/)
    await assert.rejects(previewBoqWorkMatch(23, { lineKey: header.recordId, expectedVersion: 1, baselineHash: f.baseline, proposals: [] }), /不能核销/)
    assert.deepEqual(f.writes, [])
    const saved = await saveBoqWorkPlan(23, f.input({ scopes: [{ ...f.input().scopes[0], quantity: null, quantityConfirmed: false, unit: 'ml' }] }), 1)
    assert.equal(saved.item.state, 'DRAFT')
    assert.equal(saved.item.plan?.confirmedSnapshot, null)
    assert.equal(saved.item.plan?.draft.price, null)
    assert.equal(saved.item.summary.signedCumulativeQuantity, null)
    assert.equal(saved.item.summary.forecastFinalQuantity, null)
    assert.deepEqual(f.writes, ['plan', 'binding', 'scope:inactive', 'scope', 'event'])
  })
})
