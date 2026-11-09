import type { PrismaClient } from '@prisma/client'

import type { ChatSession } from '@/lib/ai-chat/types'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

export class AiChatError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'AiChatError'
  }
}

export const createAiChatAccess = (dependencies: {
  db: Pick<PrismaClient, 'user' | 'permission'>
  getSessionUser: () => Promise<{ id: number } | null>
}) => {
  const loadAiChatActor = async (userId: number): Promise<ChatSession> => {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AiChatError('Unauthorized', 401)
    }
    const user = await dependencies.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        employmentStatus: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  where: { permission: { status: 'ACTIVE' } },
                  select: { permission: { select: { code: true, status: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!user) throw new AiChatError('Unauthorized', 401)
    if (user.employmentStatus === 'TERMINATED') {
      throw new AiChatError('AI chat access is disabled for this account', 403)
    }

    const permissions = user.roles.some(({ role }) => role.name === 'Admin')
      ? (await dependencies.db.permission.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true },
      })).map(({ code }) => code)
      : user.roles.flatMap(({ role }) => role.permissions
        .filter(({ permission }) => permission.status === 'ACTIVE')
        .map(({ permission }) => permission.code))

    if (!permissions.includes('ai-chat:view')) {
      throw new AiChatError('Missing ai-chat:view permission', 403)
    }
    return { id: user.id, username: user.username, permissions: Array.from(new Set(permissions)), roles: user.roles.map(({ role }) => role.name) }
  }

  const requireAiChatActor = async (): Promise<ChatSession> => {
    const identity = await dependencies.getSessionUser()
    if (!identity) throw new AiChatError('Unauthorized', 401)
    return loadAiChatActor(identity.id)
  }

  return { loadAiChatActor, requireAiChatActor }
}

export const { loadAiChatActor, requireAiChatActor } = createAiChatAccess({
  db: prisma,
  getSessionUser: () => getSessionUser(),
})

export const assertAiChatGrantsUnchanged = async (
  previous: ChatSession,
  loadActor = loadAiChatActor,
): Promise<ChatSession> => {
  const current = await loadActor(previous.id)
  if (current.id !== previous.id || previous.permissions.some((permission) => !current.permissions.includes(permission))
    || (previous.roles ?? []).some((role) => !(current.roles ?? []).includes(role))) {
    throw new AiChatError('Permissions changed during the request. Please start a new request.', 403)
  }
  return current
}
