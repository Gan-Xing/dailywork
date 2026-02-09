import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { upsertMachineAssets } from '@/lib/server/machineStore'
import type { MachineImportRow } from '@/types/machines'

export async function POST(request: Request) {
  const canCreate = await hasPermission('machine:create')
  const canUpdate = await hasPermission('machine:update')
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: '缺少机械新增/更新权限' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as
    | { machines?: MachineImportRow[]; ignoreBlanks?: boolean }
    | null
  const machines = Array.isArray(body?.machines) ? body?.machines ?? [] : []
  if (machines.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const session = await getSessionUser()
  const ignoreBlanks = body?.ignoreBlanks !== false

  try {
    const result = await upsertMachineAssets(machines, {
      ignoreBlanks,
      updatedById: session?.id ?? null,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
