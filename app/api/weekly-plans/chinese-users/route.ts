import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listWeeklyPlanSignerUsers } from '@/lib/server/weeklyPlanSigners'

export async function GET() {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  try {
    const users = await listWeeklyPlanSignerUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[weekly-plans/chinese-users GET]', error)
    return NextResponse.json({ message: '查询失败' }, { status: 500 })
  }
}
