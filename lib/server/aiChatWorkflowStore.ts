import { createHash } from 'node:crypto'

import { Prisma, type AiChatJob, type PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { ChatSession } from '@/lib/ai-chat/types'
import { canAccessAiJob, aiJobCapabilities, requiredAiJobPermissions } from '@/lib/ai-chat/permissions'
import {
  AiBusinessError, objectValue, parsePlanChanges, planVersion, planWriteFields,
  positiveId, stableJson,
} from '@/lib/ai-chat/weeklyPlanChanges'

const planInclude = {
  project: { select: { id: true, name: true, code: true } },
  items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.WeeklyDeliveryPlanInclude

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value))

export const assertAiPermission = (actor: ChatSession, ...permissions: string[]) => {
  if (!actor.permissions.includes('ai-chat:view') || permissions.some((permission) => !actor.permissions.includes(permission))) {
    throw new AiBusinessError('Permission denied.', 403)
  }
}

export const assertAiJobPermission = (actor: ChatSession, job: { kind: string; input: unknown }, artifact = false) => {
  if (!canAccessAiJob(actor, job, artifact)) throw new AiBusinessError('Permission denied.', 403)
}

export const getWeeklyPlanSnapshot = async (actor: ChatSession, planId: number, db = prisma) => {
  assertAiPermission(actor, 'material:view')
  const plan = await db.weeklyDeliveryPlan.findUnique({ where: { id: positiveId(planId) }, include: planInclude })
  if (!plan) throw new AiBusinessError('Weekly plan not found.', 404)
  return { plan: jsonValue(plan), version: planVersion(plan), coverage: { complete: true, total: plan.items.length, returned: plan.items.length } }
}

const sessionOwned = async (db: PrismaClient, userId: number, sessionId?: string) => {
  if (!sessionId) throw new AiBusinessError('A saved chat session is required.')
  const session = await db.aiChatSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } })
  if (!session) throw new AiBusinessError('Chat session not found.', 404)
  return sessionId
}

export type WorkflowRequest = { requestId: string; sessionId?: string }

export const prepareWeeklyPlanJob = async (
  actor: ChatSession,
  args: Record<string, unknown>,
  request: WorkflowRequest,
  db = prisma,
) => {
  assertAiPermission(actor, 'material:view')
  const sessionId = await sessionOwned(db, actor.id, request.sessionId)
  const planId = positiveId(args.planId)
  const kind = args.kind === 'WEEKLY_PDF' ? 'WEEKLY_PDF' : 'WEEKLY_PLAN_CHANGE'
  if (args.telegram === true) throw new AiBusinessError('Website AI provides download links only; external delivery is not supported.')
  assertAiJobPermission(actor, { kind, input: args })
  const operations = kind === 'WEEKLY_PLAN_CHANGE' ? parsePlanChanges(args.operations) : undefined
  const snapshot = await getWeeklyPlanSnapshot(actor, planId, db)
  const plan = objectValue(snapshot.plan)
  const items = plan.items as Record<string, unknown>[]
  for (const operation of operations ?? []) {
    if (operation.type === 'update' && !items.some((item) => item.id === operation.itemId)) {
      throw new AiBusinessError('The requested row does not belong to this plan.', 404)
    }
    const existing = items.find((item) => item.id === operation.itemId)
    if (existing && (existing.status === 'arrived' || existing.status === 'in_transit')) {
      throw new AiBusinessError('Dispatched or received rows require manual editing.', 409)
    }
  }
  const input = {
    planId, version: snapshot.version,
    title: String(plan.title),
    ...(operations ? { operations } : { signed: args.signed === true }),
    preview: operations?.map((operation) => ({
      ...operation,
      before: operation.type === 'update'
        ? items.find((item) => item.id === operation.itemId)
        : null,
    })),
  }
  const requestKey = createHash('sha256')
    .update(`${request.requestId}:${kind}:${stableJson(input)}`).digest('hex')
  return db.aiChatJob.upsert({
    where: { userId_requestKey: { userId: actor.id, requestKey } },
    create: {
      userId: actor.id, sessionId, requestKey, kind, status: 'CONFIRMATION_REQUIRED',
      input: jsonValue(input), expiresAt: new Date(Date.now() + 30 * 60_000),
    },
    update: {},
  })
}

export const publicAiJob = (job: AiChatJob, actor?: ChatSession) => ({
  id: job.id, kind: job.kind, status: job.status,
  input: job.input, result: job.result, error: job.error,
  createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(),
  expiresAt: job.expiresAt?.toISOString() ?? null,
  ...(actor ? { capabilities: aiJobCapabilities(actor, job) } : {}),
})

