import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { listBoqWorkPlans, previewBoqWorkMatch, sourceWorkItems, workBaselineHash } from '../lib/server/boqWorkPlanStore'
import type { BoqWorkConfirmedSnapshot, BoqWorkScope } from '../lib/value/boqWorkPlans'

const scopeId = '1e2d3c4b-1234-4567-89ab-abcdef123456'
const sourceSha = 'b'.repeat(64)
const line = (key: string, boqItemId: number | null) => ({ key, rowType: 'ITEM', boqItemId, sourceCode: '307a', designation: `Synthetic source ${key}`, unit: 'ml', unitPrice: '50000', previousQuantity: '980', quantity: '20', cumulativeQuantity: '1000', cumulativeAmount: '45000000', evidence: { sourceRow: Number(key.replace('xlsx-row-', '')) } })

function fixture() {
  const revision = { id: 23, projectId: 1, project: { code: 'synthetic-a' }, periodIndex: 7, status: 'SIGNED', isCurrent: true, contentSha256: 'a'.repeat(64), calculationFileId: 668, calculationFile: { id: 668, checksum: sourceSha }, linesJson: [line('xlsx-row-70', 11), line('xlsx-row-73', 12)] }
  const oldRevision = { ...revision, id: 22, periodIndex: 6, contentSha256: 'c'.repeat(64), calculationFileId: null, calculationFile: null }
  const template = { lineKey: 'xlsx-row-85', sourceRow: 85, code: '307a', designation: 'Synthetic supplementary source without global BoQ', unit: 'ml', unitPrice: null, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null, previousAmountHt: null, currentAmountHt: null, cumulativeAmountHt: null, archivedLine: false }
  const links = [{ id: 500, fileId: 668, entityId: '23', meta: { format: 'SIGNED_CALCULATION_V1', projectId: 1, periodIndex: 7, reviewKey: 'synthetic-a-7', sourceSha256: sourceSha, extractionSha256: 'd'.repeat(64), items: [template], correctionHistory: [] } }]
  const reviews = [{ id: 1, key: 'synthetic-a-7', projectCode: 'synthetic-a', sourceSha256: sourceSha, attachmentNumber: 7 }]
  const sources = [{ recordId: 'source-row-100', source: { sourceSha256: sourceSha, sourceRow: 100, quantityCorrections: [] }, note: 'Synthetic human note', updatedAt: '2026-10-23T00:00:00Z' }]
  const current = [revision, oldRevision]
  const baseline = workBaselineHash({ revisions: current, manifests: links, recordSources: sources })
  const scope: BoqWorkScope = { id: scopeId, description: 'Synthetic left-side scope', roadId: 1, startPk: '0', endPk: '80', side: 'LEFT', spec: null, unit: 'ml', completionState: 'COMPLETED', scopeBasis: 'ORIGINAL', quantity: '80', quantityConfirmed: true, quantityEvidence: 'Synthetic explicit manual confirmation', approvalEvidence: '', price: null }
  const confirmed: BoqWorkConfirmedSnapshot = { action: 'confirm', version: 1, scopeComplete: true, scopes: [scope], price: { unitPrice: '50000', confirmed: true, basis: 'ORIGINAL', evidence: 'Synthetic original price' }, baselineHash: baseline, signedCumulativeQuantity: '1000', signedCumulativeAmountHt: '45000000', confirmedAt: '2026-10-23T00:00:00Z', confirmedById: 1, reason: 'Synthetic confirmation' }
  const plan = { id: 41, projectId: 1, anchorRevisionId: 23, anchorLineKey: 'xlsx-row-70', boqItemId: 11, version: 2, state: 'DRAFT', draftJson: { ...confirmed, scopes: [{ ...scope, quantity: '999' }] }, confirmedSnapshotJson: confirmed, updatedAt: new Date('2026-10-23T00:00:00Z') }
  const allocations: Array<{ bindingId: number; scopeId: string; deltaQuantity: Prisma.Decimal }> = []
  const bindings = [{ id: 501, signedRevisionId: 23, lineKey: 'xlsx-row-70' }]
  const roads = [{ id: 1, projectId: 1, name: 'Synthetic road', slug: 'synthetic-road' }]
  const calls: string[] = []
  const model = (name: string, methods: Record<string, (...args: never[]) => unknown>) => new Proxy(methods, { get(target, property) { if (typeof property !== 'string') return Reflect.get(target, property); const method = target[property]; if (!method) throw new Error(`Unexpected database operation ${name}.${property}`); return (...args: never[]) => { calls.push(`${name}.${property}`); return method(...args) } } })
  const models = {
    boqBillRevision: model('revision', { findUnique: async ({ where }: { where: { id: number } }) => current.find((r) => r.id === where.id) ?? null, findMany: async () => current }),
    fileAssetLink: model('fileLink', { findMany: async () => links }),
    valueBillReview: model('review', { findMany: async () => reviews }),
    valueBillReviewRecord: model('reviewRecord', { findMany: async () => sources }),
    boqWorkPlan: model('plan', { findMany: async ({ where }: { where: { anchorRevisionId: number } }) => plan.anchorRevisionId === where.anchorRevisionId ? [plan] : [] }),
    roadSection: model('road', { findMany: async ({ where }: { where: { projectId: number } }) => roads.filter((road) => road.projectId === where.projectId) }),
    boqWorkBinding: model('binding', { findMany: async () => bindings, findFirst: async () => bindings[0] }),
    boqWorkAllocation: model('allocation', { findMany: async () => allocations }),
    $transaction: () => { throw new Error('Read endpoint must never open a write transaction') },
    $executeRaw: () => { throw new Error('Read endpoint must never execute raw writes') },
    $queryRaw: () => { throw new Error('Read endpoint must use bounded declared reads') },
  }
  return { revision, oldRevision, template, links, reviews, sources, current, baseline, scope, plan, allocations, bindings, roads, calls, models }
}

