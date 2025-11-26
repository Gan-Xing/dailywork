import { NextResponse } from 'next/server'

import { listReports } from '@/lib/server/reportStore'
import { hasPermission } from '@/lib/server/authSession'

export async function GET(request: Request) {
  if (!hasPermission('report:view') && !hasPermission('report:edit')) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : null

  if (limitParam && Number.isNaN(limit)) {
    return NextResponse.json({ message: 'Invalid limit parameter' }, { status: 400 })
  }

  try {
    const reports = await listReports({ month, limit })
    return NextResponse.json({ reports })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
