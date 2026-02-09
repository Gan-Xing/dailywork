import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listMachineAssets } from '@/lib/server/machineStore'

export async function GET() {
  if (!(await hasPermission('machine:view'))) {
    return NextResponse.json({ error: '缺少机械查看权限' }, { status: 403 })
  }
  try {
    const machines = await listMachineAssets()
    return NextResponse.json({ machines })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

