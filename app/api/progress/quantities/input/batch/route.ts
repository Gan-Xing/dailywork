import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { batchUpsertPhaseItemInputsForInterval } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function POST(request: Request) {
  if (!(await hasPermission('progress:edit'))) {
    return respond('缺少进度编辑权限', 403)
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

  const parsed = payload as { phaseId?: unknown; intervalId?: unknown }

  const phaseId = Number(parsed.phaseId)
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return respond('分项无效', 400)
  }

  const intervalId = Number(parsed.intervalId)
  if (!Number.isInteger(intervalId) || intervalId <= 0) {
    return respond('区间无效', 400)
  }

  try {
    const result = await batchUpsertPhaseItemInputsForInterval({ phaseId, intervalId })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message ?? '批量保存失败', 500)
  }
}
