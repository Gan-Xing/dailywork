import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listInspectionEntryUserOptions } from '@/lib/server/inspectionEntryStore'

export async function GET() {
  if (!(await hasPermission('inspection:view'))) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }

  try {
    const items = await listInspectionEntryUserOptions()
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
