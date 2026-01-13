import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listIntervalBoundPhaseItems } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(request: Request) {
  if (!(await hasPermission('progress:view'))) {
    return respond('缺少进度查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const intervalId = Number(searchParams.get('intervalId'))
  if (!Number.isInteger(intervalId) || intervalId <= 0) {
    return respond('区间无效', 400)
  }

  try {
    const items = await listIntervalBoundPhaseItems(intervalId)
    return NextResponse.json({ items })
  } catch (error) {
    return respond((error as Error).message ?? '加载区间绑定明细失败', 500)
  }
}

