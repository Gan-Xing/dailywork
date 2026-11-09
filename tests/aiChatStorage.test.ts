import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test, { type TestContext } from 'node:test'

import type { AiChatMemory, AiChatMessage, AiChatSession, Prisma, PrismaClient } from '@prisma/client'

import * as remote from '../lib/ai-chat/remoteStore'
import { MAX_AI_CHAT_BODY_BYTES } from '../lib/ai-chat/requestBody'

const loadModule = createRequire(import.meta.url)
const headers = loadModule('next/headers') as { cookies: () => Promise<unknown> }
const now = new Date('2026-11-09T00:00:00.000Z')
const sessionId = '00000000-0000-4000-8000-000000000001'
const foreignId = '00000000-0000-4000-8000-000000000002'

const session = (id = sessionId, userId = 1): AiChatSession => ({
  id, userId, summary: 'Session', summarySource: 'auto', createdAt: now, updatedAt: now,
})
const message = (id: number, owner = sessionId): AiChatMessage => ({
  id, sessionId: owner, clientKey: `message-${id}`, role: 'user', content: `Message ${id}`, createdAt: now, requiredPermissions: [], requiresAdmin: false,
})
const memory = (userId = 1, scopeType = 'global', scopeKey = 'global'): AiChatMemory => ({
  id: randomUUID(), userId, scopeType, scopeKey, title: 'Title', content: 'Memory', enabled: true, updatedAt: now,
})

