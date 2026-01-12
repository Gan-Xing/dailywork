import { NextResponse } from 'next/server'

import type { BoqItemTone, BoqSheetType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'
import {
  deactivateBoqItem,
  listBoqItems,
  listBoqItemsWithProject,
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

const parseOptionalTone = (value: string | null): BoqItemTone | null => {
  if (!value) return null
  if (value === 'SECTION' || value === 'SUBSECTION' || value === 'ITEM' || value === 'TOTAL') {
    return value
  }
  throw new Error('行类型无效')
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

const parseDecimalValue = (value?: string | number | Prisma.Decimal | null) => {
  if (value === undefined || value === null) return null
  const source =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : value.toString()
  const trimmed = source.trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const computeTotalPrice = (
  quantity?: string | number | Prisma.Decimal | null,
  unitPrice?: string | number | Prisma.Decimal | null,
) => {
  const quantityValue = parseDecimalValue(quantity)
  const unitValue = parseDecimalValue(unitPrice)
  if (quantityValue === null || unitValue === null) return null
  return (quantityValue * unitValue).toFixed(2)
}

const normalizeBoqCode = (value?: string | null) => (value ?? '').trim().toUpperCase()

const isVatCode = (code: string) => code === 'TVA'
const isTotalHtvaCode = (code: string) => code.startsWith('TOTAL HTVA')
const isTotalWithTaxCode = (code: string) => code.startsWith('TOTAL TTC')
const isRecapHeaderCode = (code: string) => code === 'R'

const parseSectionTotalCode = (code: string) => {
  const match = code.match(/^T(\d+)$/)
  if (!match) return null
  return Number(match[1])
}

const splitCodeTokens = (code: string) => {
  const tokens = code.match(/\d+|[A-Z]+/g) ?? []
  return tokens.map((token) => {
    if (/^\d+$/.test(token)) return Number(token)
    return token
  })
}

const compareCodeTokens = (left: Array<number | string>, right: Array<number | string>) => {
  const length = Math.min(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const a = left[i]
    const b = right[i]
    if (a === b) continue
    const aIsNumber = typeof a === 'number'
    const bIsNumber = typeof b === 'number'
    if (aIsNumber && bIsNumber) {
      return (a as number) - (b as number)
    }
    if (!aIsNumber && !bIsNumber) {
      return String(a).localeCompare(String(b))
    }
    return aIsNumber ? -1 : 1
  }
  return left.length - right.length
}

const resolveSectionKey = (code: string, tokens: Array<number | string>) => {
  const sectionTotal = parseSectionTotalCode(code)
  if (sectionTotal !== null) {
    return sectionTotal * 100
  }
  const firstNumber = typeof tokens[0] === 'number' ? (tokens[0] as number) : null
  if (firstNumber === null) return Number.MAX_SAFE_INTEGER - 10
  if (firstNumber < 100) return 0
  return Math.floor(firstNumber / 100) * 100
}

const resolveGroupRank = (code: string) => {
  if (isTotalHtvaCode(code) || isVatCode(code) || isTotalWithTaxCode(code)) return 2
  if (isRecapHeaderCode(code)) return 1
  return 0
}

const resolveTotalRank = (code: string) => {
  if (isTotalHtvaCode(code)) return 0
  if (isVatCode(code)) return 1
  if (isTotalWithTaxCode(code)) return 2
  return 99
}

const compareBoqCodes = (left: string, right: string) => {
  const leftCode = normalizeBoqCode(left)
  const rightCode = normalizeBoqCode(right)
  if (leftCode === rightCode) return 0

  const leftGroup = resolveGroupRank(leftCode)
  const rightGroup = resolveGroupRank(rightCode)
  if (leftGroup !== rightGroup) return leftGroup - rightGroup

  if (leftGroup === 2) {
    return resolveTotalRank(leftCode) - resolveTotalRank(rightCode)
  }

  if (leftGroup === 1) {
    return leftCode === 'R' ? -1 : 1
  }

  const leftTokens = splitCodeTokens(leftCode)
  const rightTokens = splitCodeTokens(rightCode)
  const leftSection = resolveSectionKey(leftCode, leftTokens)
  const rightSection = resolveSectionKey(rightCode, rightTokens)
  if (leftSection !== rightSection) return leftSection - rightSection

  const leftIsSectionTotal = parseSectionTotalCode(leftCode) !== null
  const rightIsSectionTotal = parseSectionTotalCode(rightCode) !== null
  if (leftIsSectionTotal !== rightIsSectionTotal) {
    return leftIsSectionTotal ? 1 : -1
  }

  const tokenCompare = compareCodeTokens(leftTokens, rightTokens)
  if (tokenCompare !== 0) return tokenCompare
  return leftCode.localeCompare(rightCode)
}

const resolveInsertIndex = (
  items: { code: string; tone: BoqItemTone }[],
  incoming: { code: string; tone: BoqItemTone },
) => {
  for (let i = 0; i < items.length; i += 1) {
    if (compareBoqCodes(incoming.code, items[i].code) < 0) {
      return i
    }
  }
  return items.length
}

const resolveSortOrderBetween = (
  prev: { sortOrder: number } | null,
  next: { sortOrder: number } | null,
) => {
  if (!prev && !next) return 10
  if (!prev && next) {
    if (next.sortOrder > 1) return Math.max(1, next.sortOrder - 10)
    return null
  }
  if (prev && !next) return prev.sortOrder + 10
  if (!prev || !next) return null
  const gap = next.sortOrder - prev.sortOrder
  if (gap <= 1) return null
  return Math.floor(prev.sortOrder + gap / 2)
}

const rebaseSortOrders = async (
  tx: Prisma.TransactionClient,
  items: { id: number; sortOrder: number }[],
) => {
  await Promise.all(
    items.map((item, index) =>
      tx.boqItem.update({
        where: { id: item.id },
        data: { sortOrder: (index + 1) * 10 },
      }),
    ),
  )
  return items.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }))
}

const resolveActualSortOrder = async (
  tx: Prisma.TransactionClient,
  projectId: number,
  incoming: { code: string; tone: BoqItemTone },
  excludeId?: number,
) => {
  const items = await tx.boqItem.findMany({
    where: {
      projectId,
      sheetType: 'ACTUAL',
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, code: true, tone: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  if (!items.length) return 10
  if (incoming.tone === 'SUBSECTION') {
    const maxOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), 0)
    return maxOrder + 10
  }
  const insertIndex = resolveInsertIndex(items, incoming)
  const prev = insertIndex > 0 ? items[insertIndex - 1] : null
  const next = insertIndex < items.length ? items[insertIndex] : null
  const direct = resolveSortOrderBetween(prev, next)
  if (direct !== null) return direct
  const rebased = await rebaseSortOrders(tx, items)
  const prevAfter = insertIndex > 0 ? rebased[insertIndex - 1] : null
  const nextAfter = insertIndex < rebased.length ? rebased[insertIndex] : null
  return resolveSortOrderBetween(prevAfter, nextAfter) ?? (rebased.length + 1) * 10
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
  const scope = searchParams.get('scope')
  const includeLetters = searchParams.get('includeLetters') === 'true'

  let sheetType: BoqSheetType
  try {
    sheetType = parseSheetType(searchParams.get('sheetType'))
  } catch (error) {
    return respond((error as Error).message ?? '清单类型无效', 400)
  }

  let tone: BoqItemTone | null
  try {
    tone = parseOptionalTone(searchParams.get('tone'))
  } catch (error) {
    return respond((error as Error).message ?? '行类型无效', 400)
  }

  const includeInactive = searchParams.get('includeInactive') === 'true'

  try {
    if (scope === 'all') {
      const items = await listBoqItemsWithProject({ sheetType, includeInactive, tone })
      const responseItems = items.map(({ project, ...item }) => ({
        ...item,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
      }))
      if (includeLetters && responseItems.length) {
        const itemIds = responseItems.map((item) => item.id)
        const counts = await prisma.letter.groupBy({
          by: ['boqItemId'],
          where: { boqItemId: { in: itemIds } },
          _count: { _all: true },
        })
        const countMap = new Map(counts.map((row) => [row.boqItemId, row._count._all]))
        const latestLetters = await prisma.letter.findMany({
          where: { boqItemId: { in: itemIds } },
          include: { document: { select: { status: true } } },
          orderBy: [{ letterNumber: 'desc' }, { id: 'desc' }],
        })
        const statusMap = new Map<number, string>()
        latestLetters.forEach((letter) => {
          const boqItemId = letter.boqItemId
          if (!boqItemId) return
          if (!statusMap.has(boqItemId)) {
            statusMap.set(boqItemId, letter.document.status)
          }
        })
        const withLetters = responseItems.map((item) => ({
          ...item,
          letterCount: countMap.get(item.id) ?? 0,
          latestLetterStatus: statusMap.get(item.id) ?? null,
        }))
        return NextResponse.json({ items: withLetters })
      }
      return NextResponse.json({ items: responseItems })
    }

    const projectId = Number(searchParams.get('projectId'))
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return respond('项目编号无效', 400)
    }
    const items = await listBoqItems({ projectId, sheetType, includeInactive, tone })
    if (includeLetters && items.length) {
      const itemIds = items.map((item) => item.id)
      const counts = await prisma.letter.groupBy({
        by: ['boqItemId'],
        where: { boqItemId: { in: itemIds } },
        _count: { _all: true },
      })
      const countMap = new Map(counts.map((row) => [row.boqItemId, row._count._all]))
      const latestLetters = await prisma.letter.findMany({
        where: { boqItemId: { in: itemIds } },
        include: { document: { select: { status: true } } },
        orderBy: [{ letterNumber: 'desc' }, { id: 'desc' }],
      })
      const statusMap = new Map<number, string>()
      latestLetters.forEach((letter) => {
        const boqItemId = letter.boqItemId
        if (!boqItemId) return
        if (!statusMap.has(boqItemId)) {
          statusMap.set(boqItemId, letter.document.status)
        }
      })
      const withLetters = items.map((item) => ({
        ...item,
        letterCount: countMap.get(item.id) ?? 0,
        latestLetterStatus: statusMap.get(item.id) ?? null,
      }))
      return NextResponse.json({ items: withLetters })
    }
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

  try {
    const computedTotalPrice = tone === 'ITEM' ? computeTotalPrice(quantity, unitPrice) : totalPrice
    const item = await prisma.$transaction(async (tx) => {
      const sortOrder =
        sheetType === 'ACTUAL'
          ? await resolveActualSortOrder(tx, projectId, { code, tone })
          : 0
      const created = await tx.boqItem.create({
        data: {
          projectId,
          sheetType,
          code,
          designationZh,
          designationFr,
          unit,
          unitPrice,
          quantity,
          totalPrice: computedTotalPrice,
          tone,
          sortOrder,
          contractItemId,
        },
      })
      return created
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

  const existing = await prisma.boqItem.findUnique({
    where: { id },
    select: {
      id: true,
      sheetType: true,
      code: true,
      tone: true,
      quantity: true,
      unitPrice: true,
      contractItemId: true,
      projectId: true,
    },
  })
  if (!existing) {
    return respond('清单条目无效', 404)
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

  const isContractBound = existing.sheetType === 'ACTUAL' && existing.contractItemId !== null
  const canEditStructure = !isContractBound
  const nextCode =
    canEditStructure && typeof parsed.code === 'string'
      ? parsed.code.trim()
      : existing.code
  const nextTone = canEditStructure && tone !== undefined ? tone : existing.tone
  const nextUnitPrice = canEditStructure
    ? unitPrice === undefined
      ? existing.unitPrice
      : unitPrice
    : existing.unitPrice

  const isActive = typeof parsed.isActive === 'boolean' ? parsed.isActive : undefined

  try {
    const nextQuantity = quantity === undefined ? existing.quantity : quantity
    const computedTotalPrice =
      nextTone === 'ITEM' ? computeTotalPrice(nextQuantity, nextUnitPrice) : totalPrice
    const shouldReorder =
      existing.sheetType === 'ACTUAL' &&
      canEditStructure &&
      (parsed.code !== undefined || parsed.tone !== undefined)

    const item = await prisma.$transaction(async (tx) => {
      const nextSortOrder = shouldReorder
        ? await resolveActualSortOrder(tx, existing.projectId, { code: nextCode, tone: nextTone }, id)
        : undefined
      const updated = await tx.boqItem.update({
        where: { id },
        data: {
          code:
            canEditStructure && typeof parsed.code === 'string' ? parsed.code.trim() : undefined,
          designationZh:
            canEditStructure && typeof parsed.designationZh === 'string'
              ? parsed.designationZh.trim()
              : undefined,
          designationFr:
            canEditStructure && typeof parsed.designationFr === 'string'
              ? parsed.designationFr.trim()
              : undefined,
          unit: canEditStructure ? unit : undefined,
          unitPrice: canEditStructure ? unitPrice : undefined,
          quantity,
          totalPrice: computedTotalPrice === undefined ? undefined : computedTotalPrice,
          tone: canEditStructure ? tone : undefined,
          contractItemId: canEditStructure ? contractItemId : undefined,
          isActive,
          sortOrder: nextSortOrder,
        },
      })
      return updated
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
