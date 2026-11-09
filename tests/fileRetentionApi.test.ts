import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test, { beforeEach } from 'node:test'

import { NextRequest } from 'next/server'

const require = createRequire(import.meta.url)
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
const fixtureFile = (id = 41, storageKey = 'files/measurement/archive.pdf') => ({
  id, storageKey, category: 'measurement', bucket: 'fixture-bucket',
  originalName: 'archive.pdf', mimeType: 'application/pdf', size: 123,
  previewStorageKey: 'files/measurement/preview.webp' as string | null,
  previewMimeType: 'image/webp' as string | null, previewSize: 45 as number | null,
  checksum: 'fixture-sha', ownerUserId: null as number | null, createdById: 7,
  createdBy: { id: 7, name: 'Fixture', username: 'fixture' }, ownerUser: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
})
type File = ReturnType<typeof fixtureFile>
type Link = {
  id: number; fileId: number; entityType: string; entityId: string
  purpose: string | null; label: string | null; meta?: unknown
  createdAt: Date; createdById: number
}
type Revision = {
  id: number; signedPdfFileId?: number; calculationFileId?: number
  sourceJson?: { files: { fileId: number; role?: string; sha256?: string }[] }
}
type ProcessResult = Awaited<ReturnType<typeof import('../lib/server/imageProcessing').processImageAsset>>
const initialState = () => ({
  user: { id: 7 } as { id: number } | null,
  permissions: new Set(['file:upload', 'file:delete', 'file:view', 'file:update']),
  files: [] as File[], links: [] as Link[], signatures: [] as number[], revisions: [] as Revision[],
  objects: new Set<string>(), deletions: [] as string[], processed: [] as string[],
  events: [] as string[], locks: new Map<string, Promise<void>>(),
  process: null as (() => Promise<ProcessResult>) | null,
  createFailure: false, deleteFailure: false, commitFailure: false, r2Failure: false,
  beforeCommit: null as (() => Promise<void>) | null,
})
let state = initialState()
const addFile = (file = fixtureFile()) => {
  state.files.push(file)
  state.objects.add(file.storageKey)
  if (file.previewStorageKey) state.objects.add(file.previewStorageKey)
  return file
}
const archive = (fileId: number) => {
  state.revisions.push({ id: 91, sourceJson: { files: [{ fileId, role: 'EVIDENCE', sha256: 'fixture-sha' }] } })
  state.links.push({
    id: 101, fileId, entityType: 'signed-bill-revision', entityId: '91', purpose: 'evidence',
    label: 'Immutable evidence', meta: { sha256: 'fixture-sha' }, createdAt: new Date(), createdById: 7,
  })
}
const acquire = async (key: string) => {
  const previous = state.locks.get(key) ?? Promise.resolve()
  const released = deferred()
  state.locks.set(key, released.promise)
  await previous
  return released.resolve
}
const fileAsset = (inside = false, undo: (() => void)[] = []) => ({
  findFirst: async ({ where }: { where: { OR: { storageKey?: string; previewStorageKey?: string }[] } }) => {
    state.events.push(`${inside ? 'tx' : 'root'}:existing`)
    return state.files.find((file) => where.OR.some((clause) =>
      Object.entries(clause).every(([key, value]) => file[key as keyof File] === value))) ?? null
  },
  findUnique: async ({ where }: { where: { id: number } }) => {
    state.events.push(`${inside ? 'tx' : 'root'}:read`)
    const file = state.files.find((item) => item.id === where.id)
    return file ? { ...file, _count: {
      links: state.links.filter((link) => link.fileId === file.id).length,
      signatures: state.signatures.filter((id) => id === file.id).length,
    } } : null
  },
  create: async ({ data }: { data: Partial<File> }) => {
    state.events.push('tx:create')
    if (state.createFailure) throw new Error('database create failed')
    assert.ok(!state.files.some((file) => file.storageKey === data.storageKey), 'unique storage key')
    const file = { ...fixtureFile(42), ...data }
    state.files.push(file)
    undo.push(() => { state.files = state.files.filter((item) => item !== file) })
    return file
  },
  delete: async ({ where }: { where: { id: number } }) => {
    state.events.push(`${inside ? 'tx' : 'root'}:delete`)
    if (state.deleteFailure) throw new Error('database delete failed')
    const index = state.files.findIndex((file) => file.id === where.id)
    assert.notEqual(index, -1)
    const [file] = state.files.splice(index, 1)
    undo.push(() => { state.files.push(file) })
    return file
  },
  update: async ({ where, data }: { where: { id: number }; data: Partial<File> }) => {
    const file = state.files.find((item) => item.id === where.id)!
    Object.assign(file, data)
    return file
  },
})
const fileAssetLink = {
  createMany: async ({ data }: { data: Omit<Link, 'id' | 'createdAt'>[] }) => {
    state.links.push(...data.map((link, index) => ({ ...link, id: 200 + index, createdAt: new Date() })))
  },
  findMany: async ({ where }: { where: { fileId: number; entityType?: string } }) =>
    state.links.filter((link) => link.fileId === where.fileId && (!where.entityType || link.entityType === where.entityType)),
  deleteMany: async ({ where }: { where: { fileId: number; entityType: { not: string } } }) => {
    state.links = state.links.filter((link) => link.fileId !== where.fileId || link.entityType === where.entityType.not)
  },
}
type ArchiveWhere = { OR: ({ signedPdfFileId: number } | { calculationFileId: number } | {
  sourceJson: { path: string[]; array_contains: { fileId: number }[] }
})[] }
const boqBillRevision = (inside = false) => ({
  findFirst: async ({ where }: { where: ArchiveWhere }) => {
    state.events.push(`${inside ? 'tx' : 'root'}:references`)
    return state.revisions.find((revision) => where.OR.some((clause) => {
      if ('signedPdfFileId' in clause) return revision.signedPdfFileId === clause.signedPdfFileId
      if ('calculationFileId' in clause) return revision.calculationFileId === clause.calculationFileId
      assert.deepEqual(clause.sourceJson.path, ['files'])
      return revision.sourceJson?.files.some((file) => file.fileId === clause.sourceJson.array_contains[0].fileId)
    })) ?? null
  },
})
const prisma = {
  fileAsset: fileAsset(), fileAssetLink, boqBillRevision: boqBillRevision(),
  $transaction: async <T>(callback: (tx: unknown) => Promise<T>, options?: { isolationLevel?: string; timeout?: number }) => {
    state.events.push('tx:begin')
    if (options) assert.equal(options.isolationLevel, 'ReadCommitted')
    const releases: (() => void)[] = []
    const undo: (() => void)[] = []
    try {
      const result = await callback({
        fileAsset: fileAsset(true, undo), fileAssetLink, boqBillRevision: boqBillRevision(true),
        $executeRaw: async (sql: TemplateStringsArray, key: string) => {
          assert.equal(options?.isolationLevel, 'ReadCommitted')
          assert.match(sql.join('?'), /pg_advisory_xact_lock.*dailywork:file-registration/)
          state.events.push('registration:waiting')
          releases.push(await acquire(`registration:${key}`))
          state.events.push('registration:locked')
          return 1
        },
        $queryRaw: async (sql: TemplateStringsArray, id: number) => {
          assert.equal(options?.isolationLevel, 'ReadCommitted')
          assert.match(sql.join('?'), /SELECT "id" FROM "FileAsset" WHERE "id" = \? FOR UPDATE/)
          state.events.push('row:waiting')
          releases.push(await acquire(`row:${id}`))
          state.events.push('row:locked')
          return state.files.some((file) => file.id === id) ? [{ id }] : []
        },
      })
      if (state.beforeCommit) await state.beforeCommit()
      if (state.commitFailure) throw new Error('database commit failed')
      state.events.push('tx:commit')
      return result
    } catch (error) {
      for (const rollback of undo.reverse()) rollback()
      state.events.push('tx:rollback')
      throw error
    } finally {
      for (const release of releases.reverse()) release()
    }
  },
}

