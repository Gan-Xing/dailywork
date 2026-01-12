import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'
import { setPhaseItemBoqBinding, setPhaseItemBoqBindings } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')
  const projectId = Number(searchParams.get('projectId'))
  if (scope !== 'all' && (!Number.isInteger(projectId) || projectId <= 0)) {
    return respond('项目编号无效', 400)
  }

  try {
    const records = await prisma.phaseItemBoqItem.findMany({
      where: {
        isActive: true,
        boqItem: {
          ...(scope === 'all' ? {} : { projectId }),
          sheetType: 'CONTRACT',
          tone: 'ITEM',
          isActive: true,
        },
      },
      select: { phaseItemId: true, boqItemId: true },
    })
    const bindings = records.map((record) => ({
      phaseItemId: record.phaseItemId,
      boqItemId: record.boqItemId,
    }))
    return NextResponse.json({ bindings })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载绑定信息', 500)
  }
}

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

  const parsed = payload as {
    phaseItemId?: unknown
    projectId?: unknown
    boqItemId?: unknown
    boqItemIds?: unknown
  }

  const phaseItemId = Number(parsed.phaseItemId)
  if (!Number.isInteger(phaseItemId) || phaseItemId <= 0) {
    return respond('分项名称无效', 400)
  }

  if (Array.isArray(parsed.boqItemIds)) {
    const parsedIds = parsed.boqItemIds.map((value) => Number(value))
    if (parsedIds.some((value) => !Number.isInteger(value) || value <= 0)) {
      return respond('工程量清单条目无效', 400)
    }
    try {
      const result = await setPhaseItemBoqBindings({ phaseItemId, boqItemIds: parsedIds })
      return NextResponse.json({ boqItemIds: result.boqItemIds })
    } catch (error) {
      return respond((error as Error).message ?? '保存清单绑定失败', 500)
    }
  }

  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  const boqItemId =
    parsed.boqItemId === null || parsed.boqItemId === undefined || parsed.boqItemId === ''
      ? null
      : Number(parsed.boqItemId)
  if (boqItemId !== null && (!Number.isInteger(boqItemId) || boqItemId <= 0)) {
    return respond('工程量清单条目无效', 400)
  }

  try {
    const result = await setPhaseItemBoqBinding({ phaseItemId, projectId, boqItemId })
    return NextResponse.json({ boqItem: result.boqItem ?? null })
  } catch (error) {
    return respond((error as Error).message ?? '保存清单绑定失败', 500)
  }
}
