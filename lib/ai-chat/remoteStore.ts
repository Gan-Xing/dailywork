import type { ChatMessageRecord, ChatSessionRecord, MemoryRecord, MemoryScopeType } from './localStore'

export type { ChatMessageRecord, ChatSessionRecord, MemoryRecord, MemoryScopeType } from './localStore'

export type RemoteMessageRecords = ChatMessageRecord[] & {
  hasMore: boolean
  nextBeforeId: number | null
}

export class AiChatStorageError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'AiChatStorageError'
  }
}

const endpoint = '/api/ai-chat/storage'
const messageKeys = new WeakMap<ChatMessageRecord, string>()

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const validEnvelope = (action: unknown, payload: Record<string, unknown>): boolean => {
  switch (action) {
    case 'sessions':
      return Array.isArray(payload.sessions)
    case 'messages':
      return Array.isArray(payload.messages) && typeof payload.hasMore === 'boolean'
        && (payload.hasMore
          ? Number.isSafeInteger(payload.nextBeforeId) && Number(payload.nextBeforeId) > 0
          : payload.nextBeforeId === null)
    case 'memory':
      return payload.memory === null || isObject(payload.memory)
    case 'saveMemory':
      return isObject(payload.memory)
    case 'createSession':
    case 'updateSession':
      return isObject(payload.session)
    case 'appendMessage':
      return isObject(payload.message)
    case 'deleteSession':
      return payload.ok === true
    default:
      return false
  }
}

const request = async <T>(queryOrBody: URLSearchParams | Record<string, unknown>): Promise<T> => {
  const read = queryOrBody instanceof URLSearchParams
  const response = await fetch(read ? `${endpoint}?${queryOrBody}` : endpoint, {
    method: read ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    ...(read ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(queryOrBody) }),
  })
  const payload: unknown = await response.json().catch(() => {
    throw new AiChatStorageError('Invalid AI chat storage response', response.status)
  })
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message : 'AI chat storage request failed'
    throw new AiChatStorageError(message, response.status)
  }
  const action = read ? queryOrBody.get('action') : queryOrBody.action
  if (!isObject(payload) || !validEnvelope(action, payload)) {
    throw new AiChatStorageError('Invalid AI chat storage response', response.status)
  }
  return payload as T
}

export const listSessions = async (_userId: number): Promise<ChatSessionRecord[]> => {
  const result = await request<{ sessions: ChatSessionRecord[] }>(new URLSearchParams({ action: 'sessions' }))
  return result.sessions
}

export const createSession = async (_userId: number, summary: string): Promise<ChatSessionRecord> => {
  const result = await request<{ session: ChatSessionRecord }>({ action: 'createSession', summary })
  return result.session
}

export const createImportedSession = async (_userId: number, id: string, summary: string): Promise<ChatSessionRecord> => {
  const result = await request<{ session: ChatSessionRecord }>({ action: 'createSession', summary, importId: id })
  return result.session
}

export const listMessages = async (
  _userId: number,
  sessionId: string,
  options: { beforeId?: number; limit?: number } = {},
): Promise<RemoteMessageRecords> => {
  const query = new URLSearchParams({ action: 'messages', sessionId })
  if (options.beforeId !== undefined) query.set('beforeId', String(options.beforeId))
  if (options.limit !== undefined) query.set('limit', String(options.limit))
  const result = await request<{ messages: ChatMessageRecord[]; hasMore: boolean; nextBeforeId: number | null }>(query)
  // Keep the existing array API while making the older-history boundary explicit.
  return Object.assign(result.messages, { hasMore: result.hasMore, nextBeforeId: result.nextBeforeId })
}

export const appendMessage = async (_userId: number, message: ChatMessageRecord & { clientKey?: string }): Promise<void> => {
  const clientKey = message.clientKey ?? messageKeys.get(message) ?? crypto.randomUUID()
  messageKeys.set(message, clientKey)
  await request({
    action: 'appendMessage',
    message: { sessionId: message.sessionId, clientKey, role: message.role, content: message.content },
  })
}

export const updateSession = async (_userId: number, sessionId: string, patch: Partial<ChatSessionRecord>): Promise<ChatSessionRecord> => {
  const result = await request<{ session: ChatSessionRecord }>({
    action: 'updateSession', sessionId, patch: { summary: patch.summary, summarySource: patch.summarySource },
  })
  return result.session
}

export const deleteSession = async (_userId: number, sessionId: string): Promise<void> => {
  await request({ action: 'deleteSession', sessionId })
}

export const getMemory = async (_userId: number, scopeType: MemoryScopeType, scopeKey: string): Promise<MemoryRecord | undefined> => {
  const result = await request<{ memory: MemoryRecord | null }>(new URLSearchParams({ action: 'memory', scopeType, scopeKey }))
  return result.memory ?? undefined
}

export const saveMemory = async (
  _userId: number,
  scopeType: MemoryScopeType,
  scopeKey: string,
  patch: Partial<MemoryRecord>,
  options: { onlyIfMissing?: boolean } = {},
): Promise<MemoryRecord> => {
  const result = await request<{ memory: MemoryRecord }>({
    action: 'saveMemory', scopeType, scopeKey,
    patch: { title: patch.title, content: patch.content, enabled: patch.enabled },
    ...(options.onlyIfMissing === undefined ? {} : { onlyIfMissing: options.onlyIfMissing }),
  })
  return result.memory
}
