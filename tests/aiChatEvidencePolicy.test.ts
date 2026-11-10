import assert from 'node:assert/strict'
import test from 'node:test'

import { runChat } from '../lib/ai-chat/runtime'
import type { ChatStreamEvent, ChatTool, ModelAdapter } from '../lib/ai-chat/types'

const session = { id: 1, username: 'evidence-fixture', permissions: ['ai-chat:view', 'material:view', 'value:view', 'report:view'] }
const snapshotTool = (handler: ChatTool['handler']): ChatTool => ({
  name: 'get_weekly_plan_snapshot', description: 'Read one complete plan',
  schema: { type: 'object', properties: { planId: { type: 'number' } } },
  requiredPermissions: ['material:view'], handler,
})
const snapshot = (planId = 1, items: unknown[] = [{ id: 10 }]) => ({
  ok: true, content: 'Verified plan', data: {
    plan: { id: planId, title: `Fixture ${planId}`, items }, version: 'fixture-version',
    coverage: { complete: true, total: items.length, returned: items.length },
  },
})
const alternating = (tool: string, args: Record<string, unknown>, answer = 'Verified answer'): ModelAdapter => {
  let turns = 0
  return { name: 'evidence-fixture', generate: async () => ({ content: JSON.stringify(++turns % 2
    ? { type: 'tool_call', tool, arguments: args } : { type: 'final', answer }),
  usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 } }) }
}
const sequence = (...payloads: unknown[]): ModelAdapter => {
  let index = 0
  return { name: 'evidence-fixture', generate: async () => ({ content: JSON.stringify(payloads[Math.min(index++, payloads.length - 1)]) }) }
}

for (const [locale, question] of [
  ['zh', '请读取周计划1，回复ID、标题和明细条数，不要修改或导出内容。'],
  ['fr', 'Lire le plan hebdomadaire 1 : liste des lignes et titre.'],
] as const) {
  test(`${locale} exact weekly-plan results do not trigger generic field-evidence replanning`, async () => {
    let executions = 0
    const events: ChatStreamEvent[] = []
    const result = await runChat({
      adapter: alternating('get_weekly_plan_snapshot', { planId: 1 }),
      tools: [snapshotTool(async () => { executions++; return snapshot() })],
      session, locale, messages: [{ role: 'user', content: question }], onEvent: (event) => events.push(event),
    })
    assert.equal(result.modelCalls, 2)
    assert.equal(result.toolCalls.length, 1)
    assert.equal(executions, 1)
    assert.equal(events.filter((event) => event.type === 'status').length, 0)
    assert.equal(result.answer, 'Verified answer')
    assert.deepEqual(result.usage, { promptTokens: 200, completionTokens: 20, totalTokens: 220 })
  })
}

test('a PDF preview needs one tool call and is never presented as generated or sent', async () => {
  let previews = 0
  const result = await runChat({
    adapter: alternating('request_weekly_plan_pdf', { planId: 1, signed: false }, 'PDF generated and sent.'),
    tools: [snapshotTool(async () => snapshot()), {
      name: 'request_weekly_plan_pdf', description: 'Prepare a PDF preview', effect: 'proposal',
      schema: { type: 'object', properties: {} }, requiredPermissions: ['material:view'],
      handler: async () => { previews++; return { ok: true, content: 'Preview only', jobId: 'fixture-job', data: { job: { id: 'fixture-job', status: 'CONFIRMATION_REQUIRED' } } } },
    }],
    session, messages: [{ role: 'user', content: '周计划1导出现有内容，无签字PDF，先确认，不要修改。' }],
  })
  assert.equal(result.modelCalls, 2)
  assert.equal(result.toolCalls.length, 1)
  assert.equal(previews, 1)
  assert.match(result.answer, /尚未执行/)
  assert.doesNotMatch(result.answer, /generated|sent/)
})

test('multiple requested plans are still read before a final answer', async () => {
  const ids: number[] = []
  const result = await runChat({
    adapter: sequence(
      { type: 'tool_call', tool: 'get_weekly_plan_snapshot', arguments: { planId: 1 } },
      { type: 'tool_call', tool: 'get_weekly_plan_snapshot', arguments: { planId: 2 } },
      { type: 'final', answer: 'Plan 1 and plan 2 verified.' },
    ),
    tools: [snapshotTool(async (args) => { ids.push(Number(args.planId)); return snapshot(Number(args.planId)) })],
    session, messages: [{ role: 'user', content: '对比周计划1、2的明细内容。' }],
  })
  assert.deepEqual(ids, [1, 2])
  assert.equal(result.modelCalls, 3)
  assert.equal(result.toolCalls.length, 2)
})

test('an empty weekly plan is valid zero-row evidence rather than a reason to replan', async () => {
  const result = await runChat({
    adapter: alternating('get_weekly_plan_snapshot', { planId: 1 }, '0 rows'),
    tools: [snapshotTool(async () => snapshot(1, []))],
    session, messages: [{ role: 'user', content: '周计划1有多少条明细？' }],
  })
  assert.equal(result.modelCalls, 2)
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.answer, '0 rows')
})

