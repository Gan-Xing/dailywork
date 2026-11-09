import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { objectValue } from '@/lib/ai-chat/weeklyPlanChanges'
import { assertAiJobPermission, getWeeklyPlanSnapshot, jsonValue } from './aiChatWorkflowStore'
import { loadAiChatActor } from './aiChatAccess'
import { requiredAiJobPermissions } from '@/lib/ai-chat/permissions'

type WorkerDependencies = {
  jobId?: string
  db?: PrismaClient
  loadActor?: typeof loadAiChatActor
  pdfServices?: Pick<typeof import('./aiChatArtifacts'), 'buildAiWeeklyPlanPdf' | 'storeAiPdfArtifact' | 'loadAiPdfArtifact'>
}

// This worker handles fixed business operations, never model-generated code or SQL.
export const runOneAiPdfJob = async (dependencies: WorkerDependencies = {}) => {
  const db = dependencies.db ?? prisma
  const loadActor = dependencies.loadActor ?? loadAiChatActor
  const now = new Date()
  const ready = { ...(dependencies.jobId ? { id: dependencies.jobId } : {}), kind: 'WEEKLY_PDF', OR: [
    { status: 'QUEUED' },
    { status: 'RUNNING', leaseUntil: { lt: now } },
  ] }
  const candidate = await db.aiChatJob.findFirst({ where: ready, orderBy: { createdAt: 'asc' } })
  if (!candidate) return false
  const leaseToken = randomUUID()
  const claim = await db.aiChatJob.updateMany({
    where: { id: candidate.id, ...ready },
    data: { status: 'RUNNING', leaseToken, leaseUntil: new Date(Date.now() + 10 * 60_000), attempts: { increment: 1 } },
  })
  if (claim.count !== 1) return false
  const job = await db.aiChatJob.findUniqueOrThrow({ where: { id: candidate.id } })
  const input = objectValue(job.input)
  let result: Record<string, unknown> = job.result ? objectValue(job.result) : {}
  const checkpoint = async (status: string, error: string | null = null) => {
    const persist = () => db.$transaction(async (tx) => {
      const saved = await tx.aiChatJob.updateMany({
        where: { id: job.id, userId: job.userId, status: 'RUNNING', leaseToken },
        data: { status, result: jsonValue(result), error, ...(status !== 'RUNNING' ? { leaseToken: null, leaseUntil: null } : {}) },
      })
      if (saved.count !== 1) throw new Error('Task lease lost.')
      if (status === 'RUNNING') return
      const current = await tx.aiChatJob.findUniqueOrThrow({ where: { id: job.id } })
      if (!current.sessionId || !await tx.aiChatSession.findFirst({
        where: { id: current.sessionId, userId: current.userId }, select: { id: true },
      })) return
      const link = status === 'SUCCEEDED' && typeof result.fileAssetId === 'number' ? `\n[PDF](/api/ai-chat/jobs/${job.id}/artifact)` : ''
      const content = `${error ?? (typeof result.message === 'string' ? result.message : '任务未完成。')}${link}`
      await tx.aiChatMessage.upsert({
        where: { sessionId_clientKey: { sessionId: current.sessionId, clientKey: `job:${job.id}` }, session: { userId: current.userId } },
        create: { sessionId: current.sessionId, clientKey: `job:${job.id}`, role: 'assistant', content, requiredPermissions: requiredAiJobPermissions(job) },
        update: { content, requiredPermissions: requiredAiJobPermissions(job) },
      })
    }, { isolationLevel: 'Serializable' })
    for (let attempt = 0; ; attempt++) {
      try { await persist(); return }
      catch (error) {
        const aborted = error && typeof error === 'object' && 'code' in error && error.code === 'P2034'
        if (aborted && attempt < 2) continue
        throw error
      }
    }
  }
  try {
    const actor = await loadActor(job.userId)
    assertAiJobPermission(actor, job)
    const snapshot = await getWeeklyPlanSnapshot(actor, Number(input.planId), db)
    if (snapshot.version !== input.version) throw new Error('计划已修改，请重新请求最新PDF。')
    const { buildAiWeeklyPlanPdf, storeAiPdfArtifact, loadAiPdfArtifact } = dependencies.pdfServices ?? await import('./aiChatArtifacts')
    if (typeof result.fileAssetId === 'number') {
      await loadAiPdfArtifact(actor.id, result.fileAssetId)
    } else {
      const pdf = await buildAiWeeklyPlanPdf(Number(input.planId), input.signed === true)
      const afterActor = await loadActor(job.userId)
      assertAiJobPermission(afterActor, job)
      const after = await getWeeklyPlanSnapshot(afterActor, Number(input.planId), db)
      if (after.version !== input.version) throw new Error('导出期间计划发生变化，请重新生成。')
      result = { ...result, ...await storeAiPdfArtifact(actor.id, pdf.buffer, pdf.filename), filename: pdf.filename, generated: true }
      await checkpoint('RUNNING')
    }
    const currentActor = await loadActor(job.userId)
    assertAiJobPermission(currentActor, job)
    if ((await getWeeklyPlanSnapshot(currentActor, Number(input.planId), db)).version !== input.version) {
      throw new Error('计划发生变化，未提供旧版PDF，请重新生成。')
    }
    result.message = `周计划 ${input.planId} 的${input.signed === true ? '签字版' : '无签字版'}PDF已生成，请使用下载链接。`
    await checkpoint('SUCCEEDED')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF task failed.'
    await checkpoint('FAILED', message).catch(() => undefined)
  }
  return true
}
