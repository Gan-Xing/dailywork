import { NextResponse } from 'next/server'

import type {
  PhaseIntervalBindingStatus,
  PhaseIntervalFilter,
  PhaseIntervalQuantitySource,
  PhaseIntervalSortField,
  PhaseIntervalSortSpec,
} from '@/lib/phaseItemTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listPhaseIntervalManagementPage } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

const allowedSortFields: PhaseIntervalSortField[] = [
  'project',
  'road',
  'phase',
  'startPk',
  'endPk',
  'side',
  'quantity',
  'display',
  'completed',
  'updatedAt',
]

const isSortField = (value: string | null): value is PhaseIntervalSortField =>
  Boolean(value) && allowedSortFields.includes(value as PhaseIntervalSortField)

const parseSort = (searchParams: URLSearchParams): PhaseIntervalSortSpec[] =>
  searchParams
    .getAll('sort')
    .map((value) => {
      const [field, order] = value.split(':')
      if (!isSortField(field)) return null
      return {
        field,
        order: order === 'asc' ? 'asc' : 'desc',
      } satisfies PhaseIntervalSortSpec
    })
    .filter((item): item is PhaseIntervalSortSpec => Boolean(item))
    .slice(0, 4)

const parseNumberList = (searchParams: URLSearchParams, key: string) =>
  searchParams
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

const parseStringList = (searchParams: URLSearchParams, key: string) =>
  searchParams
    .getAll(key)
    .map((value) => value.trim())
    .filter(Boolean)

const parsePage = (searchParams: URLSearchParams) => {
  const value = Number(searchParams.get('page'))
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

const parsePageSize = (searchParams: URLSearchParams) => {
  const value = Number(searchParams.get('pageSize'))
  if (!Number.isFinite(value)) return 20
  return Math.max(1, Math.min(200, Math.round(value)))
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  if (!canView) {
    return respond('缺少进度查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const sort = parseSort(searchParams)
  const page = parsePage(searchParams)
  const pageSize = parsePageSize(searchParams)
  const filter: PhaseIntervalFilter = {
    projectKeys: parseStringList(searchParams, 'project'),
    roadIds: parseNumberList(searchParams, 'roadId'),
    phases: parseStringList(searchParams, 'phase'),
    startPks: parseNumberList(searchParams, 'startPk'),
    endPks: parseNumberList(searchParams, 'endPk'),
    sides: parseStringList(searchParams, 'side') as Array<'LEFT' | 'RIGHT' | 'BOTH'>,
    displays: parseStringList(searchParams, 'display') as Array<'LINEAR' | 'POINT'>,
    completions: parseStringList(searchParams, 'completed'),
    updatedDates: parseStringList(searchParams, 'updatedAt'),
    bindings: parseStringList(searchParams, 'binding') as PhaseIntervalBindingStatus[],
    quantitySources: parseStringList(
      searchParams,
      'quantitySource',
    ) as PhaseIntervalQuantitySource[],
  }

  try {
    const result = await listPhaseIntervalManagementPage({
      page,
      pageSize,
      filter,
      sort: sort.length ? sort : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return respond((error as Error).message ?? '加载分项工程列表失败', 500)
  }
}
