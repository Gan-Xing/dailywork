import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSignedBillActivation,
  billDecimal,
  billPeriodIndex,
  canonicalBillJson,
  currentSignedBills,
  parseSignedBillAdjustments,
  parseSignedBillLines,
  parseSignedBillSource,
} from '../lib/value/signedBills'
import {
  parseCreateSignedBillInput,
  parseSignedBillDate,
  reconcileSignedBill,
} from '../lib/server/signedBillStore'

const line = {
  key: 'row-1', boqItemId: null, sourceCode: null, designation: 'Signed source item', unit: 'm3',
  unitPrice: '135500', previousQuantity: '34', quantity: '-3.140000000001', cumulativeQuantity: '30.859999999999',
  previousAmount: '4607000', amount: '-425470.0000001355', cumulativeAmount: '4181529.9999998645',
}

const signedInput = {
  projectId: 1, periodIndex: 1, status: 'SIGNED', isSignedConfirmed: true,
  signedPdfFileId: 12, grossHt: '100.01', netHt: '80.01', vatAmount: '14.40', netTtc: '94.41',
  lines: [line], changeReason: 'Verified signed original',
}

test('negative reversals, source blanks and zero retain exact decimal text', () => {
  const [parsed] = parseSignedBillLines([{ ...line, previousQuantity: null, previousAmount: '0.00' }])
  assert.equal(parsed.quantity, '-3.140000000001')
  assert.equal(parsed.amount, '-425470.0000001355')
  assert.equal(parsed.previousQuantity, null)
  assert.equal(parsed.previousAmount, '0.00')
  assert.equal(parsed.sourceCode, null)
  assert.equal(billDecimal('', 'blank'), null)
  assert.equal(billDecimal('0', 'zero'), '0')
})

test('decimal numbers, infinity, exponents, commas and silent headline rounding are rejected', () => {
  for (const value of [NaN, Infinity, 100.1, '1e9', '1,000', 'Infinity', ' 1 ', '+1', '01']) {
    assert.throws(() => billDecimal(value, 'amount'))
  }
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, netTtc: '94.41000000001' }), /精度/)
})

test('line keys must be unique but blank source codes and repeated mapped codes are allowed', () => {
  assert.throws(() => parseSignedBillLines([line, line]), /重复账单行键/)
  assert.equal(parseSignedBillLines([line, { ...line, key: 'row-2' }]).length, 2)
})

test('retention release is positive; typed recoveries and deductions are negative', () => {
  const rows = parseSignedBillAdjustments([
    { key: 'advance', kind: 'ADVANCE_RECOVERY', label: 'Recovery', effectHt: '-20.0000001' },
    { key: 'release', kind: 'RETENTION_RELEASE', label: 'Release', effectHt: '28.16' },
    { key: 'material', kind: 'MATERIAL_DEDUCTION', label: 'Material', effectHt: '-38.85' },
  ])
  assert.deepEqual(rows.map((row) => row.effectHt), ['-20.0000001', '28.16', '-38.85'])
  assert.throws(() => parseSignedBillAdjustments([{ ...rows[0], effectHt: '20' }]), /须为负值/)
  assert.throws(() => parseSignedBillAdjustments([{ ...rows[1], effectHt: '-28.16' }]), /须为正值/)
  assert.throws(() => parseSignedBillAdjustments([{ ...rows[0], kind: 'ROUNDING' }]), /类型无效/)
})

test('reconciliation exposes source differences without changing signed headlines or adding invented rounding', () => {
  const input = {
    grossHt: '100.01', netHt: '80.01', vatAmount: '14.40', netTtc: '94.41',
    lines: [
      { ...line, amount: '100.005000000001' },
      { ...line, key: 'printed-total', rowType: 'SUBTOTAL' as const, amount: '100.01' },
    ],
    adjustments: parseSignedBillAdjustments([{ key: 'advance', kind: 'ADVANCE_RECOVERY', label: 'Advance', effectHt: '-20' }]),
    summary: { vatRate: '0.18' },
  }
  const result = reconcileSignedBill(input)
  assert.equal(result.lineAmountTotal, '100.005000000001')
  assert.equal(result.lineGrossDifferenceHt, '-0.004999999999')
  assert.equal(result.computedNetHt, '80.01')
  assert.equal(result.computedVatAmount, '14.4018')
  assert.equal(result.vatDifference, '0.0018')
  assert.equal(result.netTtcDifference, '0')
  assert.equal(input.vatAmount, '14.40')
  assert.equal(input.adjustments.length, 1)
})

