import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { parseFinanceFilters } from '@/lib/server/financeFilters'
import { getFinanceInsights } from '@/lib/server/financeStore'

export async function GET(request: Request) {
  if (!(await hasPermission('finance:view'))) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const filters = parseFinanceFilters(searchParams)

  try {
    const insights = await getFinanceInsights(filters)
    return NextResponse.json({ insights })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