// Replace every I/O boundary before loading the real API handlers.
const mockModule = (specifier: string, exports: unknown) => {
  const id = require.resolve(specifier)
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
mockModule('server-only', {})
mockModule('../lib/prisma', { prisma })
mockModule('../lib/server/authSession', {
  getSessionUser: async () => state.user,
  hasPermission: async (permission: string) => state.permissions.has(permission),
})
mockModule('../lib/server/r2', {
  getR2Config: () => ({ bucket: 'fixture-bucket' }),
  createPresignedUrl: () => { throw new Error('unexpected signing') },
  deleteObject: async (key: string) => {
    state.events.push('r2:delete')
    state.deletions.push(key)
    if (state.r2Failure) throw new Error('R2 unavailable')
    state.objects.delete(key)
  },
})
mockModule('../lib/server/imageProcessing', {
  processImageAsset: async ({ storageKey }: { storageKey: string }) => {
    state.events.push('image:process')
    state.processed.push(storageKey)
    return state.process ? state.process() : null
  },
})
const { POST } = require('../app/api/files/route') as typeof import('../app/api/files/route')
const { DELETE, GET, PATCH } = require('../app/api/files/[id]/route') as typeof import('../app/api/files/[id]/route')
const context = (id = 41) => ({ params: Promise.resolve({ id: String(id) }) })
const post = (body: Record<string, unknown> = {}) => POST(new NextRequest('http://fixture.test/api/files', {
  method: 'POST', body: JSON.stringify({
    storageKey: 'files/measurement/new.jpg', originalName: 'new.jpg', mimeType: 'image/jpeg',
    size: 100, category: 'measurement', ...body,
  }),
}))
const remove = (id = 41) => DELETE(new NextRequest(`http://fixture.test/api/files/${id}`, { method: 'DELETE' }), context(id))
const waitFor = async (event: string, count = 1) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (state.events.filter((item) => item === event).length >= count) return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  assert.fail(`Missing event ${event}: ${state.events.join(', ')}`)
}
beforeEach(() => { state = initialState() })

