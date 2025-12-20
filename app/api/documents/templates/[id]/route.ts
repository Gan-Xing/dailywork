import { NextResponse } from 'next/server'

import { TemplateStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { archiveTemplate, deleteTemplate, getTemplate, updateTemplate } from '@/lib/server/templateStore'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const [canView, canUpdate] = await Promise.all([
    hasPermission('template:view'),
    hasPermission('template:update'),
  ])
  if (!canView && !canUpdate) {
    return NextResponse.json({ message: '缺少模板查看权限' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ message: 'id 必填' }, { status: 400 })
  const tpl = await getTemplate(id)
  if (!tpl) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json({ template: tpl })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('template:update'))) {
    return NextResponse.json({ message: '缺少模板编辑权限' }, { status: 403 })
  }
  if (!id) {
    return NextResponse.json({ message: 'id 必填' }, { status: 400 })
  }
  let payload: { name?: string; html?: string; status?: TemplateStatus; language?: string; version?: number }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }
  try {
    const tpl = await updateTemplate(id, { ...payload, userId: sessionUser.id })
    return NextResponse.json({ template: tpl })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!(await hasPermission('template:delete'))) {
    return NextResponse.json({ message: '缺少模板删除权限' }, { status: 403 })
  }
  await archiveTemplate(id)
  return NextResponse.json({ ok: true })
}
