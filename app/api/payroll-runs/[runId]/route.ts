import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { normalizeOptionalDate, normalizeOptionalText } from '@/lib/server/compensation'
import { canManagePayroll, canViewPayroll } from '@/lib/server/payrollRuns'

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!(await canViewPayroll())) {
    return NextResponse.json({ error: '缺少工资发放查看权限' }, { status: 403 })
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

  return NextResponse.json({
    run: {
      id: run.id,
      year: run.year,
      month: run.month,
      sequence: run.sequence,
      payoutDate: run.payoutDate.toISOString(),
      note: run.note,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    },
  })
}

export async function PUT(
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
  const payoutDate = normalizeOptionalDate(body.payoutDate)
  const note = normalizeOptionalText(body.note)

  if (!payoutDate && note === null) {
    return NextResponse.json({ error: '缺少可更新字段' }, { status: 400 })
  }

  const updatePayload: { payoutDate?: Date; note?: string | null } = {}
  if (payoutDate) updatePayload.payoutDate = payoutDate
  if (note !== null) updatePayload.note = note

  const [updated] = await prisma.$transaction([
    prisma.payrollRun.update({
      where: { id },
      data: updatePayload,
    }),
    ...(payoutDate
      ? [
          prisma.userPayrollPayout.updateMany({
            where: { runId: id },
            data: { payoutDate },
          }),
        ]
      : []),
  ])

  return NextResponse.json({
    run: {
      id: updated.id,
      year: updated.year,
      month: updated.month,
      sequence: updated.sequence,
      payoutDate: updated.payoutDate.toISOString(),
      note: updated.note,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}
