import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import test, { beforeEach } from 'node:test'

import { PDFDocument, PDFName } from 'pdf-lib'
import type { Browser, LaunchOptions } from 'puppeteer'

const require = createRequire(import.meta.url)
const realPuppeteer = require('puppeteer').default as typeof import('puppeteer').default
const PDF = Buffer.from('%PDF-1.7\nfixture\n%%EOF')
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const fixturePlan = () => ({
  id: 11,
  title: 'M3S3',
  month: 3,
  session: 3,
  weekStartDate: new Date('2026-03-01T00:00:00Z'),
  weekEndDate: new Date('2026-03-08T00:00:00Z'),
  updatedAt: new Date('2026-03-01T01:00:00Z'),
  approverUserId: 21 as number | null,
  editorUserId: 22 as number | null,
  project: { id: 1, name: 'Bondoukou fixture', code: 'project-bondoukou-city' },
  projects: [],
  items: [
    {
      id: 101, sortOrder: 1, updatedAt: new Date('2026-03-01T02:00:00Z'),
      status: 'planned', deliveryDate: '2026-03-04', supplier: 'Fixture <supplier>',
      goodsName: 'diesel', goodsNameKey: 'diesel', model: [], unit: 'L', plannedQty: 1200,
      transporter: 'Fixture Transport', headPlateNumber: 'TEST-01', tailPlateNumber: 'TEST-02', phone: '',
    },
    {
      id: 102, sortOrder: 2, updatedAt: new Date('2026-03-01T03:00:00Z'),
      status: 'cancelled', deliveryDate: null, supplier: 'CANCELLED-SUPPLIER',
      goodsName: 'cement', goodsNameKey: 'cement', model: [], unit: 't', plannedQty: 200,
      transporter: '', headPlateNumber: '', tailPlateNumber: '', phone: '',
    },
  ],
})

type FileRecord = {
  id: number
  category: string
  storageKey: string
  bucket: string
  originalName: string
  mimeType: string
  size: number
  checksum: string | null
  ownerUserId: number | null
  createdById: number | null
}
type FileWhere = Partial<Omit<FileRecord, 'storageKey'>> & { storageKey?: { startsWith: string } }
type Signature = { isActive: boolean; file: { storageKey: string } }
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

const newState = () => ({
  plan: fixturePlan() as ReturnType<typeof fixturePlan> | null,
  files: [] as FileRecord[],
  objects: new Map<string, Buffer>(),
  signatures: new Map<number, Signature>([
    [21, { isActive: true, file: { storageKey: 'signature-approver' } }],
    [22, { isActive: true, file: { storageKey: 'signature-editor' } }],
  ]),
  signatureQueries: [] as number[],
  legacySignatureCalls: 0,
  permissions: new Set(['material:view', 'signature:use']),
  presignedKeys: [] as string[],
  uploads: [] as string[],
  deletions: [] as string[],
  downloads: [] as string[],
  queries: [] as FileWhere[],
  events: [] as string[],
  profiles: [] as string[],
  html: '',
  imagesLoaded: [true, true],
  failure: '' as string,
  createFailure: false,
  deleteFailure: false,
  uploadFailure: false,
  locks: [] as string[],
  transactionQueue: Promise.resolve(),
  signatureUrl: 'data:image/png;base64,fixture',
  launch: null as ((options: LaunchOptions) => Promise<Browser>) | null,
  newPage: null as (() => Promise<unknown>) | null,
  evaluate: null as ((callback: () => Promise<boolean[]>) => Promise<boolean[]>) | null,
})
let state = newState()

const fakePage = () => ({
  setContent: async (html: string) => {
    state.events.push('content')
    state.html = html
    if (state.failure === 'content') throw new Error('content failed')
  },
  evaluate: async (callback: () => Promise<boolean[]>) => {
    state.events.push('assets')
    if (state.failure === 'assets') throw new Error('assets failed')
    return state.evaluate ? state.evaluate(callback) : state.imagesLoaded
  },
  pdf: async (options: { landscape: boolean; format: string }) => {
    state.events.push('pdf')
    assert.equal(options.landscape, true)
    assert.equal(options.format, 'A4')
    if (state.failure === 'pdf') throw new Error('pdf failed')
    return PDF
  },
  close: async () => {
    state.events.push('page:close')
    if (state.failure === 'page:close') throw new Error('close failed')
  },
})
const fakeBrowser = () => ({
  newPage: async () => {
    state.events.push('page:new')
    if (state.failure === 'page:new') throw new Error('page failed')
    return state.newPage ? state.newPage() : fakePage()
  },
  close: async () => {
    state.events.push('browser:close')
    if (state.failure === 'browser:close') throw new Error('close failed')
  },
  process: () => ({ kill: () => { state.events.push('browser:kill'); return true } }),
})

