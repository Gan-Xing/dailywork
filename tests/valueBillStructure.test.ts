import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getValueBillStructureComponent,
  isValueBillStructurePhase,
} from '../lib/value/valueBillStructure'

test('cast-in-place drains are included in structure review and grouped as drains', () => {
  assert.equal(isValueBillStructurePhase('现浇边沟'), true)
  assert.equal(getValueBillStructureComponent('现浇边沟'), '边沟')
})

test('unrelated road phases are excluded from structure review', () => {
  assert.equal(isValueBillStructurePhase('基层'), false)
  assert.equal(getValueBillStructureComponent('过道涵'), '过道涵')
})
