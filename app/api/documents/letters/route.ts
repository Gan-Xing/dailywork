import { NextResponse } from 'next/server'
import { DocumentStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createLetter } from '@/lib/server/letterStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const parseStatus = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return undefined
  if (value === 'DRAFT' || value === 'FINAL' || value === 'ARCHIVED') {
    return value as DocumentStatus
  }
  throw new Error('函件状态无效')
}

const parseOptionalText = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('字段格式无效')
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('日期格式无效')
  }
  return parsed
}

export async function POST(request: Request) {
  if (!(await hasPermission('submission:create'))) {
    return respond('缺少函件新增权限', 403)
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return respond('请先登录', 401)
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
    boqItemId?: unknown
    subject?: unknown
    senderOrg?: unknown
    recipientOrg?: unknown
    senderName?: unknown
    recipientName?: unknown
    issuedAt?: unknown
    receivedAt?: unknown
    remark?: unknown
    status?: unknown
    documentCode?: unknown
    content?: unknown
  }

  const projectId = Number(parsed.projectId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  const boqItemId =
    parsed.boqItemId === undefined || parsed.boqItemId === null || parsed.boqItemId === ''
      ? null
      : Number(parsed.boqItemId)
  if (boqItemId !== null && (!Number.isInteger(boqItemId) || boqItemId <= 0)) {
    return respond('工程量清单条目无效', 400)
  }

  const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
  if (!subject) {
    return respond('函件主题不能为空', 400)
  }

  let status: DocumentStatus | undefined
  let senderOrg: string | null | undefined
  let recipientOrg: string | null | undefined
  let senderName: string | null | undefined
  let recipientName: string | null | undefined
  let issuedAt: Date | null | undefined
  let receivedAt: Date | null | undefined
  let remark: string | null | undefined
  let documentCode: string | null | undefined
  let content: string | null | undefined

  try {
    status = parseStatus(parsed.status)
    senderOrg = parseOptionalText(parsed.senderOrg)
    recipientOrg = parseOptionalText(parsed.recipientOrg)
    senderName = parseOptionalText(parsed.senderName)
    recipientName = parseOptionalText(parsed.recipientName)
    issuedAt = parseOptionalDate(parsed.issuedAt)
    receivedAt = parseOptionalDate(parsed.receivedAt)
    remark = parseOptionalText(parsed.remark)
    documentCode = parseOptionalText(parsed.documentCode)
    content = parseOptionalText(parsed.content)
  } catch (error) {
    return respond((error as Error).message ?? '字段格式无效', 400)
  }

  try {
    const letter = await createLetter({
      projectId,
      boqItemId,
      subject,
      senderOrg,
      recipientOrg,
      senderName,
      recipientName,
      issuedAt,
      receivedAt,
      remark,
      status,
      documentCode,
      content,
      userId: sessionUser.id,
    })
    return NextResponse.json({ letter })
  } catch (error) {
    return respond((error as Error).message ?? '创建函件失败', 500)
  }
}
