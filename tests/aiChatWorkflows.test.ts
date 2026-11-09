import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { PrismaClient, type Prisma } from '@prisma/client'
import { PDFDocument } from 'pdf-lib'

import { parsePlanChanges, planVersion, planWriteFields } from '../lib/ai-chat/weeklyPlanChanges'
import { aiJobCapabilities, canAccessAiJob } from '../lib/ai-chat/permissions'
import { confirmWeeklyPlanJob, getWeeklyPlanSnapshot, prepareWeeklyPlanJob } from '../lib/server/aiChatWorkflowStore'
import { createAiChatSessionStore } from '../lib/server/aiChatSessionStore'
import { runOneAiPdfJob } from '../lib/server/aiChatJobWorker'
import { assertChatSameOrigin } from '../lib/ai-chat/requestOrigin'
import { loadAiConversation, saveAiAnswer } from '../lib/server/aiChatConversation'
import { isAiChatArtifact } from '../lib/files/aiChatArtifacts'

test('weekly changes validate exact dates, IDs, decimals and reject broad/financial writes', () => {
  const row = { type: 'append', changes: { goodsName: '水泥', unit: 'Tonne', plannedQty: '25.0000', deliveryDate: '2026-11-12', phone: 'Bondoukou' } }
  assert.equal(parsePlanChanges([row])[0].changes.phone, 'Bondoukou')
  for (const changes of [{ ...row.changes, plannedQty: -1 }, { ...row.changes, plannedQty: '1e4' },
    { ...row.changes, plannedQty: '1.12345' }, { ...row.changes, deliveryDate: '明天' },
    { ...row.changes, deliveryDate: '2026-02-30' }, { ...row.changes, deliveryDate: '2026-99-99' },
    { ...row.changes, unitPrice: 500 }, { ...row.changes, actualQty: 10 },
    { ...row.changes, status: 'arrived' }, { ...row.changes, sortOrder: 0 }]) {
    assert.throws(() => parsePlanChanges([{ ...row, changes }]))
  }
  assert.throws(() => parsePlanChanges([{ type: 'update', itemId: 1, changes: { supplier: 'SCA' } }, { type: 'update', itemId: 1, changes: { supplier: 'TOTAL' } }]))
  const patch = planWriteFields({ supplier: 'TOTAL' })
  assert.equal(Object.hasOwn(patch, 'plannedQty'), false)
  assert.equal(Object.hasOwn(patch, 'unitPrice'), false)
  assert.equal(Object.hasOwn(patch, 'actualQty'), false)
})

test('plan version covers every row and is independent of object key order', () => {
  assert.equal(planVersion({ a: 1, b: 2 }), planVersion({ b: 2, a: 1 }))
  assert.notEqual(planVersion({ items: [{ id: 1, plannedQty: '25' }] }), planVersion({ items: [{ id: 1, plannedQty: '40' }] }))
})

