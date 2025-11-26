import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const userId = Number(params.id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }
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

  const roleIdList: number[] = Array.isArray(roleIds)
    ? roleIds.map((value: unknown) => Number(value)).filter(Boolean)
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
        roles:
          roleIdList.length === 0
            ? { deleteMany: {} }
            : {
                deleteMany: {},
                create: roleIdList.map((id) => ({
                  role: { connect: { id } },
                })),
              },
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
        roles: user.roles.map((item) => ({ id: item.role.id, name: item.role.name })),
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

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const userId = Number(params.id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
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
