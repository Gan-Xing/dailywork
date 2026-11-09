import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireUuid } from '@/lib/ai-chat/requestOrigin'
import { objectValue, AiBusinessError } from '@/lib/ai-chat/weeklyPlanChanges'
import { requireAiChatActor } from '@/lib/server/aiChatAccess'
import { assertAiJobPermission } from '@/lib/server/aiChatWorkflowStore'
import { loadAiPdfArtifact } from '@/lib/server/aiChatArtifacts'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAiChatActor()
    const job = await prisma.aiChatJob.findFirst({ where: { id: requireUuid((await params).id), userId: actor.id } })
    if (!job || job.kind !== 'WEEKLY_PDF' || !job.result) throw new AiBusinessError('PDF not found.', 404)
    assertAiJobPermission(actor, job, true)
    if (job.status !== 'SUCCEEDED') throw new AiBusinessError('PDF has not passed final validation.', 409)
    const result = objectValue(job.result)
    if (typeof result.fileAssetId !== 'number') throw new AiBusinessError('PDF is not generated yet.', 409)
    const pdf = await loadAiPdfArtifact(actor.id, result.fileAssetId)
    assertAiJobPermission(await requireAiChatActor(), job, true)
    return new Response(new Uint8Array(pdf.buffer), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="weekly-plan.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500
    return NextResponse.json({ message: status < 500 && error instanceof Error ? error.message : 'PDF unavailable.' }, { status })
  }
}
