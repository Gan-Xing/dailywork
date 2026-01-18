import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { listLeaderUsers } from '@/lib/server/leaderLogStore'

const canViewLeaderLogs = async () =>
  (await hasPermission('report:view')) || (await hasPermission('report:edit'))

const canViewAllLeaderLogs = async () =>
  (await hasPermission('leader-log:view-all')) || (await hasPermission('leader-log:edit-all'))

export async function GET() {
  if (!(await canViewLeaderLogs())) {
    return NextResponse.json({ message: '缺少日志查看权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再查看日志' }, { status: 401 })
  }

  const leaders = await listLeaderUsers()
  const canViewAll = await canViewAllLeaderLogs()
  const visibleLeaders = canViewAll
    ? leaders
    : leaders.filter((leader) => leader.id === sessionUser.id)

  return NextResponse.json({ leaders: visibleLeaders })
}
