import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  getLogExtractionConfig,
  getEffectiveLogExtractionPrompt,
  upsertLogExtractionConfig,
} from '@/lib/server/logExtractionStore'

const canView = async () => (await hasPermission('report:view')) || (await hasPermission('report:edit'))

export async function GET() {
  if (!(await canView())) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }

  const config = await getLogExtractionConfig()
  const promptText = await getEffectiveLogExtractionPrompt()

  return NextResponse.json({
    promptText,
    updatedAt: config?.updatedAt?.toISOString() ?? null,
    updatedById: config?.updatedById ?? null,
    source: config ? 'stored' : 'default',
  })
}

export async function PUT(request: Request) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日报编辑权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再更新配置' }, { status: 401 })
  }

  let payload: { promptText?: unknown }
  try {
    payload = (await request.json()) as { promptText?: unknown }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const promptText = typeof payload.promptText === 'string' ? payload.promptText : ''

  const record = await upsertLogExtractionConfig(promptText, sessionUser.id)

  return NextResponse.json({
    promptText: record.promptText,
    updatedAt: record.updatedAt.toISOString(),
    updatedById: record.updatedById,
  })
}
