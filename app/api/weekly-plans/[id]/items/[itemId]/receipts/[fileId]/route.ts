import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { deleteWeeklyPlanReceipt } from '@/lib/server/weeklyPlanReceiptStore'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; fileId: string }> },
) {
  const { id, itemId, fileId } = await params
  const planId = Number(id)
  const itemIdNum = Number(itemId)
  const fileIdNum = Number(fileId)

  if (!Number.isFinite(planId) || !Number.isFinite(itemIdNum) || !Number.isFinite(fileIdNum)) {
    return NextResponse.json({ error: '缺少收货单 ID' }, { status: 400 })
  }

  const [canCreate, canUpdate, canDelete] = await Promise.all([
    hasPermission('material:create'),
    hasPermission('material:update'),
    hasPermission('material:delete'),
  ])
  if (!canCreate && !canUpdate && !canDelete) {
    return NextResponse.json({ error: '缺少周计划编辑权限' }, { status: 403 })
  }

  try {
    await deleteWeeklyPlanReceipt(planId, itemIdNum, fileIdNum)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = (error as Error).message
    const status = message === '周计划明细不存在' || message === '收货单不存在' ? 404 : 400
    return NextResponse.json({ error: message || '收货单删除失败' }, { status })
  }
}
