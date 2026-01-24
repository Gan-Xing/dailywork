import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'
import { listBoqMeasurements, upsertBoqMeasurement } from '@/lib/server/boqStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const ADVANCE_CODE = 'AVANCE'
const ADVANCE_SORT_ORDER = 999999

const findAdvanceItem = async (projectId: number) =>
  prisma.boqItem.findFirst({
    where: {
      projectId,
      sheetType: 'ACTUAL',
      code: ADVANCE_CODE,
      isActive: true,
    },
    select: { id: true },
  })

const getOrCreateAdvanceItem = async (projectId: number) => {
  const existing = await findAdvanceItem(projectId)
  if (existing) return existing
  return prisma.boqItem.create({
    data: {
      projectId,
      sheetType: 'ACTUAL',
      code: ADVANCE_CODE,
      designationZh: '预付款',
      designationFr: 'Avance',
      unit: null,
      unitPrice: null,
      quantity: null,
      totalPrice: null,
      tone: 'TOTAL',
      sortOrder: ADVANCE_SORT_ORDER,
      isActive: true,
    },
    select: { id: true },
  })
}

const parseProjectId = (value: string | null) => {
  const projectId = Number(value)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('项目编号无效')
  }
  return projectId
}

const parseOptionalDecimal = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
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

const parseRequiredDecimal = (value: unknown, label: string) => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${label}不能为空`)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label}必须为数字`)
    }
    return String(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '-') {
      throw new Error(`${label}不能为空`)
    }
    const normalized = trimmed.replace(/,/g, '')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label}必须为数字`)
    }
    return normalized
  }
  throw new Error(`${label}必须为数字`)
}

const PERIOD_BASE_DATE = new Date(Date.UTC(2000, 0, 1))
const PERIOD_DAY_MS = 24 * 60 * 60 * 1000

const parsePeriod = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new Error('期次无效')
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('期次不能为空')
  }
  const normalized = trimmed.startsWith('P') || trimmed.startsWith('p') ? trimmed.slice(1) : trimmed
  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized)
    if (!Number.isInteger(index) || index < 0) {
      throw new Error('期次格式无效')
    }
    return new Date(PERIOD_BASE_DATE.getTime() + index * PERIOD_DAY_MS)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('期次格式无效')
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
}

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  let projectId: number
  try {
    projectId = parseProjectId(searchParams.get('projectId'))
  } catch (error) {
    return respond((error as Error).message ?? '项目编号无效', 400)
  }

  try {
    const [measurements, advanceItem] = await Promise.all([
      listBoqMeasurements({ projectId }),
      findAdvanceItem(projectId),
    ])
    return NextResponse.json({ measurements, advanceItemId: advanceItem?.id ?? null })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载计量记录', 500)
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
    projectId?: unknown
    entries?: unknown
  }

  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  if (!Array.isArray(parsed.entries)) {
    return respond('计量列表无效', 400)
  }
  if (!parsed.entries.length) {
    return respond('计量列表为空', 400)
  }

  let entries: Array<{
    kind: 'ITEM' | 'ADVANCE'
    boqItemId: number
    period: Date
    quantity: string
    unitPrice: string | null
    amount: string | null
    note: string | null
  }>

  try {
    entries = parsed.entries.map((entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error('计量列表无效')
      }
      const raw = entry as {
        boqItemId?: unknown
        kind?: unknown
        period?: unknown
        quantity?: unknown
        unitPrice?: unknown
        amount?: unknown
        note?: unknown
      }
      const kind = raw.kind === 'ADVANCE' ? 'ADVANCE' : 'ITEM'
      const boqItemId = Number(raw.boqItemId ?? 0)
      if (kind === 'ITEM' && (!Number.isInteger(boqItemId) || boqItemId <= 0)) {
        throw new Error('工程量清单条目无效')
      }
      const period = parsePeriod(raw.period)
      const quantity =
        kind === 'ADVANCE' ? '0' : parseRequiredDecimal(raw.quantity, '计量工程量')
      const unitPrice = parseOptionalDecimal(raw.unitPrice)
      const amount = parseOptionalDecimal(raw.amount)
      const note = raw.note === null || raw.note === undefined ? null : String(raw.note).trim() || null
      return { kind, boqItemId, period, quantity, unitPrice, amount, note }
    })
  } catch (error) {
    return respond((error as Error).message ?? '计量列表无效', 400)
  }

  try {
    let advanceItemId: number | null = null
    if (entries.some((entry) => entry.kind === 'ADVANCE')) {
      const advanceItem = await getOrCreateAdvanceItem(projectId)
      advanceItemId = advanceItem.id
    }

    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      boqItemId: entry.kind === 'ADVANCE' && advanceItemId ? advanceItemId : entry.boqItemId,
    }))

    const targetIds = Array.from(new Set(normalizedEntries.map((item) => item.boqItemId)))
    const items = await prisma.boqItem.findMany({
      where: {
        id: { in: targetIds },
        projectId,
        sheetType: 'ACTUAL',
        isActive: true,
      },
      select: { id: true },
    })
    if (items.length !== targetIds.length) {
      return respond('工程量清单条目无效', 400)
    }

    await Promise.all(
      normalizedEntries.map((entry) =>
        upsertBoqMeasurement({
          projectId,
          boqItemId: entry.boqItemId,
          period: entry.period,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          amount: entry.amount,
          note: entry.note,
        }),
      ),
    )

    const measurements = await listBoqMeasurements({ projectId })
    return NextResponse.json({ measurements })
  } catch (error) {
    return respond((error as Error).message ?? '保存计量失败', 500)
  }
}
