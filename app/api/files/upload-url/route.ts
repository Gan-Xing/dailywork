import { NextResponse, type NextRequest } from 'next/server'

import { FILE_CATEGORIES } from '@/lib/constants/fileCategories'
import { hasPermission } from '@/lib/server/authSession'
import { buildFileStorageKey, createPresignedUrl } from '@/lib/server/r2'

export async function POST(request: NextRequest) {
  const [canUpload, canManage] = await Promise.all([
    hasPermission('file:upload'),
    hasPermission('file:manage'),
  ])
  if (!canUpload && !canManage) {
    return NextResponse.json({ error: '缺少文件上传权限' }, { status: 403 })
  }

  let body: { filename?: unknown; contentType?: unknown; size?: unknown; category?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const parsedSize = typeof body.size === 'number' ? body.size : Number(body.size)

  if (!filename || !contentType || !category || !Number.isFinite(parsedSize)) {
    return NextResponse.json({ error: '文件信息不完整' }, { status: 400 })
  }
  if (!FILE_CATEGORIES.includes(category as (typeof FILE_CATEGORIES)[number])) {
    return NextResponse.json({ error: '文件分类不支持' }, { status: 400 })
  }

  const storageKey = buildFileStorageKey(category, filename)
  const uploadUrl = createPresignedUrl({
    method: 'PUT',
    storageKey,
    expiresInSeconds: 600,
  })

  return NextResponse.json({
    uploadUrl,
    storageKey,
    requiredHeaders: {
      'Content-Type': contentType,
    },
  })
}
