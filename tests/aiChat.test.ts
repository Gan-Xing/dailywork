import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSemanticContext } from '../lib/ai-chat/adapters/dailywork/semanticContext'
import { createResponsesAdapter, ResponsesAdapterError } from '../lib/ai-chat/adapters/responsesAdapter'
import { runChat } from '../lib/ai-chat/runtime'
import { collectSuccessfulSources } from '../lib/ai-chat/sources'
import type { ModelAdapter } from '../lib/ai-chat/types'

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
