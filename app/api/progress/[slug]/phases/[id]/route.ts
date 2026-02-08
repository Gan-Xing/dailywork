import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { deletePhase, updatePhase } from '@/lib/server/progressStore'
import { getRoadBySlug, listRoadSections } from '@/lib/server/roadStore'
import { LEVEL_CROSSING_ROAD_SLUG } from '@/lib/roadConstants'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id: idParam } = await params
  if (!(await hasPermission('progress:edit'))) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }

  const phaseId = Number(idParam)
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return NextResponse.json({ message: '无效的分项 ID' }, { status: 400 })
  }

  const road = await getRoadBySlug(slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }
  const isLevelCrossing = road.slug === LEVEL_CROSSING_ROAD_SLUG

  let payload: {
    phaseDefinitionId?: number
    name?: string
    measure?: string
    pointHasSides?: boolean
    intervals?: {
      startPk?: number
      endPk?: number
      side?: string
      spec?: string
      locationRoadId?: number
      billQuantity?: number
      layers?: string[]
    }[]
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

  let locationRoadMap: Map<number, { id: number; slug: string }> | null = null
  if (isLevelCrossing) {
    const roads = await listRoadSections()
    locationRoadMap = new Map(roads.map((item) => [item.id, { id: item.id, slug: item.slug }]))
  }

  try {
    const phase = await updatePhase(road.id, phaseId, {
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
          spec: typeof i.spec === 'string' ? i.spec : undefined,
          locationRoadId: (() => {
            const parsed = Number(i.locationRoadId)
            const locationRoadId = Number.isFinite(parsed) && parsed > 0 ? parsed : null
            if (!isLevelCrossing) {
              return road.id
            }
            if (!locationRoadId) {
              throw new Error('平交路口区间必须选择所属主路段')
            }
            if (locationRoadId === road.id) {
              throw new Error('所属主路段不能选择平交路口自身')
            }
            if (locationRoadMap && !locationRoadMap.has(locationRoadId)) {
              throw new Error('所属主路段不存在')
            }
            return locationRoadId
          })(),
          layers: Array.isArray(i.layers) ? i.layers.filter(Boolean) : undefined,
          billQuantity:
            i.billQuantity === null || i.billQuantity === undefined || !Number.isFinite(Number(i.billQuantity))
              ? undefined
              : Number(i.billQuantity),
        })) ?? [],
    })
    return NextResponse.json({ phase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id: idParam } = await params
  if (!(await hasPermission('progress:edit'))) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }

  const phaseId = Number(idParam)
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return NextResponse.json({ message: '无效的分项 ID' }, { status: 400 })
  }

  const road = await getRoadBySlug(slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  try {
    await deletePhase(road.id, phaseId)
    return NextResponse.json({ phaseId })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
