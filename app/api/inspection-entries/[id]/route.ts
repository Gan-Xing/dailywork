import { DocumentType } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import type { InspectionEntryPayload } from '@/lib/progressTypes'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const parseOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('inspection:view'))) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  const row = await prisma.inspectionEntry.findUnique({
    where: { id },
    include: {
      road: true,
      phase: true,
      document: { include: { submission: true } },
      submitter: true,
      creator: true,
      updater: true,
    },
  })
  if (!row) return NextResponse.json({ message: '报检记录不存在或已删除' }, { status: 404 })
  return NextResponse.json({ entry: row })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再编辑报检' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:create'))) {
    return NextResponse.json({ message: '缺少报检编辑权限' }, { status: 403 })
  }

  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  }

  let payload: InspectionEntryPayload
  try {
    payload = (await request.json()) as InspectionEntryPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const layerName = canonicalizeProgressList('layer', [payload.layerName ?? '']).at(0)
  const checkName = canonicalizeProgressList('check', [payload.checkName ?? '']).at(0)
  const types = canonicalizeProgressList('type', payload.types ?? [])
  if (!layerName || !checkName || !types.length) {
    return NextResponse.json({ message: '层次/验收内容/验收类型均不能为空' }, { status: 400 })
  }

  const hasDocumentIdField =
    Object.prototype.hasOwnProperty.call(payload as any, 'documentId') ||
    Object.prototype.hasOwnProperty.call(payload as any, 'submissionId')
  const parsedDocumentId = parseOptionalNumber((payload as any).documentId ?? (payload as any).submissionId)
  const hasSubmissionNumberField = Object.prototype.hasOwnProperty.call(payload as any, 'submissionNumber')
  const parsedSubmissionNumber = parseOptionalNumber((payload as any).submissionNumber)
  let targetDocumentId = parsedDocumentId
  const bindingProvided = hasDocumentIdField || hasSubmissionNumberField

  if (hasSubmissionNumberField) {
    if (parsedSubmissionNumber === null) {
      targetDocumentId = targetDocumentId ?? null
    } else {
      const submission = await prisma.submission.findUnique({
        where: { submissionNumber: parsedSubmissionNumber },
        select: { documentId: true },
      })
      if (!submission) {
        return NextResponse.json({ message: '提交单编号不存在，请重新输入' }, { status: 400 })
      }
      if (targetDocumentId && targetDocumentId !== submission.documentId) {
        return NextResponse.json({ message: '提交单编号与提交单 ID 不一致，请检查输入' }, { status: 400 })
      }
      targetDocumentId = submission.documentId
    }
  }

  if (hasDocumentIdField && parsedDocumentId !== null) {
    const exists = await prisma.document.findFirst({
      where: { id: parsedDocumentId, type: DocumentType.SUBMISSION },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json({ message: '提交单不存在，请重新选择' }, { status: 400 })
    }
  }
  const documentId = bindingProvided ? targetDocumentId ?? null : undefined
  const submissionOrder =
    payload.submissionOrder === null
      ? null
      : payload.submissionOrder === undefined
        ? hasSubmissionNumberField
          ? parsedSubmissionNumber
          : undefined
        : Number(payload.submissionOrder)

  try {
    const updated = await prisma.inspectionEntry.update({
      where: { id },
      data: {
        documentId: documentId === undefined ? undefined : documentId,
        roadId: payload.roadId,
        phaseId: payload.phaseId,
        side: payload.side,
        startPk: Number(payload.startPk),
        endPk: Number(payload.endPk),
        layerId: payload.layerId ?? undefined,
        layerName,
        checkId: payload.checkId ?? undefined,
        checkName,
        types,
        status: payload.status as any,
        appointmentDate: payload.appointmentDate ? new Date(payload.appointmentDate) : undefined,
        remark: payload.remark,
        submissionOrder,
        submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : undefined,
        updatedBy: sessionUser.id,
      },
      include: {
        road: true,
        phase: true,
        document: { include: { submission: true } },
        submitter: true,
        creator: true,
        updater: true,
      },
    })
    return NextResponse.json({ entry: updated })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再删除报检' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:create'))) {
    return NextResponse.json({ message: '缺少报检删除权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: '报检 ID 无效' }, { status: 400 })
  }
  try {
    await prisma.inspectionEntry.delete({ where: { id } })
    return NextResponse.json({ message: '报检已删除' })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
