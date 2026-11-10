import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import test from 'node:test'
import postcss from 'postcss'
import puppeteer from 'puppeteer'
import tailwindcss from 'tailwindcss'

import { getHomeCopy } from '../lib/i18n/home'
import tailwindConfig from '../tailwind.config'

for (const locale of ['zh', 'fr'] as const) {
  test(`${locale} homepage appends one localized AI card and keeps its module count accurate`, () => {
    const copy = getHomeCopy(locale)
    const cards = copy.modules.filter((module) => module.href === '/ai-chat')
    assert.equal(cards.length, 1)
    assert.equal(cards[0], copy.modules.at(-1))
    assert.equal(cards[0].title, locale === 'zh' ? 'AI助手' : 'Assistant IA')
    assert.equal(cards[0].tags.length, 3)
    assert.ok(cards[0].description && cards[0].cta)
    assert.equal(Number(copy.stats.entriesValue), copy.modules.length)
    assert.deepEqual(copy.modules.slice(0, -1).map((module) => module.href), [
      '/documents', '/reports/leader-logs', '/progress', '/members', '/resources', '/finance', '/value',
    ])
  })
}

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome'

test('homepage AI card respects access, language, responsive layout and recent visits without calling AI', {
  skip: !existsSync(executablePath), timeout: 40_000,
}, async (t) => {
  const require = createRequire(import.meta.url)
  const { build } = require(createRequire(require.resolve('tsx')).resolve('esbuild')) as {
    build(options: unknown): Promise<{ outputFiles: Array<{ text: string }> }>
  }
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import HomePageClient from './app/HomePageClient';
        import { LocaleProvider } from './lib/usePreferredLocale';
        createRoot(document.getElementById('root')).render(
          React.createElement(LocaleProvider, null, React.createElement(HomePageClient))
        );
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"test"' },
  })
  const css = await postcss([tailwindcss(tailwindConfig)]).process(
    '@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined },
  )
  let user: { username: string; roles: []; permissions: string[] } | null = null
  const apiRequests: string[] = []
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/api/')) apiRequests.push(`${request.method} ${request.url}`)
    if (request.url === '/api/auth/session') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ user }))
    } else if (request.url === '/bundle.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(bundle.outputFiles[0].text)
    } else if (request.url === '/styles.css') {
      response.setHeader('Content-Type', 'text/css')
      response.end(css.css)
    } else {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(request.url === '/ai-chat'
        ? '<h1>Isolated AI navigation target</h1>'
        : '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/bundle.js"></script>')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }))
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  await page.setRequestInterception(true)
  page.on('request', (request) => { void (request.url().startsWith(`${origin}/`) ? request.continue() : request.abort()) })
  await page.setViewport({ width: 1440, height: 1000 })
  const card = 'section.grid a[href="/ai-chat"]'
  const load = () => page.goto(origin, { waitUntil: 'networkidle0' })
  const locked = () => page.$eval(card, (node) => node.getAttribute('aria-disabled'))

  await load()
  assert.deepEqual(errors, [])
  assert.equal(await locked(), 'true')
  await page.click(card)
  await page.waitForSelector('input[type="password"]')
  assert.equal(page.url(), `${origin}/`)

  user = { username: 'isolated-home-user', roles: [], permissions: ['material:view', 'material:create', 'ai-chat:debug'] }
  await load()
  assert.equal(await locked(), 'true')
  await page.click(card)
  await page.waitForFunction(() => document.body.textContent?.includes('暂无访问权限'))
  assert.equal(page.url(), `${origin}/`)

  user = { ...user, permissions: ['ai-chat:view'] }
  await load()
  assert.equal(await locked(), 'false', 'AI entry must not require unrelated business grants')
  assert.equal(await page.$$eval('section.grid > a', (nodes) => nodes.length), 8)
  assert.equal(await page.$eval('section.grid > a:last-child', (node) => node.getAttribute('href')), '/ai-chat')
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 })
    assert.equal(await page.$eval('section.grid', (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length), width === 1440 ? 3 : 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  }

  await page.click('button[aria-label="Change language"]')
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.trim() === 'FR')
    if (!button) throw new Error('French locale choice is missing')
    button.click()
  })
  await page.waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('Assistant IA'), {}, card)
  assert.equal(await locked(), 'false')
  assert.ok(await page.evaluate(() => document.body.textContent?.includes('Aperçu')))
  assert.equal(await page.evaluate(() => document.body.textContent?.includes('路线预告')), false)

  await Promise.all([page.waitForNavigation(), page.click(card)])
  assert.equal(page.url(), `${origin}/ai-chat`)
  await load()
  assert.equal(await page.$eval('section.grid > a:first-child', (node) => node.getAttribute('href')), '/ai-chat')
  assert.ok(await page.$eval(card, (node) => node.textContent?.includes('Assistant IA')))
  assert.ok(apiRequests.length > 0)
  assert.ok(apiRequests.every((request) => request === 'GET /api/auth/session'), 'Homepage must not load AI history, call a model or write business data')
  assert.deepEqual(errors, [])
})
