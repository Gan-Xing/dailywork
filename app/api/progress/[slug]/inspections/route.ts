import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createInspection } from '@/lib/server/inspectionStore'
import { prisma } from '@/lib/prisma'
import { getRoadBySlug } from '@/lib/server/roadStore'

interface RouteParams {
  params: {
    slug: string
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:create') && !hasPermission('road:manage')) {
    return NextResponse.json({ message: '缺少报检权限' }, { status: 403 })
  }

  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  let payload: {
    phaseId?: number
    side?: string
    startPk?: number
    endPk?: number
    layers?: string[]
    checks?: string[]
    types?: string[]
    remark?: string
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.phaseId || !payload.side || payload.startPk === undefined || payload.endPk === undefined) {
    return NextResponse.json({ message: '缺少必填字段：分项/侧别/起点/终点' }, { status: 400 })
  }

  const phase = await prisma.roadPhase.findFirst({
    where: { id: payload.phaseId, roadId: road.id },
  })
  if (!phase) {
    return NextResponse.json({ message: '分项不存在或不属于当前路段' }, { status: 404 })
  }

  try {
    const inspection = await createInspection(
      road.id,
      phase.id,
      {
        phaseId: phase.id,
        startPk: Number(payload.startPk),
        endPk: Number(payload.endPk),
        side: payload.side as 'LEFT' | 'RIGHT' | 'BOTH',
        layers: payload.layers ?? [],
        checks: payload.checks ?? [],
        types: payload.types ?? [],
        remark: payload.remark,
      },
      sessionUser.id,
    )
    return NextResponse.json({ inspection })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
