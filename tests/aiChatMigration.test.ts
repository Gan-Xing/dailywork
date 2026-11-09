import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { getChatLocalDbName } from '../lib/ai-chat/localStore'
import type { ChatMessageRecord, ChatSessionRecord, MemoryRecord, MemoryScopeType } from '../lib/ai-chat/localStore'
import {
  createOwnedLocalHistoryMigrator,
  getImportedSessionId,
  migrateOwnedLocalHistory,
  readOwnedLocalHistory,
  type OwnedLocalHistory,
} from '../lib/ai-chat/migrateLocalHistory'
import type * as remoteStore from '../lib/ai-chat/remoteStore'
import { listSessions } from '../lib/ai-chat/remoteStore'

const oldId = '00000000-0000-4000-8000-000000000001'
const timestamp = '2026-11-08T00:00:00.000Z'
const localSession = (id = oldId) => ({ id, summary: 'My original title', summarySource: 'manual', createdAt: timestamp, updatedAt: timestamp })
const localMessage = (id = 1) => ({ id, sessionId: oldId, role: id === 1 ? 'user' : 'assistant', content: `Message ${id}`, createdAt: timestamp })
const localMemory = (scopeType: MemoryScopeType = 'global', scopeKey = 'global') => ({
  id: `${scopeType}:${scopeKey}`, scopeType, scopeKey, title: 'My memory title', content: 'Original memory', enabled: false, updatedAt: timestamp,
})
const history = (): OwnedLocalHistory => ({
  sessions: [localSession()], messages: [localMessage(2), localMessage(1)],
  memories: [localMemory(), localMemory('session', oldId), localMemory('route', '/value'), localMemory('project', 'project-a')],
})

const fakeIndexedDb = (snapshot = history(), options: {
  names?: string[]
  enumeration?: 'absent' | 'unsupported' | 'failed' | 'hanging'
  missing?: boolean
  readFailure?: boolean
  missingStore?: boolean
  blocked?: boolean
  holdOpen?: boolean
  holdRead?: boolean
} = {}) => {
  const opened: string[] = []
  const modes: IDBTransactionMode[] = []
  let closed = 0
  let aborted = 0
  const pendingOpens: Array<() => void> = []
  const names = options.names ?? ['dailywork-ai-chat', getChatLocalDbName(1), getChatLocalDbName(2)]
  const factory = {
    ...(options.enumeration === 'absent' ? {} : { databases: async () => {
      if (options.enumeration === 'unsupported') throw Object.assign(new Error('Unsupported'), { name: 'NotSupportedError' })
      if (options.enumeration === 'failed') throw new Error('Enumeration failed')
      if (options.enumeration === 'hanging') return new Promise<Array<{ name: string }>>(() => undefined)
      return names.map((name) => ({ name }))
    } }),
    open: (name: string) => {
      opened.push(name)
      assert.match(name, /^dailywork-ai-chat-user-[1-9]\d*$/)
      const request = {
        onupgradeneeded: () => undefined, onerror: () => undefined, onsuccess: () => undefined, onblocked: () => undefined,
        transaction: { abort: () => { aborted += 1 } },
        result: {
          objectStoreNames: { contains: (store: string) => !options.missingStore || store !== 'memories' },
          close: () => { closed += 1 },
          transaction: (stores: string[], mode: IDBTransactionMode) => {
            assert.deepEqual(stores, ['sessions', 'messages', 'memories'])
            modes.push(mode)
            let reads = 0
            const tx = {
              oncomplete: () => undefined, onerror: () => undefined, onabort: () => undefined,
              error: new Error('Read failed'),
              abort: () => { aborted += 1; tx.onabort() },
              objectStore: (store: keyof OwnedLocalHistory) => ({ getAll: () => {
                const result = { result: structuredClone(snapshot[store]), onsuccess: () => undefined }
                queueMicrotask(() => {
                  if (options.holdRead) return
                  if (options.readFailure) { tx.onabort(); return }
                  result.onsuccess()
                  reads += 1
                  if (reads === stores.length) tx.oncomplete()
                })
                return result
              } }),
            }
            return tx
          },
        },
        error: new Error('Open aborted'),
      }
      const complete = () => {
        if (options.blocked) { request.onblocked(); return }
        if (options.missing) { request.onupgradeneeded(); request.onerror() }
        else request.onsuccess()
      }
      if (options.holdOpen) pendingOpens.push(complete)
      else queueMicrotask(complete)
      return request
    },
    deleteDatabase: () => { throw new Error('Migration must never delete a database') },
  } as unknown as IDBFactory
  return {
    factory, opened, modes,
    resumeOpen: () => { pendingOpens.splice(0).forEach((complete) => complete()) },
    get closed() { return closed }, get aborted() { return aborted },
  }
}

