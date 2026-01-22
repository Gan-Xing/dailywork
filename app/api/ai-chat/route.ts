import { NextResponse } from 'next/server'

import {
  getDailyworkChatAdapter,
  getDailyworkChatTools,
} from '@/lib/ai-chat/adapters/dailywork'
import { buildSemanticContext } from '@/lib/ai-chat/adapters/dailywork/semanticContext'
import { runChat } from '@/lib/ai-chat/runtime'
import type { ChatMessage, ChatSession } from '@/lib/ai-chat/types'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

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

export async function POST(request: Request) {
  let payload: ChatRequestBody
  try {
    payload = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const input = normalizeInput(payload.input)
  if (!input) {
    return NextResponse.json({ message: 'input is required' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission('ai-chat:view'))) {
    return NextResponse.json({ message: '缺少 ai-chat:view 权限' }, { status: 403 })
  }

  const session: ChatSession = {
    id: sessionUser.id,
    username: sessionUser.username,
    permissions: sessionUser.permissions,
  }

  const history = normalizeHistory(payload.history)
  const messages: ChatMessage[] = [...history, { role: 'user', content: input }]
  const origin = new URL(request.url).origin
  const cookie = request.headers.get('cookie') ?? ''
  const memoryContext =
    typeof payload.memoryContext === 'string'
      ? payload.memoryContext.trim().slice(0, MAX_MESSAGE_LENGTH)
      : ''
  const semanticContext = await buildSemanticContext({
    query: input,
    locale: payload.locale ?? 'zh',
    permissions: session.permissions,
  })
  const contextMessage = [memoryContext, semanticContext.message]
    .filter((value) => value && value.trim())
    .join('\n\n')

  try {
    const result = await runChat({
      adapter: getDailyworkChatAdapter(),
      tools: getDailyworkChatTools(),
      session,
      locale: payload.locale ?? 'zh',
      contextMessage: contextMessage || undefined,
      contextCandidates: semanticContext.candidates,
      messages,
      permissionChecker: hasPermission,
      request: { origin, cookie },
      enablePlanning: true,
      maxTurns: 6,
      maxSteps: 8,
      maxStepTurns: 6,
    })

    return NextResponse.json({
      answer: result.answer,
      plan: result.plan,
      stepSummaries: result.stepSummaries,
      toolCalls: result.toolCalls,
      usage: result.usage,
    })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 },
    )
  }
}