async function withReadOnlyDb(run: (value: ReturnType<typeof fixture>) => Promise<void>) {
  const f = fixture(), client = prisma as unknown as Record<string, unknown>
  const original = Object.fromEntries(Object.keys(f.models).map((key) => [key, client[key]]))
  try { Object.assign(client, f.models); await run(f); assert.ok(f.calls.every((call) => /\.find(?:Many|Unique|First)$/.test(call)), 'All database operations must be declared reads') }
  finally { Object.assign(client, original) }
}

test('GET is pure read, keeps repeated price codes as independent anchors, and uses the last confirmation over a new draft', async () => {
  await withReadOnlyDb(async (f) => {
    const before = JSON.stringify([f.current, f.links, f.sources, f.plan])
    const result = await listBoqWorkPlans(23)
    assert.equal(result.editAllowed, true)
    assert.deepEqual(result.items.map((item) => [item.lineKey, item.boqItemId, item.code]), [['xlsx-row-70', 11, '307a'], ['xlsx-row-73', 12, '307a'], ['xlsx-row-85', null, '307a']])
    assert.equal(result.items[0].state, 'DRAFT')
    assert.equal(result.items[0].plan?.draft.scopes[0].quantity, '999')
    assert.equal(result.items[0].summary.remainingQuantity, '80')
    assert.equal(result.items[0].summary.forecastFinalAmountHt, '49000000')
    assert.equal(result.items[1].state, 'UNCONFIRMED')
    assert.equal(result.items[1].summary.remainingQuantity, null)
    assert.equal(result.items[2].summary.forecastFinalQuantity, null)
    assert.equal(JSON.stringify([f.current, f.links, f.sources, f.plan]), before)
    const historical = await listBoqWorkPlans(22)
    assert.equal(historical.editAllowed, false, 'A prior period stays read-only even when it is that period’s current signed revision')
  })
})

