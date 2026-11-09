import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import test, { after, afterEach, beforeEach } from 'node:test'

import type { AiChatJob, Prisma, PrismaClient } from '@prisma/client'
import type { ChatMessage, ModelAdapter, ModelResponsePayload } from '../lib/ai-chat/types'

const loadModule = createRequire(import.meta.url)
const headers = loadModule('next/headers') as { cookies: () => Promise<unknown> }
const nextServer = loadModule('next/server') as typeof import('next/server')
const now = new Date('2026-11-09T00:00:00.000Z')
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
const sessionId = uuid(100)
const foreignSessionId = uuid(200)
const otherSessionId = uuid(300)
const fullGrants = ['ai-chat:view', 'material:view', 'material:create', 'signature:use']
const readGrants = ['ai-chat:view', 'material:view']
const pdf = Buffer.from('%PDF-1.7\npermission-matrix-fixture\n%%EOF')
const bucket = 'permission-matrix-private'

const planFixture = () => ({
  id: 11,
  title: 'Permission matrix plan',
  project: { id: 1, name: 'Fixture project', code: 'fixture-project' },
  updatedAt: now,
  items: [{ id: 101, planId: 11, sortOrder: 0, status: 'planned', supplier: 'Before', updatedAt: now }],
})

// Prepare persisted input independently; no authorization or workflow helper is mocked.
const versionOf = (plan: ReturnType<typeof planFixture>) => createHash('sha256').update(JSON.stringify(
  plan,
  (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
    : value,
)).digest('hex')

const jobFixture = (id: number, patch: Partial<AiChatJob> = {}): AiChatJob => ({
  id: uuid(id), userId: 1, sessionId, requestKey: `fixture-${id}`, kind: 'WEEKLY_PDF', status: 'SUCCEEDED',
  input: { planId: 11, version: versionOf(planFixture()), title: `Fixture ${id}`, signed: false },
  result: { fileAssetId: 11, generated: true, message: `Result ${id}` }, error: null,
  expiresAt: new Date(Date.now() + 60 * 60_000), leaseToken: null, leaseUntil: null,
  attempts: 0, createdAt: now, updatedAt: now, ...patch,
})
const pdfJob = (patch: Record<string, Prisma.JsonValue> = {}, status = 'CONFIRMATION_REQUIRED') => jobFixture(9, {
  status, result: null,
  input: { planId: 11, version: versionOf(planFixture()), title: 'PDF preview', signed: false, ...patch },
})
const permission = (code: string, status = 'ACTIVE') => ({ permission: { code, status } })
const userFixture = (id: number, grants = fullGrants) => ({
  id, username: `fixture-user-${id}`, employmentStatus: 'ACTIVE',
  roles: [{ role: { name: 'Member', permissions: grants.map((code) => permission(code)) } }],
})
type CookieIdentity = {
  id: number
  username: string
  nationality: null
  roles: Array<{ id: number; name: string }>
  permissions: string[]
  issuedAt: number
}
type Where = Record<string, unknown>
type Query = { where?: Where; data?: Record<string, unknown>; take?: number }

// The double only models query matching and persistence, never permission decisions.
const matches = (row: object, where: Where = {}): boolean => Object.entries(where).every(([key, expected]) => {
  if (key === 'AND' || key === 'OR' || key === 'NOT') {
    const conditions = (Array.isArray(expected) ? expected : [expected]) as Where[]
    if (key === 'AND') return conditions.every((condition) => matches(row, condition))
    if (key === 'OR') return conditions.some((condition) => matches(row, condition))
    return conditions.every((condition) => !matches(row, condition))
  }
  const actual = (row as Where)[key]
  if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime()
  if (expected && typeof expected === 'object') {
    const condition = expected as Where
    if ('in' in condition) return (condition.in as unknown[]).includes(actual)
    if ('notIn' in condition) return !(condition.notIn as unknown[]).includes(actual)
    if ('path' in condition) {
      const nested = (condition.path as string[]).reduce<unknown>((value, part) => (value as Where)?.[part], actual)
      return nested === condition.equals
    }
    if ('equals' in condition) return actual === condition.equals
    if ('startsWith' in condition) return typeof actual === 'string' && actual.startsWith(String(condition.startsWith))
    if ('not' in condition) return !matches({ value: actual }, { value: condition.not })
    return !!actual && typeof actual === 'object' && matches(actual, condition)
  }
  return actual === expected
})

const newState = () => ({
  identity: {
    id: 1, username: 'stale-cookie-name', nationality: null, roles: [], permissions: [...fullGrants], issuedAt: 0,
  } as CookieIdentity | null,
  users: [userFixture(1), userFixture(2)],
  activePermissions: new Set(fullGrants),
  jobs: [
    jobFixture(1, { kind: 'WEEKLY_PLAN_CHANGE', status: 'CONFIRMATION_REQUIRED', result: null, input: {
      planId: 11, version: versionOf(planFixture()), title: 'Change preview',
      operations: [{ type: 'update', itemId: 101, changes: { supplier: 'After' } }],
    } }),
    jobFixture(2),
    jobFixture(3, { input: { planId: 11, signed: true, title: 'SIGNED_PREVIEW_SECRET' },
      result: { fileAssetId: 12, generated: true, message: 'SIGNED_RESULT_SECRET' }, error: 'SIGNED_ERROR_SECRET' }),
    jobFixture(4, { status: 'FAILED' }),
    jobFixture(5, { status: 'QUEUED', input: { planId: 11, signed: true, title: 'SIGNED_QUEUED_SECRET' }, result: null }),
    jobFixture(6, { userId: 2, sessionId: foreignSessionId, input: { title: 'FOREIGN_JOB_SECRET' } }),
    jobFixture(7, { sessionId: otherSessionId }),
    jobFixture(8, { status: 'FAILED', attempts: 1 }),
    pdfJob(),
  ],
  plan: planFixture(),
  calls: [] as string[],
  writes: [] as string[],
  effects: [] as string[],
  downloads: [] as string[],
  scheduled: [] as unknown[],
  modelScript: null as ModelResponsePayload[] | null,
  modelMessages: [] as ChatMessage[][],
})
let state = newState()
const forbidden = (name: string) => (..._args: unknown[]): never => {
  state.effects.push(name)
  throw new Error(`Permission test blocked external/unmodeled operation: ${name}`)
}
const guarded = <T extends object>(value: T, name: string): T => new Proxy(value, {
  get(target, key, receiver) {
    if (Reflect.has(target, key) || typeof key === 'symbol' || key === 'then') return Reflect.get(target, key, receiver)
    return forbidden(`${name}.${String(key)}`)
  },
})
const record = (name: string) => { state.calls.push(name) }
const write = (name: string) => { record(name); state.writes.push(name) }
const findJob = ({ where }: Query) => state.jobs.find((job) => matches(job, where)) ?? null
const aiChatJob = guarded({
  findFirst: async (args: Query) => { record('job.findFirst'); return structuredClone(findJob(args)) },
  findUnique: async (args: Query) => { record('job.findUnique'); return structuredClone(findJob(args)) },
  findUniqueOrThrow: async (args: Query) => {
    record('job.findUniqueOrThrow')
    const job = findJob(args)
    assert.ok(job, 'Fixture job must exist')
    return structuredClone(job)
  },
  findMany: async ({ where, take }: Query) => {
    record('job.findMany')
    return structuredClone(state.jobs.filter((job) => matches(job, where)).slice(0, take ?? Infinity))
  },
  updateMany: async ({ where, data }: Query) => {
    write('job.updateMany')
    const jobs = state.jobs.filter((job) => matches(job, where))
    jobs.forEach((job) => Object.assign(job, data))
    return { count: jobs.length }
  },
  update: async (args: Query) => {
    write('job.update')
    const job = findJob(args)
    assert.ok(job)
    Object.assign(job, args.data)
    return structuredClone(job)
  },
}, 'prisma.aiChatJob')
const db = guarded({
  user: guarded({ findUnique: async ({ where }: Query) => {
    record('user.findUnique')
    return structuredClone(state.users.find((user) => matches(user, where)) ?? null)
  } }, 'prisma.user'),
  permission: guarded({
    findMany: async () => { record('permission.findMany'); return Array.from(state.activePermissions).map((code) => ({ code, status: 'ACTIVE' })) },
    findUnique: async ({ where }: Query) => {
      record('permission.findUnique')
      return state.activePermissions.has(String(where?.code)) ? { code: where?.code, status: 'ACTIVE' } : null
    },
  }, 'prisma.permission'),
  aiChatJob,
  aiChatSession: guarded({ findFirst: async ({ where }: Query) => {
    record('session.findFirst')
    return [{ id: sessionId, userId: 1 }, { id: foreignSessionId, userId: 2 }, { id: otherSessionId, userId: 1 }]
      .find((session) => matches(session, where)) ?? null
  } }, 'prisma.aiChatSession'),
  weeklyDeliveryPlan: guarded({
    findUnique: async ({ where }: Query) => { record('plan.findUnique'); return matches(state.plan, where) ? structuredClone(state.plan) : null },
    update: async ({ data }: Query) => { write('plan.update'); return { ...structuredClone(state.plan), ...data } },
  }, 'prisma.weeklyDeliveryPlan'),
  weeklyDeliveryPlanItem: guarded({
    updateMany: async ({ where, data }: Query) => {
      write('planItem.updateMany')
      const rows = state.plan.items.filter((item) => matches(item, where))
      rows.forEach((item) => Object.assign(item, data))
      return { count: rows.length }
    },
    findMany: async ({ where }: Query) => structuredClone(state.plan.items.filter((item) => matches(item, where))),
  }, 'prisma.weeklyDeliveryPlanItem'),
  aiChatMessage: guarded({ upsert: async (args: unknown) => { write('message.upsert'); return args } }, 'prisma.aiChatMessage'),
  fileAsset: guarded({ findFirst: async ({ where }: Query) => {
    record('file.findFirst')
    const files = [11, 12].map((id) => ({
      id, ownerUserId: 1, createdById: 1, bucket, category: 'attachment', mimeType: 'application/pdf',
      storageKey: `files/attachment/ai-chat/1/${id}.pdf`, originalName: `fixture-${id}.pdf`, checksum: null,
    }))
    return files.find((file) => matches(file, where)) ?? null
  } }, 'prisma.fileAsset'),
  $transaction: async <T>(callback: (client: PrismaClient) => Promise<T>) => {
    record('transaction')
    const before = structuredClone({ jobs: state.jobs, plan: state.plan })
    try { return await callback(db as unknown as PrismaClient) }
    catch (error) { state.jobs = before.jobs; state.plan = before.plan; throw error }
  },
}, 'prisma')

// Install doubles before dynamic imports, following aiChatStorage.test.ts. The
// entire Prisma export is replaced, so even a regression cannot reach a real DB.
const cacheEntries = new Map<string, NodeJS.Module | undefined>()
const mockModule = (specifier: string, exports: unknown) => {
  const id = loadModule.resolve(specifier)
  cacheEntries.set(id, loadModule.cache[id])
  loadModule.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
mockModule('server-only', {})
mockModule('../lib/prisma', { prisma: db })
mockModule('../lib/server/r2', {
  getR2Config: () => ({ bucket }),
  downloadObjectBuffer: async (key: string) => { state.downloads.push(key); return pdf },
  uploadObjectBuffer: forbidden('R2 upload'), deleteObject: forbidden('R2 delete'), createPresignedUrl: forbidden('R2 signing'),
})
mockModule('../lib/server/weeklyPlanPdfExport', {
  buildWeeklyPlanPdf: forbidden('PDF generation'), getWeeklyPlanVersion: forbidden('PDF version lookup'),
})
mockModule('../lib/server/aiChatJobWorker', { runOneAiPdfJob: forbidden('background worker') })
const model: ModelAdapter = {
  name: 'offline-permission-fixture',
  generate: async ({ messages }) => {
    if (!state.modelScript) return forbidden('unexpected model execution')()
    state.modelMessages.push(structuredClone(messages))
    const response = state.modelScript.shift()
    assert.ok(response, 'The fixed model script must not be exhausted')
    return { content: JSON.stringify(response) }
  },
}
mockModule('../lib/ai-chat/adapters/dailywork', {
  getDailyworkChatAdapter: () => model,
  getDailyworkChatTools: () => (loadModule('../lib/ai-chat/adapters/dailywork/tools') as typeof import('../lib/ai-chat/adapters/dailywork/tools')).buildDailyworkTools(),
})

const listRoute = loadModule('../app/api/ai-chat/jobs/route') as typeof import('../app/api/ai-chat/jobs/route')
const actionRoute = loadModule('../app/api/ai-chat/jobs/[id]/route') as typeof import('../app/api/ai-chat/jobs/[id]/route')
const artifactRoute = loadModule('../app/api/ai-chat/jobs/[id]/artifact/route') as typeof import('../app/api/ai-chat/jobs/[id]/artifact/route')
const chatRoute = loadModule('../app/api/ai-chat/route') as typeof import('../app/api/ai-chat/route')
const streamRoute = loadModule('../app/api/ai-chat/stream/route') as typeof import('../app/api/ai-chat/stream/route')

after(() => {
  cacheEntries.forEach((previous, id) => {
    if (previous) loadModule.cache[id] = previous
    else delete loadModule.cache[id]
  })
})
beforeEach((t) => {
  assert.ok('mock' in t, 'This hook must run with a per-test context')
  state = newState()
  t.mock.method(headers, 'cookies', async () => ({ get: (name: string) => {
    assert.equal(name, 'dw-session')
    if (!state.identity) return undefined
    const body = Buffer.from(JSON.stringify(state.identity)).toString('base64url')
    const signature = createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret').update(body).digest('base64url')
    return { value: `${body}.${signature}` }
  } }))
  t.mock.method(nextServer, 'after', (callback: unknown) => { state.scheduled.push(callback) })
  t.mock.method(globalThis, 'fetch', forbidden('network fetch'))
})
afterEach(() => {
  assert.deepEqual(state.effects, [], 'No external model, worker, network, unmodeled Prisma, or external side effect is allowed')
})

const grant = (permissions: string[]) => {
  state.users[0].roles = [{ role: { name: 'Member', permissions: permissions.map((code) => permission(code)) } }]
}
const callList = (id = sessionId) => listRoute.GET(new Request(`https://dailywork.test/api/ai-chat/jobs?sessionId=${id}`))
const callAction = (action: string, id = uuid(1), extra: Record<string, unknown> = {}) => actionRoute.POST(
  new Request(`https://dailywork.test/api/ai-chat/jobs/${id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://dailywork.test' },
    body: JSON.stringify({ action, ...extra }),
  }), { params: Promise.resolve({ id }) },
)
const callArtifact = (id = uuid(2)) => artifactRoute.GET(
  new Request(`https://dailywork.test/api/ai-chat/jobs/${id}/artifact`), { params: Promise.resolve({ id }) },
)
const endpoints = [
  { name: 'list', run: () => callList() },
  { name: 'confirm', run: () => callAction('confirm') },
  { name: 'retry', run: () => callAction('retry', uuid(8)) },
  { name: 'cancel', run: () => callAction('cancel') },
  { name: 'artifact', run: () => callArtifact() },
]
const businessEndpoints = endpoints.filter(({ name }) => name !== 'cancel')
const denied = async (response: Response, expected = 403) => {
  assert.equal(response.status, expected, await response.clone().text())
  const body = await response.text()
  assert.doesNotMatch(body, /SIGNED_\w+_SECRET|LEGACY_TASK_SECRET|FOREIGN_JOB_SECRET|fileAssetId|Before|After/)
  assert.deepEqual(state.writes, [], 'Rejected requests must not attempt a write')
  assert.deepEqual(state.downloads, [], 'Rejected requests must not load artifact bytes')
  assert.deepEqual(state.scheduled, [], 'Rejected requests must not schedule a worker')
}

for (const status of ['CONFIRMATION_REQUIRED', 'QUEUED', 'RUNNING', 'FAILED', 'CANCELLED']) {
  test(`PDF checkpoint is private until final validation succeeds: ${status}`, async () => {
    state.jobs = [jobFixture(2, { status })]
    const response = await callList()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).jobs[0].capabilities.download, false)
    await denied(await callArtifact(), 409)
  })
}

for (const { name, run } of endpoints) {
  test(`permission matrix: ${name} rejects unauthenticated callers`, async () => {
    state.identity = null
    await denied(await run(), 401)
  })
  if (name !== 'cancel') {
    test(`permission matrix: ${name} rejects AI-only without business permission`, async () => {
      grant(['ai-chat:view'])
      await denied(await run())
    })
  }
  test(`permission matrix: ${name} rejects business-only without ai-chat:view despite stale cookie`, async () => {
    grant(fullGrants.filter((code) => code !== 'ai-chat:view'))
    await denied(await run())
  })
}

test('read-only actor cannot confirm business changes or forge cookie/body capabilities', async () => {
  grant(readGrants)
  await denied(await callAction('confirm', uuid(1), {
    userId: 2, permissions: fullGrants, capabilities: { confirm: true, cancel: true, retry: true, download: true },
  }))
  assert.equal(state.plan.items[0].supplier, 'Before')
  assert.equal(state.jobs[0].status, 'CONFIRMATION_REQUIRED')
})

for (const action of ['confirm', 'retry', 'artifact'] as const) {
  test(`signed PDF: ${action} rejects missing signature:use`, async () => {
    grant(fullGrants.filter((code) => code !== 'signature:use'))
    state.jobs = [pdfJob({ signed: true }, action === 'retry' ? 'FAILED' : action === 'artifact' ? 'SUCCEEDED' : 'CONFIRMATION_REQUIRED')]
    if (action === 'artifact') state.jobs[0].result = { fileAssetId: 12 }
    await denied(await (action === 'artifact' ? callArtifact(uuid(9)) : callAction(action, uuid(9))))
  })
}

test('legacy telegram:true proposal is rejected rather than converted into a website send', async () => {
  const { buildWorkflowTools } = loadModule('../lib/ai-chat/adapters/dailywork/workflowTools') as typeof import('../lib/ai-chat/adapters/dailywork/workflowTools')
  const tool = buildWorkflowTools().find((entry) => entry.name === 'request_weekly_plan_pdf')
  assert.ok(tool)
  const before = structuredClone(state.jobs)
  const result = await tool.handler({ planId: 11, signed: false, telegram: true }, {
    locale: 'zh', session: { id: 1, username: 'fixture-user-1', permissions: fullGrants },
    workflow: { requestId: 'legacy-proposal', sessionId },
  })
  assert.equal(result.ok, false)
  assert.equal(result.jobId, undefined)
  assert.deepEqual(state.jobs, before)
  assert.deepEqual(state.writes, [])
  assert.deepEqual(state.downloads, [])
  assert.deepEqual(state.scheduled, [])
})

for (const action of ['confirm', 'retry', 'artifact'] as const) {
  test(`legacy telegram:true persisted job: ${action} denies even with full current website grants`, async () => {
    state.jobs = [pdfJob({ telegram: true }, action === 'retry' ? 'FAILED' : action === 'artifact' ? 'SUCCEEDED' : 'CONFIRMATION_REQUIRED')]
    if (action === 'artifact') state.jobs[0].result = { fileAssetId: 11 }
    await denied(await (action === 'artifact' ? callArtifact(uuid(9)) : callAction(action, uuid(9))))
  })
}

test('legacy telegram:true persisted job is hidden from list input, result, error and capabilities', async () => {
  state.jobs.push({ ...pdfJob({ telegram: true, title: 'LEGACY_TASK_SECRET' }), id: uuid(10), requestKey: 'fixture-10' })
  const response = await callList()
  assert.equal(response.status, 200)
  const raw = await response.text()
  assert.doesNotMatch(raw, /LEGACY_TASK_SECRET|"telegram"/)
  assert.ok(!(JSON.parse(raw) as { jobs: Array<{ id: string }> }).jobs.some((job) => job.id === uuid(10)))
  assert.deepEqual(state.writes, [])
})

for (const [label, grants, hiddenIds, hiddenData] of [
  ['no signature', fullGrants.filter((code) => code !== 'signature:use'), [3, 5], /SIGNED_/],
  ['read only', readGrants, [1, 3, 5], /SIGNED_|Change preview/],
] as const) {
  test(`job list filters inaccessible task data: ${label}`, async () => {
    grant([...grants])
    const response = await callList()
    assert.equal(response.status, 200, await response.clone().text())
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const raw = await response.text()
    const body = JSON.parse(raw) as { jobs: Array<{ id: string }> }
    assert.ok(body.jobs.some((job) => job.id === uuid(2)), 'An authorized unsigned job must remain visible')
    for (const id of hiddenIds) assert.ok(!body.jobs.some((job) => job.id === uuid(id)), `Task ${id} must not be listed`)
    assert.doesNotMatch(raw, hiddenData, 'Task input, result and error must not leak through listing')
    assert.ok(body.jobs.every((job) => ![uuid(6), uuid(7)].includes(job.id)))
    assert.deepEqual(state.writes, [])
  })
}

for (const action of ['confirm', 'retry', 'cancel', 'artifact'] as const) {
  for (const target of ['foreign owner', 'unknown job'] as const) {
    test(`ownership: ${action} rejects ${target} even with full grants and forged owner`, async () => {
      const id = target === 'foreign owner' ? uuid(6) : uuid(999)
      const before = structuredClone(state.jobs)
      const response = action === 'artifact' ? await callArtifact(id) : await callAction(action, id, { userId: 2 })
      assert.ok([404, 409].includes(response.status), await response.clone().text())
      assert.deepEqual(state.jobs, before)
      assert.deepEqual(state.downloads, [])
      assert.deepEqual(state.scheduled, [])
      assert.ok(state.writes.every((method) => method === 'job.updateMany'), 'No business mutation is permitted')
      assert.doesNotMatch(await response.text(), /FOREIGN_JOB_SECRET|fileAssetId/)
    })
  }
}

test('list does not reveal another owner\'s jobs for a guessed session ID', async () => {
  const response = await callList(foreignSessionId)
  assert.ok([200, 404].includes(response.status), await response.clone().text())
  if (response.status === 200) assert.deepEqual((await response.json()).jobs, [])
  assert.deepEqual(state.writes, [])
})

for (const action of ['retry', 'artifact'] as const) {
  test(`wrong job kind: ${action} cannot treat a change job as a PDF`, async () => {
    const before = structuredClone(state.jobs)
    await denied(await (action === 'retry' ? callAction(action) : callArtifact(uuid(1))), 404)
    assert.deepEqual(state.jobs, before)
  })
}

test('current DB AI grant revocation applies to the next request with the identical signed cookie', async () => {
  assert.equal((await callList()).status, 200)
  const cookie = structuredClone(state.identity)
  grant(fullGrants.filter((code) => code !== 'ai-chat:view'))
  for (const { run } of endpoints) await denied(await run())
  assert.deepEqual(state.identity, cookie)
  assert.ok(state.calls.filter((method) => method === 'user.findUnique').length >= endpoints.length + 1)
})

test('current DB business grant revocation applies to the next request, not stale cookie grants', async () => {
  assert.equal((await callList()).status, 200)
  grant(['ai-chat:view'])
  for (const { run } of businessEndpoints) await denied(await run())
  assert.ok(state.identity!.permissions.includes('material:view'))
})

test('archived DB grants do not authorize business confirmation', async () => {
  state.users[0].roles[0].role.permissions.find(({ permission }) => permission.code === 'material:create')!.permission.status = 'ARCHIVED'
  await denied(await callAction('confirm'))
})

test('DB signature revocation hides persisted tasks and denies confirm/retry with the same cookie', async () => {
  state.jobs = [pdfJob({ signed: true })]
  assert.ok((await (await callList()).json()).jobs.some((job: { id: string }) => job.id === uuid(9)))
  const cookie = structuredClone(state.identity)
  grant(fullGrants.filter((code) => code !== 'signature:use'))
  const listed = await callList()
  assert.equal(listed.status, 200)
  assert.deepEqual((await listed.json()).jobs, [])
  await denied(await callAction('confirm', uuid(9)))
  state.jobs[0].status = 'FAILED'
  await denied(await callAction('retry', uuid(9)))
  assert.deepEqual(state.identity, cookie)
})

for (const [label, route] of [['JSON', chatRoute], ['stream', streamRoute]] as const) {
  test(`AI entrypoint ${label}: missing DB ai-chat:view denies before model, context or persistence`, async () => {
    grant(['material:view', 'material:create', 'signature:use'])
    await denied(await route.POST(new Request('https://dailywork.test/api/ai-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://dailywork.test' },
      body: JSON.stringify({ input: 'Export the weekly plan', sessionId }),
    })))
    assert.deepEqual(state.calls, ['user.findUnique'])
  })

  test(`AI entrypoint ${label}: AI-only cannot read business data through forced model tool calls`, async (t) => {
    grant(['ai-chat:view'])
    t.mock.method(console, 'info', () => undefined)
    state.modelScript = [
      { type: 'tool_call', tool: 'list_active_members', arguments: { projectId: 2 } },
      { type: 'tool_call', tool: 'get_weekly_plan_snapshot', arguments: { planId: 11 } },
      { type: 'tool_call', tool: 'call_api', arguments: { key: 'get:/api/finance/insights' } },
      { type: 'final', answer: 'No authorized business data is available.' },
    ]
    const response = await route.POST(new Request('https://dailywork.test/api/ai-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://dailywork.test' },
      body: JSON.stringify({
        input: 'Read another account\'s members, plan and finance records.',
        userId: 2, permissions: fullGrants,
      }),
    }))
    assert.equal(response.status, 200, await response.clone().text())
    const raw = await response.text()
    assert.doesNotMatch(raw, /FOREIGN_JOB_SECRET|SIGNED_\w+_SECRET|fileAssetId|Fixture project|Before|"type":"error"/)
    const messages = state.modelMessages.at(-1) ?? []
    const results = messages.filter((message) => message.content.startsWith('TOOL_RESULT '))
      .map((message) => JSON.parse(message.content.slice(message.content.indexOf(': ') + 2)) as { ok: boolean; error?: string; data?: unknown })
    assert.equal(results.length, 3, 'The fixed adapter must actually attempt each forbidden business read')
    for (const result of results) {
      assert.equal(result.ok, false)
      assert.ok(['tool_not_allowed', 'permission_denied'].includes(result.error ?? ''))
      assert.equal(result.data, undefined)
    }
    assert.ok(state.calls.every((method) => method === 'user.findUnique'), 'No business DB query may run')
    assert.deepEqual(state.writes, [])
    assert.deepEqual(state.downloads, [])
    assert.deepEqual(state.scheduled, [])
  })

  test(`AI entrypoint ${label}: a guessed foreign conversation cannot disclose another user's history`, async (t) => {
    grant(['ai-chat:view'])
    t.mock.method(console, 'error', () => undefined)
    const response = await route.POST(new Request('https://dailywork.test/api/ai-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://dailywork.test' },
      body: JSON.stringify({ input: 'Summarize this saved conversation.', sessionId: foreignSessionId, userId: 2 }),
    }))
    assert.ok(response.status >= 400, await response.clone().text())
    assert.doesNotMatch(await response.text(), /FOREIGN_JOB_SECRET|SIGNED_\w+_SECRET|fileAssetId/)
    assert.ok(state.calls.includes('session.findFirst'), 'The real conversation store must check ownership')
    assert.deepEqual(state.modelMessages, [], 'Foreign history is rejected before any model execution')
    assert.deepEqual(state.writes, [])
    assert.deepEqual(state.downloads, [])
  })
}

