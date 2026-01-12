import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { upsertPhaseItemFormula } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

type FormulaFieldPayload = {
  key?: unknown
  label?: unknown
  unit?: unknown
  hint?: unknown
}

const parseFields = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((field) => {
      if (!field || typeof field !== 'object') return null
      const raw = field as FormulaFieldPayload
      const key = typeof raw.key === 'string' ? raw.key.trim() : ''
      if (!key) return null
      const label = typeof raw.label === 'string' ? raw.label.trim() : ''
      const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''
      const hint = typeof raw.hint === 'string' ? raw.hint.trim() : ''
      return {
        key,
        label: label || key,
        unit: unit || null,
        hint: hint || null,
      }
    })
    .filter((field): field is { key: string; label: string; unit: string | null; hint: string | null } =>
      Boolean(field),
    )
}

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

  const parsed = payload as {
    expression?: unknown
    unitString?: unknown
    fields?: unknown
  }

  const expression = typeof parsed.expression === 'string' ? parsed.expression.trim() : ''
  const unitString =
    parsed.unitString === undefined || parsed.unitString === null
      ? null
      : typeof parsed.unitString === 'string'
      ? parsed.unitString.trim() || null
      : null
  const fields = parseFields(parsed.fields)
  const keys = fields.map((field) => field.key)
  const uniqueKeys = new Set(keys)
  if (keys.length !== uniqueKeys.size) {
    return respond('字段 Key 必须唯一', 400)
  }

  try {
    const result = await upsertPhaseItemFormula({
      phaseItemId: itemId,
      expression,
      unitString,
      inputSchema: fields.length ? { fields } : null,
    })
    return NextResponse.json({ formula: result.formula ?? null })
  } catch (error) {
    return respond((error as Error).message ?? '保存公式失败', 500)
  }
}
