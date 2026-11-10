import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import puppeteer from 'puppeteer'

import { hashPassword } from '../lib/auth/password'

const main = async () => {
  const connection = process.env.AI_CHAT_TEST_DATABASE_URL
  const artifacts = process.env.HOME_AI_TEST_ARTIFACTS
  if (!connection || !artifacts) throw new Error('An isolated database URL and artifact directory are required.')
  const parsed = new URL(connection)
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname))
  assert.equal(parsed.pathname, '/dailywork_ai_test')
  assert.ok(path.resolve(artifacts).startsWith('/tmp/dailywork-home-qa-'))
  await mkdir(artifacts, { recursive: true })
  const directory = await mkdtemp(path.join(artifacts, 'preview-'))
  const db = new PrismaClient({ datasources: { db: { url: connection } } })
  const token = randomUUID()
  const password = `fixture-${token}`
  const roles: number[] = [], users: number[] = []
  let modelCalls = 0
  const gateway = createServer(async (request, response) => {
    for await (const chunk of request) { void chunk }
    modelCalls++
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ output_text: JSON.stringify({ type: 'final', answer: '首页入口实测回复完成。' }) }))
  })
  gateway.listen(0, '127.0.0.1')
  await once(gateway, 'listening')
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = (probe.address() as { port: number }).port
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  const base = `http://127.0.0.1:${port}`
  let app: ReturnType<typeof spawn> | undefined
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  let debugPage: import('puppeteer').Page | undefined
  let log = ''
  try {
    const createUser = async (code: string) => {
      const permission = await db.permission.upsert({ where: { code }, create: { code, name: code }, update: {} })
      const role = await db.role.create({ data: { name: `home-${code}-${token}`, permissions: { create: { permissionId: permission.id } } } })
      roles.push(role.id)
      const user = await db.user.create({ data: { username: `home-${code}-${token}`, passwordHash: hashPassword(password), roles: { create: { roleId: role.id } } } })
      users.push(user.id)
      return { ...user, roleId: role.id, permissionId: permission.id }
    }
    const deniedUser = await createUser('material:view')
    const aiUser = await createUser('ai-chat:view')
    for (const name of ['app', 'lib', 'components', 'public', 'module', 'docs', 'prisma', 'types']) {
      await cp(path.join(process.cwd(), name), path.join(directory, name), { recursive: true })
    }
    for (const name of ['package.json', 'tsconfig.json', 'next.config.js', 'tailwind.config.ts', 'postcss.config.js', 'next-env.d.ts']) {
      await cp(path.join(process.cwd(), name), path.join(directory, name))
    }
    await symlink(path.join(process.cwd(), 'node_modules'), path.join(directory, 'node_modules'))
    app = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: directory, env: {
        PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
        DATABASE_URL: connection, DIRECT_DATABASE_URL: connection, AUTH_SECRET: 'isolated-home-browser-secret',
        PORT: String(port), SITE_BASE_URL: base, AI_CHAT_PROVIDER: 'responses',
        AI_CHAT_BASE_URL: `http://127.0.0.1:${(gateway.address() as { port: number }).port}/v1`,
        AI_CHAT_API_KEY: 'fixture-only', AI_CHAT_MODEL: 'fixture-only',
      }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    app.stdout?.on('data', (chunk) => { log += String(chunk) })
    app.stderr?.on('data', (chunk) => { log += String(chunk) })
    for (let attempt = 0; attempt < 120; attempt++) {
      if (app.exitCode !== null) throw new Error(log)
      if (await fetch(`${base}/api/auth/session`).then(() => true).catch(() => false)) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    // Drain a full page response so cold client chunks finish compiling first.
    const warmup = await fetch(base)
    await warmup.text()
    assert.equal(warmup.status, 200)
    browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    debugPage = page
    page.setDefaultTimeout(60_000)
    const errors: string[] = [], apiRequests: string[] = []
    page.on('pageerror', (error) => { errors.push(String(error)); log += `\nPAGE ERROR: ${String(error)}` })
    const diagnostics = await page.createCDPSession()
    await diagnostics.send('Runtime.enable')
    diagnostics.on('Runtime.exceptionThrown', (event) => {
      log += `\nBROWSER EXCEPTION: ${JSON.stringify(event.exceptionDetails)}`
    })
    page.on('console', (message) => { if (message.type() === 'error') log += `\nCONSOLE: ${message.text()}` })
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (request.url().startsWith(`${base}/api/`)) apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`)
      void (request.url().startsWith(`${base}/`) ? request.continue() : request.abort())
    })
    await page.setViewport({ width: 1440, height: 1000 })
    await page.evaluateOnNewDocument(() => {
      if (!localStorage.getItem('dailywork:preferred-locale')) localStorage.setItem('dailywork:preferred-locale', 'zh')
    })
    const card = 'section.grid a[href="/ai-chat"]'
    const home = async () => {
      const hydrated = page.waitForResponse((response) => response.url() === `${base}/api/auth/session`, { timeout: 60_000 })
      void hydrated.catch(() => undefined)
      await page.goto(base, { waitUntil: 'networkidle0', timeout: 120_000 })
      assert.deepEqual(errors, [])
      await hydrated
      await page.waitForSelector(card)
    }
    const clickButton = async (text: string) => {
      await page.waitForFunction((text) => Array.from(document.querySelectorAll('button')).some((node) => node.textContent?.trim().startsWith(text) && !node.disabled), {}, text)
      await page.evaluate((text) => {
        const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.trim().startsWith(text))
        if (!button || button.disabled) throw new Error(`Unavailable button: ${text}`)
        button.click()
      }, text)
    }
    const login = async (username: string) => {
      for (const selector of ['input[autocomplete="username"]', 'input[type="password"]']) {
        await page.click(selector)
        await page.keyboard.down('Control')
        await page.keyboard.press('KeyA')
        await page.keyboard.up('Control')
        await page.keyboard.press('Backspace')
      }
      await page.type('input[autocomplete="username"]', username)
      await page.type('input[type="password"]', password)
      const response = page.waitForResponse((response) => response.url() === `${base}/api/auth/login`)
      await page.click('form button[type="submit"]')
      assert.equal((await response).status(), 200)
      await page.waitForSelector('input[type="password"]', { hidden: true })
    }

    await home()
    assert.equal(await page.$eval(card, (node) => node.getAttribute('aria-disabled')), 'true')
    await page.click(card)
    await page.waitForSelector('input[type="password"]')
    assert.equal(page.url(), `${base}/`)
    await login(deniedUser.username)
    await page.click(card)
    await page.waitForFunction(() => document.body.innerText.includes('暂无访问权限'))
    assert.equal(page.url(), `${base}/`)
    await page.goto(`${base}/ai-chat`, { waitUntil: 'networkidle0' })
    assert.equal(await page.$('textarea'), null)
    console.log('PASS: guest click opens login; real login without AI rights is blocked, including direct URL.')

    await home()
    await page.evaluate((username) => {
      Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.includes(username))?.click()
    }, deniedUser.username)
    await clickButton('退出登录')
    await page.waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('需登录'), {}, card)
    await page.click(card)
    await page.waitForSelector('input[type="password"]')
    await login(aiUser.username)
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-disabled') === 'false', {}, card)
    assert.equal(modelCalls, 0)
    assert.ok(apiRequests.every((request) => !request.includes('/api/ai-chat/')))
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewport({ width, height: 900 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      assert.equal(await page.$eval('section.grid', (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length), width >= 1280 ? 3 : width >= 768 ? 2 : 1)
    }
    await page.screenshot({ path: path.join(artifacts, 'home-mobile.png'), fullPage: true })
    await page.setViewport({ width: 1440, height: 1000 })
    await page.click('button[aria-label="Change language"]')
    await clickButton('FR')
    await page.waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('Assistant IA'), {}, card)
    assert.ok(await page.evaluate(() => document.body.innerText.includes('Aperçu')))
    assert.equal(await page.evaluate(() => document.body.innerText.includes('路线预告')), false)
    await page.screenshot({ path: path.join(artifacts, 'home-desktop-fr.png'), fullPage: true })
    await page.focus(card)
    await page.keyboard.press('Enter')
    await page.waitForSelector('textarea')
    assert.equal(new URL(page.url()).pathname, '/ai-chat')
    console.log('PASS: real AI-only account enters the actual AI page via keyboard; Chinese/French and 320/390/820/1440px layouts pass.')

    await page.type('textarea', 'bonjour')
    await clickButton('Envoyer')
    await page.waitForFunction(() => document.body.innerText.includes('首页入口实测回复完成。'))
    assert.ok(modelCalls > 0)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.innerText.includes('首页入口实测回复完成。'))
    await home()
    await page.waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('Assistant IA'), {}, card)
    assert.equal(await page.$eval('section.grid > a:first-child', (node) => node.getAttribute('href')), '/ai-chat')
    console.log('PASS: actual AI page sends to an isolated mock model, retains history after refresh, and home recent-visit order updates.')

    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: aiUser.roleId, permissionId: aiUser.permissionId } } })
    await page.click(card)
    await page.waitForFunction(() => document.body.innerText.includes('需要 AI 对话权限'))
    assert.equal(await page.$('textarea'), null)
    assert.equal(await page.evaluate(async () => (await fetch('/api/ai-chat/storage?action=sessions')).status), 403)
    assert.deepEqual(errors, [])
    console.log('PASS: revoking AI rights blocks the actual page and API with the old login cookie; no browser runtime errors.')
  } catch (error) {
    if (debugPage) {
      await writeFile(path.join(artifacts, 'error-body.txt'), await debugPage.evaluate(() => document.body.innerText).catch(() => ''))
      await debugPage.screenshot({ path: path.join(artifacts, 'error.png'), fullPage: true }).catch(() => undefined)
    }
    throw error
  } finally {
    await writeFile(path.join(artifacts, 'preview.log'), log)
    await browser?.close()
    if (app && app.exitCode === null) {
      app.kill('SIGTERM')
      await once(app, 'exit')
    }
    gateway.closeAllConnections()
    await new Promise<void>((resolve) => gateway.close(() => resolve()))
    await db.user.deleteMany({ where: { id: { in: users } } })
    await db.role.deleteMany({ where: { id: { in: roles } } })
    await db.$disconnect()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
