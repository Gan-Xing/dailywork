import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { listRoles } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasPermission('member:view')) {
    return NextResponse.json({ error: '缺少成员查看权限' }, { status: 403 })
  }
  const roles = await listRoles()
  return NextResponse.json({ roles })
}

export async function POST(request: Request) {
  if (!hasPermission('role:manage')) {
    return NextResponse.json({ error: '缺少角色管理权限' }, { status: 403 })
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

  try {
    const role = await prisma.role.create({
      data: {
        name: roleName,
        permissions:
          permissionsList.length === 0
            ? undefined
            : {
                create: permissionsList.map((id) => ({
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