type SessionWhere = { id?: string; userId?: number }
type MemoryKey = { userId: number; scopeType: string; scopeKey: string }
const fixture = () => {
  let sessions: AiChatSession[] = [session(), session(foreignId, 2)]
  let messages: AiChatMessage[] = []
  let memories: AiChatMemory[] = []
  const jobs: Array<{ userId: number; sessionId: string | null; status: string }> = []
  const calls: Array<{ method: string; args: unknown }> = []
  let transactionCalls = 0
  let retryCode: string | undefined
  let dbFailure = false
  const matchesSession = (row: AiChatSession, where: SessionWhere) =>
    (where.id === undefined || row.id === where.id) && (where.userId === undefined || row.userId === where.userId)
  const matchesMemory = (row: AiChatMemory, where: MemoryKey) =>
    row.userId === where.userId && row.scopeType === where.scopeType && row.scopeKey === where.scopeKey
  const record = (method: string, args: unknown) => { calls.push({ method, args }) }
  let user: {
    id: number
    username: string
    employmentStatus: string
    roles: Array<{ role: { name: string; permissions: Array<{ permission: { code: string; status: string } }> } }>
  } | null = {
    id: 1, username: 'current-name', employmentStatus: 'ACTIVE', roles: [{ role: {
      name: 'Member', permissions: [
        { permission: { code: 'ai-chat:view', status: 'ACTIVE' } },
        { permission: { code: 'ai-chat:debug', status: 'ARCHIVED' } },
      ],
    } }],
  }
  let activePermissions = [{ code: 'ai-chat:view' }, { code: 'report:view' }]

  const tx = {
    aiChatSession: {
      findFirst: async ({ where }: { where: SessionWhere }) => {
        record('session.findFirst', { where })
        return sessions.find((row) => matchesSession(row, where)) ?? null
      },
      findMany: async (args: { where: SessionWhere; take: number }) => {
        record('session.findMany', args)
        return sessions.filter((row) => matchesSession(row, args.where))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id)).slice(0, args.take)
      },
      count: async ({ where }: { where: SessionWhere }) => {
        record('session.count', { where })
        return sessions.filter((row) => matchesSession(row, where)).length
      },
      create: async ({ data }: { data: Pick<AiChatSession, 'userId' | 'summary' | 'summarySource'> }) => {
        record('session.create', { data })
        const row = { ...session(randomUUID()), ...data }
        sessions.push(row)
        return row
      },
      upsert: async (args: { where: SessionWhere; create: AiChatSession; update: object }) => {
        record('session.upsert', args)
        assert.deepEqual(args.update, {})
        const row = sessions.find((row) => matchesSession(row, args.where))
        if (row) return row
        const created = { ...session(args.create.id), ...args.create }
        sessions.push(created)
        return created
      },
      update: async ({ where, data }: { where: SessionWhere; data: Partial<AiChatSession> }) => {
        record('session.update', { where, data })
        const row = sessions.find((row) => matchesSession(row, where))
        assert.ok(row)
        Object.assign(row, data)
        return row
      },
      delete: async ({ where }: { where: SessionWhere }) => {
        record('session.delete', { where })
        const row = sessions.find((row) => matchesSession(row, where))
        assert.ok(row)
        sessions = sessions.filter((other) => other !== row)
        messages = messages.filter((other) => other.sessionId !== row.id)
        jobs.forEach((job) => { if (job.sessionId === row.id) job.sessionId = null })
        return row
      },
    },
    aiChatJob: {
      updateMany: async (args: {
        where: { userId: number; sessionId: string; status: { in: string[] } }
        data: { status: string }
      }) => {
        record('job.updateMany', args)
        const matching = jobs.filter((job) => job.userId === args.where.userId
          && job.sessionId === args.where.sessionId && args.where.status.in.includes(job.status))
        matching.forEach((job) => { job.status = args.data.status })
        return { count: matching.length }
      },
    },
    aiChatMessage: {
      findMany: async (args: { where: { sessionId: string; session: { userId: number }; id?: { lt: number } }; take: number }) => {
        record('message.findMany', args)
        assert.ok(sessions.some((row) => row.id === args.where.sessionId && row.userId === args.where.session.userId))
        return messages.filter((row) => row.sessionId === args.where.sessionId && (!args.where.id || row.id < args.where.id.lt))
          .sort((a, b) => b.id - a.id).slice(0, args.take)
      },
      upsert: async (args: {
        where: { sessionId_clientKey: { sessionId: string; clientKey: string }; session: { userId: number } }
        create: Omit<AiChatMessage, 'id' | 'createdAt'>
        update: object
      }) => {
        record('message.upsert', args)
        assert.ok(sessions.some((row) => row.id === args.create.sessionId && row.userId === args.where.session.userId))
        assert.deepEqual(args.update, {})
        const row = messages.find((row) => row.sessionId === args.where.sessionId_clientKey.sessionId && row.clientKey === args.where.sessionId_clientKey.clientKey)
        if (row) return row
        const created = { ...args.create, id: messages.length + 1, createdAt: now }
        messages.push(created)
        return created
      },
    },
    aiChatMemory: {
      findUnique: async ({ where }: { where: { userId_scopeType_scopeKey: MemoryKey } }) => {
        record('memory.findUnique', { where })
        return memories.find((row) => matchesMemory(row, where.userId_scopeType_scopeKey)) ?? null
      },
      upsert: async (args: {
        where: { userId_scopeType_scopeKey: MemoryKey }
        create: Omit<AiChatMemory, 'id' | 'updatedAt'>
        update: Partial<AiChatMemory>
      }) => {
        record('memory.upsert', args)
        const row = memories.find((row) => matchesMemory(row, args.where.userId_scopeType_scopeKey))
        if (row) return Object.assign(row, args.update)
        const created = { ...args.create, id: randomUUID(), updatedAt: now }
        memories.push(created)
        return created
      },
      deleteMany: async ({ where }: { where: MemoryKey }) => {
        record('memory.deleteMany', { where })
        const before = memories.length
        memories = memories.filter((row) => !matchesMemory(row, where))
        return { count: before - memories.length }
      },
    },
  }

  const db = {
    user: { findUnique: async (args: unknown) => {
      record('user.findUnique', args)
      if (dbFailure) throw new Error('sensitive database detail')
      return user
    } },
    permission: { findMany: async (args: unknown) => { record('permission.findMany', args); return activePermissions } },
    $transaction: async <T>(callback: (client: Prisma.TransactionClient) => Promise<T>, options: unknown) => {
      transactionCalls += 1
      record('transaction', options)
      if (retryCode) { const code = retryCode; retryCode = undefined; throw Object.assign(new Error('retry'), { code }) }
      const before = structuredClone({ sessions, messages, memories, jobs })
      try { return await callback(tx as unknown as Prisma.TransactionClient) } catch (error) {
        sessions = before.sessions
        messages = before.messages
        memories = before.memories
        jobs.splice(0, jobs.length, ...before.jobs)
        throw error
      }
    },
  }
  return {
    db: db as unknown as PrismaClient,
    tx,
    calls,
    jobs,
    get sessions() { return sessions }, set sessions(value) { sessions = value },
    get messages() { return messages }, set messages(value) { messages = value },
    get memories() { return memories }, set memories(value) { memories = value },
    get user() { return user }, set user(value) { user = value },
    set activePermissions(value: Array<{ code: string }>) { activePermissions = value },
    set retryCode(value: string) { retryCode = value },
    set dbFailure(value: boolean) { dbFailure = value },
    get transactionCalls() { return transactionCalls },
  }
}

