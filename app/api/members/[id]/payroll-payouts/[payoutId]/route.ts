import { NextResponse } from 'next/server'

import {
  normalizeOptionalDecimal,
  normalizeOptionalText,
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; payoutId: string }> },
) {
  const { id, payoutId } = await params
  const userId = Number(id)
  const recordId = Number(payoutId)
  if (!userId || !recordId) {
    return NextResponse.json({ error: '缺少成员或记录 ID' }, { status: 400 })
  }
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const record = await prisma.userPayrollPayout.findUnique({
    where: { id: recordId },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '工资发放记录不存在' }, { status: 404 })
  }

  const expatProfile = await prisma.userExpatProfile.findUnique({
    where: { userId },
    select: {
      chineseSupervisorId: true,
      team: true,
    },
  })
  if (!expatProfile) {
    return NextResponse.json({ error: '缺少外籍扩展字段' }, { status: 400 })
  }

  const body = await request.json()
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

  const nextRunId = hasField('runId') ? Number(body.runId) || record.runId : record.runId
  const run = await prisma.payrollRun.findUnique({ where: { id: nextRunId } })
  if (!run) {
    return NextResponse.json({ error: '发放批次不存在' }, { status: 404 })
  }

  const payoutDate = run.payoutDate
  const amount = hasField('amount')
    ? normalizeOptionalDecimal(body.amount) ?? record.amount.toString()
    : record.amount.toString()
  const team = hasField('team')
    ? normalizeOptionalText(body.team)
    : record.team ?? expatProfile.team
  const currency = hasField('currency')
    ? normalizeOptionalText(body.currency) ?? record.currency
    : record.currency
  const note = hasField('note') ? normalizeOptionalText(body.note) : record.note
  const nextSupervisorId = team
    ? await resolveTeamSupervisorId(team)
    : record.chineseSupervisorId ?? expatProfile.chineseSupervisorId ?? null
  if (team && !nextSupervisorId) {
    return NextResponse.json({ error: '班组未绑定中方负责人' }, { status: 400 })
  }

  const supervisorSnapshot = await resolveSupervisorSnapshot(nextSupervisorId)

  const updated = await prisma.userPayrollPayout.update({
    where: { id: recordId },
    data: {
      runId: run.id,
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
      id: updated.id,
      userId: updated.userId,
      runId: updated.runId,
      team: updated.team,
      chineseSupervisorId: updated.chineseSupervisorId,
      chineseSupervisorName: updated.chineseSupervisorName,
      payoutDate: updated.payoutDate.toISOString(),
      amount: updated.amount.toString(),
      currency: updated.currency,
      note: updated.note,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; payoutId: string }> },
) {
  const { id, payoutId } = await params
  const userId = Number(id)
  const recordId = Number(payoutId)
  if (!userId || !recordId) {
    return NextResponse.json({ error: '缺少成员或记录 ID' }, { status: 400 })
  }
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const record = await prisma.userPayrollPayout.findUnique({
    where: { id: recordId },
    select: { userId: true },
  })
  if (!record || record.userId !== userId) {
    return NextResponse.json({ error: '工资发放记录不存在' }, { status: 404 })
  }

  await prisma.userPayrollPayout.delete({ where: { id: recordId } })
  return NextResponse.json({ ok: true })
}
