import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { prisma } from '../lib/prisma'
import { getFinanceLedgerCase, getFinanceLedgerInsights } from '../lib/server/financeLedgerStore'

const databaseUrl = process.env.AI_CHAT_TEST_DATABASE_URL

test('isolated Postgres: finance links only selected signed totals and preserves cash facts', { skip: !databaseUrl }, async () => {
  const connection = new URL(databaseUrl!)
  assert.ok(['127.0.0.1', 'localhost'].includes(connection.hostname))
  assert.equal(connection.pathname, '/dailywork_ai_test')
  assert.equal(process.env.DATABASE_URL, databaseUrl, 'The read store must use the isolated fixture database too')
  const token = randomUUID()
  const project = await prisma.project.create({ data: { name: `finance-fixture-${token}` } })
  const user = await prisma.user.create({ data: { username: `finance-fixture-${token}`, passwordHash: 'not-a-login' } })
  const file = await prisma.fileAsset.create({ data: {
    category: 'measurement', storageKey: `fixture-only/${token}.pdf`, bucket: 'fixture-only',
    originalName: 'signed-fixture.pdf', mimeType: 'application/pdf', size: 1,
  } })
  try {
    const ledger = await prisma.financeLedgerCase.create({ data: {
      projectId: project.id, periodIndex: 1, accountAmount: '9999999999999999.12', invoiceAmount: 321, chequeAmount: 100,
    } })
    const base = {
      projectId: project.id, periodIndex: 1, status: 'SIGNED' as const, signedPdfFileId: file.id,
      grossHt: '9999999999999999.1234567890', netHt: '9999999999999999.1234567890', vatAmount: 0,
      linesJson: [], adjustmentsJson: [], summaryJson: {}, sourceJson: {}, changeReason: 'Fixture verification',
      createdById: user.id, verifiedById: user.id, verifiedAt: new Date(),
    }
    const selected = await prisma.boqBillRevision.create({ data: {
      ...base, revision: 2, isCurrent: true, netTtc: '9999999999999999.1234567890', contentSha256: 'b'.repeat(64),
    } })
    await prisma.boqBillRevision.create({ data: { ...base, revision: 1, netTtc: '555', contentSha256: 'a'.repeat(64) } })
    const linked = await getFinanceLedgerCase(ledger.id)
    assert.equal(linked.currentSignedBill?.id, selected.id)
    assert.equal(linked.currentSignedBill?.netTtc, '9999999999999999.123456789')
    assert.equal(linked.currentSignedBill?.ledgerDifference, '0.003456789')
    assert.equal(linked.invoiceAmount, 321)
    assert.equal(linked.chequeAmount, 100)
    const insights = await getFinanceLedgerInsights({ projectIds: [project.id] })
    assert.equal(insights.summary.totalSignedBillNetTtc, '9999999999999999.123456789')
    assert.equal(insights.summary.signedBillCaseCount, 1)
    const unchanged = await prisma.financeLedgerCase.findUniqueOrThrow({ where: { id: ledger.id } })
    assert.equal(unchanged.accountAmount?.toFixed(), '9999999999999999.12')
    assert.equal(unchanged.invoiceAmount?.toFixed(), '321')
    assert.equal(unchanged.chequeAmount?.toFixed(), '100')
  } finally {
    await prisma.boqBillRevision.deleteMany({ where: { projectId: project.id } })
    await prisma.financeLedgerCase.deleteMany({ where: { projectId: project.id } })
    await prisma.fileAsset.delete({ where: { id: file.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.project.delete({ where: { id: project.id } })
    await prisma.$disconnect()
  }
})
