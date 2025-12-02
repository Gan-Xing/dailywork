'use client'

import { formatProgressCopy } from '@/lib/i18n/progress'
import type { Locale } from '@/lib/i18n'
import type { AggregatedPhaseProgress } from '@/lib/progressTypes'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'

interface PhaseAggregateCopy {
  empty: string
  roadsLabel: string
  linearSummary: string
  pointSummary: string
  moreUnits: string
  updatedLabel: string
}

interface Props {
  phases: AggregatedPhaseProgress[]
  aggregateCopy: PhaseAggregateCopy
  locale: Locale
}

const formatLocale = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatUnits = (value: number) => Math.round(Math.max(0, value))

const createRoadSummary = (roads: string[]) => {
  if (!roads.length) return ''
  const unique = Array.from(new Set(roads))
  return unique.join(' · ')
}

export function PhaseAggregateBoard({ phases, aggregateCopy, locale }: Props) {
  if (!phases.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
        {aggregateCopy.empty}
      </div>
    )
  }

  const localeId = formatLocale(locale)

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const localizedName = localizeProgressTerm('phase', phase.name, locale)
        const roadSummary = createRoadSummary(phase.roadNames)
        const totalDesign = Math.max(0, phase.totalDesignLength)
        const totalCompleted = Math.max(0, phase.totalCompletedLength)
        const percentLabel = Math.max(0, Math.min(100, phase.completedPercent))
        const updatedAt = Number.isFinite(phase.latestUpdatedAt) && phase.latestUpdatedAt > 0
          ? new Date(phase.latestUpdatedAt).toLocaleString(localeId, { hour12: false })
          : null
        const isPoint = phase.measure === 'POINT'
        const totalUnits = isPoint ? formatUnits(totalDesign) : 0
        const completedUnits = isPoint ? Math.min(formatUnits(totalCompleted), totalUnits) : 0
        const maxDots = 20
        const dotsToRender = Math.min(totalUnits, maxDots)
        const extraDots = totalUnits - dotsToRender

        return (
          <article
            key={phase.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{localizedName}</h3>
                {roadSummary ? (
                  <p className="text-xs text-slate-400">
                    {formatProgressCopy(aggregateCopy.roadsLabel, {
                      roads: roadSummary,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold text-emerald-200">{percentLabel}%</p>
                {updatedAt ? (
                  <p className="text-[11px] text-slate-400">{aggregateCopy.updatedLabel}{updatedAt}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-full bg-slate-900/70 p-1 shadow-inner shadow-slate-900/50">
                <div className="relative h-2 rounded-full bg-slate-800/60">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    style={{ width: `${percentLabel}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-300">
                {formatProgressCopy(
                  isPoint ? aggregateCopy.pointSummary : aggregateCopy.linearSummary,
                  {
                    design: Math.round(totalDesign * 100) / 100,
                    completed: Math.round(totalCompleted * 100) / 100,
                    percent: percentLabel,
                  },
                )}
              </p>
              {isPoint && totalUnits > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {Array.from({ length: dotsToRender }).map((_, idx) => {
                    const isCompleted = idx < completedUnits
                    return (
                      <span
                        key={`${phase.id}-unit-${idx}`}
                        className={`h-5 w-5 rounded-full border ${
                          isCompleted
                            ? 'border-emerald-300 bg-emerald-300/70 shadow shadow-emerald-300/40'
                            : 'border-white/20 bg-slate-800/80'
                        }`}
                      />
                    )
                  })}
                  {extraDots > 0 ? (
                    <span className="text-[11px] text-slate-400">
                      {formatProgressCopy(aggregateCopy.moreUnits, { count: extraDots })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
