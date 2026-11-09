import { getChatLocalDbName } from './localStore'
import type { ChatMessageRecord, ChatSessionRecord, MemoryRecord, MemoryScopeType } from './localStore'
import * as remoteStore from './remoteStore'

export type OwnedLocalHistory = {
  sessions: unknown[]
  messages: unknown[]
  memories: unknown[]
}

export const LOCAL_HISTORY_READ_TIMEOUT_MS = 5000

export const readOwnedLocalHistory = async (
  userId: number,
  factory = typeof window === 'undefined' ? undefined : window.indexedDB,
  timeoutMs = LOCAL_HISTORY_READ_TIMEOUT_MS,
): Promise<OwnedLocalHistory | null> => {
  const name = getChatLocalDbName(userId)
  if (!factory) return null
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid local chat read timeout')
  const deadline = Date.now() + timeoutMs
  const bounded = <T>(pending: Promise<T>, stage: string, cancel?: () => void): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        cancel?.()
        reject(new Error(`Local chat ${stage} timed out; original history is unchanged`))
      }, Math.max(0, deadline - Date.now()))
      pending.then((value) => { clearTimeout(timer); resolve(value) }, (error) => { clearTimeout(timer); reject(error) })
    })
  if (typeof factory.databases === 'function') {
    try {
      if (!(await bounded(factory.databases(), 'database enumeration')).some((database) => database.name === name)) return null
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'NotSupportedError') throw error
    }
  }

  let abandoned = false
  const db = await bounded(new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = factory.open(name)
    let missing = false
    // Aborting creation avoids modifying even an empty local database when the
    // enumeration API is absent or the named database disappeared after listing.
    request.onupgradeneeded = () => { missing = true; request.transaction?.abort() }
    request.onerror = () => missing ? resolve(null) : reject(request.error ?? new Error('Cannot read local chat history'))
    request.onblocked = () => { abandoned = true; reject(new Error('Local chat database is blocked')) }
    request.onsuccess = () => {
      if (abandoned || missing) { request.result.close(); resolve(null) }
      else resolve(request.result)
    }
  }), 'database open', () => { abandoned = true })
  if (!db) return null
  try {
    let transaction: IDBTransaction | undefined
    return await bounded(new Promise<OwnedLocalHistory>((resolve, reject) => {
      const stores = ['sessions', 'messages', 'memories'] as const
      if (stores.some((name) => !db.objectStoreNames.contains(name))) {
        reject(new Error('Local chat database is missing a required store'))
        return
      }
      const tx = db.transaction([...stores], 'readonly')
      transaction = tx
      const snapshot: OwnedLocalHistory = { sessions: [], messages: [], memories: [] }
      tx.oncomplete = () => resolve(snapshot)
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Cannot read local chat history'))
      for (const store of stores) {
        const request = tx.objectStore(store).getAll()
        request.onsuccess = () => { snapshot[store] = request.result }
      }
    }), 'snapshot read', () => {
      try { transaction?.abort() } catch { /* The transaction may already be inactive. */ }
    })
  } finally {
    db.close()
  }
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed local chat record')
  return value as Record<string, unknown>
}

const text = (value: unknown, field: string, limit: number, empty = false): string => {
  if (typeof value !== 'string' || value.includes('\u0000') || (!empty && !value.trim()) || value.length > limit) {
    throw new Error(`Invalid or oversized local chat ${field}`)
  }
  return value
}

const timestamp = (value: unknown): string => {
  const result = text(value, 'timestamp', 64)
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid local chat timestamp')
  return result
}

