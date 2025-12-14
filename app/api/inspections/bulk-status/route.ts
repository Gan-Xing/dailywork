import { NextResponse } from 'next/server'

import type { InspectionStatus } from '@/lib/progressTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量修改报检状态' }, { status: 401 })
  }
  const [canBulkEdit, canCreate] = await Promise.all([
    hasPermission('inspection:bulk-edit'),
    hasPermission('inspection:create'),
  ])
  if (!canBulkEdit || !canCreate) {
    return NextResponse.json({ message: '缺少报检批量编辑权限' }, { status: 403 })
  }

  let body: { ids?: unknown; status?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0) : []
  const status = body.status as InspectionStatus | undefined

  if (!status) {
    return NextResponse.json({ message: '请选择要更新的状态' }, { status: 400 })
  }
  if (!ids.length) {
    return NextResponse.json({ message: '请选择需要更新的报检明细' }, { status: 400 })
  }

  try {
    const updates = await prisma.$transaction(
      ids.map((id) =>
        prisma.inspectionEntry.update({
          where: { id },
          data: { status, updatedBy: sessionUser.id },
          include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
        }),
      ),
    )
    return NextResponse.json({ items: updates })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
