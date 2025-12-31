import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  normalizeOptionalDecimal,
  normalizeOptionalText,
  resolveSupervisorSnapshot,
} from '@/lib/server/compensation'
import { canManagePayroll } from '@/lib/server/payrollRuns'

const toDateKey = (value: Date) =>
  Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())

const isDateAfterCutoff = (date: Date | null, cutoffDate: Date | null) => {
  if (!date || !cutoffDate) return false
  return toDateKey(date) > toDateKey(cutoffDate)
}

const resolveEarliestContractStart = (
  changes: Array<{
    startDate: Date | null
    changeDate: Date
  }>,
  profile?: { contractStartDate?: Date | null } | null,
) => {
  let earliest: Date | null = null
  for (const change of changes) {
    const start = change.startDate ?? change.changeDate
    if (!start) continue
    if (!earliest || start.getTime() < earliest.getTime()) earliest = start
  }
  const profileStart = profile?.contractStartDate ?? null
  if (profileStart) {
    if (!earliest) {
      earliest = profileStart
    } else if (profileStart.getTime() < earliest.getTime()) {
      earliest = profileStart
    }
  }
  return earliest
}

const resolveEffectiveJoinDate = (
  joinDate: Date | null,
  earliestContractStart: Date | null,
) => {
  if (!earliestContractStart) return joinDate
  if (!joinDate) return earliestContractStart
  return joinDate.getTime() > earliestContractStart.getTime() ? earliestContractStart : joinDate
}

const hasActiveContractAtCutoff = (
  changes: Array<{
    startDate: Date | null
    endDate: Date | null
    changeDate: Date
  }>,
  cutoffDate: Date,
) => {
  const cutoffTime = cutoffDate.getTime()
  return changes.some((change) => {
    const start = change.startDate ?? change.changeDate
    if (!start) return false
    const end = change.endDate ?? null
    const startTime = start.getTime()
    const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY
    return startTime <= cutoffTime && endTime >= cutoffTime
  })
}

const hasActiveProfileContractAtCutoff = (
  profile: { contractStartDate?: Date | null; contractEndDate?: Date | null } | null | undefined,
  cutoffDate: Date,
) => {
  if (!profile?.contractStartDate) return false
  const startTime = profile.contractStartDate.getTime()
  const endTime = profile.contractEndDate ? profile.contractEndDate.getTime() : Number.POSITIVE_INFINITY
  const cutoffTime = cutoffDate.getTime()
  return startTime <= cutoffTime && endTime >= cutoffTime
}

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

