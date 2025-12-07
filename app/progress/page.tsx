import { ProgressShell } from './ProgressShell'
import { AccessDenied } from '@/components/AccessDenied'
import { aggregatePhaseProgress } from '@/lib/progressAggregation'
import type { RoadSectionProgressDTO, RoadSectionProgressSummaryDTO } from '@/lib/progressTypes'
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
    sessionUser?.permissions.includes('road:manage') || false
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

  const aggregatedPhases = aggregatePhaseProgress(roads, { locale: 'zh', splitBySpec: false })
  const summaryRoads: RoadSectionProgressSummaryDTO[] = roads.map((road) => ({
    id: road.id,
    slug: road.slug,
    name: road.name,
    labels: road.labels,
    startPk: road.startPk,
    endPk: road.endPk,
    createdAt: road.createdAt,
    updatedAt: road.updatedAt,
    phases: road.phases.map((phase) => ({
      phaseId: phase.phaseId,
      phaseName: phase.phaseName,
      phaseMeasure: phase.phaseMeasure,
      designLength: phase.designLength,
      completedLength: phase.completedLength,
      completedPercent: phase.completedPercent,
      updatedAt: phase.updatedAt,
    })),
  }))

  return (
    <ProgressShell
      roads={summaryRoads}
      aggregatedPhases={aggregatedPhases}
      loadError={loadError}
      canManage={canManage}
      canViewInspections={canViewInspections}
    />
  )
}