test('partial junction answers keep their incomplete coverage and exact provenance', async () => {
  const answer = '部分结果：2/3，不能宣称完整。\n来源：fixture；Excel行 17；ID fixture-17'
  const result = await runChat({
    adapter: alternating('get_junction_quantities', {}, 'All records are complete.'),
    tools: [{ name: 'get_junction_quantities', description: 'Exact junction records', resultMode: 'complete',
      requiredPermissions: ['value:view'], schema: { type: 'object', properties: {} },
      handler: async () => ({ ok: true, content: answer, answer, data: { coverage: { complete: false, returned: 2, total: 3 } } }),
    }],
    session, messages: [{ role: 'user', content: '列出这个路口的全部明细。' }],
  })
  assert.equal(result.modelCalls, 2)
  assert.equal(result.answer, answer)
})

test('failed business lookups never become verified data when fallback evidence is disabled', async () => {
  const result = await runChat({
    adapter: alternating('get_weekly_plan_snapshot', { planId: 1 }, 'Verified private data.'),
    tools: [snapshotTool(async () => ({ ok: false, content: 'Permission denied.', error: 'permission_denied' }))],
    session, messages: [{ role: 'user', content: '周计划1的明细内容。' }],
  })
  assert.equal(result.modelCalls, 2)
  assert.match(result.answer, /尚未取得可核实/)
  assert.doesNotMatch(result.answer, /Verified private data/)
})

test('generic API evidence requirements still trigger a real detail lookup', async () => {
  let executions = 0
  const result = await runChat({
    adapter: sequence(
      { type: 'tool_call', tool: 'call_api', arguments: { key: 'get:/api/fixture', query: { detail: false } } },
      { type: 'final', answer: 'Incomplete.' },
      { type: 'tool_call', tool: 'call_api', arguments: { key: 'get:/api/fixture', query: { detail: true } } },
      { type: 'final', answer: 'Verified with formula.' },
    ),
    tools: [{ name: 'call_api', description: 'Generic approved API', schema: { type: 'object', properties: {} },
      handler: async (args) => { executions++; return { ok: true, content: 'Fixture data', data: {
        quantity: '12.5', ...((args.query as { detail?: boolean }).detail ? { formula: '25 * 0.5' } : {}),
      } } },
    }],
    contextCandidates: [{ key: 'get:/api/fixture', evidenceFields: ['quantity', 'formula'] }],
    session, messages: [{ role: 'user', content: '读取记录的计算明细。' }],
  })
  assert.equal(result.modelCalls, 4)
  assert.equal(executions, 2)
  assert.match(result.answer, /^Verified with formula\./)
  assert.equal(result.sources.length, 2)
})

for (const phase of ['cached', 'final'] as const) {
  test(`role/row scope is revalidated before ${phase} publication even when base permissions remain`, async () => {
    let scopeAllowed = true, turns = 0, executions = 0
    const afterRevocation: ChatStreamEvent[] = []
    const adapter: ModelAdapter = { name: 'scope-fixture', generate: async () => {
      turns++
      if (turns === 2) scopeAllowed = false
      return { content: JSON.stringify(turns === 1 || (phase === 'cached' && turns === 2)
        ? { type: 'tool_call', tool: 'get_weekly_plan_snapshot', arguments: { planId: 1 } }
        : { type: 'final', answer: 'PRIVATE_SCOPE_DATA' }) }
    } }
    await assert.rejects(runChat({
      adapter, tools: [snapshotTool(async () => {
        executions++
        return { ok: true, content: 'PRIVATE_SCOPE_DATA', data: { private: 'PRIVATE_SCOPE_DATA' } }
      })],
      session, accessPermission: 'ai-chat:view', permissionChecker: async () => true,
      request: { origin: 'http://fixture.test', assertScope: async () => {
        if (!scopeAllowed) throw new Error('Role or row scope changed')
      } },
      onEvent: (event) => { if (!scopeAllowed) afterRevocation.push(event) },
      messages: [{ role: 'user', content: '读取周计划1的明细。' }],
    }), /Role or row scope changed/)
    assert.equal(executions, 1)
    assert.doesNotMatch(JSON.stringify(afterRevocation), /PRIVATE_SCOPE_DATA/)
    assert.ok(afterRevocation.every((event) => event.type !== 'final'))
  })
}

test('a snapshot followed by a requested preview is not cut short after the read', async () => {
  const result = await runChat({
    adapter: sequence(
      { type: 'tool_call', tool: 'get_weekly_plan_snapshot', arguments: { planId: 1 } },
      { type: 'tool_call', tool: 'request_weekly_plan_pdf', arguments: { planId: 1, signed: false } },
      { type: 'final', answer: 'Generated and sent.' },
    ),
    tools: [snapshotTool(async () => snapshot()), {
      name: 'request_weekly_plan_pdf', description: 'Prepare an unsigned preview', effect: 'proposal',
      schema: { type: 'object', properties: {} }, requiredPermissions: ['material:view'],
      handler: async () => ({ ok: true, content: 'Preview only', jobId: 'fixture-job' }),
    }],
    session, messages: [{ role: 'user', content: '先读取周计划1的明细内容，再准备无签字PDF确认预览。' }],
  })
  assert.equal(result.modelCalls, 3)
  assert.deepEqual(result.toolCalls.map((call) => call.tool), ['get_weekly_plan_snapshot', 'request_weekly_plan_pdf'])
  assert.match(result.answer, /尚未执行/)
  assert.doesNotMatch(result.answer, /Generated|sent/)
})