type PayrollPayoutInput = {
  userId: number
  amount?: string | number | null
  currency?: string | null
  note?: string | null
  team?: string | null
  chineseSupervisorId?: number | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await canManagePayroll())) {
    return NextResponse.json({ error: '缺少工资发放管理权限' }, { status: 403 })
  }

  const { runId } = await params
  const id = Number(runId)
  if (!id) {
    return NextResponse.json({ error: '缺少发放批次 ID' }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({ where: { id } })
  if (!run) {
    return NextResponse.json({ error: '发放批次不存在' }, { status: 404 })
  }

  const body = await request.json()
  const items = Array.isArray(body?.items) ? (body.items as PayrollPayoutInput[]) : []
  if (items.length === 0) {
    return NextResponse.json({ error: '缺少发放明细' }, { status: 400 })
  }

  const userIds = Array.from(new Set(items.map((item) => Number(item.userId)).filter(Boolean)))
  if (userIds.length === 0) {
    return NextResponse.json({ error: '缺少成员' }, { status: 400 })
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      joinDate: true,
      terminationDate: true,
      nationality: true,
      expatProfile: {
        select: {
          team: true,
          chineseSupervisorId: true,
          contractNumber: true,
          contractType: true,
          contractStartDate: true,
          contractEndDate: true,
        },
      },
    },
  })
  const userMap = new Map(users.map((user) => [user.id, user]))
  const contractChanges = await prisma.userContractChange.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      contractNumber: true,
      contractType: true,
      startDate: true,
      endDate: true,
      changeDate: true,
    },
  })
  const contractChangesByUser = new Map<number, typeof contractChanges>()
  contractChanges.forEach((change) => {
    const list = contractChangesByUser.get(change.userId) ?? []
    list.push(change)
    contractChangesByUser.set(change.userId, list)
  })
  const resolveContractSnapshot = (
    changes: typeof contractChanges,
    cutoffDate: Date,
    fallback: { contractType: string | null; contractNumber: string | null },
  ): { contractType: string | null; contractNumber: string | null } => {
    if (changes.length === 0) return fallback
    const cutoffTime = cutoffDate.getTime()
    const byPeriod = changes
      .filter((change) => change.startDate && change.startDate.getTime() <= cutoffTime)
      .filter((change) => !change.endDate || change.endDate.getTime() >= cutoffTime)
      .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))
    const match = byPeriod[0]
    if (match?.contractType || match?.contractNumber) {
      return {
        contractType: match?.contractType ?? fallback.contractType,
        contractNumber: match?.contractNumber ?? fallback.contractNumber,
      }
    }
    const byChangeDate = changes
      .filter((change) => change.changeDate.getTime() <= cutoffTime)
      .sort((a, b) => b.changeDate.getTime() - a.changeDate.getTime())
    const fallbackChange = byChangeDate[0]
    return {
      contractType: fallbackChange?.contractType ?? fallback.contractType,
      contractNumber: fallbackChange?.contractNumber ?? fallback.contractNumber,
    }
  }
  const contractSnapshotByUserId = new Map<
    number,
    { contractType: string | null; contractNumber: string | null }
  >()
  users.forEach((user) => {
    const changes = contractChangesByUser.get(user.id) ?? []
    const fallbackSnapshot = {
      contractType: user.expatProfile?.contractType ?? null,
      contractNumber: user.expatProfile?.contractNumber ?? null,
    }
    contractSnapshotByUserId.set(
      user.id,
      resolveContractSnapshot(changes, run.attendanceCutoffDate, fallbackSnapshot),
    )
  })

  let runStartDate: Date | null = null
  if (run.sequence === 1) {
    const prevMonth = run.month === 1 ? 12 : run.month - 1
    const prevYear = run.month === 1 ? run.year - 1 : run.year
    const prevRun = await prisma.payrollRun.findFirst({
      where: { year: prevYear, month: prevMonth, sequence: 2 },
      select: { attendanceCutoffDate: true },
    })
    if (prevRun?.attendanceCutoffDate) {
      runStartDate = addUtcDays(prevRun.attendanceCutoffDate, 1)
    }
  }

  const hasCtjOverlap = (userId: number) => {
    if (!runStartDate) return false
    const changes = contractChangesByUser.get(userId) ?? []
    const periodStart = runStartDate.getTime()
    const periodEnd = run.attendanceCutoffDate.getTime()
    return changes.some((change) => {
      if (change.contractType !== 'CTJ') return false
      const start = change.startDate ?? change.changeDate
      const end = change.endDate ?? null
      if (!start) return false
      const startTime = start.getTime()
      const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY
      return startTime <= periodEnd && endTime >= periodStart
    })
  }

  const invalidUsers: number[] = []
  const invalidCdd: string[] = []
  const invalidContractPeriods: string[] = []
  const invalidJoinDates: string[] = []
  const payloads: Array<{
    userId: number
    amount: string
    currency: string
    note: string | null
    team: string | null
    chineseSupervisorId: number | null
  }> = []
  const deleteUserIds: number[] = []
  const supervisorCache = new Map<number | null, { id: number | null; name: string | null }>()

  for (const item of items) {
    const userId = Number(item.userId)
    const user = userMap.get(userId)
    if (!user || user.nationality === 'china' || !user.expatProfile) {
      invalidUsers.push(userId)
      continue
    }

    const amount = normalizeOptionalDecimal(item.amount)
    if (!amount) {
      deleteUserIds.push(userId)
      continue
    }

    const contractSnapshot = contractSnapshotByUserId.get(userId)
    const resolvedContractType =
      contractSnapshot?.contractType ?? user.expatProfile.contractType ?? null
    const resolvedContractNumber =
      contractSnapshot?.contractNumber ?? user.expatProfile.contractNumber ?? null
    if (run.sequence === 1 && resolvedContractType === 'CDD') {
      const canRunOneCdd =
        Boolean(user.terminationDate) &&
        !isDateAfterCutoff(user.terminationDate, run.attendanceCutoffDate)
      if (!canRunOneCdd && !hasCtjOverlap(userId)) {
        invalidCdd.push(resolvedContractNumber || '未填写合同编号')
        continue
      }
    }

    const changes = contractChangesByUser.get(userId) ?? []
    const earliestContractStart = resolveEarliestContractStart(
      changes,
      user.expatProfile ?? null,
    )
    const effectiveJoinDate = resolveEffectiveJoinDate(user.joinDate, earliestContractStart)
    if (changes.length > 0) {
      if (!hasActiveContractAtCutoff(changes, run.attendanceCutoffDate)) {
        invalidContractPeriods.push(resolvedContractNumber || '未填写合同编号')
        continue
      }
    } else if (hasActiveProfileContractAtCutoff(user.expatProfile, run.attendanceCutoffDate)) {
      // covered by current profile contract period
    } else if (isDateAfterCutoff(effectiveJoinDate, run.attendanceCutoffDate)) {
      invalidJoinDates.push(resolvedContractNumber || '未填写合同编号')
      continue
    }

    const team = normalizeOptionalText(item.team) ?? user.expatProfile.team ?? null
    const currency = normalizeOptionalText(item.currency) ?? 'XOF'
    const note = normalizeOptionalText(item.note)
    const nextSupervisorId =
      typeof item.chineseSupervisorId === 'number'
        ? item.chineseSupervisorId || null
        : user.expatProfile.chineseSupervisorId ?? null

    let supervisorSnapshot = supervisorCache.get(nextSupervisorId ?? null)
    if (!supervisorSnapshot) {
      supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)
      supervisorCache.set(nextSupervisorId ?? null, supervisorSnapshot)
    }

    payloads.push({
      userId,
      amount,
      currency,
      note,
      team,
      chineseSupervisorId: supervisorSnapshot.id,
    })
  }

  if (invalidUsers.length > 0) {
    return NextResponse.json({ error: `存在无效成员: ${invalidUsers.join(', ')}` }, { status: 400 })
  }
  if (invalidCdd.length > 0) {
    return NextResponse.json(
      { error: `CDD 成员仅在当月第一次考勤截止前离职时可录入第 1 次发放: ${invalidCdd.join(', ')}` },
      { status: 400 },
    )
  }
  if (invalidContractPeriods.length > 0) {
    return NextResponse.json(
      {
        error: `合同不在考勤周期内，无法录入本次发放: ${invalidContractPeriods.join(', ')}`,
      },
      { status: 400 },
    )
  }
  if (invalidJoinDates.length > 0) {
    return NextResponse.json(
      {
        error: `入职日期晚于考勤截止日期，无法录入本次发放: ${invalidJoinDates.join(', ')}`,
      },
      { status: 400 },
    )
  }

  const operations: Prisma.PrismaPromise<unknown>[] = payloads.map((payload) =>
    prisma.userPayrollPayout.upsert({
      where: {
        runId_userId: {
          runId: id,
          userId: payload.userId,
        },
      },
      create: {
        runId: id,
        userId: payload.userId,
        team: payload.team,
        chineseSupervisorId: payload.chineseSupervisorId,
        chineseSupervisorName: supervisorCache.get(payload.chineseSupervisorId ?? null)?.name ?? null,
        payoutDate: run.payoutDate,
        amount: payload.amount,
        currency: payload.currency,
        note: payload.note,
      },
      update: {
        team: payload.team,
        chineseSupervisorId: payload.chineseSupervisorId,
        chineseSupervisorName: supervisorCache.get(payload.chineseSupervisorId ?? null)?.name ?? null,
        payoutDate: run.payoutDate,
        amount: payload.amount,
        currency: payload.currency,
        note: payload.note,
      },
    }),
  )

  if (deleteUserIds.length > 0) {
    operations.push(
      prisma.userPayrollPayout.deleteMany({
        where: {
          runId: id,
          userId: { in: deleteUserIds },
        },
      }),
    )
  }

  await prisma.$transaction(operations)

  return NextResponse.json({
    ok: true,
    updated: payloads.length,
    removed: deleteUserIds.length,
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await canManagePayroll())) {
    return NextResponse.json({ error: '缺少工资发放管理权限' }, { status: 403 })
  }

  const { runId } = await params
  const id = Number(runId)
  if (!id) {
    return NextResponse.json({ error: '缺少发放批次 ID' }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({ where: { id } })
  if (!run) {
    return NextResponse.json({ error: '发放批次不存在' }, { status: 404 })
  }

  const result = await prisma.userPayrollPayout.deleteMany({ where: { runId: id } })

  return NextResponse.json({ ok: true, removed: result.count })
}
