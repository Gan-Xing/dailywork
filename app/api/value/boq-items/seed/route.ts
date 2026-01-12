import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function POST(request: Request) {
  if (!(await hasPermission('value:create'))) {
    return respond('缺少产值新增权限', 403)
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
    const existing = await prisma.boqItem.count({
      where: { projectId, sheetType: 'ACTUAL' },
    })
    if (existing > 0) {
      const items = await prisma.boqItem.findMany({
        where: { projectId, sheetType: 'ACTUAL' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      })
      return NextResponse.json({ created: false, items })
    }

    const contractItems = await prisma.boqItem.findMany({
      where: { projectId, sheetType: 'CONTRACT' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    if (!contractItems.length) {
      return NextResponse.json({ created: false, items: [] })
    }

    await prisma.boqItem.createMany({
      data: contractItems.map((item, index) => ({
        projectId: item.projectId,
        sheetType: 'ACTUAL',
        contractItemId: item.id,
        code: item.code,
        designationZh: item.designationZh,
        designationFr: item.designationFr,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        tone: item.tone,
        sortOrder: item.sortOrder || (index + 1) * 10,
        isActive: item.isActive,
      })),
    })

    const items = await prisma.boqItem.findMany({
      where: { projectId, sheetType: 'ACTUAL' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json({ created: true, items })
  } catch (error) {
    return respond((error as Error).message ?? '生成实际清单失败', 500)
  }
}
