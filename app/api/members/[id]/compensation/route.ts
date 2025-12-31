import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const canAccessCompensation = async () => {
  return (
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  )
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = Number(id)
  if (!userId) {
    return NextResponse.json({ error: '缺少成员 ID' }, { status: 400 })
  }
  if (!(await canAccessCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const [contractChanges, payrollChanges, payrollPayouts] = await prisma.$transaction([
    prisma.userContractChange.findMany({
      where: { userId },
      orderBy: { changeDate: 'desc' },
    }),
    prisma.userPayrollChange.findMany({
      where: { userId },
      orderBy: { changeDate: 'desc' },
    }),
    prisma.userPayrollPayout.findMany({
      where: { userId },
      orderBy: { payoutDate: 'desc' },
    }),
  ])

  return NextResponse.json({
    contractChanges: contractChanges.map((item) => ({
      id: item.id,
      userId: item.userId,
      team: item.team,
      chineseSupervisorId: item.chineseSupervisorId,
      chineseSupervisorName: item.chineseSupervisorName,
      position: item.position,
      contractNumber: item.contractNumber,
      contractType: item.contractType,
      salaryCategory: item.salaryCategory,
      salaryAmount: item.salaryAmount?.toString() ?? null,
      salaryUnit: item.salaryUnit,
      prime: item.prime?.toString() ?? null,
      startDate: item.startDate?.toISOString() ?? null,
      endDate: item.endDate?.toISOString() ?? null,
      changeDate: item.changeDate.toISOString(),
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    payrollChanges: payrollChanges.map((item) => ({
      id: item.id,
      userId: item.userId,
      team: item.team,
      chineseSupervisorId: item.chineseSupervisorId,
      chineseSupervisorName: item.chineseSupervisorName,
      salaryCategory: item.salaryCategory,
      salaryAmount: item.salaryAmount?.toString() ?? null,
      salaryUnit: item.salaryUnit,
      prime: item.prime?.toString() ?? null,
      baseSalaryAmount: item.baseSalaryAmount?.toString() ?? null,
      baseSalaryUnit: item.baseSalaryUnit,
      netMonthlyAmount: item.netMonthlyAmount?.toString() ?? null,
      netMonthlyUnit: item.netMonthlyUnit,
      changeDate: item.changeDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    payrollPayouts: payrollPayouts.map((item) => ({
      id: item.id,
      userId: item.userId,
      runId: item.runId,
      team: item.team,
      chineseSupervisorId: item.chineseSupervisorId,
      chineseSupervisorName: item.chineseSupervisorName,
      payoutDate: item.payoutDate.toISOString(),
      amount: item.amount.toString(),
      currency: item.currency,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  })
}
