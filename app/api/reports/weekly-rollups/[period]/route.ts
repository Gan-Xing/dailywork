import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { getWeeklyRollup } from '@/lib/server/weeklyRollupStore'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ period: string }> }) {
  const [canView, canEdit] = await Promise.all([
    hasPermission('report:view'),
    hasPermission('report:edit'),
  ])

  if (!canView && !canEdit) {
    return NextResponse.json({ message: '缺少 report:view 权限' }, { status: 403 })
  }

  const { period } = await params
  const item = await getWeeklyRollup(decodeURIComponent(period))

  if (!item) {
    return NextResponse.json({ message: '未找到对应周报' }, { status: 404 })
  }

  return NextResponse.json({ item })
}