const validateHistory = (history: OwnedLocalHistory) => {
  if (!Array.isArray(history.sessions) || !Array.isArray(history.messages) || !Array.isArray(history.memories)) {
    throw new Error('Malformed local chat history')
  }
  if (history.sessions.length > 200) throw new Error('Local chat history exceeds the 200 session limit')
  const sessionIds = new Set<string>()
  const sessions: ChatSessionRecord[] = history.sessions.map((value) => {
    const row = object(value)
    const id = text(row.id, 'session ID', 512)
    if (sessionIds.has(id)) throw new Error('Duplicate local chat session ID')
    sessionIds.add(id)
    if (row.summarySource !== undefined && row.summarySource !== 'auto' && row.summarySource !== 'manual') {
      throw new Error('Invalid local chat summary source')
    }
    return {
      id,
      summary: text(row.summary, 'summary', 200, true),
      summarySource: row.summarySource,
      createdAt: timestamp(row.createdAt),
      updatedAt: timestamp(row.updatedAt),
    }
  })
  const messageIds = new Set<number>()
  const messages: Array<ChatMessageRecord & { id: number }> = history.messages.map((value) => {
    const row = object(value)
    if (typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id <= 0 || messageIds.has(row.id)) {
      throw new Error('Invalid or duplicate local chat message ID')
    }
    messageIds.add(row.id)
    const sessionId = text(row.sessionId, 'message session ID', 512)
    if (!sessionIds.has(sessionId)) throw new Error('Local chat message has no session')
    if (row.role !== 'user' && row.role !== 'assistant') throw new Error('Invalid local chat message role')
    return { id: row.id, sessionId, role: row.role, content: text(row.content, 'message', 128 * 1024), createdAt: timestamp(row.createdAt) }
  })
  const memoryIds = new Set<string>()
  const memories: MemoryRecord[] = history.memories.map((value) => {
    const row = object(value)
    if (typeof row.scopeType !== 'string' || !['global', 'project', 'route', 'session'].includes(row.scopeType)) {
      throw new Error('Invalid local chat memory scope')
    }
    const scopeType = row.scopeType as MemoryScopeType
    const scopeKey = text(row.scopeKey, 'memory scope key', 512)
    const id = `${scopeType}:${scopeKey}`
    if (row.id !== id || memoryIds.has(id) || typeof row.enabled !== 'boolean') throw new Error('Malformed local chat memory')
    memoryIds.add(id)
    if (scopeType === 'session' && scopeKey !== 'default' && !sessionIds.has(scopeKey)) {
      throw new Error('Local chat memory has no session')
    }
    return {
      id, scopeType, scopeKey,
      title: text(row.title, 'memory title', 200, true),
      content: text(row.content, 'memory content', 4000, true),
      enabled: row.enabled,
      updatedAt: timestamp(row.updatedAt),
    }
  })
  sessions.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || a.id.localeCompare(b.id))
  messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id)
  return { sessions, messages, memories }
}

export const getImportedSessionId = async (userId: number, oldId: string): Promise<string> => {
  getChatLocalDbName(userId)
  text(oldId, 'session ID', 512)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:${oldId}`)))
  const bytes = hash.slice(0, 16)
  // A UUIDv8 custom layout retains 122 bits of the user-scoped SHA-256 digest.
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type MigrationDependencies = {
  readHistory: (userId: number) => Promise<OwnedLocalHistory | null>
  remote: Pick<typeof remoteStore, 'createImportedSession' | 'appendMessage' | 'getMemory' | 'saveMemory'>
  getMarker: (key: string) => string | null
  setMarker: (key: string, value: string) => void
}

export const createOwnedLocalHistoryMigrator = (options: Partial<MigrationDependencies> = {}) => {
  const dependencies: MigrationDependencies = {
    readHistory: readOwnedLocalHistory,
    remote: remoteStore,
    getMarker: (key) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
    setMarker: (key, value) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value) },
    ...options,
  }
  const inFlight = new Map<number, Promise<void>>()
  const run = async (userId: number) => {
    const marker = `dailywork-ai-chat-remote-import-v1:${userId}`
    if (dependencies.getMarker(marker) === 'complete') return
    const snapshot = await dependencies.readHistory(userId)
    if (snapshot) {
      // Validate and hash the entire snapshot before making any remote writes.
      const { sessions, messages, memories } = validateHistory(snapshot)
      const importedIds = new Map<string, string>()
      for (const session of sessions) importedIds.set(session.id, await getImportedSessionId(userId, session.id))
      for (const session of sessions) {
        const id = importedIds.get(session.id)!
        await dependencies.remote.createImportedSession(userId, id, session.summary)
        for (const message of messages.filter((message) => message.sessionId === session.id)) {
          await dependencies.remote.appendMessage(userId, { ...message, sessionId: id, clientKey: `legacy:${message.id}` })
        }
      }
      for (const memory of memories) {
        const key = memory.scopeType === 'session' && memory.scopeKey !== 'default'
          ? importedIds.get(memory.scopeKey)! : memory.scopeKey
        if (await dependencies.remote.getMemory(userId, memory.scopeType, key)) continue
        await dependencies.remote.saveMemory(userId, memory.scopeType, key, {
          title: memory.title, content: memory.content, enabled: memory.enabled,
        }, { onlyIfMissing: true })
      }
    }
    dependencies.setMarker(marker, 'complete')
  }

  return (userId: number): Promise<void> => {
    getChatLocalDbName(userId)
    const existing = inFlight.get(userId)
    if (existing) return existing
    const pending = run(userId).finally(() => { inFlight.delete(userId) })
    inFlight.set(userId, pending)
    return pending
  }
}

export const migrateOwnedLocalHistory = createOwnedLocalHistoryMigrator()
