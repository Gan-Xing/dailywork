import { NextResponse } from 'next/server'

import type { InspectionStatus } from '@/lib/progressTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateInspectionStatuses } from '@/lib/server/inspectionStore'

export async function POST(request: Request) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量修改报检状态' }, { status: 401 })
  }
  if (!hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检编辑权限' }, { status: 403 })
  }

  let body: { ids?: unknown; status?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? (body.ids as Array<number | string>) : []
  const status = body.status as InspectionStatus | undefined

  if (!status) {
    return NextResponse.json({ message: '请选择要更新的状态' }, { status: 400 })
  }

  try {
    const items = await updateInspectionStatuses(ids, status, sessionUser.id)
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
