import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { canManagePayroll, canViewPayroll, ensurePayrollRuns, parseYearMonth } from '@/lib/server/payrollRuns'

type ContractSnapshot = {
  contractNumber: string | null
  contractType: string | null
  ctjOverlap?: boolean
}

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

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

  const expatProfiles = await prisma.userExpatProfile.findMany({
    select: {
      userId: true,
      contractNumber: true,
      contractType: true,
    },
  })
  const expatUserIds = expatProfiles.map((profile) => profile.userId)
  const contractChanges = expatUserIds.length
    ? await prisma.userContractChange.findMany({
        where: { userId: { in: expatUserIds } },
        select: {
          userId: true,
          contractNumber: true,
          contractType: true,
          startDate: true,
          endDate: true,
          changeDate: true,
        },
      })
    : []

  const contractChangesByUser = new Map<number, typeof contractChanges>()
  contractChanges.forEach((change) => {
    const list = contractChangesByUser.get(change.userId) ?? []
    list.push(change)
    contractChangesByUser.set(change.userId, list)
  })

  const resolveContractSnapshot = (
    changes: typeof contractChanges,
    cutoffDate: Date,
  ): ContractSnapshot | null => {
    if (changes.length === 0) return null
    const cutoffTime = cutoffDate.getTime()
    const byPeriod = changes
      .filter((change) => change.startDate && change.startDate.getTime() <= cutoffTime)
      .filter((change) => !change.endDate || change.endDate.getTime() >= cutoffTime)
      .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))
    const match = byPeriod[0]
    if (match) {
      return {
        contractNumber: match.contractNumber ?? null,
        contractType: match.contractType ?? null,
      }
    }
    const byChangeDate = changes
      .filter((change) => change.changeDate.getTime() <= cutoffTime)
      .sort((a, b) => b.changeDate.getTime() - a.changeDate.getTime())
    const fallback = byChangeDate[0]
    if (!fallback) return null
    return {
      contractNumber: fallback.contractNumber ?? null,
      contractType: fallback.contractType ?? null,
    }
  }

  const hasCtjOverlap = (changes: typeof contractChanges, periodStart: Date, periodEnd: Date) => {
    const startTime = periodStart.getTime()
    const endTime = periodEnd.getTime()
    return changes.some((change) => {
      if (change.contractType !== 'CTJ') return false
      const start = change.startDate ?? change.changeDate
      const end = change.endDate ?? null
      if (!start) return false
      const startDate = start.getTime()
      const endDate = end ? end.getTime() : Number.POSITIVE_INFINITY
      return startDate <= endTime && endDate >= startTime
    })
  }

  let runOneStartDate: Date | null = null
  const runOne = runs.find((run) => run.sequence === 1)
  if (runOne) {
    const prevMonth = runOne.month === 1 ? 12 : runOne.month - 1
    const prevYear = runOne.month === 1 ? runOne.year - 1 : runOne.year
    const prevRun = await prisma.payrollRun.findFirst({
      where: { year: prevYear, month: prevMonth, sequence: 2 },
      select: { attendanceCutoffDate: true },
    })
    if (prevRun?.attendanceCutoffDate) {
      runOneStartDate = addUtcDays(prevRun.attendanceCutoffDate, 1)
    }
  }

  const contractSnapshots = runs.map((run) => {
    const contracts: Record<number, ContractSnapshot> = {}
    expatProfiles.forEach((profile) => {
      const changes = contractChangesByUser.get(profile.userId) ?? []
      const snapshot = resolveContractSnapshot(changes, run.attendanceCutoffDate)
      const contractNumber = snapshot?.contractNumber ?? profile.contractNumber ?? null
      const contractType = snapshot?.contractType ?? profile.contractType ?? null
      const ctjOverlap =
        run.sequence === 1 && runOneStartDate
          ? hasCtjOverlap(changes, runOneStartDate, run.attendanceCutoffDate)
          : false
      contracts[profile.userId] = { contractNumber, contractType, ctjOverlap }
    })
    return {
      runId: run.id,
      cutoffDate: run.attendanceCutoffDate.toISOString(),
      contracts,
    }
  })

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
    contractSnapshots,
  })
}
