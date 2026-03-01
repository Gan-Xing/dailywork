'use client'

import { useMemo, useRef, useState } from 'react'

import { PhaseAggregateBoard } from './PhaseAggregateBoard'
import { ProgressHeader } from './ProgressHeader'
import { RoadBoard, type RoadBoardHandle } from './RoadBoard'
import type { AggregatedPhaseProgress, RoadSectionProgressSummaryDTO } from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  roads: RoadSectionProgressSummaryDTO[]
  aggregatedPhases: AggregatedPhaseProgress[]
  loadError: string | null
  canManage: boolean
  canViewInspections: boolean
  projects: Array<{ id: number; name: string; code: string | null }>
}

export function ProgressShell({
  roads,
  aggregatedPhases,
  loadError,
  canManage,
  canViewInspections,
  projects,
}: Props) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const breadcrumbHome = t.nav.home
  const breadcrumbProgress = t.nav.progress
  const [viewMode, setViewMode] = useState<'road' | 'phase'>('road')
  const roadBoardRef = useRef<RoadBoardHandle | null>(null)
  const phaseIds = useMemo(() => aggregatedPhases.map((phase) => phase.id), [aggregatedPhases])
  const phaseIdSet = useMemo(() => new Set(phaseIds), [phaseIds])
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<string>>(new Set())
  const effectiveExpandedPhaseIds = useMemo(
    () => new Set(Array.from(expandedPhaseIds).filter((id) => phaseIdSet.has(id))),
    [expandedPhaseIds, phaseIdSet],
  )
  const allExpanded = phaseIds.length > 0 && phaseIds.every((id) => effectiveExpandedPhaseIds.has(id))

  const togglePhase = (phaseId: string) => {
    if (!phaseIdSet.has(phaseId)) return
    setExpandedPhaseIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => phaseIdSet.has(id)))
      if (next.has(phaseId)) {
        next.delete(phaseId)
      } else {
        next.add(phaseId)
      }
      return next
    })
  }

  const expandAllPhases = () => {
    setExpandedPhaseIds(new Set(phaseIds))
  }

  const collapseAllPhases = () => {
    setExpandedPhaseIds(new Set())
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title={t.hero.title}
        subtitle={t.hero.description}
        breadcrumbs={[
          { label: breadcrumbHome, href: '/' },
          { label: breadcrumbProgress },
        ]}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        {loadError ? (
          <p className="text-sm text-amber-700">
            {formatProgressCopy(t.hero.loadError, { message: loadError })}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center rounded-lg bg-slate-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('road')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
                viewMode === 'road'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t.phase.view.road}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('phase')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
                viewMode === 'phase'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t.phase.view.phase}
            </button>
          </div>
          {viewMode === 'phase' ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:ml-auto lg:justify-end">
              <button
                type="button"
                onClick={expandAllPhases}
                disabled={!phaseIds.length || allExpanded}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {t.phase.aggregate.expandAll}
              </button>
              <button
                type="button"
                onClick={collapseAllPhases}
                disabled={!effectiveExpandedPhaseIds.size}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {t.phase.aggregate.collapseAll}
              </button>
            </div>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => roadBoardRef.current?.openFormModal()}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600"
            >
              {t.actions.add}
            </button>
          ) : null}
        </div>
        <div className="mt-6">
          {viewMode === 'road' ? (
            <RoadBoard
              ref={roadBoardRef}
              initialRoads={roads}
              projects={projects}
              canManage={canManage}
            />
          ) : (
            <PhaseAggregateBoard
              phases={aggregatedPhases}
              aggregateCopy={t.phase.aggregate}
              locale={locale}
              expandedPhaseIds={effectiveExpandedPhaseIds}
              onTogglePhase={togglePhase}
            />
          )}
        </div>
      </div>
    </main>
  )
}