const fileAsset = {
  findFirst: async ({ where }: { where: FileWhere }) => {
    state.queries.push(where)
    return state.files.find((file) => Object.entries(where).every(([key, value]) =>
      key === 'storageKey'
        ? file.storageKey.startsWith((value as { startsWith: string }).startsWith)
        : file[key as keyof FileRecord] === value)) ?? null
  },
  create: async ({ data }: { data: Omit<FileRecord, 'id'> }) => {
    if (state.createFailure) throw new Error('database failed')
    const file = { ...data, id: state.files.length + 1 }
    state.files.push(file)
    return file
  },
}
const tx = {
  fileAsset,
  $executeRaw: async (_strings: TemplateStringsArray, key: string) => {
    state.locks.push(key)
    return 1
  },
}
const prisma = {
  fileAsset,
  weeklyDeliveryPlan: {
    findUnique: async ({ where, include }: { where: { id: number }; include: unknown }) => {
      assert.equal(where.id, 11)
      assert.ok(include)
      return state.plan
    },
  },
  userSignature: {
    findFirst: async ({ where }: { where: { userId: number; isActive: boolean } }) => {
      assert.equal(where.isActive, true, 'AI must never query inactive signature fallback')
      state.signatureQueries.push(where.userId)
      const signature = state.signatures.get(where.userId)
      return signature?.isActive ? signature : null
    },
  },
  $transaction: async (callback: (context: typeof tx) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { timeout: 30_000 })
    const previous = state.transactionQueue
    const release = deferred<void>()
    state.transactionQueue = release.promise
    await previous
    try { return await callback(tx) } finally { release.resolve() }
  },
}

