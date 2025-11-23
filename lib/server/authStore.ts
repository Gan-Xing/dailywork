import type { Prisma } from '@prisma/client'

import { verifyPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'

export interface AuthPermission {
  code: string
  name: string
}

export interface AuthRole {
  id: number
  name: string
  permissions: AuthPermission[]
}

export interface AuthUser {
  id: number
  username: string
  roles: AuthRole[]
  permissions: string[]
}

const userSelection = {
  id: true,
  username: true,
  passwordHash: true,
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect

const mapUser = (user: Prisma.UserGetPayload<{ select: typeof userSelection }>): AuthUser => {
  const roles: AuthRole[] = user.roles.map((userRole) => ({
    id: userRole.role.id,
    name: userRole.role.name,
    permissions: userRole.role.permissions.map((rp) => ({
      code: rp.permission.code,
      name: rp.permission.name,
    })),
  }))

  const permissions = Array.from(
    new Set(roles.flatMap((role) => role.permissions.map((perm) => perm.code))),
  )

  return {
    id: user.id,
    username: user.username,
    roles,
    permissions,
  }
}

export const login = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: userSelection,
  })

  if (!user) {
    throw new Error('用户不存在')
  }

  const ok = verifyPassword(password, user.passwordHash)
  if (!ok) {
    throw new Error('密码错误')
  }

  return mapUser(user)
}

export const listUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles.map((item) => item.role.name),
  }))
}

export const listPermissions = async () => {
  const permissions = await prisma.permission.findMany({
    orderBy: { id: 'asc' },
  })
  return permissions.map((perm) => ({
    id: perm.id,
    code: perm.code,
    name: perm.name,
    createdAt: perm.createdAt.toISOString(),
    updatedAt: perm.updatedAt.toISOString(),
  }))
}

export const listRoles = async () => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  })

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    permissions: role.permissions.map((rp) => ({
      id: rp.permission.id,
      code: rp.permission.code,
      name: rp.permission.name,
    })),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  }))
}
