import { NextResponse, type NextRequest } from 'next/server'
import { Prisma, SiteVariationRawRecordStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  createSiteVariationRawRecord,
  createSiteVariationRawRecords,
  listSiteVariationRawRecords,
  type SiteVariationRawRecordSortDir,
  type SiteVariationRawRecordSortField,
  type SiteVariationRawRecordWriteInput,
  updateSiteVariationRawRecord,
  updateSiteVariationRawRecordStatus,
} from '@/lib/server/siteVariationRawRecordStore'

const SORT_FIELDS: SiteVariationRawRecordSortField[] = [
  'id',
  'recordDate',
  'updatedAt',
  'status',
  'projectName',
]

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

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

const parseRequiredText = (value: unknown, label: string, maxLength: number) => {
  const text = parseNullableText(value, maxLength)
  if (!text) throw new Error(`${label}不能为空`)
  return text
}

const parseDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const text = String(value).trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00.000Z`)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('日期格式无效')
  }
  return parsed
}

const parseStatus = (
  value: unknown,
  fallback = SiteVariationRawRecordStatus.PENDING_REVIEW,
) => {
  if (value === null || value === undefined || value === '') return fallback
  const text = String(value).trim()
  if (!Object.values(SiteVariationRawRecordStatus).includes(text as SiteVariationRawRecordStatus)) {
    throw new Error('状态无效')
  }
  return text as SiteVariationRawRecordStatus
}

const parseJson = (value: unknown): Prisma.InputJsonValue | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue
    } catch {
      throw new Error('提取字段必须是有效 JSON')
    }
  }
  if (typeof value === 'object' || typeof value === 'boolean' || typeof value === 'number') {
    return value as Prisma.InputJsonValue
  }
  throw new Error('提取字段必须是有效 JSON')
}

const parseWritePayload = (payload: Record<string, unknown>): SiteVariationRawRecordWriteInput => ({
  title: parseRequiredText(payload.title, '标题', 240),
  rawContent: parseRequiredText(payload.rawContent, '原始内容', 30000),
  recordDate: parseDate(payload.recordDate),
  projectId: parseNullableId(payload.projectId, '项目'),
  roadSectionId: parseNullableId(payload.roadSectionId, '路段'),
  status: parseStatus(payload.status),
  extractedJson: parseJson(payload.extractedJson),
  reviewNote: parseNullableText(payload.reviewNote, 4000),
  convertedVariationId: parseNullableId(payload.convertedVariationId, '正式变更记录'),
})

const parseSortField = (value: string | null): SiteVariationRawRecordSortField =>
  value && SORT_FIELDS.includes(value as SiteVariationRawRecordSortField)
    ? (value as SiteVariationRawRecordSortField)
    : 'id'

const parseSortDir = (value: string | null): SiteVariationRawRecordSortDir =>
  value === 'desc' ? 'desc' : 'asc'

const parsePayload = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    throw new Error('请求体格式错误')
  }
}

export async function GET(request: NextRequest) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = request.nextUrl
  const projectIdRaw = Number(searchParams.get('projectId') ?? '0')
  const roadSectionIdRaw = Number(searchParams.get('roadSectionId') ?? '0')

  try {
    const result = await listSiteVariationRawRecords({
      search: searchParams.get('search')?.trim() ?? '',
      projectId: Number.isInteger(projectIdRaw) && projectIdRaw > 0 ? projectIdRaw : null,
      roadSectionId: Number.isInteger(roadSectionIdRaw) && roadSectionIdRaw > 0 ? roadSectionIdRaw : null,
      status: searchParams.get('status')?.trim() ?? '',
      sortBy: parseSortField(searchParams.get('sortBy')),
      sortDir: parseSortDir(searchParams.get('sortDir')),
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: Number(searchParams.get('pageSize') ?? '20'),
    })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message || '加载现场变更原始记录失败', 500)
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
    payload = await parsePayload(request)
  } catch (error) {
    return respond((error as Error).message, 400)
  }

  try {
    if (Array.isArray(payload.records)) {
      const records = payload.records.map((record) => {
        if (!record || typeof record !== 'object') throw new Error('批量记录格式无效')
        return parseWritePayload(record as Record<string, unknown>)
      })
      const items = await createSiteVariationRawRecords(records, sessionUser.id)
      return NextResponse.json({ items }, { status: 201 })
    }

    const input = parseWritePayload(payload)
    const item = await createSiteVariationRawRecord(input, sessionUser.id)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return respond((error as Error).message || '新增现场变更原始记录失败', 400)
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
    payload = await parsePayload(request)
  } catch (error) {
    return respond((error as Error).message, 400)
  }

  try {
    const id = parsePositiveInt(payload.id, '记录编号')
    const action = typeof payload.action === 'string' ? payload.action.trim() : ''
    if (action === 'status') {
      const item = await updateSiteVariationRawRecordStatus(id, parseStatus(payload.status), sessionUser.id)
      return NextResponse.json({ item })
    }

    const input = parseWritePayload(payload)
    const item = await updateSiteVariationRawRecord(id, input, sessionUser.id)
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message || '更新现场变更原始记录失败', 400)
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
    payload = await parsePayload(request)
  } catch (error) {
    return respond((error as Error).message, 400)
  }

  try {
    const id = parsePositiveInt(payload.id, '记录编号')
    const item = await updateSiteVariationRawRecordStatus(id, SiteVariationRawRecordStatus.VOID, sessionUser.id)
    return NextResponse.json({ item })
  } catch (error) {
    return respond((error as Error).message || '作废现场变更原始记录失败', 400)
  }
}