// tsx's CJS loader lets the normal unit command isolate server-only dependencies
// without experimental module-mock flags or any production database/R2 access.
const mockModule = (specifier: string, exports: unknown) => {
  const id = require.resolve(specifier)
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
mockModule('server-only', {})
mockModule('../lib/prisma', { prisma })
mockModule('../lib/server/authSession', {
  hasPermission: async (permission: string) => state.permissions.has(permission),
})
mockModule('../lib/server/signatureStore', {
  getWeeklyPlanSignatureUrls: async () => {
    state.legacySignatureCalls++
    if (state.failure === 'signature') throw new Error('legacy signature unavailable')
    return { approver: state.signatureUrl, editor: state.signatureUrl }
  },
})
mockModule('../lib/server/r2', {
  getR2Config: () => ({ bucket: 'private-fixture' }),
  createPresignedUrl: ({ storageKey }: { storageKey: string }) => {
    state.presignedKeys.push(storageKey)
    return state.signatureUrl
  },
  uploadObjectBuffer: async (key: string, bytes: Uint8Array, mime: string) => {
    assert.equal(mime, 'application/pdf')
    state.uploads.push(key)
    state.objects.set(key, Buffer.from(bytes))
    if (state.uploadFailure) throw new Error('upload failed')
  },
  deleteObject: async (key: string) => {
    state.deletions.push(key)
    if (state.deleteFailure) throw new Error('delete failed')
    state.objects.delete(key)
  },
  downloadObjectBuffer: async (key: string) => {
    state.downloads.push(key)
    const buffer = state.objects.get(key)
    if (!buffer) throw new Error('missing object')
    return buffer
  },
})
mockModule('puppeteer', {
  __esModule: true,
  default: {
    launch: async (options: LaunchOptions) => {
      state.events.push('launch')
      state.profiles.push(options.userDataDir!)
      await fs.access(options.userDataDir!)
      if (state.failure === 'launch') throw new Error('launch failed')
      return state.launch ? state.launch(options) : fakeBrowser()
    },
  },
})
const {
  buildAiWeeklyPlanPdf, getWeeklyPlanVersion, loadAiPdfArtifact, storeAiPdfArtifact,
} = require('../lib/server/aiChatArtifacts') as typeof import('../lib/server/aiChatArtifacts')
const { buildWeeklyPlanPdf } = require('../lib/server/weeklyPlanPdfExport') as typeof import('../lib/server/weeklyPlanPdfExport')
const { GET } = require('../app/api/weekly-plans/[id]/export/route') as typeof import('../app/api/weekly-plans/[id]/export/route')

beforeEach(() => { state = newState() })

test('weekly plan version is deterministic and detects head, item, deletion and row-order changes', () => {
  const plan = fixturePlan()
  const version = getWeeklyPlanVersion(plan)
  assert.match(version, /^[a-f0-9]{64}$/)
  assert.equal(getWeeklyPlanVersion({ ...plan, items: [...plan.items].reverse() }), version)
  assert.equal(getWeeklyPlanVersion({ ...plan, updatedAt: plan.updatedAt.toISOString() }), version)
  assert.notEqual(getWeeklyPlanVersion({ ...plan, updatedAt: new Date('2026-03-02') }), version)
  assert.notEqual(getWeeklyPlanVersion({ ...plan, items: plan.items.slice(0, 1) }), version)
  for (const field of ['updatedAt', 'sortOrder', 'id'] as const) {
    const items = plan.items.map((item) => ({ ...item }))
    if (field === 'updatedAt') items[1].updatedAt = new Date('2026-03-03')
    else items[1][field]++
    assert.notEqual(getWeeklyPlanVersion({ ...plan, items }), version, field)
  }
  assert.equal(plan.items[0].id, 101, 'Fingerprinting must not mutate input')
})

test('unsigned AI export uses current template/data without retrieving any signatures or cookies', async () => {
  const result = await buildAiWeeklyPlanPdf(11, false)
  assert.deepEqual(result.buffer, PDF)
  assert.equal(result.filename, 'weekly-plan-M3S3.pdf')
  assert.equal(result.sourceVersion, getWeeklyPlanVersion(state.plan!))
  assert.deepEqual(state.signatureQueries, [])
  assert.deepEqual(state.presignedKeys, [])
  assert.equal(state.legacySignatureCalls, 0)
  assert.ok(state.html.includes('BDK/20260304'))
  assert.ok(state.html.includes('Fixture &lt;supplier&gt;'))
  assert.ok(!state.html.includes('CANCELLED-SUPPLIER'))
  assert.ok(!state.html.includes('<img'))
  assert.deepEqual(state.events, ['launch', 'page:new', 'content', 'assets', 'pdf', 'page:close', 'browser:close'])
  assert.equal(existsSync(state.profiles[0]), false)
})

test('signed AI export uses only both required active signatures', async () => {
  await buildAiWeeklyPlanPdf(11, true)
  assert.deepEqual(state.signatureQueries, [21, 22])
  assert.deepEqual(state.presignedKeys, ['signature-approver', 'signature-editor'])
  assert.equal(state.legacySignatureCalls, 0)
  assert.equal((state.html.match(/<img /g) ?? []).length, 2)
})

test('signed AI export rejects absent approver/editor and missing or inactive signatures explicitly', async () => {
  for (const role of ['approver', 'editor'] as const) {
    state.plan = fixturePlan()
    state.plan[`${role}UserId`] = null
    await assert.rejects(buildAiWeeklyPlanPdf(11, true), new RegExp(role))
    state.plan = fixturePlan()
    state.signatures.set(role === 'approver' ? 21 : 22, {
      isActive: false, file: { storageKey: 'inactive-signature-must-never-be-used' },
    })
    await assert.rejects(buildAiWeeklyPlanPdf(11, true), /active.*signature/)
    state.signatures.delete(role === 'approver' ? 21 : 22)
    await assert.rejects(buildAiWeeklyPlanPdf(11, true), /active.*signature/)
    state = newState()
  }
  assert.equal(state.legacySignatureCalls, 0)
  assert.deepEqual(state.profiles, [])
})

test('legacy export retains best-effort signature behavior, while AI fails on unloaded signature images', async (t) => {
  state.failure = 'signature'
  t.mock.method(console, 'warn', () => {})
  assert.ok(await buildWeeklyPlanPdf(11, { signed: true }))
  assert.equal(state.legacySignatureCalls, 1)
  assert.deepEqual(state.signatureQueries, [])
  state.failure = ''
  state.imagesLoaded = [true, false]
  await assert.rejects(buildAiWeeklyPlanPdf(11, true), /signature image/)
  assert.equal(existsSync(state.profiles[1]), false)
})

test('HTTP export route retains permissions, default Excel, PDF headers and opt-in signature permission', async () => {
  const params = { params: Promise.resolve({ id: '11' }) }
  const pdfRequest = () => new Request('https://dailywork.invalid/api/weekly-plans/11/export?format=pdf')
  state.permissions.clear()
  const denied = await GET(pdfRequest(), params)
  assert.equal(denied.status, 403)
  assert.deepEqual(state.events, [])

  state.permissions.add('material:view')
  const unsigned = await GET(pdfRequest(), params)
  assert.equal(unsigned.status, 200)
  assert.equal(unsigned.headers.get('Content-Type'), 'application/pdf')
  assert.equal(unsigned.headers.get('Content-Disposition'), 'inline; filename="weekly-plan-M3S3.pdf"')
  assert.equal(unsigned.headers.get('Content-Length'), String(PDF.length))
  assert.equal(state.legacySignatureCalls, 0)
  assert.deepEqual(state.signatureQueries, [])

  state.permissions.add('signature:use')
  assert.equal((await GET(pdfRequest(), params)).status, 200)
  assert.equal(state.legacySignatureCalls, 1)
  assert.deepEqual(state.signatureQueries, [])

  const workbook = await GET(new Request('https://dailywork.invalid/api/weekly-plans/11/export'), params)
  assert.equal(workbook.status, 200)
  assert.equal(workbook.headers.get('Content-Type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  assert.equal(workbook.headers.get('Content-Disposition'), 'attachment; filename="weekly-plan-M3S3.xlsx"')
  assert.equal(Buffer.from(await workbook.arrayBuffer()).subarray(0, 2).toString(), 'PK')
  assert.equal(state.legacySignatureCalls, 1, 'Excel must not retrieve signatures')
})

test('HTTP export route retains not-found and render-error statuses', async (t) => {
  const params = { params: Promise.resolve({ id: '11' }) }
  state.plan = null
  for (const format of ['pdf', 'excel']) {
    const response = await GET(new Request(`https://dailywork.invalid/api/weekly-plans/11/export?format=${format}`), params)
    assert.equal(response.status, 404)
  }
  state.plan = fixturePlan()
  state.failure = 'pdf'
  t.mock.method(console, 'error', () => {})
  const response = await GET(new Request('https://dailywork.invalid/api/weekly-plans/11/export?format=pdf'), params)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { message: 'pdf failed' })
})

test('AI export rejects invalid IDs, untrusted signed types and nonexistent plans', async () => {
  for (const id of [0, -1, NaN, 1.5]) await assert.rejects(buildAiWeeklyPlanPdf(id, false), /ID/)
  await assert.rejects(buildAiWeeklyPlanPdf(11, 'true' as unknown as boolean), /boolean/)
  state.plan = null
  await assert.rejects(buildAiWeeklyPlanPdf(11, false), /not found/)
  assert.deepEqual(state.events, [])
})

test('renderer actually waits for fonts and image decoding before printing', async (t) => {
  const fonts = deferred<FontFaceSet>()
  const image = deferred<void>()
  const entered = deferred<void>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { fonts: { ready: fonts.promise }, images: [{ decode: () => image.promise, naturalWidth: 100 }] },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  state.evaluate = async (callback) => { entered.resolve(); return callback() }
  const pending = buildAiWeeklyPlanPdf(11, true)
  await entered.promise
  assert.ok(!state.events.includes('pdf'))
  fonts.resolve({} as FontFaceSet)
  await flush()
  assert.ok(!state.events.includes('pdf'))
  image.resolve()
  await pending
  assert.ok(state.events.includes('pdf'))
})

test('all launch/render/close failure paths remove the profile and release acquired browser/page', async () => {
  for (const failure of ['launch', 'page:new', 'content', 'assets', 'pdf', 'page:close', 'browser:close']) {
    state = newState()
    state.failure = failure
    if (failure.endsWith(':close')) await buildAiWeeklyPlanPdf(11, false)
    else await assert.rejects(buildAiWeeklyPlanPdf(11, false))
    assert.equal(existsSync(state.profiles[0]), false, failure)
    assert.equal(state.events.includes('browser:close'), failure !== 'launch', failure)
    assert.equal(state.events.includes('page:close'), !['launch', 'page:new'].includes(failure), failure)
    assert.equal(state.events.includes('browser:kill'), failure === 'browser:close', failure)
  }
})

test('late browser acquisition after launch timeout is closed and its profile is removed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const launch = deferred<Browser>()
  const entered = deferred<void>()
  state.launch = () => { entered.resolve(); return launch.promise }
  const rejection = assert.rejects(buildAiWeeklyPlanPdf(11, false), /Launch browser timed out/)
  await entered.promise
  t.mock.timers.tick(30_000)
  await rejection
  assert.equal(existsSync(state.profiles[0]), false)
  launch.resolve(fakeBrowser() as unknown as Browser)
  await flush()
  assert.ok(state.events.includes('browser:close'))
})

test('late page acquisition after timeout is closed even after browser cleanup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const page = deferred<unknown>()
  const entered = deferred<void>()
  state.newPage = () => { entered.resolve(); return page.promise }
  const rejection = assert.rejects(buildAiWeeklyPlanPdf(11, false), /Create page timed out/)
  await entered.promise
  t.mock.timers.tick(12_000)
  await rejection
  assert.equal(existsSync(state.profiles[0]), false)
  page.resolve(fakePage())
  await flush()
  assert.ok(state.events.includes('page:close'))
})

