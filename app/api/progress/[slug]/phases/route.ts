import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { createPhase, listPhases } from '@/lib/server/progressStore'
import { getRoadBySlug } from '@/lib/server/roadStore'

interface RouteParams {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }
  const phases = await listPhases(road.id)
  return NextResponse.json({ road, phases })
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!hasPermission('road:manage')) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }
  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  let payload: { name?: string; measure?: string; intervals?: { startPk?: number; endPk?: number; side?: string }[] }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.name || !payload.measure || !payload.intervals) {
    return NextResponse.json({ message: '缺少必填字段：名称/显示方式/区间' }, { status: 400 })
  }

  try {
    const phase = await createPhase(road.id, {
      name: payload.name,
      measure: payload.measure as 'LINEAR',
      intervals:
        payload.intervals?.map((i) => ({
          startPk: Number(i.startPk ?? 0),
          endPk: Number(i.endPk ?? 0),
          side:
            i.side === 'LEFT' || i.side === 'RIGHT' || i.side === 'BOTH'
              ? i.side
              : 'BOTH',
        })) ?? [],
    })
    return NextResponse.json({ phase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