test('POST rejects archived originals and preview keys before processing; neither object is deleted', async () => {
  state.permissions = new Set(['file:upload'])
  const file = addFile()
  archive(file.id)
  state.process = async () => { throw new Error('PDF supplied as JPEG') }
  for (const storageKey of [file.storageKey, file.previewStorageKey]) {
    const response = await post({ storageKey })
    assert.equal(response.status, 409)
  }
  assert.deepEqual(state.processed, [])
  assert.deepEqual(state.deletions, [])
  assert.equal(state.objects.size, 2)
})

test('POST processing failures retain unverified objects and preserve the existing error response', async () => {
  state.objects.add('files/measurement/new.jpg')
  state.process = async () => { throw new Error('Image compression failed') }
  const response = await post()
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Image compression failed' })
  assert.deepEqual(state.deletions, [])
  assert.ok(state.objects.has('files/measurement/new.jpg'))
  assert.equal(state.files.length, 0)
})

test('POST serializes duplicate registration through processing and commit; loser never processes the winner', async () => {
  const processed = deferred()
  state.process = async () => { await processed.promise; return null }
  const first = post()
  await waitFor('image:process')
  const second = post()
  await waitFor('registration:waiting', 2)
  assert.equal(state.processed.length, 1)
  processed.resolve()
  const responses = await Promise.all([first, second])
  assert.deepEqual(responses.map((response) => response.status), [201, 409])
  assert.equal(state.processed.length, 1)
  assert.equal(state.files.length, 1)
  assert.deepEqual(state.deletions, [])
  assert.ok(state.events.indexOf('tx:commit') < state.events.lastIndexOf('tx:existing'))
})

test('POST failed processing releases the key for a waiting successful registration without cleanup', async () => {
  const processed = deferred()
  let calls = 0
  state.process = async () => {
    if (++calls === 1) { await processed.promise; throw new Error('bad image') }
    return null
  }
  const first = post()
  await waitFor('image:process')
  const second = post()
  await waitFor('registration:waiting', 2)
  processed.resolve()
  assert.deepEqual((await Promise.all([first, second])).map((response) => response.status), [400, 201])
  assert.equal(state.files.length, 1)
  assert.deepEqual(state.deletions, [])
})

test('POST preserves processed metadata, previews, creator/owner, checksum and ordinary links', async () => {
  state.process = async () => ({
    original: { originalName: 'compressed.webp', mimeType: 'image/webp', size: 80 },
    preview: { storageKey: 'files/measurement/new-preview.webp', mimeType: 'image/webp', size: 20 },
  })
  const response = await post({ checksum: 'new-sha', ownerUserId: 8, links: [
    { entityType: 'boq-bill-period', entityId: '1:2', purpose: 'bill-pdf', label: 'Original', meta: { source: 'fixture' } },
  ] })
  assert.equal(response.status, 201)
  const { file, links } = await response.json()
  assert.equal(file.originalName, 'compressed.webp')
  assert.equal(file.mimeType, 'image/webp')
  assert.equal(file.size, 80)
  assert.equal(file.previewStorageKey, 'files/measurement/new-preview.webp')
  assert.equal(file.previewMimeType, 'image/webp')
  assert.equal(file.previewSize, 20)
  assert.equal(file.createdAt, '2026-01-01T00:00:00.000Z')
  assert.equal(state.files[0].checksum, 'new-sha')
  assert.equal(state.files[0].createdById, 7)
  assert.equal(state.files[0].ownerUserId, 8)
  assert.equal(links.length, 1)
  assert.deepEqual(state.links[0].meta, { source: 'fixture' })
})

test('POST database failure never compensates by deleting an unowned original or preview', async () => {
  state.createFailure = true
  state.process = async () => ({
    original: { originalName: 'new.jpg', mimeType: 'image/jpeg', size: 80 },
    preview: { storageKey: 'files/measurement/new-preview.webp', mimeType: 'image/webp', size: 20 },
  })
  await assert.rejects(post(), /database create failed/)
  assert.deepEqual(state.deletions, [])
})

