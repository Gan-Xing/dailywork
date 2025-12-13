import { NextResponse } from 'next/server'

import type { InspectionEntryPayload } from '@/lib/progressTypes'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: Request, { params }: RouteParams) {
  if (!hasPermission('inspection:view')) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  const row = await prisma.inspectionEntry.findUnique({
    where: { id },
    include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
  })
  if (!row) return NextResponse.json({ message: '报检记录不存在或已删除' }, { status: 404 })
  return NextResponse.json({ entry: row })
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

  let payload: InspectionEntryPayload
  try {
    payload = (await request.json()) as InspectionEntryPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const layerName = canonicalizeProgressList('layer', [payload.layerName ?? '']).at(0)
  const checkName = canonicalizeProgressList('check', [payload.checkName ?? '']).at(0)
  const types = canonicalizeProgressList('type', payload.types ?? [])
  if (!layerName || !checkName || !types.length) {
    return NextResponse.json({ message: '层次/验收内容/验收类型均不能为空' }, { status: 400 })
  }

  try {
    const updated = await prisma.inspectionEntry.update({
      where: { id },
      data: {
        submissionId: payload.submissionId ?? undefined,
        roadId: payload.roadId,
        phaseId: payload.phaseId,
        side: payload.side,
        startPk: Number(payload.startPk),
        endPk: Number(payload.endPk),
        layerId: payload.layerId ?? undefined,
        layerName,
        checkId: payload.checkId ?? undefined,
        checkName,
        types,
        status: payload.status as any,
        appointmentDate: payload.appointmentDate ? new Date(payload.appointmentDate) : undefined,
        remark: payload.remark,
        submissionOrder:
          payload.submissionOrder === null || payload.submissionOrder === undefined
            ? undefined
            : Number(payload.submissionOrder),
        submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : undefined,
        updatedBy: sessionUser.id,
      },
      include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
    })
    return NextResponse.json({ entry: updated })
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
    await prisma.inspectionEntry.delete({ where: { id } })
    return NextResponse.json({ message: '报检已删除' })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