test('authorized list is owner/session scoped and read-only capabilities are server-derived', async () => {
  grant(readGrants)
  const response = await callList()
  assert.equal(response.status, 200)
  const body = await response.json()
  const change = body.jobs.find((job: { id: string }) => job.id === uuid(1))
  const ready = body.jobs.find((job: { id: string }) => job.id === uuid(2))
  assert.equal(change, undefined, 'Strict job listing hides change previews without current material:create')
  assert.equal(ready.capabilities?.download, true)
  assert.equal(ready.capabilities?.retry, false)
  assert.equal(ready.capabilities?.cancel, false)
  const waiting = body.jobs.find((job: { id: string }) => job.id === uuid(9))
  assert.equal(waiting?.capabilities?.confirm, true, 'A read-only actor can generate an unsigned PDF')
  assert.equal(waiting?.capabilities?.cancel, true)
  assert.equal(waiting?.capabilities?.download, false)
  const failed = body.jobs.find((job: { id: string }) => job.id === uuid(4))
  assert.equal(failed?.capabilities?.retry, true)
  for (const job of body.jobs) {
    for (const key of ['confirm', 'cancel', 'retry', 'download']) assert.equal(typeof job.capabilities?.[key], 'boolean')
  }
})

test('capabilities stop offering business confirmation when DB create permission is revoked', async () => {
  const initial = await (await callList()).json()
  assert.equal(initial.jobs.find((job: { id: string }) => job.id === uuid(1))?.capabilities?.confirm, true)
  grant(fullGrants.filter((code) => code !== 'material:create'))
  const next = await (await callList()).json()
  const change = next.jobs.find((job: { id: string }) => job.id === uuid(1))
  assert.equal(change, undefined, 'A stale cookie cannot keep change previews visible')
  await denied(await callAction('confirm'))
})

