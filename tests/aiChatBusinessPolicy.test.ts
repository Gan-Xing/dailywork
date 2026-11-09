import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { canAccessAiJob, aiJobCapabilities } from '../lib/ai-chat/permissions'
import { buildDailyworkTools } from '../lib/ai-chat/adapters/dailywork/tools'
import { assertAiChatGrantsUnchanged } from '../lib/server/aiChatAccess'
import { buildAiChatInternalCookie } from '../lib/server/aiChatInternalRequest'
import type { ChatSession } from '../lib/ai-chat/types'

const actor = (permissions: string[], roles: string[] = []): ChatSession => ({ id: 1, username: 'fixture', permissions, roles })
const pdf = { kind: 'WEEKLY_PDF', input: { signed: false } }
const change = { kind: 'WEEKLY_PLAN_CHANGE', input: {} }

test('AI and business permissions are independent and neither substitutes for the other', () => {
  for (const grants of [[], ['ai-chat:view'], ['material:view'], ['material:create'], ['signature:use']]) {
    assert.equal(canAccessAiJob(actor(grants), pdf), false)
    assert.equal(canAccessAiJob(actor(grants), change), false)
  }
  const reader = actor(['ai-chat:view', 'material:view'])
  assert.equal(canAccessAiJob(reader, pdf), true)
  assert.equal(canAccessAiJob(reader, change), false)
  assert.equal(canAccessAiJob(reader, { kind: 'WEEKLY_PDF', input: { signed: true } }), false)
  assert.equal(canAccessAiJob(actor([...reader.permissions, 'signature:use']), { kind: 'WEEKLY_PDF', input: { signed: true } }), true)
  assert.equal(canAccessAiJob(actor([...reader.permissions, 'material:create']), change), true)
  assert.equal(canAccessAiJob(actor([...reader.permissions, 'material:create']), { kind: 'SHELL', input: {} }), false)
  assert.equal(canAccessAiJob(actor([...reader.permissions, 'signature:use']), { kind: 'WEEKLY_PDF', input: { telegram: true } }), false)
})

test('server task capabilities fail closed for wrong owners, expired previews and revoked grants', () => {
  const user = actor(['ai-chat:view', 'material:view', 'material:create'])
  const job = { ...change, userId: 1, status: 'CONFIRMATION_REQUIRED', expiresAt: new Date(Date.now() + 60_000), attempts: 0, result: null }
  assert.equal(aiJobCapabilities(user, job).confirm, true)
  assert.equal(aiJobCapabilities(user, { ...job, expiresAt: new Date(0) }).confirm, false)
  assert.equal(aiJobCapabilities(actor(['ai-chat:view', 'material:view']), job).confirm, false)
  assert.deepEqual(aiJobCapabilities(user, { ...job, userId: 2 }), { confirm: false, cancel: false, retry: false, download: false })
  const artifact = { ...job, ...pdf, status: 'SUCCEEDED', result: { fileAssetId: 19 } }
  assert.equal(aiJobCapabilities(user, artifact).download, true)
  assert.equal(aiJobCapabilities(actor(['ai-chat:view']), artifact).download, false)
  for (const status of ['CONFIRMATION_REQUIRED', 'QUEUED', 'RUNNING', 'FAILED', 'CANCELLED']) {
    assert.equal(aiJobCapabilities(user, { ...artifact, status }).download, false, status)
  }
})

test('permission or Admin role removal aborts publication, while added grants never expand an in-flight request', async () => {
  const original = actor(['ai-chat:view', 'finance:view'], ['Admin'])
  await assert.rejects(assertAiChatGrantsUnchanged(original, async () => actor(['ai-chat:view'], ['Admin'])), /Permissions changed/)
  await assert.rejects(assertAiChatGrantsUnchanged(original, async () => actor(original.permissions)), /Permissions changed/)
  assert.equal((await assertAiChatGrantsUnchanged(original, async () => actor([...original.permissions, 'report:view'], ['Admin']))).id, 1)
})

test('AI internal cookies contain only current server-verified roles and grants', () => {
  const current = actor(['ai-chat:view', 'report:view'], ['Supervisor'])
  const cookie = buildAiChatInternalCookie(current)
  const [body, signature] = cookie.slice('dw-session='.length).split('.')
  assert.equal(signature, createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret').update(body).digest('base64url'))
  const identity = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  assert.equal(identity.id, current.id)
  assert.deepEqual(identity.permissions, current.permissions)
  assert.equal(identity.permissions.includes('leader-log:view-all'), false)
  assert.deepEqual(identity.roles, [{ id: 0, name: 'Supervisor' }])
})

test('internal read uses refreshed scope, not the stale browser cookie', async (t) => {
  let forwarded = ''
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    forwarded = new Headers(init?.headers).get('cookie') ?? ''
    return Response.json({ logs: [] })
  })
  const current = actor(['ai-chat:view', 'report:view'], ['Supervisor'])
  const freshCookie = buildAiChatInternalCookie(current)
  const call = buildDailyworkTools().find((tool) => tool.name === 'call_api')!
  const result = await call.handler({ key: 'get:/api/leader-logs', query: { limit: 3 } }, {
    locale: 'zh', session: current,
    permissionChecker: async (permission) => current.permissions.includes(permission),
    request: { origin: 'http://fixture.test', cookie: 'dw-session=STALE_PRIVILEGED_COOKIE', getCookie: async () => freshCookie },
  })
  assert.equal(result.ok, true)
  assert.equal(forwarded, freshCookie)
  assert.doesNotMatch(forwarded, /STALE_PRIVILEGED_COOKIE/)
})

test('read-only API path placeholders cannot escape the approved route', async (t) => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error('Must not fetch') })
  const call = buildDailyworkTools().find((tool) => tool.name === 'call_api')!
  for (const id of ['.', '..', '../leader-logs', 'x/y', 'x\\y', '\u0000']) {
    const result = await call.handler({ key: 'get:/api/weekly-plans/:id', params: { id } }, {
      locale: 'zh', session: actor(['material:view']),
    })
    assert.equal(result.ok, false, id)
  }
  assert.equal(requests, 0)
})

test('revoking a row-scope grant while an internal read runs discards the entire response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ logs: [{ contentRaw: 'OTHER_SUPERVISOR_SECRET' }] }))
  const call = buildDailyworkTools().find((tool) => tool.name === 'call_api')!
  const result = await call.handler({ key: 'get:/api/leader-logs', query: { limit: 3 } }, {
    locale: 'zh', session: actor(['ai-chat:view', 'report:view', 'leader-log:view-all']),
    permissionChecker: async (permission) => permission === 'report:view',
    request: { origin: 'http://fixture.test', assertScope: async () => { throw new Error('Permissions changed') } },
  })
  assert.equal(result.ok, false)
  assert.doesNotMatch(JSON.stringify(result), /OTHER_SUPERVISOR_SECRET/)
})

test('direct road lookup uses the same view/manage grants as the existing road API', () => {
  const tool = buildDailyworkTools().find((entry) => entry.name === 'list_road_sections')!
  assert.deepEqual(tool.requiredPermissions, ['road:view', 'road:manage'])
  assert.equal(tool.permissionMode, 'any')
})
