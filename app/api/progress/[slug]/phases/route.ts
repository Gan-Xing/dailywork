import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import {
  createPhase,
  listCheckDefinitions,
  listLayerDefinitions,
  listPhaseDefinitions,
  listPhases,
} from '@/lib/server/progressStore'
import { getRoadBySlug } from '@/lib/server/roadStore'

interface RouteParams {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  if (!hasPermission('progress:view')) {
    return NextResponse.json({ message: '缺少进度查看权限' }, { status: 403 })
  }
  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }
  const phases = await listPhases(road.id)
  const [definitions, layerOptions, checkOptions] = await Promise.all([
    listPhaseDefinitions(),
    listLayerDefinitions(),
    listCheckDefinitions(),
  ])
  return NextResponse.json({ road, phases, definitions, layerOptions, checkOptions })
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!hasPermission('progress:edit')) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }
  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  let payload: {
    phaseDefinitionId?: number
    name?: string
    measure?: string
    pointHasSides?: boolean
    intervals?: { startPk?: number; endPk?: number; side?: string }[]
    layerIds?: number[]
    checkIds?: number[]
    newLayers?: string[]
    newChecks?: string[]
  }
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
      phaseDefinitionId: payload.phaseDefinitionId,
      name: payload.name,
      measure: payload.measure as 'LINEAR' | 'POINT',
      pointHasSides: payload.pointHasSides ?? false,
      layerIds: payload.layerIds ?? [],
      checkIds: payload.checkIds ?? [],
      newLayers: payload.newLayers ?? [],
      newChecks: payload.newChecks ?? [],
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
