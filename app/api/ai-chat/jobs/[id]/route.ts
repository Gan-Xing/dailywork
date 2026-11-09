import { after, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { readAiChatJsonBody } from '@/lib/ai-chat/requestBody'
import { assertChatSameOrigin, requireUuid } from '@/lib/ai-chat/requestOrigin'
import { AiBusinessError } from '@/lib/ai-chat/weeklyPlanChanges'
import { requireAiChatActor } from '@/lib/server/aiChatAccess'
import { assertAiJobPermission, cancelAiJob, confirmWeeklyPlanJob, publicAiJob } from '@/lib/server/aiChatWorkflowStore'

export const maxDuration = 300

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertChatSameOrigin(request)
    const actor = await requireAiChatActor()
    const id = requireUuid((await params).id)
    const body = await readAiChatJsonBody<{ action?: string }>(request)
    if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status })
    if (body.value.action === 'cancel') {
      await cancelAiJob(actor, id)
      return NextResponse.json({ ok: true })
    }
    let job
    if (body.value.action === 'confirm') {
      job = await confirmWeeklyPlanJob(actor, id)
    } else if (body.value.action === 'retry') {
      const previous = await prisma.aiChatJob.findFirst({ where: { id, userId: actor.id } })
      if (!previous || previous.kind !== 'WEEKLY_PDF') throw new AiBusinessError('Task not found.', 404)
      assertAiJobPermission(actor, previous)
      if (previous.status !== 'FAILED' || previous.attempts >= 3) {
        throw new AiBusinessError('This task cannot be retried. Request a fresh PDF task.', 409)
      }
      const changed = await prisma.aiChatJob.updateMany({
        where: { id, userId: actor.id, status: previous.status, updatedAt: previous.updatedAt },
        data: { status: 'QUEUED', error: null, leaseToken: null, leaseUntil: null },
      })
      if (changed.count !== 1) throw new AiBusinessError('Task changed; refresh first.', 409)
      job = await prisma.aiChatJob.findUniqueOrThrow({ where: { id } })
    } else throw new AiBusinessError('Unknown action.')
    if (job.status === 'QUEUED') {
      after(async () => {
        try {
          const { runOneAiPdfJob } = await import('@/lib/server/aiChatJobWorker')
          await runOneAiPdfJob({ jobId: id })
        } catch {
          console.error('[ai-chat-job] worker wake-up failed; task retained for recovery')
        }
      })
    }
    return NextResponse.json({ job: publicAiJob(job, actor) })
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500
    return NextResponse.json({ message: status < 500 && error instanceof Error ? error.message : 'Operation failed; no completion is claimed.' }, { status })
  }
}
