import { NextResponse } from 'next/server'

import { listUsers } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'

export async function GET() {
  if (!(await hasPermission('member:view'))) {
    return NextResponse.json({ message: '缺少成员查看权限' }, { status: 403 })
  }
  const canManageRole = await hasPermission('role:manage')
  const users = await listUsers()
  const payload = canManageRole ? users : users.map((user) => ({ ...user, roles: [] }))
  return NextResponse.json({ users: payload })
}