// Install a complete database double before loading any server module. No Prisma
// delegate in this file can connect to the configured (production) database.
let current = fixture()
const globalClient = globalThis as unknown as { prisma?: PrismaClient }
const previousClient = globalClient.prisma
globalClient.prisma = {
  user: { findUnique: (args: unknown) => current.db.user.findUnique(args as Prisma.UserFindUniqueArgs) },
  permission: { findMany: (args: unknown) => current.db.permission.findMany(args as Prisma.PermissionFindManyArgs) },
  $transaction: (...args: unknown[]) => (current.db.$transaction as (...args: unknown[]) => unknown)(...args),
} as unknown as PrismaClient
const access = loadModule('../lib/server/aiChatAccess') as typeof import('../lib/server/aiChatAccess')
const storage = loadModule('../lib/server/aiChatSessionStore') as typeof import('../lib/server/aiChatSessionStore')
const route = loadModule('../app/api/ai-chat/storage/route') as typeof import('../app/api/ai-chat/storage/route')
if (previousClient === undefined) delete globalClient.prisma
else globalClient.prisma = previousClient

const status = (expected: number) => (error: unknown) => error instanceof access.AiChatError && error.status === expected
const storeFixture = () => {
  const mock = fixture()
  return { mock, store: storage.createAiChatSessionStore(mock.db) }
}
const authenticate = (t: TestContext, id: number | null = 1) => {
  const body = Buffer.from(JSON.stringify({ id, username: 'stale-name', roles: [], permissions: ['ai-chat:view'], issuedAt: 0 })).toString('base64url')
  const signature = createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret').update(body).digest('base64url')
  t.mock.method(headers, 'cookies', async () => ({ get: () => id === null ? undefined : { value: `${body}.${signature}` } }))
}
const post = (body: unknown, origin?: string) => new Request('https://dailywork.test/api/ai-chat/storage', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin === undefined ? {} : { Origin: origin }) }, body: JSON.stringify(body),
})
const get = (query: string) => new Request(`https://dailywork.test/api/ai-chat/storage?${query}`)

test('actor reloads current roles and ACTIVE permissions, not stale cookie grants', async () => {
  const mock = fixture()
  const actors = access.createAiChatAccess({ db: mock.db, getSessionUser: async () => ({ id: 1 }) })
  assert.deepEqual(await actors.requireAiChatActor(), { id: 1, username: 'current-name', permissions: ['ai-chat:view'], roles: ['Member'] })
  assert.deepEqual(mock.calls[0].args, {
    where: { id: 1 }, select: { id: true, username: true, employmentStatus: true, roles: { select: { role: { select: {
      name: true, permissions: { where: { permission: { status: 'ACTIVE' } }, select: { permission: { select: { code: true, status: true } } } },
    } } } } },
  })
  mock.user!.roles = []
  await assert.rejects(actors.requireAiChatActor, status(403))
  mock.user!.employmentStatus = 'TERMINATED'
  await assert.rejects(actors.requireAiChatActor, status(403))
  mock.user = null
  await assert.rejects(actors.requireAiChatActor, status(401))
})

test('worker actor loading is cookie-free and Admin gets only current ACTIVE permissions', async () => {
  const mock = fixture()
  const actors = access.createAiChatAccess({ db: mock.db, getSessionUser: async () => { throw new Error('No request context') } })
  mock.user!.roles = [{ role: { name: 'Admin', permissions: [] } }]
  assert.deepEqual((await actors.loadAiChatActor(1)).permissions, ['ai-chat:view', 'report:view'])
  assert.deepEqual(mock.calls.find((call) => call.method === 'permission.findMany')?.args, { where: { status: 'ACTIVE' }, select: { code: true } })
  mock.activePermissions = [{ code: 'report:view' }]
  await assert.rejects(() => actors.loadAiChatActor(1), status(403))
  for (const id of [0, -1, 1.5, Number.NaN]) await assert.rejects(() => actors.loadAiChatActor(id), status(401))
  assert.equal(new access.AiChatError('invalid').status, 400)
})

