import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { setPhaseItemBoqBindings } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
  }

  const { id } = await params
  const itemId = Number(id)
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return respond('分项名称无效', 400)
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

  const parsed = payload as { boqItemIds?: unknown }
  if (!Array.isArray(parsed.boqItemIds)) {
    return respond('清单条目无效', 400)
  }

  const boqItemIds = parsed.boqItemIds.map((value) => Number(value))
  if (boqItemIds.some((value) => !Number.isInteger(value) || value <= 0)) {
    return respond('清单条目无效', 400)
  }

  try {
    const result = await setPhaseItemBoqBindings({ phaseItemId: itemId, boqItemIds })
    return NextResponse.json({ boqItemIds: result.boqItemIds })
  } catch (error) {
    return respond((error as Error).message ?? '保存清单绑定失败', 500)
  }
}
