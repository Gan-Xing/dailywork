import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { canManagePayroll, canViewPayroll, ensurePayrollRuns, parseYearMonth } from '@/lib/server/payrollRuns'

export async function GET(request: Request) {
  if (!(await canViewPayroll())) {
    return NextResponse.json({ error: '缺少工资发放查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const { year, month, isValid } = parseYearMonth({
    year: yearParam ?? undefined,
    month: monthParam ?? undefined,
  })
  if ((yearParam || monthParam) && !isValid) {
    return NextResponse.json({ error: '年月格式不正确' }, { status: 400 })
  }

  const runs = (await canManagePayroll())
    ? await ensurePayrollRuns(year, month)
    : await prisma.payrollRun.findMany({
        where: { year, month },
        orderBy: { sequence: 'asc' },
      })

  const runIds = runs.map((run) => run.id)
  const payouts = runIds.length
    ? await prisma.userPayrollPayout.findMany({
        where: { runId: { in: runIds } },
        orderBy: [{ runId: 'asc' }, { userId: 'asc' }],
      })
    : []

  return NextResponse.json({
    year,
    month,
    runs: runs.map((run) => ({
      id: run.id,
      year: run.year,
      month: run.month,
      sequence: run.sequence,
      payoutDate: run.payoutDate.toISOString(),
      attendanceCutoffDate: run.attendanceCutoffDate.toISOString(),
      note: run.note,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    })),
    payouts: payouts.map((item) => ({
      id: item.id,
      runId: item.runId,
      userId: item.userId,
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
