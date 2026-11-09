import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireUuid } from '@/lib/ai-chat/requestOrigin'
import { requireAiChatActor } from '@/lib/server/aiChatAccess'
import { assertAiPermission, publicAiJob } from '@/lib/server/aiChatWorkflowStore'
import { canAccessAiJob } from '@/lib/ai-chat/permissions'

export async function GET(request: Request) {
  try {
    const actor = await requireAiChatActor()
    assertAiPermission(actor, 'material:view')
    const sessionId = requireUuid(new URL(request.url).searchParams.get('sessionId'))
    const jobs = await prisma.aiChatJob.findMany({
      where: { userId: actor.id, sessionId }, orderBy: { createdAt: 'desc' }, take: 100,
    })
    return NextResponse.json({ jobs: jobs.filter((job) => canAccessAiJob(actor, job)).map((job) => publicAiJob(job, actor)) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500
    return NextResponse.json({ message: status < 500 && error instanceof Error ? error.message : 'Task list unavailable.' }, { status })
  }
}