test('session creation and listing are owned and capped at 200 without silent truncation', async () => {
  const { mock, store } = storeFixture()
  const created = await store.createSession(1, 'New session')
  assert.equal(mock.sessions.find((row) => row.id === created.id)?.userId, 1)
  assert.equal(created.summarySource, 'auto')
  assert.equal((await store.listSessions(1)).length, 2)
  assert.equal((await store.listSessions(2)).length, 1)
  mock.sessions = Array.from({ length: 200 }, () => session(randomUUID()))
  await assert.rejects(() => store.createSession(1, 'Over limit'), status(409))
  mock.sessions.push(session(randomUUID()))
  await assert.rejects(() => store.listSessions(1), status(409))
  await assert.rejects(() => store.listSessions(0), status(401))
  assert.throws(() => store.createSession(1, 'x'.repeat(201)), status(413))
})

test('import UUIDs are idempotent for the same owner, preserve renamed titles, and reject foreign collisions', async () => {
  const { mock, store } = storeFixture()
  const importId = randomUUID()
  const created = await store.createSession(1, 'Original local title', importId)
  assert.equal(created.id, importId)
  assert.equal(created.summary, 'Original local title')
  assert.equal(created.summarySource, 'manual')
  await store.updateSession(1, importId, { summary: 'New remote title' })
  assert.equal((await store.createSession(1, 'Original local title', importId)).summary, 'New remote title')
  assert.equal(mock.sessions.filter((row) => row.id === importId).length, 1)
  await assert.rejects(() => store.createSession(1, 'Collision', foreignId), status(409))
  mock.sessions = [mock.sessions.find((row) => row.id === importId)!, ...Array.from({ length: 199 }, () => session(randomUUID()))]
  assert.equal((await store.createSession(1, 'Retry at cap', importId)).id, importId)
  await assert.rejects(() => store.createSession(1, 'New at cap', randomUUID()), status(409))
  assert.throws(() => store.createSession(1, 'Invalid', 'not-a-uuid'), status(400))
})

test('every session operation rejects another owner and nonexistent sessions inside its transaction', async () => {
  const { mock, store } = storeFixture()
  for (const id of [foreignId, '00000000-0000-4000-8000-000000000003']) {
    for (const operation of [
      () => store.listMessages(1, id),
      () => store.appendMessage(1, { sessionId: id, clientKey: 'key', role: 'user', content: 'Hello' }),
      () => store.updateSession(1, id, { summary: 'Changed' }),
      () => store.deleteSession(1, id),
      () => store.getMemory(1, 'session', id),
      () => store.saveMemory(1, 'session', id, { content: 'Private' }),
    ]) await assert.rejects(operation, status(404))
  }
  assert.equal(mock.transactionCalls, 12)
  assert.equal(mock.calls.some((call) => /upsert|update|delete/.test(call.method)), false)
  assert.equal(mock.sessions[1].summary, 'Session')
})

test('append upsert is idempotent and conflicting role or content rolls back', async () => {
  const { mock, store } = storeFixture()
  const input = { sessionId, clientKey: 'stable-key', role: 'assistant', content: '  Complete answer  ', createdAt: '2099-01-01' }
  const first = await store.appendMessage(1, input)
  assert.deepEqual(await store.appendMessage(1, input), first)
  assert.equal(mock.messages.length, 1)
  assert.equal(first.createdAt, now.toISOString())
  assert.equal(first.content, input.content)
  await assert.rejects(() => store.appendMessage(1, { ...input, content: 'Different' }), status(409))
  await assert.rejects(() => store.appendMessage(1, { ...input, role: 'user' }), status(409))
  assert.equal(mock.messages[0].content, input.content)
  assert.equal(mock.calls.filter((call) => call.method === 'session.update').length, 2)
  const create = (mock.calls.find((call) => call.method === 'message.upsert')!.args as { create: object }).create
  assert.equal('createdAt' in create, false)
})

test('messages are complete up to 128 Ki characters; invalid inputs never reach transactions', async () => {
  const { mock, store } = storeFixture()
  const input = { sessionId, clientKey: 'key', role: 'assistant', content: 'x'.repeat(storage.MAX_AI_CHAT_MESSAGE_LENGTH) }
  assert.equal((await store.appendMessage(1, input)).content.length, storage.MAX_AI_CHAT_MESSAGE_LENGTH)
  const before = mock.transactionCalls
  for (const patch of [
    { role: 'system' }, { role: 'tool' }, { content: '' }, { content: '\u0000' },
    { content: 'x'.repeat(storage.MAX_AI_CHAT_MESSAGE_LENGTH + 1) }, { clientKey: '' },
    { clientKey: 'x'.repeat(129) }, { sessionId: 'not-a-uuid' },
  ]) assert.throws(() => store.appendMessage(1, { ...input, ...patch }), (error: unknown) => error instanceof access.AiChatError)
  assert.equal(mock.transactionCalls, before)
})