test('authorized business editor can confirm a change through the route with only in-memory writes', async () => {
  grant(['ai-chat:view', 'material:view', 'material:create'])
  const response = await callAction('confirm')
  assert.equal(response.status, 200, await response.clone().text())
  const body = await response.json()
  assert.equal(body.job.status, 'SUCCEEDED')
  assert.equal(state.plan.items[0].supplier, 'After')
  assert.equal(state.jobs[0].status, 'SUCCEEDED')
  assert.ok(state.writes.includes('planItem.updateMany'))
  assert.deepEqual(state.scheduled, [])
})

test('read-only actor may confirm an unsigned download-only PDF without create or signature grants', async () => {
  grant(readGrants)
  state.jobs = [pdfJob()]
  const response = await callAction('confirm', uuid(9))
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).job.status, 'QUEUED')
  assert.equal(state.jobs[0].status, 'QUEUED')
  assert.equal(state.scheduled.length, 1, 'Worker is recorded, never executed')
  assert.ok(state.writes.every((method) => method === 'job.updateMany'))
})

test('authorized retry queues a FAILED download-only PDF without running a worker', async () => {
  grant(readGrants)
  state.jobs = [pdfJob({}, 'FAILED')]
  const response = await callAction('retry', uuid(9))
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).job.status, 'QUEUED')
  assert.equal(state.scheduled.length, 1)
  assert.deepEqual(state.downloads, [])
})

