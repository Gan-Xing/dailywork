import { NextResponse } from 'next/server'

import { createRoadSection, listRoadSections } from '@/lib/server/roadStore'
import { hasPermission } from '@/lib/server/authSession'
import { isUniqueConstraintError } from '@/lib/server/roadStore'

export async function GET() {
  const [canView, canManage] = await Promise.all([
    hasPermission('road:view'),
    hasPermission('road:manage'),
  ])
  if (!canView && !canManage) {
    return NextResponse.json({ message: '缺少路段查看权限' }, { status: 403 })
  }
  const roads = await listRoadSections()
  return NextResponse.json({ roads })
}

export async function POST(request: Request) {
  if (!(await hasPermission('road:manage'))) {
    return NextResponse.json({ message: '缺少路段管理权限' }, { status: 403 })
  }

  let payload: { slug?: string; name?: string; startPk?: string; endPk?: string; projectId?: unknown }
  try {
    payload = (await request.json()) as {
      slug?: string
      name?: string
      startPk?: string
      endPk?: string
      projectId?: unknown
    }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload?.slug || !payload.name || !payload.startPk || !payload.endPk) {
    return NextResponse.json({ message: '缺少必填字段：路由、名称、起点、终点' }, { status: 400 })
  }

  const parsedProjectId =
    payload.projectId === null || payload.projectId === undefined || payload.projectId === ''
      ? null
      : Number(payload.projectId)
  if (parsedProjectId !== null && (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0)) {
    return NextResponse.json({ message: '项目编号无效' }, { status: 400 })
  }

  try {
    const road = await createRoadSection({
      slug: payload.slug,
      name: payload.name,
      startPk: payload.startPk,
      endPk: payload.endPk,
      projectId: parsedProjectId,
    })
    return NextResponse.json({ road })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ message: '路由已存在，请换一个' }, { status: 400 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
