import { NextResponse } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import { listUsers } from '@/lib/server/authStore'
import { resolveSupervisorSnapshot } from '@/lib/server/compensation'
import { normalizeTagsInput } from '@/lib/members/utils'
import { resolveTeamSupervisorId } from '@/lib/server/teamSupervisors'
import {
  hasExpatProfileData,
  hasChineseProfileData,
  normalizeExpatProfile,
  normalizeChineseProfile,
  parseBirthDateInput,
  parseChineseIdBirthDate,
} from '@/lib/server/memberProfiles'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await hasPermission('member:view'))) {
    return NextResponse.json({ error: '缺少成员查看权限' }, { status: 403 })
  }
  const canAssignRole =
    (await hasPermission('role:update')) || (await hasPermission('role:manage'))
  const members = await listUsers()
  const payload = canAssignRole
    ? members
    : members.map((member) => ({ ...member, roles: [] }))
  return NextResponse.json({ members: payload })
}

export async function POST(request: Request) {
  const canCreateMember =
    (await hasPermission('member:create')) || (await hasPermission('member:manage'))
  if (!canCreateMember) {
    return NextResponse.json({ error: '缺少成员新增权限' }, { status: 403 })
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
    tags,
    chineseProfile,
    expatProfile,
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
  const resolvedEmploymentStatus = employmentStatus ?? 'ACTIVE'
  const isChinese = nationality === 'china'
  const chineseProfileData = normalizeChineseProfile(chineseProfile)
  const shouldCreateChineseProfile = isChinese && hasChineseProfileData(chineseProfileData)
  const expatProfileData = normalizeExpatProfile(expatProfile)
  const resolvedSupervisorId = expatProfileData.team
    ? await resolveTeamSupervisorId(expatProfileData.team)
    : expatProfileData.chineseSupervisorId ?? null
  if (expatProfileData.team && !resolvedSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
  }
  expatProfileData.chineseSupervisorId = resolvedSupervisorId
  const shouldCreateExpatProfile = !isChinese || hasExpatProfileData(expatProfileData)
  const shouldCreateContractChange =
    !isChinese && (expatProfileData.contractNumber || expatProfileData.contractType)
  const shouldCreatePayrollChange =
    !isChinese &&
    (expatProfileData.salaryCategory ||
      expatProfileData.prime ||
      expatProfileData.baseSalaryAmount ||
      expatProfileData.baseSalaryUnit ||
      expatProfileData.netMonthlyAmount ||
      expatProfileData.netMonthlyUnit)
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

  const resolvedJoinDate = joinDate ? new Date(joinDate) : new Date()
  const addOneYear = (date: Date) => {
    const next = new Date(date)
    next.setFullYear(next.getFullYear() + 1)
    return next
  }
  const resolvedContractStartDate =
    !isChinese ? expatProfileData.contractStartDate ?? resolvedJoinDate : null
  const resolvedContractEndDate =
    !isChinese
      ? expatProfileData.contractEndDate ??
        (resolvedContractStartDate ? addOneYear(resolvedContractStartDate) : null)
      : null
  const normalizedTags = normalizeTagsInput(tags)

  try {
    const existing = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: '账号已存在（不区分大小写）' }, { status: 409 })
    }
    if (!isChinese && expatProfileData.contractNumber) {
      const contractOwner = await prisma.userExpatProfile.findUnique({
        where: { contractNumber: expatProfileData.contractNumber },
        select: { userId: true },
      })
      if (contractOwner) {
        return NextResponse.json({ error: '合同编号已存在' }, { status: 409 })
      }
    }

    const supervisorSnapshot = await resolveSupervisorSnapshot(
      expatProfileData.chineseSupervisorId ?? null,
    )
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username: normalizedUsername,
          passwordHash: hashPassword(password),
          name: name ?? '',
          gender: gender ?? null,
          nationality: nationality ?? null,
          phones: phoneList,
          joinDate: resolvedJoinDate,
          birthDate: resolvedBirthDate,
          position: resolvedPositionName,
          employmentStatus: resolvedEmploymentStatus,
          terminationDate: resolvedTerminationDate,
          terminationReason: resolvedTerminationReason,
          tags: normalizedTags,
          chineseProfile: shouldCreateChineseProfile
            ? {
                create: chineseProfileData,
              }
            : undefined,
          expatProfile: shouldCreateExpatProfile
            ? {
                create: {
                  ...expatProfileData,
                  contractStartDate: resolvedContractStartDate,
                  contractEndDate: resolvedContractEndDate,
                },
              }
            : undefined,
          roles: canAssignRole
            ? roleIdList.length === 0
              ? undefined
              : {
                  create: roleIdList.map((id) => ({
                    role: { connect: { id } },
                  })),
                }
            : undefined,
        },
        include: {
          roles: { include: { role: true } },
          chineseProfile: true,
          expatProfile: true,
        },
      })

      if (shouldCreateContractChange) {
        await tx.userContractChange.create({
          data: {
            userId: createdUser.id,
            team: expatProfileData.team,
            chineseSupervisorId: supervisorSnapshot.id,
            chineseSupervisorName: supervisorSnapshot.name,
            position: resolvedPositionName,
            contractNumber: expatProfileData.contractNumber,
            contractType: expatProfileData.contractType,
            salaryCategory: expatProfileData.salaryCategory,
            salaryAmount: expatProfileData.baseSalaryAmount,
            salaryUnit: expatProfileData.baseSalaryUnit,
            prime: expatProfileData.prime,
            startDate: resolvedContractStartDate,
            endDate: resolvedContractEndDate,
          },
        })
      }

      if (shouldCreatePayrollChange) {
        await tx.userPayrollChange.create({
          data: {
            userId: createdUser.id,
            team: expatProfileData.team,
            chineseSupervisorId: supervisorSnapshot.id,
            chineseSupervisorName: supervisorSnapshot.name,
            salaryCategory: expatProfileData.salaryCategory,
            salaryAmount: expatProfileData.baseSalaryAmount,
            salaryUnit: expatProfileData.baseSalaryUnit,
            prime: expatProfileData.prime,
            baseSalaryAmount: expatProfileData.baseSalaryAmount,
            baseSalaryUnit: expatProfileData.baseSalaryUnit,
            netMonthlyAmount: expatProfileData.netMonthlyAmount,
            netMonthlyUnit: expatProfileData.netMonthlyUnit,
          },
        })
      }

      return createdUser
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
        tags: user.tags ?? [],
        roles: canAssignRole
          ? user.roles.map((item) => ({ id: item.role.id, name: item.role.name }))
          : [],
        chineseProfile: user.chineseProfile,
        expatProfile: user.expatProfile,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建成员失败' },
      { status: 500 },
    )
  }
}