test('recent message pages are chronological, expose older history, and use exclusive ID cursors', async () => {
  const { mock, store } = storeFixture()
  mock.messages = Array.from({ length: 205 }, (_, index) => message(index + 1))
  mock.messages.push(message(999, foreignId))
  const first = await store.listMessages(1, sessionId)
  assert.deepEqual(first.messages.map((row) => row.id), Array.from({ length: 100 }, (_, index) => index + 106))
  assert.equal(first.hasMore, true)
  assert.equal(first.nextBeforeId, 106)
  const second = await store.listMessages(1, sessionId, { beforeId: first.nextBeforeId })
  assert.equal(second.messages[0].id, 6)
  assert.equal(second.nextBeforeId, 6)
  const last = await store.listMessages(1, sessionId, { beforeId: second.nextBeforeId })
  assert.deepEqual(last.messages.map((row) => row.id), [1, 2, 3, 4, 5])
  assert.equal(last.hasMore, false)
  assert.equal(last.nextBeforeId, null)
  assert.equal((await store.listMessages(1, sessionId, { limit: 500 })).messages.length, 205)
  for (const options of [{ limit: 501 }, { limit: 0 }, { beforeId: -1 }, { beforeId: 2147483648 }, { beforeId: 'bad' }]) {
    assert.throws(() => store.listMessages(1, sessionId, options), status(400))
  }
})

test('session updates cannot change ownership or client timestamps; deletion removes only owned data', async () => {
  const { mock, store } = storeFixture()
  const updated = await store.updateSession(1, sessionId, {
    id: foreignId, userId: 2, summary: 'Renamed', summarySource: 'manual', createdAt: '2099', updatedAt: '2099',
  })
  assert.equal(updated.id, sessionId)
  assert.equal(updated.createdAt, now.toISOString())
  assert.equal(updated.summarySource, 'manual')
  assert.notEqual(updated.updatedAt, '2099')
  assert.equal(mock.sessions[0].userId, 1)
  mock.messages = [message(1), message(2, foreignId)]
  mock.memories = [memory(1, 'session', sessionId), memory(2, 'session', sessionId)]
  await store.deleteSession(1, sessionId)
  assert.deepEqual(mock.sessions.map((row) => row.id), [foreignId])
  assert.deepEqual(mock.messages.map((row) => row.id), [2])
  assert.deepEqual(mock.memories.map((row) => row.userId), [2])
  assert.throws(() => store.updateSession(1, foreignId, { summarySource: 'invalid' }), status(400))
})

