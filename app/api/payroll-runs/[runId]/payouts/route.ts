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
          contractType: true,
        },
      },
    },
  })
  const userMap = new Map(users.map((user) => [user.id, user]))

  const invalidUsers: number[] = []
  const invalidCdd: number[] = []
  const invalidJoinDates: number[] = []
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

    if (run.sequence === 1 && user.expatProfile.contractType === 'CDD') {
      const canRunOneCdd =
        Boolean(user.terminationDate) &&
        !isDateAfterCutoff(user.terminationDate, run.attendanceCutoffDate)
      if (!canRunOneCdd) {
        invalidCdd.push(userId)
        continue
      }
    }

    if (isDateAfterCutoff(user.joinDate, run.attendanceCutoffDate)) {
      invalidJoinDates.push(userId)
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
  if (invalidJoinDates.length > 0) {
    return NextResponse.json(
      { error: `入职日期晚于考勤截止日期，无法录入本次发放: ${invalidJoinDates.join(', ')}` },
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
