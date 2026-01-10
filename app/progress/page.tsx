import { Suspense } from 'react'

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
  const sessionUser = await getSessionUser()
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canManage = sessionUser?.permissions.includes('road:manage') || false
  const canViewInspections = sessionUser?.permissions.includes('inspection:view') || false

  if (!canView) {
    const t = getProgressCopy('zh')
    return <AccessDenied permissions={['progress:view']} hint={t.access.progressViewHint} />
  }

  return (
    <Suspense
      fallback={
        <ProgressFallback canManage={canManage} canViewInspections={canViewInspections} />
      }
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

type ProgressFallbackProps = {
  canManage: boolean
  canViewInspections: boolean
}

function ProgressFallback({ canManage, canViewInspections }: ProgressFallbackProps) {
  const t = getProgressCopy('zh')

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            {t.hero.badge}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">{t.hero.title}</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">{t.hero.description}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {canViewInspections ? (
                <span className="inline-flex h-9 items-center rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                  {t.nav.inspections}
                </span>
              ) : null}
              {canManage ? (
                <span className="inline-flex h-9 items-center rounded-full border border-blue-200/60 px-4 py-2 text-xs font-semibold text-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]">
                  {t.workflow.badge}
                </span>
              ) : null}
              {canManage ? (
                <span className="inline-flex h-9 items-center rounded-full bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-400/30">
                  {t.actions.add}
                </span>
              ) : null}
            </div>
            <span className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
              {t.nav.progress}
            </span>
          </div>
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              // fallback skeleton only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-emerald-500/10"
            >
              <div className="flex items-center justify-between">
                <span className="h-4 w-28 rounded-full bg-white/10" />
                <span className="h-4 w-12 rounded-full bg-white/10" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded-full bg-white/10" />
                <div className="h-3 w-3/4 rounded-full bg-white/10" />
                <div className="h-3 w-2/3 rounded-full bg-white/10" />
              </div>
              <div className="mt-4 h-10 rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-300/80">加载进度数据中...</p>
      </div>
    </main>
  )
}
