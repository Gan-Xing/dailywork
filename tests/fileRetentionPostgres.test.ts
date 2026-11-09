import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test, { after, before, beforeEach } from 'node:test'

import { Prisma, PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

// Opt in explicitly; never inherit DATABASE_URL or touch the application's schema.
const databaseUrl = process.env.FILE_RETENTION_TEST_DATABASE_URL
if (databaseUrl) {
  const url = new URL(databaseUrl)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'localhost fixtures only')
  assert.equal(url.pathname, '/dailywork_ai_test', 'isolated review database only')
}
const schema = `file_retention_${randomUUID().replaceAll('-', '')}`
const namespace = Prisma.raw(`"${schema}"`)
let admin: PrismaClient
let database: PrismaClient
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const initialState = () => ({
  apiPids: [] as number[], deletions: [] as string[], processed: 0,
  locked: deferred(), releaseDelete: null as ReturnType<typeof deferred> | null,
  releaseProcessing: null as ReturnType<typeof deferred> | null,
})
let state = initialState()
const require = createRequire(import.meta.url)
const mockModule = (specifier: string, exports: unknown) => {
  const id = require.resolve(specifier)
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
mockModule('server-only', {})
mockModule('../lib/prisma', { prisma: {
  $transaction: (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: {
    isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number
  }) => database.$transaction(async (tx) => {
    const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
    state.apiPids.push(pid)
    return callback(new Proxy(tx, {
      get(target, property, receiver) {
        if (property !== '$queryRaw') return Reflect.get(target, property, receiver)
        return async (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => {
          const result = await target.$queryRaw(query, ...values)
          state.locked.resolve()
          if (state.releaseDelete) await state.releaseDelete.promise
          return result
        }
      },
    }))
  }, { ...options, timeout: 15_000 }),
} })
mockModule('../lib/server/authSession', {
  getSessionUser: async () => ({ id: 7 }), hasPermission: async () => true,
})
mockModule('../lib/server/r2', {
  getR2Config: () => ({ bucket: 'fixture-only' }),
  deleteObject: async (key: string) => { state.deletions.push(key) },
})
mockModule('../lib/server/imageProcessing', {
  processImageAsset: async () => {
    state.processed++
    if (state.releaseProcessing) await state.releaseProcessing.promise
    return null
  },
})
const { POST } = require('../app/api/files/route') as typeof import('../app/api/files/route')
const { DELETE } = require('../app/api/files/[id]/route') as typeof import('../app/api/files/[id]/route')
const remove = (id: number) => DELETE(new NextRequest(`http://fixture.test/api/files/${id}`, { method: 'DELETE' }), {
  params: Promise.resolve({ id: String(id) }),
})
const post = () => POST(new NextRequest('http://fixture.test/api/files', {
  method: 'POST', body: JSON.stringify({
    storageKey: 'files/measurement/duplicate.jpg', originalName: 'duplicate.jpg',
    mimeType: 'image/jpeg', category: 'measurement', size: 123,
  }),
}))
const waitFor = async (condition: () => boolean | Promise<boolean>) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('Expected PostgreSQL interleaving was not reached')
}
const isBlocked = async (pid: number | undefined) => {
  if (!pid) return false
  const [row] = await admin.$queryRaw<{ blocked: boolean }[]>`
    SELECT cardinality(pg_blocking_pids(${pid}::integer)) > 0 AS blocked
  `
  return row.blocked
}
const createFile = () => database.fileAsset.create({ data: {
  category: 'measurement', storageKey: `files/measurement/${randomUUID()}.pdf`,
  bucket: 'fixture-only', originalName: 'evidence.pdf', mimeType: 'application/pdf', size: 123,
  previewStorageKey: `files/measurement/${randomUUID()}.webp`,
} })
const createArchive = async (tx: Prisma.TransactionClient, fileId: number) => {
  // Match signedBillStore's atomic JSON + link writes for an extra source file,
  // not a primary PDF/calculation FK (which already has RESTRICT protection).
  const source = JSON.stringify({ files: [{ fileId, role: 'EVIDENCE', sha256: 'fixture-sha' }] })
  const [{ id }] = await tx.$queryRaw<{ id: number }[]>`
    INSERT INTO "BoqBillRevision" ("sourceJson") VALUES (${source}::jsonb) RETURNING "id"
  `
  await tx.fileAssetLink.createMany({ data: [{
    fileId, entityType: 'signed-bill-revision', entityId: String(id), purpose: 'evidence',
  }] })
}

before(async () => {
  if (!databaseUrl) return
  admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  await admin.$executeRaw(Prisma.sql`CREATE SCHEMA ${namespace}`)
  const url = new URL(databaseUrl)
  url.searchParams.set('schema', schema)
  database = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  await database.$executeRaw`
    CREATE TABLE "User" ("id" INTEGER PRIMARY KEY, "name" TEXT, "username" TEXT)
  `
  await database.$executeRaw`
    CREATE TABLE "FileAsset" (
      "id" SERIAL PRIMARY KEY, "category" TEXT NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
      "bucket" TEXT NOT NULL, "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL,
      "previewStorageKey" TEXT, "previewMimeType" TEXT, "previewSize" INTEGER, "checksum" TEXT,
      "ownerUserId" INTEGER, "createdById" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await database.$executeRaw`
    CREATE TABLE "FileAssetLink" (
      "id" SERIAL PRIMARY KEY, "fileId" INTEGER NOT NULL REFERENCES "FileAsset"("id") ON DELETE CASCADE,
      "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "purpose" TEXT, "label" TEXT,
      "meta" JSONB, "createdById" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await database.$executeRaw`
    CREATE TABLE "UserSignature" (
      "id" SERIAL PRIMARY KEY, "fileId" INTEGER NOT NULL REFERENCES "FileAsset"("id") ON DELETE CASCADE
    )
  `
  await database.$executeRaw`
    CREATE TABLE "BoqBillRevision" (
      "id" SERIAL PRIMARY KEY,
      "signedPdfFileId" INTEGER REFERENCES "FileAsset"("id") ON DELETE RESTRICT,
      "calculationFileId" INTEGER REFERENCES "FileAsset"("id") ON DELETE RESTRICT,
      "sourceJson" JSONB NOT NULL
    )
  `
  await database.$executeRaw`INSERT INTO "User" ("id", "name", "username") VALUES (7, 'Fixture', 'fixture')`
})
beforeEach(() => { state = initialState() })
after(async () => {
  if (!databaseUrl) return
  try {
    if (database) await database.$disconnect()
    await admin.$executeRaw(Prisma.sql`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
  } finally {
    await admin.$disconnect()
  }
})

test('Postgres: archive wins; DELETE waits for FK lock and sees newly committed JSON evidence', {
  skip: !databaseUrl,
}, async () => {
  const file = await createFile()
  const archived = deferred()
  const release = deferred()
  const writing = database.$transaction(async (tx) => {
    await createArchive(tx, file.id)
    archived.resolve()
    await release.promise
  }, { timeout: 15_000 })
  try {
    await archived.promise
    const deleting = remove(file.id)
    await waitFor(() => isBlocked(state.apiPids[0]))
    assert.deepEqual(state.deletions, [])
    release.resolve()
    await writing
    assert.equal((await deleting).status, 409)
    assert.ok(await database.fileAsset.findUnique({ where: { id: file.id } }))
    assert.equal(await database.fileAssetLink.count({ where: { fileId: file.id } }), 1)
    assert.deepEqual(state.deletions, [])
  } finally {
    release.resolve()
    await writing
  }
})

test('Postgres: DELETE wins; a later archive FK insert fails and its JSON evidence rolls back', {
  skip: !databaseUrl,
}, async () => {
  const file = await createFile()
  state.releaseDelete = deferred()
  const deleting = remove(file.id)
  await state.locked.promise
  let archivePid: number | undefined
  const writing = database.$transaction(async (tx) => {
    const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
    archivePid = pid
    await createArchive(tx, file.id)
  }, { timeout: 15_000 })
  const rejected = assert.rejects(writing, (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
  try {
    await waitFor(() => isBlocked(archivePid))
    assert.deepEqual(state.deletions, [])
    state.releaseDelete.resolve()
    assert.equal((await deleting).status, 200)
    await rejected
    assert.equal(await database.fileAsset.findUnique({ where: { id: file.id } }), null)
    const [row] = await database.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM "BoqBillRevision"
      WHERE "sourceJson" @> ${JSON.stringify({ files: [{ fileId: file.id }] })}::jsonb
    `
    assert.equal(row.count, 0)
    assert.deepEqual(state.deletions, [file.storageKey, file.previewStorageKey])
  } finally {
    state.releaseDelete.resolve()
    await deleting
    await rejected
  }
})

test('Postgres: concurrent DELETEs re-read after the row lock; cleanup runs only once', {
  skip: !databaseUrl,
}, async () => {
  const file = await createFile()
  state.releaseDelete = deferred()
  const first = remove(file.id)
  await state.locked.promise
  const second = remove(file.id)
  try {
    await waitFor(() => isBlocked(state.apiPids[1]))
    state.releaseDelete.resolve()
    assert.deepEqual((await Promise.all([first, second])).map((response) => response.status), [200, 404])
    assert.deepEqual(state.deletions, [file.storageKey, file.previewStorageKey])
  } finally {
    state.releaseDelete.resolve()
    await Promise.all([first, second])
  }
})

test('Postgres: advisory registration lock prevents a duplicate from processing the committed winner', {
  skip: !databaseUrl,
}, async () => {
  state.releaseProcessing = deferred()
  const first = post()
  await waitFor(() => state.processed === 1)
  const second = post()
  try {
    await waitFor(() => isBlocked(state.apiPids[1]))
    assert.equal(state.processed, 1)
    state.releaseProcessing.resolve()
    assert.deepEqual((await Promise.all([first, second])).map((response) => response.status), [201, 409])
    assert.equal(state.processed, 1)
    assert.equal(await database.fileAsset.count({ where: { storageKey: 'files/measurement/duplicate.jpg' } }), 1)
    assert.deepEqual(state.deletions, [])
  } finally {
    state.releaseProcessing.resolve()
    await Promise.all([first, second])
  }
})
