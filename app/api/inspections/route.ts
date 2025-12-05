import { NextResponse } from 'next/server'

import type { InspectionStatus } from '@/lib/progressTypes'
import { hasPermission } from '@/lib/server/authSession'
import { listInspections } from '@/lib/server/inspectionStore'

export async function GET(request: Request) {
  if (!hasPermission('inspection:view')) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const statusParams = searchParams.getAll('status').filter(Boolean) as InspectionStatus[]
  const filter = {
    roadSlug: searchParams.get('roadSlug') ?? undefined,
    phaseId: searchParams.get('phaseId') ? Number(searchParams.get('phaseId')) : undefined,
    status: statusParams.length ? statusParams : undefined,
    side: (searchParams.get('side') as 'LEFT' | 'RIGHT' | 'BOTH' | null) ?? undefined,
    type: searchParams.get('type') ?? undefined,
    check: searchParams.get('check') ?? undefined,
    keyword: searchParams.get('keyword') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    sortField: (searchParams.get('sortField') as 'createdAt' | 'updatedAt' | null) ?? undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
  }

  try {
    const result = await listInspections(filter)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
