import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listCheckDefinitions } from '@/lib/server/progressStore'

export async function GET() {
  if (!hasPermission('inspection:view')) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }

  try {
    const checks = await listCheckDefinitions()
    return NextResponse.json({ items: checks })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
