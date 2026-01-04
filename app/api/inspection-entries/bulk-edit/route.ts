import { NextResponse } from 'next/server'

import type { InspectionStatus, IntervalSide } from '@prisma/client'
import { DocumentType } from '@prisma/client'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import { prisma } from '@/lib/prisma'

type PatchPayload = {
  phaseId?: number
  startPk?: number
  endPk?: number
  side?: IntervalSide
  layerName?: string
  checkName?: string
  types?: string[]
  status?: InspectionStatus
  documentId?: number | null
  submissionNumber?: number | null
  submissionOrder?: number | null
  remark?: string
  appointmentDate?: string
  submittedAt?: string
}

const parseOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const resolveDocumentId = async (payload: PatchPayload) => {
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
        throw new Error('提交单编号不存在，请重新输入')
      }
      if (targetDocumentId && targetDocumentId !== submission.documentId) {
        throw new Error('提交单编号与提交单 ID 不一致，请检查输入')
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
      throw new Error('提交单不存在，请重新选择')
    }
  }

  return bindingProvided ? targetDocumentId ?? null : undefined
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量编辑报检' }, { status: 401 })
  }
  const [canBulkEdit, canCreate] = await Promise.all([
    hasPermission('inspection:bulk-edit'),
    hasPermission('inspection:create'),
  ])
  if (!canBulkEdit || !canCreate) {
    return NextResponse.json({ message: '缺少报检批量编辑权限' }, { status: 403 })
  }

  let body: { ids?: unknown; payload?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0) : []
  const payload = (body.payload ?? {}) as PatchPayload

  if (!ids.length) return NextResponse.json({ message: '请选择需要更新的报检明细' }, { status: 400 })

  const seedEntries = await prisma.inspectionEntry.findMany({
    where: { id: { in: ids } },
    select: { roadId: true, phaseId: true, side: true, startPk: true, endPk: true, documentId: true },
  })
  if (!seedEntries.length) {
    return NextResponse.json({ message: '未找到需要更新的报检明细' }, { status: 404 })
  }
  const groupMap = new Map<
    string,
    { roadId: number; phaseId: number; side: IntervalSide; startPk: number; endPk: number; documentId: number | null }
  >()
  seedEntries.forEach((entry) => {
    const key = `${entry.roadId}:${entry.phaseId}:${entry.side}:${entry.startPk}:${entry.endPk}:${entry.documentId ?? 'null'}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        roadId: entry.roadId,
        phaseId: entry.phaseId,
        side: entry.side,
        startPk: entry.startPk,
        endPk: entry.endPk,
        documentId: entry.documentId ?? null,
      })
    }
  })
  const groupFilters = Array.from(groupMap.values()).map((entry) => ({
    roadId: entry.roadId,
    phaseId: entry.phaseId,
    side: entry.side,
    startPk: entry.startPk,
    endPk: entry.endPk,
    documentId: entry.documentId,
  }))
  const groupedEntries = await prisma.inspectionEntry.findMany({
    where: { OR: groupFilters },
    select: { id: true },
  })
  const expandedIds = groupedEntries.map((entry) => entry.id)
  if (!expandedIds.length) {
    return NextResponse.json({ message: '未找到需要更新的报检明细' }, { status: 404 })
  }

  const hasAnyField = Object.values(payload).some((value) => value !== undefined && value !== '')
  if (!hasAnyField) {
    return NextResponse.json({ message: '请至少填写一个需要批量修改的字段' }, { status: 400 })
  }

  let resolvedDocumentId: number | null | undefined
  try {
    resolvedDocumentId = await resolveDocumentId(payload)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }

  const hasSubmissionNumberField = Object.prototype.hasOwnProperty.call(payload as any, 'submissionNumber')
  const hasSubmissionOrderField = Object.prototype.hasOwnProperty.call(payload as any, 'submissionOrder')
  const parsedSubmissionNumber = parseOptionalNumber(payload.submissionNumber)
  const normalizedSubmissionOrder = hasSubmissionOrderField
    ? payload.submissionOrder === null
      ? null
      : payload.submissionOrder === undefined
        ? undefined
        : payload.submissionOrder
    : hasSubmissionNumberField
      ? parsedSubmissionNumber
      : undefined

  const normalizedPatch: PatchPayload = {
    ...payload,
    documentId: resolvedDocumentId,
    submissionNumber: undefined,
    submissionOrder: normalizedSubmissionOrder,
    layerName: payload.layerName ? canonicalizeProgressList('layer', [payload.layerName]).at(0) : undefined,
    checkName: payload.checkName ? canonicalizeProgressList('check', [payload.checkName]).at(0) : undefined,
    types: payload.types ? canonicalizeProgressList('type', payload.types) : undefined,
  }

  try {
    const updates = await prisma.$transaction(
      expandedIds.map((id) =>
        prisma.inspectionEntry.update({
          where: { id },
          data: {
            phaseId: normalizedPatch.phaseId,
            side: normalizedPatch.side,
            startPk: normalizedPatch.startPk,
            endPk: normalizedPatch.endPk,
            layerName: normalizedPatch.layerName,
            checkName: normalizedPatch.checkName,
            types: normalizedPatch.types,
            status: normalizedPatch.status,
            documentId:
              normalizedPatch.documentId === undefined ? undefined : normalizedPatch.documentId,
            submissionOrder:
              normalizedPatch.submissionOrder === undefined ? undefined : normalizedPatch.submissionOrder ?? null,
            remark: normalizedPatch.remark,
            appointmentDate: normalizedPatch.appointmentDate ? new Date(normalizedPatch.appointmentDate) : undefined,
            submittedAt: normalizedPatch.submittedAt ? new Date(normalizedPatch.submittedAt) : undefined,
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
        }),
      ),
    )
    return NextResponse.json({ items: updates })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
