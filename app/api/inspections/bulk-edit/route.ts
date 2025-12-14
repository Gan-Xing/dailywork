import { NextResponse } from 'next/server'

import type { InspectionStatus, IntervalSide } from '@prisma/client'
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
  submissionId?: number | null
  submissionOrder?: number | null
  remark?: string
  appointmentDate?: string
  submittedAt?: string
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

  const hasAnyField = Object.values(payload).some((value) => value !== undefined && value !== '')
  if (!hasAnyField) {
    return NextResponse.json({ message: '请至少填写一个需要批量修改的字段' }, { status: 400 })
  }

  const normalizedPatch: PatchPayload = {
    ...payload,
    layerName: payload.layerName ? canonicalizeProgressList('layer', [payload.layerName]).at(0) : undefined,
    checkName: payload.checkName ? canonicalizeProgressList('check', [payload.checkName]).at(0) : undefined,
    types: payload.types ? canonicalizeProgressList('type', payload.types) : undefined,
  }

  try {
    const updates = await prisma.$transaction(
      ids.map((id) =>
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
            submissionId: normalizedPatch.submissionId ?? undefined,
            submissionOrder:
              normalizedPatch.submissionOrder === undefined ? undefined : normalizedPatch.submissionOrder ?? null,
            remark: normalizedPatch.remark,
            appointmentDate: normalizedPatch.appointmentDate ? new Date(normalizedPatch.appointmentDate) : undefined,
            submittedAt: normalizedPatch.submittedAt ? new Date(normalizedPatch.submittedAt) : undefined,
            updatedBy: sessionUser.id,
          },
          include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
        }),
      ),
    )
    return NextResponse.json({ items: updates })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
