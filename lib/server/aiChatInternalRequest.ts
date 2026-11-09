import { createHmac } from 'node:crypto'

import type { ChatSession } from '@/lib/ai-chat/types'

// Internal requests carry current verified grants, never the browser's stale role snapshot.
export const buildAiChatInternalCookie = (actor: ChatSession) => {
  const body = Buffer.from(JSON.stringify({
    id: actor.id, username: actor.username, nationality: null,
    roles: (actor.roles ?? []).map((name) => ({ id: 0, name })),
    permissions: actor.permissions, issuedAt: Date.now(),
  })).toString('base64url')
  const signature = createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret').update(body).digest('base64url')
  return `dw-session=${body}.${signature}`
}
