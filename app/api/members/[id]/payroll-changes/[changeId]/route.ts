import { NextResponse } from 'next/server'

import {
  normalizeOptionalDate,
  normalizeOptionalDecimal,
  normalizeOptionalText,
  parseSalaryUnit,
  resolveSupervisorSnapshot,
} from '@/lib/server/compensation'
import { hasPermission } from '@/lib/server/authSession'
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

  const record = await prisma.userPayrollChange.findUnique({
    where: { id: recordId },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '工资变更记录不存在' }, { status: 404 })
  }

  const expatProfile = await prisma.userExpatProfile.findUnique({
    where: { userId },
    select: {
      chineseSupervisorId: true,
      team: true,
      salaryCategory: true,
      prime: true,
      baseSalaryAmount: true,
      baseSalaryUnit: true,
      netMonthlyAmount: true,
      netMonthlyUnit: true,
    },
  })
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const salaryCategory = hasField('salaryCategory')
    ? normalizeOptionalText(body.salaryCategory)
    : record.salaryCategory
  const prime = hasField('prime')
    ? normalizeOptionalDecimal(body.prime)
    : record.prime?.toString() ?? null
  const baseSalaryAmount = hasField('baseSalaryAmount')
    ? normalizeOptionalDecimal(body.baseSalaryAmount)
    : record.baseSalaryAmount?.toString() ?? null
  const baseSalaryUnit = hasField('baseSalaryUnit')
    ? parseSalaryUnit(body.baseSalaryUnit)
    : record.baseSalaryUnit
  const netMonthlyAmount = hasField('netMonthlyAmount')
    ? normalizeOptionalDecimal(body.netMonthlyAmount)
    : record.netMonthlyAmount?.toString() ?? null
  const netMonthlyUnit = hasField('netMonthlyUnit')
    ? parseSalaryUnit(body.netMonthlyUnit)
    : record.netMonthlyUnit
  const team = hasField('team') ? normalizeOptionalText(body.team) : record.team
  const changeDate = hasField('changeDate')
    ? normalizeOptionalDate(body.changeDate) ?? record.changeDate
    : record.changeDate
  const nextSupervisorId = hasField('chineseSupervisorId')
    ? Number(body.chineseSupervisorId) || null
    : record.chineseSupervisorId

  const supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.userPayrollChange.update({
      where: { id: recordId },
      data: {
        team,
        chineseSupervisorId: supervisorSnapshot.id,
        chineseSupervisorName: supervisorSnapshot.name,
        salaryCategory,
        salaryAmount: baseSalaryAmount,
        salaryUnit: baseSalaryUnit,
        prime,
        baseSalaryAmount,
        baseSalaryUnit,
        netMonthlyAmount,
        netMonthlyUnit,
        changeDate,
      },
    })

    await tx.userExpatProfile.update({
      where: { userId },
      data: {
        team: team ?? expatProfile.team,
        chineseSupervisorId: supervisorSnapshot.id,
        salaryCategory,
        prime,
        baseSalaryAmount,
        baseSalaryUnit,
        netMonthlyAmount,
        netMonthlyUnit,
      },
    })

    return updatedRecord
  })

  return NextResponse.json({
    payrollChange: {
      id: updated.id,
      userId: updated.userId,
      team: updated.team,
      chineseSupervisorId: updated.chineseSupervisorId,
      chineseSupervisorName: updated.chineseSupervisorName,
      salaryCategory: updated.salaryCategory,
      salaryAmount: updated.salaryAmount?.toString() ?? null,
      salaryUnit: updated.salaryUnit,
      prime: updated.prime?.toString() ?? null,
      baseSalaryAmount: updated.baseSalaryAmount?.toString() ?? null,
      baseSalaryUnit: updated.baseSalaryUnit,
      netMonthlyAmount: updated.netMonthlyAmount?.toString() ?? null,
      netMonthlyUnit: updated.netMonthlyUnit,
      changeDate: updated.changeDate.toISOString(),
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

  const record = await prisma.userPayrollChange.findUnique({
    where: { id: recordId },
    select: { userId: true },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '工资变更记录不存在' }, { status: 404 })
  }

  await prisma.userPayrollChange.delete({ where: { id: recordId } })
  return NextResponse.json({ ok: true })
}
