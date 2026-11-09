import assert from 'node:assert/strict'
import test from 'node:test'
import type { ValueBillReviewRecord } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { classifyCalculationBilling } from '../lib/value/signedBillCalculations'
import { getSignedCalculationReview, parseCalculationNote, signedCalculationRecordDto, updateSignedCalculationNote } from '../lib/server/signedBillCalculationStore'
import { SignedBillError } from '../lib/value/signedBills'

const row = {
  id: 71, recordId: 'source-row-22', reviewId: 5, note: null, updatedAt: new Date('2026-10-22T23:00:00.000Z'), unit: 'm²', formula: null,
  data: { templateLeafRows: [54], rowType: 'DETAIL', sourceSheet: 'DETAILS CALCULS 7', sourceRow: 22, sourceRange: 'A22:P22', roadNameOriginal: 'Voie 1', side: { value: 'CG' }, pkStart: { value: '0+000' }, pkEnd: { value: '0+100' }, previousQuantity: { numericValue: '0' }, currentQuantity: { numericValue: null }, cumulativeQuantity: { numericValue: null }, dimensionsByOriginalColumn: { L: { numericValue: '3389.550000000001', formula: '=F22*G22' } } },
} as unknown as ValueBillReviewRecord

test('billing classification preserves blank, explicit zero, historic measurement and reversal', () => {
  assert.equal(classifyCalculationBilling(null, null, null), 'UNKNOWN')
  assert.equal(classifyCalculationBilling('0', '0', '0'), 'UNMEASURED')
  assert.equal(classifyCalculationBilling('0', null, null), 'UNKNOWN')
  assert.equal(classifyCalculationBilling('100', null, '100'), 'MEASURED')
  assert.equal(classifyCalculationBilling('100', '-100', '0'), 'ADJUSTMENT')
  assert.equal(classifyCalculationBilling('100', '-3.140000000001', '96.859999999999'), 'ADJUSTMENT')
})

test('geometry and source billing status never establish construction completion', () => {
  const dto = signedCalculationRecordDto(row)
  assert.equal(dto.calculatedQuantity, '3389.550000000001')
  assert.equal(dto.currentQuantity, null)
  assert.equal(dto.billingState, 'UNKNOWN')
  assert.equal(dto.completionState, 'UNKNOWN')
  assert.equal(dto.completionEvidence, null)
  assert.deepEqual(dto.lineKeys, ['xlsx-row-54'])
})

test('only an actual source merge supplies an otherwise blank location; quantities stay blank', () => {
  const merged = { ...row, data: { ...(row.data as object), pkStart: { value: null, verticalMergeAnchorEvidence: { range: 'D21:D22', anchorCell: 'D21', anchorValue: 'PK 0+050' } }, pkEnd: { value: null } } } as ValueBillReviewRecord
  const dto = signedCalculationRecordDto(merged)
  assert.equal(dto.pkStart, 'PK 0+050')
  assert.equal(dto.pkEnd, null)
  assert.match(dto.locationNote!, /D21:D22/)
  assert.equal(dto.currentQuantity, null)
})

test('a bill-summary conflict stays pending even when the calculation sheet contains a positive quantity', () => {
  const conflict = { ...row, source: { billingReviewReason: '底稿有15，主表累计0，待核' }, data: { ...(row.data as object), currentQuantity: { numericValue: '15' }, cumulativeQuantity: { numericValue: '15' } } } as ValueBillReviewRecord
  const dto = signedCalculationRecordDto(conflict)
  assert.equal(dto.currentQuantity, '15')
  assert.equal(dto.billingState, 'UNKNOWN')
  assert.match(dto.billingNote!, /待核/)
  assert.equal(dto.completionState, 'UNKNOWN')
})

const correctionRow = () => ({
  ...row, note: '人工复核备注保持不变', unit: 'ml',
  data: {
    ...(row.data as object), unit: { cell: 'M22', value: null },
    previousQuantity: { cell: 'N22', numericValue: '0' }, currentQuantity: { cell: 'O22', numericValue: '350' }, cumulativeQuantity: { cell: 'P22', numericValue: '0', formula: '=N22' },
  },
}) as ValueBillReviewRecord
const quantityCorrection = () => ({ field: 'cumulativeQuantity', cell: 'P22', oldNumericValue: '0', newNumericValue: '350', reason: '原累计漏加本期量', evidence: 'N22=0、O22=350，已核同项目同项累计口径。' })

