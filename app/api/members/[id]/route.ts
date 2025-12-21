import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }
  const canUpdateMember =
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  if (!canUpdateMember) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }
  const canAssignRole =
    (await hasPermission('role:update')) || (await hasPermission('role:manage'))
  const body = await request.json()
  const {
    username,
    password,
    name,
    gender,
    nationality,
    phones,
    joinDate,
    position,
    employmentStatus,
    roleIds,
  } = body ?? {}

  const normalizedUsername = typeof username === 'string' ? username.trim() : undefined

  const phoneList: string[] = Array.isArray(phones)
    ? phones.filter(Boolean)
    : typeof phones === 'string'
      ? phones
          .split(/[,，]/)
          .map((item: string) => item.trim())
          .filter(Boolean)
      : []

  let resolvedPositionName = typeof position === 'string' && position.trim().length ? position.trim() : null
  if (position === null || position === '') {
    resolvedPositionName = null
  }

  const roleIdList: number[] = canAssignRole
    ? Array.isArray(roleIds)
      ? roleIds.map((value: unknown) => Number(value)).filter(Boolean)
      : []
    : []

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(normalizedUsername ? { username: normalizedUsername } : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        name: name ?? '',
        gender: gender ?? null,
        nationality: nationality ?? null,
        phones: phoneList,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        position: resolvedPositionName,
        employmentStatus: employmentStatus ?? 'ACTIVE',
        ...(canAssignRole
          ? {
              roles:
                roleIdList.length === 0
                  ? { deleteMany: {} }
                  : {
                      deleteMany: {},
                      create: roleIdList.map((id) => ({
                        role: { connect: { id } },
                      })),
                    },
            }
          : {}),
      },
      include: {
        roles: { include: { role: true } },
      },
    })

    return NextResponse.json({
      member: {
        id: user.id,
        username: user.username,
        name: user.name,
        gender: user.gender,
        nationality: user.nationality,
        phones: user.phones,
        joinDate: user.joinDate?.toISOString() ?? null,
        position: user.position,
        employmentStatus: user.employmentStatus,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        roles: canAssignRole
          ? user.roles.map((item) => ({ id: item.role.id, name: item.role.name }))
          : [],
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '账号已存在，请换一个账号名' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新成员失败' },
      { status: 500 },
    )
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }
  const canDeleteMember =
    (await hasPermission('member:delete')) || (await hasPermission('member:manage'))
  if (!canDeleteMember) {
    return NextResponse.json({ error: '缺少成员删除权限' }, { status: 403 })
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除成员失败' },
      { status: 500 },
    )
  }
}
