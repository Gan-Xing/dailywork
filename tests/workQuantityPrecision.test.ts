import assert from 'node:assert/strict'
import test from 'node:test'
import { addWorkQuantities, formatWorkQuantity, normalizeWorkQuantity } from '../lib/boq/quantityDecimal'

test('working measurement periods add 24.88 and 3.185 without exposing binary floating-point tails', () => {
  const periods = ['24.880000000000000000', '3.185000000000000000']
  const cumulative = periods.reduce(addWorkQuantities, '0')
  assert.equal(cumulative, '28.065')
  assert.equal(formatWorkQuantity(cumulative), '28.065')
  assert.equal(addWorkQuantities('41.3334', cumulative), '69.3984')
})

test('period group accumulation remains exact across regrouping and signed corrections', () => {
  assert.equal(addWorkQuantities('0.1', '0.2'), '0.3')
  const perPeriod = [['0.1', '0.2'], ['24.88', '3.185'], ['-0.3']]
  const grouped = perPeriod.map((period) => period.reduce(addWorkQuantities, '0')).reduce(addWorkQuantities, '0')
  const flat = perPeriod.flat().reduce(addWorkQuantities, '0')
  assert.equal(grouped, '28.065')
  assert.equal(grouped, flat)
  assert.equal(addWorkQuantities('28.065', '-28.065'), '0')
})

test('all 18 source decimal places and large integer digits survive accumulation and carry', () => {
  assert.equal(addWorkQuantities('200.123400000000000001', '0.000000000000000001'), '200.123400000000000002')
  assert.equal(addWorkQuantities('99999999999999999999.999999999999999999', '0.000000000000000001'), '100000000000000000000')
  assert.equal(addWorkQuantities('-0.000000000000000001', '0'), '-0.000000000000000001')
})

test('raw decimal input normalization distinguishes unknown from an explicit zero', () => {
  for (const value of [null, undefined, '', ' ', '-', 'invalid']) assert.equal(normalizeWorkQuantity(value), null)
  assert.equal(normalizeWorkQuantity('0.000'), '0')
  assert.equal(normalizeWorkQuantity('-0.000'), '0')
  assert.equal(normalizeWorkQuantity(' 1,003.185000 '), '1003.185')
  assert.equal(normalizeWorkQuantity('.185'), '0.185')
  assert.equal(normalizeWorkQuantity('3.'), '3')
  assert.throws(() => addWorkQuantities('invalid', '0'), TypeError)
})
