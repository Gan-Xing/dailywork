import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listWeeklyRollups } from '@/lib/server/weeklyRollupStore'

export async function GET() {
  const [canView, canEdit] = await Promise.all([
    hasPermission('report:view'),
    hasPermission('report:edit'),
  ])

  if (!canView && !canEdit) {
    return NextResponse.json({ message: '缺少 report:view 权限' }, { status: 403 })
  }

  const items = await listWeeklyRollups()
  return NextResponse.json({ items })
}
