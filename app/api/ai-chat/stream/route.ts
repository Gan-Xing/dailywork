import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  getDailyworkChatAdapter,
  getDailyworkChatTools,
} from '@/lib/ai-chat/adapters/dailywork'
import { buildSemanticContext } from '@/lib/ai-chat/adapters/dailywork/semanticContext'
import { runChat } from '@/lib/ai-chat/runtime'
import { aiChatRequestGuard } from '@/lib/ai-chat/requestGuard'
import { readAiChatJsonBody } from '@/lib/ai-chat/requestBody'
import type { ChatMessage, ChatSession, ChatStreamEvent, ModelAdapter } from '@/lib/ai-chat/types'
import { getSessionUser } from '@/lib/server/authSession'
import { assertAiChatGrantsUnchanged, loadAiChatActor } from '@/lib/server/aiChatAccess'
import { loadAiConversation, saveAiAnswer } from '@/lib/server/aiChatConversation'
import { assertChatSameOrigin } from '@/lib/ai-chat/requestOrigin'
import { buildAiChatInternalCookie } from '@/lib/server/aiChatInternalRequest'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY = 20

type ChatRequestBody = {
  sessionId?: string
  input?: string
  history?: Array<{ role?: string; content?: string }>
  locale?: string
  memoryContext?: string
}

const isValidRole = (role: string): role is ChatMessage['role'] =>
  role === 'user' || role === 'assistant'

const normalizeHistory = (history: ChatRequestBody['history']): ChatMessage[] => {
  if (!Array.isArray(history)) return []
  const normalized: ChatMessage[] = []
  for (const entry of history.slice(-MAX_HISTORY)) {
    if (!entry || typeof entry.content !== 'string' || typeof entry.role !== 'string') continue
    if (!isValidRole(entry.role)) continue
    const content = entry.content.trim()
    if (!content) continue
    normalized.push({
      role: entry.role,
      content: content.length > MAX_MESSAGE_LENGTH ? `${content.slice(0, MAX_MESSAGE_LENGTH)}...` : content,
    })
  }
  return normalized
}

const normalizeInput = (input?: string) => {
  if (!input || typeof input !== 'string') return ''
  return input.trim()
}

const buildEventMessage = (event: ChatStreamEvent) => `data: ${JSON.stringify(event)}\n\n`

