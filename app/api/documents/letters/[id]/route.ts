import { NextResponse } from 'next/server'
import { DocumentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateLetter } from '@/lib/server/letterStore'

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('submission:update'))) {
    return respond('缺少函件更新权限', 403)
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return respond('请先登录', 401)
  }

  const { id } = await params
  const letterId = Number(id)
  if (!Number.isInteger(letterId) || letterId <= 0) {
    return respond('函件编号无效', 400)
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
    subject?: unknown
    senderOrg?: unknown
    recipientOrg?: unknown
    senderName?: unknown
    recipientName?: unknown
    issuedAt?: unknown
    receivedAt?: unknown
    remark?: unknown
    status?: unknown
    boqItemId?: unknown
    documentCode?: unknown
    content?: unknown
  }

  let status: DocumentStatus | undefined
  let senderOrg: string | null | undefined
  let recipientOrg: string | null | undefined
  let senderName: string | null | undefined
  let recipientName: string | null | undefined
  let issuedAt: Date | null | undefined
  let receivedAt: Date | null | undefined
  let remark: string | null | undefined
  let boqItemId: number | null | undefined
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
    if (Object.prototype.hasOwnProperty.call(parsed, 'boqItemId')) {
      if (parsed.boqItemId === null || parsed.boqItemId === '') {
        boqItemId = null
      } else {
        const parsedId = Number(parsed.boqItemId)
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
          throw new Error('工程量清单条目无效')
        }
        boqItemId = parsedId
      }
    }
  } catch (error) {
    return respond((error as Error).message ?? '字段格式无效', 400)
  }

  const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : undefined

  try {
    const letter = await updateLetter(letterId, {
      subject: subject && subject.length ? subject : undefined,
      senderOrg,
      recipientOrg,
      senderName,
      recipientName,
      issuedAt,
      receivedAt,
      remark,
      status,
      boqItemId,
      documentCode,
      content,
      userId: sessionUser.id,
    })
    return NextResponse.json({ letter })
  } catch (error) {
    return respond((error as Error).message ?? '更新函件失败', 500)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('submission:delete'))) {
    return respond('缺少函件删除权限', 403)
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return respond('请先登录', 401)
  }

  const { id } = await params
  const letterId = Number(id)
  if (!Number.isInteger(letterId) || letterId <= 0) {
    return respond('函件编号无效', 400)
  }

  try {
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
      select: { documentId: true },
    })
    if (!letter) {
      return respond('函件不存在', 404)
    }
    await prisma.document.delete({ where: { id: letter.documentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return respond((error as Error).message ?? '删除函件失败', 500)
  }
}
