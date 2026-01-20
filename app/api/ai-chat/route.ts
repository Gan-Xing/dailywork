import { NextResponse } from 'next/server'

import { getDailyworkChatAdapter, getDailyworkChatTools } from '@/lib/ai-chat/adapters/dailywork'
import { runChat } from '@/lib/ai-chat/runtime'
import type { ChatMessage, ChatSession } from '@/lib/ai-chat/types'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY = 20

type ChatRequestBody = {
  input?: string
  history?: Array<{ role?: string; content?: string }>
  locale?: string
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

  const session: ChatSession = {
    id: sessionUser.id,
    username: sessionUser.username,
    permissions: sessionUser.permissions,
  }

  const history = normalizeHistory(payload.history)
  const messages: ChatMessage[] = [...history, { role: 'user', content: input }]
  const origin = new URL(request.url).origin
  const cookie = request.headers.get('cookie') ?? ''

  try {
    const result = await runChat({
      adapter: getDailyworkChatAdapter(),
      tools: getDailyworkChatTools(),
      session,
      locale: payload.locale ?? 'zh',
      messages,
      permissionChecker: hasPermission,
      request: { origin, cookie },
      enablePlanning: true,
      maxSteps: 6,
      maxStepTurns: 4,
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
