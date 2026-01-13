import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listIntervalsBoundPhaseItems } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function POST(request: Request) {
  if (!(await hasPermission('progress:view'))) {
    return respond('缺少进度查看权限', 403)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return respond('请求体格式无效', 400)
  }

  const intervalIds = Array.isArray((payload as any)?.intervalIds)
    ? ((payload as any).intervalIds as unknown[])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : []

  if (!intervalIds.length) {
    return NextResponse.json({ itemsByInterval: {} })
  }

  if (intervalIds.length > 500) {
    return respond('区间数量过多，请先缩小筛选范围', 400)
  }

  try {
    const map = await listIntervalsBoundPhaseItems(intervalIds)
    const itemsByInterval: Record<string, unknown> = {}
    map.forEach((items, intervalId) => {
      itemsByInterval[String(intervalId)] = items
    })
    return NextResponse.json({ itemsByInterval })
  } catch (error) {
    return respond((error as Error).message ?? '加载区间绑定明细失败', 500)
  }
}