test('audited quantity overrides change only effective DTO values while preserving original cells and manual remarks', () => {
  const original = { ...correctionRow(), source: { quantityCorrections: [quantityCorrection()] } } as ValueBillReviewRecord
  const before = JSON.stringify(original)
  const dto = signedCalculationRecordDto(original)
  assert.equal(dto.previousQuantity, '0')
  assert.equal(dto.currentQuantity, '350')
  assert.equal(dto.cumulativeQuantity, '350')
  assert.equal(dto.note, '人工复核备注保持不变')
  assert.equal(dto.updatedAt, row.updatedAt.toISOString())
  assert.match(dto.correctionNote!, /DETAILS CALCULS 7!P22：0 → 350/)
  assert.match(dto.correctionNote!, /原累计漏加本期量/)
  assert.equal(dto.quantityCorrections?.[0].oldNumericValue, '0')
  assert.equal(dto.completionState, 'UNKNOWN')
  assert.equal(JSON.stringify(original), before)
})

test('quantity overrides reject wrong cells, stale source values, duplicate fields and incomplete evidence', () => {
  const invalid = [
    null,
    [null],
    [{ ...quantityCorrection(), field: 'amount' }],
    [{ ...quantityCorrection(), cell: 'P23' }],
    [{ ...quantityCorrection(), oldNumericValue: '0.0' }],
    [{ ...quantityCorrection(), oldNumericValue: 0 }],
    [{ ...quantityCorrection(), newNumericValue: '1e3' }],
    [{ ...quantityCorrection(), newNumericValue: 'NaN' }],
    [{ ...quantityCorrection(), newNumericValue: undefined }],
    [{ ...quantityCorrection(), reason: '' }],
    [{ ...quantityCorrection(), evidence: ' ' }],
    [quantityCorrection(), quantityCorrection()],
  ]
  for (const quantityCorrections of invalid) {
    const candidate = { ...correctionRow(), source: { quantityCorrections } } as unknown as ValueBillReviewRecord
    assert.throws(() => signedCalculationRecordDto(candidate), (error: unknown) => error instanceof Error && 'status' in error && error.status === 409)
  }
})

test('effective quantity corrections preserve explicit blanks, negative adjustments and exact source precision', () => {
  const blank = { ...correctionRow(), source: { quantityCorrections: [{ ...quantityCorrection(), newNumericValue: null }] } } as ValueBillReviewRecord
  assert.equal(signedCalculationRecordDto(blank).cumulativeQuantity, null)
  const reversal = { ...correctionRow(), source: { quantityCorrections: [{ ...quantityCorrection(), newNumericValue: '-350.123400000001' }] } } as ValueBillReviewRecord
  const dto = signedCalculationRecordDto(reversal)
  assert.equal(dto.cumulativeQuantity, '-350.123400000001')
  assert.equal(dto.billingState, 'ADJUSTMENT')
})

test('geometry-result corrections validate the actual L/K source cell without establishing measurement or completion', () => {
  const original = {
    ...row,
    data: { ...(row.data as object), sourceRow: 177, sourceRange: 'A177:P177', dimensionsByOriginalColumn: { L: { cell: 'L177', numericValue: '3257', formula: '=SUM(L146:L176)' } } },
    source: { quantityCorrections: [{ field: 'calculatedQuantity', cell: 'L177', oldNumericValue: '3257', newNumericValue: '3547', reason: '计算小计漏两项', evidence: 'L144=200、L145=90，应一并纳入；原公式保留。' }] },
  } as ValueBillReviewRecord
  const before = JSON.stringify(original)
  const dto = signedCalculationRecordDto(original)
  assert.equal(dto.calculatedQuantity, '3547')
  assert.equal(dto.formula, '=SUM(L146:L176)')
  assert.equal(dto.previousQuantity, '0')
  assert.equal(dto.currentQuantity, null)
  assert.equal(dto.cumulativeQuantity, null)
  assert.equal(dto.billingState, 'UNKNOWN')
  assert.equal(dto.completionState, 'UNKNOWN')
  assert.match(dto.correctionNote!, /计算量 DETAILS CALCULS 7!L177/)
  assert.equal(JSON.stringify(original), before)
  const source = original.source as { quantityCorrections: Array<Record<string, unknown>> }
  assert.throws(() => signedCalculationRecordDto({ ...original, source: { quantityCorrections: [{ ...source.quantityCorrections[0], cell: 'K177' }] } } as ValueBillReviewRecord), /原单元格/)
})