test('cross-origin action requests cannot be confirmed', () => {
  assert.throws(() => assertChatSameOrigin(new Request('https://example.test/api/ai-chat/jobs/1', { headers: { origin: 'https://attacker.test' } })))
  assert.doesNotThrow(() => assertChatSameOrigin(new Request('https://example.test/api/ai-chat/jobs/1', { headers: { origin: 'https://example.test' } })))
  assert.doesNotThrow(() => assertChatSameOrigin(new Request('http://localhost:3000/api/ai-chat/jobs/1', { headers: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' } })))
})

test('private AI artifact paths cannot be disguised as generic file-manager paths', () => {
  assert.equal(isAiChatArtifact('files/attachment/ai-chat/123/test.pdf'), true)
  assert.equal(isAiChatArtifact('files/attachment/./ai-chat/123/test.pdf'), true)
  assert.equal(isAiChatArtifact('files/attachment/public/../ai-chat/123/test.pdf'), true)
  assert.equal(isAiChatArtifact('files/attachment/../../../private-bucket/files/attachment/ai-chat/123/test.pdf'), true)
  assert.equal(isAiChatArtifact('files/attachment/ordinary.pdf'), false)
})

const databaseUrl = process.env.AI_CHAT_TEST_DATABASE_URL

test('isolated Postgres: workflow, ownership, conflict, PDF recovery and protected history', { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!)
  // Refuse to run fixtures against production or an accidentally shared database.
  assert.equal(url.protocol, 'postgresql:')
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname))
  assert.equal(url.pathname, '/dailywork_ai_test')
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
  const token = randomUUID()
  const project = await db.project.create({ data: { name: `ai-test-${token}`, code: `ai-test-${token}` } })
  const user = await db.user.create({ data: { username: `ai-test-${token}`, passwordHash: 'not-a-real-login' } })
  const other = await db.user.create({ data: { username: `ai-other-${token}`, passwordHash: 'not-a-real-login' } })
  const actor = { id: user.id, username: user.username, roles: ['Member'], permissions: ['ai-chat:view', 'material:view', 'material:create', 'signature:use'] }
  const store = createAiChatSessionStore(db)
  const session = await store.createSession(actor.id, 'Workflow fixture')
  const plan = await db.weeklyDeliveryPlan.create({ data: {
    projectId: project.id, month: 11, session: 1, title: 'TEST-ONLY',
    items: { create: [
      { sortOrder: 0, goodsName: '柴油', unit: 'L', plannedQty: 30000, actualQty: 111, unitPrice: 500, supplier: 'OLA' },
      { sortOrder: 1, goodsName: '水泥', unit: 'Tonne', plannedQty: 25, supplier: 'SCA', phone: 'Agnibilékrou' },
    ] },
  }, include: { items: { orderBy: { sortOrder: 'asc' } } } })
  const request = () => ({ requestId: randomUUID(), sessionId: session.id })
  const update = (supplier = 'TOTAL') => ({ type: 'update', itemId: plan.items[0].id, changes: { supplier } })
  try {
    const document = await PDFDocument.create()
    document.addPage([842, 595])
    const pdfBytes = await document.save()
    const pdfFixture = (fileAssetId: number, signed = false, afterStore?: () => void | Promise<void>) => {
      const filename = `fixture-${fileAssetId}.pdf`
      return {
        filename,
        services: {
          buildAiWeeklyPlanPdf: t.mock.fn(async (planId: number, requestedSigned: boolean) => {
            assert.equal(planId, plan.id)
            assert.equal(requestedSigned, signed)
            const { version } = await getWeeklyPlanSnapshot(actor, planId, db)
            return { buffer: pdfBytes, filename, sourceVersion: version }
          }),
          storeAiPdfArtifact: t.mock.fn(async (userId: number, buffer: Uint8Array, name: string) => {
            assert.equal(userId, actor.id)
            assert.deepEqual(buffer, pdfBytes)
            assert.equal(name, filename)
            assert.equal((await PDFDocument.load(buffer)).getPageCount(), 1)
            await afterStore?.()
            return { fileAssetId }
          }),
          loadAiPdfArtifact: t.mock.fn(async (userId: number, id: number) => {
            assert.equal(userId, actor.id)
            assert.equal(id, fileAssetId)
            return { buffer: pdfBytes, filename }
          }),
        },
      }
    }
    await t.test('preview never mutates business rows and duplicate preview reuses the same job', async () => {
      const context = request()
      const args = { planId: plan.id, operations: [update()] }
      const preview = await prepareWeeklyPlanJob(actor, args, context, db)
      assert.equal(preview.status, 'CONFIRMATION_REQUIRED')
      assert.equal((await db.weeklyDeliveryPlanItem.findUniqueOrThrow({ where: { id: plan.items[0].id } })).supplier, 'OLA')
      assert.equal((await prepareWeeklyPlanJob(actor, args, context, db)).id, preview.id)
    })
    await t.test('confirm verifies exact writes, preserves quantities/prices and is idempotent', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [update()] }, request(), db)
      const completed = await confirmWeeklyPlanJob(actor, preview.id, db)
      assert.equal(completed.status, 'SUCCEEDED')
      assert.equal((await confirmWeeklyPlanJob(actor, preview.id, db)).id, completed.id)
      const row = await db.weeklyDeliveryPlanItem.findUniqueOrThrow({ where: { id: plan.items[0].id } })
      assert.equal(row.supplier, 'TOTAL')
      assert.equal(row.plannedQty?.toString(), '30000')
      assert.equal(row.actualQty?.toString(), '111')
      assert.equal(row.unitPrice?.toString(), '500')
      assert.equal((await db.weeklyDeliveryPlanItem.findUniqueOrThrow({ where: { id: plan.items[1].id } })).supplier, 'SCA')
    })
    await t.test('a colleague changing another row invalidates the whole preview', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [update('SCA')] }, request(), db)
      await db.weeklyDeliveryPlanItem.update({ where: { id: plan.items[1].id }, data: { phone: 'Bondoukou' } })
      await assert.rejects(confirmWeeklyPlanJob(actor, preview.id, db), /changed after preview/)
      assert.equal((await db.weeklyDeliveryPlanItem.findUniqueOrThrow({ where: { id: plan.items[0].id } })).supplier, 'TOTAL')
    })
    await t.test('append goes to the bottom and repeated confirmation creates no duplicate', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [{ type: 'append', changes: {
        goodsName: '钢筋', plannedQty: '9', unit: 'Tonne', deliveryDate: '2026-11-12', phone: 'Bondoukou',
      } }] }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      const rows = await db.weeklyDeliveryPlanItem.findMany({ where: { planId: plan.id }, orderBy: { sortOrder: 'asc' } })
      assert.equal(rows.length, 3)
      assert.equal(rows[2].sortOrder, 2)
      assert.equal(rows[2].phone, 'Bondoukou')
      assert.equal(rows[2].actualQty, null)
    })
    await t.test('simultaneous confirmation commits only once', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [update('TOTAL')] }, request(), db)
      const results = await Promise.all([confirmWeeklyPlanJob(actor, preview.id, db), confirmWeeklyPlanJob(actor, preview.id, db)])
      assert.ok(results.every((job) => job.status === 'SUCCEEDED'))
      assert.equal(results[0].id, results[1].id)
    })
    await t.test('another account and revoked permissions cannot confirm or read history', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [update()] }, request(), db)
      await assert.rejects(confirmWeeklyPlanJob({ ...actor, id: other.id }, preview.id, db), /not found/)
      await assert.rejects(confirmWeeklyPlanJob({ ...actor, permissions: ['ai-chat:view', 'material:view'] }, preview.id, db), /Permission denied/)
      await assert.rejects(store.listMessages(other.id, session.id), /not found/)
      await assert.rejects(store.saveMemory(other.id, 'session', session.id, { content: 'bad' }), /not found/)
    })
    await t.test('wrong-plan rows and expired previews are rejected', async () => {
      await assert.rejects(prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [{ ...update(), itemId: 2147483000 }] }, request(), db), /does not belong/)
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, operations: [update()] }, request(), db)
      await db.aiChatJob.update({ where: { id: preview.id }, data: { expiresAt: new Date(0) } })
      await assert.rejects(confirmWeeklyPlanJob(actor, preview.id, db), /expired/)
    })
    await t.test('server messages survive store recreation and retries do not duplicate messages', async () => {
      const before = await db.aiChatMessage.count({ where: { sessionId: session.id } })
      const message = { sessionId: session.id, clientKey: 'fixture-message-1', role: 'user', content: 'Supplier change' }
      const first = await store.appendMessage(actor.id, message)
      assert.equal((await createAiChatSessionStore(db).appendMessage(actor.id, message)).id, first.id)
      assert.equal((await store.listMessages(actor.id, session.id)).messages.length, before + 1)
      await assert.rejects(store.appendMessage(actor.id, { ...message, content: 'different' }), /different message/)
    })
    await t.test('PDF is generated only after confirmation and publishes one download link', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF', signed: true }, request(), db)
      const fixture = pdfFixture(9000, true)
      const dependencies = {
        jobId: preview.id, db, loadActor: async () => actor, pdfServices: fixture.services,
      }
      assert.equal(await runOneAiPdfJob(dependencies), false)
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 0)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      assert.equal((await confirmWeeklyPlanJob(actor, preview.id, db)).status, 'QUEUED')
      assert.equal(await runOneAiPdfJob(dependencies), true)
      assert.equal(await runOneAiPdfJob(dependencies), false)
      const completed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
      assert.equal(completed.status, 'SUCCEEDED')
      assert.equal(completed.attempts, 1)
      assert.equal((await confirmWeeklyPlanJob(actor, preview.id, db)).status, 'SUCCEEDED')
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 1)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 1)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 0)
      const result = completed.result as Record<string, unknown>
      assert.equal(result.generated, true)
      assert.equal(result.fileAssetId, 9000)
      assert.equal(result.filename, fixture.filename)
      assert.equal(Object.hasOwn(result, 'delivery'), false)
      const notification = await db.aiChatMessage.findUniqueOrThrow({ where: { sessionId_clientKey: { sessionId: session.id, clientKey: `job:${preview.id}` } } })
      assert.ok(notification.content.includes(`[PDF](/api/ai-chat/jobs/${preview.id}/artifact)`))
      assert.doesNotMatch(notification.content, /telegram/i)
      assert.equal(await db.aiChatMessage.count({ where: { sessionId: session.id, clientKey: `job:${preview.id}` } }), 1)
    })
    await t.test('a plan change during artifact storage keeps the checkpoint private and publishes no download link', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF' }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      const fixture = pdfFixture(9007, false, async () => {
        await db.weeklyDeliveryPlan.update({ where: { id: plan.id }, data: { title: 'Changed during artifact storage' } })
      })
      assert.equal(await runOneAiPdfJob({ jobId: preview.id, db, loadActor: async () => actor, pdfServices: fixture.services }), true)
      const failed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
      assert.equal(failed.status, 'FAILED')
      assert.match(failed.error!, /计划发生变化/)
      assert.equal((failed.result as Record<string, unknown>).fileAssetId, 9007)
      assert.equal(aiJobCapabilities(actor, failed).download, false)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 1)
      const notification = await db.aiChatMessage.findUniqueOrThrow({ where: { sessionId_clientKey: { sessionId: session.id, clientKey: `job:${preview.id}` } } })
      assert.doesNotMatch(notification.content, /\[PDF\]|\/artifact|PDF已生成/)
    })
    await t.test('restart resumes a cached PDF artifact without rendering or saving it again', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF' }, request(), db)
      const fixture = pdfFixture(9001)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      await db.aiChatJob.update({ where: { id: preview.id }, data: {
        status: 'RUNNING', leaseToken: randomUUID(), leaseUntil: new Date(0), attempts: 1,
        result: { generated: true, fileAssetId: 9001, filename: fixture.filename },
      } })
      const dependencies = { jobId: preview.id, db, loadActor: async () => actor, pdfServices: fixture.services }
      assert.equal(await runOneAiPdfJob(dependencies), true)
      assert.equal(await runOneAiPdfJob(dependencies), false)
      const completed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
      assert.equal(completed.status, 'SUCCEEDED')
      assert.equal(completed.attempts, 2)
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 0)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 0)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 1)
      assert.equal((completed.result as Record<string, unknown>).fileAssetId, 9001)
      const notifications = await db.aiChatMessage.findMany({ where: { sessionId: session.id, clientKey: `job:${preview.id}` } })
      assert.equal(notifications.length, 1)
      assert.ok(notifications[0].content.includes(`[PDF](/api/ai-chat/jobs/${preview.id}/artifact)`))
      assert.doesNotMatch(notifications[0].content, /telegram/i)
    })
    await t.test('a serialization conflict after artifact save retries only the rolled-back checkpoint', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF' }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      let abortNextTransaction = false
      let injected = 0
      const fixture = pdfFixture(9002, false, () => { abortNextTransaction = true })
      const faultDb = new Proxy(db, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver)
          if (property !== '$transaction') return value
          return (...args: unknown[]) => {
            if (!abortNextTransaction) return Reflect.apply(value, target, args)
            abortNextTransaction = false
            const [operation, ...options] = args
            assert.equal(typeof operation, 'function')
            // Exercise an actual Postgres rollback after the checkpoint's writes.
            return Reflect.apply(value, target, [async (tx: Prisma.TransactionClient) => {
              await (operation as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx)
              const checkpoint = await tx.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
              assert.equal((checkpoint.result as Record<string, unknown>).fileAssetId, 9002)
              injected++
              throw Object.assign(new Error('Fixture aborted transaction'), { code: 'P2034' })
            }, ...options])
          }
        },
      })
      assert.equal(await runOneAiPdfJob({
        jobId: preview.id, db: faultDb, loadActor: async () => actor,
        pdfServices: fixture.services,
      }), true)
      assert.equal(injected, 1)
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 1)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 1)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 0)
      assert.equal((await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })).status, 'SUCCEEDED')
      assert.equal(await db.aiChatMessage.count({ where: { sessionId: session.id, clientKey: `job:${preview.id}` } }), 1)
    })
    await t.test('website previews reject Telegram and legacy Telegram tasks are denied before any PDF access', async () => {
      const countBefore = await db.aiChatJob.count({ where: { userId: actor.id } })
      await assert.rejects(prepareWeeklyPlanJob(actor, {
        planId: plan.id, kind: 'WEEKLY_PDF', telegram: true,
      }, request(), db), /download links only|external delivery is not supported/)
      assert.equal(await db.aiChatJob.count({ where: { userId: actor.id } }), countBefore)

      for (const cached of [false, true]) {
        const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF' }, request(), db)
        await confirmWeeklyPlanJob(actor, preview.id, db)
        const fixture = pdfFixture(9003)
        const legacy = await db.aiChatJob.update({ where: { id: preview.id }, data: {
          input: { ...(preview.input as Record<string, Prisma.InputJsonValue>), telegram: true },
          ...(cached ? {
            status: 'RUNNING', leaseUntil: new Date(0), leaseToken: randomUUID(),
            result: { generated: true, fileAssetId: 9003, delivery: { status: 'sending' } },
          } : {}),
        } })
        assert.equal(canAccessAiJob(actor, legacy), false)
        assert.equal(canAccessAiJob(actor, legacy, true), false)
        await assert.rejects(confirmWeeklyPlanJob(actor, preview.id, db), /Permission denied/)
        assert.equal(await runOneAiPdfJob({
          jobId: preview.id, db, loadActor: async () => actor, pdfServices: fixture.services,
        }), true)
        const failed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
        assert.equal(failed.status, 'FAILED')
        assert.match(failed.error!, /Permission denied/)
        assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 0)
        assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 0)
        assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 0)
      }
    })
    await t.test('fresh permission loss before worker execution prevents export', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF', signed: true }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      const fixture = pdfFixture(9004, true)
      await runOneAiPdfJob({ jobId: preview.id, db,
        loadActor: async () => ({ ...actor, permissions: ['ai-chat:view', 'material:view'] }),
        pdfServices: fixture.services,
      })
      assert.equal((await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })).status, 'FAILED')
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 0)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 0)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 0)
    })
    await t.test('permission loss after render prevents saving the PDF artifact', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF', signed: true }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      const fixture = pdfFixture(9005, true)
      const revokedActor = { ...actor, permissions: actor.permissions.filter((permission) => permission !== 'signature:use') }
      let reads = 0
      assert.equal(await runOneAiPdfJob({
        jobId: preview.id, db, pdfServices: fixture.services,
        loadActor: async () => ++reads === 1 ? actor : revokedActor,
      }), true)
      const failed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
      assert.equal(failed.status, 'FAILED')
      assert.match(failed.error!, /Permission denied/)
      assert.equal(reads, 2)
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 1)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 0)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 0)
      assert.equal(Object.hasOwn(failed.result as Record<string, unknown>, 'fileAssetId'), false)
      const notification = await db.aiChatMessage.findUniqueOrThrow({ where: { sessionId_clientKey: { sessionId: session.id, clientKey: `job:${preview.id}` } } })
      assert.doesNotMatch(notification.content, /\[PDF\]|PDF已生成/)
    })
    await t.test('permission loss after loading a resumed artifact prevents task success', async () => {
      const preview = await prepareWeeklyPlanJob(actor, { planId: plan.id, kind: 'WEEKLY_PDF', signed: true }, request(), db)
      await confirmWeeklyPlanJob(actor, preview.id, db)
      const fixture = pdfFixture(9006, true)
      await db.aiChatJob.update({ where: { id: preview.id }, data: {
        status: 'RUNNING', leaseUntil: new Date(0), leaseToken: randomUUID(),
        result: { generated: true, fileAssetId: 9006, filename: fixture.filename },
      } })
      const revokedActor = { ...actor, permissions: actor.permissions.filter((permission) => permission !== 'signature:use') }
      let reads = 0
      assert.equal(await runOneAiPdfJob({
        jobId: preview.id, db, pdfServices: fixture.services,
        loadActor: async () => ++reads === 1 ? actor : revokedActor,
      }), true)
      const failed = await db.aiChatJob.findUniqueOrThrow({ where: { id: preview.id } })
      assert.equal(failed.status, 'FAILED')
      assert.match(failed.error!, /Permission denied/)
      assert.equal(canAccessAiJob(revokedActor, failed, true), false)
      assert.equal(reads, 2)
      assert.equal(fixture.services.buildAiWeeklyPlanPdf.mock.callCount(), 0)
      assert.equal(fixture.services.storeAiPdfArtifact.mock.callCount(), 0)
      assert.equal(fixture.services.loadAiPdfArtifact.mock.callCount(), 1)
      const notification = await db.aiChatMessage.findUniqueOrThrow({ where: { sessionId_clientKey: { sessionId: session.id, clientKey: `job:${preview.id}` } } })
      assert.doesNotMatch(notification.content, /PDF已生成/)
    })
    await t.test('snapshot completeness is based on all stored plan rows', async () => {
      const snapshot = await getWeeklyPlanSnapshot(actor, plan.id, db)
      assert.deepEqual(snapshot.coverage, { complete: true, total: 3, returned: 3 })
    })
    await t.test('persisted answers retain grant provenance and are redacted from revoked history and model context', async () => {
      const protectedSession = await store.createSession(actor.id, 'Protected permission fixture')
      const requestId = randomUUID()
      const secret = `Protected material answer ${token}`
      await saveAiAnswer(actor.id, protectedSession.id, requestId, secret, store, actor)
      const persisted = await db.aiChatMessage.findUniqueOrThrow({ where: {
        sessionId_clientKey: { sessionId: protectedSession.id, clientKey: `answer:${requestId}` },
      } })
      assert.equal(persisted.content, secret)
      assert.deepEqual([...persisted.requiredPermissions].sort(), [...actor.permissions].sort())
      assert.equal(persisted.requiresAdmin, false)

      const recreated = createAiChatSessionStore(db)
      const authorized = await recreated.listMessages(actor.id, protectedSession.id, { access: actor })
      assert.equal(authorized.messages.length, 1)
      assert.equal(authorized.messages[0].content, secret)
      const revokedActor = { ...actor, permissions: actor.permissions.filter((permission) => permission !== 'material:view') }
      const revoked = await recreated.listMessages(actor.id, protectedSession.id, { access: revokedActor })
      assert.equal(revoked.messages.length, 1)
      assert.notEqual(revoked.messages[0].content, secret)
      assert.ok(!JSON.stringify(revoked).includes(secret))
      const conversation = await loadAiConversation(actor.id, protectedSession.id, 'Summarize my history', randomUUID(), recreated, revokedActor)
      assert.ok(conversation)
      assert.equal(conversation.messages[0].content, revoked.messages[0].content)
      assert.ok(!JSON.stringify(conversation).includes(secret))
      assert.equal((await recreated.listMessages(actor.id, protectedSession.id, { access: actor })).messages[0].content, secret)
      assert.equal((await db.aiChatMessage.findUniqueOrThrow({ where: { id: persisted.id } })).content, secret)
    })
    await t.test('persisted Admin answers require the original role even when every permission is retained', async () => {
      const protectedSession = await store.createSession(actor.id, 'Protected Admin fixture')
      const requestId = randomUUID()
      const secret = `Admin-only answer ${token}`
      const adminActor = { ...actor, roles: ['Admin'] }
      await saveAiAnswer(actor.id, protectedSession.id, requestId, secret, store, adminActor)
      const persisted = await db.aiChatMessage.findUniqueOrThrow({ where: {
        sessionId_clientKey: { sessionId: protectedSession.id, clientKey: `answer:${requestId}` },
      } })
      assert.equal(persisted.content, secret)
      assert.deepEqual([...persisted.requiredPermissions].sort(), [...adminActor.permissions].sort())
      assert.equal(persisted.requiresAdmin, true)

      const recreated = createAiChatSessionStore(db)
      assert.equal((await recreated.listMessages(actor.id, protectedSession.id, { access: adminActor })).messages[0].content, secret)
      const revokedActor = { ...adminActor, roles: ['Member'] }
      assert.deepEqual(revokedActor.permissions, adminActor.permissions)
      const revoked = await recreated.listMessages(actor.id, protectedSession.id, { access: revokedActor })
      assert.equal(revoked.messages.length, 1)
      assert.notEqual(revoked.messages[0].content, secret)
      assert.ok(!JSON.stringify(revoked).includes(secret))
      const conversation = await loadAiConversation(actor.id, protectedSession.id, 'Summarize my history', randomUUID(), recreated, revokedActor)
      assert.ok(conversation)
      assert.equal(conversation.messages[0].content, revoked.messages[0].content)
      assert.ok(!JSON.stringify(conversation).includes(secret))
      assert.equal((await recreated.listMessages(actor.id, protectedSession.id, { access: adminActor })).messages[0].content, secret)
      assert.equal((await db.aiChatMessage.findUniqueOrThrow({ where: { id: persisted.id } })).requiresAdmin, true)
    })
    await t.test('an asynchronous answer cannot enter another owner reusing a deleted UUID', async () => {
      const previous = await store.createSession(actor.id, 'A-owned')
      await store.deleteSession(actor.id, previous.id)
      await store.createSession(other.id, 'B-owned', previous.id)
      await assert.rejects(saveAiAnswer(actor.id, previous.id, randomUUID(), 'A private answer', store), /not found/)
      await assert.rejects(loadAiConversation(actor.id, previous.id, 'A question', randomUUID(), store), /not found/)
      assert.equal((await store.listMessages(other.id, previous.id)).messages.length, 0)
    })
  } finally {
    await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } })
    await db.project.delete({ where: { id: project.id } })
    await db.$disconnect()
  }
})
