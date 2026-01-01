import { Prisma } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import { isDecimalEqual, resolveSupervisorSnapshot } from '@/lib/server/compensation'
import { createInitialContractChangeIfMissing } from '@/lib/server/contractChanges'
import { normalizeTagsInput, normalizeTeamKey } from '@/lib/members/utils'
import { resolveTeamDefaults } from '@/lib/server/teamSupervisors'
import { applyProjectAssignment } from '@/lib/server/memberProjects'
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
    tags,
    projectId,
    chineseProfile,
    expatProfile,
    skipChangeHistory,
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
  const shouldRecordHistory = !skipChangeHistory
  const chineseProfileData = normalizeChineseProfile(chineseProfile)
  const expatProfileData = normalizeExpatProfile(expatProfile)
  const shouldUpsertExpatProfile = !isChinese || hasExpatProfileData(expatProfileData)
  const hasProjectField = Object.prototype.hasOwnProperty.call(body ?? {}, 'projectId')
  const parsedProjectId = hasProjectField
    ? projectId === null || projectId === '' || projectId === undefined
      ? null
      : Number(projectId)
    : undefined
  if (hasProjectField && parsedProjectId !== null && !Number.isFinite(parsedProjectId)) {
    return NextResponse.json({ error: '项目无效' }, { status: 400 })
  }
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      nationality: true,
      joinDate: true,
      position: true,
      expatProfile: {
        select: {
          chineseSupervisorId: true,
          team: true,
          contractNumber: true,
          contractType: true,
          contractStartDate: true,
          contractEndDate: true,
          salaryCategory: true,
          prime: true,
          baseSalaryAmount: true,
          baseSalaryUnit: true,
          netMonthlyAmount: true,
          netMonthlyUnit: true,
        },
      },
      projectAssignments: {
        where: { endDate: null },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          project: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      },
    },
  })
  if (!existingUser) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  }
  const teamChanged =
    normalizeTeamKey(expatProfileData.team) !==
    normalizeTeamKey(existingUser.expatProfile?.team ?? null)
  const teamDefaults = expatProfileData.team
    ? await resolveTeamDefaults(expatProfileData.team)
    : { supervisorId: null, projectId: null }
  const resolvedSupervisorId = expatProfileData.team
    ? teamDefaults.supervisorId
    : expatProfileData.chineseSupervisorId ??
      existingUser.expatProfile?.chineseSupervisorId ??
      null
  if (expatProfileData.team && !resolvedSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
  }
  expatProfileData.chineseSupervisorId = resolvedSupervisorId
  let resolvedProjectId = hasProjectField ? (parsedProjectId ?? null) : undefined
  if (!hasProjectField && teamChanged) {
    resolvedProjectId = teamDefaults.projectId ?? null
  }
  const resolvedProject =
    resolvedProjectId !== undefined && resolvedProjectId !== null
      ? await prisma.project.findUnique({
          where: { id: resolvedProjectId },
          select: { id: true, name: true, code: true, isActive: true },
        })
      : null
  if (resolvedProjectId && !resolvedProject) {
    return NextResponse.json({ error: '项目不存在' }, { status: 400 })
  }
  const existingProject = existingUser.projectAssignments[0]?.project ?? null
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
    const existingExpat = existingUser.expatProfile
    const isSameDate = (left?: Date | null, right?: Date | null) => {
      if (!left && !right) return true
      if (!left || !right) return false
      return left.getTime() === right.getTime()
    }
    const resolvedJoinDate = joinDate ? new Date(joinDate) : existingUser.joinDate ?? null
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
    const contractChanged =
      existingExpat?.contractNumber !== expatProfileData.contractNumber ||
      existingExpat?.contractType !== expatProfileData.contractType ||
      !isSameDate(existingExpat?.contractStartDate, resolvedContractStartDate) ||
      !isSameDate(existingExpat?.contractEndDate, resolvedContractEndDate)
    const payrollChanged =
      existingExpat?.salaryCategory !== expatProfileData.salaryCategory ||
      !isDecimalEqual(existingExpat?.prime?.toString() ?? null, expatProfileData.prime) ||
      !isDecimalEqual(
        existingExpat?.baseSalaryAmount?.toString() ?? null,
        expatProfileData.baseSalaryAmount,
      ) ||
      existingExpat?.baseSalaryUnit !== expatProfileData.baseSalaryUnit ||
      !isDecimalEqual(
        existingExpat?.netMonthlyAmount?.toString() ?? null,
        expatProfileData.netMonthlyAmount,
      ) ||
      existingExpat?.netMonthlyUnit !== expatProfileData.netMonthlyUnit
    const supervisorSnapshot = await resolveSupervisorSnapshot(
      expatProfileData.chineseSupervisorId ?? null,
    )
    const normalizedTags = normalizeTagsInput(tags)

    if (!isChinese && expatProfileData.contractNumber) {
      const contractOwner = await prisma.userExpatProfile.findUnique({
        where: { contractNumber: expatProfileData.contractNumber },
        select: { userId: true },
      })
      if (contractOwner && contractOwner.userId !== userId) {
        return NextResponse.json({ error: '合同编号已存在' }, { status: 409 })
      }
    }
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
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
          tags: normalizedTags,
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
                  create: {
                    ...expatProfileData,
                    contractStartDate: resolvedContractStartDate,
                    contractEndDate: resolvedContractEndDate,
                  },
                  update: {
                    ...expatProfileData,
                    contractStartDate: resolvedContractStartDate,
                    contractEndDate: resolvedContractEndDate,
                  },
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

      if (!isChinese && contractChanged && shouldRecordHistory) {
        await createInitialContractChangeIfMissing(tx, {
          userId,
          expatProfile: existingUser.expatProfile,
          joinDate: existingUser.joinDate,
          fallbackChangeDate: new Date(),
          team: existingUser.expatProfile?.team ?? null,
          position: existingUser.position ?? null,
        })
        await tx.userContractChange.create({
          data: {
            userId,
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

      if (!isChinese && payrollChanged && shouldRecordHistory) {
        await tx.userPayrollChange.create({
          data: {
            userId,
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

      if (resolvedProjectId !== undefined) {
        await applyProjectAssignment(tx, {
          userId,
          projectId: resolvedProjectId,
          startDate: new Date(),
          fallbackStartDate: resolvedJoinDate,
        })
      }

      return updatedUser
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
        project:
          resolvedProjectId !== undefined
            ? resolvedProject
            : existingProject,
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