const migrationFixture = (snapshot = history()) => {
  const original = structuredClone(snapshot)
  const markers = new Map<string, string>()
  const sessions = new Map<string, ChatSessionRecord>()
  const messages = new Map<string, ChatMessageRecord>()
  const memories = new Map<string, MemoryRecord>()
  const readUsers: number[] = []
  const calls: Array<{ method: string; userId: number; value: unknown }> = []
  let failAppend = false
  let failMarker = false
  let failCreate = false
  let memoryRace = false
  const remote: Pick<typeof remoteStore, 'createImportedSession' | 'appendMessage' | 'getMemory' | 'saveMemory'> = {
    createImportedSession: async (userId, id, summary) => {
      calls.push({ method: 'create', userId, value: { id, summary } })
      if (failCreate) throw new Error('Session limit reached')
      const key = `${userId}:${id}`
      const row = sessions.get(key) ?? { id, summary, createdAt: timestamp, updatedAt: timestamp }
      sessions.set(key, row)
      return row
    },
    appendMessage: async (userId, message) => {
      calls.push({ method: 'append', userId, value: message })
      if (failAppend && message.clientKey === 'legacy:2') { failAppend = false; throw new Error('Connection lost') }
      const key = `${userId}:${message.sessionId}:${message.clientKey}`
      const existing = messages.get(key)
      if (existing) assert.deepEqual(existing, message)
      messages.set(key, message)
    },
    getMemory: async (userId, scopeType, scopeKey) => {
      calls.push({ method: 'getMemory', userId, value: { scopeType, scopeKey } })
      return memories.get(`${userId}:${scopeType}:${scopeKey}`)
    },
    saveMemory: async (userId, scopeType, scopeKey, patch, options) => {
      calls.push({ method: 'saveMemory', userId, value: { scopeType, scopeKey, patch, options } })
      assert.deepEqual(options, { onlyIfMissing: true })
      const key = `${userId}:${scopeType}:${scopeKey}`
      if (memoryRace) memories.set(key, { ...localMemory(scopeType, scopeKey), content: 'Concurrent remote edit' })
      const row = memories.get(key) ?? { ...localMemory(scopeType, scopeKey), ...patch }
      memories.set(key, row)
      return row
    },
  }
  const dependencies = {
    remote,
    readHistory: async (userId: number) => { readUsers.push(userId); return structuredClone(snapshot) },
    getMarker: (key: string) => markers.get(key) ?? null,
    setMarker: (key: string, value: string) => {
      if (failMarker) { failMarker = false; throw new Error('Marker storage full') }
      markers.set(key, value)
    },
  }
  return {
    snapshot, original, markers, sessions, messages, memories, readUsers, calls, dependencies,
    migrate: createOwnedLocalHistoryMigrator(dependencies),
    set failAppend(value: boolean) { failAppend = value },
    set failMarker(value: boolean) { failMarker = value },
    set failCreate(value: boolean) { failCreate = value },
    set memoryRace(value: boolean) { memoryRace = value },
  }
}

test('reader enumerates and opens only the exact per-user database in readonly mode', async () => {
  const mock = fakeIndexedDb()
  assert.deepEqual(await readOwnedLocalHistory(1, mock.factory), history())
  assert.deepEqual(mock.opened, [getChatLocalDbName(1)])
  assert.deepEqual(mock.modes, ['readonly'])
  assert.equal(mock.closed, 1)
  await readOwnedLocalHistory(2, mock.factory)
  assert.deepEqual(mock.opened, [getChatLocalDbName(1), getChatLocalDbName(2)])
  assert.equal(mock.opened.includes('dailywork-ai-chat'), false)
})

