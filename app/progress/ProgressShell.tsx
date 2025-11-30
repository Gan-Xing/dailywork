'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'

import { PhaseAggregateBoard } from './PhaseAggregateBoard'
import { RoadBoard, type RoadBoardHandle } from './RoadBoard'
import type {
  AggregatedPhaseProgress,
  PhaseMeasure,
  RoadSectionProgressDTO,
} from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  roads: RoadSectionProgressDTO[]
  loadError: string | null
  canManage: boolean
  canViewInspections: boolean
}

export function ProgressShell({ roads, loadError, canManage, canViewInspections }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const breadcrumbHome = locale === 'fr' ? 'Accueil' : '首页'
  const breadcrumbProgress = locale === 'fr' ? 'Avancement' : '进度管理'
  const inspectionLabel = locale === 'fr' ? '报检记录' : '报检记录'
  const [viewMode, setViewMode] = useState<'road' | 'phase'>('road')
  const roadBoardRef = useRef<RoadBoardHandle | null>(null)

  const aggregatedPhases = useMemo<Array<AggregatedPhaseProgress>>(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        measure: PhaseMeasure
        totalDesignLength: number
        totalCompletedLength: number
        latestUpdatedAt: number
        roadNames: Set<string>
      }
    >()

    roads.forEach((road) => {
      road.phases.forEach((phase) => {
        const key = `${phase.phaseName}::${phase.phaseMeasure}`
        const designLen = Number.isFinite(phase.designLength) ? phase.designLength : 0
        const completedLen = Number.isFinite(phase.completedLength) ? phase.completedLength : 0
        const updatedAtRaw = new Date(phase.updatedAt).getTime()
        const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : 0
        const existing = map.get(key)
        if (existing) {
          existing.totalDesignLength += designLen
          existing.totalCompletedLength += completedLen
          existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, updatedAt)
          existing.roadNames.add(road.name)
        } else {
          map.set(key, {
            id: key,
            name: phase.phaseName,
            measure: phase.phaseMeasure,
            totalDesignLength: designLen,
            totalCompletedLength: completedLen,
            latestUpdatedAt: updatedAt,
            roadNames: new Set([road.name]),
          })
        }
      })
    })

    const sorted = Array.from(map.values())
      .map((item) => {
        const designTotal = Math.max(0, item.totalDesignLength)
        const completedTotal = Math.max(0, item.totalCompletedLength)
        const percent =
          designTotal <= 0 ? 0 : Math.min(100, Math.round((completedTotal / designTotal) * 100))
        return {
          id: item.id,
          name: item.name,
          measure: item.measure,
          totalDesignLength: Math.round(designTotal * 100) / 100,
          totalCompletedLength: Math.round(completedTotal * 100) / 100,
          completedPercent: percent,
          latestUpdatedAt: item.latestUpdatedAt,
          roadNames: Array.from(item.roadNames),
        }
      })
      .sort((a, b) => {
        if (b.latestUpdatedAt !== a.latestUpdatedAt) {
          return b.latestUpdatedAt - a.latestUpdatedAt
        }
        return a.name.localeCompare(b.name, locale === 'fr' ? 'fr-FR' : 'zh-CN')
      })

    return sorted
  }, [roads, locale])

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
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/10"
                >
                  {inspectionLabel}
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
