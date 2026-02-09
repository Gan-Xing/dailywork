import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { upsertTruckFuelSource } from '@/lib/server/fuelSourceStore'

export async function POST(request: Request) {
  const canCreate = await hasPermission('fuel-source:create')
  const canUpdate = await hasPermission('fuel-source:update')
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: '缺少加油来源新增/更新权限' }, { status: 403 })
  }

  const session = await getSessionUser()
  const body = (await request.json().catch(() => null)) as unknown
  const machineId = Number((body as any)?.machineId)
  const isActive = (body as any)?.isActive === false ? false : true

  if (!Number.isFinite(machineId) || machineId <= 0) {
    return NextResponse.json({ error: 'machineId 无效' }, { status: 400 })
  }

  try {
    const fuelSource = await upsertTruckFuelSource(machineId, {
      isActive,
      updatedById: session?.id ?? null,
    })
    return NextResponse.json({ fuelSource })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
