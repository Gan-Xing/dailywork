import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { softDeleteFinanceEntry, updateFinanceEntry } from '@/lib/server/financeStore'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }

  let payload: {
    projectId?: number
    reason?: string
    categoryKey?: string
    amount?: number
    unitId?: number
    paymentTypeId?: number
    handlerId?: number | null
    paymentDate?: string
    tva?: number | null
    remark?: string | null
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const session = await getSessionUser()
    const entry = await updateFinanceEntry(id, payload, session?.id)
    return NextResponse.json({ entry })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }
  try {
    const session = await getSessionUser()
    await softDeleteFinanceEntry(id, session?.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
