import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import type { PrefabPhaseKey } from '@/lib/prefabInspection'
import { createPrefabInspection } from '@/lib/server/prefabInspectionEntries'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再报检' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:create'))) {
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
    const entries = await createPrefabInspection(
      body.phaseKey,
      { layers, checks, types, appointmentDate: body.appointmentDate, remark: body.remark },
      sessionUser.id,
    )
    // 聚合为旧结构，便于前端兼容
    const grouped = new Map<string, { layers: Set<string>; checks: Set<string>; latest: (typeof entries)[number] }>()
    entries.forEach((entry) => {
      const key = `${entry.phaseId}:${entry.side}:${entry.startPk}:${entry.endPk}:${entry.submissionId ?? ''}`
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, { layers: new Set([entry.layerName]), checks: new Set([entry.checkName]), latest: entry })
      } else {
        existing.layers.add(entry.layerName)
        existing.checks.add(entry.checkName)
        if (new Date(entry.updatedAt).getTime() >= new Date(existing.latest.updatedAt).getTime()) {
          existing.latest = entry
        }
      }
    })
    const aggregated = Array.from(grouped.values()).map((group) => ({
      id: group.latest.id,
      roadId: group.latest.roadId,
      roadName: entries[0]?.roadName ?? '',
      roadSlug: entries[0]?.roadSlug ?? '',
      phaseId: group.latest.phaseId,
      phaseName: group.latest.phaseName,
      submissionId: group.latest.submissionId,
      submissionCode: group.latest.submissionCode,
      side: group.latest.side,
      startPk: group.latest.startPk,
      endPk: group.latest.endPk,
      layers: Array.from(group.layers),
      checks: Array.from(group.checks),
      types: Array.from(new Set(entries.flatMap((e) => e.types || []))),
      submissionOrder: group.latest.submissionOrder ?? undefined,
      status: group.latest.status,
      remark: group.latest.remark ?? undefined,
      appointmentDate: group.latest.appointmentDate,
      submittedAt: group.latest.submittedAt,
      submittedBy: group.latest.submittedBy ?? null,
      createdBy: group.latest.createdBy ?? null,
      createdAt: group.latest.createdAt,
      updatedAt: group.latest.updatedAt,
      updatedBy: group.latest.updatedBy ?? null,
    }))[0]

    return NextResponse.json({ inspection: aggregated, entries })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