const confirmWeeklyPlanJobOnce = async (actor: ChatSession, jobId: string, db = prisma) => {
  assertAiPermission(actor, 'material:view')
  return db.$transaction(async (tx) => {
    const job = await tx.aiChatJob.findFirst({ where: { id: jobId, userId: actor.id } })
    if (!job) throw new AiBusinessError('Task not found.', 404)
    const input = objectValue(job.input)
    assertAiJobPermission(actor, job)
    if (job.status === 'SUCCEEDED' || (job.kind === 'WEEKLY_PDF' &&
        ['QUEUED', 'RUNNING', 'FAILED'].includes(job.status))) return job
    if (job.status !== 'CONFIRMATION_REQUIRED') throw new AiBusinessError('Task is not waiting for confirmation.', 409)
    if (!job.expiresAt || job.expiresAt.getTime() <= Date.now()) throw new AiBusinessError('Preview expired; request a fresh preview.', 409)
    const planId = positiveId(input.planId)
    const plan = await tx.weeklyDeliveryPlan.findUnique({ where: { id: planId }, include: planInclude })
    if (!plan || planVersion(plan) !== input.version) throw new AiBusinessError('The plan changed after preview; refresh before confirming.', 409)
    if (job.kind === 'WEEKLY_PDF') {
      const queued = await tx.aiChatJob.updateMany({
        where: { id: job.id, userId: actor.id, status: 'CONFIRMATION_REQUIRED' },
        data: { status: 'QUEUED', expiresAt: null },
      })
      if (queued.count !== 1) throw new AiBusinessError('Task already changed.', 409)
      return (await tx.aiChatJob.findUniqueOrThrow({ where: { id: job.id } }))
    }
    const operations = parsePlanChanges(input.operations)
    let nextOrder = Math.max(-1, ...plan.items.map((item) => item.sortOrder)) + 1
    const changedIds: number[] = []
    for (const operation of operations) {
      const fields = planWriteFields(operation.changes)
      const { model, ...scalarFields } = fields
      const data = { ...scalarFields, ...(model !== undefined ? { model: model === null ? Prisma.JsonNull : jsonValue(model) } : {}) }
      if (operation.type === 'append') {
        const item = await tx.weeklyDeliveryPlanItem.create({ data: { ...data, planId, sortOrder: nextOrder++ } })
        changedIds.push(item.id)
      } else {
        const existing = plan.items.find((item) => item.id === operation.itemId)
        if (!existing || existing.status === 'arrived' || existing.status === 'in_transit') {
          throw new AiBusinessError('Row changed or no longer editable.', 409)
        }
        const updated = await tx.weeklyDeliveryPlanItem.updateMany({
          where: { id: existing.id, planId, updatedAt: existing.updatedAt }, data,
        })
        if (updated.count !== 1) throw new AiBusinessError('Concurrent row update; refresh the preview.', 409)
        changedIds.push(existing.id)
      }
    }
    await tx.weeklyDeliveryPlan.update({ where: { id: planId }, data: { updatedById: actor.id } })
    const rows = await tx.weeklyDeliveryPlanItem.findMany({ where: { id: { in: changedIds }, planId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
    if (rows.length !== changedIds.length) throw new AiBusinessError('Write verification failed.', 409)
    for (let index = 0; index < operations.length; index++) {
      const row = rows.find((item) => item.id === changedIds[index])!
      for (const [field, expected] of Object.entries(operations[index].changes)) {
        const actual = row[field as keyof typeof row]
        const equal = field === 'plannedQty' && expected !== null
          ? actual !== null && new Prisma.Decimal(String(actual)).equals(String(expected))
          : stableJson(JSON.parse(JSON.stringify(actual ?? null))) === stableJson(expected)
        if (!equal) throw new AiBusinessError(`Write verification failed for ${field}.`, 409)
      }
    }
    const result = {
      verified: true, planId, changedIds, rows,
      message: `已更新周计划 ${planId}，回查确认 ${rows.length} 行。未修改其他行。`,
    }
    const completed = await tx.aiChatJob.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', result: jsonValue(result) } })
    if (completed.sessionId && await tx.aiChatSession.findFirst({ where: { id: completed.sessionId, userId: actor.id }, select: { id: true } })) {
      await tx.aiChatMessage.upsert({
        where: { sessionId_clientKey: { sessionId: completed.sessionId, clientKey: `job:${job.id}` }, session: { userId: actor.id } },
        create: { sessionId: completed.sessionId, clientKey: `job:${job.id}`, role: 'assistant', content: result.message, requiredPermissions: requiredAiJobPermissions(job) }, update: {},
      })
    }
    return completed
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export const confirmWeeklyPlanJob = async (actor: ChatSession, jobId: string, db = prisma) => {
  for (let attempt = 0; ; attempt++) {
    try { return await confirmWeeklyPlanJobOnce(actor, jobId, db) }
    catch (error) {
      const conflict = error && typeof error === 'object' && 'code' in error && error.code === 'P2034'
      // P2034 means the whole transaction aborted. Recheck the job before any retry.
      if (conflict && attempt < 2) continue
      if (conflict) throw new AiBusinessError('Concurrent change; refresh the preview.', 409)
      throw error
    }
  }
}

export const cancelAiJob = async (actor: ChatSession, id: string, db = prisma) => {
  assertAiPermission(actor)
  const stopped = await db.aiChatJob.updateMany({
    where: { id, userId: actor.id, status: { in: ['CONFIRMATION_REQUIRED', 'QUEUED'] } },
    data: { status: 'CANCELLED' },
  })
  if (stopped.count !== 1) throw new AiBusinessError('Task cannot be cancelled or was not found.', 409)
}
