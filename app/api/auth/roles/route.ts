import { NextResponse } from 'next/server'

import { listRoles } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'

export async function GET() {
  const canViewRole =
    (await hasPermission('role:view')) ||
    (await hasPermission('role:create')) ||
    (await hasPermission('role:update')) ||
    (await hasPermission('role:delete')) ||
    (await hasPermission('role:manage'))
  if (!canViewRole) {
    return NextResponse.json({ message: '缺少角色查看权限' }, { status: 403 })
  }
  const roles = await listRoles()
  return NextResponse.json({ roles })
}