export async function POST(request: Request) {
  const identity = await getSessionUser()
  if (!identity) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  let sessionUser
  try {
    assertChatSameOrigin(request)
    sessionUser = await loadAiChatActor(identity.id)
  } catch {
    return NextResponse.json({ message: 'AI access denied.' }, { status: 403 })
  }
  const canDebug = sessionUser.permissions.includes('ai-chat:debug')
  const requestId = randomUUID()
  const lease = aiChatRequestGuard.acquire(sessionUser.id)
  const responseHeaders = { 'X-AI-Request-ID': requestId, 'Cache-Control': 'no-store' }
  if (!lease.ok) {
    console.warn('[ai-chat]', JSON.stringify({
      event: 'rejected',
      requestId,
      userId: sessionUser.id,
      reason: lease.reason,
    }))
    return NextResponse.json(
      { message: 'AI chat is busy. Please retry shortly.', requestId },
      {
        status: 429,
        headers: { ...responseHeaders, 'Retry-After': String(lease.retryAfterSeconds) },
      },
    )
  }

  const bodyResult = await readAiChatJsonBody<ChatRequestBody>(request)
  if (!bodyResult.ok) {
    lease.release()
    return NextResponse.json(
      { message: bodyResult.message, requestId },
      { status: bodyResult.status, headers: responseHeaders },
    )
  }
  const payload = bodyResult.value
  const input = normalizeInput(payload.input)
  if (!input || input.length > MAX_MESSAGE_LENGTH) {
    lease.release()
    const missing = !input
    return NextResponse.json(
      { message: missing ? 'input is required' : 'input is too long', requestId },
      { status: missing ? 400 : 413, headers: responseHeaders },
    )
  }

  const session: ChatSession = {
    id: sessionUser.id,
    username: sessionUser.username,
    permissions: sessionUser.permissions,
    roles: sessionUser.roles,
  }

  const history = normalizeHistory(payload.history)
  let conversation
  try {
    conversation = await loadAiConversation(session.id, payload.sessionId, input, requestId, undefined, session)
  } catch {
    lease.release()
    return NextResponse.json({ message: 'Chat session unavailable.' }, { status: 404 })
  }
  const messages: ChatMessage[] = conversation?.messages ?? [...history, { role: 'user', content: input }]
  const origin = process.env.AI_CHAT_INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`
  const encoder = new TextEncoder()
  const memoryContext =
    typeof payload.memoryContext === 'string'
      ? payload.memoryContext.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''

  let finalSent = false
  let semanticContext: Awaited<ReturnType<typeof buildSemanticContext>>
  try {
    semanticContext = await buildSemanticContext({
      query: input,
      locale: payload.locale ?? 'zh',
      permissions: session.permissions,
    })
  } catch (error) {
    lease.release()
    console.error('[ai-chat]', JSON.stringify({
      event: 'failed',
      requestId,
      userId: session.id,
      stage: 'semantic_context',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }))
    return NextResponse.json(
      { message: 'AI chat is unavailable. Please retry later.', requestId },
      { status: 500, headers: responseHeaders },
    )
  }
  let adapter: ModelAdapter
  try {
    adapter = getDailyworkChatAdapter()
  } catch (error) {
    lease.release()
    console.error('[ai-chat]', JSON.stringify({
      event: 'failed',
      requestId,
      userId: session.id,
      stage: 'adapter_config',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }))
    return NextResponse.json(
      { message: 'AI chat model is not configured.', requestId },
      { status: 503, headers: responseHeaders },
    )
  }
  const contextMessage = semanticContext.message
  const startedAt = Date.now()
  const streamAbort = new AbortController()
  let streamClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (streamClosed) return
        if (event.type === 'final') finalSent = true
        const visibleEvent: ChatStreamEvent = canDebug
          ? event
          : event.type === 'tool_result'
            ? { ...event, result: { ok: event.result.ok, content: event.result.content, jobId: event.result.jobId } }
            : event.type === 'final'
            ? { ...event, toolCalls: undefined }
              : event
        try {
          controller.enqueue(encoder.encode(buildEventMessage(visibleEvent)))
        } catch {
          streamClosed = true
          streamAbort.abort()
        }
      }
      const close = () => {
        if (streamClosed) return
        streamClosed = true
        try {
          controller.close()
        } catch {
          // The client may have closed the stream first.
        }
      }

      send({
        type: 'status',
        message: payload.locale === 'fr' ? 'Traitement en cours…' : '正在处理…',
      })

      void runChat({
        adapter,
        tools: getDailyworkChatTools(),
        session,
        locale: payload.locale ?? 'zh',
        contextMessage: contextMessage || undefined,
        userContextMessage: memoryContext || undefined,
        contextCandidates: semanticContext.candidates,
        messages,
        permissionChecker: async (permission) => {
          try { return (await loadAiChatActor(session.id)).permissions.includes(permission) }
          catch { return false }
        },
        accessPermission: 'ai-chat:view',
        roleChecker: async (role) => {
          try { return (await loadAiChatActor(session.id)).roles?.includes(role) === true }
          catch { return false }
        },
        workflow: { requestId, sessionId: conversation?.id },
        request: {
          origin,
          getCookie: async () => { await assertAiChatGrantsUnchanged(session); return buildAiChatInternalCookie(session) },
          assertScope: async () => { await assertAiChatGrantsUnchanged(session) },
          signal: AbortSignal.any([request.signal, streamAbort.signal, AbortSignal.timeout(180000)]),
        },
        enablePlanning: true,
        maxTurns: 6,
        maxSteps: 8,
        maxStepTurns: 6,
        onEvent: (event) => { if (event.type !== 'final') send(event) },
      })
        .then(async (result) => {
          await assertAiChatGrantsUnchanged(session)
          await saveAiAnswer(session.id, conversation?.id, requestId, result.answer, undefined, session)
          console.info('[ai-chat]', JSON.stringify({
            event: 'completed',
            requestId,
            userId: session.id,
            model: adapter.name,
            durationMs: Date.now() - startedAt,
            modelCalls: result.modelCalls,
            tokenUsage: result.usage?.totalTokens ?? null,
            sourceCount: result.sources.length,
            toolErrors: result.toolCalls.filter((call) => !call.result.ok).length,
          }))
          if (!finalSent) {
            send({
              type: 'final',
              answer: result.answer,
              plan: result.plan,
              stepSummaries: result.stepSummaries,
              toolCalls: result.toolCalls,
              sources: result.sources,
            })
          }
          close()
        })
        .catch((error) => {
          const cancelled = streamAbort.signal.aborted || request.signal.aborted
          const log = cancelled ? console.info : console.error
          log('[ai-chat]', JSON.stringify({
            event: cancelled ? 'cancelled' : 'failed',
            requestId,
            userId: session.id,
            model: adapter.name,
            durationMs: Date.now() - startedAt,
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }))
          if (!cancelled) {
            send({
              type: 'error',
              message: canDebug && error instanceof Error ? error.message : 'AI chat failed. Please retry.',
            })
          }
          close()
        })
        .finally(() => lease.release())
    },
    cancel() {
      streamClosed = true
      streamAbort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      ...responseHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
