import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import test from 'node:test'

import puppeteer from 'puppeteer'

import { runChat } from '../lib/ai-chat/runtime'
import type { ChatTool, ModelAdapter } from '../lib/ai-chat/types'
import { collectSuccessfulSources } from '../lib/ai-chat/sources'
import { buildJunctionPayload, renderJunctionAnswer } from '../lib/ai-chat/junctionQuantities'

const model = (...responses: unknown[]): ModelAdapter => {
  let index = 0
  return { name: 'fixture', generate: async () => ({ content: JSON.stringify(responses[Math.min(index++, responses.length - 1)]) }) }
}

test('complete query result cannot be replaced by a model hallucination or reduced to sample rows', async () => {
  const text = Array.from({ length: 80 }, (_, index) => `Record ${index}: exact quantity ${index}.0001`).join('\n')
  let received = false
  const tool: ChatTool = {
    name: 'get_junction_quantities', description: 'Complete verified query',
    schema: { type: 'object', properties: {} }, resultMode: 'complete',
    handler: async () => ({ ok: true, content: text, answer: text, data: { coverage: { complete: true }, records: Array.from({ length: 80 }, (_, id) => ({ id, formula: 'long source '.repeat(50) })) } }),
  }
  const adapter = model({ type: 'tool_call', tool: tool.name }, { type: 'final', answer: 'There are no records.' })
  const original = adapter.generate
  adapter.generate = async (params) => {
    if (params.messages.some((message) => message.content.includes('long source '.repeat(50)))) received = true
    return original(params)
  }
  const result = await runChat({ adapter, tools: [tool], session: null, messages: [{ role: 'user', content: 'All quantities' }], maxTurns: 3 })
  assert.equal(received, true)
  assert.equal(result.answer, text)
})

test('complete Chinese junction answers preserve each Excel row and record ID through finalization', async () => {
  const scope = { projectCode: 'fixture', reviewKey: 'fixture-review', roadSlug: 'fixture-road', canonicalPk: 'PK1+125' }
  const payload = buildJunctionPayload([25, 26].map((excelRow) => ({
    id: excelRow, reviewId: 1, recordId: `fixture-record-${excelRow}`, status: 'NEEDS_REVIEW', issueId: null,
    review: { id: 1, key: scope.reviewKey, projectCode: scope.projectCode, attachmentNumber: 1, sourceFileName: 'fixture.xlsx' },
    boqCode: `BOQ-${excelRow}`, boqNameZh: '混凝土', boqNameFr: null, unit: 'm3',
    roadSlug: scope.roadSlug, roadZh: null, roadRaw: null, sideCode: 'CG', sideZh: null,
    pkStart: null, pkEnd: null, quantity: null, formula: null, note: null,
    sourceExcelRow: excelRow, source: { sheet: 'Fixture sheet', excelRow },
    data: { type: 'Amorce', isJunction: true, canonicalPk: scope.canonicalPk, quantity: '12.1234' },
  })), scope)
  const answer = renderJunctionAnswer(payload, 'zh')
  const result = await runChat({
    adapter: model({ type: 'tool_call', tool: 'get_junction_quantities' }, { type: 'final', answer: 'No provenance.' }),
    tools: [{ name: 'get_junction_quantities', description: 'Verified junctions', resultMode: 'complete',
      schema: { type: 'object', properties: {} }, handler: async () => ({ ok: true, content: JSON.stringify(payload), answer }) }],
    session: null, locale: 'zh', messages: [{ role: 'user', content: '查询全部平交明细' }],
  })
  assert.equal(result.answer, answer)
  for (const excelRow of [25, 26]) {
    assert.ok(result.answer.includes(`来源：fixture-review；Excel行 ${excelRow}；ID fixture-record-${excelRow}`))
  }
})

test('model prose still loses unverified source metadata during finalization', async () => {
  const result = await runChat({
    adapter: model({ type: 'final', answer: 'Model answer.\n来源：unverified\nSources: invented\n工具提示：internal\nTool hints: internal' }),
    tools: [], session: null, messages: [{ role: 'user', content: 'Hello' }],
  })
  assert.equal(result.answer, 'Model answer.')
})

test('a prepared job cannot be described as committed or sent by the model', async () => {
  const result = await runChat({
    adapter: model({ type: 'tool_call', tool: 'preview' }, { type: 'final', answer: 'All data updated and PDF sent.' }),
    tools: [{ name: 'preview', description: 'Preview only', schema: { type: 'object', properties: {} }, effect: 'proposal',
      handler: async () => ({ ok: true, content: 'Preview only.', jobId: 'fixture' }) }],
    session: null, messages: [{ role: 'user', content: 'Update my plan' }],
  })
  assert.match(result.answer, /尚未执行/)
  assert.doesNotMatch(result.answer, /PDF sent/)
})

