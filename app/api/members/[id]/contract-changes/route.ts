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
import { createInitialContractChangeIfMissing } from '@/lib/server/contractChanges'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const canManageCompensation = async () => {
  return (
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  )
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
  const nextSupervisorId = hasField('chineseSupervisorId')
    ? Number(body.chineseSupervisorId) || null
    : expatProfile.chineseSupervisorId ?? null

  const hasPayload =
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
    })
    const change = await tx.userContractChange.create({
      data: {
        userId,
        chineseSupervisorId: supervisorSnapshot.id,
        chineseSupervisorName: supervisorSnapshot.name,
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

    await tx.userExpatProfile.upsert({
      where: { userId },
      create: {
        userId,
        chineseSupervisorId: supervisorSnapshot.id,
        contractNumber,
        contractType,
        salaryCategory,
        prime,
        baseSalaryAmount: salaryAmount,
        baseSalaryUnit: salaryUnit,
        contractStartDate: resolvedStartDate,
        contractEndDate: resolvedEndDate,
      },
      update: {
        chineseSupervisorId: supervisorSnapshot.id,
        contractNumber,
        contractType,
        salaryCategory,
        prime,
        baseSalaryAmount: salaryAmount,
        baseSalaryUnit: salaryUnit,
        contractStartDate: resolvedStartDate,
        contractEndDate: resolvedEndDate,
      },
    })

    if (salaryChanged) {
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

    return change
  })

  return NextResponse.json({
    contractChange: {
      id: result.id,
      userId: result.userId,
      chineseSupervisorId: result.chineseSupervisorId,
      chineseSupervisorName: result.chineseSupervisorName,
      contractNumber: result.contractNumber,
      contractType: result.contractType,
      salaryCategory: result.salaryCategory,
      salaryAmount: result.salaryAmount?.toString() ?? null,
      salaryUnit: result.salaryUnit,
      prime: result.prime?.toString() ?? null,
      startDate: result.startDate?.toISOString() ?? null,
      endDate: result.endDate?.toISOString() ?? null,
      changeDate: result.changeDate.toISOString(),
      reason: result.reason,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    },
  })
}
