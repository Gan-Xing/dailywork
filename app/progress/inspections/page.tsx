import { AccessDenied } from '@/components/AccessDenied'
import { InspectionBoard } from './InspectionBoard'
import type { RoadSectionWithPhasesDTO } from '@/lib/progressTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSectionsWithPhases } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

export default async function InspectionListPage() {
  const sessionUser = getSessionUser()
  const canView = sessionUser?.permissions.includes('inspection:view') ?? false

  if (!canView) {
    return <AccessDenied permissions={['inspection:view']} hint="需要查看报检权限才能浏览此列表。" />
  }

  let roads: RoadSectionWithPhasesDTO[] = []
  let loadError: string | null = null

  try {
    roads = await listRoadSectionsWithPhases()
  } catch (error) {
    loadError = (error as Error).message
  }

  return <InspectionBoard roads={roads} loadError={loadError} />
}
