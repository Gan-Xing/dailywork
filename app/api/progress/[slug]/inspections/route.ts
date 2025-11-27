import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createInspection, listInspections } from '@/lib/server/inspectionStore'
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
  if (!hasPermission('inspection:create')) {
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

export async function GET(request: Request) {
  if (!hasPermission('inspection:view')) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const filter = {
    roadSlug: searchParams.get('roadSlug') ?? undefined,
    phaseId: searchParams.get('phaseId') ? Number(searchParams.get('phaseId')) : undefined,
    status: searchParams.getAll('status').filter(Boolean),
    side: (searchParams.get('side') as 'LEFT' | 'RIGHT' | 'BOTH' | null) ?? undefined,
    type: searchParams.get('type') ?? undefined,
    keyword: searchParams.get('keyword') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    sortField: (searchParams.get('sortField') as 'createdAt' | 'updatedAt' | null) ?? undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
  }

  try {
    const result = await listInspections(filter)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
