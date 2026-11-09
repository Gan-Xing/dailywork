import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { Prisma, type BoqBillRevision } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { createSignedBillRevision } from '../lib/server/signedBillStore'
import { canonicalBillJson, type CreateSignedBillInput, type SignedBillSource } from '../lib/value/signedBills'

const baseInput: CreateSignedBillInput = {
  projectId: 1, periodIndex: 2, status: 'SIGNED', isSignedConfirmed: true,
  signedPdfFileId: 10, calculationFileId: 11,
  grossHt: '100.01', netHt: '80.01', vatAmount: '14.40', netTtc: '94.41',
  lines: [{
    key: 'source-row-4', boqItemId: null, sourceCode: null, designation: 'Actual source item', unit: 'm',
    unitPrice: '100.01', previousQuantity: null, quantity: '1', cumulativeQuantity: null,
    previousAmount: null, amount: '100.01', cumulativeAmount: null,
  }],
  adjustments: [{ key: 'advance', kind: 'ADVANCE_RECOVERY', label: 'Verified recovery', effectHt: '-20' }],
  source: { files: [{ fileId: 10, sha256: 'a'.repeat(64), locators: { page: 2 } }] },
  changeReason: 'Checked PDF', activate: true, expectedCurrentRevisionId: null,
}

// A small transaction boundary double verifies orchestration; PostgreSQL constraints
// and rollback behavior are separately exercised against the unmodified migration.
const installTransaction = (options: { foreignFile?: boolean; privateFile?: boolean; twoPdfs?: boolean } = {}) => {
  let rows: BoqBillRevision[] = []
  let events: unknown[] = []
  let links: unknown[] = []
  let lockCount = 0
  const fileOverrides = new Map<number, { originalName?: string; checksum?: string; size?: number }>()
  const tx = {
    $executeRaw: async () => { lockCount += 1; return 1 },
    project: { findUnique: async () => ({ id: 1, name: 'Project fixture', code: 'project-fixture' }) },
    boqItem: { count: async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.filter((id) => id === 2).length },
    fileAsset: { findMany: async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.map((id) => ({
      id, category: options.privateFile ? 'personnel' : 'measurement', storageKey: `fixture/${id}`, bucket: 'test',
      originalName: id === 11 ? 'calculation.xlsx' : 'signed.pdf', mimeType: id === 11 ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      size: 123, previewStorageKey: null, previewMimeType: null, previewSize: null,
      checksum: 'a'.repeat(64), ownerUserId: null, createdById: 1, createdAt: new Date(0), updatedAt: new Date(0),
      ...fileOverrides.get(id),
      links: [{ entityId: options.foreignFile ? '1:3' : '1:2' }],
    })) },
    fileAssetLink: {
      findMany: async () => options.twoPdfs ? [{ fileId: 10, purpose: 'bill-pdf' }, { fileId: 12, purpose: 'bill-pdf' }] : [],
      createMany: async ({ data }: { data: unknown[] }) => { links.push(...data); return { count: data.length } },
    },
    boqBillRevision: {
      findUnique: async ({ where }: { where: { projectId_periodIndex_contentSha256?: { contentSha256: string } } }) => rows.find((row) => row.contentSha256 === where.projectId_periodIndex_contentSha256?.contentSha256) ?? null,
      findMany: async ({ where }: { where: { projectId: number; periodIndex: number } }) => rows.filter((row) => row.projectId === where.projectId && row.periodIndex === where.periodIndex).sort((a, b) => a.revision - b.revision),
      findFirst: async () => rows.find((row) => row.isCurrent) ?? null,
      aggregate: async () => ({ _max: { revision: rows.length ? Math.max(...rows.map((row) => row.revision)) : null } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: rows.length + 1, isCurrent: false, activatedAt: null, activatedById: null, createdAt: new Date(0), ...data } as BoqBillRevision
        rows.push(row)
        return row
      },
      update: async ({ where, data }: { where: { id: number }; data: Partial<BoqBillRevision> }) => {
        const index = rows.findIndex((row) => row.id === where.id)
        rows[index] = { ...rows[index], ...data }
        return rows[index]
      },
    },
    boqBillRevisionEvent: { create: async ({ data }: { data: unknown }) => { events.push(data); return data } },
    boqMeasurement: { findMany: async () => [{
      id: 20, projectId: 1, quantity: new Prisma.Decimal('1.00'), unitPrice: new Prisma.Decimal('100.01'), amount: new Prisma.Decimal('100.01'),
      updatedAt: new Date('2026-10-22T00:00:00Z'), note: null,
      boqItem: { id: 2, projectId: 1, sheetType: 'ACTUAL', code: 'A1', tone: 'ITEM', designationFr: 'Working item', designationZh: '', unit: 'm', unitPrice: new Prisma.Decimal('100.01') },
    }] },
  }
  // Prisma exposes methods through a proxy, rather than own property descriptors.
  const client = prisma as unknown as { $transaction: (callback: unknown) => Promise<unknown> }
  const originalTransaction = client.$transaction
  client.$transaction = async (callback: unknown) => {
    const before = { rows: [...rows], events: [...events], links: [...links] }
    try {
      return await (callback as (client: typeof tx) => Promise<unknown>)(tx)
    } catch (error) {
      rows = before.rows
      events = before.events
      links = before.links
      throw error
    }
  }
  return { fileOverrides, snapshot: () => ({ rows, events, links, lockCount }), restore: () => { client.$transaction = originalTransaction } }
}