test('session deletion cancels only owned pending jobs and retains running/completed audit rows', async () => {
  const { mock, store } = storeFixture()
  for (const jobStatus of ['CONFIRMATION_REQUIRED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']) {
    mock.jobs.push({ userId: 1, sessionId, status: jobStatus })
  }
  mock.jobs.push({ userId: 2, sessionId, status: 'QUEUED' }, { userId: 1, sessionId: foreignId, status: 'QUEUED' })
  await store.deleteSession(1, sessionId)
  assert.deepEqual(mock.jobs.map((job) => job.status), ['CANCELLED', 'CANCELLED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'QUEUED', 'QUEUED'])
  assert.equal(mock.jobs.length, 8)
  assert.ok(mock.jobs.slice(0, 7).every((job) => job.sessionId === null))
  assert.equal(mock.jobs[7].sessionId, foreignId)
  const cancellation = mock.calls.findIndex((call) => call.method === 'job.updateMany')
  assert.deepEqual(mock.calls[cancellation].args, {
    where: { userId: 1, sessionId, status: { in: ['CONFIRMATION_REQUIRED', 'QUEUED'] } }, data: { status: 'CANCELLED' },
  })
  assert.ok(cancellation < mock.calls.findIndex((call) => call.method === 'session.delete'))
})

test('failed session deletion rolls back pending-job cancellation and memory removal', async (t) => {
  const { mock, store } = storeFixture()
  mock.jobs.push({ userId: 1, sessionId, status: 'QUEUED' })
  mock.memories = [memory(1, 'session', sessionId)]
  t.mock.method(mock.tx.aiChatSession, 'delete', async () => { throw new Error('Delete failed') })
  await assert.rejects(() => store.deleteSession(1, sessionId), /Delete failed/)
  assert.equal(mock.jobs[0].status, 'QUEUED')
  assert.equal(mock.jobs[0].sessionId, sessionId)
  assert.equal(mock.memories.length, 1)
  assert.ok(mock.sessions.some((row) => row.id === sessionId))
})

test('memories are per-user, preserve omitted fields and expose stable scope:key IDs', async () => {
  const { mock, store } = storeFixture()
  mock.memories = [memory(2)]
  assert.equal(await store.getMemory(1, 'global', 'global'), undefined)
  const first = await store.saveMemory(1, 'global', 'global', { content: 'Private', enabled: false, userId: 2, id: 'forged' })
  assert.equal(first.id, 'global:global')
  assert.equal(first.title, '')
  const updated = await store.saveMemory(1, 'global', 'global', { title: 'New title' })
  assert.equal(updated.content, 'Private')
  assert.equal(updated.enabled, false)
  assert.equal(updated.id, first.id)
  assert.equal((await store.getMemory(2, 'global', 'global'))?.content, 'Memory')
  for (const [type, key] of [['route', '/value'], ['project', 'project-a'], ['session', sessionId], ['session', 'default']]) {
    assert.equal((await store.saveMemory(1, type, key, {})).id, `${type}:${key}`)
  }
  for (const operation of [
    () => store.saveMemory(1, 'global', 'global', { content: 'x'.repeat(4001) }),
    () => store.saveMemory(1, 'global', 'global', { title: 'x'.repeat(201) }),
    () => store.saveMemory(1, 'global', 'global', { enabled: 'true' }),
    () => store.getMemory(1, 'unknown', 'key'),
    () => store.getMemory(1, ['global'], 'key'),
    () => store.getMemory(1, 'route', ''),
    () => store.getMemory(1, 'route', 'x'.repeat(513)),
  ]) assert.throws(operation, (error: unknown) => error instanceof access.AiChatError)
})

test('import memory writes atomically leave preexisting remote memories unchanged', async () => {
  const { mock, store } = storeFixture()
  const existing = memory()
  mock.memories = [existing]
  const before = structuredClone(existing)
  const result = await store.saveMemory(1, 'global', 'global', { title: 'Old', content: 'Old', enabled: false }, { onlyIfMissing: true })
  assert.equal(result.content, before.content)
  assert.deepEqual(mock.memories[0], before)
  assert.deepEqual((mock.calls.find((call) => call.method === 'memory.upsert')!.args as { update: object }).update, {})
  const created = await store.saveMemory(1, 'route', '/new', { title: 'Local title', content: 'Local', enabled: false }, { onlyIfMissing: true })
  assert.equal(created.title, 'Local title')
  assert.equal(created.enabled, false)
  assert.throws(() => store.saveMemory(1, 'route', '/new', {}, { onlyIfMissing: 'true' }), status(400))
})

test('serializable write conflicts retry the entire ownership-scoped transaction', async () => {
  for (const code of ['P2034', 'P2002']) {
    const { mock, store } = storeFixture()
    mock.retryCode = code
    await store.appendMessage(1, { sessionId, clientKey: 'key', role: 'user', content: 'Hello' })
    assert.equal(mock.transactionCalls, 2)
    assert.equal(mock.messages.length, 1)
    assert.deepEqual(mock.calls.filter((call) => call.method === 'transaction').map((call) => call.args), [
      { isolationLevel: 'Serializable' }, { isolationLevel: 'Serializable' },
    ])
  }
})

test('transaction retries are bounded, failures propagate, and missing rows map to 404', async () => {
  let calls = 0
  const db = {
    $transaction: async () => { calls += 1; throw Object.assign(new Error('conflict'), { code: 'P2034' }) },
  } as unknown as PrismaClient
  await assert.rejects(() => storage.createAiChatSessionStore(db).createSession(1, 'Retry'), /conflict/)
  assert.equal(calls, 4)
  const { mock, store } = storeFixture()
  mock.retryCode = 'P2025'
  await assert.rejects(() => store.updateSession(1, sessionId, { summary: 'Changed' }), status(404))
  mock.retryCode = 'P1001'
  await assert.rejects(() => store.createSession(1, 'Unavailable'), /retry/)
})

test('message insertion rolls back if the parent-session update fails', async (t) => {
  const { mock, store } = storeFixture()
  t.mock.method(mock.tx.aiChatSession, 'update', async () => { throw new Error('Update failed') })
  await assert.rejects(() => store.appendMessage(1, { sessionId, clientKey: 'key', role: 'user', content: 'Hello' }), /Update failed/)
  assert.equal(mock.messages.length, 0)
  assert.equal(mock.sessions[0].summary, 'Session')
})

test('storage API requires identity and current grants even with stale signed cookie permissions', async (t) => {
  current = fixture()
  authenticate(t, null)
  assert.equal((await route.GET(get('action=sessions'))).status, 401)
  authenticate(t)
  current.user!.roles = []
  assert.equal((await route.GET(get('action=sessions'))).status, 403)
  assert.equal((await route.POST(post({ action: 'createSession', summary: 'No' }))).status, 403)
  assert.equal(current.transactionCalls, 0)
})

test('storage API serves all actions, ignores forged user IDs, and never mutates through GET', async (t) => {
  current = fixture()
  authenticate(t)
  const sessions = await route.GET(get('action=sessions&userId=2'))
  assert.equal(sessions.headers.get('cache-control'), 'no-store')
  assert.equal((await sessions.json()).sessions[0].id, sessionId)
  const reads = current.transactionCalls
  assert.equal((await route.GET(get('action=deleteSession&sessionId=' + sessionId))).status, 400)
  assert.equal(current.transactionCalls, reads)
  assert.equal((await route.POST(post({ action: 'createSession', summary: 'Created', userId: 2 }, 'https://dailywork.test'))).status, 200)
  assert.equal(current.sessions.at(-1)?.userId, 1)
  assert.equal((await route.POST(post({ action: 'appendMessage', message: { sessionId, clientKey: 'key', role: 'user', content: 'Hello' } }))).status, 200)
  const page = await (await route.GET(get(`action=messages&sessionId=${sessionId}&limit=1`))).json()
  assert.equal(page.messages.length, 1)
  assert.equal(page.hasMore, false)
  assert.equal((await route.POST(post({ action: 'updateSession', sessionId, patch: { summary: 'Renamed' } }))).status, 200)
  assert.equal((await route.POST(post({ action: 'saveMemory', scopeType: 'global', scopeKey: 'global', patch: { content: 'Saved' } }))).status, 200)
  const saved = await (await route.GET(get('action=memory&scopeType=global&scopeKey=global'))).json()
  assert.equal(saved.memory.id, 'global:global')
  assert.equal((await route.POST(post({ action: 'deleteSession', sessionId }))).status, 200)
  assert.equal((await route.POST(post({ action: 'unknown' }))).status, 400)
  assert.equal((await route.POST(post({ action: 'updateSession', sessionId: foreignId, patch: { summary: 'Attack' } }))).status, 404)
})

test('storage API rejects cross-origin writes and malformed or oversized bounded bodies', async (t) => {
  current = fixture()
  authenticate(t)
  for (const origin of ['https://attacker.test', 'null', 'https://dailywork.test.attacker.test']) {
    assert.equal((await route.POST(post({ action: 'createSession', summary: 'No' }, origin))).status, 403)
  }
  const malformed = new Request('https://dailywork.test/api/ai-chat/storage', { method: 'POST', body: '[' })
  assert.equal((await route.POST(malformed)).status, 400)
  assert.equal((await route.POST(post([]))).status, 400)
  assert.equal((await route.POST(post({ action: 'createSession', summary: 'x'.repeat(MAX_AI_CHAT_BODY_BYTES) }))).status, 413)
  const declared = post({ action: 'createSession', summary: 'Small' })
  declared.headers.set('content-length', String(MAX_AI_CHAT_BODY_BYTES + 1))
  assert.equal((await route.POST(declared)).status, 413)
  assert.equal(current.transactionCalls, 0)
})

test('storage API accepts SITE_BASE_URL browser Origin when Next request URL uses localhost', async (t) => {
  current = fixture()
  authenticate(t)
  const previous = process.env.SITE_BASE_URL
  process.env.SITE_BASE_URL = 'http://127.0.0.1:3000'
  t.after(() => {
    if (previous === undefined) delete process.env.SITE_BASE_URL
    else process.env.SITE_BASE_URL = previous
  })
  const request = (origin: string) => new Request('http://localhost:3000/api/ai-chat/storage', {
    method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ action: 'createSession', summary: 'Browser regression' }),
  })
  assert.equal((await route.POST(request('http://127.0.0.1:3000'))).status, 200)
  assert.equal((await route.POST(request('http://localhost:3000'))).status, 200)
  const denied = await route.POST(request('https://attacker.test'))
  assert.equal(denied.status, 403)
  assert.match((await denied.json()).message, /Cross-origin/)
})

