import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import type { InspectionStatus, InspectionEntryFilter } from '@/lib/progressTypes'
import { hasPermission, getSessionUser } from '@/lib/server/authSession'
import {
  createInspectionEntries,
  listInspectionEntries,
} from '@/lib/server/inspectionEntryStore'

export async function GET(request: Request) {
  if (!(await hasPermission('inspection:view'))) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusParams = searchParams.getAll('status').filter(Boolean) as InspectionStatus[]
  const typeParams = searchParams.getAll('type').filter(Boolean)
  const layerParams = searchParams.getAll('layerName').filter(Boolean)
  const roadParams = searchParams.getAll('roadSlug').filter(Boolean)
  const phaseDefinitionParams = searchParams
    .getAll('phaseDefinitionId')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  const checkParams = searchParams.getAll('checkName').filter(Boolean)

  const allowedSortFields: NonNullable<InspectionEntryFilter['sortField']>[] = [
    'appointmentDate',
    'road',
    'phase',
    'side',
    'range',
    'layers',
    'checks',
    'submissionOrder',
    'status',
    'submittedAt',
    'submittedBy',
    'createdBy',
    'createdAt',
    'updatedBy',
    'updatedAt',
    'remark',
  ]

  const rawSortField = searchParams.get('sortField')
  const sortField = allowedSortFields.includes(rawSortField as InspectionEntryFilter['sortField'])
    ? (rawSortField as InspectionEntryFilter['sortField'])
    : undefined

  const sortParams = searchParams.getAll('sort')
  const sort: NonNullable<InspectionEntryFilter['sort']> = sortParams
    .map((value) => {
      const [field, order] = value.split(':')
      if (!allowedSortFields.includes(field as any)) return null
      const ord = order === 'asc' || order === 'desc' ? order : 'desc'
      return { field: field as NonNullable<InspectionEntryFilter['sortField']>, order: ord }
    })
    .filter(Boolean) as NonNullable<InspectionEntryFilter['sort']>

  const filter = {
    roadSlug: searchParams.get('roadSlug') ?? undefined,
    roadSlugs: roadParams.length ? roadParams : undefined,
    phaseId: searchParams.get('phaseId') ? Number(searchParams.get('phaseId')) : undefined,
    phaseDefinitionId: searchParams.get('phaseDefinitionId')
      ? Number(searchParams.get('phaseDefinitionId'))
      : undefined,
    phaseDefinitionIds: phaseDefinitionParams.length ? phaseDefinitionParams : undefined,
    status: statusParams.length ? statusParams : undefined,
    side: (searchParams.get('side') as 'LEFT' | 'RIGHT' | 'BOTH' | null) ?? undefined,
    layerNames: layerParams.length ? layerParams : undefined,
    types: typeParams.length ? typeParams : undefined,
    checkId: searchParams.get('checkId') ? Number(searchParams.get('checkId')) : undefined,
    checkName: searchParams.get('checkName') ?? undefined,
    checkNames: checkParams.length ? checkParams : undefined,
    keyword: searchParams.get('keyword') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    startPkFrom: searchParams.get('startPkFrom') ? Number(searchParams.get('startPkFrom')) : undefined,
    startPkTo: searchParams.get('startPkTo') ? Number(searchParams.get('startPkTo')) : undefined,
    sortField,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
    sort: sort.length ? sort : undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
  }

  try {
    const result = await listInspectionEntries(filter)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再报检' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:create'))) {
    return NextResponse.json({ message: '缺少报检权限' }, { status: 403 })
  }

  let payload: { entries?: unknown[] }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    return NextResponse.json({ message: '至少需要一条报检明细' }, { status: 400 })
  }

  try {
    const entries = await createInspectionEntries(payload.entries as any, sessionUser.id)
    return NextResponse.json({ entries })
  } catch (error) {
    const err = error as Error
    const friendlyMessage =
      error instanceof Prisma.PrismaClientValidationError
        ? '报检数据格式不正确，请检查必填项后重试。'
        : error instanceof Prisma.PrismaClientKnownRequestError
          ? '报检保存失败，请稍后重试或联系管理员。'
          : err.message
    return NextResponse.json({ message: friendlyMessage }, { status: 400 })
  }
}
