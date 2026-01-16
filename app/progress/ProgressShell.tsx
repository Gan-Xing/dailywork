'use client'

import { useRef, useState } from 'react'

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
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('road')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'road'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              按路段
            </button>
            <button
              type="button"
              onClick={() => setViewMode('phase')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'phase'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              按分项工程
            </button>
          </div>
          {canManage ? (
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
            />
          )}
        </div>
      </div>
    </main>
  )
}