const storedDocument = (row: BoqBillRevision, source = row.sourceJson as unknown as SignedBillSource) => ({
  projectId: row.projectId, periodIndex: row.periodIndex, status: row.status, currency: row.currency,
  signedAt: row.signedAt?.toISOString().slice(0, 10) ?? null,
  signedPdfFileId: row.signedPdfFileId, calculationFileId: row.calculationFileId,
  // The source retains decimal spelling that database Decimal columns normalize.
  ...(source.headlineDecimalText as Record<string, string | null>),
  lines: row.linesJson, adjustments: row.adjustmentsJson, summary: row.summaryJson, source,
})
const digest = (document: unknown) => createHash('sha256').update(canonicalBillJson(document)).digest('hex')

const setLegacyHash = (fixture: ReturnType<typeof installTransaction>) => {
  const { rows: [row], events, links } = fixture.snapshot()
  const source = JSON.parse(JSON.stringify(row.sourceJson)) as SignedBillSource
  delete source.contentHashVersion
  row.sourceJson = source as Prisma.JsonObject
  row.contentSha256 = digest(storedDocument(row))
  for (const event of events as Array<{ payload: { contentSha256?: string } }>) {
    if (event.payload.contentSha256 !== undefined) event.payload.contentSha256 = row.contentSha256
  }
  for (const link of links as Array<{ meta: { contentSha256: string } }>) link.meta.contentSha256 = row.contentSha256
  return row
}

test('renaming live files reuses the revision without changing its archived metadata or hash', async () => {
  const tx = installTransaction()
  try {
    const first = await createSignedBillRevision(baseInput, 1)
    const before = JSON.stringify(tx.snapshot())
    tx.fileOverrides.set(10, { originalName: 'renamed-signed.pdf' })
    tx.fileOverrides.set(11, { originalName: 'renamed-calculation.xlsx' })
    const retry = await createSignedBillRevision(baseInput, 1)
    assert.equal(retry.reused, true)
    assert.equal(retry.revision.id, first.revision.id)
    assert.equal(retry.revision.contentSha256, first.revision.contentSha256)
    assert.deepEqual(retry.revision.source, first.revision.source)
    assert.equal(retry.revision.files.find((file) => file.id === 10)?.originalName, 'renamed-signed.pdf')
    assert.equal(JSON.stringify({ ...tx.snapshot(), lockCount: 1 }), before)

    const source = JSON.parse(JSON.stringify(first.revision.source)) as SignedBillSource
    assert.equal(source.contentHashVersion, 2)
    for (const key of ['files', 'assetMetadata']) {
      for (const file of source[key] as Array<Record<string, unknown>>) delete file.originalName
    }
    assert.equal(first.revision.contentSha256, digest(storedDocument(tx.snapshot().rows[0], source)))
  } finally { tx.restore() }
})