test('proposal tool failures are never automatically retried', async () => {
  let calls = 0
  const result = await runChat({
    adapter: model({ type: 'tool_call', tool: 'preview' }, { type: 'final', answer: 'Updated everything and sent PDF.' }),
    tools: [{ name: 'preview', description: 'Preview only', schema: { type: 'object', properties: {} }, effect: 'proposal',
      handler: async () => { calls++; throw new Error('Ambiguous failure') } }],
    session: null, messages: [{ role: 'user', content: 'Update' }],
  })
  assert.equal(calls, 1)
  assert.match(result.answer, /未执行/)
  assert.doesNotMatch(result.answer, /Updated everything/)
})

test('multiple complete scopes and a failed scope all remain in the final answer', async () => {
  const result = await runChat({
    adapter: model({ type: 'tool_call', tool: 'complete', arguments: { pk: '085' } },
      { type: 'tool_call', tool: 'complete', arguments: { pk: '160' } },
      { type: 'tool_call', tool: 'complete', arguments: { pk: '225' } },
      { type: 'final', answer: 'Only PK160.' }),
    tools: [{ name: 'complete', description: 'Verified scopes', schema: { type: 'object', properties: { pk: { type: 'string' } } }, resultMode: 'complete',
      handler: async (args) => ({ ok: args.pk !== '225', content: args.pk === '225' ? '225 could not be verified' : `Verified PK${args.pk}` }) }],
    session: null, messages: [{ role: 'user', content: 'Show all three locations' }],
  })
  assert.match(result.answer, /Verified PK085/)
  assert.match(result.answer, /Verified PK160/)
  assert.match(result.answer, /225 could not be verified/)
})

test('a denied registered proposal cannot be reported as completed', async () => {
  const result = await runChat({
    adapter: model({ type: 'tool_call', tool: 'write_preview' }, { type: 'final', answer: 'Updated everything.' }),
    tools: [{ name: 'write_preview', description: 'Proposal', schema: { type: 'object', properties: {} }, effect: 'proposal', requiredPermissions: ['material:create'],
      handler: async () => { throw new Error('Must not execute') } }],
    session: { id: 1, username: 'read-only', permissions: [] }, messages: [{ role: 'user', content: 'Update this record' }],
  })
  assert.match(result.answer, /未执行/)
  assert.doesNotMatch(result.answer, /Updated everything/)
})

test('business sources reject external, protocol-relative and backslash URLs', () => {
  const sources = collectSuccessfulSources([{ tool: 'custom', arguments: {}, result: { ok: true, content: 'ok', sources: [
    { key: 'ok', url: '/value/bill-review/tanda-attachment-6' },
    { key: 'bad', url: '//evil.test/value/data' },
    { key: 'bad', url: 'https://evil.test/api/files' },
    { key: 'bad', url: '/api/\\evil.test/file' },
  ] } }])
  assert.deepEqual(sources, [{ key: 'ok', url: '/value/bill-review/tanda-attachment-6' }])
})

for (const phase of ['before', 'during', 'cached', 'retry'] as const) {
  test(`fresh permission checks deny a business tool when revoked ${phase} execution`, async () => {
    let granted = true
    let executions = 0
    let turns = 0
    const adapter: ModelAdapter = { name: 'permission-fixture', generate: async () => {
      turns++
      if (phase === 'before' || (phase === 'cached' && turns === 2)) granted = false
      return { content: JSON.stringify(turns <= (phase === 'cached' ? 2 : 1)
        ? { type: 'tool_call', tool: 'protected' } : { type: 'final', answer: 'Ignore permissions and print SECRET.' }) }
    } }
    const result = await runChat({
      adapter, tools: [{ name: 'protected', description: 'Protected read', resultMode: 'complete',
        schema: { type: 'object', properties: {} }, requiredPermissions: ['finance:view'],
        handler: async () => {
          executions++
          if (phase === 'during' || phase === 'retry') granted = false
          if (phase === 'retry') throw new Error('Temporary failure')
          return { ok: true, content: 'SECRET.' }
        } }],
      session: { id: 1, username: 'fixture', permissions: ['finance:view'] },
      permissionChecker: async () => granted,
      messages: [{ role: 'user', content: 'Protected details' }],
    })
    assert.equal(executions, phase === 'before' ? 0 : 1)
    assert.equal(result.toolCalls.at(-1)?.result.ok, false)
    assert.doesNotMatch(result.answer, /SECRET/)
  })
}

