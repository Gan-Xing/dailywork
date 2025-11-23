import { NextResponse } from 'next/server'

import { deleteRoadSection, isRecordNotFound, updateRoadSection } from '@/lib/server/roadStore'

interface RouteParams {
  params: {
    id: string
  }
}

const invalidIdResponse = NextResponse.json({ message: '无效的路段 ID' }, { status: 400 })

export async function PUT(request: Request, { params }: RouteParams) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return invalidIdResponse
  }

  let payload: { name?: string; startPk?: string; endPk?: string }
  try {
    payload = (await request.json()) as { name?: string; startPk?: string; endPk?: string }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload?.name || !payload.startPk || !payload.endPk) {
    return NextResponse.json({ message: '缺少必填字段：名称、起点、终点' }, { status: 400 })
  }

  try {
    const road = await updateRoadSection(id, {
      name: payload.name,
      startPk: payload.startPk,
      endPk: payload.endPk,
    })
    return NextResponse.json({ road })
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ message: '路段不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = Number(params.id)
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
