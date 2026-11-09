import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import test from 'node:test'
import puppeteer from 'puppeteer'
import type { BoqWorkPlanItemDto, BoqWorkPlanPostInput, BoqWorkPlansResponse } from '../lib/value/boqWorkPlans'

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome'
const baseline = 'a'.repeat(64)
const item = (version = 1, quantity = '10'): BoqWorkPlanItemDto => ({
  lineKey: 'xlsx-row-70', sourceKind: 'SIGNED_LINE', sourceRow: 70, boqItemId: null,
  code: '001', designation: 'Isolated editor fixture', unit: 'm3', sourceUnitPrice: '10',
  previousQuantity: '80', currentQuantity: '20', cumulativeQuantity: '100', cumulativeAmountHt: '1000', state: 'DRAFT',
  plan: { id: 1, version, state: 'DRAFT', confirmedSnapshot: null, updatedAt: '2026-11-09T00:00:00Z', draft: {
    scopeComplete: false, baselineHash: baseline,
    price: { unitPrice: '10', confirmed: true, basis: 'ORIGINAL', evidence: 'Signed source price' },
    scopes: [{ id: '1e2d3c4b-1234-4567-89ab-abcdef123456', description: 'Server scope', roadId: 1, startPk: null, endPk: null,
      side: null, spec: null, unit: 'm3', completionState: 'COMPLETED', scopeBasis: 'ORIGINAL', quantity,
      quantityConfirmed: true, quantityEvidence: 'Original measurement', approvalEvidence: '', price: null }],
  } },
  summary: { signedCumulativeQuantity: '100', completedUnbilledQuantity: null, notCompletedUnbilledQuantity: null,
    unknownCompletionQuantity: null, approvedRemainingQuantity: null, pendingRemainingQuantity: null, remainingQuantity: null,
    forecastFinalQuantity: null, forecastIncludingPendingQuantity: null, remainingAmountHt: null, pendingAmountHt: null,
    forecastFinalAmountHt: null, missingPriceCount: 0, ready: false },
})
const overview = (source = item(), baselineHash = baseline): BoqWorkPlansResponse => ({
  revisionId: 23, projectId: 1, periodIndex: 7, baselineHash, editAllowed: true, readOnlyReason: null,
  roads: [{ id: 1, name: 'Isolated road', slug: 'test-road' }], items: [source],
})

