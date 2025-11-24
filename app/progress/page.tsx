import { ProgressShell } from './ProgressShell'
import type { RoadSectionDTO } from '@/lib/progressTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSections } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  let roads: RoadSectionDTO[] = []
  let loadError: string | null = null
  const sessionUser = getSessionUser()
  const canManage = sessionUser?.permissions.includes('road:manage') ?? false

  try {
    roads = await listRoadSections()
  } catch (error) {
    loadError = (error as Error).message
  }

  return (
    <ProgressShell roads={roads} loadError={loadError} canManage={canManage} />
  )
}
