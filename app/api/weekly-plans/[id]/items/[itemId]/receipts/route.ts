import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  createWeeklyPlanReceipt,
  listWeeklyPlanReceipts,
} from '@/lib/server/weeklyPlanReceiptStore'

const parseParams = async (paramsPromise: Promise<{ id: string; itemId: string }>) => {
  const { id, itemId } = await paramsPromise
  return {
    planId: Number(id),
    itemIdNum: Number(itemId),
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ error: '缺少周计划查看权限' }, { status: 403 })
  }

  const { planId, itemIdNum } = await parseParams(params)
  if (!Number.isFinite(planId) || !Number.isFinite(itemIdNum)) {
    return NextResponse.json({ error: '缺少周计划明细 ID' }, { status: 400 })
  }

  try {
    const receipts = await listWeeklyPlanReceipts(planId, itemIdNum)
    return NextResponse.json({ receipts })
  } catch (error) {
    const message = (error as Error).message
    const status = message === '周计划明细不存在' ? 404 : 500
    return NextResponse.json({ error: message || '收货单加载失败' }, { status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const [canCreate, canUpdate] = await Promise.all([
    hasPermission('material:create'),
    hasPermission('material:update'),
  ])
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: '缺少周计划编辑权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { planId, itemIdNum } = await parseParams(params)
  if (!Number.isFinite(planId) || !Number.isFinite(itemIdNum)) {
    return NextResponse.json({ error: '缺少周计划明细 ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as
    | { storageKey?: unknown; originalName?: unknown; mimeType?: unknown; size?: unknown }
    | null

  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  try {
    const receipt = await createWeeklyPlanReceipt(
      planId,
      itemIdNum,
      {
        storageKey: typeof body.storageKey === 'string' ? body.storageKey.trim() : '',
        originalName: typeof body.originalName === 'string' ? body.originalName.trim() : '',
        mimeType: typeof body.mimeType === 'string' ? body.mimeType.trim() : '',
        size: typeof body.size === 'number' ? body.size : Number(body.size),
      },
      { createdById: session.id },
    )
    return NextResponse.json({ receipt }, { status: 201 })
  } catch (error) {
    const message = (error as Error).message
    const status = message === '周计划明细不存在' ? 404 : 400
    return NextResponse.json({ error: message || '收货单上传失败' }, { status })
  }
}
