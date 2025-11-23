import { NextResponse } from 'next/server'

import { createRoadSection, listRoadSections } from '@/lib/server/roadStore'

export async function GET() {
  const roads = await listRoadSections()
  return NextResponse.json({ roads })
}

export async function POST(request: Request) {
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
    const road = await createRoadSection({
      name: payload.name,
      startPk: payload.startPk,
      endPk: payload.endPk,
    })
    return NextResponse.json({ road })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