test('Chromium editor retains dirty inputs after 409/refresh, explicitly rebases or discards, and isolates line identities', {
  skip: !existsSync(executablePath), timeout: 30_000,
}, async (t) => {
  // Use tsx's installed bundler without adding dependencies or running Next.js.
  const require = createRequire(import.meta.url)
  const { build } = require(createRequire(require.resolve('tsx')).resolve('esbuild')) as {
    build(options: unknown): Promise<{ outputFiles: Array<{ text: string }> }>
  }
  const bundle = await build({
    stdin: { contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { SignedBillWorkPlanPanel } from './components/value/SignedBillWorkPlanPanel';
      function Harness() {
        const [context, setContext] = useState(${JSON.stringify(overview())});
        window.refreshWorkPlan = next => setContext(previous => ({ ...previous, ...next }));
        return React.createElement(SignedBillWorkPlanPanel, {
          ...context, item: context.items[0], locale: 'zh', formatValue: value => value ?? '?',
          onSaved: response => setContext(previous => ({ ...previous, baselineHash: response.baselineHash, items: [response.item] }))
        });
      }
      createRoot(document.getElementById('root')).render(React.createElement(Harness));
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"test"' },
  })
  let latest = overview(), getStatus = 200, postStatus = 409, gets = 0
  const posts: BoqWorkPlanPostInput[] = []
  const server = createServer(async (request, response) => {
    if (request.url === '/bundle.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text)
    } else if (request.url === '/api/value/signed-bills/23/work-plans') {
      response.setHeader('Content-Type', 'application/json')
      if (request.method === 'POST') {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const input = JSON.parse(Buffer.concat(chunks).toString()) as BoqWorkPlanPostInput
        posts.push(input)
        response.statusCode = postStatus
        const saved = item((input.expectedVersion ?? 0) + 1)
        saved.plan!.draft = { scopes: input.scopes, price: input.price ?? null, scopeComplete: input.scopeComplete, baselineHash: input.baselineHash }
        response.end(JSON.stringify(postStatus === 200 ? { item: saved, baselineHash: input.baselineHash } : { message: 'Synthetic version conflict' }))
      } else {
        gets++; response.statusCode = getStatus; response.end(JSON.stringify(latest))
      }
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end('<div id="root"></div><script src="/bundle.js"></script>')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }))
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  t.after(() => browser.close())
  const page = await browser.newPage(), errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  await page.setRequestInterception(true)
  page.on('request', (request) => { void (request.url().startsWith(`${origin}/`) ? request.continue() : request.abort()) })
  await page.goto(origin)
  const click = (text: string) => page.evaluate((text) => {
    const button = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === text)
    if (!button || button.disabled || button.closest('fieldset:disabled')) throw new Error(`Unavailable button: ${text}`)
    button.click()
  }, text)
  const fill = (label: string, value: string) => page.evaluate(({ label, value }) => {
    const field = Array.from(document.querySelectorAll('label')).find((node) => node.textContent?.startsWith(label) && node.querySelector('input,textarea'))?.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement
    if (!field) throw new Error(`Missing field: ${label}`)
    const prototype = field.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }, { label, value })
  const values = () => page.evaluate(() => Object.fromEntries(['工作内容', '待计量数量', '单价 HT', '单价依据', '备注（选填）'].map((label) => [label,
    (Array.from(document.querySelectorAll('label')).find((node) => node.textContent?.startsWith(label) && node.querySelector('input,textarea'))?.querySelector('input,textarea') as HTMLInputElement | undefined)?.value,
  ])))
  const refresh = (context: Partial<BoqWorkPlansResponse>) => page.evaluate((context) => {
    (window as unknown as { refreshWorkPlan(context: Partial<BoqWorkPlansResponse>): void }).refreshWorkPlan(context)
  }, context)
  const waitConflict = () => page.waitForSelector('[data-work-plan-conflict]')
  const waitResolved = () => page.waitForSelector('[data-work-plan-conflict]', { hidden: true })
  const waitQuantity = (value: string) => page.waitForFunction((value) => (Array.from(document.querySelectorAll('label')).find((node) => node.textContent?.startsWith('待计量数量'))?.querySelector('input'))?.value === value, {}, value)
  await page.waitForFunction(() => 'refreshWorkPlan' in window)
  await click('编辑')
  await fill('工作内容', 'LOCAL scope')
  await fill('待计量数量', '41.125')
  await fill('单价 HT', '20')
  await fill('单价依据', 'LOCAL price evidence')
  await fill('备注（选填）', 'LOCAL note')
  const local = await values()
  assert.equal(local['待计量数量'], '41.125')
  await click('暂存')
  await waitConflict()
  assert.equal(posts.length, 1)
  assert.equal(posts[0].expectedVersion, 1)
  assert.equal(posts[0].baselineHash, baseline)
  await refresh({ items: [item(2, '22')] })
  await waitConflict()
  assert.deepEqual(await values(), local, 'A newer item prop must not overwrite any dirty input after 409')
  assert.equal(await page.$eval('button[type="submit"]', (node) => node.disabled), true)

  const keep = '保留填写并核对最新版本'
  const nextBaseline = 'b'.repeat(64)
  latest = overview(item(3, '33'), nextBaseline)
  for (const invalid of ['http', 'version', 'baseline', 'readonly', 'road']) {
    getStatus = invalid === 'http' ? 500 : 200
    latest = overview(item(3, '33'), nextBaseline)
    if (invalid === 'version') latest.items[0].plan!.version = 0
    if (invalid === 'baseline') latest.baselineHash = ''
    if (invalid === 'readonly') latest.editAllowed = false
    if (invalid === 'road') latest.roads = []
    await click(keep)
    await page.waitForFunction(() => !document.querySelector('[data-work-plan-conflict] button:disabled'))
    await waitConflict()
    assert.deepEqual(await values(), local, `Failed ${invalid} rebase must retain all inputs`)
    assert.equal(posts.length, 1, 'Rebasing must not submit any writes')
  }
  latest = overview(item(3, '33'), nextBaseline)
  await click(keep)
  await waitResolved()
  assert.deepEqual(await values(), local)
  postStatus = 200
  await click('暂存')
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === '已暂存')
  assert.equal(posts.length, 2)
  assert.equal(posts[1].expectedVersion, 3)
  assert.equal(posts[1].baselineHash, nextBaseline)
  assert.equal(posts[1].scopes[0].quantity, '41.125')
  assert.equal(posts[1].scopes[0].description, 'LOCAL scope')
  assert.equal(posts[1].price?.unitPrice, '20')
  assert.equal(posts[1].price?.evidence, 'LOCAL price evidence')
  assert.equal(posts[1].reason, 'LOCAL note')

  await refresh({ items: [item(5, '55')] })
  await waitQuantity('55')
  await waitResolved()
  await fill('备注（选填）', 'NOTE ONLY local change')
  await refresh({ items: [item(6, '66')] })
  await waitConflict()
  assert.equal((await values())['备注（选填）'], 'NOTE ONLY local change')
  latest = overview(item(7, '70'), nextBaseline)
  await click('重新读取并放弃本地填写')
  await waitResolved()
  await waitQuantity('70')
  assert.equal((await values())['备注（选填）'], '')
  assert.equal(posts.length, 2)

  await fill('待计量数量', '88')
  const otherLine = { ...item(1, '21'), lineKey: 'xlsx-row-71' }
  await refresh({ items: [otherLine] })
  await waitQuantity('21')
  await waitResolved()
  await fill('待计量数量', '89')
  await refresh({ revisionId: 24, items: [{ ...otherLine, plan: item(1, '99').plan }] })
  await waitQuantity('99')
  await waitResolved()
  await fill('备注（选填）', 'BASELINE ONLY local change')
  await refresh({ baselineHash: 'c'.repeat(64) })
  await waitConflict()
  assert.equal((await values())['备注（选填）'], 'BASELINE ONLY local change')
  assert.equal((await values())['待计量数量'], '99')
  assert.equal(gets, 7)
  assert.deepEqual(errors, [])
})
