import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createFinanceEntry, listFinanceEntries } from '@/lib/server/financeStore'

export async function GET(request: Request) {
  if (!hasPermission('finance:view')) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const projectIdParam = searchParams.get('projectId')
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const projectId = projectIdParam ? Number(projectIdParam) : undefined

  try {
    const entries = await listFinanceEntries({ projectId, includeDeleted })
    return NextResponse.json({ entries })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!hasPermission('finance:edit')) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
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

  if (
    !payload.projectId ||
    !payload.reason ||
    !payload.categoryKey ||
    payload.amount === undefined ||
    payload.unitId === undefined ||
    payload.paymentTypeId === undefined ||
    !payload.paymentDate
  ) {
    return NextResponse.json({ message: '缺少必填字段' }, { status: 400 })
  }

  try {
    const session = getSessionUser()
    const entry = await createFinanceEntry(
      {
        projectId: Number(payload.projectId),
        reason: payload.reason,
        categoryKey: payload.categoryKey,
        amount: Number(payload.amount),
        unitId: Number(payload.unitId),
        paymentTypeId: Number(payload.paymentTypeId),
        paymentDate: payload.paymentDate,
        tva: payload.tva == null ? null : Number(payload.tva),
        remark: payload.remark ?? null,
      },
      session?.id,
    )
    return NextResponse.json({ entry })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
