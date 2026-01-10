import { AccessDenied } from '@/components/AccessDenied'
import { ProgressNotFound } from '../../ProgressNotFound'
import { getSessionUser } from '@/lib/server/authSession'
import { getRoadPhaseQuantityDetail } from '@/lib/server/phaseItemManagement'

import QuantitiesDetailClient from './QuantitiesDetailClient'

export const dynamic = 'force-dynamic'

export default async function PhaseQuantityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const phaseId = Number(id)
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

  return <QuantitiesDetailClient detail={detail} canEdit={canEdit} />
}
