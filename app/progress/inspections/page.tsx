import { AccessDenied } from '@/components/AccessDenied'
import { InspectionBoard } from './InspectionBoard'
import type { RoadSectionWithPhasesDTO } from '@/lib/progressTypes'
import { getProgressCopy } from '@/lib/i18n/progress'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSectionsWithPhases } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

export default async function InspectionListPage() {
  const sessionUser = await getSessionUser()
  const canView = sessionUser?.permissions.includes('inspection:view') ?? false
  const canBulkEdit = sessionUser?.permissions.includes('inspection:bulk-edit') ?? false

  if (!canView) {
    const t = getProgressCopy('zh')
    return <AccessDenied permissions={['inspection:view']} hint={t.access.inspectionViewHint} />
  }

  let roads: RoadSectionWithPhasesDTO[] = []
  let loadError: string | null = null

  try {
    roads = await listRoadSectionsWithPhases()
  } catch (error) {
    loadError = (error as Error).message
  }

  return <InspectionBoard roads={roads} loadError={loadError} canBulkEdit={canBulkEdit} />
}
