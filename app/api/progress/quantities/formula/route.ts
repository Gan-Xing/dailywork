import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { upsertPhaseItemFormula } from '@/lib/server/phaseItemManagement'

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
    expression?: unknown
    inputSchema?: unknown
    unitString?: unknown
  }

  const phaseItemId = Number(parsed.phaseItemId)
  if (!Number.isInteger(phaseItemId) || phaseItemId <= 0) {
    return respond('分项名称无效', 400)
  }

  if (
    parsed.expression !== undefined &&
    parsed.expression !== null &&
    typeof parsed.expression !== 'string'
  ) {
    return respond('公式格式无效', 400)
  }
  const expression = typeof parsed.expression === 'string' ? parsed.expression : ''
  const unitString =
    parsed.unitString === undefined
      ? undefined
      : typeof parsed.unitString === 'string'
        ? parsed.unitString.trim() || null
        : null

  try {
    const result = await upsertPhaseItemFormula({
      phaseItemId,
      expression,
      inputSchema: parsed.inputSchema ?? null,
      unitString,
    })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message ?? '保存公式失败', 500)
  }
}
