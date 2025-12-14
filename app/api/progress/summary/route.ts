import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'
import { aggregatePhaseProgress } from '@/lib/progressAggregation'

export async function GET() {
  if (!(await hasPermission('value:view'))) {
    return NextResponse.json({ message: '缺少产值查看权限' }, { status: 403 })
  }

  try {
    const roads = await listRoadSectionsWithProgress()
    const phases = aggregatePhaseProgress(roads)
    return NextResponse.json({ phases })
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message ?? '无法加载分项工程汇总' },
      { status: 500 },
    )
  }
}
