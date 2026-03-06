import { NextResponse, type NextRequest } from 'next/server'
import { ReceivedDocumentLedgerStatus } from '@prisma/client'

import {
  isReceivedDocumentLedgerCategory,
  isReceivedDocumentLedgerStatus,
} from '@/lib/documents/receivedLedger'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  createReceivedDocumentLedger,
  type ReceivedDocumentLedgerAttachmentState,
  listReceivedDocumentLedgers,
  type ReceivedDocumentLedgerSortDir,
  type ReceivedDocumentLedgerSortField,
  type ReceivedDocumentLedgerWriteInput,
} from '@/lib/server/receivedDocumentLedgerStore'

const parsePositiveInt = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const parsePositiveIntList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  )

const parseNullableString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`)
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const SORT_FIELDS: ReceivedDocumentLedgerSortField[] = [
  'id',
  'documentName',
  'projectName',
  'category',
  'status',
  'receivedAt',
  'updatedAt',
]

const parseSortField = (value: string | null): ReceivedDocumentLedgerSortField => {
  if (!value) return 'receivedAt'
  return SORT_FIELDS.includes(value as ReceivedDocumentLedgerSortField)
    ? (value as ReceivedDocumentLedgerSortField)
    : 'receivedAt'
}

const parseSortDir = (value: string | null): ReceivedDocumentLedgerSortDir =>
  value === 'asc' ? 'asc' : 'desc'

const parseAttachmentState = (value: string | null): ReceivedDocumentLedgerAttachmentState => {
  if (value === 'withMain' || value === 'withoutMain') return value
  return 'all'
}

const parseWritePayload = (payload: Record<string, unknown>): ReceivedDocumentLedgerWriteInput => {
  const categoryRaw = typeof payload.category === 'string' ? payload.category.trim() : ''
  if (!categoryRaw || !isReceivedDocumentLedgerCategory(categoryRaw)) {
    throw new Error('文件分类无效')
  }

  const projectId = parsePositiveInt(payload.projectId)
  if (!projectId) {
    throw new Error('请选择有效项目')
  }

  const documentName = typeof payload.documentName === 'string' ? payload.documentName.trim() : ''
  if (!documentName) {
    throw new Error('图纸名称不能为空')
  }

  const receivedAt = parseDate(payload.receivedAt)
  if (!receivedAt) {
    throw new Error('接收日期无效')
  }

  const statusRaw =
    typeof payload.status === 'string' && payload.status.trim()
      ? payload.status.trim()
      : ReceivedDocumentLedgerStatus.RECEIVED
  if (!isReceivedDocumentLedgerStatus(statusRaw)) {
    throw new Error('状态无效')
  }

  const roadSectionId = payload.roadSectionId === null ? null : parsePositiveInt(payload.roadSectionId)
  if (payload.roadSectionId !== null && payload.roadSectionId !== undefined && !roadSectionId) {
    throw new Error('路段无效')
  }

  const receivedById = payload.receivedById === null ? null : parsePositiveInt(payload.receivedById)
  if (payload.receivedById !== null && payload.receivedById !== undefined && !receivedById) {
    throw new Error('接收人无效')
  }

  return {
    category: categoryRaw,
    projectId,
    roadSectionId,
    structureName: parseNullableString(payload.structureName),
    sizeSpec: parseNullableString(payload.sizeSpec),
    versionTag: parseNullableString(payload.versionTag),
    documentName,
    documentCode: parseNullableString(payload.documentCode),
    coverageScope: parseNullableString(payload.coverageScope),
    sourceOrg: parseNullableString(payload.sourceOrg),
    receivedAt,
    receivedById,
    receivedByText: parseNullableString(payload.receivedByText),
    status: statusRaw,
    remark: parseNullableString(payload.remark),
  }
}

const canViewLedger = async () => {
  const [canView, canManage] = await Promise.all([
    hasPermission('file:view'),
    hasPermission('file:manage'),
  ])
  return canView || canManage
}

const canCreateLedger = async () => {
  const [canUpload, canUpdate, canManage] = await Promise.all([
    hasPermission('file:upload'),
    hasPermission('file:update'),
    hasPermission('file:manage'),
  ])
  return canUpload || canUpdate || canManage
}

export async function GET(request: NextRequest) {
  if (!(await canViewLedger())) {
    return NextResponse.json({ message: '缺少台账查看权限' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const page = Number(searchParams.get('page') ?? '1')
  const pageSize = Number(searchParams.get('pageSize') ?? '20')
  const projectIdRaw = Number(searchParams.get('projectId') ?? '0')
  const roadSectionIdRaw = Number(searchParams.get('roadSectionId') ?? '0')

  const result = await listReceivedDocumentLedgers({
    search: searchParams.get('search')?.trim() ?? '',
    category: searchParams.get('category')?.trim() ?? '',
    status: searchParams.get('status')?.trim() ?? '',
    attachmentState: parseAttachmentState(searchParams.get('attachmentState')),
    excludeProjectIds: parsePositiveIntList(searchParams.getAll('excludeProjectId')),
    projectId: Number.isInteger(projectIdRaw) && projectIdRaw > 0 ? projectIdRaw : null,
    roadSectionId: Number.isInteger(roadSectionIdRaw) && roadSectionIdRaw > 0 ? roadSectionIdRaw : null,
    sortBy: parseSortField(searchParams.get('sortBy')),
    sortDir: parseSortDir(searchParams.get('sortDir')),
    page,
    pageSize,
  })

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await canCreateLedger())) {
    return NextResponse.json({ message: '缺少台账新增权限' }, { status: 403 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  try {
    const parsed = parseWritePayload(payload)
    const item = await createReceivedDocumentLedger(parsed, sessionUser.id)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
