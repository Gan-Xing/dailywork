import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'
import { getRoadBySlug } from '@/lib/server/roadStore'
import {
  aggregateEntriesAsListItems,
  createEntriesFromLegacyPayload,
  isWorkflowValidationError,
} from '@/lib/server/inspectionEntryStore'
import type { InspectionStatus } from '@/lib/progressTypes'

interface RouteParams {
  params: {
    slug: string
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再报检' }, { status: 401 })
  }
  if (!hasPermission('inspection:create')) {
    return NextResponse.json({ message: '缺少报检权限' }, { status: 403 })
  }

  const road = await getRoadBySlug(params.slug)
  if (!road) {
    return NextResponse.json({ message: '路段不存在' }, { status: 404 })
  }

  let payload: {
    phaseId?: number
    side?: string
    startPk?: number
    endPk?: number
    layers?: string[]
    checks?: string[]
    types?: string[]
    remark?: string
    appointmentDate?: string
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.phaseId || !payload.side || payload.startPk === undefined || payload.endPk === undefined) {
    return NextResponse.json({ message: '缺少必填字段：分项/侧别/起点/终点' }, { status: 400 })
  }

  const phase = await prisma.roadPhase.findFirst({
    where: { id: payload.phaseId, roadId: road.id },
  })
  if (!phase) {
    return NextResponse.json({ message: '分项不存在或不属于当前路段' }, { status: 404 })
  }

  try {
    const entries = await createEntriesFromLegacyPayload(
      road.id,
      phase.id,
      {
        startPk: Number(payload.startPk),
        endPk: Number(payload.endPk),
        side: payload.side as 'LEFT' | 'RIGHT' | 'BOTH',
        layers: payload.layers ?? [],
        checks: payload.checks ?? [],
        types: payload.types ?? [],
        remark: payload.remark,
        appointmentDate: payload.appointmentDate,
        submissionId: (payload as any).submissionId ?? null,
        submissionOrder: (payload as any).submissionOrder ?? null,
        submittedAt: undefined,
        status: (payload as any).status,
      },
      sessionUser.id,
      { phase },
    )
    // 兼容旧前端：按同一分项/区间聚合成单条 inspection
    const aggregateKey = `${phase.id}:${payload.side}:${payload.startPk}:${payload.endPk}`
    const map = new Map<string, { layers: Set<string>; checks: Set<string>; latest: typeof entries[number] }>()
    entries.forEach((entry) => {
      const key = aggregateKey
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { layers: new Set([entry.layerName]), checks: new Set([entry.checkName]), latest: entry })
      } else {
        existing.layers.add(entry.layerName)
        existing.checks.add(entry.checkName)
        if (new Date(entry.updatedAt).getTime() >= new Date(existing.latest.updatedAt).getTime()) {
          existing.latest = entry
        }
      }
    })
    const aggregated = Array.from(map.values()).map((group) => ({
      id: group.latest.id,
      roadId: road.id,
      roadName: road.name,
      roadSlug: road.slug,
      phaseId: phase.id,
      phaseName: phase.name,
      submissionId: entries[0]?.submissionId ?? null,
      submissionCode: entries[0]?.submissionCode ?? null,
      side: payload.side as 'LEFT' | 'RIGHT' | 'BOTH',
      startPk: Number(payload.startPk),
      endPk: Number(payload.endPk),
      layers: Array.from(group.layers),
      checks: Array.from(group.checks),
      types: Array.from(new Set(entries.flatMap((e) => e.types || []))),
      submissionOrder: (payload as any).submissionOrder ?? null,
      status: entries[0]?.status ?? 'SCHEDULED',
      remark: payload.remark ?? undefined,
      appointmentDate: payload.appointmentDate,
      submittedAt: entries[0]?.submittedAt ?? new Date().toISOString(),
      submittedBy: entries[0]?.submittedBy ?? null,
      createdBy: entries[0]?.createdBy ?? null,
      createdAt: entries[0]?.createdAt ?? new Date().toISOString(),
      updatedAt: entries[0]?.updatedAt ?? new Date().toISOString(),
      updatedBy: entries[0]?.updatedBy ?? null,
    }))[0]

    return NextResponse.json({ entries, inspection: aggregated })
  } catch (error) {
    if (isWorkflowValidationError(error)) {
      return NextResponse.json(
        { message: error.message, details: error.details },
        { status: 400 },
      )
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function GET(request: Request) {
  if (!hasPermission('inspection:view')) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const statusParams = searchParams.getAll('status').filter(Boolean) as InspectionStatus[]
  const filter = {
    roadSlug: searchParams.get('roadSlug') ?? undefined,
    phaseId: searchParams.get('phaseId') ? Number(searchParams.get('phaseId')) : undefined,
    phaseDefinitionId: searchParams.get('phaseDefinitionId')
      ? Number(searchParams.get('phaseDefinitionId'))
      : undefined,
    status: statusParams.length ? statusParams : undefined,
    side: (searchParams.get('side') as 'LEFT' | 'RIGHT' | 'BOTH' | null) ?? undefined,
    type: searchParams.get('type') ?? undefined,
    keyword: searchParams.get('keyword') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    sortField: (searchParams.get('sortField') as 'createdAt' | 'updatedAt' | null) ?? undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
  }

  try {
    const result = await aggregateEntriesAsListItems(filter)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
