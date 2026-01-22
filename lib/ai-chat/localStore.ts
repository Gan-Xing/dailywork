export type ChatSessionRecord = {
  id: string
  summary: string
  createdAt: string
  updatedAt: string
  summarySource?: 'auto' | 'manual'
}

export type ChatMessageRecord = {
  id?: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type MemoryScopeType = 'global' | 'project' | 'route' | 'session'

export type MemoryRecord = {
  id: string
  scopeType: MemoryScopeType
  scopeKey: string
  title: string
  content: string
  enabled: boolean
  updatedAt: string
}

const DB_NAME = 'dailywork-ai-chat'
const DB_VERSION = 1
const STORE_SESSIONS = 'sessions'
const STORE_MESSAGES = 'messages'
const STORE_MEMORIES = 'memories'

const ensureBrowser = () => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available')
  }
}

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const openDb = () => {
  ensureBrowser()
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const store = db.createObjectStore(STORE_MESSAGES, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('sessionId', 'sessionId')
        store.createIndex('sessionId_createdAt', ['sessionId', 'createdAt'])
      }
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = handler(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const getAllFromStore = async <T>(storeName: string) => {
  const db = await openDb()
  return new Promise<T[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

export const listSessions = async (): Promise<ChatSessionRecord[]> => {
  const sessions = await getAllFromStore<ChatSessionRecord>(STORE_SESSIONS)
  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export const createSession = async (summary: string): Promise<ChatSessionRecord> => {
  const now = new Date().toISOString()
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const session: ChatSessionRecord = {
    id,
    summary,
    createdAt: now,
    updatedAt: now,
    summarySource: 'auto',
  }
  await withStore(STORE_SESSIONS, 'readwrite', (store) => store.put(session))
  return session
}

export const updateSession = async (
  id: string,
  patch: Partial<ChatSessionRecord>,
) => {
  const existing = await withStore<ChatSessionRecord | undefined>(
    STORE_SESSIONS,
    'readonly',
    (store) => store.get(id),
  )
  const now = new Date().toISOString()
  const updated: ChatSessionRecord = {
    id,
    summary: patch.summary ?? existing?.summary ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
    summarySource: patch.summarySource ?? existing?.summarySource ?? 'auto',
  }
  await withStore(STORE_SESSIONS, 'readwrite', (store) => store.put(updated))
  return updated
}

export const deleteSession = async (id: string) => {
  await withStore(STORE_SESSIONS, 'readwrite', (store) => store.delete(id))
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_MESSAGES, 'readwrite')
    const store = transaction.objectStore(STORE_MESSAGES)
    const index = store.index('sessionId')
    const request = index.openCursor(IDBKeyRange.only(id))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
        return
      }
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

export const listMessages = async (sessionId: string): Promise<ChatMessageRecord[]> => {
  const db = await openDb()
  return new Promise<ChatMessageRecord[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_MESSAGES, 'readonly')
    const store = transaction.objectStore(STORE_MESSAGES)
    const index = store.index('sessionId')
    const request = index.getAll(sessionId)
    request.onsuccess = () => {
      const items = (request.result as ChatMessageRecord[]).slice()
      items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      resolve(items)
    }
    request.onerror = () => reject(request.error)
  })
}

export const appendMessage = async (message: ChatMessageRecord) => {
  await withStore(STORE_MESSAGES, 'readwrite', (store) => store.add(message))
  await updateSession(message.sessionId, { updatedAt: message.createdAt })
}

export const getMemory = async (
  scopeType: MemoryScopeType,
  scopeKey: string,
): Promise<MemoryRecord | undefined> => {
  const id = `${scopeType}:${scopeKey}`
  const record = await withStore<MemoryRecord | undefined>(
    STORE_MEMORIES,
    'readonly',
    (store) => store.get(id),
  )
  return record ?? undefined
}

export const saveMemory = async (
  scopeType: MemoryScopeType,
  scopeKey: string,
  patch: Partial<MemoryRecord>,
) => {
  const id = `${scopeType}:${scopeKey}`
  const existing = await getMemory(scopeType, scopeKey)
  const updated: MemoryRecord = {
    id,
    scopeType,
    scopeKey,
    title: patch.title ?? existing?.title ?? '',
    content: patch.content ?? existing?.content ?? '',
    enabled: patch.enabled ?? existing?.enabled ?? true,
    updatedAt: new Date().toISOString(),
  }
  await withStore(STORE_MEMORIES, 'readwrite', (store) => store.put(updated))
  return updated
}

export const listMemories = async (): Promise<MemoryRecord[]> => {
  return getAllFromStore<MemoryRecord>(STORE_MEMORIES)
}
