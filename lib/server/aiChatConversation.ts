import type { ChatMessage, ChatSession } from '@/lib/ai-chat/types'
import { requireUuid } from '@/lib/ai-chat/requestOrigin'
import { aiChatSessionStore } from './aiChatSessionStore'

export const loadAiConversation = async (userId: number, sessionId: unknown, input: string, requestId?: string, store = aiChatSessionStore, access?: ChatSession) => {
  if (sessionId === undefined) return null
  const id = requireUuid(sessionId)
  const { messages: rows } = await store.listMessages(userId, id, { limit: 20, access })
  const history = rows.map((row): ChatMessage => ({ role: row.role === 'user' ? 'user' : 'assistant', content: row.content.slice(0, 8000) }))
  if (history.at(-1)?.role === 'user' && history.at(-1)?.content === input) history.pop()
  else if (requestId) await store.appendMessage(userId, {
    sessionId: id, clientKey: `question:${requestId}`, role: 'user', content: input,
  })
  return { id, messages: [...history, { role: 'user' as const, content: input }] }
}

export const saveAiAnswer = async (userId: number, sessionId: string | undefined, requestId: string, content: string, store = aiChatSessionStore, access?: ChatSession) => {
  if (!sessionId) return
  await store.appendMessage(userId, { sessionId, clientKey: `answer:${requestId}`, role: 'assistant', content }, access)
}
