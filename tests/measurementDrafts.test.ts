import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdvanceMeasurementEntry } from '../lib/boq/measurementDrafts'

test('note-only advance edits preserve the exact saved amount and existing blanks', () => {
  assert.deepEqual(buildAdvanceMeasurementEntry('0', { note: 'Checked' }, { amount: '123.45', note: 'Old' }), { period: '0', amount: '123.45', note: 'Checked' })
  assert.equal(buildAdvanceMeasurementEntry('0', { note: '' }, { amount: '9999999999999999.12', note: 'Old' }).amount, '9999999999999999.12')
  assert.equal(buildAdvanceMeasurementEntry('0', { note: 'Unknown' }, undefined).amount, null)
})

test('explicit advance edits retain their prior normalization and clearing behavior', () => {
  assert.deepEqual(buildAdvanceMeasurementEntry('0', { amount: '1,234.45' }, { amount: '99', note: 'Retained' }), { period: '0', amount: '1234.5', note: 'Retained' })
  assert.equal(buildAdvanceMeasurementEntry('0', { amount: '' }, { amount: '99', note: null }).amount, null)
  assert.equal(buildAdvanceMeasurementEntry('0', { amount: 'invalid' }, undefined).amount, 'invalid')
})
