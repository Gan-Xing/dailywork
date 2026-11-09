import assert from 'node:assert/strict'
import test from 'node:test'

import { filterCalculationRecords, hasDocumentedUnmeasuredCompletion, supplementaryCalculationLines } from '../components/value/SignedBillCalculationRows'
import type { SignedCalculationRecord, SignedCalculationReviewDto } from '../lib/value/signedBillCalculations'

const record = (id: number, overrides: Partial<SignedCalculationRecord> = {}): SignedCalculationRecord => ({
  id, recordId: `source-${id}`, lineKeys: ['xlsx-row-40'], rowType: 'DETAIL', road: 'Voie 1', structure: null,
  description: null, side: 'G', pkStart: '0', pkEnd: '100', unit: 'm3', dimensions: [], calculatedQuantity: null,
  formula: null, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null, billingState: 'UNKNOWN',
  completionState: 'UNKNOWN', completionEvidence: null, sourceNote: null, note: null, updatedAt: '2026-10-22T00:00:00.000Z',
  sourceSheet: 'DETAILS CALCULS 7', sourceRow: id, sourceRange: `A${id}:Q${id}`, ...overrides,
})

test('default measured rows preserve prior-only work and negative adjustments without counting printed subtotals twice', () => {
  const rows = [
    record(1, { previousQuantity: '12.3456789', currentQuantity: null, cumulativeQuantity: '12.3456789', billingState: 'MEASURED' }),
    record(2, { currentQuantity: '-1.25', cumulativeQuantity: '11.0956789', billingState: 'ADJUSTMENT' }),
    record(3, { rowType: 'SUBTOTAL', cumulativeQuantity: '11.0956789', billingState: 'MEASURED' }),
    record(4, { cumulativeQuantity: '0', billingState: 'UNMEASURED' }),
    record(5),
    record(6, { lineKeys: ['another-price'], currentQuantity: '99', billingState: 'MEASURED' }),
  ]
  assert.deepEqual(filterCalculationRecords(rows, 'xlsx-row-40', 'measured').map((row) => row.id), [1, 2])
  assert.deepEqual(filterCalculationRecords(rows, 'xlsx-row-40', 'measured', true).map((row) => row.id), [1, 2, 3])
  assert.deepEqual(filterCalculationRecords(rows, 'xlsx-row-40', 'pending').map((row) => row.id), [4, 5])
  assert.equal(rows[0].previousQuantity, '12.3456789')
  assert.equal(rows[0].currentQuantity, null)
})

test('completed-unmeasured requires both unmeasured source values and explicit completion evidence', () => {
  const blank = record(1)
  const zero = record(2, { cumulativeQuantity: '0.000', billingState: 'UNMEASURED' })
  const assertedOnly = record(3, { billingState: 'UNMEASURED', completionState: 'COMPLETED' })
  const documented = record(4, { billingState: 'UNMEASURED', completionState: 'COMPLETED', completionEvidence: 'Same project / price / road / side / PK and cumulative cutoff verified against completion evidence.' })
  const measured = record(5, { billingState: 'MEASURED', completionState: 'COMPLETED', completionEvidence: 'Completed and already measured.' })
  assert.equal(hasDocumentedUnmeasuredCompletion(blank), false)
  assert.equal(hasDocumentedUnmeasuredCompletion(zero), false)
  assert.equal(hasDocumentedUnmeasuredCompletion(assertedOnly), false)
  assert.equal(hasDocumentedUnmeasuredCompletion(measured), false)
  assert.deepEqual(filterCalculationRecords([blank, zero, assertedOnly, documented, measured], 'xlsx-row-40', 'completed-unmeasured').map((row) => row.id), [4])
})

test('bound nonzero item-header values remain visible without promoting unrelated section headings', () => {
  const rows = [
    record(18, { sourceRow: 18, rowType: 'ITEM_HEADER', lineKeys: ['a7-001'], currentQuantity: '0.8', cumulativeQuantity: '0.8', billingState: 'MEASURED' }),
    record(164, { sourceRow: 164, rowType: 'ITEM_HEADER', lineKeys: ['b10-201a'], currentQuantity: '5063.2', pkStart: '0', pkEnd: '1940', billingState: 'MEASURED' }),
    record(459, { sourceRow: 459, rowType: 'ITEM_HEADER', lineKeys: ['b10-403e3'], currentQuantity: '10', side: 'CD', pkStart: '690', billingState: 'MEASURED' }),
    record(17, { rowType: 'SECTION_HEADER', lineKeys: [], currentQuantity: '0.8', billingState: 'MEASURED' }),
    record(20, { rowType: 'ITEM_HEADER', lineKeys: ['a7-001'], cumulativeQuantity: '0', billingState: 'UNMEASURED' }),
  ]
  for (const [key, id] of [['a7-001', 18], ['b10-201a', 164], ['b10-403e3', 459]] as const) {
    assert.deepEqual(filterCalculationRecords(rows, key, 'measured').map((row) => row.id), [id])
    assert.deepEqual(filterCalculationRecords(rows, key, 'all').map((row) => row.id), [id])
  }
})

test('unpriced template leaves are data-driven, separate from archived lines, and keep blank amounts', () => {
  for (const count of [4, 14]) {
    const items = Array.from({ length: count }, (_, index) => ({
      lineKey: `template-${index}`, sourceRow: 100 + index, code: '', designation: `Unpriced leaf ${index}`, unit: 'm3',
      unitPrice: null, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null,
      previousAmountHt: null, currentAmountHt: null, cumulativeAmountHt: null, archivedLine: false,
    }))
    const review: SignedCalculationReviewDto = { revisionId: 23, available: true, items, records: [] }
    const extra = supplementaryCalculationLines(review, [])
    assert.equal(extra.length, count)
    for (const line of extra) {
      assert.equal(line.boqItemId, null)
      assert.equal(line.unitPrice, null)
      assert.equal(line.amount, null)
      assert.equal(line.quantity, null)
    }
    assert.equal(supplementaryCalculationLines(review, [extra[0]]).length, count - 1)
    assert.equal(supplementaryCalculationLines(null, []).length, 0)
  }
})
