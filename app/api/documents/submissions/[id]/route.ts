import { NextRequest, NextResponse } from 'next/server'

import { DocumentStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { findSubmissionDocByIdentifier, updateSubmissionDoc } from '@/lib/server/submissionDocStore'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await context.params
  const [canView, canUpdate] = await Promise.all([
    hasPermission('submission:view'),
    hasPermission('submission:update'),
  ])
  if (!canView && !canUpdate) {
    return NextResponse.json({ message: '缺少提交单查看权限' }, { status: 403 })
  }
  const submission = await findSubmissionDocByIdentifier(idParam)
  if (!submission) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ submission })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await context.params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('submission:update'))) {
    return NextResponse.json({ message: '缺少提交单编辑权限' }, { status: 403 })
  }

  let payload: {
    title?: string
    status?: DocumentStatus
    data?: unknown
    templateId?: string | null
    templateVersion?: number | null
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const existing = await findSubmissionDocByIdentifier(idParam)
    if (!existing) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }
    const submission = await updateSubmissionDoc(
      existing.id,
      {
        title: payload.title ?? undefined,
        status: payload.status ?? undefined,
        data: payload.data ?? undefined,
        templateId: payload.templateId ?? null,
        templateVersion: payload.templateVersion ?? null,
      },
      sessionUser.id,
    )
    return NextResponse.json({ submission })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
