import { NextResponse } from 'next/server'

import {
  normalizeOptionalDate,
  normalizeOptionalDecimal,
  normalizeOptionalText,
  parseSalaryUnit,
  resolveSupervisorSnapshot,
} from '@/lib/server/compensation'
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
      expatProfile: {
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
      },
    },
  })
  if (!user) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  }
  if (user.nationality === 'china') {
    return NextResponse.json({ error: '中方成员无需工资变更记录' }, { status: 400 })
  }
  const expatProfile = user.expatProfile
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const salaryCategory = hasField('salaryCategory')
    ? normalizeOptionalText(body.salaryCategory)
    : expatProfile.salaryCategory
  const prime = hasField('prime')
    ? normalizeOptionalDecimal(body.prime)
    : expatProfile.prime?.toString() ?? null
  const baseSalaryAmount = hasField('baseSalaryAmount')
    ? normalizeOptionalDecimal(body.baseSalaryAmount)
    : expatProfile.baseSalaryAmount?.toString() ?? null
  const baseSalaryUnit = hasField('baseSalaryUnit')
    ? parseSalaryUnit(body.baseSalaryUnit)
    : expatProfile.baseSalaryUnit
  const netMonthlyAmount = hasField('netMonthlyAmount')
    ? normalizeOptionalDecimal(body.netMonthlyAmount)
    : expatProfile.netMonthlyAmount?.toString() ?? null
  const netMonthlyUnit = hasField('netMonthlyUnit')
    ? parseSalaryUnit(body.netMonthlyUnit)
    : expatProfile.netMonthlyUnit
  const team = hasField('team') ? normalizeOptionalText(body.team) : expatProfile.team
  const changeDate = normalizeOptionalDate(body.changeDate) ?? new Date()
  const nextSupervisorId = team
    ? await resolveTeamSupervisorId(team)
    : expatProfile.chineseSupervisorId ?? null
  if (team && !nextSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
  }

  const hasPayload =
    Boolean(salaryCategory) ||
    Boolean(prime) ||
    Boolean(baseSalaryAmount) ||
    Boolean(baseSalaryUnit) ||
    Boolean(netMonthlyAmount) ||
    Boolean(netMonthlyUnit)
  if (!hasPayload) {
    return NextResponse.json({ error: '缺少工资变更字段' }, { status: 400 })
  }

  const supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)

  const result = await prisma.$transaction(async (tx) => {
    const change = await tx.userPayrollChange.create({
      data: {
        userId,
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

    await tx.userExpatProfile.upsert({
      where: { userId },
      create: {
        userId,
        team,
        chineseSupervisorId: supervisorSnapshot.id,
        salaryCategory,
        prime,
        baseSalaryAmount,
        baseSalaryUnit,
        netMonthlyAmount,
        netMonthlyUnit,
      },
      update: {
        team,
        chineseSupervisorId: supervisorSnapshot.id,
        salaryCategory,
        prime,
        baseSalaryAmount,
        baseSalaryUnit,
        netMonthlyAmount,
        netMonthlyUnit,
      },
    })

    return change
  })

  return NextResponse.json({
    payrollChange: {
      id: result.id,
      userId: result.userId,
      team: result.team,
      chineseSupervisorId: result.chineseSupervisorId,
      chineseSupervisorName: result.chineseSupervisorName,
      salaryCategory: result.salaryCategory,
      salaryAmount: result.salaryAmount?.toString() ?? null,
      salaryUnit: result.salaryUnit,
      prime: result.prime?.toString() ?? null,
      baseSalaryAmount: result.baseSalaryAmount?.toString() ?? null,
      baseSalaryUnit: result.baseSalaryUnit,
      netMonthlyAmount: result.netMonthlyAmount?.toString() ?? null,
      netMonthlyUnit: result.netMonthlyUnit,
      changeDate: result.changeDate.toISOString(),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    },
  })
}
