import { NextResponse } from 'next/server'

import {
  normalizeOptionalDecimal,
  normalizeOptionalText,
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
        },
      },
    },
  })
  if (!user) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  }
  if (user.nationality === 'china') {
    return NextResponse.json({ error: '中方成员无需工资发放记录' }, { status: 400 })
  }
  const expatProfile = user.expatProfile
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const runId = Number(body.runId)
  if (!runId) {
    return NextResponse.json({ error: '缺少发放批次' }, { status: 400 })
  }
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
  if (!run) {
    return NextResponse.json({ error: '发放批次不存在' }, { status: 404 })
  }

  const payoutDate = run.payoutDate
  const amount = normalizeOptionalDecimal(body.amount)
  if (!payoutDate || !amount) {
    return NextResponse.json({ error: '缺少发放日期或金额' }, { status: 400 })
  }

  const team = hasField('team') ? normalizeOptionalText(body.team) : expatProfile.team
  const currency = normalizeOptionalText(body.currency) ?? 'XOF'
  const note = normalizeOptionalText(body.note)
  const nextSupervisorId = hasField('chineseSupervisorId')
    ? Number(body.chineseSupervisorId) || null
    : expatProfile.chineseSupervisorId ?? null

  const supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)

  const result = await prisma.userPayrollPayout.create({
    data: {
      userId,
      runId,
      team,
      chineseSupervisorId: supervisorSnapshot.id,
      chineseSupervisorName: supervisorSnapshot.name,
      payoutDate,
      amount,
      currency,
      note,
    },
  })

  return NextResponse.json({
    payrollPayout: {
      id: result.id,
      userId: result.userId,
      runId: result.runId,
      team: result.team,
      chineseSupervisorId: result.chineseSupervisorId,
      chineseSupervisorName: result.chineseSupervisorName,
      payoutDate: result.payoutDate.toISOString(),
      amount: result.amount.toString(),
      currency: result.currency,
      note: result.note,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    },
  })
}
