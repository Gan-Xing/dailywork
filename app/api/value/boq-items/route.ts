import { NextResponse } from 'next/server'

import type { BoqItemTone, BoqSheetType } from '@prisma/client'

import { hasPermission } from '@/lib/server/authSession'
import {
  createBoqItem,
  deactivateBoqItem,
  listBoqItems,
  updateBoqItem,
} from '@/lib/server/boqStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const parseSheetType = (value: string | null): BoqSheetType => {
  if (!value || value === 'CONTRACT') return 'CONTRACT'
  if (value === 'ACTUAL') return 'ACTUAL'
  throw new Error('清单类型无效')
}

const parseTone = (value: unknown): BoqItemTone => {
  if (value === 'SECTION' || value === 'SUBSECTION' || value === 'ITEM' || value === 'TOTAL') {
    return value
  }
  return 'ITEM'
}

const parseRequiredText = (value: unknown, label: string) => {
  if (typeof value !== 'string') {
    throw new Error(`${label}必须为文本`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label}不能为空`)
  }
  return trimmed
}

const parseOptionalText = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new Error('字段格式无效')
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseOptionalDecimal = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('金额必须为数字')
    }
    return String(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '-') return null
    const normalized = trimmed.replace(/,/g, '')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
      throw new Error('金额必须为数字')
    }
    return normalized
  }
  throw new Error('金额必须为数字')
}

const parseOptionalInt = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('编号无效')
  }
  return parsed
}

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const projectId = Number(searchParams.get('projectId'))
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  let sheetType: BoqSheetType
  try {
    sheetType = parseSheetType(searchParams.get('sheetType'))
  } catch (error) {
    return respond((error as Error).message ?? '清单类型无效', 400)
  }

  const includeInactive = searchParams.get('includeInactive') === 'true'

  try {
    const items = await listBoqItems({ projectId, sheetType, includeInactive })
    return NextResponse.json({ items })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载清单数据', 500)
  }
}

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

  const parsed = payload as {
    projectId?: unknown
    sheetType?: unknown
    code?: unknown
    designationZh?: unknown
    designationFr?: unknown
    unit?: unknown
    unitPrice?: unknown
    quantity?: unknown
    totalPrice?: unknown
    tone?: unknown
    sortOrder?: unknown
    contractItemId?: unknown
  }

  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  let sheetType: BoqSheetType
  try {
    sheetType = parseSheetType(typeof parsed.sheetType === 'string' ? parsed.sheetType : null)
  } catch (error) {
    return respond((error as Error).message ?? '清单类型无效', 400)
  }

  let code: string
  let designationZh: string
  let designationFr: string
  try {
    code = parseRequiredText(parsed.code, '编号')
    designationZh = parseRequiredText(parsed.designationZh, '中文名称')
    designationFr = parseRequiredText(parsed.designationFr, '法文名称')
  } catch (error) {
    return respond((error as Error).message ?? '字段无效', 400)
  }

  let tone: BoqItemTone
  try {
    tone = parseTone(parsed.tone)
  } catch (error) {
    return respond((error as Error).message ?? '行类型无效', 400)
  }

  let unit: string | null
  let unitPrice: string | null
  let quantity: string | null
  let totalPrice: string | null
  let contractItemId: number | null

  try {
    unit = parseOptionalText(parsed.unit)
    unitPrice = parseOptionalDecimal(parsed.unitPrice)
    quantity = parseOptionalDecimal(parsed.quantity)
    totalPrice = parseOptionalDecimal(parsed.totalPrice)
    contractItemId = parseOptionalInt(parsed.contractItemId)
  } catch (error) {
    return respond((error as Error).message ?? '字段格式无效', 400)
  }

  const sortOrder = Number.isInteger(Number(parsed.sortOrder)) ? Number(parsed.sortOrder) : 0

  try {
    const item = await createBoqItem({
      projectId,
      sheetType,
      code,
      designationZh,
      designationFr,
      unit,
      unitPrice,
      quantity,
      totalPrice,
      tone,
      sortOrder,
      contractItemId,
    })
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message ?? '创建清单条目失败', 500)
  }
}

export async function PATCH(request: Request) {
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
    boqItemId?: unknown
    code?: unknown
    designationZh?: unknown
    designationFr?: unknown
    unit?: unknown
    unitPrice?: unknown
    quantity?: unknown
    totalPrice?: unknown
    tone?: unknown
    sortOrder?: unknown
    contractItemId?: unknown
    isActive?: unknown
  }

  const id = Number(parsed.boqItemId)
  if (!Number.isInteger(id) || id <= 0) {
    return respond('清单条目无效', 400)
  }

  let tone: BoqItemTone | undefined
  if (parsed.tone !== undefined) {
    tone = parseTone(parsed.tone)
  }

  let unit: string | null | undefined
  let unitPrice: string | null | undefined
  let quantity: string | null | undefined
  let totalPrice: string | null | undefined
  let contractItemId: number | null | undefined

  try {
    unit = parsed.unit === undefined ? undefined : parseOptionalText(parsed.unit)
    unitPrice = parsed.unitPrice === undefined ? undefined : parseOptionalDecimal(parsed.unitPrice)
    quantity = parsed.quantity === undefined ? undefined : parseOptionalDecimal(parsed.quantity)
    totalPrice = parsed.totalPrice === undefined ? undefined : parseOptionalDecimal(parsed.totalPrice)
    contractItemId =
      parsed.contractItemId === undefined ? undefined : parseOptionalInt(parsed.contractItemId)
  } catch (error) {
    return respond((error as Error).message ?? '字段格式无效', 400)
  }

  const sortOrder =
    parsed.sortOrder === undefined
      ? undefined
      : Number.isInteger(Number(parsed.sortOrder))
      ? Number(parsed.sortOrder)
      : undefined

  const isActive = typeof parsed.isActive === 'boolean' ? parsed.isActive : undefined

  try {
    const item = await updateBoqItem(id, {
      code: typeof parsed.code === 'string' ? parsed.code.trim() : undefined,
      designationZh:
        typeof parsed.designationZh === 'string' ? parsed.designationZh.trim() : undefined,
      designationFr:
        typeof parsed.designationFr === 'string' ? parsed.designationFr.trim() : undefined,
      unit,
      unitPrice,
      quantity,
      totalPrice,
      tone,
      sortOrder,
      contractItemId,
      isActive,
    })
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message ?? '更新清单条目失败', 500)
  }
}

export async function DELETE(request: Request) {
  if (!(await hasPermission('value:delete'))) {
    return respond('缺少产值删除权限', 403)
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

  const parsed = payload as { boqItemId?: unknown }
  const id = Number(parsed.boqItemId)
  if (!Number.isInteger(id) || id <= 0) {
    return respond('清单条目无效', 400)
  }

  try {
    const item = await deactivateBoqItem(id)
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message ?? '删除清单条目失败', 500)
  }
}