test('only incidental file names are ignored; checksums, file identities, locators and snapshot content remain significant', async () => {
  const variants = [
    { label: 'checksum', payload: { ...baseInput, source: {} }, changedChecksum: true },
    { label: 'file identity', payload: { ...baseInput, signedPdfFileId: 12, source: {} } },
    { label: 'other file metadata', payload: baseInput, changedSize: true },
    { label: 'source locator', payload: { ...baseInput, source: { files: [{ fileId: 10, sha256: 'a'.repeat(64), locators: { page: 3 } }] } } },
    { label: 'headline', payload: { ...baseInput, grossHt: '100.02' } },
    { label: 'line', payload: { ...baseInput, lines: baseInput.lines!.map((line) => ({ ...line, quantity: '2' })) } },
    { label: 'source content', payload: { ...baseInput, source: { ...baseInput.source, notes: ['Different source evidence'] } } },
    { label: 'nested evidence filename', payload: { ...baseInput, source: { ...baseInput.source, files: [{ fileId: 10, locators: { page: 2, originalName: 'Material source evidence' } }] } } },
  ]
  for (const legacy of [false, true]) {
    for (const variant of variants) {
      const tx = installTransaction()
      try {
        const baseline = variant.changedChecksum || variant.label === 'file identity' ? { ...baseInput, source: {} } : baseInput
        const first = await createSignedBillRevision(baseline, 1)
        if (legacy) setLegacyHash(tx)
        const previousHash = tx.snapshot().rows[0].contentSha256
        tx.fileOverrides.set(10, { originalName: 'renamed.pdf', ...(variant.changedChecksum ? { checksum: 'b'.repeat(64) } : {}), ...(variant.changedSize ? { size: 124 } : {}) })
        const next = await createSignedBillRevision({ ...variant.payload, expectedCurrentRevisionId: first.revision.id }, 1)
        assert.equal(next.reused, false, variant.label)
        assert.notEqual(next.revision.contentSha256, previousHash, variant.label)
        assert.equal(tx.snapshot().rows.length, 2, variant.label)
      } finally { tx.restore() }
    }
  }
})

test('legacy full-snapshot hashes survive renamed-file retries without rewriting frozen rows, links or audit events', async () => {
  const tx = installTransaction()
  try {
    const first = await createSignedBillRevision(baseInput, 1)
    const legacy = setLegacyHash(tx)
    const before = JSON.stringify(tx.snapshot())
    tx.fileOverrides.set(10, { originalName: 'renamed.pdf' })
    const retry = await createSignedBillRevision(baseInput, 1)
    assert.equal(retry.reused, true)
    assert.equal(retry.revision.id, first.revision.id)
    assert.equal(retry.revision.contentSha256, legacy.contentSha256)
    assert.equal(JSON.stringify({ ...tx.snapshot(), lockCount: 1 }), before)
    assert.equal(digest(storedDocument(legacy)), legacy.contentSha256)
    const changed = await createSignedBillRevision({ ...baseInput, grossHt: '100.02', expectedCurrentRevisionId: legacy.id }, 1)
    assert.equal(changed.reused, false)
    assert.equal(changed.revision.source.contentHashVersion, 2)
  } finally { tx.restore() }
})

test('source file display names are ignored in both current and legacy hashes, but unverified legacy digests are not reused', async () => {
  for (const legacyHash of [false, true]) {
    const tx = installTransaction()
    try {
      const input = { ...baseInput, source: { files: [{ ...baseInput.source!.files![0], originalName: 'archived-label.pdf' }] } }
      await createSignedBillRevision(input, 1)
      const frozen = tx.snapshot().rows[0]
      if (legacyHash) setLegacyHash(tx)
      const before = JSON.stringify(frozen)
      const retryInput = { ...input, source: { files: [{ ...input.source.files[0], originalName: 'new-label.pdf' }] } }
      const retry = await createSignedBillRevision(retryInput, 1)
      assert.equal(retry.reused, true)
      assert.equal(JSON.stringify(tx.snapshot().rows[0]), before)
      if (legacyHash) {
        frozen.contentSha256 = 'f'.repeat(64)
        const next = await createSignedBillRevision({ ...retryInput, expectedCurrentRevisionId: frozen.id }, 1)
        assert.equal(next.reused, false)
      }
    } finally { tx.restore() }
  }
})

