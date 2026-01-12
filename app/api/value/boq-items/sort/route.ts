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

  const parsed = payload as { projectId?: unknown; orderedIds?: unknown }
  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }
  if (!Array.isArray(parsed.orderedIds)) {
    return respond('排序列表无效', 400)
  }
  const orderedIds = parsed.orderedIds.map((value) => Number(value)).filter(Number.isInteger)
  if (!orderedIds.length) {
    return respond('排序列表为空', 400)
  }

  try {
    const items = await prisma.boqItem.findMany({
      where: { projectId, sheetType: 'ACTUAL' },
      select: { id: true },
    })
    const itemIdSet = new Set(items.map((item) => item.id))
    const filteredIds = orderedIds.filter((id) => itemIdSet.has(id))
    if (filteredIds.length !== items.length) {
      return respond('排序列表与实际清单不一致', 400)
    }

    await prisma.$transaction(
      filteredIds.map((id, index) =>
        prisma.boqItem.update({
          where: { id },
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
    return respond((error as Error).message ?? '更新排序失败', 500)
  }
}
