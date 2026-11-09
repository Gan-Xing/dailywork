import assert from 'node:assert/strict'
import test from 'node:test'

import { dailyworkApiCatalog, type ApiCatalogEntry } from '../lib/ai-chat/adapters/dailywork/apiCatalog'
import {
  getAiChatRequiredPermissions,
  getApprovedAiChatReadKeys,
  isAiChatReadableEntry,
} from '../lib/ai-chat/adapters/dailywork/readPolicy'
import { buildSemanticContext } from '../lib/ai-chat/adapters/dailywork/semanticContext'
import { buildDailyworkTools } from '../lib/ai-chat/adapters/dailywork/tools'
import { createResponsesAdapter, ResponsesAdapterError } from '../lib/ai-chat/adapters/responsesAdapter'
import { getChatLocalDbName } from '../lib/ai-chat/localStore'
import { buildSystemPrompt } from '../lib/ai-chat/prompt'
import { runChat } from '../lib/ai-chat/runtime'
import { collectSuccessfulSources } from '../lib/ai-chat/sources'
import type { ModelAdapter } from '../lib/ai-chat/types'

test('browser chat storage uses a distinct database for each account', () => {
  assert.equal(getChatLocalDbName(1), 'dailywork-ai-chat-user-1')
  assert.equal(getChatLocalDbName(2), 'dailywork-ai-chat-user-2')
  assert.notEqual(getChatLocalDbName(1), 'dailywork-ai-chat')
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => getChatLocalDbName(invalid))
  }
})

test('AI API discovery and calls exclude GET routes with write side effects', async () => {
  const excluded = [
    'get:/api/finance/categories',
    'get:/api/finance/ledger/metadata',
    'get:/api/finance/metadata',
    'get:/api/finance/payment-types',
    'get:/api/finance/projects',
    'get:/api/finance/units',
    'get:/api/payroll-runs',
  ]
  for (const key of excluded) {
    const entry = dailyworkApiCatalog.find((item) => item.key === key)
    assert.ok(entry, `Catalog is missing ${key}`)
    assert.equal(isAiChatReadableEntry(entry), false, key)
  }
  for (const key of ['get:/api/projects', 'get:/api/finance/insights']) {
    const entry = dailyworkApiCatalog.find((item) => item.key === key)
    assert.ok(entry)
    assert.equal(isAiChatReadableEntry(entry), true, key)
  }

  const tools = buildDailyworkTools()
  const list = tools.find((tool) => tool.name === 'list_api_catalog')
  const call = tools.find((tool) => tool.name === 'call_api')
  assert.ok(list)
  assert.ok(call)
  const context = {
    locale: 'zh',
    session: { id: 1, username: 'admin', permissions: ['permission:view', 'finance:view', 'payroll:view'] },
  }
  const catalogResult = await list.handler({ includeAll: true }, context)
  assert.equal(catalogResult.ok, true)
  const visible = catalogResult.data as ApiCatalogEntry[]
  for (const key of excluded) {
    assert.equal(visible.some((entry) => entry.key === key), false, key)
    const result = await call.handler({ key }, context)
    assert.equal(result.error, 'endpoint_not_readable', key)
  }
  assert.equal(visible.some((entry) => entry.key === 'get:/api/finance/insights'), true)

  const semantic = await buildSemanticContext({
    query: '财务分类和发薪批次',
    locale: 'zh',
    permissions: ['finance:view', 'payroll:view'],
    maxEntries: 20,
  })
  assert.equal(semantic.candidates.some((entry) => excluded.includes(entry.key)), false)
})

test('AI read policy fails closed for new and sensitive routes', async () => {
  const catalogMap = new Map(dailyworkApiCatalog.map((entry) => [entry.key, entry]))
  for (const key of getApprovedAiChatReadKeys()) {
    const entry = catalogMap.get(key)
    assert.ok(entry, `Approved route is missing from the catalog: ${key}`)
    assert.equal(isAiChatReadableEntry(entry), true, key)
    assert.ok(getAiChatRequiredPermissions(entry).length > 0, key)
  }
  const projects = catalogMap.get('get:/api/projects')
  assert.ok(projects)
  assert.equal(isAiChatReadableEntry({ ...projects, key: 'get:/api/new-route' }), false)
  for (const key of [
    'get:/api/auth/session',
    'get:/api/auth/users',
    'get:/api/members',
    'get:/api/members/:id/compensation',
    'get:/api/files/:id',
    'get:/api/payroll-runs/:runId',
    'get:/api/log-extractor/config',
  ]) {
    const entry = catalogMap.get(key)
    assert.ok(entry)
    assert.equal(isAiChatReadableEntry(entry), false, key)
  }

  const tools = buildDailyworkTools()
  const list = tools.find((tool) => tool.name === 'list_api_catalog')
  const call = tools.find((tool) => tool.name === 'call_api')
  assert.ok(list)
  assert.ok(call)
  const context = { locale: 'zh', session: { id: 2, username: 'finance', permissions: ['finance:view'] } }
  const catalogResult = await list.handler({}, context)
  assert.equal(catalogResult.ok, true)
  const visible = catalogResult.data as ApiCatalogEntry[]
  assert.equal(visible.some((entry) => entry.key === 'get:/api/finance/insights'), true)
  assert.equal(visible.some((entry) => entry.key === 'get:/api/projects'), false)
  assert.equal(visible.some((entry) => entry.key === 'get:/api/leader-logs'), false)
  const denied = await call.handler({ key: 'get:/api/projects' }, context)
  assert.equal(denied.error, 'permission_denied')
  const debug = await call.handler(
    { key: 'get:/api/leader-logs', query: { debug: '1' } },
    { locale: 'zh', session: { id: 3, username: 'report', permissions: ['report:view'] } },
  )
  assert.equal(debug.error, 'invalid_query_params')
})

