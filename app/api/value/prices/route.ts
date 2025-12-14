import { NextResponse } from 'next/server'

import { PhaseMeasure } from '@prisma/client'

import { hasPermission } from '@/lib/server/authSession'
import {
  createPhasePriceItem,
  deactivatePhasePriceItem,
  listPhasePricing,
  updatePhasePriceItem,
} from '@/lib/server/phasePricingStore'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'
import { aggregatePhaseProgress } from '@/lib/progressAggregation'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const parseUnitPrice = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('价格必须是非负数字')
    }
    return Math.round(parsed * 100) / 100
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('价格必须是非负数字')
    }
    return Math.round(value * 100) / 100
  }
  throw new Error('价格格式无效')
}

const parseMeasure = (value: unknown): PhaseMeasure => {
  if (value === 'LINEAR' || value === 'POINT') {
    return value
  }
  throw new Error('计量方式无效')
}

export async function GET() {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }
  try {
    const roads = await listRoadSectionsWithProgress()
    const aggregated = aggregatePhaseProgress(roads)
    const specOptionsMap = new Map<number, Set<string>>()
    aggregated.forEach((phase) => {
      if (!phase.phaseDefinitionId) return
      const spec = phase.spec?.trim()
      if (!spec) return
      const existing = specOptionsMap.get(phase.phaseDefinitionId)
      if (existing) {
        existing.add(spec)
      } else {
        specOptionsMap.set(phase.phaseDefinitionId, new Set([spec]))
      }
    })
    const prices = await listPhasePricing()
    const enriched = prices.map((item) => ({
      ...item,
      specOptions: Array.from(specOptionsMap.get(item.phaseDefinitionId) ?? []).sort(),
    }))
    return NextResponse.json({ phases: enriched })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载价格列表', 500)
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
    phaseDefinitionId?: unknown
    name?: unknown
    measure?: unknown
    spec?: unknown
    unitString?: unknown
    description?: unknown
    unitPrice?: unknown
  }

  const definitionId = Number(parsed.phaseDefinitionId)
  if (!Number.isInteger(definitionId) || definitionId <= 0) {
    return respond('分项定义无效', 400)
  }
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
  if (!name) {
    return respond('分项名称不能为空', 400)
  }

  let measure: PhaseMeasure
  try {
    measure = parseMeasure(parsed.measure)
  } catch (error) {
    return respond((error as Error).message ?? '计量方式错误', 400)
  }

  const spec =
    parsed.spec === undefined
      ? undefined
      : typeof parsed.spec === 'string'
      ? parsed.spec.trim() || null
      : null

  const unitString =
    parsed.unitString === undefined
      ? undefined
      : typeof parsed.unitString === 'string'
      ? parsed.unitString.trim() || null
      : null

  const description =
    parsed.description === undefined
      ? undefined
      : typeof parsed.description === 'string'
      ? parsed.description.trim() || null
      : null

  let unitPrice: number | null
  try {
    unitPrice = parseUnitPrice(parsed.unitPrice)
  } catch (error) {
    return respond((error as Error).message ?? '价格格式错误', 400)
  }

  try {
    const created = await createPhasePriceItem({
      phaseDefinitionId: definitionId,
      name,
      spec,
      measure,
      unitString,
      description,
      unitPrice,
    })
    return NextResponse.json({ item: created })
  } catch (error) {
    return respond((error as Error).message ?? '创建价格项失败', 500)
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
    priceItemId?: unknown
    name?: unknown
    spec?: unknown
    unitString?: unknown
    description?: unknown
    unitPrice?: unknown
    isActive?: unknown
  }

  const id = Number(parsed.priceItemId)
  if (!Number.isInteger(id) || id <= 0) {
    return respond('价格项无效', 400)
  }

  const name =
    parsed.name === undefined
      ? undefined
      : typeof parsed.name === 'string'
      ? parsed.name.trim()
      : undefined

  const spec =
    parsed.spec === undefined
      ? undefined
      : typeof parsed.spec === 'string'
      ? parsed.spec.trim() || null
      : null

  const unitString =
    parsed.unitString === undefined
      ? undefined
      : typeof parsed.unitString === 'string'
      ? parsed.unitString.trim() || null
      : null

  const description =
    parsed.description === undefined
      ? undefined
      : typeof parsed.description === 'string'
      ? parsed.description.trim() || null
      : null

  let unitPrice: number | null | undefined
  try {
    unitPrice = parseUnitPrice(parsed.unitPrice)
  } catch (error) {
    return respond((error as Error).message ?? '价格格式错误', 400)
  }

  const isActive =
    parsed.isActive === undefined
      ? undefined
      : parsed.isActive === true || parsed.isActive === false
      ? parsed.isActive
      : undefined

  try {
    const updated = await updatePhasePriceItem(id, {
      name,
      spec,
      unitString,
      description,
      unitPrice,
      isActive,
    })
    return NextResponse.json({ item: updated })
  } catch (error) {
    return respond((error as Error).message ?? '更新价格项失败', 500)
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

  const { priceItemId } = payload as { priceItemId?: unknown }
  const id = Number(priceItemId)
  if (!Number.isInteger(id) || id <= 0) {
    return respond('价格项无效', 400)
  }

  try {
    const removed = await deactivatePhasePriceItem(id)
    return NextResponse.json({ item: removed })
  } catch (error) {
    return respond((error as Error).message ?? '删除价格项失败', 500)
  }
}
