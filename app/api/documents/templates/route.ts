import { NextResponse } from 'next/server'

import { TemplateStatus } from '@prisma/client'

import { hasPermission, getSessionUser } from '@/lib/server/authSession'
import { archiveTemplate, createTemplate, listTemplates } from '@/lib/server/templateStore'

export async function GET() {
  if (!(await hasPermission('report:view'))) {
    return NextResponse.json({ message: '缺少查看权限' }, { status: 403 })
  }
  const items = await listTemplates()
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少编辑权限' }, { status: 403 })
  }
  let payload: { name?: string; html?: string; status?: TemplateStatus; language?: string; version?: number }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }
  if (!payload.name || !payload.html) {
    return NextResponse.json({ message: 'name 与 html 必填' }, { status: 400 })
  }
  try {
    const tpl = await createTemplate({
      name: payload.name,
      html: payload.html,
      status: payload.status,
      language: payload.language,
      version: payload.version,
      userId: sessionUser.id,
    })
    return NextResponse.json({ template: tpl })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

// 兼容原来的发布/归档操作，批量归档接口
export async function PATCH(request: Request) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少编辑权限' }, { status: 403 })
  }
  let payload: { id?: string; action?: 'archive' }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }
  if (!payload.id) {
    return NextResponse.json({ message: 'id 必填' }, { status: 400 })
  }
  if (payload.action !== 'archive') {
    return NextResponse.json({ message: '仅支持归档' }, { status: 400 })
  }
  await archiveTemplate(payload.id)
  return NextResponse.json({ ok: true })
}