test('AI API calls reject non-JSON responses and do not follow redirects', async (t) => {
  let redirectMode: RequestRedirect | undefined
  t.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    redirectMode = init?.redirect
    return new Response('<html>not data</html>', { headers: { 'content-type': 'text/html' } })
  })
  const call = buildDailyworkTools().find((tool) => tool.name === 'call_api')
  assert.ok(call)
  const result = await call.handler(
    { key: 'get:/api/projects' },
    { locale: 'zh', session: { id: 1, username: 'member', permissions: ['member:view'] } },
  )
  assert.equal(result.error, 'unsupported_content_type')
  assert.equal(redirectMode, 'error')
})

test('read-only finance category tool requires finance permission', async () => {
  const tool = buildDailyworkTools().find((item) => item.name === 'list_finance_categories')
  assert.ok(tool)
  assert.deepEqual(tool.requiredPermissions, ['finance:view'])
  const denied = await tool.handler(
    { keyword: '材料' },
    { locale: 'zh', session: { id: 1, username: 'viewer', permissions: [] } },
  )
  assert.equal(denied.error, 'permission_denied')
})

test('finance guidance is included only for a finance-authorized user', () => {
  const denied = buildSystemPrompt({ tools: [], locale: 'zh', canViewFinance: false })
  assert.match(denied, /finance:view permission is required/)
  assert.doesNotMatch(denied, /always call the finance insights API/)
  const allowed = buildSystemPrompt({ tools: [], locale: 'zh', canViewFinance: true })
  assert.match(allowed, /list_finance_categories/)
  assert.match(allowed, /always call the finance insights API/)
  assert.doesNotMatch(denied, /prefer leader logs/)
  const reportAllowed = buildSystemPrompt({ tools: [], locale: 'zh', canViewLeaderLogs: true })
  assert.match(reportAllowed, /prefer leader logs/)
})

test('finance questions without finance permission do not force unavailable API calls', async () => {
  let modelCalls = 0
  const adapter: ModelAdapter = {
    name: 'fixture',
    generate: async () => {
      modelCalls += 1
      return { content: JSON.stringify({ type: 'final', answer: '缺少财务查看权限，无法核实费用。' }) }
    },
  }
  const result = await runChat({
    adapter,
    tools: buildDailyworkTools(),
    session: { id: 1, username: 'viewer', permissions: [] },
    messages: [{ role: 'user', content: '本月费用是多少？' }],
    maxTurns: 2,
  })
  assert.equal(modelCalls, 1)
  assert.equal(result.toolCalls.length, 0)
  assert.match(result.answer, /缺少财务查看权限/)
})

test('Responses adapter sends JSON mode and reads usage from a gateway response', async () => {
  let requestBody: Record<string, unknown> | undefined
  const adapter = createResponsesAdapter({
    baseUrl: 'http://127.0.0.1:8320/v1',
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'http://127.0.0.1:8320/v1/responses')
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key')
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        status: 'completed',
        model: 'test-model',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{"type":"final","answer":"ok"}' }] }],
        usage: { input_tokens: 12, output_tokens: 7, total_tokens: 19 },
      })
    },
  })

  const result = await adapter.generate({
    messages: [{ role: 'user', content: 'test' }],
    responseFormat: 'json_object',
  })
  assert.deepEqual(requestBody?.text, { format: { type: 'json_object' } })
  assert.equal(result.content, '{"type":"final","answer":"ok"}')
  assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 7, totalTokens: 19 })
})

test('Responses adapter rejects unavailable models without exposing upstream details', async () => {
  const adapter = createResponsesAdapter({
    baseUrl: 'http://127.0.0.1:8320/v1',
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async () => Response.json(
      { error: { code: 'auth_unavailable', message: 'private upstream detail' } },
      { status: 503 },
    ),
  })
  await assert.rejects(
    adapter.generate({ messages: [{ role: 'user', content: 'test' }] }),
    (error: unknown) => error instanceof ResponsesAdapterError
      && error.status === 503
      && !error.message.includes('private upstream detail'),
  )
})