test('reader does not open an absent database or touch an unowned legacy database', async () => {
  const mock = fakeIndexedDb(history(), { names: ['dailywork-ai-chat', getChatLocalDbName(2)] })
  assert.equal(await readOwnedLocalHistory(1, mock.factory), null)
  assert.deepEqual(mock.opened, [])
})

test('fresh-user migration completes before session fetch without opening or creating an IndexedDB database', { timeout: 2000 }, async (t) => {
  const userId = 101
  const mock = fakeIndexedDb(history(), { names: ['dailywork-ai-chat', getChatLocalDbName(2)] })
  const markers = new Map<string, string>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    indexedDB: mock.factory,
    localStorage: {
      getItem: (key: string) => markers.get(key) ?? null,
      setItem: (key: string, value: string) => { markers.set(key, value) },
    },
  } })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  let storageFetches = 0
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    assert.equal(markers.get(`dailywork-ai-chat-remote-import-v1:${userId}`), 'complete')
    assert.match(String(input), /action=sessions/)
    storageFetches += 1
    return Response.json({ sessions: [] })
  })
  await migrateOwnedLocalHistory(userId)
  assert.deepEqual(await listSessions(userId), [])
  assert.equal(storageFetches, 1)
  assert.deepEqual(mock.opened, [])
  assert.deepEqual(mock.modes, [])
})

test('fresh-user fallback aborts implicit creation and releases concurrent migration callers', { timeout: 2000 }, async () => {
  const mock = fakeIndexedDb(history(), { enumeration: 'absent', missing: true })
  const markers = new Map<string, string>()
  const migrate = createOwnedLocalHistoryMigrator({
    readHistory: (userId) => readOwnedLocalHistory(userId, mock.factory),
    getMarker: (key) => markers.get(key) ?? null,
    setMarker: (key, value) => { markers.set(key, value) },
  })
  await Promise.all([migrate(1), migrate(1)])
  await migrate(1)
  assert.deepEqual(mock.opened, [getChatLocalDbName(1)])
  assert.equal(mock.aborted, 1)
  assert.deepEqual(mock.modes, [])
  assert.equal(markers.get('dailywork-ai-chat-remote-import-v1:1'), 'complete')
})

test('unsupported database enumeration uses only named per-user reads and aborts accidental creation', async () => {
  for (const enumeration of ['absent', 'unsupported'] as const) {
    const mock = fakeIndexedDb(history(), { enumeration })
    assert.deepEqual(await readOwnedLocalHistory(1, mock.factory), history())
    assert.deepEqual(mock.opened, [getChatLocalDbName(1)])
    const missing = fakeIndexedDb(history(), { enumeration, missing: true })
    assert.equal(await readOwnedLocalHistory(1, missing.factory), null)
    assert.equal(missing.aborted, 1)
    assert.deepEqual(missing.modes, [])
  }
})

test('reader propagates enumeration, blocked, schema and transaction errors without modifying data', async () => {
  for (const options of [{ enumeration: 'failed' as const }, { blocked: true }, { missingStore: true }, { readFailure: true }]) {
    const snapshot = history()
    const original = structuredClone(snapshot)
    const mock = fakeIndexedDb(snapshot, options)
    await assert.rejects(() => readOwnedLocalHistory(1, mock.factory))
    assert.deepEqual(snapshot, original)
    assert.ok(mock.modes.every((mode) => mode === 'readonly'))
  }
})

test('stalled browser enumeration, queued open, and snapshot reads have bounded deadlines', { timeout: 2000 }, async () => {
  const enumeration = fakeIndexedDb(history(), { enumeration: 'hanging' })
  await assert.rejects(() => readOwnedLocalHistory(1, enumeration.factory, 20), /database enumeration timed out/)
  assert.deepEqual(enumeration.opened, [])
  const open = fakeIndexedDb(history(), { holdOpen: true })
  await assert.rejects(() => readOwnedLocalHistory(1, open.factory, 20), /database open timed out/)
  assert.equal(open.closed, 0)
  open.resumeOpen()
  assert.equal(open.closed, 1)
  assert.deepEqual(open.modes, [])
  const read = fakeIndexedDb(history(), { holdRead: true })
  await assert.rejects(() => readOwnedLocalHistory(1, read.factory, 20), /snapshot read timed out/)
  assert.equal(read.aborted, 1)
  assert.equal(read.closed, 1)
})

