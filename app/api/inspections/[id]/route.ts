import { NextResponse } from 'next/server'

import type { InspectionPayload } from '@/lib/progressTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import { prisma } from '@/lib/prisma'

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

  const layers = canonicalizeProgressList('layer', payload.layers ?? [])
  const checks = canonicalizeProgressList('check', payload.checks ?? [])
  const types = canonicalizeProgressList('type', payload.types ?? [])

  if (!layers.length || !checks.length || !types.length) {
    return NextResponse.json({ message: '层次/验收内容/验收类型均不能为空' }, { status: 400 })
  }

  try {
    // 旧接口：找到该 entry，按旧 payload 把同区间同 submission 的 entries 覆盖重建
    const existing = await prisma.inspectionEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: '报检记录不存在或已删除' }, { status: 404 })

    await prisma.inspectionEntry.deleteMany({
      where: {
        submissionId: existing.submissionId,
        roadId: existing.roadId,
        phaseId: existing.phaseId,
        side: existing.side,
        startPk: existing.startPk,
        endPk: existing.endPk,
      },
    })

    const created = await prisma.$transaction(
      layers.flatMap((layer) =>
        checks.map((check) =>
          prisma.inspectionEntry.create({
            data: {
              submissionId: existing.submissionId,
              roadId: existing.roadId,
              phaseId: payload.phaseId,
              side: payload.side as any,
              startPk: Number(payload.startPk),
              endPk: Number(payload.endPk),
              layerName: layer,
              checkName: check,
              types,
              status: payload.status as any,
              submissionOrder:
                payload.submissionOrder === null || payload.submissionOrder === undefined
                  ? undefined
                  : Number(payload.submissionOrder),
              remark: payload.remark,
              appointmentDate: payload.appointmentDate ? new Date(payload.appointmentDate) : undefined,
              submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : undefined,
              updatedBy: sessionUser.id,
            },
            include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
          }),
        ),
      ),
    )

    const first = created[0]
    const inspectionLike = {
      id: first.id,
      roadId: first.roadId,
      roadName: first.road.name,
      roadSlug: first.road.slug,
      phaseId: first.phaseId,
      phaseName: first.phase.name,
      submissionId: first.submissionId,
      submissionCode: first.submission?.code ?? null,
      side: first.side,
      startPk: first.startPk,
      endPk: first.endPk,
      layers,
      checks,
      types,
      submissionOrder: first.submissionOrder ?? undefined,
      status: first.status,
      remark: first.remark ?? undefined,
      appointmentDate: first.appointmentDate?.toISOString(),
      submittedAt: first.submittedAt.toISOString(),
      submittedBy: first.submitter ? { id: first.submitter.id, username: first.submitter.username } : null,
      createdBy: first.creator ? { id: first.creator.id, username: first.creator.username } : null,
      createdAt: first.createdAt.toISOString(),
      updatedAt: first.updatedAt.toISOString(),
      updatedBy: first.updater ? { id: first.updater.id, username: first.updater.username } : null,
    }

    return NextResponse.json({ inspection: inspectionLike })
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
