import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { parseFinanceLedgerFilters } from '@/lib/server/financeLedgerFilters'
import { createFinanceLedgerCase, listFinanceLedgerCases } from '@/lib/server/financeLedgerStore'

export async function GET(request: Request) {
  if (!(await hasPermission('finance:view'))) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filters = parseFinanceLedgerFilters(searchParams)

  try {
    const result = await listFinanceLedgerCases(filters)
    return NextResponse.json({
      cases: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }

  let payload: {
    projectId?: unknown
    periodIndex?: unknown
    sectionId?: unknown
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const projectId = Number(payload.projectId)
  const periodIndex = Number(payload.periodIndex)
  const sectionIdRaw = payload.sectionId
  const sectionId =
    sectionIdRaw === null || sectionIdRaw === undefined || sectionIdRaw === ''
      ? null
      : Number(sectionIdRaw)

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ message: 'projectId 无效' }, { status: 400 })
  }
  if (!Number.isInteger(periodIndex) || periodIndex < 0) {
    return NextResponse.json({ message: 'periodIndex 无效' }, { status: 400 })
  }
  if (sectionId !== null && (!Number.isInteger(sectionId) || sectionId <= 0)) {
    return NextResponse.json({ message: 'sectionId 无效' }, { status: 400 })
  }

  try {
    const session = await getSessionUser()
    const ledgerCase = await createFinanceLedgerCase(
      {
        projectId,
        periodIndex,
        sectionId,
      },
      session?.id,
    )
    return NextResponse.json({ case: ledgerCase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

