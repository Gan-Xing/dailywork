import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { listRoles } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const canViewRole =
    (await hasPermission('role:view')) ||
    (await hasPermission('role:create')) ||
    (await hasPermission('role:update')) ||
    (await hasPermission('role:delete')) ||
    (await hasPermission('role:manage'))
  if (!canViewRole) {
    return NextResponse.json({ error: '缺少角色查看权限' }, { status: 403 })
  }
  const roles = await listRoles()
  return NextResponse.json({ roles })
}

export async function POST(request: Request) {
  const canCreateRole =
    (await hasPermission('role:create')) || (await hasPermission('role:manage'))
  if (!canCreateRole) {
    return NextResponse.json({ error: '缺少角色创建权限' }, { status: 403 })
  }
  const body = await request.json()
  const { name, permissionIds } = body ?? {}

  const roleName = typeof name === 'string' ? name.trim() : ''
  if (!roleName) {
    return NextResponse.json({ error: '角色名称必填' }, { status: 400 })
  }

  const permissionsList: number[] = Array.isArray(permissionIds)
    ? permissionIds.map((value: unknown) => Number(value)).filter(Boolean)
    : []
  const uniquePermissionIds = Array.from(new Set(permissionsList))
  if (uniquePermissionIds.length > 0) {
    const permissions = await prisma.permission.findMany({
      where: { id: { in: uniquePermissionIds } },
      select: { id: true, status: true },
    })
    const activeIds = new Set(
      permissions.filter((permission) => permission.status === 'ACTIVE').map((permission) => permission.id),
    )
    const invalidIds = uniquePermissionIds.filter((id) => !activeIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: '包含已归档权限，无法绑定角色' }, { status: 400 })
    }
  }

  try {
    const role = await prisma.role.create({
      data: {
        name: roleName,
        permissions:
          uniquePermissionIds.length === 0
            ? undefined
            : {
                create: uniquePermissionIds.map((id) => ({
                  permission: { connect: { id } },
                })),
              },
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    })

    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        permissions: role.permissions.map((item) => ({
          id: item.permission.id,
          code: item.permission.code,
          name: item.permission.name,
          status: item.permission.status,
        })),
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '角色名称已存在' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建角色失败' },
      { status: 500 },
    )
  }
}
