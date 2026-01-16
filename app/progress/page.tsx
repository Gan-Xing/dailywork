import { Suspense } from 'react'

import { ProgressHeader } from './ProgressHeader'
import { ProgressShell } from './ProgressShell'
import { AccessDenied } from '@/components/AccessDenied'
import { aggregatePhaseProgress } from '@/lib/progressAggregation'
import type { RoadSectionProgressDTO, RoadSectionProgressSummaryDTO } from '@/lib/progressTypes'
import { getProgressCopy } from '@/lib/i18n/progress'
import { getSessionUser } from '@/lib/server/authSession'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const t = getProgressCopy('zh')
  const sessionUser = await getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canManage = sessionUser?.permissions.includes('road:manage') || false
  const canViewInspections = sessionUser?.permissions.includes('inspection:view') || false

  if (!canView) {
    return <AccessDenied permissions={['progress:view']} hint={t.access.progressViewHint} />
  }

  return (
    <Suspense
      fallback={<ProgressFallback />}
    >
      <ProgressContent canManage={canManage} canViewInspections={canViewInspections} />
    </Suspense>
  )
}

type ProgressContentProps = {
  canManage: boolean
  canViewInspections: boolean
}

async function ProgressContent({ canManage, canViewInspections }: ProgressContentProps) {
  let roads: RoadSectionProgressDTO[] = []
  let loadError: string | null = null
  let projects: Array<{ id: number; name: string; code: string | null }> = []

  try {
    roads = await listRoadSectionsWithProgress()
    if (canManage) {
      projects = await prisma.project.findMany({
        select: { id: true, name: true, code: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })
    }
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
    projectId: road.projectId ?? null,
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
      projects={projects}
    />
  )
}

function ProgressFallback() {
  const t = getProgressCopy('zh')

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title={t.hero.title}
        subtitle={t.hero.description || undefined}
        breadcrumbs={[
          { label: t.nav.home, href: '/' },
          { label: t.nav.progress },
        ]}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              // fallback skeleton only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="h-4 w-28 rounded-full bg-slate-200" />
                <span className="h-4 w-12 rounded-full bg-slate-200" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded-full bg-slate-200" />
                <div className="h-3 w-3/4 rounded-full bg-slate-200" />
                <div className="h-3 w-2/3 rounded-full bg-slate-200" />
              </div>
              <div className="mt-4 h-10 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">加载进度数据中...</p>
      </div>
    </main>
  )
}
