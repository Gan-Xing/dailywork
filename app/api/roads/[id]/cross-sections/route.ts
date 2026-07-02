import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import {
  createRoadCrossSection,
  isRoadCrossSectionRecordNotFound,
  listRoadCrossSections,
} from '@/lib/server/roadCrossSectionStore'
import type { RoadCrossSectionPayload } from '@/lib/progressTypes'

const parseRoadId = (value: string) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const canViewRoadCrossSections = async () =>
  (await hasPermission('progress:view')) ||
  (await hasPermission('road:manage')) ||
  (await hasPermission('value:view'))

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await canViewRoadCrossSections())) {
    return NextResponse.json({ message: '缺少道路进度查看权限' }, { status: 403 })
  }

  const roadId = parseRoadId(idParam)
  if (!roadId) {
    return NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })
  }

  try {
    const crossSections = await listRoadCrossSections(roadId)
    return NextResponse.json({ crossSections })
  } catch (error) {
    if (isRoadCrossSectionRecordNotFound(error)) {
      return NextResponse.json({ message: '路段不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }

  const roadId = parseRoadId(idParam)
  if (!roadId) {
    return NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })
  }

  let payload: RoadCrossSectionPayload
  try {
    payload = (await request.json()) as RoadCrossSectionPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const crossSection = await createRoadCrossSection(roadId, payload)
    return NextResponse.json({ crossSection }, { status: 201 })
  } catch (error) {
    if (isRoadCrossSectionRecordNotFound(error)) {
      return NextResponse.json({ message: '路段不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
