import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listFinanceMetadata } from '@/lib/server/financeStore'

export async function GET() {
  if (!(await hasPermission('finance:view'))) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }

  try {
    const data = await listFinanceMetadata()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
