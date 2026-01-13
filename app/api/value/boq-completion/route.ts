import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { listBoqCompletion, listBoqItems } from '@/lib/server/boqStore'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(request: Request) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { searchParams } = new URL(request.url)
  const projectId = Number(searchParams.get('projectId'))
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return respond('项目编号无效', 400)
  }

  try {
    const [items, completion] = await Promise.all([
      listBoqItems({ projectId, sheetType: 'ACTUAL' }),
      listBoqCompletion({ projectId, sheetType: 'ACTUAL' }),
    ])
    return NextResponse.json({ items, completion })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载产值清单', 500)
  }
}
