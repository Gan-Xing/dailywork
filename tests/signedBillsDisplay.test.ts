import assert from 'node:assert/strict'
import test from 'node:test'

import { formatSourceDecimal } from '../components/value/SignedBillsPanel'

test('signed display distinguishes source blanks from an explicit zero', () => {
  assert.equal(formatSourceDecimal(null, 'zh'), '—')
  assert.equal(formatSourceDecimal(undefined, 'zh'), '—')
  assert.equal(formatSourceDecimal('', 'zh'), '—')
  assert.equal(formatSourceDecimal('0', 'zh'), '0')
  assert.equal(formatSourceDecimal('0.00', 'zh'), '0.00')
})

test('signed display preserves cents and precision beyond JavaScript safe integers', () => {
  const source = '12345678901234567890.123400'
  assert.equal(formatSourceDecimal(source, 'zh'), '12,345,678,901,234,567,890.123400')
  assert.equal(formatSourceDecimal(source, 'fr'), '12\u202f345\u202f678\u202f901\u202f234\u202f567\u202f890,123400')
})

test('negative reversal quantities and the source VAT decimals are not rounded', () => {
  assert.equal(formatSourceDecimal('-1234.56789012', 'zh'), '-1,234.56789012')
  assert.equal(formatSourceDecimal('16.263', 'fr'), '16,263')
  assert.equal(formatSourceDecimal('-0.00', 'zh'), '-0.00')
})
