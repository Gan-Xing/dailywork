import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { buildFileStorageKey, createPresignedUrl } from '@/lib/server/r2'
import {
  assertWeeklyPlanReceiptTarget,
  validateWeeklyPlanReceiptUploadRequest,
  WEEKLY_PLAN_RECEIPT_CATEGORY,
} from '@/lib/server/weeklyPlanReceiptStore'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params
  const planId = Number(id)
  const itemIdNum = Number(itemId)

  if (!Number.isFinite(planId) || !Number.isFinite(itemIdNum)) {
    return NextResponse.json({ error: '缺少周计划明细 ID' }, { status: 400 })
  }

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

  const body = (await request.json().catch(() => null)) as
    | { filename?: unknown; contentType?: unknown; size?: unknown }
    | null
  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  try {
    await assertWeeklyPlanReceiptTarget(planId, itemIdNum)
    const { safeFilename, safeContentType } = validateWeeklyPlanReceiptUploadRequest({
      filename: typeof body.filename === 'string' ? body.filename : String(body.filename ?? ''),
      contentType:
        typeof body.contentType === 'string' ? body.contentType : String(body.contentType ?? ''),
      size: typeof body.size === 'number' ? body.size : Number(body.size),
    })

    const storageKey = buildFileStorageKey(WEEKLY_PLAN_RECEIPT_CATEGORY, safeFilename)
    const uploadUrl = createPresignedUrl({
      method: 'PUT',
      storageKey,
      expiresInSeconds: 600,
    })

    return NextResponse.json({
      uploadUrl,
      storageKey,
      requiredHeaders: {
        'Content-Type': safeContentType,
      },
    })
  } catch (error) {
    const message = (error as Error).message
    const status = message === '周计划明细不存在' ? 404 : 400
    return NextResponse.json({ error: message || '收货单上传地址生成失败' }, { status })
  }
}