test('audited units apply to the original display unit and do not clear unresolved billing warnings', () => {
  const unitCorrection = { oldUnit: 'ml', newUnit: 'm²', reason: '该块按长乘宽计算面积，原小计单位误写', evidence: '已核该块M列及对应主表面积项，未换算数量。' }
  const original = { ...correctionRow(), source: { quantityCorrections: [quantityCorrection()], unitCorrection, billingReviewReason: '另有数量口径差异仍待核' } } as ValueBillReviewRecord
  const before = JSON.stringify(original)
  const dto = signedCalculationRecordDto(original)
  assert.equal(dto.unit, 'm²')
  assert.equal(dto.currentQuantity, '350')
  assert.equal(dto.billingState, 'UNKNOWN')
  assert.match(dto.billingNote!, /仍待核/)
  assert.match(dto.correctionNote!, /单位：ml → m²/)
  assert.equal(dto.unitCorrection?.oldUnit, 'ml')
  assert.equal(dto.note, original.note)
  assert.equal(JSON.stringify(original), before)
  for (const invalid of [null, { ...unitCorrection, oldUnit: null }, { ...unitCorrection, oldUnit: 'm2' }, { ...unitCorrection, newUnit: '' }, { ...unitCorrection, newUnit: 'm'.repeat(33) }, { ...unitCorrection, newUnit: 'm\nl' }, { ...unitCorrection, evidence: '' }]) {
    assert.throws(() => signedCalculationRecordDto({ ...correctionRow(), source: { unitCorrection: invalid } } as ValueBillReviewRecord), /明细修正依据不匹配/)
  }
  const actualCellUnit = { ...correctionRow(), data: { ...(correctionRow().data as object), unit: { cell: 'M22', value: 'm3' } }, source: { unitCorrection } } as ValueBillReviewRecord
  assert.throws(() => signedCalculationRecordDto(actualCellUnit), /原始显示单位/)
})

test('remarks validate stale-version token, length, text and record identifier', () => {
  assert.equal(parseCalculationNote({ recordId: 71, note: '  已核原表  ', expectedUpdatedAt: row.updatedAt.toISOString() }).note, '已核原表')
  for (const invalid of [{ recordId: '71', note: 'x', expectedUpdatedAt: row.updatedAt.toISOString() }, { recordId: 71, note: null }, { recordId: 71, note: 'x', expectedUpdatedAt: '' }, { recordId: 71, note: 'x'.repeat(2001), expectedUpdatedAt: row.updatedAt.toISOString() }]) assert.throws(() => parseCalculationNote(invalid))
})

test('remark edits enforce bill membership and compare-and-swap before writing an audit event', async () => {
  const client = prisma as unknown as { $transaction: (callback: unknown) => Promise<unknown> }
  const original = client.$transaction
  let changed = 0, audits = 0, race = false, foreign = false
  const tx = {
    boqBillRevision: { findUnique: async () => ({ id: 23, projectId: 3313, project: { code: 'agni' }, periodIndex: 7, calculationFileId: 668, calculationFile: { checksum: 'source-hash' } }) },
    fileAssetLink: { findMany: async () => [{ meta: { format: 'SIGNED_CALCULATION_V1', projectId: 3313, periodIndex: 7, sourceSha256: 'source-hash', reviewKey: 'key' } }] },
    valueBillReview: { findUnique: async () => ({ id: 5, key: 'key', projectCode: 'agni', sourceSha256: 'source-hash', attachmentNumber: 7 }) },
    valueBillReviewRecord: {
      findFirst: async () => foreign ? null : row,
      updateMany: async ({ where }: { where: { updatedAt: Date } }) => { assert.equal(where.updatedAt.toISOString(), row.updatedAt.toISOString()); if (race) return { count: 0 }; changed++; return { count: 1 } },
      findUniqueOrThrow: async () => ({ ...row, note: '已核原表' }),
    },
    boqBillRevisionEvent: { create: async ({ data }: { data: { payload: { oldNote: null; newNote: string }; actorId: number } }) => { assert.equal(data.actorId, 1); assert.equal(data.payload.oldNote, null); assert.equal(data.payload.newNote, '已核原表'); audits++ } },
  }
  client.$transaction = async (callback: unknown) => (callback as (context: typeof tx) => unknown)(tx)
  const input = { recordId: 71, note: '已核原表', expectedUpdatedAt: row.updatedAt.toISOString() }
  try {
    await assert.rejects(updateSignedCalculationNote(23, { ...input, expectedUpdatedAt: new Date(0).toISOString() }, 1), /其他人更新/)
    assert.equal(changed, 0); assert.equal(audits, 0)
    foreign = true; await assert.rejects(updateSignedCalculationNote(23, input, 1), /不属于/); foreign = false
    race = true; await assert.rejects(updateSignedCalculationNote(23, input, 1), /其他人更新/); assert.equal(audits, 0)
    race = false; const saved = await updateSignedCalculationNote(23, input, 1)
    assert.equal(saved.note, '已核原表'); assert.equal(changed, 1); assert.equal(audits, 1)
  } finally { client.$transaction = original }
})

