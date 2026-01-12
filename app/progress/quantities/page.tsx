import { AccessDenied } from '@/components/AccessDenied'
import { getSessionUser } from '@/lib/server/authSession'
import { listPhaseIntervalManagementRows } from '@/lib/server/phaseItemManagement'

import QuantitiesListClient from './QuantitiesListClient'

export const dynamic = 'force-dynamic'

export default async function PhaseQuantityListPage() {
  const sessionUser = await getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false

  if (!canView) {
    return <AccessDenied permissions={['progress:view']} hint="需要进度查看权限" />
  }

  const rows = await listPhaseIntervalManagementRows()

  return <QuantitiesListClient rows={rows} />
}
