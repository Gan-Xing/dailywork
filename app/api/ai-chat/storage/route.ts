import { NextResponse } from 'next/server'

import { readAiChatJsonBody } from '@/lib/ai-chat/requestBody'
import { assertChatSameOrigin } from '@/lib/ai-chat/requestOrigin'
import { AiBusinessError } from '@/lib/ai-chat/weeklyPlanChanges'
import { AiChatError, requireAiChatActor } from '@/lib/server/aiChatAccess'
import { aiChatSessionStore } from '@/lib/server/aiChatSessionStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (value: unknown, status = 200) => NextResponse.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store' },
})

const failure = (error: unknown) => {
  if (error instanceof AiChatError || error instanceof AiBusinessError) {
    return json({ message: error.message }, error.status)
  }
  console.error('[ai-chat/storage] Request failed')
  return json({ message: 'AI chat storage failed. Please retry.' }, 500)
}

export async function GET(request: Request) {
  try {
    const actor = await requireAiChatActor()
    const query = new URL(request.url).searchParams
    switch (query.get('action')) {
      case 'sessions':
        return json({ sessions: await aiChatSessionStore.listSessions(actor.id) })
      case 'messages':
        return json(await aiChatSessionStore.listMessages(actor.id, query.get('sessionId'), {
          beforeId: query.get('beforeId') ?? undefined,
          limit: query.get('limit') ?? undefined,
          access: actor,
        }))
      case 'memory':
        return json({ memory: await aiChatSessionStore.getMemory(actor.id, query.get('scopeType'), query.get('scopeKey')) ?? null })
      default:
        throw new AiChatError('Unknown storage read action')
    }
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    assertChatSameOrigin(request)
    const actor = await requireAiChatActor()
    const body = await readAiChatJsonBody<Record<string, unknown>>(request)
    if (!body.ok) throw new AiChatError(body.message, body.status)
    const payload = body.value
    switch (payload.action) {
      case 'createSession':
        return json({ session: await aiChatSessionStore.createSession(actor.id, payload.summary, payload.importId) })
      case 'appendMessage':
        return json({ message: await aiChatSessionStore.appendMessage(actor.id, payload.message) })
      case 'updateSession':
        return json({ session: await aiChatSessionStore.updateSession(actor.id, payload.sessionId, payload.patch) })
      case 'deleteSession':
        await aiChatSessionStore.deleteSession(actor.id, payload.sessionId)
        return json({ ok: true })
      case 'saveMemory':
        return json({ memory: await aiChatSessionStore.saveMemory(actor.id, payload.scopeType, payload.scopeKey, payload.patch, {
          onlyIfMissing: payload.onlyIfMissing,
        }) })
      default:
        throw new AiChatError('Unknown storage write action')
    }
  } catch (error) {
    return failure(error)
  }
}
