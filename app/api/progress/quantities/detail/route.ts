import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/server/authSession'
import { getRoadPhaseQuantityDetail } from '@/lib/server/phaseItemManagement'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phaseId = Number(searchParams.get('phaseId'))
  const intervalId = Number(searchParams.get('intervalId'))

  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return respond('分项无效', 400)
  }
  if (!Number.isInteger(intervalId) || intervalId <= 0) {
    return respond('区间无效', 400)
  }

  const sessionUser = await getSessionUser()
  const canView = !sessionUser || sessionUser.permissions.includes('progress:view') || false
  const canEdit = sessionUser?.permissions.includes('progress:edit') || false
  if (!canView) {
    return respond('缺少进度查看权限', 403)
  }

  try {
    const detail = await getRoadPhaseQuantityDetail(phaseId)
    if (!detail) return respond('未找到详情', 404)

    const hasInterval = detail.intervals.some((interval) => interval.id === intervalId)
    if (!hasInterval) return respond('未找到区间', 404)

    const scopedDetail = {
      ...detail,
      intervals: detail.intervals.filter((interval) => interval.id === intervalId),
      inputs: detail.inputs.filter((input) => input.intervalId === intervalId),
    }

    return NextResponse.json({ detail: scopedDetail, canEdit })
  } catch (error) {
    return respond((error as Error).message ?? '加载详情失败', 500)
  }
}

