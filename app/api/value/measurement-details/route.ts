import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const PERIOD_BASE_DATE = new Date(Date.UTC(2000, 0, 1))
const PERIOD_DAY_MS = 24 * 60 * 60 * 1000

const formatPeriodKey = (value: number) => String(value)

const resolvePeriodKeyFromDate = (value: Date) => {
  const diff = Math.round((value.getTime() - PERIOD_BASE_DATE.getTime()) / PERIOD_DAY_MS)
  if (!Number.isFinite(diff) || diff < 0) return null
  return formatPeriodKey(diff)
}

const parsePeriod = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('期次无效')
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'all') {
    return null
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

const parseProjectId = (value: unknown) => {
  const projectId = Number(value)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('项目编号无效')
  }
  return projectId
}

const parseRoadId = (value: unknown) => {
  const roadId = Number(value)
  if (!Number.isInteger(roadId) || roadId <= 0) {
    throw new Error('路段编号无效')
  }
  return roadId
}

const parseBoqItemId = (value: unknown) => {
  const boqItemId = Number(value)
  if (!Number.isInteger(boqItemId) || boqItemId <= 0) {
    throw new Error('清单条目无效')
  }
  return boqItemId
}

const parseDecimal = (value: unknown, label: string, options?: { allowNull?: boolean }) => {
  if (value === null || value === undefined || value === '') {
    if (options?.allowNull) return null
    throw new Error(`${label}不能为空`)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label}必须为数字`)
    return String(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '-') {
      if (options?.allowNull) return null
      throw new Error(`${label}不能为空`)
    }
    const normalized = trimmed.replace(/,/g, '')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) throw new Error(`${label}必须为数字`)
    return normalized
  }
  throw new Error(`${label}必须为数字`)
}

const parseNote = (value: unknown) => {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveAmount = (params: {
  quantity: unknown
  manualAmount: unknown
  recordUnitPrice: unknown
  boqUnitPrice: unknown
}) => {
  const manualAmount = toNumber(params.manualAmount)
  if (manualAmount !== null) return manualAmount
  const quantity = toNumber(params.quantity)
  const unitPrice = toNumber(params.recordUnitPrice) ?? toNumber(params.boqUnitPrice)
  if (quantity === null || unitPrice === null) return null
  return quantity * unitPrice
}

const summarizeRows = <T>(
  rows: T[],
  readQuantity: (row: T) => unknown,
  readAmount: (row: T) => number | null,
) =>
  rows.reduce(
    (acc, row) => {
      const quantity = toNumber(readQuantity(row)) ?? 0
      const amount = readAmount(row) ?? 0
      return {
        quantity: acc.quantity + quantity,
        amount: acc.amount + amount,
      }
    },
    { quantity: 0, amount: 0 },
  )

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

  const search = searchParams.get('search')?.trim() ?? ''

  let roadId: number | null = null
  if (searchParams.get('roadId')) {
    try {
      roadId = parseRoadId(searchParams.get('roadId'))
    } catch (error) {
      return respond((error as Error).message ?? '路段编号无效', 400)
    }
  }

  let periodFilter: Date | null
  try {
    periodFilter = parsePeriod(searchParams.get('period'))
  } catch (error) {
    return respond((error as Error).message ?? '期次无效', 400)
  }

  try {
    const detailWhere = {
      projectId,
      ...(periodFilter ? { period: periodFilter } : {}),
      ...(roadId ? { roadId } : {}),
      ...(search
        ? {
            OR: [
              { boqItem: { code: { contains: search, mode: 'insensitive' as const } } },
              { boqItem: { designationZh: { contains: search, mode: 'insensitive' as const } } },
              { boqItem: { designationFr: { contains: search, mode: 'insensitive' as const } } },
              { road: { name: { contains: search, mode: 'insensitive' as const } } },
              { note: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [details, allDetailsForSummary, measurementRows, boqItems, projectRoads, fallbackRoads, periodsFromDetails, periodsFromMeasurements, project] =
      await Promise.all([
        prisma.boqMeasurementDetail.findMany({
          where: detailWhere,
          include: {
            project: { select: { id: true, name: true, code: true } },
            boqItem: {
              select: {
                id: true,
                code: true,
                designationZh: true,
                designationFr: true,
                unit: true,
                unitPrice: true,
              },
            },
            road: { select: { id: true, name: true, slug: true, projectId: true } },
          },
          orderBy: [{ period: 'desc' }, { id: 'desc' }],
        }),
        prisma.boqMeasurementDetail.findMany({
          where: {
            projectId,
            ...(periodFilter ? { period: periodFilter } : {}),
          },
          include: {
            boqItem: {
              select: {
                unitPrice: true,
              },
            },
          },
        }),
        prisma.boqMeasurement.findMany({
          where: {
            projectId,
            ...(periodFilter ? { period: periodFilter } : {}),
            boqItem: {
              sheetType: 'ACTUAL',
              tone: 'ITEM',
              isActive: true,
              NOT: { code: 'AVANCE' },
            },
          },
          include: {
            boqItem: {
              select: {
                unitPrice: true,
              },
            },
          },
        }),
        prisma.boqItem.findMany({
          where: {
            projectId,
            sheetType: 'ACTUAL',
            tone: 'ITEM',
            isActive: true,
          },
          select: {
            id: true,
            code: true,
            designationZh: true,
            designationFr: true,
            unit: true,
            unitPrice: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        }),
        prisma.roadSection.findMany({
          where: { projectId },
          select: { id: true, name: true, slug: true, projectId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        prisma.roadSection.findMany({
          where: { projectId: null },
          select: { id: true, name: true, slug: true, projectId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        prisma.boqMeasurementDetail.findMany({
          where: { projectId },
          select: { period: true },
          distinct: ['period'],
          orderBy: { period: 'asc' },
        }),
        prisma.boqMeasurement.findMany({
          where: { projectId },
          select: { period: true },
          distinct: ['period'],
          orderBy: { period: 'asc' },
        }),
        prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, code: true } }),
      ])

    const roads = projectRoads.length ? projectRoads : fallbackRoads

    const mappedDetails = details.map((item) => {
      const quantity = toNumber(item.quantity) ?? 0
      const unitPrice = toNumber(item.boqItem.unitPrice)
      const manualAmount = toNumber(item.manualAmount)
      const amount = resolveAmount({
        quantity: item.quantity,
        manualAmount: item.manualAmount,
        recordUnitPrice: null,
        boqUnitPrice: item.boqItem.unitPrice,
      })
      const periodKey = resolvePeriodKeyFromDate(item.period)
      return {
        id: item.id,
        projectId: item.projectId,
        projectName: item.project.name,
        projectCode: item.project.code,
        period: item.period.toISOString(),
        periodKey,
        boqItemId: item.boqItemId,
        code: item.boqItem.code,
        designationZh: item.boqItem.designationZh,
        designationFr: item.boqItem.designationFr,
        unit: item.boqItem.unit,
        unitPrice,
        roadId: item.roadId,
        roadName: item.road.name,
        roadSlug: item.road.slug,
        quantity,
        manualAmount,
        amount,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }
    })

    const detailSummary = summarizeRows(
      allDetailsForSummary,
      (row) => row.quantity,
      (row) =>
        resolveAmount({
          quantity: row.quantity,
          manualAmount: row.manualAmount,
          recordUnitPrice: null,
          boqUnitPrice: row.boqItem.unitPrice,
        }),
    )

    const measurementSummary = summarizeRows(
      measurementRows,
      (row) => row.quantity,
      (row) =>
        resolveAmount({
          quantity: row.quantity,
          manualAmount: row.amount,
          recordUnitPrice: row.unitPrice,
          boqUnitPrice: row.boqItem.unitPrice,
        }),
    )

    const periodSet = new Set<string>()
    periodsFromDetails.forEach((row) => {
      const key = resolvePeriodKeyFromDate(row.period)
      if (key) periodSet.add(key)
    })
    periodsFromMeasurements.forEach((row) => {
      const key = resolvePeriodKeyFromDate(row.period)
      if (key) periodSet.add(key)
    })

    const periodOptions = Array.from(periodSet).sort((a, b) => Number(a) - Number(b))

    return NextResponse.json({
      project,
      details: mappedDetails,
      boqItems: boqItems.map((item) => ({
        id: item.id,
        code: item.code,
        designationZh: item.designationZh,
        designationFr: item.designationFr,
        unit: item.unit,
        unitPrice: toNumber(item.unitPrice),
      })),
      roads,
      periodOptions,
      summary: {
        detailQuantity: detailSummary.quantity,
        detailAmount: detailSummary.amount,
        measuredQuantity: measurementSummary.quantity,
        measuredAmount: measurementSummary.amount,
        quantityDelta: detailSummary.quantity - measurementSummary.quantity,
        amountDelta: detailSummary.amount - measurementSummary.amount,
      },
    })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载计量明细', 500)
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
    period?: unknown
    boqItemId?: unknown
    roadId?: unknown
    quantity?: unknown
    amount?: unknown
    note?: unknown
  }

  let projectId: number
  let boqItemId: number
  let roadId: number
  let period: Date | null
  try {
    projectId = parseProjectId(parsed.projectId)
    boqItemId = parseBoqItemId(parsed.boqItemId)
    roadId = parseRoadId(parsed.roadId)
    period = parsePeriod(parsed.period)
  } catch (error) {
    return respond((error as Error).message ?? '参数无效', 400)
  }

  if (!period) {
    return respond('期次不能为空', 400)
  }

  let quantity: string
  let manualAmount: string | null
  try {
    quantity = parseDecimal(parsed.quantity, '数量') as string
    manualAmount = parseDecimal(parsed.amount, '计量金额', { allowNull: true })
  } catch (error) {
    return respond((error as Error).message ?? '数字格式无效', 400)
  }

  if ((toNumber(quantity) ?? 0) <= 0) {
    return respond('数量必须大于 0', 400)
  }
  if (manualAmount !== null && (toNumber(manualAmount) ?? -1) < 0) {
    return respond('计量金额不能小于 0', 400)
  }

  const note = parseNote(parsed.note)

  try {
    const [project, boqItem, road] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }),
      prisma.boqItem.findFirst({
        where: {
          id: boqItemId,
          projectId,
          sheetType: 'ACTUAL',
          tone: 'ITEM',
          isActive: true,
        },
        select: {
          id: true,
          unitPrice: true,
          code: true,
          designationZh: true,
          designationFr: true,
          unit: true,
        },
      }),
      prisma.roadSection.findFirst({
        where: {
          id: roadId,
          OR: [{ projectId }, { projectId: null }],
        },
        select: { id: true, name: true, slug: true, projectId: true },
      }),
    ])

    if (!project) {
      return respond('项目不存在', 400)
    }
    if (!boqItem) {
      return respond('清单条目无效', 400)
    }
    if (!road) {
      return respond('路段无效', 400)
    }

    const created = await prisma.boqMeasurementDetail.create({
      data: {
        projectId,
        boqItemId,
        roadId,
        period,
        quantity,
        manualAmount,
        note,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        boqItem: {
          select: {
            id: true,
            code: true,
            designationZh: true,
            designationFr: true,
            unit: true,
            unitPrice: true,
          },
        },
        road: { select: { id: true, name: true, slug: true, projectId: true } },
      },
    })

    return NextResponse.json({
      detail: {
        id: created.id,
        projectId: created.projectId,
        projectName: created.project.name,
        projectCode: created.project.code,
        period: created.period.toISOString(),
        periodKey: resolvePeriodKeyFromDate(created.period),
        boqItemId: created.boqItemId,
        code: created.boqItem.code,
        designationZh: created.boqItem.designationZh,
        designationFr: created.boqItem.designationFr,
        unit: created.boqItem.unit,
        unitPrice: toNumber(created.boqItem.unitPrice),
        roadId: created.roadId,
        roadName: created.road.name,
        roadSlug: created.road.slug,
        quantity: toNumber(created.quantity) ?? 0,
        manualAmount: toNumber(created.manualAmount),
        amount: resolveAmount({
          quantity: created.quantity,
          manualAmount: created.manualAmount,
          recordUnitPrice: null,
          boqUnitPrice: created.boqItem.unitPrice,
        }),
        note: created.note,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    return respond((error as Error).message ?? '新增计量明细失败', 500)
  }
}
