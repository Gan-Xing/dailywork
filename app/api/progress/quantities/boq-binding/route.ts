import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { setPhaseItemBoqBinding } from '@/lib/server/phaseItemManagement'

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

  const parsed = payload as {
    phaseItemId?: unknown
    projectId?: unknown
    boqItemId?: unknown
  }

  const phaseItemId = Number(parsed.phaseItemId)
  if (!Number.isInteger(phaseItemId) || phaseItemId <= 0) {
    return respond('分项名称无效', 400)
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
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message ?? '保存清单绑定失败', 500)
  }
}
