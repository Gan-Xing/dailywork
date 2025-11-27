import { ProgressShell } from './ProgressShell'
import { AccessDenied } from '@/components/AccessDenied'
import type { RoadSectionProgressDTO } from '@/lib/progressTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  let roads: RoadSectionProgressDTO[] = []
  let loadError: string | null = null
  const sessionUser = getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canManage =
    sessionUser?.permissions.includes('progress:edit') || false
  const canViewInspections = sessionUser?.permissions.includes('inspection:view') || false

  if (!canView) {
    return <AccessDenied permissions={['progress:view']} hint="开通查看权限后可使用甘特与里程碑视图。" />
  }

  try {
    roads = await listRoadSectionsWithProgress()
  } catch (error) {
    loadError = (error as Error).message
  }

  return (
    <ProgressShell
      roads={roads}
      loadError={loadError}
      canManage={canManage}
      canViewInspections={canViewInspections}
    />
  )
}
