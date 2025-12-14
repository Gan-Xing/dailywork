import { NextResponse, type NextRequest } from 'next/server'

import {
  deleteRoadSection,
  isRecordNotFound,
  isUniqueConstraintError,
  updateRoadSection,
} from '@/lib/server/roadStore'
import { hasPermission } from '@/lib/server/authSession'

const invalidIdResponse = NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return invalidIdResponse
  }

  let payload: { slug?: string; name?: string; startPk?: string; endPk?: string }
  try {
    payload = (await request.json()) as {
      slug?: string
      name?: string
      startPk?: string
      endPk?: string
    }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload?.slug || !payload.name || !payload.startPk || !payload.endPk) {
    return NextResponse.json({ message: '缺少必填字段：路由、名称、起点、终点' }, { status: 400 })
  }

  try {
    const road = await updateRoadSection(id, {
      slug: payload.slug,
      name: payload.name,
      startPk: payload.startPk,
      endPk: payload.endPk,
    })
    return NextResponse.json({ road })
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ message: '路段不存在' }, { status: 404 })
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ message: '路由已存在，请换一个' }, { status: 400 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return invalidIdResponse
  }

  try {
    await deleteRoadSection(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ message: '路段不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