test('DELETE locks, reads and rechecks immutable references, deletes in the transaction, then cleans R2', async () => {
  const file = addFile()
  const response = await remove()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.deepEqual(state.events, [
    'tx:begin', 'row:waiting', 'row:locked', 'tx:read', 'tx:references', 'tx:delete', 'tx:commit', 'r2:delete', 'r2:delete',
  ])
  assert.deepEqual(state.deletions, [file.storageKey, file.previewStorageKey])
  assert.equal(state.files.length, 0)
})

test('DELETE denies all immutable source roles even when the reserved link is missing', async () => {
  addFile()
  for (const reference of [
    { id: 91, signedPdfFileId: 41 }, { id: 91, calculationFileId: 41 },
    { id: 91, sourceJson: { files: [{ fileId: 41, sha256: 'fixture-sha', role: 'EVIDENCE' }] } },
  ]) {
    state.revisions = [reference]
    const response = await remove()
    assert.equal(response.status, 409)
    assert.match((await response.json()).message, /不可变/)
  }
  assert.deepEqual(state.deletions, [])
  assert.equal(state.files.length, 1)
})

test('DELETE waits for an in-flight archive, then reads the newly committed evidence and rejects deletion', async () => {
  addFile()
  const releaseArchive = await acquire('row:41')
  const response = remove()
  await waitFor('row:waiting')
  assert.ok(!state.events.includes('tx:read'))
  archive(41)
  releaseArchive()
  assert.equal((await response).status, 409)
  assert.equal(state.revisions.length, 1)
  assert.equal(state.links.length, 1)
  assert.equal(state.files.length, 1)
  assert.deepEqual(state.deletions, [])
})

test('DELETE preserves ordinary linked files and active or historical signatures', async () => {
  addFile()
  archive(41)
  state.revisions = []
  assert.equal((await remove()).status, 409)
  state.links = []
  state.signatures = [41]
  assert.equal((await remove()).status, 409)
  assert.deepEqual(state.deletions, [])
})

test('DELETE never cleans R2 on database delete or commit failure', async () => {
  addFile()
  state.deleteFailure = true
  await assert.rejects(remove(), /database delete failed/)
  state.deleteFailure = false
  state.commitFailure = true
  await assert.rejects(remove(), /database commit failed/)
  assert.equal(state.files.length, 1)
  assert.equal(state.objects.size, 2)
  assert.deepEqual(state.deletions, [])
})

test('DELETE waits for commit before cleanup and still succeeds if R2 cleanup fails', async (t) => {
  addFile()
  const commit = deferred()
  state.beforeCommit = () => commit.promise
  const response = remove()
  await waitFor('tx:delete')
  assert.deepEqual(state.deletions, [])
  const log = t.mock.method(console, 'error', () => {})
  state.r2Failure = true
  commit.resolve()
  assert.equal((await response).status, 200)
  assert.equal(state.files.length, 0)
  assert.equal(log.mock.calls.length, 1)
  assert.equal(log.mock.calls[0].arguments[0], '[FileAsset Delete] R2 cleanup failed')
})

test('file permissions, private AI artifacts and signed-bill reserved links retain their guards', async () => {
  state.user = null
  assert.equal((await post()).status, 401)
  state.user = { id: 7 }
  state.permissions.clear()
  assert.equal((await post()).status, 403)
  assert.equal((await remove()).status, 403)
  assert.deepEqual(state.events, [])
  state.permissions = new Set(['file:manage'])
  assert.equal((await post({ storageKey: 'files/attachment/ai-chat/private.pdf' })).status, 403)
  assert.equal((await post({ links: [{ entityType: 'signed-bill-revision', entityId: '91' }] })).status, 409)
  assert.deepEqual(state.events, [])
  addFile(fixtureFile(41, 'files/attachment/ai-chat/private.pdf'))
  const request = new NextRequest('http://fixture.test/api/files/41')
  assert.equal((await GET(request, context())).status, 404)
  assert.equal((await remove()).status, 404)
  assert.equal((await PATCH(new NextRequest(request.url, {
    method: 'PATCH', body: JSON.stringify({ originalName: 'private.pdf', links: [] }),
  }), context())).status, 404)
  assert.deepEqual(state.deletions, [])
})

test('PATCH continues retaining reserved signed-bill link rows and rejecting changed metadata', async () => {
  addFile()
  archive(41)
  const original = structuredClone(state.links[0])
  const patch = (links: unknown[]) => PATCH(new NextRequest('http://fixture.test/api/files/41', {
    method: 'PATCH', body: JSON.stringify({ originalName: 'renamed.pdf', links }),
  }), context())
  assert.equal((await patch([])).status, 200)
  assert.deepEqual(state.links, [original])
  assert.equal((await patch([{ ...original, meta: { sha256: 'tampered' } }])).status, 409)
  assert.deepEqual(state.links, [original])
})

test('DELETE missing files returns 404 without object cleanup', async () => {
  assert.equal((await remove()).status, 404)
  assert.deepEqual(state.deletions, [])
})
