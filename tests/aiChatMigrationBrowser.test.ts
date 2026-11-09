import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import test from 'node:test'

import puppeteer from 'puppeteer'
import ts from 'typescript'

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome'

test('real Chromium: local history reads and queued-upgrade deadlines on an isolated HTTP origin', {
  skip: !existsSync(executablePath), timeout: 20_000,
}, async (t) => {
  const modules = new Map(['migrateLocalHistory', 'localStore', 'remoteStore'].map((name) => [name, ts.transpileModule(
    readFileSync(new URL(`../lib/ai-chat/${name}.ts`, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText]))
  let storageFetches = 0
  const server = createServer((request, response) => {
    const script = modules.get(request.url?.replace('/modules/', '') ?? '')
    if (script) {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(script)
    } else if (request.url?.startsWith('/api/ai-chat/storage')) {
      storageFetches += 1
      response.setHeader('Content-Type', 'application/json')
      response.end('{"sessions":[]}')
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end('<script type="module">import * as migration from "/modules/migrateLocalHistory"; window.migration = migration;</script>')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => 'migration' in window)
  const result = await page.evaluate(async () => {
    const migration = (window as unknown as { migration: typeof import('../lib/ai-chat/migrateLocalHistory') }).migration
    const start = performance.now()
    await migration.migrateOwnedLocalHistory(101)
    await fetch('/api/ai-chat/storage?action=sessions')
    const fresh = {
      milliseconds: performance.now() - start,
      marker: localStorage.getItem('dailywork-ai-chat-remote-import-v1:101'),
      databases: await indexedDB.databases(),
    }
    const name = 'dailywork-ai-chat-user-102'
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        for (const store of ['sessions', 'messages', 'memories']) request.result.createObjectStore(store, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const empty = await migration.readOwnedLocalHistory(102)
    const original = { id: 'local-session', summary: 'Local title' }
    await new Promise<void>((resolve, reject) => {
      const tx = connection.transaction('sessions', 'readwrite')
      tx.objectStore('sessions').put(original)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    const populated = await migration.readOwnedLocalHistory(102)

    // Chrome queues this read behind the blocked upgrade without dispatching a
    // blocked event for the read's own IDBOpenDBRequest.
    const upgrade = indexedDB.open(name, 2)
    const upgraded = new Promise<IDBDatabase>((resolve, reject) => {
      upgrade.onsuccess = () => resolve(upgrade.result)
      upgrade.onerror = () => reject(upgrade.error)
    })
    await new Promise<void>((resolve) => { upgrade.onblocked = () => resolve() })
    const timeoutStart = performance.now()
    let timeout = ''
    try { await migration.readOwnedLocalHistory(102, indexedDB, 100) } catch (error) { timeout = String(error) }
    const timeoutMilliseconds = performance.now() - timeoutStart
    connection.close()
    const upgradedConnection = await upgraded
    upgradedConnection.close()
    // A new upgrade completes only if a timed-out read closes its late connection.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 3)
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
    const afterTimeout = await migration.readOwnedLocalHistory(102)
    const factory = indexedDB as IDBFactory & { databases?: IDBFactory['databases'] }
    Object.defineProperty(factory, 'databases', { configurable: true, value: undefined })
    const missingWithoutEnumeration = await migration.readOwnedLocalHistory(103)
    Reflect.deleteProperty(factory, 'databases')
    const remainingDatabases = await indexedDB.databases()
    return { fresh, empty, populated, original, timeout, timeoutMilliseconds, afterTimeout, missingWithoutEnumeration, remainingDatabases }
  })
  assert.equal(storageFetches, 1)
  assert.equal(result.fresh.marker, 'complete')
  assert.deepEqual(result.fresh.databases, [])
  assert.deepEqual(result.empty, { sessions: [], messages: [], memories: [] })
  assert.deepEqual(result.populated?.sessions, [result.original])
  assert.match(result.timeout, /database open timed out/)
  assert.ok(result.timeoutMilliseconds < 2000)
  assert.deepEqual(result.afterTimeout, result.populated)
  assert.equal(result.missingWithoutEnumeration, null)
  assert.deepEqual(result.remainingDatabases.map((database) => database.name), ['dailywork-ai-chat-user-102'])
  assert.deepEqual(errors, [])
  t.diagnostic(`Native IndexedDB: fresh load ${result.fresh.milliseconds.toFixed(1)}ms; queued-open timeout ${result.timeoutMilliseconds.toFixed(1)}ms; originals unchanged`)
})
