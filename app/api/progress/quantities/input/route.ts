import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { normalizeInputValues } from '@/lib/phaseItemFormula'
import { upsertPhaseItemInput } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('数量格式无效')
    }
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new Error('数量格式无效')
    }
    return parsed
  }
  throw new Error('数量格式无效')
}

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
    intervalId?: unknown
    values?: unknown
    manualQuantity?: unknown
  }

  const phaseItemId = Number(parsed.phaseItemId)
  if (!Number.isInteger(phaseItemId) || phaseItemId <= 0) {
    return respond('分项名称无效', 400)
  }

  const intervalId = Number(parsed.intervalId)
  if (!Number.isInteger(intervalId) || intervalId <= 0) {
    return respond('区间无效', 400)
  }

  let manualQuantity: number | null
  try {
    manualQuantity = parseOptionalNumber(parsed.manualQuantity)
  } catch (error) {
    return respond((error as Error).message ?? '数量格式无效', 400)
  }

  const values = normalizeInputValues(parsed.values)

  try {
    const result = await upsertPhaseItemInput({
      phaseItemId,
      intervalId,
      values,
      manualQuantity,
    })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message ?? '保存计量输入失败', 500)
  }
}