test('artifact store persists correct owner/creator, SHA256 and private R2 metadata and reads bytes back', async () => {
  assert.deepEqual(await storeAiPdfArtifact(7, PDF, '../weekly-plan.pdf'), { fileAssetId: 1 })
  const file = state.files[0]
  assert.equal(file.ownerUserId, 7)
  assert.equal(file.createdById, 7)
  assert.equal(file.bucket, 'private-fixture')
  assert.equal(file.category, 'attachment')
  assert.equal(file.mimeType, 'application/pdf')
  assert.equal(file.originalName, 'weekly-plan.pdf')
  assert.equal(file.size, PDF.byteLength)
  assert.equal(file.checksum, hash(PDF))
  assert.match(file.storageKey, /^files\/attachment\/ai-chat\/7\/[a-f0-9-]+\.pdf$/)
  assert.deepEqual(state.locks, [`7:${hash(PDF)}`])
  assert.deepEqual(await loadAiPdfArtifact(7, 1), { buffer: PDF, filename: 'weekly-plan.pdf' })
  assert.deepEqual(state.downloads, [file.storageKey])
})

test('SHA256 deduplication is scoped to the same owner, creator, PDF type, bucket and AI namespace', async () => {
  await storeAiPdfArtifact(7, PDF, 'report.pdf')
  assert.deepEqual(await storeAiPdfArtifact(7, PDF, 'renamed.pdf'), { fileAssetId: 1 })
  assert.equal(state.uploads.length, 1)
  assert.deepEqual(await storeAiPdfArtifact(8, PDF, 'report.pdf'), { fileAssetId: 2 })
  for (const patch of [
    { createdById: 99 }, { mimeType: 'image/png' }, { bucket: 'other-bucket' },
    { storageKey: 'files/attachment/user-provided-checksum.pdf' },
  ]) {
    state = newState()
    await storeAiPdfArtifact(7, PDF, 'report.pdf')
    Object.assign(state.files[0], patch)
    assert.deepEqual(await storeAiPdfArtifact(7, PDF, 'report.pdf'), { fileAssetId: 2 })
  }
})

