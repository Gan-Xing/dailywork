import { AccessDenied } from '@/components/AccessDenied'
import { ProgressNotFound } from '../../ProgressNotFound'
import { getSessionUser } from '@/lib/server/authSession'
import { getRoadPhaseQuantityDetail } from '@/lib/server/phaseItemManagement'

import QuantitiesDetailClient from './QuantitiesDetailClient'

export const dynamic = 'force-dynamic'

export default async function PhaseQuantityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ intervalId?: string | string[] }>
}) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const phaseId = Number(id)
  const intervalParam =
    typeof query.intervalId === 'string'
      ? query.intervalId
      : Array.isArray(query.intervalId)
        ? query.intervalId[0]
        : undefined
  const intervalId = intervalParam ? Number(intervalParam) : NaN
  const sessionUser = await getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canEdit = sessionUser?.permissions.includes('progress:edit') || false

  if (!canView) {
    return <AccessDenied permissions={['progress:view']} hint="需要进度查看权限" />
  }

  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return <ProgressNotFound />
  }

  const detail = await getRoadPhaseQuantityDetail(phaseId)
  if (!detail) {
    return <ProgressNotFound />
  }

  const hasInterval =
    Number.isInteger(intervalId) && intervalId > 0
      ? detail.intervals.some((interval) => interval.id === intervalId)
      : false

  const scopedDetail = hasInterval
    ? {
        ...detail,
        intervals: detail.intervals.filter((interval) => interval.id === intervalId),
        inputs: detail.inputs.filter((input) => input.intervalId === intervalId),
      }
    : detail

  return <QuantitiesDetailClient detail={scopedDetail} canEdit={canEdit} />
}
