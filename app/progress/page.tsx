import { ProgressShell } from './ProgressShell'
import { AccessDenied } from '@/components/AccessDenied'
import type { RoadSectionProgressDTO } from '@/lib/progressTypes'
import { getProgressCopy } from '@/lib/i18n/progress'
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
    const t = getProgressCopy('zh')
    return <AccessDenied permissions={['progress:view']} hint={t.access.progressViewHint} />
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