test('storage API accepts import IDs and create-only memories without trusting forged ownership', async (t) => {
  current = fixture()
  authenticate(t)
  const importId = randomUUID()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await route.POST(post({ action: 'createSession', summary: 'Local title', importId, userId: 2 }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).session.id, importId)
  }
  assert.equal(current.sessions.find((row) => row.id === importId)?.userId, 1)
  assert.equal((await route.POST(post({ action: 'createSession', summary: 'Collision', importId: foreignId }))).status, 409)
  current.memories = [memory()]
  assert.equal((await route.POST(post({ action: 'saveMemory', scopeType: 'global', scopeKey: 'global', patch: { content: 'Old' }, onlyIfMissing: true }))).status, 200)
  assert.equal(current.memories[0].content, 'Memory')
})

test('storage API does not expose internal database errors', async (t) => {
  current = fixture()
  authenticate(t)
  current.dbFailure = true
  t.mock.method(console, 'error', () => undefined)
  const response = await route.GET(get('action=sessions'))
  assert.equal(response.status, 500)
  assert.doesNotMatch(JSON.stringify(await response.json()), /sensitive database detail/)
})

test('remote adapter mirrors store signatures without sending authority or client timestamps', async (t) => {
  const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = []
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ url, init, body })
    const action = body?.action ?? new URL(url, 'https://dailywork.test').searchParams.get('action')
    const result = action === 'sessions' ? { sessions: [session()] }
      : action === 'messages' ? { messages: [message(106)], hasMore: true, nextBeforeId: 106 }
      : action === 'memory' ? { memory: null }
      : action === 'saveMemory' ? { memory: { ...memory(), id: 'global:global' } }
      : action === 'appendMessage' ? { message: message(1) }
      : { session: session(), ok: true }
    return Response.json(result)
  })
  await remote.createSession(999, 'New')
  await remote.createImportedSession(999, sessionId, 'Local title')
  assert.deepEqual(calls.at(-1)!.body, { action: 'createSession', importId: sessionId, summary: 'Local title' })
  await remote.listSessions(999)
  const page = await remote.listMessages(999, sessionId)
  assert.equal(page.length, 1)
  assert.equal(page.hasMore, true)
  assert.equal(page.nextBeforeId, 106)
  await remote.listMessages(999, sessionId, { beforeId: 106, limit: 50 })
  assert.match(calls.at(-1)!.url, /beforeId=106&limit=50/)
  const input = { sessionId, role: 'user' as const, content: 'Hello', createdAt: '2099' }
  await remote.appendMessage(999, input)
  await remote.appendMessage(999, input)
  assert.deepEqual(calls.at(-1)!.body, calls.at(-2)!.body)
  await remote.appendMessage(999, { ...input, clientKey: 'explicit-retry-key' })
  assert.equal((calls.at(-1)!.body!.message as { clientKey: string }).clientKey, 'explicit-retry-key')
  await remote.updateSession(999, sessionId, { summary: 'New', updatedAt: '2099', id: foreignId })
  assert.deepEqual(calls.at(-1)!.body!.patch, { summary: 'New' })
  await remote.deleteSession(999, sessionId)
  assert.equal(await remote.getMemory(999, 'global', 'global'), undefined)
  await remote.saveMemory(999, 'global', 'global', { content: 'Saved', id: 'forged', updatedAt: '2099' })
  assert.deepEqual(calls.at(-1)!.body!.patch, { content: 'Saved' })
  await remote.saveMemory(999, 'global', 'global', { content: 'Imported' }, { onlyIfMissing: true })
  assert.equal(calls.at(-1)!.body!.onlyIfMissing, true)
  for (const call of calls) {
    assert.equal(call.init?.credentials, 'same-origin')
    assert.equal(call.init?.cache, 'no-store')
    assert.equal(call.init?.redirect, 'error')
    assert.doesNotMatch(JSON.stringify(call), /userId|2099|forged/)
  }
})

test('remote adapter throws on failed HTTP, invalid JSON, and network failures without fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Denied' }, { status: 403 }))
  await assert.rejects(() => remote.listSessions(1), (error: unknown) => error instanceof remote.AiChatStorageError && error.status === 403)
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Login</html>'))
  await assert.rejects(() => remote.listSessions(1), /Invalid AI chat storage response/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({}))
  await assert.rejects(() => remote.getMemory(1, 'global', 'global'), /Invalid AI chat storage response/)
  await assert.rejects(() => remote.listSessions(1), /Invalid AI chat storage response/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ messages: [], hasMore: true }))
  await assert.rejects(() => remote.listMessages(1, sessionId), /Invalid AI chat storage response/)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline') })
  await assert.rejects(() => remote.getMemory(1, 'global', 'global'), /offline/)
})
