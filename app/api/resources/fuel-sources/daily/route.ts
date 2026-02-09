import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  getFuelSourceDailyPageData,
  saveFuelSourceDailyLog,
} from '@/lib/server/fuelSourceStore'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

export async function GET(request: Request) {
  const canView = (await hasPermission('fuel-source:view')) || (await hasPermission('machine-log:view'))
  if (!canView) {
    return NextResponse.json({ error: '缺少加油来源查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')?.trim() || defaultDateKey()

  try {
    const data = await getFuelSourceDailyPageData(date)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const canCreate = await hasPermission('fuel-source:create')
  const canUpdate = await hasPermission('fuel-source:update')
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: '缺少加油来源新增/更新权限' }, { status: 403 })
  }

  const session = await getSessionUser()

  const body = (await request.json().catch(() => null)) as unknown
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  try {
    const record = await saveFuelSourceDailyLog(body as any, {
      updatedById: session?.id ?? null,
    })
    return NextResponse.json({ id: record.id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
