import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { listSignedBillCompletionCandidates } from '../lib/server/signedBillCompletionEvidence'

const sourceRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 181, status: 'READY_TO_MEASURE', structureName: '盖板', phaseName: '安装', spec: '60x60',
  side: 'LEFT', startPk: '0+018.00', endPk: '0+031.00', unit: '个',
  actualQuantity: null, proposedQuantity: new Prisma.Decimal('105'),
  occurredAt: new Date('2026-06-30T00:00:00Z'), measuredAt: null,
  measurementPeriod: null, measurementDetailId: null,
  fieldDescription: '现场完成记录原文', remark: '仍需与全账单核对',
  roadSection: { id: 11, name: '平交路口' },
  mainRoadSection: { id: 38, name: '阿尼比莱克鲁2C号路' },
  boqItem: { code: '405i', unit: 'ml' }, ...overrides,
})

test('completion candidates stay project scoped and retain historical source facts without assigning bill coverage', async () => {
  const client = prisma.siteVariationMeasurement as unknown as { findMany: (args: unknown) => Promise<unknown[]> }
  const original = client.findMany
  let query: unknown
  client.findMany = async (args) => { query = args; return [sourceRecord()] }
  try {
    const [candidate] = await listSignedBillCompletionCandidates(3313, 7)
    assert.deepEqual((query as { where: unknown }).where, { projectId: 3313, status: { in: ['READY_TO_MEASURE', 'MEASURED'] } })
    assert.equal(candidate.status, '待与本期全部账单明细核对')
    assert.equal(candidate.quantity, '105')
    assert.equal(candidate.unit, '个')
    assert.equal(candidate.road, '阿尼比莱克鲁2C号路 / 平交路口')
    assert.equal(candidate.side, 'LEFT')
    assert.equal(candidate.pkStart, '0+018.00')
    assert.match(candidate.note, /2026-06-30/)
    assert.match(candidate.note, /第7期全部明细及以前累计/)
    assert.match(candidate.note, /未作换算，禁止直接相减/)
    assert.match(candidate.note, /空关联不代表从未计量/)
    assert.match(candidate.note, /现场完成记录原文/)
    assert.equal('completionState' in candidate, false)
  } finally { client.findMany = original }
})

test('candidate quantities preserve actual zero, negatives and unknown units; PK length and BoQ units never fill unknown values', async () => {
  const client = prisma.siteVariationMeasurement as unknown as { findMany: (args: unknown) => Promise<unknown[]> }
  const original = client.findMany
  client.findMany = async () => [
    sourceRecord({ id: 1, actualQuantity: new Prisma.Decimal('0'), proposedQuantity: new Prisma.Decimal('105') }),
    sourceRecord({ id: 2, actualQuantity: new Prisma.Decimal('-1.2500001'), proposedQuantity: null }),
    sourceRecord({ id: 3, actualQuantity: null, proposedQuantity: null, unit: null }),
  ]
  try {
    const candidates = await listSignedBillCompletionCandidates(1, 10)
    assert.deepEqual(candidates.map((candidate) => candidate.quantity), ['0', '-1.2500001', null])
    assert.equal(candidates[2].unit, null)
    assert.match(candidates[0].note, /源实际数量 0；源拟计量数量 105，两者不同/)
    assert.match(candidates[2].note, /源数量未知，保留空白/)
    assert.ok(candidates.every((candidate) => candidate.status === '待与本期全部账单明细核对'))
  } finally { client.findMany = original }
})

test('measured source flags remain candidates, equivalent length units do not create a false mismatch, and invalid scopes never query', async () => {
  const client = prisma.siteVariationMeasurement as unknown as { findMany: (args: unknown) => Promise<unknown[]> }
  const original = client.findMany
  let queries = 0
  client.findMany = async () => { queries++; return [sourceRecord({ status: 'MEASURED', unit: 'm', boqItem: { code: '405i', unit: 'ml' }, roadSection: { id: 38, name: '阿尼比莱克鲁2C号路' }, measuredAt: new Date('2026-07-05T00:00:00Z') })] }
  try {
    await assert.rejects(listSignedBillCompletionCandidates(0, 7))
    await assert.rejects(listSignedBillCompletionCandidates(3313, -1))
    assert.equal(queries, 0)
    const [candidate] = await listSignedBillCompletionCandidates(3313, 7)
    assert.match(candidate.note, /源状态 MEASURED/)
    assert.match(candidate.note, /源计量日期：2026-07-05/)
    assert.doesNotMatch(candidate.note, /单位.*不一致/)
    assert.equal(candidate.road, '阿尼比莱克鲁2C号路')
    assert.equal(candidate.status, '待与本期全部账单明细核对')
  } finally { client.findMany = original }
})
