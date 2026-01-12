import { NextResponse } from 'next/server'
import { DocumentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createLetter, listLettersByBoqItem, listLettersByProject } from '@/lib/server/letterStore'

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

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const boqItemParam = searchParams.get('boqItemId')
  const projectParam = searchParams.get('projectId')
  const boqItemId = boqItemParam ? Number(boqItemParam) : null
  const projectId = projectParam ? Number(projectParam) : null
  if (boqItemId !== null && (!Number.isInteger(boqItemId) || boqItemId <= 0)) {
    return respond('工程量清单条目无效', 400)
  }
  if (projectId !== null && (!Number.isInteger(projectId) || projectId <= 0)) {
    return respond('项目编号无效', 400)
  }
  if (!boqItemId && !projectId) {
    return respond('缺少查询条件', 400)
  }

  try {
    const letters = boqItemId
      ? await listLettersByBoqItem(boqItemId)
      : await listLettersByProject(projectId as number)
    const documentIds = letters.map((item) => String(item.documentId))
    const counts = documentIds.length
      ? await prisma.fileAssetLink.groupBy({
          by: ['entityId'],
          where: {
            entityType: 'document',
            entityId: { in: documentIds },
          },
          _count: { _all: true },
        })
      : []
    const countMap = new Map(counts.map((item) => [item.entityId, item._count._all]))
    const result = letters.map((letter) => ({
      ...letter,
      attachmentCount: countMap.get(String(letter.documentId)) ?? 0,
    }))
    return NextResponse.json({ letters: result })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载函件', 500)
  }
}

export async function POST(request: Request) {
  if (!(await hasPermission('value:update'))) {
    return respond('缺少产值更新权限', 403)
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
    issuedAt?: unknown
    receivedAt?: unknown
    remark?: unknown
    status?: unknown
  }

  const projectId = parsed.projectId === undefined ? null : Number(parsed.projectId)
  if (projectId !== null && (!Number.isInteger(projectId) || projectId <= 0)) {
    return respond('项目编号无效', 400)
  }
  const boqItemId =
    parsed.boqItemId === undefined || parsed.boqItemId === null || parsed.boqItemId === ''
      ? null
      : Number(parsed.boqItemId)
  if (boqItemId !== null && (!Number.isInteger(boqItemId) || boqItemId <= 0)) {
    return respond('工程量清单条目无效', 400)
  }
  if (!projectId && !boqItemId) {
    return respond('项目编号无效', 400)
  }

  const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
  if (!subject) {
    return respond('函件主题不能为空', 400)
  }

  let status: DocumentStatus | undefined
  let senderOrg: string | null | undefined
  let recipientOrg: string | null | undefined
  let issuedAt: Date | null | undefined
  let receivedAt: Date | null | undefined
  let remark: string | null | undefined

  try {
    status = parseStatus(parsed.status)
    senderOrg = parseOptionalText(parsed.senderOrg)
    recipientOrg = parseOptionalText(parsed.recipientOrg)
    issuedAt = parseOptionalDate(parsed.issuedAt)
    receivedAt = parseOptionalDate(parsed.receivedAt)
    remark = parseOptionalText(parsed.remark)
  } catch (error) {
    return respond((error as Error).message ?? '字段格式无效', 400)
  }

  try {
    const letter = await createLetter({
      projectId: projectId ?? undefined,
      boqItemId,
      subject,
      senderOrg,
      recipientOrg,
      issuedAt,
      receivedAt,
      remark,
      status,
      userId: sessionUser.id,
    })
    return NextResponse.json({ letter })
  } catch (error) {
    return respond((error as Error).message ?? '创建函件失败', 500)
  }
}
