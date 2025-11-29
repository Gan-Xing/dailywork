import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createPrefabInspection } from '@/lib/server/prefabInspection'
import type { PrefabPhaseKey } from '@/lib/prefabInspection'

export async function POST(request: Request) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检权限' }, { status: 403 })
  }

  let body: {
    phaseKey?: PrefabPhaseKey
    layers?: string[]
    checks?: string[]
    types?: string[]
    appointmentDate?: string
    remark?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.phaseKey) {
    return NextResponse.json({ message: '请选择预制分项' }, { status: 400 })
  }
  if (!body.appointmentDate) {
    return NextResponse.json({ message: '请选择预约报检日期' }, { status: 400 })
  }

  const checks = Array.isArray(body.checks) ? body.checks.filter(Boolean) : []
  const types = Array.isArray(body.types) ? body.types.filter(Boolean) : []
  const layers = Array.isArray(body.layers) ? body.layers.filter(Boolean) : []

  if (!checks.length || !types.length) {
    return NextResponse.json({ message: '验收内容与验收类型均不能为空' }, { status: 400 })
  }

  try {
    const inspection = await createPrefabInspection(
      body.phaseKey,
      { layers, checks, types, appointmentDate: body.appointmentDate, remark: body.remark },
      sessionUser.id,
    )
    return NextResponse.json({ inspection })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
