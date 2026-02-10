import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getMachineLogsSummaryPageData, parseMachineLogGroupBy } from '@/lib/server/machineLogsStore'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

export async function GET(request: Request) {
  if (!(await hasPermission('machine-log:view'))) {
    return NextResponse.json({ error: '缺少机械日志查看权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')?.trim() || defaultDateKey()
  const groupBy = parseMachineLogGroupBy(searchParams.get('groupBy'))
  const projectIdRaw = searchParams.get('projectId')?.trim() || ''
  const projectIdParsed = projectIdRaw ? Number(projectIdRaw) : null
  const projectId = projectIdParsed && Number.isFinite(projectIdParsed) && projectIdParsed > 0 ? projectIdParsed : null
  const mineOnly = searchParams.get('mine') === '1'
  const locale = searchParams.get('locale')

  const session = await getSessionUser()
  const mineUserId = mineOnly ? session?.id ?? null : null

  try {
    const data = await getMachineLogsSummaryPageData({
      dateKey: date,
      groupBy,
      projectId,
      mineOnly,
      mineUserId,
      locale,
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
