import { NextResponse } from 'next/server'

import {
  normalizeOptionalDate,
  normalizeOptionalDecimal,
  normalizeOptionalText,
  parseContractType,
  parseSalaryUnit,
  resolveSupervisorSnapshot,
} from '@/lib/server/compensation'
import { hasPermission } from '@/lib/server/authSession'
import {
  applyLatestContractSnapshot,
  syncJoinDateFromContracts,
  syncPositionFromContracts,
} from '@/lib/server/contractChanges'
import { normalizeTeamKey } from '@/lib/members/utils'
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> },
) {
  const { id, changeId } = await params
  const userId = Number(id)
  const recordId = Number(changeId)
  if (!userId || !recordId) {
    return NextResponse.json({ error: '缺少成员或记录 ID' }, { status: 400 })
  }
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const record = await prisma.userContractChange.findUnique({
    where: { id: recordId },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '合同变更记录不存在' }, { status: 404 })
  }

  const expatProfile = await prisma.userExpatProfile.findUnique({
    where: { userId },
    select: {
      team: true,
      chineseSupervisorId: true,
      contractNumber: true,
      contractType: true,
      salaryCategory: true,
      baseSalaryAmount: true,
      baseSalaryUnit: true,
      prime: true,
    },
  })
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const hasTeamField = hasField('team')
  const teamInput = hasTeamField ? normalizeOptionalText(body.team) : null
  const team = hasTeamField ? teamInput : record.team ?? null
  const position = hasField('position') ? normalizeOptionalText(body.position) : record.position
  const contractNumber = hasField('contractNumber')
    ? normalizeOptionalText(body.contractNumber)
    : record.contractNumber
  const contractType = hasField('contractType')
    ? parseContractType(body.contractType)
    : record.contractType
  const salaryCategory = hasField('salaryCategory')
    ? normalizeOptionalText(body.salaryCategory)
    : record.salaryCategory
  const salaryAmount = hasField('salaryAmount')
    ? normalizeOptionalDecimal(body.salaryAmount)
    : record.salaryAmount?.toString() ?? null
  const salaryUnit = hasField('salaryUnit')
    ? parseSalaryUnit(body.salaryUnit)
    : record.salaryUnit
  const prime = hasField('prime')
    ? normalizeOptionalDecimal(body.prime)
    : record.prime?.toString() ?? null
  const startDate = hasField('startDate')
    ? normalizeOptionalDate(body.startDate)
    : record.startDate
  const endDate = hasField('endDate') ? normalizeOptionalDate(body.endDate) : record.endDate
  const changeDate = hasField('changeDate')
    ? normalizeOptionalDate(body.changeDate) ?? record.changeDate
    : record.changeDate
  const reason = hasField('reason') ? normalizeOptionalText(body.reason) : record.reason
  const isTeamChanged =
    hasTeamField && normalizeTeamKey(teamInput ?? null) !== normalizeTeamKey(record.team)
  let supervisorSnapshot = {
    id: record.chineseSupervisorId ?? null,
    name: record.chineseSupervisorName ?? null,
  }
  if (isTeamChanged) {
    if (teamInput) {
      const nextSupervisorId = await resolveTeamSupervisorId(teamInput)
      if (!nextSupervisorId) {
        return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
      }
      supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)
    } else {
      supervisorSnapshot = { id: null, name: null }
    }
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

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.userContractChange.update({
      where: { id: recordId },
      data: {
        team,
        chineseSupervisorId: supervisorSnapshot.id,
        chineseSupervisorName: supervisorSnapshot.name,
        position,
        contractNumber,
        contractType,
        salaryCategory,
        salaryAmount,
        salaryUnit,
        prime,
        startDate,
        endDate,
        changeDate,
        reason,
      },
    })

    await applyLatestContractSnapshot(tx, userId)

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

    return { change: updatedRecord, expatProfile: updatedProfile, joinDate, position: positionValue }
  })

  return NextResponse.json({
    contractChange: {
      id: updated.change.id,
      userId: updated.change.userId,
      team: updated.change.team ?? null,
      chineseSupervisorId: updated.change.chineseSupervisorId,
      chineseSupervisorName: updated.change.chineseSupervisorName,
      position: updated.change.position ?? null,
      contractNumber: updated.change.contractNumber,
      contractType: updated.change.contractType,
      salaryCategory: updated.change.salaryCategory,
      salaryAmount: updated.change.salaryAmount?.toString() ?? null,
      salaryUnit: updated.change.salaryUnit,
      prime: updated.change.prime?.toString() ?? null,
      startDate: updated.change.startDate?.toISOString() ?? null,
      endDate: updated.change.endDate?.toISOString() ?? null,
      changeDate: updated.change.changeDate.toISOString(),
      reason: updated.change.reason,
      createdAt: updated.change.createdAt.toISOString(),
      updatedAt: updated.change.updatedAt.toISOString(),
    },
    expatProfile: formatExpatProfile(updated.expatProfile),
    joinDate: updated.joinDate ? updated.joinDate.toISOString() : null,
    position: updated.position ?? null,
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> },
) {
  const { id, changeId } = await params
  const userId = Number(id)
  const recordId = Number(changeId)
  if (!userId || !recordId) {
    return NextResponse.json({ error: '缺少成员或记录 ID' }, { status: 400 })
  }
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const record = await prisma.userContractChange.findUnique({
    where: { id: recordId },
    select: { userId: true },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '合同变更记录不存在' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.userContractChange.delete({ where: { id: recordId } })
    await applyLatestContractSnapshot(tx, userId)
    const joinDate = await syncJoinDateFromContracts(tx, userId)
    const position = await syncPositionFromContracts(tx, userId)
    return { joinDate, position }
  })
  return NextResponse.json({
    ok: true,
    joinDate: result.joinDate ? result.joinDate.toISOString() : null,
    position: result.position ?? null,
  })
}