test('unknown item amount makes line sum unknown instead of treating source blank as zero', () => {
  const result = reconcileSignedBill({ grossHt: null, netHt: null, vatAmount: null, netTtc: null, lines: [{ ...line, amount: null }], adjustments: [], summary: {} })
  assert.equal(result.lineAmountTotal, null)
  assert.equal(result.knownLineAmountTotal, '0')
  assert.equal(result.missingLineAmountCount, 1)
  assert.equal(result.computedNetHt, null)
  assert.equal(result.computedNetTtc, null)
})

test('draft and historical versions never enter the current signed selection', () => {
  const rows = [
    { projectId: 1, periodIndex: 1, status: 'SIGNED', isCurrent: false, revision: 1 },
    { projectId: 1, periodIndex: 1, status: 'SIGNED', isCurrent: true, revision: 2 },
    { projectId: 1, periodIndex: 2, status: 'DRAFT', isCurrent: true, revision: 1 },
  ]
  assert.deepEqual(currentSignedBills(rows).map((row) => row.revision), [2])
  assert.throws(() => currentSignedBills([rows[1], { ...rows[1], revision: 3 }]), /多个当前/)
})

test('activation rejects draft and stale selection, and accepts a repeated current selection', () => {
  assert.throws(() => assertSignedBillActivation({ status: 'DRAFT' }, null, null), /草稿/)
  assert.throws(() => assertSignedBillActivation({ status: 'SIGNED' }, 9, 8), /刷新/)
  assert.doesNotThrow(() => assertSignedBillActivation({ status: 'SIGNED' }, 9, 9))
  assert.doesNotThrow(() => assertSignedBillActivation({ status: 'SIGNED' }, null, null))
})

test('SIGNED archive requires source totals, affirmative signature confirmation and explicit stale guard', () => {
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, isSignedConfirmed: false }), /核实/)
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, vatAmount: null }), /四项/)
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, activate: true }), /当前版本ID/)
  assert.equal(parseCreateSignedBillInput({ ...signedInput, activate: true, expectedCurrentRevisionId: null }).expectedCurrentRevisionId, null)
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, status: 'DRAFT', activate: true, expectedCurrentRevisionId: null }), /草稿/)
})

test('working snapshot cannot be combined with explicit imported lines and formal period zero is excluded', () => {
  assert.throws(() => parseCreateSignedBillInput({ ...signedInput, fromMeasurement: true }), /同时指定/)
  assert.throws(() => billPeriodIndex(0), /正整数/)
  assert.throws(() => billPeriodIndex('6'), /正整数/)
})

test('unknown signing date stays null and invalid calendar dates are rejected', () => {
  assert.equal(parseSignedBillDate(null), null)
  assert.equal(parseSignedBillDate('2026-10-15'), '2026-10-15')
  assert.throws(() => parseSignedBillDate('2026-02-30'), /无效/)
  assert.throws(() => parseSignedBillDate('2026-10-15T12:00:00Z'), /YYYY/)
})

test('canonical content digest ignores object key order while retaining source array order and exact text', () => {
  assert.equal(canonicalBillJson({ b: '0.01', a: { y: null, x: '0' } }), canonicalBillJson({ a: { x: '0', y: null }, b: '0.01' }))
  assert.notEqual(canonicalBillJson({ amount: '0.00' }), canonicalBillJson({ amount: null }))
  assert.notEqual(canonicalBillJson(['1', '2']), canonicalBillJson(['2', '1']))
})

test('evidence is bounded JSON with positive file IDs and validated SHA256', () => {
  assert.throws(() => parseSignedBillSource({ files: [{ fileId: 0 }] }), /正整数/)
  assert.throws(() => parseSignedBillSource({ files: [{ fileId: 1, sha256: 'bad' }] }), /SHA256/)
  assert.throws(() => parseSignedBillSource({ cell: Infinity }), /须为对象/)
  assert.throws(() => parseSignedBillSource({ files: [{ fileId: 1 }, { fileId: 1 }] }), /重复/)
  assert.throws(() => parseSignedBillSource({ notes: [3] }), /文本列表/)
  assert.deepEqual(parseSignedBillSource({ files: [{ fileId: 1, sha256: 'a'.repeat(64), locators: { sheet: 'A', cell: 'G146', page: 6 } }] }).files?.[0].fileId, 1)
})