test('source links include only successful calls and encode record identifiers', () => {
  const sources = collectSuccessfulSources([
    {
      tool: 'call_api',
      arguments: { key: 'get:/api/reports/:date', params: { date: '2026/10/10' } },
      result: { ok: true, content: 'ok' },
    },
    {
      tool: 'call_api',
      arguments: { key: 'get:/api/finance/insights' },
      result: { ok: false, content: 'denied' },
    },
    {
      tool: 'call_api',
      arguments: { key: 'get:/api/files/:parts*', params: { parts: ['team A', 'report.pdf'] } },
      result: { ok: true, content: 'ok' },
    },
  ])
  assert.deepEqual(sources, [
    { key: 'get:/api/reports/:date', url: '/api/reports/2026%2F10%2F10' },
    { key: 'get:/api/files/:parts*', url: '/api/files/team%20A/report.pdf' },
  ])
})

test('semantic routing finds newly generated read APIs by business terms and respects permissions', async () => {
  const permitted = await buildSemanticContext({
    query: '本月财务台账统计',
    locale: 'zh',
    permissions: ['finance:view'],
  })
  assert.equal(permitted.candidates[0]?.key, 'get:/api/finance/ledger/insights')

  const denied = await buildSemanticContext({
    query: '本月财务台账统计',
    locale: 'zh',
    permissions: [],
  })
  assert.equal(denied.candidates.some((item) => item.key === 'get:/api/finance/ledger/insights'), false)
})

test('chat runtime does not publish non-protocol model text as a verified answer', async () => {
  const adapter: ModelAdapter = {
    name: 'invalid-output',
    generate: async () => ({ content: 'The project cost is 999999.' }),
  }
  const result = await runChat({
    adapter,
    tools: [],
    session: null,
    messages: [{ role: 'user', content: 'What is the project cost?' }],
    maxTurns: 2,
    maxSteps: 1,
    maxStepTurns: 1,
  })
  assert.equal(result.answer.includes('999999'), false)
  assert.deepEqual(result.sources, [])
})

test('chat runtime queries a tool and cites only its successful data', async () => {
  const outputs = [
    { type: 'plan', goal: 'Find count', candidateApis: ['get:/api/mock'], requiredApis: ['get:/api/mock'], evidenceFields: ['total'], steps: [{ id: 'step-1', title: 'Query count', apis: ['get:/api/mock'] }] },
    { type: 'tool_call', tool: 'call_api', arguments: { key: 'get:/api/mock' } },
    { type: 'step_done', summary: 'Count found' },
    { type: 'final', answer: '总数为 7。' },
  ]
  let modelCalls = 0
  const adapter: ModelAdapter = {
    name: 'fixture',
    generate: async () => ({
      content: JSON.stringify(outputs[modelCalls++]),
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    }),
  }
  const result = await runChat({
    adapter,
    tools: [{
      name: 'call_api',
      description: 'Read a registered API.',
      schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
      handler: async () => ({ ok: true, content: 'Loaded.', data: { total: 7 } }),
    }],
    session: null,
    messages: [{ role: 'user', content: '总数是多少？' }],
    contextCandidates: [{ key: 'get:/api/mock', evidenceFields: ['total'] }],
    enablePlanning: true,
  })
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.modelCalls, 4)
  assert.deepEqual(result.sources, [{ key: 'get:/api/mock', url: '/api/mock' }])
  assert.match(result.answer, /总数为 7/)
  assert.deepEqual(result.usage, { promptTokens: 4, completionTokens: 8, totalTokens: 12 })
})

test('chat runtime accepts verified fields inside an API array without replanning', async () => {
  const outputs = [
    { type: 'plan', goal: 'Count projects', candidateApis: ['get:/api/projects'], requiredApis: ['get:/api/projects'], evidenceFields: ['projects', 'projects[].id', 'projects[].name', 'projects[].isActive'], minApiCalls: 1, steps: [{ id: 'step-1', title: 'Query projects', apis: ['get:/api/projects'] }] },
    { type: 'tool_call', tool: 'call_api', arguments: { key: 'get:/api/projects' } },
    { type: 'step_done', summary: 'Project data loaded' },
    { type: 'final', answer: '共有 2 个项目，其中 1 个启用。' },
  ]
  let modelCalls = 0
  const adapter: ModelAdapter = {
    name: 'fixture',
    generate: async () => ({ content: JSON.stringify(outputs[modelCalls++] ?? outputs[3]) }),
  }
  const result = await runChat({
    adapter,
    tools: [{
      name: 'call_api',
      description: 'Read a registered API.',
      schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
      handler: async () => ({ ok: true, content: 'Loaded.', data: { projects: [
        { id: 1, name: 'Alpha', isActive: true },
        { id: 2, name: 'Beta', isActive: false },
      ] } }),
    }],
    session: null,
    messages: [{ role: 'user', content: '项目总数和启用数量是多少？' }],
    contextCandidates: [{ key: 'get:/api/projects', evidenceFields: ['projects'] }],
    enablePlanning: true,
    maxTurns: 2,
    maxStepTurns: 2,
  })
  assert.equal(modelCalls, 4)
  assert.match(result.answer, /2 个项目，其中 1 个启用/)
  assert.deepEqual(result.sources, [{ key: 'get:/api/projects', url: '/api/projects' }])
})
