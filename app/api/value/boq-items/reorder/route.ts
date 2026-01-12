import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function POST(request: Request) {
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return respond('请求体格式无效', 400)
  }

  if (!payload || typeof payload !== 'object') {
    return respond('请求体必须是对象', 400)
  }

  const parsed = payload as { projectId?: unknown }
  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  try {
    const items = await prisma.boqItem.findMany({
      where: { projectId, sheetType: 'ACTUAL' },
      select: { id: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    await Promise.all(
      items.map((item, index) =>
        prisma.boqItem.update({
          where: { id: item.id },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    )

    const refreshed = await prisma.boqItem.findMany({
      where: { projectId, sheetType: 'ACTUAL' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json({ items: refreshed })
  } catch (error) {
    return respond((error as Error).message ?? '排序失败', 500)
  }
}
