import { NextResponse } from 'next/server'

import type { InspectionBulkPayload } from '@/lib/progressTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateInspectionsBulk } from '@/lib/server/inspectionStore'

export async function POST(request: Request) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量编辑报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:bulk-edit') || !hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检批量编辑权限' }, { status: 403 })
  }

  let body: { ids?: unknown; payload?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? (body.ids as Array<number | string>) : []
  const payload = (body.payload ?? {}) as InspectionBulkPayload

  try {
    const items = await updateInspectionsBulk(ids, payload, sessionUser.id)
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
