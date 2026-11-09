type RequestGuardLimits = {
  windowMs: number
  maxPerWindow: number
  maxConcurrentPerUser: number
  maxConcurrentGlobal: number
}

type UserState = {
  startedAt: number[]
  active: number
}

export type RequestLease = {
  ok: true
  release: () => void
}

export type RequestRejection = {
  ok: false
  reason: 'user_concurrency' | 'global_concurrency' | 'user_rate'
  retryAfterSeconds: number
}

const defaultLimits: RequestGuardLimits = {
  windowMs: 60_000,
  maxPerWindow: 8,
  maxConcurrentPerUser: 2,
  maxConcurrentGlobal: 16,
}

// This protects one Next.js process. A shared Redis/database limiter is needed
// before running multiple application instances.
export const createAiChatRequestGuard = (limits: Partial<RequestGuardLimits> = {}) => {
  const config = { ...defaultLimits, ...limits }
  const users = new Map<number, UserState>()
  let activeGlobal = 0
  let lastPrunedAt = 0

  const prune = (now: number) => {
    if (now - lastPrunedAt < config.windowMs) return
    lastPrunedAt = now
    users.forEach((state, userId) => {
      state.startedAt = state.startedAt.filter((started) => started > now - config.windowMs)
      if (!state.active && !state.startedAt.length) users.delete(userId)
    })
  }

  const acquire = (userId: number, now = Date.now()): RequestLease | RequestRejection => {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error('A valid user ID is required for AI chat request limits')
    }
    prune(now)
    const state = users.get(userId) ?? { startedAt: [], active: 0 }
    state.startedAt = state.startedAt.filter((started) => started > now - config.windowMs)

    if (state.active >= config.maxConcurrentPerUser) {
      return { ok: false, reason: 'user_concurrency', retryAfterSeconds: 5 }
    }
    if (activeGlobal >= config.maxConcurrentGlobal) {
      return { ok: false, reason: 'global_concurrency', retryAfterSeconds: 5 }
    }
    if (state.startedAt.length >= config.maxPerWindow) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.startedAt[0] + config.windowMs - now) / 1000),
      )
      return { ok: false, reason: 'user_rate', retryAfterSeconds }
    }

    state.startedAt.push(now)
    state.active += 1
    activeGlobal += 1
    users.set(userId, state)
    let released = false
    return {
      ok: true,
      release: () => {
        if (released) return
        released = true
        state.active -= 1
        activeGlobal -= 1
      },
    }
  }

  return { acquire }
}

const configuredLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : fallback
}

const globalRegistry = globalThis as typeof globalThis & {
  __dailyworkAiChatRequestGuard?: ReturnType<typeof createAiChatRequestGuard>
}

export const aiChatRequestGuard = globalRegistry.__dailyworkAiChatRequestGuard ??=
  createAiChatRequestGuard({
    maxPerWindow: configuredLimit(process.env.AI_CHAT_REQUESTS_PER_MINUTE, 8),
    maxConcurrentPerUser: configuredLimit(process.env.AI_CHAT_CONCURRENT_PER_USER, 2),
    maxConcurrentGlobal: configuredLimit(process.env.AI_CHAT_CONCURRENT_GLOBAL, 16),
  })
