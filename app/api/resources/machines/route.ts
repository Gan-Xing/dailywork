import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createMachineAsset, listMachineAssets } from '@/lib/server/machineStore'

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

export async function POST(request: Request) {
  if (!(await hasPermission('machine:manage'))) {
    return NextResponse.json({ error: '缺少机械管理权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  try {
    const machine = await createMachineAsset(body, { createdById: session.id })
    return NextResponse.json({ machine }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
