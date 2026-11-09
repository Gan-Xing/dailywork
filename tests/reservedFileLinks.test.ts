import assert from 'node:assert/strict'
import test from 'node:test'

import { mutableFileLinkReplacements, ReservedFileLinkError, type FileLinkReference } from '../lib/files/reservedFileLinks'

const archived = {
  id: 901, fileId: 668, entityType: 'signed-bill-revision', entityId: '23',
  purpose: 'calculation-review', label: '原账单计算明细',
  meta: { sourceSha256: 'original-hash', coverage: { detailRows: 1800, sourceRows: 1842 }, items: [{ quantity: null }, { quantity: '0.000' }] },
  createdAt: new Date('2026-10-22T23:00:00Z'), createdById: 1,
}
const ordinary: FileLinkReference = { entityType: 'boq-bill-period', entityId: '3313:7', purpose: 'calculation-xlsx', label: '本期原件' }

test('empty or omitted reserved links do not become deletion/recreation candidates', () => {
  const before = structuredClone(archived)
  assert.deepEqual(mutableFileLinkReplacements([], [archived]), [])
  assert.deepEqual(mutableFileLinkReplacements([ordinary], [archived]), [ordinary])
  assert.deepEqual(archived, before)
  assert.equal(archived.id, 901)
  assert.equal(archived.createdById, 1)
})

test('ordinary editors can echo an identical archive with reordered JSON keys, retaining original database rows', () => {
  const echo: FileLinkReference = { entityType: 'signed-bill-revision', entityId: '23', purpose: archived.purpose, label: archived.label, meta: { items: [{ quantity: null }, { quantity: '0.000' }], coverage: { sourceRows: 1842, detailRows: 1800 }, sourceSha256: 'original-hash' } }
  assert.deepEqual(mutableFileLinkReplacements([echo, ordinary], [archived]), [ordinary])
  const pdf = { ...archived, id: 902, purpose: 'signed-pdf', meta: null }
  assert.deepEqual(mutableFileLinkReplacements([pdf], [archived, pdf]), [])
})

test('reserved archive creation and changes to entity, purpose, label, source or decimal values are rejected', () => {
  for (const edited of [
    { ...archived, entityId: '24' },
    { ...archived, purpose: 'signed-pdf' },
    { ...archived, label: '修改后的来源' },
    { ...archived, meta: { ...archived.meta, sourceSha256: 'other-hash' } },
    { ...archived, meta: { ...archived.meta, items: [{ quantity: '0' }, { quantity: '0.000' }] } },
    { ...archived, meta: { ...archived.meta, items: [...archived.meta.items].reverse() } },
  ]) assert.throws(() => mutableFileLinkReplacements([edited], [archived]), ReservedFileLinkError)
  assert.throws(() => mutableFileLinkReplacements([archived], []), ReservedFileLinkError)
  assert.throws(() => mutableFileLinkReplacements([archived, archived], [archived]), ReservedFileLinkError)
  assert.throws(() => mutableFileLinkReplacements([{ ...archived, entityType: ' signed-bill-revision ' }], []), ReservedFileLinkError)
})