test('simultaneous equal artifacts create one row and remove only the losing unique upload', async () => {
  const [first, second] = await Promise.all([
    storeAiPdfArtifact(7, PDF, 'first.pdf'), storeAiPdfArtifact(7, PDF, 'second.pdf'),
  ])
  assert.deepEqual(first, second)
  assert.equal(state.files.length, 1)
  assert.equal(state.uploads.length, 2)
  assert.equal(state.deletions.length, 1)
  assert.notEqual(state.deletions[0], state.files[0].storageKey)
  assert.equal(state.objects.size, 1)
})

test('artifact store compensates DB/upload failure and surfaces a failed compensating delete', async () => {
  for (const failure of ['createFailure', 'uploadFailure'] as const) {
    state = newState()
    state[failure] = true
    await assert.rejects(storeAiPdfArtifact(7, PDF, 'report.pdf'), /failed/)
    assert.deepEqual(state.deletions, state.uploads)
    assert.equal(state.objects.size, 0)
    assert.equal(state.files.length, 0)
  }
  state = newState()
  state.createFailure = true
  state.deleteFailure = true
  await assert.rejects(storeAiPdfArtifact(7, PDF, 'report.pdf'), (error: unknown) =>
    error instanceof AggregateError && error.errors.length === 2)
})

test('artifact reads enforce owner plus PDF MIME/bucket and validate downloaded PDF/checksum', async () => {
  await storeAiPdfArtifact(7, PDF, 'report.pdf')
  await assert.rejects(loadAiPdfArtifact(8, 1), /not found/)
  await assert.rejects(loadAiPdfArtifact(7, 999), /not found/)
  for (const patch of [{ mimeType: 'image/png' }, { ownerUserId: null }, { bucket: 'other-bucket' }]) {
    const original = { ...state.files[0] }
    Object.assign(state.files[0], patch)
    await assert.rejects(loadAiPdfArtifact(7, 1), /not found/)
    Object.assign(state.files[0], original)
  }
  assert.deepEqual(state.downloads, [])
  state.objects.set(state.files[0].storageKey, Buffer.from('not a PDF'))
  await assert.rejects(loadAiPdfArtifact(7, 1), /PDF document/)
  state.objects.set(state.files[0].storageKey, Buffer.from('%PDF-1.7\ntampered'))
  await assert.rejects(loadAiPdfArtifact(7, 1), /checksum mismatch/)
})

