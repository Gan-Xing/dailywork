import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import {
  hasExpatProfileData,
  normalizeChineseProfile,
  normalizeExpatProfile,
  parseBirthDateInput,
  parseChineseIdBirthDate,
} from '@/lib/server/memberProfiles'
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
    birthDate,
    terminationDate,
    terminationReason,
    position,
    employmentStatus,
    roleIds,
    chineseProfile,
    expatProfile,
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
  const resolvedEmploymentStatus = employmentStatus ?? 'ACTIVE'
  const isChinese = nationality === 'china'
  const chineseProfileData = normalizeChineseProfile(chineseProfile)
  const expatProfileData = normalizeExpatProfile(expatProfile)
  const shouldUpsertExpatProfile = !isChinese && hasExpatProfileData(expatProfileData)
  if (!isChinese && expatProfileData.chineseSupervisorId) {
    const supervisor = await prisma.user.findUnique({
      where: { id: expatProfileData.chineseSupervisorId },
      select: { nationality: true },
    })
    if (!supervisor || supervisor.nationality !== 'china') {
      return NextResponse.json({ error: '中方负责人必须为中国籍成员' }, { status: 400 })
    }
  }
  const hasBirthDateInput =
    birthDate !== null &&
    birthDate !== undefined &&
    (typeof birthDate !== 'string' || birthDate.trim().length > 0)
  const parsedBirthDate = parseBirthDateInput(birthDate)
  if (hasBirthDateInput && !parsedBirthDate) {
    return NextResponse.json({ error: '出生日期格式不正确' }, { status: 400 })
  }
  let resolvedBirthDate = parsedBirthDate
  if (!resolvedBirthDate && isChinese && !hasBirthDateInput) {
    resolvedBirthDate = parseChineseIdBirthDate(chineseProfileData.idNumber)
  }
  if (!resolvedBirthDate) {
    return NextResponse.json({ error: '缺少出生日期' }, { status: 400 })
  }
  if (!isChinese && expatProfileData.contractType === 'CDD' && expatProfileData.baseSalaryUnit === 'HOUR') {
    return NextResponse.json({ error: 'CDD 合同基础工资必须按月' }, { status: 400 })
  }
  const isTerminated = resolvedEmploymentStatus === 'TERMINATED'
  const terminationReasonText =
    typeof terminationReason === 'string' ? terminationReason.trim() : ''
  let resolvedTerminationDate: Date | null = null
  let resolvedTerminationReason: string | null = null
  if (isTerminated) {
    if (!terminationDate || (typeof terminationDate === 'string' && !terminationDate.trim())) {
      return NextResponse.json({ error: '缺少离职日期' }, { status: 400 })
    }
    const parsedTerminationDate = new Date(terminationDate)
    if (Number.isNaN(parsedTerminationDate.getTime())) {
      return NextResponse.json({ error: '离职日期格式不正确' }, { status: 400 })
    }
    if (!terminationReasonText) {
      return NextResponse.json({ error: '缺少离职原因' }, { status: 400 })
    }
    resolvedTerminationDate = parsedTerminationDate
    resolvedTerminationReason = terminationReasonText
  }

  const roleIdList: number[] = canAssignRole
    ? Array.isArray(roleIds)
      ? roleIds.map((value: unknown) => Number(value)).filter(Boolean)
      : []
    : []

  try {
    if (!isChinese && expatProfileData.contractNumber) {
      const contractOwner = await prisma.userExpatProfile.findUnique({
        where: { contractNumber: expatProfileData.contractNumber },
        select: { userId: true },
      })
      if (contractOwner && contractOwner.userId !== userId) {
        return NextResponse.json({ error: '合同编号已存在' }, { status: 409 })
      }
    }
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
        birthDate: resolvedBirthDate,
        position: resolvedPositionName,
        employmentStatus: resolvedEmploymentStatus,
        terminationDate: resolvedTerminationDate,
        terminationReason: resolvedTerminationReason,
        chineseProfile: isChinese
          ? {
              upsert: {
                create: chineseProfileData,
                update: chineseProfileData,
              },
            }
          : undefined,
        expatProfile: shouldUpsertExpatProfile
          ? {
              upsert: {
                create: expatProfileData,
                update: expatProfileData,
              },
            }
          : undefined,
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
        chineseProfile: true,
        expatProfile: true,
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
        birthDate: user.birthDate?.toISOString() ?? null,
        position: user.position,
        employmentStatus: user.employmentStatus,
        terminationDate: user.terminationDate?.toISOString() ?? null,
        terminationReason: user.terminationReason ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        roles: canAssignRole
          ? user.roles.map((item) => ({ id: item.role.id, name: item.role.name }))
          : [],
        chineseProfile: user.chineseProfile,
        expatProfile: user.expatProfile,
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
