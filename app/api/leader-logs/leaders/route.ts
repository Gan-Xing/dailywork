import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listLeaderUsers } from '@/lib/server/leaderLogStore'

const canViewLeaderLogs = async () =>
  (await hasPermission('report:view')) || (await hasPermission('report:edit'))

export async function GET() {
  if (!(await canViewLeaderLogs())) {
    return NextResponse.json({ message: '缺少日志查看权限' }, { status: 403 })
  }

  const leaders = await listLeaderUsers()
  return NextResponse.json({ leaders })
}
