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
import { applyLatestContractSnapshot } from '@/lib/server/contractChanges'
import { resolveTeamSupervisorId } from '@/lib/server/teamSupervisors'
import { prisma } from '@/lib/prisma'

const canManageCompensation = async () => {
  return (
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  )
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
  const nextSupervisorId = expatProfile.team
    ? await resolveTeamSupervisorId(expatProfile.team)
    : record.chineseSupervisorId ?? expatProfile.chineseSupervisorId ?? null
  if (expatProfile.team && !nextSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
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

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.userContractChange.update({
      where: { id: recordId },
      data: {
        chineseSupervisorId: supervisorSnapshot.id,
        chineseSupervisorName: supervisorSnapshot.name,
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

    return updatedRecord
  })

  return NextResponse.json({
    contractChange: {
      id: updated.id,
      userId: updated.userId,
      chineseSupervisorId: updated.chineseSupervisorId,
      chineseSupervisorName: updated.chineseSupervisorName,
      contractNumber: updated.contractNumber,
      contractType: updated.contractType,
      salaryCategory: updated.salaryCategory,
      salaryAmount: updated.salaryAmount?.toString() ?? null,
      salaryUnit: updated.salaryUnit,
      prime: updated.prime?.toString() ?? null,
      startDate: updated.startDate?.toISOString() ?? null,
      endDate: updated.endDate?.toISOString() ?? null,
      changeDate: updated.changeDate.toISOString(),
      reason: updated.reason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
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

  await prisma.$transaction(async (tx) => {
    await tx.userContractChange.delete({ where: { id: recordId } })
    await applyLatestContractSnapshot(tx, userId)
  })
  return NextResponse.json({ ok: true })
}