for (const status of ['DELIVERY_FAILED', 'SUCCEEDED', 'CANCELLED', 'RUNNING']) {
  test(`PDF retry denies ${status}; only FAILED is retryable`, async () => {
    grant(readGrants)
    state.jobs = [pdfJob({}, status)]
    await denied(await callAction('retry', uuid(9)), 409)
  })
}

test('authorized actor can cancel their pending job without touching business rows', async () => {
  const response = await callAction('cancel')
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal(state.jobs[0].status, 'CANCELLED')
  assert.deepEqual(state.writes, ['job.updateMany'])
  assert.deepEqual(state.scheduled, [])
})

for (const status of ['CONFIRMATION_REQUIRED', 'QUEUED']) {
  test(`AI-only owner may cancel ${status} job as metadata cleanup without business access`, async () => {
    grant(['ai-chat:view'])
    state.jobs[0].status = status
    const before = structuredClone(state.plan)
    const response = await callAction('cancel')
    assert.equal(response.status, 200, await response.clone().text())
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(state.jobs[0].status, 'CANCELLED')
    assert.deepEqual(state.plan, before)
    assert.deepEqual(state.writes, ['job.updateMany'])
    assert.deepEqual(state.downloads, [])
    assert.deepEqual(state.scheduled, [])
  })
}

for (const signed of [false, true]) {
  test(`authorized ${signed ? 'signed' : 'unsigned'} artifact download returns only in-memory PDF bytes`, async () => {
    grant([...readGrants, ...(signed ? ['signature:use'] : [])])
    const response = await callArtifact(uuid(signed ? 3 : 2))
    assert.equal(response.status, 200, await response.clone().text())
    assert.equal(response.headers.get('content-type'), 'application/pdf')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf)
    assert.equal(state.downloads.length, 1)
    assert.deepEqual(state.writes, [])
  })
}
