import type { AiChatMemory, AiChatMessage, AiChatSession, Prisma, PrismaClient } from '@prisma/client'
import type { ChatSession } from '@/lib/ai-chat/types'

import type {
  ChatMessageRecord,
  ChatSessionRecord,
  MemoryRecord,
  MemoryScopeType,
} from '@/lib/ai-chat/localStore'
import { prisma } from '@/lib/prisma'
import { AiChatError } from '@/lib/server/aiChatAccess'

export const MAX_AI_CHAT_SESSIONS = 200
export const MAX_AI_CHAT_MESSAGE_LENGTH = 128 * 1024
export const MAX_AI_CHAT_MEMORY_LENGTH = 4000

export type AiChatMessagePage = {
  messages: ChatMessageRecord[]
  hasMore: boolean
  nextBeforeId: number | null
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiChatError('Expected an object')
  }
  return value as Record<string, unknown>
}

const text = (value: unknown, field: string, max: number, allowEmpty = false): string => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.includes('\u0000')) {
    throw new AiChatError(`Invalid ${field}`)
  }
  if (value.length > max) throw new AiChatError(`${field} is too long`, 413)
  return value
}

const sessionKey = (value: unknown): string => {
  const id = text(value, 'sessionId', 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new AiChatError('Invalid sessionId')
  }
  return id.toLowerCase()
}

const scope = (scopeType: unknown, scopeKey: unknown) => {
  if (typeof scopeType !== 'string' || !['global', 'project', 'route', 'session'].includes(scopeType)) {
    throw new AiChatError('Invalid memory scope')
  }
  let key = text(scopeKey, 'scopeKey', 512)
  // The UI uses "default" for a session-memory draft before creating a session.
  if (scopeType === 'session' && key !== 'default') key = sessionKey(key)
  return { scopeType: scopeType as MemoryScopeType, scopeKey: key }
}

const summarySource = (value: unknown): 'auto' | 'manual' => {
  if (value !== 'auto' && value !== 'manual') throw new AiChatError('Invalid summarySource')
  return value
}