async function withCalculationContext(run: (fixture: {
  revision: { project: { code: string | null } | null }
  review: { projectCode: unknown }
  calls: string[]
}) => Promise<void>) {
  const calls: string[] = []
  const revision = { id: 23, projectId: 3313, project: { code: 'agni' } as { code: string | null } | null, periodIndex: 7, calculationFileId: 668, calculationFile: { checksum: 'source-hash' } }
  const review = { id: 5, key: 'key', projectCode: 'agni' as unknown, sourceSha256: 'source-hash', attachmentNumber: 7, sourceFileName: 'calculation.xlsx', importedAt: new Date(0) }
  const models = {
    boqBillRevision: { findUnique: async () => revision },
    fileAssetLink: { findMany: async () => [{ meta: { format: 'SIGNED_CALCULATION_V1', projectId: 3313, periodIndex: 7, sourceSha256: 'source-hash', reviewKey: 'key', items: [], coverage: {}, sourceVerification: 'fixture' } }] },
    valueBillReview: { findUnique: async () => review },
    valueBillReviewRecord: {
      findMany: async () => { calls.push('records'); return [row] },
      findFirst: async () => { calls.push('record'); return row },
      updateMany: async () => { calls.push('update'); return { count: 1 } },
      findUniqueOrThrow: async () => ({ ...row, note: 'Verified' }),
    },
    siteVariationMeasurement: { findMany: async () => { calls.push('completion'); return [] } },
    boqBillRevisionEvent: { create: async () => { calls.push('audit') } },
  }
  const replacements = { ...models, $transaction: async (callback: (tx: typeof models) => unknown) => callback(models) }
  const client = prisma as unknown as Record<string, unknown>
  const originals = Object.fromEntries(Object.keys(replacements).map((key) => [key, client[key]]))
  try {
    Object.assign(client, replacements)
    await run({ revision, review, calls })
  } finally { Object.assign(client, originals) }
}

test('GET and PATCH reject foreign or unknown review projects even with matching source checksum and period', async () => {
  await withCalculationContext(async ({ review, calls }) => {
    for (const projectCode of ['foreign-project', '3313', '', ' ', null, undefined, 3313]) {
      review.projectCode = projectCode
      const conflict = (error: unknown) => error instanceof SignedBillError && error.status === 409
      await assert.rejects(getSignedCalculationReview(23), conflict)
      await assert.rejects(updateSignedCalculationNote(23, { recordId: row.id, note: 'Verified', expectedUpdatedAt: row.updatedAt.toISOString() }, 1), conflict)
      assert.deepEqual(calls, [], 'No foreign records, completion candidates, remark updates or audit writes')
    }
  })
})

test('GET and PATCH fail closed when the revision project identity is missing or blank', async () => {
  await withCalculationContext(async ({ revision, review, calls }) => {
    for (const project of [null, { code: null }, { code: '' }, { code: ' ' }]) {
      revision.project = project
      review.projectCode = project?.code
      const conflict = (error: unknown) => error instanceof SignedBillError && error.status === 409
      await assert.rejects(getSignedCalculationReview(23), conflict)
      await assert.rejects(updateSignedCalculationNote(23, { recordId: row.id, note: 'Verified', expectedUpdatedAt: row.updatedAt.toISOString() }, 1), conflict)
      assert.deepEqual(calls, [])
    }
  })
})

test('GET and PATCH accept the actual project code, not the numeric project ID', async () => {
  await withCalculationContext(async ({ calls }) => {
    const result = await getSignedCalculationReview(23)
    assert.equal(result.available, true)
    assert.equal(result.reviewKey, 'key')
    assert.equal(result.records[0].id, row.id)
    assert.deepEqual(calls, ['records', 'completion'])
    const saved = await updateSignedCalculationNote(23, { recordId: row.id, note: 'Verified', expectedUpdatedAt: row.updatedAt.toISOString() }, 1)
    assert.equal(saved.note, 'Verified')
    assert.deepEqual(calls, ['records', 'completion', 'record', 'update', 'audit'])
  })
})
