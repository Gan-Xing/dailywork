import { NextResponse, type NextRequest } from 'next/server'

import type { RoadCrossSectionPayload } from '@/lib/progressTypes'
import { hasPermission } from '@/lib/server/authSession'
import {
  deleteRoadCrossSection,
  isRoadCrossSectionRecordNotFound,
  updateRoadCrossSection,
} from '@/lib/server/roadCrossSectionStore'

const parsePositiveId = (value: string) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

type RouteContext = {
  params: Promise<{
    id: string
    crossSectionId: string
  }>
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id: roadIdParam, crossSectionId: crossSectionIdParam } = await params
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }

  const roadId = parsePositiveId(roadIdParam)
  const crossSectionId = parsePositiveId(crossSectionIdParam)
  if (!roadId) {
    return NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })
  }
  if (!crossSectionId) {
    return NextResponse.json({ message: '无效的横断面记录 ID' }, { status: 400 })
  }

  let payload: RoadCrossSectionPayload
  try {
    payload = (await request.json()) as RoadCrossSectionPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const crossSection = await updateRoadCrossSection(roadId, crossSectionId, payload)
    return NextResponse.json({ crossSection })
  } catch (error) {
    if (isRoadCrossSectionRecordNotFound(error)) {
      return NextResponse.json({ message: '路段或横断面记录不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id: roadIdParam, crossSectionId: crossSectionIdParam } = await params
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }

  const roadId = parsePositiveId(roadIdParam)
  const crossSectionId = parsePositiveId(crossSectionIdParam)
  if (!roadId) {
    return NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })
  }
  if (!crossSectionId) {
    return NextResponse.json({ message: '无效的横断面记录 ID' }, { status: 400 })
  }

  try {
    await deleteRoadCrossSection(roadId, crossSectionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isRoadCrossSectionRecordNotFound(error)) {
      return NextResponse.json({ message: '路段或横断面记录不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