const mapSession = (row: AiChatSession): ChatSessionRecord => ({
  id: row.id,
  summary: row.summary,
  summarySource: summarySource(row.summarySource),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const mapMessage = (row: AiChatMessage, access?: ChatSession): ChatMessageRecord => {
  if (row.role !== 'user' && row.role !== 'assistant') throw new AiChatError('Invalid stored role', 500)
  const authorized = (row.requiredPermissions ?? []).every((permission) => access?.permissions.includes(permission))
    && (!row.requiresAdmin || access?.roles?.includes('Admin') === true)
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: authorized ? row.content : '权限已变更，这条历史业务内容不可查看。',
    createdAt: row.createdAt.toISOString(),
  }
}

const mapMemory = (row: AiChatMemory): MemoryRecord => ({
  id: `${row.scopeType}:${row.scopeKey}`,
  ...scope(row.scopeType, row.scopeKey),
  title: row.title,
  content: row.content,
  enabled: row.enabled,
  updatedAt: row.updatedAt.toISOString(),
})

const requireOwnedSession = async (tx: Prisma.TransactionClient, userId: number, id: string) => {
  const session = await tx.aiChatSession.findFirst({ where: { id, userId } })
  if (!session) throw new AiChatError('Session not found', 404)
  return session
}

export const createAiChatSessionStore = (db: Pick<PrismaClient, '$transaction'> = prisma) => {
  const transaction = async <T>(
    userId: number,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    write = false,
  ): Promise<T> => {
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new AiChatError('Unauthorized', 401)
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await db.$transaction(operation, {
          isolationLevel: write ? 'Serializable' : 'RepeatableRead',
        })
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
        // Retry whole writes, including the ownership check, after competing inserts/deletes.
        if (write && (code === 'P2034' || code === 'P2002') && attempt < 3) continue
        if (code === 'P2025') throw new AiChatError('Session not found', 404)
        throw error
      }
    }
  }

  const listSessions = (userId: number): Promise<ChatSessionRecord[]> => transaction(userId, async (tx) => {
    const rows = await tx.aiChatSession.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: MAX_AI_CHAT_SESSIONS + 1,
    })
    if (rows.length > MAX_AI_CHAT_SESSIONS) throw new AiChatError('Session limit exceeded', 409)
    return rows.map(mapSession)
  })

  const createSession = (userId: number, summary: unknown, importId?: unknown): Promise<ChatSessionRecord> => {
    const value = text(summary, 'summary', 200, true)
    const id = importId === undefined ? undefined : sessionKey(importId)
    return transaction(userId, async (tx) => {
      if (id) {
        const existing = await tx.aiChatSession.findFirst({ where: { id, userId } })
        if (existing) return mapSession(existing)
        if (await tx.aiChatSession.count({ where: { id } })) {
          throw new AiChatError('Import session ID is unavailable', 409)
        }
      }
      if (await tx.aiChatSession.count({ where: { userId } }) >= MAX_AI_CHAT_SESSIONS) {
        throw new AiChatError('Delete a session before creating another', 409)
      }
      const data = { userId, summary: value, summarySource: id ? 'manual' : 'auto' }
      return mapSession(id
        ? await tx.aiChatSession.upsert({ where: { id, userId }, create: { id, ...data }, update: {} })
        : await tx.aiChatSession.create({ data }))
    }, true)
  }

  const listMessages = (userId: number, sessionId: unknown, options: {
    beforeId?: unknown
    limit?: unknown
    access?: ChatSession
  } = {}): Promise<AiChatMessagePage> => {
    if (options.access && options.access.id !== userId) throw new AiChatError('Unauthorized', 403)
    const id = sessionKey(sessionId)
    const limit = options.limit === undefined ? 100 : Number(options.limit)
    const beforeId = options.beforeId === undefined ? undefined : Number(options.beforeId)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new AiChatError('Invalid limit')
    if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1 || beforeId > 2147483647)) {
      throw new AiChatError('Invalid beforeId')
    }
    return transaction(userId, async (tx) => {
      await requireOwnedSession(tx, userId, id)
      const rows = await tx.aiChatMessage.findMany({
        where: { sessionId: id, session: { userId }, ...(beforeId === undefined ? {} : { id: { lt: beforeId } }) },
        orderBy: { id: 'desc' },
        take: limit + 1,
      })
      const hasMore = rows.length > limit
      const messages = rows.slice(0, limit).reverse().map((row) => mapMessage(row, options.access))
      return { messages, hasMore, nextBeforeId: hasMore ? messages[0].id! : null }
    })
  }

  const appendMessage = (userId: number, input: unknown, access?: ChatSession): Promise<ChatMessageRecord> => {
    const message = object(input)
    const id = sessionKey(message.sessionId)
    const clientKey = text(message.clientKey, 'clientKey', 128)
    if (message.role !== 'user' && message.role !== 'assistant') throw new AiChatError('Invalid role')
    const role = message.role
    const content = text(message.content, 'content', MAX_AI_CHAT_MESSAGE_LENGTH)
    if (access && access.id !== userId) throw new AiChatError('Unauthorized', 403)
    const authorization = access ? {
      requiredPermissions: Array.from(new Set(access.permissions)),
      requiresAdmin: access.roles?.includes('Admin') === true,
    } : {}
    return transaction(userId, async (tx) => {
      await requireOwnedSession(tx, userId, id)
      const row = await tx.aiChatMessage.upsert({
        where: { sessionId_clientKey: { sessionId: id, clientKey }, session: { userId } },
        create: { sessionId: id, clientKey, role, content, ...authorization },
        update: {},
      })
      if (row.role !== role || row.content !== content) {
        throw new AiChatError('clientKey already belongs to a different message', 409)
      }
      await tx.aiChatSession.update({ where: { id, userId }, data: { updatedAt: new Date() } })
      return mapMessage(row, access)
    }, true)
  }

  const updateSession = (userId: number, sessionId: unknown, input: unknown): Promise<ChatSessionRecord> => {
    const id = sessionKey(sessionId)
    const patch = object(input)
    const data = {
      ...(patch.summary === undefined ? {} : { summary: text(patch.summary, 'summary', 200, true) }),
      ...(patch.summarySource === undefined ? {} : { summarySource: summarySource(patch.summarySource) }),
      updatedAt: new Date(),
    }
    return transaction(userId, async (tx) => {
      await requireOwnedSession(tx, userId, id)
      return mapSession(await tx.aiChatSession.update({ where: { id, userId }, data }))
    }, true)
  }

  const deleteSession = (userId: number, sessionId: unknown): Promise<void> => {
    const id = sessionKey(sessionId)
    return transaction(userId, async (tx) => {
      await requireOwnedSession(tx, userId, id)
      await tx.aiChatJob.updateMany({
        where: { userId, sessionId: id, status: { in: ['CONFIRMATION_REQUIRED', 'QUEUED'] } },
        data: { status: 'CANCELLED' },
      })
      await tx.aiChatMemory.deleteMany({ where: { userId, scopeType: 'session', scopeKey: id } })
      await tx.aiChatSession.delete({ where: { id, userId } })
    }, true)
  }

  const getMemory = (userId: number, scopeType: unknown, scopeKey: unknown): Promise<MemoryRecord | undefined> => {
    const memoryScope = scope(scopeType, scopeKey)
    return transaction(userId, async (tx) => {
      if (memoryScope.scopeType === 'session' && memoryScope.scopeKey !== 'default') {
        await requireOwnedSession(tx, userId, memoryScope.scopeKey)
      }
      const row = await tx.aiChatMemory.findUnique({ where: { userId_scopeType_scopeKey: { userId, ...memoryScope } } })
      return row ? mapMemory(row) : undefined
    })
  }

  const saveMemory = (userId: number, scopeType: unknown, scopeKey: unknown, input: unknown, options: {
    onlyIfMissing?: unknown
  } = {}): Promise<MemoryRecord> => {
    const memoryScope = scope(scopeType, scopeKey)
    const patch = object(input)
    const title = patch.title === undefined ? undefined : text(patch.title, 'title', 200, true)
    const content = patch.content === undefined ? undefined : text(patch.content, 'content', MAX_AI_CHAT_MEMORY_LENGTH, true)
    if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw new AiChatError('Invalid enabled')
    if (options.onlyIfMissing !== undefined && typeof options.onlyIfMissing !== 'boolean') {
      throw new AiChatError('Invalid onlyIfMissing')
    }
    const enabled = patch.enabled as boolean | undefined
    return transaction(userId, async (tx) => {
      if (memoryScope.scopeType === 'session' && memoryScope.scopeKey !== 'default') {
        await requireOwnedSession(tx, userId, memoryScope.scopeKey)
      }
      const row = await tx.aiChatMemory.upsert({
        where: { userId_scopeType_scopeKey: { userId, ...memoryScope } },
        create: { userId, ...memoryScope, title: title ?? '', content: content ?? '', enabled: enabled ?? true },
        update: options.onlyIfMissing ? {} : {
          ...(title === undefined ? {} : { title }),
          ...(content === undefined ? {} : { content }),
          ...(enabled === undefined ? {} : { enabled }),
          updatedAt: new Date(),
        },
      })
      return mapMemory(row)
    }, true)
  }

  return { listSessions, createSession, listMessages, appendMessage, updateSession, deleteSession, getMemory, saveMemory }
}

export const aiChatSessionStore = createAiChatSessionStore()
export const {
  listSessions, createSession, listMessages, appendMessage, updateSession, deleteSession, getMemory, saveMemory,
} = aiChatSessionStore
