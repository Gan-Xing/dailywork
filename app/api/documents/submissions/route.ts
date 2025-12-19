import { NextResponse } from 'next/server'

import { DocumentStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { listSubmissionDocs, createSubmissionDoc } from '@/lib/server/submissionDocStore'

export async function GET() {
  if (!(await hasPermission('report:view'))) {
    return NextResponse.json({ message: '缺少查看权限' }, { status: 403 })
  }
  const items = await listSubmissionDocs()
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少编辑权限' }, { status: 403 })
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
    const submission = await createSubmissionDoc(
      {
        title: payload.title ?? null,
        status: payload.status ?? DocumentStatus.DRAFT,
        data: payload.data ?? null,
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
