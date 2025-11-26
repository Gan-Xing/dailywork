import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { deletePhase, updatePhase } from '@/lib/server/progressStore'
import { getRoadBySlug } from '@/lib/server/roadStore'

interface RouteParams {
  params: {
    slug: string
    id: string
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const canEdit = hasPermission('progress:edit') || hasPermission('road:manage')
  if (!canEdit) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }

  const phaseId = Number(params.id)
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return NextResponse.json({ message: '无效的分项 ID' }, { status: 400 })
  }

  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  let payload: {
    phaseDefinitionId?: number
    name?: string
    measure?: string
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
    const phase = await updatePhase(road.id, phaseId, {
      phaseDefinitionId: payload.phaseDefinitionId,
      name: payload.name,
      measure: payload.measure as 'LINEAR' | 'POINT',
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  const canEdit = hasPermission('progress:edit') || hasPermission('road:manage')
  if (!canEdit) {
    return NextResponse.json({ message: '缺少编辑进度权限' }, { status: 403 })
  }

  const phaseId = Number(params.id)
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return NextResponse.json({ message: '无效的分项 ID' }, { status: 400 })
  }

  const road = await getRoadBySlug(params.slug)
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
