import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listBoqCompletionDetails } from '@/lib/server/boqStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boqItemId: string }> },
) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { boqItemId: rawBoqItemId } = await params
  const boqItemId = Number(rawBoqItemId)
  if (!Number.isInteger(boqItemId) || boqItemId <= 0) {
    return respond('工程量清单条目无效', 400)
  }

  const { searchParams } = new URL(request.url)
  const projectId = Number(searchParams.get('projectId'))
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  try {
    const details = await listBoqCompletionDetails({ projectId, boqItemId })
    return NextResponse.json({ details })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载产值明细', 500)
  }
}
