import { NextResponse } from 'next/server'

import {
  getDailyworkChatAdapter,
  getDailyworkChatTools,
} from '@/lib/ai-chat/adapters/dailywork'
import { buildSemanticContext } from '@/lib/ai-chat/adapters/dailywork/semanticContext'
import { runChat } from '@/lib/ai-chat/runtime'
import type { ChatMessage, ChatSession, ChatStreamEvent, ModelAdapter } from '@/lib/ai-chat/types'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY = 20

type ChatRequestBody = {
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
  let payload: ChatRequestBody
  try {
    payload = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const input = normalizeInput(payload.input)
  if (!input) {
    return NextResponse.json({ message: 'input is required' }, { status: 400 })
  }
  if (input.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ message: 'input is too long' }, { status: 413 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission('ai-chat:view'))) {
    return NextResponse.json({ message: '缺少 ai-chat:view 权限' }, { status: 403 })
  }
  const canDebug = await hasPermission('ai-chat:debug')

  const session: ChatSession = {
    id: sessionUser.id,
    username: sessionUser.username,
    permissions: sessionUser.permissions,
  }

  const history = normalizeHistory(payload.history)
  const messages: ChatMessage[] = [...history, { role: 'user', content: input }]
  const origin = process.env.AI_CHAT_INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`
  const cookie = request.headers.get('cookie') ?? ''
  const encoder = new TextEncoder()
  const memoryContext =
    typeof payload.memoryContext === 'string'
      ? payload.memoryContext.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''

  let finalSent = false
  const semanticContext = await buildSemanticContext({
    query: input,
    locale: payload.locale ?? 'zh',
    permissions: session.permissions,
  })
  const contextMessage = semanticContext.message

  let adapter: ModelAdapter
  try {
    adapter = getDailyworkChatAdapter()
  } catch {
    return NextResponse.json({ message: 'AI chat model is not configured' }, { status: 503 })
  }
  const startedAt = Date.now()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (event.type === 'final') finalSent = true
        const visibleEvent: ChatStreamEvent = canDebug
          ? event
          : event.type === 'tool_result'
            ? { ...event, result: { ok: event.result.ok, content: event.result.content } }
            : event.type === 'final'
              ? { ...event, toolCalls: undefined }
              : event
        controller.enqueue(encoder.encode(buildEventMessage(visibleEvent)))
      }

      send({
        type: 'status',
        message: payload.locale === 'fr' ? 'Traitement en cours…' : '正在处理…',
      })

      runChat({
        adapter,
        tools: getDailyworkChatTools(),
        session,
        locale: payload.locale ?? 'zh',
        contextMessage: contextMessage || undefined,
        userContextMessage: memoryContext || undefined,
        contextCandidates: semanticContext.candidates,
        messages,
        permissionChecker: hasPermission,
        request: { origin, cookie, signal: AbortSignal.any([request.signal, AbortSignal.timeout(180000)]) },
        enablePlanning: true,
        maxTurns: 6,
        maxSteps: 8,
        maxStepTurns: 6,
        onEvent: send,
      })
        .then((result) => {
          console.info('[ai-chat]', JSON.stringify({
            event: 'completed',
            userId: session.id,
            model: adapter.name,
            durationMs: Date.now() - startedAt,
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
          controller.close()
        })
        .catch((error) => {
          console.error('[ai-chat]', JSON.stringify({
            event: 'failed',
            userId: session.id,
            model: adapter.name,
            durationMs: Date.now() - startedAt,
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }))
          send({
            type: 'error',
            message: canDebug && error instanceof Error ? error.message : 'AI chat failed. Please retry.',
          })
          controller.close()
        })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
