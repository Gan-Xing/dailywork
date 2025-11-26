import { NextResponse } from 'next/server'

import { listRoles } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'

export async function GET() {
  if (!hasPermission('member:view')) {
    return NextResponse.json({ message: '缺少成员查看权限' }, { status: 403 })
  }
  const roles = await listRoles()
  return NextResponse.json({ roles })
}