test('same source retry reuses one frozen revision without duplicate links or events', async () => {
  const tx = installTransaction()
  try {
    const first = await createSignedBillRevision(baseInput, 1)
    const retry = await createSignedBillRevision(baseInput, 1)
    assert.equal(first.reused, false)
    assert.equal(retry.reused, true)
    assert.equal(retry.revision.id, first.revision.id)
    assert.equal(retry.revision.isCurrent, true)
    assert.equal(tx.snapshot().rows.length, 1)
    assert.equal(tx.snapshot().events.length, 2)
    assert.equal(tx.snapshot().links.length, 2)
    assert.equal(tx.snapshot().lockCount, 2)
  } finally { tx.restore() }
})

test('stale replacement rolls back creation and preserves the selected original', async () => {
  const tx = installTransaction()
  try {
    const first = await createSignedBillRevision(baseInput, 1)
    await assert.rejects(() => createSignedBillRevision({ ...baseInput, grossHt: '100.02' }, 1), /刷新/)
    assert.equal(tx.snapshot().rows.length, 1)
    assert.equal(tx.snapshot().rows[0].id, first.revision.id)
    assert.equal(tx.snapshot().rows[0].isCurrent, true)
    assert.equal(tx.snapshot().events.length, 2)
    assert.equal(tx.snapshot().links.length, 2)
  } finally { tx.restore() }
})

test('explicit new current version preserves old signed content and selects exactly one revision', async () => {
  const tx = installTransaction()
  try {
    const first = await createSignedBillRevision(baseInput, 1)
    const second = await createSignedBillRevision({ ...baseInput, grossHt: '100.02', expectedCurrentRevisionId: first.revision.id, changeReason: 'Second signed document' }, 1)
    assert.equal(second.revision.revision, 2)
    assert.equal(tx.snapshot().rows[0].grossHt?.toFixed(), '100.01')
    assert.equal(tx.snapshot().rows[0].isCurrent, false)
    assert.equal(tx.snapshot().rows.filter((row) => row.isCurrent).length, 1)
    assert.equal(tx.snapshot().events.length, 4)
  } finally { tx.restore() }
})

test('working snapshot repeated unchanged is idempotent and does not invent previous/cumulative quantities', async () => {
  const tx = installTransaction()
  try {
    const input = { ...baseInput, lines: undefined, fromMeasurement: true }
    const first = await createSignedBillRevision(input, 1)
    const retry = await createSignedBillRevision(input, 1)
    assert.equal(first.revision.lines[0].quantity, '1')
    assert.equal(first.revision.lines[0].previousQuantity, null)
    assert.equal(first.revision.lines[0].cumulativeQuantity, null)
    assert.equal(retry.reused, true)
    assert.equal(tx.snapshot().rows.length, 1)
  } finally { tx.restore() }
})

test('private files and other-period evidence cannot enter a signed snapshot', async () => {
  for (const options of [{ privateFile: true }, { foreignFile: true }]) {
    const tx = installTransaction(options)
    try {
      await assert.rejects(() => createSignedBillRevision(baseInput, 1), /计量资料|其他项目或期次/)
      assert.equal(tx.snapshot().rows.length, 0)
    } finally { tx.restore() }
  }
})

test('ambiguous period PDF reuse requires explicit file selection', async () => {
  const tx = installTransaction({ twoPdfs: true })
  try {
    await assert.rejects(() => createSignedBillRevision({ ...baseInput, signedPdfFileId: null, reusePeriodFiles: true }, 1), /多个bill-pdf/)
  } finally { tx.restore() }
})
