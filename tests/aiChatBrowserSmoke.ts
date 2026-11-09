import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { PrismaClient } from '@prisma/client'
import puppeteer from 'puppeteer'

import { prepareWeeklyPlanJob } from '../lib/server/aiChatWorkflowStore'

const main = async () => {
  const connection = process.env.AI_CHAT_TEST_DATABASE_URL
  if (!connection) throw new Error('AI_CHAT_TEST_DATABASE_URL must name an isolated localhost database.')
  const parsed = new URL(connection)
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname))
  assert.equal(parsed.pathname, '/dailywork_ai_test')
  const db = new PrismaClient({ datasources: { db: { url: connection } } })
  const root = process.cwd()
  const directory = await mkdtemp(path.join(tmpdir(), 'dailywork-ai-browser-'))
  const token = randomUUID()
  const project = await db.project.create({ data: { name: `browser-${token}` } })
  const codes = ['ai-chat:view', 'ai-chat:debug', 'material:view', 'material:create', 'file:view']
  for (const code of codes) await db.permission.upsert({ where: { code }, create: { code, name: code }, update: {} })
  const role = await db.role.create({ data: { name: `browser-role-${token}`, permissions: { create: (await db.permission.findMany({ where: { code: { in: codes } } })).map((p) => ({ permissionId: p.id })) } } })
  const user = await db.user.create({ data: { username: `browser-${token}`, passwordHash: 'test-only', roles: { create: { roleId: role.id } } } })
  const actor = { id: user.id, username: user.username, permissions: codes }
  const privateFile = await db.fileAsset.create({ data: {
    category: 'attachment', storageKey: `files/attachment/ai-chat/${user.id}/${token}.pdf`, bucket: 'fixture-only',
    originalName: 'private-fixture.pdf', mimeType: 'application/pdf', size: 1, ownerUserId: user.id, createdById: user.id,
  } })
  const session = await db.aiChatSession.create({ data: { userId: user.id, summary: '浏览器验收' } })
  const plan = await db.weeklyDeliveryPlan.create({ data: {
    projectId: project.id, month: 11, session: 1, title: 'BROWSER-TEST', items: { create: { goodsName: '水泥', plannedQty: 25, unit: 'Tonne', supplier: 'SCA', phone: 'Bondoukou' } },
  }, include: { items: true } })
  const proposal = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [{ type: 'update', itemId: plan.items[0].id, changes: { plannedQty: '38' } }] }, { requestId: token, sessionId: session.id }, db)
  const gateway = createServer(async (_request, response) => {
    for await (const chunk of _request) { void chunk }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ output_text: JSON.stringify({ type: 'final', answer: '浏览器验收回复完成。' }) }))
  })
  gateway.listen(0, '127.0.0.1')
  await once(gateway, 'listening')
  const gatewayPort = (gateway.address() as { port: number }).port
  const portProbe = createServer()
  portProbe.listen(0, '127.0.0.1')
  await once(portProbe, 'listening')
  const port = (portProbe.address() as { port: number }).port
  await new Promise<void>((resolve) => portProbe.close(() => resolve()))
  let app: ReturnType<typeof spawn> | undefined
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  let debugPage: import('puppeteer').Page | undefined
  let log = ''
  try {
    for (const name of ['app', 'lib', 'components', 'public', 'module', 'docs', 'prisma']) {
      await cp(path.join(root, name), path.join(directory, name), { recursive: true })
    }
    for (const name of ['package.json', 'tsconfig.json', 'next.config.js', 'tailwind.config.ts', 'postcss.config.js', 'next-env.d.ts']) {
      await cp(path.join(root, name), path.join(directory, name)).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
    await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'))
    app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: directory, env: { ...process.env, DATABASE_URL: connection, DIRECT_DATABASE_URL: connection, AUTH_SECRET: 'isolated-browser-test-secret', PORT: String(port), SITE_BASE_URL: `http://127.0.0.1:${port}`, NEXT_TELEMETRY_DISABLED: '1', AI_CHAT_PROVIDER: 'responses', AI_CHAT_BASE_URL: `http://127.0.0.1:${gatewayPort}/v1`, AI_CHAT_API_KEY: 'fixture-only', AI_CHAT_MODEL: 'fixture-only' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    app.stdout?.on('data', (chunk) => { log += String(chunk) })
    app.stderr?.on('data', (chunk) => { log += String(chunk) })
    const base = `http://127.0.0.1:${port}`
    for (let i = 0; i < 100; i++) {
      if (app.exitCode !== null) throw new Error(log)
      if (await fetch(`${base}/api/ai-chat/storage?action=sessions`).then(() => true).catch(() => false)) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
    const page = await browser.newPage()
    debugPage = page
    page.on('pageerror', (error) => { log += `\nPAGE ERROR: ${String(error)}` })
    page.on('console', (message) => { if (message.type() === 'error') log += `\nCONSOLE ERROR: ${message.text()}` })
    page.on('requestfailed', (request) => { log += `\nREQUEST FAILED: ${request.url()} ${request.failure()?.errorText}` })
    page.on('request', (request) => { if (request.url().includes('/api/ai-chat/')) log += `\nAPI REQUEST: ${request.method()} ${request.url()}` })
    const body = Buffer.from(JSON.stringify({ ...actor, nationality: null, roles: [{ id: role.id, name: role.name }], issuedAt: Date.now() })).toString('base64url')
    const signature = createHmac('sha256', 'isolated-browser-test-secret').update(body).digest('base64url')
    await browser.setCookie({ name: 'dw-session', value: `${body}.${signature}`, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' })
    await page.bringToFront()
    await page.goto(`${base}/ai-chat`, { waitUntil: 'networkidle0', timeout: 120_000 })
    await page.focus('textarea')
    console.log('Browser opened AI page.')
    await page.waitForFunction(() => document.body.innerText.includes('BROWSER-TEST'), { timeout: 60_000 })
    const buttons = await page.$$('button')
    let clicked = false
    for (const button of buttons) {
      if ((await button.evaluate((el) => el.textContent))?.includes('确认执行')) { await button.click(); clicked = true; break }
    }
    assert.equal(clicked, true)
    console.log('Browser confirmed exact plan proposal.')
    await page.waitForFunction(() => document.body.innerText.includes('已更新周计划'), { timeout: 60_000 })
    assert.equal((await db.weeklyDeliveryPlanItem.findUniqueOrThrow({ where: { id: plan.items[0].id } })).plannedQty?.toString(), '38')
    assert.equal((await db.aiChatJob.findUniqueOrThrow({ where: { id: proposal.id } })).status, 'SUCCEEDED')
    console.log('Verified real database writeback.')
    await page.type('textarea', 'bonjour')
    await page.focus('textarea')
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    // Use the visible send button if this device's shortcut differs.
    const send = await page.$$('button')
    for (const button of send) if (/^(发送|Envoyer)$/.test((await button.evaluate((el) => el.textContent))?.trim() ?? '')) {
      if (!await button.evaluate((el) => (el as HTMLButtonElement).disabled)) await button.click()
      break
    }
    await page.waitForFunction(() => document.body.innerText.includes('浏览器验收回复完成。'), { timeout: 90_000 })
    await page.reload({ waitUntil: 'networkidle2' })
    await page.waitForFunction(() => document.body.innerText.includes('浏览器验收回复完成。'), { timeout: 30_000 })
    const denied = await page.evaluate(async () => {
      const response = await fetch('/api/ai-chat/jobs/00000000-0000-0000-0000-000000000001', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm' }) })
      return response.status
    })
    assert.equal(denied, 404)
    const privateStatus = await page.evaluate(async (id) => (await fetch(`/api/files/${id}?includeUrl=1`)).status, privateFile.id)
    assert.equal(privateStatus, 404, 'Generic file:view must not expose AI PDF artifacts')
    await page.setViewport({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const createPermission = await db.permission.findUniqueOrThrow({ where: { code: 'material:create' } })
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: createPermission.id } } })
    const revokedConfirmation = await page.evaluate(async (id) => (await fetch(`/api/ai-chat/jobs/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm' }),
    })).status, proposal.id)
    assert.equal(revokedConfirmation, 403, 'A stale full-access cookie must not retain write rights')
    await page.reload({ waitUntil: 'networkidle2' })
    await page.waitForFunction(() => document.body.innerText.includes('权限已变更，这条历史业务内容不可查看。'), { timeout: 30_000 })
    assert.equal(await page.evaluate(() => document.body.innerText.includes('已更新周计划')), false, 'Revoked write-result history must be redacted')
    console.log('Browser verified revoked write rights and protected history with the original cookie.')
    const completedPdf = await db.aiChatJob.create({ data: {
      userId: user.id, sessionId: session.id, requestKey: `pdf-${token}`, kind: 'WEEKLY_PDF', status: 'SUCCEEDED',
      input: { planId: plan.id, signed: false }, result: { fileAssetId: privateFile.id, generated: true },
    } })
    const viewPermission = await db.permission.findUniqueOrThrow({ where: { code: 'material:view' } })
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: viewPermission.id } } })
    assert.equal(await page.evaluate(async (id) => (await fetch(`/api/ai-chat/jobs/${id}/artifact`)).status, completedPdf.id), 403)
    const aiPermission = await db.permission.findUniqueOrThrow({ where: { code: 'ai-chat:view' } })
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: aiPermission.id } } })
    const deniedEntry = await page.evaluate(async () => {
      const headers = { 'Content-Type': 'application/json' }
      const body = JSON.stringify({ input: 'bonjour' })
      return [
        (await fetch('/api/ai-chat/storage?action=sessions')).status,
        (await fetch('/api/ai-chat', { method: 'POST', headers, body })).status,
        (await fetch('/api/ai-chat/stream', { method: 'POST', headers, body })).status,
      ]
    })
    assert.deepEqual(deniedEntry, [403, 403, 403])
    console.log('Browser smoke passed: preview/confirm/writeback, SSE, persisted history, cross-owner denial, mobile width, live grant revocation, PDF denial, both AI-entrypoint denials.')
  } catch (error) {
    const body = await debugPage?.evaluate(() => document.body.innerText).catch(() => '')
    await writeFile('/tmp/dailywork-ai-browser-error.log', `${log}\n\nBODY:\n${body}`)
    throw error
  } finally {
    await browser?.close()
    app?.kill('SIGTERM')
    if (app) await new Promise((resolve) => setTimeout(resolve, 1000))
    gateway.closeAllConnections()
    await new Promise<void>((resolve) => gateway.close(() => resolve()))
    await db.user.delete({ where: { id: user.id } })
    await db.fileAsset.delete({ where: { id: privateFile.id } })
    await db.role.delete({ where: { id: role.id } })
    await db.project.delete({ where: { id: project.id } })
    await db.$disconnect()
    await rm(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
