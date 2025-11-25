import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { softDeleteFinanceEntry, updateFinanceEntry } from '@/lib/server/financeStore'

interface RouteParams {
  params: { id: string }
}

export async function PUT(request: Request, { params }: RouteParams) {
  if (!hasPermission('finance:edit')) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(params.id)
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
    const entry = await updateFinanceEntry(id, payload)
    return NextResponse.json({ entry })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!hasPermission('finance:edit')) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }
  try {
    const session = getSessionUser()
    await softDeleteFinanceEntry(id, session?.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