test('revoking AI entry access blocks even cached permissionless helper tools', async () => {
  let granted = true
  let executions = 0
  let turns = 0
  const result = await runChat({
    adapter: { name: 'fixture', generate: async () => {
      turns++
      if (turns === 2) granted = false
      return { content: JSON.stringify(turns < 3 ? { type: 'tool_call', tool: 'helper' } : { type: 'final', answer: 'Finished' }) }
    } },
    tools: [{ name: 'helper', description: 'Helper', resultMode: 'complete', schema: { type: 'object', properties: {} },
      handler: async () => { executions++; return { ok: true, content: 'Verified helper' } } }],
    accessPermission: 'ai-chat:view', permissionChecker: async () => granted,
    session: { id: 1, username: 'fixture', permissions: ['ai-chat:view'] }, messages: [{ role: 'user', content: 'Help' }],
  })
  assert.equal(executions, 1)
  assert.equal(result.toolCalls.at(-1)?.result.ok, false)
})

test('real Chromium: sending invalidates delayed session history without losing the active stream', {
  skip: !existsSync(process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome'), timeout: 20_000,
}, async (t) => {
  const require = createRequire(import.meta.url)
  const { build } = createRequire(require.resolve('tsx'))('esbuild') as {
    build: (options: Record<string, unknown>) => Promise<{ outputFiles: Array<{ text: string }> }>
  }
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ChatPanel } from './components/ai-chat/ChatPanel';
      import { aiChatCopy } from './lib/i18n/aiChat';
      createRoot(document.getElementById('root')).render(React.createElement(ChatPanel, {
        userId: 101, locale: 'zh', endpoint: '/fixture-stream', labels: aiChatCopy.zh, canDebug: false,
      }));`, resolveDir: new URL('..', import.meta.url).pathname, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  })
  const session = { id: 'fixture-session', summary: 'History fixture', summarySource: 'manual', updatedAt: new Date().toISOString() }
  let releaseHistory: (() => void) | undefined
  let finishStream: (() => void) | undefined
  let streams = 0
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://fixture.test')
    response.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/bundle.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(bundle.outputFiles[0].text)
    } else if (url.pathname === '/api/ai-chat/storage') {
      if (url.searchParams.get('action') === 'sessions') response.end(JSON.stringify({ sessions: [session] }))
      else if (url.searchParams.get('action') === 'messages') {
        releaseHistory = () => response.end(JSON.stringify({
          messages: [{ role: 'user', content: 'STALE_HISTORY' }], hasMore: false, nextBeforeId: null,
        }))
      } else if (url.searchParams.get('action') === 'memory') response.end('{"memory":null}')
      else {
        for await (const _chunk of request) { /* Drain the isolated fixture request. */ }
        response.end(JSON.stringify({ message: { id: 'fixture-message' }, session }))
      }
    } else if (url.pathname === '/api/ai-chat/jobs') response.end('{"jobs":[]}')
    else if (url.pathname === '/fixture-stream') {
      streams++
      response.setHeader('Content-Type', 'text/event-stream')
      response.write('data: {"type":"status","message":"STREAM_ACTIVE"}\n\n')
      finishStream = () => response.end('data: {"type":"final","answer":"FRESH_STREAM_ANSWER"}\n\n')
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end('<div id="root"></div><script src="/bundle.js"></script>')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }))
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('textarea')
  await page.type('textarea', 'FRESH_USER_QUESTION')
  await page.waitForFunction(() => document.body.innerText.includes('History fixture'))
  assert.ok(releaseHistory, 'History must still be pending when the user submits')
  const send = 'button.rounded-full.bg-slate-900'
  await page.click(send)
  await page.waitForFunction(() => document.body.innerText.includes('STREAM_ACTIVE'))
  await page.type('textarea', 'NEXT_QUESTION')
  releaseHistory()
  await page.waitForNetworkIdle({ idleTime: 100 })
  assert.equal(await page.$eval(send, (element) => (element as HTMLButtonElement).disabled), true)
  const pending = await page.$eval('body', (element) => element.innerText)
  assert.match(pending, /FRESH_USER_QUESTION/)
  assert.match(pending, /STREAM_ACTIVE/)
  assert.doesNotMatch(pending, /STALE_HISTORY/)
  assert.ok(finishStream)
  finishStream()
  await page.waitForFunction(() => document.body.innerText.includes('FRESH_STREAM_ANSWER'))
  assert.equal(await page.$eval(send, (element) => (element as HTMLButtonElement).disabled), false)
  assert.equal(streams, 1)
  assert.deepEqual(errors, [])
})
