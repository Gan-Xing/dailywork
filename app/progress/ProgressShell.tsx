'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import { PhaseAggregateBoard } from './PhaseAggregateBoard'
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
}

export function ProgressShell({
  roads,
  aggregatedPhases,
  loadError,
  canManage,
  canViewInspections,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const breadcrumbHome = t.nav.home
  const breadcrumbProgress = t.nav.progress
  const inspectionLabel = t.nav.inspections
  const [viewMode, setViewMode] = useState<'road' | 'phase'>('road')
  const roadBoardRef = useRef<RoadBoardHandle | null>(null)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            {t.hero.badge}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">{t.hero.title}</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">{t.hero.description}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
              <Link
                href="/"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
              >
                {breadcrumbHome}
              </Link>
              <span className="text-slate-500">/</span>
              <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
                {breadcrumbProgress}
              </span>
            </nav>
            <div className="flex items-center gap-2">
              {canViewInspections ? (
                <Link
                  href="/progress/inspections"
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/10"
                >
                  {inspectionLabel}
                </Link>
              ) : null}
              {canManage ? (
                <Link
                  href="/progress/workflows"
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold text-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.35)] transition border-blue-200/60 hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/10"
                >
                  {t.workflow.badge}
                </Link>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => roadBoardRef.current?.openFormModal()}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 hover:bg-emerald-400"
                >
                  {t.actions.add}
                </button>
              ) : null}
            </div>
          </div>
          {loadError ? (
            <p className="text-sm text-amber-200">
              {formatProgressCopy(t.hero.loadError, { message: loadError })}
            </p>
          ) : null}
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold">
          <span className="uppercase tracking-[0.2em] text-slate-400">{t.phase.view.label}</span>
          <button
            type="button"
            onClick={() => setViewMode('road')}
            className={`rounded-full border px-4 py-1 transition ${
              viewMode === 'road'
                ? 'border-transparent bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/30'
                : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            {t.phase.view.road}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('phase')}
            className={`rounded-full border px-4 py-1 transition ${
              viewMode === 'phase'
                ? 'border-transparent bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/30'
                : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            {t.phase.view.phase}
          </button>
        </div>

        <div className="mt-10">
          {viewMode === 'road' ? (
            <RoadBoard ref={roadBoardRef} initialRoads={roads} canManage={canManage} />
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
