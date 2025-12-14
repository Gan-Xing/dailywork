import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量删除报检' }, { status: 401 })
  }
  const [canBulkEdit, canDelete] = await Promise.all([
    hasPermission('inspection:bulk-edit'),
    hasPermission('inspection:create'),
  ])
  if (!canBulkEdit || !canDelete) {
    return NextResponse.json({ message: '缺少报检批量删除权限' }, { status: 403 })
  }

  let body: { ids?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : []
  if (!ids.length) {
    return NextResponse.json({ message: '请选择需要删除的报检明细' }, { status: 400 })
  }

  try {
    const result = await prisma.inspectionEntry.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
