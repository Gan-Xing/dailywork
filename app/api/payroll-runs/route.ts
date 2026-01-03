import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { canManagePayroll, canViewPayroll, ensurePayrollRuns, parseYearMonth } from '@/lib/server/payrollRuns'

type ContractSnapshot = {
  contractNumber: string | null
  contractType: string | null
  ctjOverlap?: boolean
  contractOverlap?: boolean
}

type MonthParam = { year: number; month: number; key: string }

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const formatMonthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const parseMonthList = (value: string) => {
  const raw = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(raw))
  const months: MonthParam[] = []
  for (const item of unique) {
    const match = /^(\d{4})-(\d{2})$/.exec(item)
    if (!match) return { months: [], isValid: false }
    const year = Number(match[1])
    const month = Number(match[2])
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { months: [], isValid: false }
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { months: [], isValid: false }
    }
    months.push({ year, month, key: formatMonthKey(year, month) })
  }
  return { months, isValid: true }
}

const parseIdList = (value: string) => {
  const raw = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(raw))
  const ids: number[] = []
  for (const item of unique) {
    const parsed = Number(item)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ids: [], isValid: false }
    }
    ids.push(parsed)
  }
  return { ids, isValid: true }
}

const getPrevYearMonth = (year: number, month: number) =>
  month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }

export async function GET(request: Request) {
  if (!(await canViewPayroll())) {
    return NextResponse.json({ error: '缺少工资发放查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const monthsParam = searchParams.get('months')
  const memberIdsParam = searchParams.get('memberIds')

  const parsedMemberIds = memberIdsParam ? parseIdList(memberIdsParam) : { ids: [], isValid: true }
  if (!parsedMemberIds.isValid) {
    return NextResponse.json({ error: '成员ID格式不正确' }, { status: 400 })
  }
  const memberIds = parsedMemberIds.ids

  let targetMonths: MonthParam[] = []
  if (monthsParam) {
    const parsed = parseMonthList(monthsParam)
    if (!parsed.isValid || parsed.months.length === 0) {
      return NextResponse.json({ error: '月份格式不正确' }, { status: 400 })
    }
    targetMonths = parsed.months
  } else {
    const { year, month, isValid } = parseYearMonth({
      year: yearParam ?? undefined,
      month: monthParam ?? undefined,
    })
    if ((yearParam || monthParam) && !isValid) {
      return NextResponse.json({ error: '年月格式不正确' }, { status: 400 })
    }
    targetMonths = [{ year, month, key: formatMonthKey(year, month) }]
  }

  const canManage = await canManagePayroll()
  const runs = canManage
    ? (
        await Promise.all(
          targetMonths.map(({ year, month }) => ensurePayrollRuns(year, month)),
        )
      ).flat()
    : await prisma.payrollRun.findMany({
        where:
          targetMonths.length === 1
            ? { year: targetMonths[0].year, month: targetMonths[0].month }
            : {
                OR: targetMonths.map(({ year, month }) => ({
                  year,
                  month,
                })),
              },
        orderBy: [{ year: 'asc' }, { month: 'asc' }, { sequence: 'asc' }],
      })

  const runMap = new Map<number, typeof runs[number]>()
  runs.forEach((run) => {
    runMap.set(run.id, run)
  })
  const uniqueRuns = Array.from(runMap.values())

  const runIds = uniqueRuns.map((run) => run.id)
  const payouts = runIds.length
    ? await prisma.userPayrollPayout.findMany({
        where: memberIds.length
          ? { runId: { in: runIds }, userId: { in: memberIds } }
          : { runId: { in: runIds } },
        orderBy: [{ runId: 'asc' }, { userId: 'asc' }],
      })
    : []

  const expatProfiles = await prisma.userExpatProfile.findMany({
    where: memberIds.length ? { userId: { in: memberIds } } : undefined,
    select: {
      userId: true,
      contractNumber: true,
      contractType: true,
      contractStartDate: true,
      contractEndDate: true,
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

  const hasContractOverlap = (
    changes: typeof contractChanges,
    profile: {
      contractStartDate: Date | null
      contractEndDate: Date | null
    },
    periodStart: Date,
    periodEnd: Date,
  ) => {
    const startTime = periodStart.getTime()
    const endTime = periodEnd.getTime()
    let hasAny = false

    const hasOverlap = (start: Date | null, end: Date | null) => {
      if (!start) return false
      hasAny = true
      const intervalStart = start.getTime()
      const intervalEnd = end ? end.getTime() : Number.POSITIVE_INFINITY
      return intervalStart <= endTime && intervalEnd >= startTime
    }

    for (const change of changes) {
      const start = change.startDate ?? change.changeDate
      const end = change.endDate ?? null
      if (hasOverlap(start, end)) return true
    }

    if (hasOverlap(profile.contractStartDate ?? null, profile.contractEndDate ?? null)) {
      return true
    }

    return hasAny ? false : true
  }

  const prevMonths = new Map<string, { year: number; month: number }>()
  targetMonths.forEach(({ year, month }) => {
    const prev = getPrevYearMonth(year, month)
    const key = formatMonthKey(prev.year, prev.month)
    if (!prevMonths.has(key)) prevMonths.set(key, prev)
  })
  const prevRunTwos = prevMonths.size
    ? await prisma.payrollRun.findMany({
        where: {
          sequence: 2,
          OR: Array.from(prevMonths.values()).map(({ year, month }) => ({
            year,
            month,
          })),
        },
        select: {
          year: true,
          month: true,
          attendanceCutoffDate: true,
        },
      })
    : []
  const prevRunTwoByKey = new Map<string, Date>()
  prevRunTwos.forEach((run) => {
    prevRunTwoByKey.set(formatMonthKey(run.year, run.month), run.attendanceCutoffDate)
  })

  const runsByMonth = new Map<string, { run1?: typeof uniqueRuns[number]; run2?: typeof uniqueRuns[number] }>()
  uniqueRuns.forEach((run) => {
    const key = formatMonthKey(run.year, run.month)
    const bucket = runsByMonth.get(key) ?? {}
    if (run.sequence === 1) bucket.run1 = run
    if (run.sequence === 2) bucket.run2 = run
    runsByMonth.set(key, bucket)
  })

  const runStartDates = new Map<number, Date | null>()
  const runOneStartDates = new Map<number, Date | null>()
  runsByMonth.forEach((bucket, key) => {
    const [yearText, monthText] = key.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const prev = getPrevYearMonth(year, month)
    const prevKey = formatMonthKey(prev.year, prev.month)
    const prevRunTwo = prevRunTwoByKey.get(prevKey) ?? null
    const runOneStartDate =
      bucket.run1 && prevRunTwo ? addUtcDays(prevRunTwo, 1) : null
    if (bucket.run1) {
      runStartDates.set(bucket.run1.id, runOneStartDate)
      runOneStartDates.set(bucket.run1.id, runOneStartDate)
    }
    if (bucket.run2) {
      const runTwoStart = bucket.run1
        ? addUtcDays(bucket.run1.attendanceCutoffDate, 1)
        : null
      runStartDates.set(bucket.run2.id, runTwoStart)
    }
  })

  const contractSnapshots = uniqueRuns.map((run) => {
    const contracts: Record<number, ContractSnapshot> = {}
    expatProfiles.forEach((profile) => {
      const changes = contractChangesByUser.get(profile.userId) ?? []
      const snapshot = resolveContractSnapshot(changes, run.attendanceCutoffDate)
      const contractNumber = snapshot?.contractNumber ?? profile.contractNumber ?? null
      const contractType = snapshot?.contractType ?? profile.contractType ?? null
      const ctjOverlap =
        run.sequence === 1 && runOneStartDates.get(run.id)
          ? hasCtjOverlap(
              changes,
              runOneStartDates.get(run.id) as Date,
              run.attendanceCutoffDate,
            )
          : false
      const periodStart = runStartDates.get(run.id) ?? null
      const contractOverlap = periodStart
        ? hasContractOverlap(changes, profile, periodStart, run.attendanceCutoffDate)
        : true
      contracts[profile.userId] = { contractNumber, contractType, ctjOverlap, contractOverlap }
    })
    return {
      runId: run.id,
      cutoffDate: run.attendanceCutoffDate.toISOString(),
      contracts,
    }
  })

  return NextResponse.json({
    ...(targetMonths.length === 1
      ? { year: targetMonths[0].year, month: targetMonths[0].month }
      : {}),
    months: targetMonths.map((item) => item.key),
    runs: uniqueRuns.map((run) => ({
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