test('artifact storage rejects invalid owner, resource IDs and non-PDF bytes without writes', async () => {
  for (const id of [0, -1, 1.5, NaN]) {
    await assert.rejects(storeAiPdfArtifact(id, PDF, 'report.pdf'), /ID/)
    await assert.rejects(loadAiPdfArtifact(id, 1), /ID/)
    await assert.rejects(loadAiPdfArtifact(7, id), /ID/)
  }
  await assert.rejects(storeAiPdfArtifact(7, Buffer.from('HTML'), 'report.pdf'), /PDF/)
  await assert.rejects(storeAiPdfArtifact(7, Buffer.from([37, 80, 68, 70, 45, 0xb1, 46, 55]), 'report.pdf'), /PDF/)
  assert.deepEqual(state.uploads, [])
  assert.deepEqual(state.queries, [])
})

const chromePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? '/opt/google/chrome/chrome'
test('real Chromium renders the existing template and embeds active signatures in a landscape PDF', {
  skip: !existsSync(chromePath),
  timeout: 60_000,
}, async () => {
  const sharp = require('sharp') as typeof import('sharp')
  const image = await sharp({ create: {
    width: 180, height: 52, channels: 4, background: { r: 15, g: 30, b: 140, alpha: 1 },
  } }).png().toBuffer()
  state.signatureUrl = `data:image/png;base64,${image.toString('base64')}`
  state.launch = (options) => realPuppeteer.launch({ ...options, executablePath: chromePath })
  const result = await buildAiWeeklyPlanPdf(11, true)
  const pdf = await PDFDocument.load(result.buffer)
  assert.equal(pdf.getPageCount(), 1)
  assert.ok(pdf.getPage(0).getWidth() > pdf.getPage(0).getHeight())
  const images = pdf.context.enumerateIndirectObjects().filter(([, object]) => {
    const dictionary = object as unknown as { dict?: { get(key: PDFName): unknown } }
    return String(dictionary.dict?.get(PDFName.of('Subtype'))) === '/Image'
  })
  assert.ok(images.length > 0, 'Signature images must be embedded, not silently omitted')
  assert.equal(existsSync(state.profiles[0]), false)
})
