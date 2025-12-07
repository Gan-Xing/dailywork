import { NextResponse } from 'next/server'

import type { InspectionPayload } from '@/lib/progressTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { deleteInspection, updateInspection } from '@/lib/server/inspectionStore'

interface RouteParams {
  params: { id: string }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再编辑报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检编辑权限' }, { status: 403 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  }

  let payload: InspectionPayload
  try {
    payload = (await request.json()) as InspectionPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.phaseId || payload.startPk === undefined || payload.endPk === undefined || !payload.side) {
    return NextResponse.json({ message: '缺少必填字段：分项/侧别/起止里程' }, { status: 400 })
  }

  try {
    const submissionOrder =
      payload.submissionOrder === null || payload.submissionOrder === undefined
        ? undefined
        : Number(payload.submissionOrder)
    const status =
      payload.status && ['PENDING', 'SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED'].includes(payload.status)
        ? (payload.status as InspectionPayload['status'])
        : undefined
    const inspection = await updateInspection(
      id,
      {
        phaseId: payload.phaseId,
        side: payload.side,
        startPk: Number(payload.startPk),
        endPk: Number(payload.endPk),
        layers: payload.layers ?? [],
        checks: payload.checks ?? [],
        types: payload.types ?? [],
        status,
        submissionOrder,
        remark: payload.remark,
        appointmentDate: payload.appointmentDate,
      },
      sessionUser.id,
    )
    return NextResponse.json({ inspection })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再删除报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检删除权限' }, { status: 403 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  }

  try {
    await deleteInspection(id)
    return NextResponse.json({ message: '报检已删除' })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
