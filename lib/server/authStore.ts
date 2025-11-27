import type { Prisma } from '@prisma/client'

import { verifyPassword } from '@/lib/auth/password'
import { hashPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'

export interface AuthPermission {
  id?: number
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
      id: rp.permission.id,
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
      name: true,
      gender: true,
      nationality: true,
      phones: true,
      joinDate: true,
      position: true,
      employmentStatus: true,
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
    name: user.name,
    gender: user.gender,
    nationality: user.nationality,
    phones: user.phones,
    joinDate: user.joinDate ? user.joinDate.toISOString() : null,
    position: user.position,
    employmentStatus: user.employmentStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles.map((item) => ({
      id: item.role.id,
      name: item.role.name,
    })),
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

export const getUserWithPermissions = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelection,
  })
  if (!user) {
    return null
  }
  return mapUser(user)
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

export const changePassword = async (userId: number, currentPassword: string, newPassword: string) => {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密码长度至少 6 位')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
    },
  })

  if (!user) {
    throw new Error('用户不存在')
  }

  const ok = verifyPassword(currentPassword, user.passwordHash)
  if (!ok) {
    throw new Error('当前密码错误')
  }

  const passwordHash = hashPassword(newPassword)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })
}
