import { NextResponse, type NextRequest } from 'next/server'
import { Prisma, ReceivedDocumentLedgerStatus } from '@prisma/client'

import {
  isReceivedDocumentLedgerCategory,
  isReceivedDocumentLedgerStatus,
} from '@/lib/documents/receivedLedger'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  deleteReceivedDocumentLedger,
  type ReceivedDocumentLedgerWriteInput,
  updateReceivedDocumentLedger,
} from '@/lib/server/receivedDocumentLedgerStore'

const parsePositiveInt = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

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

const canUpdateLedger = async () => {
  const [canUpdate, canManage] = await Promise.all([
    hasPermission('file:update'),
    hasPermission('file:manage'),
  ])
  return canUpdate || canManage
}

const canDeleteLedger = async () => {
  const [canDelete, canManage] = await Promise.all([
    hasPermission('file:delete'),
    hasPermission('file:manage'),
  ])
  return canDelete || canManage
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await canUpdateLedger())) {
    return NextResponse.json({ message: '缺少台账编辑权限' }, { status: 403 })
  }

  const { id } = await params
  const rowId = Number(id)
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return NextResponse.json({ message: '台账编号无效' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  try {
    const parsed = parseWritePayload(payload)
    const item = await updateReceivedDocumentLedger(rowId, parsed, sessionUser.id)
    return NextResponse.json({ item })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: '台账记录不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await canDeleteLedger())) {
    return NextResponse.json({ message: '缺少台账删除权限' }, { status: 403 })
  }

  const { id } = await params
  const rowId = Number(id)
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return NextResponse.json({ message: '台账编号无效' }, { status: 400 })
  }

  try {
    await deleteReceivedDocumentLedger(rowId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: '台账记录不存在' }, { status: 404 })
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
