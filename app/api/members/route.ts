import { NextResponse } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import { listUsers } from '@/lib/server/authStore'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await hasPermission('member:view'))) {
    return NextResponse.json({ error: '缺少成员查看权限' }, { status: 403 })
  }
  const members = await listUsers()
  return NextResponse.json({ members })
}

export async function POST(request: Request) {
  if (!(await hasPermission('member:manage'))) {
    return NextResponse.json({ error: '缺少成员管理权限' }, { status: 403 })
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

  const normalizedUsername =
    typeof username === 'string' ? username.trim().toLowerCase() : ''

  if (!normalizedUsername || !password) {
    return NextResponse.json({ error: '缺少账号或密码' }, { status: 400 })
  }

  const phoneList: string[] = Array.isArray(phones)
    ? phones.filter(Boolean)
    : typeof phones === 'string'
      ? phones
          .split(/[,，]/)
          .map((item: string) => item.trim())
          .filter(Boolean)
      : []

  let resolvedPositionName = typeof position === 'string' && position.trim().length ? position.trim() : null

  const roleIdList: number[] = Array.isArray(roleIds)
    ? roleIds.map((value: unknown) => Number(value)).filter(Boolean)
    : []

  try {
    const existing = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: '账号已存在（不区分大小写）' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash: hashPassword(password),
        name: name ?? '',
        gender: gender ?? null,
        nationality: nationality ?? null,
        phones: phoneList,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        position: resolvedPositionName,
        employmentStatus: employmentStatus ?? 'ACTIVE',
        roles:
          roleIdList.length === 0
            ? undefined
            : {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建成员失败' },
      { status: 500 },
    )
  }
}
