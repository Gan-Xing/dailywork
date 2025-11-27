import { ProgressShell } from './ProgressShell'
import { AccessDenied } from '@/components/AccessDenied'
import type { RoadSectionDTO } from '@/lib/progressTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSections } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  let roads: RoadSectionDTO[] = []
  let loadError: string | null = null
  const sessionUser = getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canManage =
    sessionUser?.permissions.includes('progress:edit') || false

  if (!canView) {
    return <AccessDenied permissions={['progress:view']} hint="开通查看权限后可使用甘特与里程碑视图。" />
  }

  try {
    roads = await listRoadSections()
  } catch (error) {
    loadError = (error as Error).message
  }

  return (
    <ProgressShell roads={roads} loadError={loadError} canManage={canManage} />
  )
}
