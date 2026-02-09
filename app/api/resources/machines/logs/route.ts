import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getMachineLogsPageData, saveMachineDailyLog } from '@/lib/server/machineLogsStore'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

export async function GET(request: Request) {
  if (!(await hasPermission('machine-log:view'))) {
    return NextResponse.json({ error: '缺少机械日志查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')?.trim() || defaultDateKey()

  try {
    const data = await getMachineLogsPageData(date)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const canCreate = await hasPermission('machine-log:create')
  const canUpdate = await hasPermission('machine-log:update')
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: '缺少机械日志新增/更新权限' }, { status: 403 })
  }

  const session = await getSessionUser()

  const body = (await request.json().catch(() => null)) as unknown
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  try {
    const saved = await saveMachineDailyLog(body as any, {
      updatedById: session?.id ?? null,
    })
    return NextResponse.json({ log: saved })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
