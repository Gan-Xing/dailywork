import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const canUpdateRole =
    (await hasPermission('role:update')) || (await hasPermission('role:manage'))
  if (!canUpdateRole) {
    return NextResponse.json({ error: '缺少角色更新权限' }, { status: 403 })
  }
  const roleId = Number(id)
  if (!Number.isInteger(roleId) || roleId <= 0) {
    return NextResponse.json({ error: '无效的角色 ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const permissionIds: number[] = Array.isArray(body.permissionIds)
    ? body.permissionIds
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value > 0)
    : []
  const uniquePermissionIds = Array.from(new Set(permissionIds))
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

  if (!name) {
    return NextResponse.json({ error: '角色名称必填' }, { status: 400 })
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id: roleId },
        data: { name },
      })

      await tx.rolePermission.deleteMany({ where: { roleId } })
      if (uniquePermissionIds.length) {
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((permissionId) => ({ roleId, permissionId })),
        })
      }

      const withPerms = await tx.role.findUnique({
        where: { id: updated.id },
        include: { permissions: { include: { permission: true } } },
      })
      return withPerms
    })

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 })
    }

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
      { error: error instanceof Error ? error.message : '更新角色失败' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const canDeleteRole =
    (await hasPermission('role:delete')) || (await hasPermission('role:manage'))
  if (!canDeleteRole) {
    return NextResponse.json({ error: '缺少角色删除权限' }, { status: 403 })
  }
  const roleId = Number(id)
  if (!Number.isInteger(roleId) || roleId <= 0) {
    return NextResponse.json({ error: '无效的角色 ID' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } })
      await tx.userRole.deleteMany({ where: { roleId } })
      await tx.role.delete({ where: { id: roleId } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2016')
    ) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除角色失败' },
      { status: 500 },
    )
  }
}
