import assert from 'node:assert/strict'
import test from 'node:test'

import { signedBillDifference, sumSignedBillAmounts } from '../lib/finance/signedBillAmounts'

test('signed financial totals preserve all source digits beyond Decimal default precision', () => {
  assert.equal(sumSignedBillAmounts(['99999999999999999999.1234567890', '0.0000000001']), '99999999999999999999.1234567891')
  assert.equal(sumSignedBillAmounts(['0.1', '0.2', '-0.3']), '0')
  assert.equal(sumSignedBillAmounts([]), null)
  assert.equal(sumSignedBillAmounts(['0']), '0')
})

test('signed differences use source decimal strings rather than the legacy Number DTO', () => {
  assert.equal(signedBillDifference('9999999999999999.1234567890', '9999999999999999.12'), '0.003456789')
  assert.equal(signedBillDifference('1.01', '2.02'), '-1.01')
  assert.equal(signedBillDifference(null, '0'), null)
  assert.equal(signedBillDifference('0', null), null)
})
