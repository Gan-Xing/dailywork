import { NextResponse, type NextRequest } from 'next/server'
import {
  type IntervalSide,
  SiteVariationMeasurementReason,
  SiteVariationMeasurementStatus,
  SiteVariationMeasurementType,
} from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  createFormalMeasurementFromVariation,
  createSiteVariationMeasurement,
  listSiteVariationMeasurements,
  type SiteVariationMeasurementAttachmentState,
  type SiteVariationMeasurementSortDir,
  type SiteVariationMeasurementSortField,
  type SiteVariationMeasurementWriteInput,
  updateSiteVariationMeasurement,
  updateSiteVariationMeasurementStatus,
} from '@/lib/server/siteVariationMeasurementStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const SIDE_ALIAS_MAP: Record<string, IntervalSide> = {
  BOTH: 'BOTH',
  B: 'BOTH',
  DOUBLE: 'BOTH',
  DEUXCOTES: 'BOTH',
  DEUXCOTE: 'BOTH',
  TWOSIDES: 'BOTH',
  BOTHSIDES: 'BOTH',
  左右: 'BOTH',
  两侧: 'BOTH',
  双侧: 'BOTH',
  LEFT: 'LEFT',
  L: 'LEFT',
  G: 'LEFT',
  GAUCHE: 'LEFT',
  左: 'LEFT',
  左侧: 'LEFT',
  RIGHT: 'RIGHT',
  R: 'RIGHT',
  D: 'RIGHT',
  DROITE: 'RIGHT',
  右: 'RIGHT',
  右侧: 'RIGHT',
}

const SORT_FIELDS: SiteVariationMeasurementSortField[] = [
  'id',
  'occurredAt',
  'updatedAt',
  'status',
  'projectName',
  'estimatedAmount',
]

const parsePositiveInt = (value: unknown, label: string) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}无效`)
  }
  return parsed
}

const parseNullableId = (value: unknown, label: string) => {
  if (value === null || value === undefined || value === '') return null
  return parsePositiveInt(value, label)
}

const parseNullableText = (value: unknown, maxLength = 2000) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  if (text.length > maxLength) {
    throw new Error(`文本长度不能超过 ${maxLength}`)
  }
  return text
}

const parseDecimal = (value: unknown, label: string) => {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim().replace(/,/g, '')
  if (!text || text === '-') return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label}必须为数字`)
  }
  return text
}

const parseDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const text = String(value).trim()
  if (!text) return null
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, 1))
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00.000Z`)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('日期格式无效')
  }
  return parsed
}

const parseStatus = (value: unknown, fallback = SiteVariationMeasurementStatus.PENDING_CONFIRMATION) => {
  if (value === null || value === undefined || value === '') return fallback
  const text = String(value).trim()
  if (!Object.values(SiteVariationMeasurementStatus).includes(text as SiteVariationMeasurementStatus)) {
    throw new Error('状态无效')
  }
  return text as SiteVariationMeasurementStatus
}

const parseChangeType = (value: unknown) => {
  if (value === null || value === undefined || value === '') return SiteVariationMeasurementType.OTHER
  const text = String(value).trim()
  if (!Object.values(SiteVariationMeasurementType).includes(text as SiteVariationMeasurementType)) {
    throw new Error('变更类型无效')
  }
  return text as SiteVariationMeasurementType
}

const parseReason = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  if (!Object.values(SiteVariationMeasurementReason).includes(text as SiteVariationMeasurementReason)) {
    throw new Error('变更原因无效')
  }
  return text as SiteVariationMeasurementReason
}

const parseSide = (value: unknown) => {
  const text = parseNullableText(value, 20)
  if (!text) return null
  const normalized = text.toUpperCase().replace(/[\s_\-/]+/g, '')
  const mapped = SIDE_ALIAS_MAP[normalized]
  if (!mapped) throw new Error('侧别无效')
  return mapped
}

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'y'].includes(text)) return true
    if (['0', 'false', 'no', 'n'].includes(text)) return false
  }
  return false
}

const parseWritePayload = (payload: Record<string, unknown>): SiteVariationMeasurementWriteInput => {
  const projectId = parsePositiveInt(payload.projectId, '项目')
  const startPk = parseNullableText(payload.startPk, 80)
  const endPk = parseNullableText(payload.endPk, 80)
  if ((startPk && !endPk) || (!startPk && endPk)) {
    throw new Error('起点桩号和终点桩号需同时填写或同时留空')
  }

  return {
    projectId,
    roadSectionId: parseNullableId(payload.roadSectionId, '路段'),
    mainRoadSectionId: parseNullableId(payload.mainRoadSectionId, '主路段'),
    boqItemId: parseNullableId(payload.boqItemId, '清单条目'),
    measurementDetailId: parseNullableId(payload.measurementDetailId, '计量明细'),
    status: parseStatus(payload.status),
    changeType: parseChangeType(payload.changeType),
    reason: parseReason(payload.reason),
    structureName: parseNullableText(payload.structureName, 200),
    phaseName: parseNullableText(payload.phaseName, 200),
    spec: parseNullableText(payload.spec, 120),
    unit: parseNullableText(payload.unit, 40),
    startPk,
    endPk,
    side: parseSide(payload.side),
    designDescription: parseNullableText(payload.designDescription, 4000),
    fieldDescription: parseNullableText(payload.fieldDescription, 4000),
    differenceDescription: parseNullableText(payload.differenceDescription, 4000),
    designQuantity: parseDecimal(payload.designQuantity, '图纸数量'),
    actualQuantity: parseDecimal(payload.actualQuantity, '现场数量'),
    deltaQuantity: parseDecimal(payload.deltaQuantity, '差异数量'),
    proposedQuantity: parseDecimal(payload.proposedQuantity, '拟计量数量'),
    unitPrice: parseDecimal(payload.unitPrice, '单价'),
    estimatedAmount: parseDecimal(payload.estimatedAmount, '预计金额'),
    occurredAt: parseDate(payload.occurredAt),
    discoveredByText: parseNullableText(payload.discoveredByText, 120),
    measurementPeriod: parseDate(payload.measurementPeriod),
    measuredAt: parseDate(payload.measuredAt),
    attachmentComplete: parseBoolean(payload.attachmentComplete),
    remark: parseNullableText(payload.remark, 4000),
  }
}

const parseSortField = (value: string | null): SiteVariationMeasurementSortField =>
  value && SORT_FIELDS.includes(value as SiteVariationMeasurementSortField)
    ? (value as SiteVariationMeasurementSortField)
    : 'occurredAt'

const parseSortDir = (value: string | null): SiteVariationMeasurementSortDir =>
  value === 'asc' ? 'asc' : 'desc'

const parseAttachmentState = (value: string | null): SiteVariationMeasurementAttachmentState =>
  value === 'withFiles' || value === 'withoutFiles' ? value : 'all'

export async function GET(request: NextRequest) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = request.nextUrl
  const projectIdRaw = Number(searchParams.get('projectId') ?? '0')
  const roadSectionIdRaw = Number(searchParams.get('roadSectionId') ?? '0')
  const boqItemIdRaw = Number(searchParams.get('boqItemId') ?? '0')

  try {
    const result = await listSiteVariationMeasurements({
      search: searchParams.get('search')?.trim() ?? '',
      projectId: Number.isInteger(projectIdRaw) && projectIdRaw > 0 ? projectIdRaw : null,
      roadSectionId: Number.isInteger(roadSectionIdRaw) && roadSectionIdRaw > 0 ? roadSectionIdRaw : null,
      boqItemId: Number.isInteger(boqItemIdRaw) && boqItemIdRaw > 0 ? boqItemIdRaw : null,
      status: searchParams.get('status')?.trim() ?? '',
      changeType: searchParams.get('changeType')?.trim() ?? '',
      attachmentState: parseAttachmentState(searchParams.get('attachmentState')),
      sortBy: parseSortField(searchParams.get('sortBy')),
      sortDir: parseSortDir(searchParams.get('sortDir')),
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: Number(searchParams.get('pageSize') ?? '20'),
    })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message || '加载现场变更计量台账失败', 500)
  }
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return respond('请先登录后再操作', 401)
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return respond('请求体格式错误', 400)
  }

  try {
    const input = parseWritePayload(payload)
    const item = await createSiteVariationMeasurement(input, sessionUser.id)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return respond((error as Error).message || '新增现场变更计量记录失败', 400)
  }
}

export async function PUT(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return respond('请先登录后再操作', 401)
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return respond('请求体格式错误', 400)
  }

  try {
    const id = parsePositiveInt(payload.id, '记录编号')
    const action = typeof payload.action === 'string' ? payload.action.trim() : ''

    if (action === 'status') {
      const status = parseStatus(payload.status)
      const item = await updateSiteVariationMeasurementStatus(id, status, sessionUser.id)
      return NextResponse.json({ item })
    }

    if (action === 'createMeasurementDetail') {
      const result = await createFormalMeasurementFromVariation(
        {
          id,
          boqItemId: parseNullableId(payload.boqItemId, '清单条目'),
          roadId: parseNullableId(payload.roadId, '路段'),
          period: parseDate(payload.period),
          quantity: parseDecimal(payload.quantity, '计量数量'),
          amount: parseDecimal(payload.amount, '计量金额'),
          note: parseNullableText(payload.note, 2000),
        },
        sessionUser.id,
      )
      return NextResponse.json(result)
    }

    const input = parseWritePayload(payload)
    const item = await updateSiteVariationMeasurement(id, input, sessionUser.id)
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message || '更新现场变更计量记录失败', 400)
  }
}

export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return respond('请先登录后再操作', 401)
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return respond('请求体格式错误', 400)
  }

  try {
    const id = parsePositiveInt(payload.id, '记录编号')
    const item = await updateSiteVariationMeasurementStatus(
      id,
      SiteVariationMeasurementStatus.VOID,
      sessionUser.id,
    )
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message || '作废现场变更计量记录失败', 400)
  }
}