test('a timed-out migration does not set a marker and a subsequent migration can retry', { timeout: 2000 }, async () => {
  const mock = migrationFixture()
  const stalled = fakeIndexedDb(history(), { holdOpen: true })
  let retry = false
  const migrate = createOwnedLocalHistoryMigrator({
    ...mock.dependencies,
    readHistory: async (userId) => retry ? history() : readOwnedLocalHistory(userId, stalled.factory, 20),
  })
  await assert.rejects(() => migrate(1), /database open timed out/)
  assert.equal(mock.markers.size, 0)
  assert.equal(mock.calls.length, 0)
  stalled.resumeOpen()
  retry = true
  await migrate(1)
  assert.equal(mock.markers.size, 1)
  assert.equal(mock.messages.size, 2)
})

test('import IDs are deterministic SHA-256 UUIDs namespaced by user and old session ID', async () => {
  const id = await getImportedSessionId(1, oldId)
  const bytes = createHash('sha256').update(`1:${oldId}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 15) | 128
  bytes[8] = (bytes[8] & 63) | 128
  assert.equal(id.replaceAll('-', ''), bytes.toString('hex'))
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(id, await getImportedSessionId(1, oldId))
  assert.notEqual(id, await getImportedSessionId(2, oldId))
  assert.notEqual(id, await getImportedSessionId(1, `${oldId}-fallback`))
})

test('migration preserves titles, all messages, memory scope and enabled state without deleting local records', async () => {
  const mock = migrationFixture()
  await mock.migrate(1)
  const id = await getImportedSessionId(1, oldId)
  assert.equal(mock.sessions.get(`1:${id}`)?.summary, 'My original title')
  assert.deepEqual(Array.from(mock.messages.values()).map((row) => row.content), ['Message 1', 'Message 2'])
  assert.ok(Array.from(mock.messages.keys()).every((key) => key.includes(':legacy:')))
  assert.equal(mock.memories.get(`1:session:${id}`)?.scopeKey, id)
  assert.equal(mock.memories.get('1:global:global')?.title, 'My memory title')
  assert.equal(mock.memories.get('1:global:global')?.enabled, false)
  assert.equal(mock.memories.get('1:project:project-a')?.content, 'Original memory')
  assert.equal(mock.markers.size, 1)
  assert.deepEqual(mock.snapshot, mock.original)
})

test('completed migration and concurrent calls run once per user without cross-account marker reuse', async () => {
  const mock = migrationFixture()
  await Promise.all([mock.migrate(1), mock.migrate(1)])
  const calls = mock.calls.length
  await mock.migrate(1)
  assert.equal(mock.calls.length, calls)
  await mock.migrate(2)
  assert.deepEqual(mock.readUsers, [1, 2])
  assert.equal(mock.markers.size, 2)
  assert.equal(mock.sessions.size, 2)
  assert.equal(mock.messages.size, 4)
  assert.notEqual((await getImportedSessionId(1, oldId)), (await getImportedSessionId(2, oldId)))
})

test('partial network failure and marker failure retry idempotently with stable message keys', async () => {
  const mock = migrationFixture()
  mock.failAppend = true
  await assert.rejects(() => mock.migrate(1), /Connection lost/)
  assert.equal(mock.markers.size, 0)
  assert.equal(mock.sessions.size, 1)
  assert.equal(mock.messages.size, 1)
  mock.failMarker = true
  await assert.rejects(() => mock.migrate(1), /Marker storage full/)
  assert.equal(mock.markers.size, 0)
  await createOwnedLocalHistoryMigrator(mock.dependencies)(1)
  assert.equal(mock.sessions.size, 1)
  assert.equal(mock.messages.size, 2)
  assert.equal(mock.memories.size, 4)
  assert.equal(mock.markers.size, 1)
  assert.deepEqual(mock.snapshot, mock.original)
})

test('preexisting remote memories and concurrent remote edits are not overwritten', async () => {
  const mock = migrationFixture()
  mock.memories.set('1:global:global', { ...localMemory(), content: 'Current remote memory', enabled: true })
  mock.memoryRace = true
  await mock.migrate(1)
  assert.equal(mock.memories.get('1:global:global')?.content, 'Current remote memory')
  assert.equal(mock.memories.get('1:global:global')?.enabled, true)
  assert.equal(mock.calls.some((call) => call.method === 'saveMemory' && (call.value as { scopeType: string }).scopeType === 'global'), false)
  assert.equal(mock.memories.get('1:route:/value')?.content, 'Concurrent remote edit')
})

test('local cap or malformed records fail before any upload and leave original data and markers intact', async () => {
  const malformed: OwnedLocalHistory[] = [
    { ...history(), sessions: Array.from({ length: 201 }, (_, index) => localSession(String(index))) },
    { ...history(), sessions: [localSession(), localSession()] },
    { ...history(), sessions: [{ ...localSession(), summary: 'x'.repeat(201) }] },
    { ...history(), messages: [{ ...localMessage(), role: 'system' }] },
    { ...history(), messages: [{ ...localMessage(), id: undefined }] },
    { ...history(), messages: [localMessage(), localMessage()] },
    { ...history(), messages: [{ ...localMessage(), sessionId: 'orphan' }] },
    { ...history(), messages: [{ ...localMessage(), content: 'x'.repeat(128 * 1024 + 1) }] },
    { ...history(), messages: [{ ...localMessage(), content: '' }] },
    { ...history(), memories: [{ ...localMemory(), enabled: 'true' }] },
    { ...history(), memories: [{ ...localMemory(), content: 'x'.repeat(4001) }] },
    { ...history(), memories: [localMemory('session', 'orphan')] },
    { ...history(), memories: [{ ...localMemory(), updatedAt: 'invalid' }] },
  ]
  for (const snapshot of malformed) {
    const mock = migrationFixture(snapshot)
    await assert.rejects(() => mock.migrate(1))
    assert.equal(mock.calls.length, 0)
    assert.equal(mock.markers.size, 0)
    assert.deepEqual(mock.snapshot, mock.original)
  }
})

test('server cap failure does not set a marker or modify the local history', async () => {
  const mock = migrationFixture()
  mock.failCreate = true
  await assert.rejects(() => mock.migrate(1), /Session limit/)
  assert.equal(mock.markers.size, 0)
  assert.deepEqual(mock.snapshot, mock.original)
  mock.failCreate = false
  await mock.migrate(1)
  assert.equal(mock.messages.size, 2)
  assert.equal(mock.markers.size, 1)
})

test('session draft memories are preserved and invalid user IDs never read local or remote stores', async () => {
  const mock = migrationFixture({ sessions: [], messages: [], memories: [localMemory('session', 'default')] })
  await mock.migrate(1)
  assert.equal(mock.memories.get('1:session:default')?.content, 'Original memory')
  for (const id of [0, -1, Number.NaN, 1.5]) assert.throws(() => mock.migrate(id))
  assert.deepEqual(mock.readUsers, [1])
})

test('migration wires deterministic importId, stable keys and create-only memories through fetch', async (t) => {
  const calls: Array<Record<string, unknown>> = []
  const markers = new Map<string, string>()
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    if (body) {
      calls.push(body)
      if (body.action === 'createSession') return Response.json({ session: { ...localSession(), id: body.importId } })
      if (body.action === 'appendMessage') return Response.json({ message: body.message })
      if (body.action === 'saveMemory') return Response.json({ memory: { ...localMemory(), ...body.patch as object } })
    }
    assert.equal(new URL(String(input), 'https://test.local').searchParams.get('action'), 'memory')
    return Response.json({ memory: null })
  })
  const migrate = createOwnedLocalHistoryMigrator({
    readHistory: async () => history(), getMarker: (key) => markers.get(key) ?? null,
    setMarker: (key, value) => { markers.set(key, value) },
  })
  await migrate(1)
  assert.equal(calls[0].importId, await getImportedSessionId(1, oldId))
  assert.deepEqual(calls.filter((call) => call.action === 'appendMessage').map((call) => (call.message as { clientKey: string }).clientKey), ['legacy:1', 'legacy:2'])
  assert.ok(calls.filter((call) => call.action === 'saveMemory').every((call) => call.onlyIfMissing === true))
  assert.equal(calls.some((call) => 'userId' in call), false)
  assert.equal(markers.size, 1)
})