test('GET rejects companion manifests from the wrong project, period, hash or ambiguous duplicate association', async () => {
  await withReadOnlyDb(async (f) => {
    f.reviews[0].projectCode = 'foreign-project'
    await assert.rejects(listBoqWorkPlans(23), /项目、期次或原件哈希/)
    f.reviews[0].projectCode = 'synthetic-a'; f.reviews[0].attachmentNumber = 6
    await assert.rejects(listBoqWorkPlans(23), /项目、期次或原件哈希/)
    f.reviews[0].attachmentNumber = 7; f.links[0].meta.sourceSha256 = 'e'.repeat(64)
    await assert.rejects(listBoqWorkPlans(23), /补充模板与账单原件不匹配/)
    f.links[0].meta.sourceSha256 = sourceSha; f.links.push({ ...f.links[0], id: 501 })
    await assert.rejects(listBoqWorkPlans(23), /关联重复/)
  })
})

test('current saved scopes with missing or reassigned roads need review and cannot produce ready forecasts or preflight', async () => {
  await withReadOnlyDb(async (f) => {
    const before = structuredClone(f.plan)
    for (const projectId of [2, 0]) {
      if (projectId) f.roads[0].projectId = projectId
      else f.roads.length = 0
      const result = await listBoqWorkPlans(23), item = result.items[0]
      assert.equal(result.editAllowed, true)
      assert.deepEqual(result.roads, [])
      assert.equal(item.state, 'NEEDS_REVIEW')
      assert.equal(item.plan?.state, 'NEEDS_REVIEW')
      assert.equal(item.summary.ready, false)
      assert.equal(item.summary.remainingQuantity, null)
      assert.equal(item.summary.forecastFinalQuantity, null)
      assert.equal(item.summary.forecastIncludingPendingQuantity, null)
      assert.equal(item.summary.forecastFinalAmountHt, null)
      assert.equal(item.summary.signedCumulativeQuantity, '1000')
      await assert.rejects(previewBoqWorkMatch(23, { lineKey: 'xlsx-row-70', expectedVersion: 2, baselineHash: f.baseline, proposals: [] }), /范围道路.*不属于本项目/)
    }
    assert.deepEqual(f.plan, before, 'GET and preflight must not rewrite persisted snapshots or state')
  })
})

test('road reassignments preserve labelled historical summaries, while invalid draft-only references also require review', async () => {
  await withReadOnlyDb(async (f) => {
    f.plan.draftJson.scopes[0].roadId = 99
    assert.equal((await listBoqWorkPlans(23)).items[0].state, 'NEEDS_REVIEW')
    f.plan.draftJson.scopes[0].roadId = 1
    f.roads[0].projectId = 2
    const successor = { ...f.revision, id: 24, periodIndex: 8 }
    f.current.unshift(successor)
    const history = await listBoqWorkPlans(23), item = history.items[0]
    assert.equal(history.editAllowed, false)
    assert.deepEqual(history.roads, [])
    assert.equal(item.state, 'DRAFT')
    assert.equal(item.summary.historical, true)
    assert.equal(item.summary.ready, true)
    assert.equal(item.summary.remainingQuantity, '80')
    assert.equal(item.summary.forecastFinalAmountHt, '49000000')
  })
})

test('source identity accepts null-BoQ supplementary leaves but rejects duplicate or invented row anchors', () => {
  const f = fixture()
  assert.equal(sourceWorkItems(f.revision as never, [f.template]).at(-1)?.boqItemId, null)
  assert.throws(() => sourceWorkItems({ linesJson: [line('xlsx-row-70', 11), line('xlsx-row-70', 12)] } as never, []), /定位重复/)
  assert.throws(() => sourceWorkItems(f.revision as never, [{ ...f.template, lineKey: '307a' }]), /定位无效/)
})

test('the business baseline ignores manual notes and query ordering but changes when source corrections change', () => {
  const f = fixture()
  const sources = [f.sources[0], { ...f.sources[0], recordId: 'source-row-101', source: { ...f.sources[0].source, sourceRow: 101 } }]
  const baselineInput = { revisions: f.current, manifests: f.links, recordSources: sources }
  const first = workBaselineHash(baselineInput)
  assert.equal(workBaselineHash({ revisions: [...f.current].reverse(), manifests: f.links, recordSources: [...sources].reverse() }), first)
  assert.equal(workBaselineHash({ ...baselineInput, recordSources: sources.map((source) => ({ ...source, note: 'A different manual note', updatedAt: '2099-01-01' })) }), first)
  assert.notEqual(workBaselineHash({ ...baselineInput, recordSources: [{ ...sources[0], source: { ...sources[0].source, quantityCorrections: [{ cell: 'P24', newNumericValue: '350' }] } }, sources[1]] }), first)
})

