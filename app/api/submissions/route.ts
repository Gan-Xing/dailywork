import { NextResponse } from 'next/server'

import { hasPermission, getSessionUser } from '@/lib/server/authSession'
import { createSubmission, listSubmissions } from '@/lib/server/inspectionEntryStore'

export async function GET() {
  if (!(await hasPermission('inspection:view'))) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const rows = await listSubmissions()
  return NextResponse.json({ items: rows })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:create'))) {
    return NextResponse.json({ message: '缺少报检权限' }, { status: 403 })
  }

  let payload: { code?: string; remark?: string; files?: unknown }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const submission = await createSubmission(payload.code, payload.remark, payload.files)
    return NextResponse.json({ submission })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
