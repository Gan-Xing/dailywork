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
import { ResponsesAdapterError } from '@/lib/ai-chat/adapters/responsesAdapter'
import type { ChatMessage, ChatSession } from '@/lib/ai-chat/types'
import { getSessionUser } from '@/lib/server/authSession'
import { assertAiChatGrantsUnchanged, loadAiChatActor } from '@/lib/server/aiChatAccess'
import { loadAiConversation, saveAiAnswer } from '@/lib/server/aiChatConversation'
import { assertChatSameOrigin } from '@/lib/ai-chat/requestOrigin'
import { buildAiChatInternalCookie } from '@/lib/server/aiChatInternalRequest'

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
  const messages: ChatMessage[] = [...history, { role: 'user', content: input }]
  const origin = process.env.AI_CHAT_INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`
  const memoryContext =
    typeof payload.memoryContext === 'string'
      ? payload.memoryContext.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''
  const startedAt = Date.now()

  try {
    const conversation = await loadAiConversation(session.id, payload.sessionId, input, requestId, undefined, session)
    const savedMessages = conversation?.messages ?? messages
    const semanticContext = await buildSemanticContext({
      query: input,
      locale: payload.locale ?? 'zh',
      permissions: session.permissions,
    })
    const contextMessage = semanticContext.message
    const adapter = getDailyworkChatAdapter()
    const result = await runChat({
      adapter,
      tools: getDailyworkChatTools(),
      session,
      locale: payload.locale ?? 'zh',
      contextMessage: contextMessage || undefined,
      userContextMessage: memoryContext || undefined,
      contextCandidates: semanticContext.candidates,
      messages: savedMessages,
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
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(180000)]),
      },
      enablePlanning: true,
      maxTurns: 6,
      maxSteps: 8,
      maxStepTurns: 6,
    })

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

    return NextResponse.json(
      {
        answer: result.answer,
        plan: result.plan,
        stepSummaries: result.stepSummaries,
        toolCalls: canDebug ? result.toolCalls : undefined,
        sources: result.sources,
        usage: result.usage,
        requestId,
      },
      { headers: responseHeaders },
    )
  } catch (error) {
    console.error('[ai-chat]', JSON.stringify({
      event: 'failed',
      requestId,
      userId: session.id,
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }))
    return NextResponse.json(
      { message: canDebug && error instanceof Error ? error.message : 'AI chat failed. Please retry.', requestId },
      { status: error instanceof ResponsesAdapterError ? 503 : error && typeof error === 'object' && 'status' in error && error.status === 403 ? 403 : 500, headers: responseHeaders },
    )
  } finally {
    lease.release()
  }
}
