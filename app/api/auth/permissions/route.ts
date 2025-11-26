import { NextResponse } from 'next/server'

import { listPermissions } from '@/lib/server/authStore'
import { hasPermission } from '@/lib/server/authSession'

export async function GET() {
  if (!hasPermission('permission:view')) {
    return NextResponse.json({ message: '缺少权限查看权限' }, { status: 403 })
  }
  const permissions = await listPermissions()
  return NextResponse.json({ permissions })
}