test('match preflight is read-only, blocks reusing the signed baseline, and caps proposals together with existing source allocations', async () => {
  await withReadOnlyDb(async (f) => {
    f.allocations.push({ bindingId: 501, scopeId, deltaQuantity: new Prisma.Decimal('15') })
    const proposal = (deltaQuantity: string) => ({ lineKey: 'xlsx-row-70', expectedVersion: 2, baselineHash: f.baseline, proposals: [{ scopeId, signedRevisionId: 23, lineKey: 'xlsx-row-70', deltaQuantity }] })
    const partial = await previewBoqWorkMatch(23, proposal('3'))
    assert.equal(partial.written, false)
    assert.equal(partial.valid, false)
    assert.equal(partial.matched, false)
    assert.match(partial.unsupportedReason!, /后续账单绑定流程/)
    assert.ok(partial.errors.some((message) => message.includes('基线期及更早')))
    assert.ok(!partial.errors.some((message) => message.includes('超出原件本期量')))
    assert.equal(partial.signedDeltaTotal, '5', 'Signed source capacity is independently calculated from 20 minus existing 15')
    assert.equal(partial.allocatedDeltaTotal, '3', 'A partial proposal does not pretend its sum equals source capacity')
    assert.deepEqual(partial.remainingAfter, [{ scopeId, quantity: '62' }])
    const over = await previewBoqWorkMatch(23, proposal('6'))
    assert.ok(over.errors.some((message) => message.includes('既有核销超出原件本期量')))
    const reversal = await previewBoqWorkMatch(23, proposal('-1'))
    assert.ok(reversal.errors.some((message) => message.includes('负向冲回须明确')))
    f.plan.confirmedSnapshotJson.scopes[0].completionState = 'NOT_COMPLETED'
    const notCompleted = await previewBoqWorkMatch(23, proposal('1'))
    assert.ok(notCompleted.errors.some((message) => message.includes('完成事实尚未确认')))
    f.plan.confirmedSnapshotJson.scopes[0].completionState = 'UNKNOWN'
    const completionUnknown = await previewBoqWorkMatch(23, proposal('1'))
    assert.ok(completionUnknown.errors.some((message) => message.includes('完成事实尚未确认')))
  })
})

test('nonempty matching is explicitly deferred even with a synthetic successor binding; empty preflight stays harmless', async () => {
  await withReadOnlyDb(async (f) => {
    const empty = await previewBoqWorkMatch(23, { lineKey: 'xlsx-row-70', expectedVersion: 2, baselineHash: f.baseline, proposals: [] })
    assert.equal(empty.valid, true)
    assert.equal(empty.matched, false)
    assert.equal(empty.unsupportedReason, null)
    assert.equal(empty.written, false)
    assert.deepEqual(empty.remainingAfter, [{ scopeId, quantity: '80' }])
    // Deliberately bypass latest-period ordering in this fixture: even otherwise
    // valid arithmetic/bindings must not advertise a verified matching workflow.
    f.current.push({ ...f.revision, id: 24, periodIndex: 8 })
    f.bindings[0].signedRevisionId = 24
    const baselineHash = workBaselineHash({ revisions: f.current, manifests: f.links, recordSources: f.sources })
    f.plan.confirmedSnapshotJson.baselineHash = baselineHash
    const result = await previewBoqWorkMatch(23, { lineKey: 'xlsx-row-70', expectedVersion: 2, baselineHash, proposals: [{ scopeId, signedRevisionId: 24, lineKey: 'xlsx-row-70', deltaQuantity: '3' }] })
    assert.equal(result.valid, false)
    assert.equal(result.matched, false)
    assert.equal(result.written, false)
    assert.match(result.unsupportedReason!, /暂不支持/)
    assert.ok(result.errors.includes(result.unsupportedReason!))
    assert.equal(result.errors.length, 1)
  })
})
