import { NextResponse } from 'next/server'

import {
  isDecimalEqual,
  normalizeOptionalDate,
  normalizeOptionalDecimal,
  normalizeOptionalText,
  parseContractType,
  parseSalaryUnit,
  resolveSupervisorSnapshot,
} from '@/lib/server/compensation'
import {
  applyLatestContractSnapshot,
  createInitialContractChangeIfMissing,
  syncJoinDateFromContracts,
  syncPositionFromContracts,
} from '@/lib/server/contractChanges'
import { hasPermission } from '@/lib/server/authSession'
import { resolveTeamSupervisorId } from '@/lib/server/teamSupervisors'
import { prisma } from '@/lib/prisma'

const canManageCompensation = async () => {
  return (
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  )
}

const formatExpatProfile = (profile: {
  team: string | null
  chineseSupervisorId: number | null
  contractNumber: string | null
  contractType: string | null
  contractStartDate: Date | null
  contractEndDate: Date | null
  salaryCategory: string | null
  prime: { toString: () => string } | string | null
  baseSalaryAmount: { toString: () => string } | string | null
  baseSalaryUnit: string | null
  netMonthlyAmount: { toString: () => string } | string | null
  netMonthlyUnit: string | null
  maritalStatus: string | null
  childrenCount: number | null
  cnpsNumber: string | null
  cnpsDeclarationCode: string | null
  provenance: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
} | null) => {
  if (!profile) return null
  return {
    team: profile.team,
    chineseSupervisorId: profile.chineseSupervisorId ?? null,
    contractNumber: profile.contractNumber,
    contractType: profile.contractType,
    contractStartDate: profile.contractStartDate?.toISOString() ?? null,
    contractEndDate: profile.contractEndDate?.toISOString() ?? null,
    salaryCategory: profile.salaryCategory,
    prime: profile.prime?.toString() ?? null,
    baseSalaryAmount: profile.baseSalaryAmount?.toString() ?? null,
    baseSalaryUnit: profile.baseSalaryUnit,
    netMonthlyAmount: profile.netMonthlyAmount?.toString() ?? null,
    netMonthlyUnit: profile.netMonthlyUnit,
    maritalStatus: profile.maritalStatus,
    childrenCount: profile.childrenCount,
    cnpsNumber: profile.cnpsNumber,
    cnpsDeclarationCode: profile.cnpsDeclarationCode,
    provenance: profile.provenance,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
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
          baseSalaryAmount: true,
          baseSalaryUnit: true,
          prime: true,
          netMonthlyAmount: true,
          netMonthlyUnit: true,
        },
      },
    },
  })
  if (!user) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  }
  if (user.nationality === 'china') {
    return NextResponse.json({ error: '中方成员无需合同变更记录' }, { status: 400 })
  }
  const expatProfile = user.expatProfile
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const hasTeamField = hasField('team')
  const teamInput = hasTeamField ? normalizeOptionalText(body.team) : null
  const resolvedTeam = hasTeamField ? teamInput : expatProfile.team ?? null
  const position = hasField('position') ? normalizeOptionalText(body.position) : user.position ?? null
  const contractNumber = hasField('contractNumber')
    ? normalizeOptionalText(body.contractNumber)
    : expatProfile.contractNumber
  const contractType = hasField('contractType')
    ? parseContractType(body.contractType)
    : expatProfile.contractType
  const salaryCategory = hasField('salaryCategory')
    ? normalizeOptionalText(body.salaryCategory)
    : expatProfile.salaryCategory
  const salaryAmount = hasField('salaryAmount')
    ? normalizeOptionalDecimal(body.salaryAmount)
    : expatProfile.baseSalaryAmount?.toString() ?? null
  const salaryUnit = hasField('salaryUnit')
    ? parseSalaryUnit(body.salaryUnit)
    : expatProfile.baseSalaryUnit
  const prime = hasField('prime')
    ? normalizeOptionalDecimal(body.prime)
    : expatProfile.prime?.toString() ?? null
  const startDateInput = normalizeOptionalDate(body.startDate)
  const endDateInput = normalizeOptionalDate(body.endDate)
  const changeDate = normalizeOptionalDate(body.changeDate) ?? new Date()
  const reason = normalizeOptionalText(body.reason)
  const nextSupervisorId = resolvedTeam
    ? await resolveTeamSupervisorId(resolvedTeam)
    : expatProfile.chineseSupervisorId ?? null
  if (resolvedTeam && !nextSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
  }

  const hasPayload =
    hasTeamField ||
    Boolean(position) ||
    Boolean(contractNumber) ||
    Boolean(contractType) ||
    Boolean(salaryCategory) ||
    Boolean(salaryAmount) ||
    Boolean(salaryUnit) ||
    Boolean(prime) ||
    Boolean(startDateInput) ||
    Boolean(endDateInput)
  if (!hasPayload) {
    return NextResponse.json({ error: '缺少合同变更字段' }, { status: 400 })
  }
  if (contractType === 'CDD' && salaryUnit === 'HOUR') {
    return NextResponse.json({ error: 'CDD 合同基础工资必须按月' }, { status: 400 })
  }
  if (contractNumber && contractNumber !== expatProfile.contractNumber) {
    const owner = await prisma.userExpatProfile.findUnique({
      where: { contractNumber },
      select: { userId: true },
    })
    if (owner && owner.userId !== userId) {
      return NextResponse.json({ error: '合同编号已存在' }, { status: 409 })
    }
  }

  const supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)
  const salaryChanged =
    salaryCategory !== expatProfile.salaryCategory ||
    !isDecimalEqual(expatProfile.baseSalaryAmount, salaryAmount) ||
    expatProfile.baseSalaryUnit !== salaryUnit ||
    !isDecimalEqual(expatProfile.prime, prime)
  const addOneYear = (date: Date) => {
    const next = new Date(date)
    next.setFullYear(next.getFullYear() + 1)
    return next
  }
  const resolvedStartDate = startDateInput ?? changeDate
  const resolvedEndDate = endDateInput ?? addOneYear(resolvedStartDate)

  const result = await prisma.$transaction(async (tx) => {
    await createInitialContractChangeIfMissing(tx, {
      userId,
      expatProfile,
      joinDate: user.joinDate,
      fallbackChangeDate: changeDate,
      team: expatProfile.team ?? null,
      position: user.position ?? null,
    })
    const change = await tx.userContractChange.create({
      data: {
        userId,
        team: resolvedTeam,
        chineseSupervisorId: supervisorSnapshot.id,
        chineseSupervisorName: supervisorSnapshot.name,
        position,
        contractNumber,
        contractType,
        salaryCategory,
        salaryAmount,
        salaryUnit,
        prime,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
        changeDate,
        reason,
      },
    })

    const latest = await applyLatestContractSnapshot(tx, userId)

    if (latest?.id === change.id && salaryChanged) {
      await tx.userPayrollChange.create({
        data: {
          userId,
          team: expatProfile.team,
          chineseSupervisorId: supervisorSnapshot.id,
          chineseSupervisorName: supervisorSnapshot.name,
          salaryCategory,
          salaryAmount,
          salaryUnit,
          prime,
          baseSalaryAmount: salaryAmount,
          baseSalaryUnit: salaryUnit,
          netMonthlyAmount: expatProfile.netMonthlyAmount?.toString() ?? null,
          netMonthlyUnit: expatProfile.netMonthlyUnit,
          changeDate,
        },
      })
    }

    const joinDate = await syncJoinDateFromContracts(tx, userId)
    const positionValue = await syncPositionFromContracts(tx, userId)
    const updatedProfile = await tx.userExpatProfile.findUnique({
      where: { userId },
      select: {
        team: true,
        chineseSupervisorId: true,
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
        maritalStatus: true,
        childrenCount: true,
        cnpsNumber: true,
        cnpsDeclarationCode: true,
        provenance: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
    })

    return { change, expatProfile: updatedProfile, joinDate, position: positionValue }
  })

  return NextResponse.json({
    contractChange: {
      id: result.change.id,
      userId: result.change.userId,
      team: result.change.team ?? null,
      chineseSupervisorId: result.change.chineseSupervisorId,
      chineseSupervisorName: result.change.chineseSupervisorName,
      position: result.change.position ?? null,
      contractNumber: result.change.contractNumber,
      contractType: result.change.contractType,
      salaryCategory: result.change.salaryCategory,
      salaryAmount: result.change.salaryAmount?.toString() ?? null,
      salaryUnit: result.change.salaryUnit,
      prime: result.change.prime?.toString() ?? null,
      startDate: result.change.startDate?.toISOString() ?? null,
      endDate: result.change.endDate?.toISOString() ?? null,
      changeDate: result.change.changeDate.toISOString(),
      reason: result.change.reason,
      createdAt: result.change.createdAt.toISOString(),
      updatedAt: result.change.updatedAt.toISOString(),
    },
    expatProfile: formatExpatProfile(result.expatProfile),
    joinDate: result.joinDate ? result.joinDate.toISOString() : null,
    position: result.position ?? null,
  })
}
