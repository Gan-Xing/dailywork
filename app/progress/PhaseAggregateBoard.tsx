'use client'

import { formatProgressCopy } from '@/lib/i18n/progress'
import type { Locale } from '@/lib/i18n'
import type { AggregatedPhaseProgress } from '@/lib/progressTypes'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'

interface PhaseAggregateCopy {
  empty: string
  roadsLabel: string
  linearSummary: string
  pointSummary: string
  moreUnits: string
  updatedLabel: string
  expandAll: string
  collapseAll: string
  expand: string
  collapse: string
  detailRoad: string
  detailDesign: string
  detailCompleted: string
  detailRemaining: string
  detailPercent: string
  detailTotal: string
  detailEmpty: string
}

interface Props {
  phases: AggregatedPhaseProgress[]
  aggregateCopy: PhaseAggregateCopy
  locale: Locale
  expandedPhaseIds: Set<string>
  onTogglePhase: (phaseId: string) => void
}

const formatLocale = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatUnits = (value: number) => Math.round(Math.max(0, value))
const formatMetric = (value: number, isPoint: boolean) =>
  isPoint ? formatUnits(value) : Math.round(Math.max(0, value) * 100) / 100

const createRoadSummary = (roads: string[]) => {
  if (!roads.length) return ''
  const unique = Array.from(new Set(roads))
  return unique.join(' · ')
}

export function PhaseAggregateBoard({
  phases,
  aggregateCopy,
  locale,
  expandedPhaseIds,
  onTogglePhase,
}: Props) {
  if (!phases.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
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
        const totalRemaining = Math.max(totalDesign - totalCompleted, 0)
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
        const isExpanded = expandedPhaseIds.has(phase.id)

        return (
          <article
            key={phase.id}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            onClick={() => onTogglePhase(phase.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onTogglePhase(phase.id)
              }
            }}
            className="cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="break-words text-base font-semibold text-slate-900 sm:text-lg">{localizedName}</h3>
                {roadSummary ? (
                  <p className="break-words text-xs text-slate-500">
                    {formatProgressCopy(aggregateCopy.roadsLabel, {
                      roads: roadSummary,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-left sm:text-right">
                <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {isExpanded ? aggregateCopy.collapse : aggregateCopy.expand}
                </span>
                <p className="text-sm font-semibold text-emerald-700">{percentLabel}%</p>
                {updatedAt ? (
                  <p className="text-[11px] text-slate-500">{aggregateCopy.updatedLabel}{updatedAt}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-full bg-slate-100 p-1 shadow-inner shadow-slate-200/60">
                <div className="relative h-2 rounded-full bg-slate-200">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    style={{ width: `${percentLabel}%` }}
                  />
                </div>
              </div>
              <p className="break-words text-xs leading-relaxed text-slate-600">
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
                            ? 'border-emerald-300 bg-emerald-300/70 shadow shadow-emerald-200/60'
                            : 'border-slate-200 bg-slate-100'
                        }`}
                      />
                    )
                  })}
                  {extraDots > 0 ? (
                    <span className="text-[11px] text-slate-500">
                      {formatProgressCopy(aggregateCopy.moreUnits, { count: extraDots })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {isExpanded ? (
              <div
                className="mt-4 rounded-2xl border border-slate-200 bg-slate-50"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {phase.roadBreakdown.length ? (
                  <>
                    <div className="space-y-2 p-2 md:hidden">
                      {phase.roadBreakdown.map((item) => (
                        <div
                          key={`${phase.id}-${item.roadId}`}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <p className="break-words text-sm font-semibold text-slate-900">
                            {resolveRoadName(
                              {
                                slug: item.roadSlug,
                                name: item.roadName,
                                labels: item.roadLabels,
                              },
                              locale,
                            )}
                          </p>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[11px] text-slate-600">
                            <span>{aggregateCopy.detailDesign}</span>
                            <span className="text-right font-semibold tabular-nums text-slate-900">
                              {formatMetric(item.designLength, isPoint)}
                            </span>
                            <span>{aggregateCopy.detailCompleted}</span>
                            <span className="text-right font-semibold tabular-nums text-slate-900">
                              {formatMetric(item.completedLength, isPoint)}
                            </span>
                            <span>{aggregateCopy.detailRemaining}</span>
                            <span className="text-right font-semibold tabular-nums text-slate-900">
                              {formatMetric(item.remainingLength, isPoint)}
                            </span>
                            <span>{aggregateCopy.detailPercent}</span>
                            <span className="text-right font-semibold tabular-nums text-emerald-700">
                              {item.completedPercent}%
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-xl border border-slate-300 bg-slate-100 p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[11px] text-slate-700">
                          <span className="font-semibold">{aggregateCopy.detailTotal}</span>
                          <span className="text-right font-semibold text-slate-900">{percentLabel}%</span>
                          <span>{aggregateCopy.detailDesign}</span>
                          <span className="text-right font-semibold tabular-nums text-slate-900">
                            {formatMetric(totalDesign, isPoint)}
                          </span>
                          <span>{aggregateCopy.detailCompleted}</span>
                          <span className="text-right font-semibold tabular-nums text-slate-900">
                            {formatMetric(totalCompleted, isPoint)}
                          </span>
                          <span>{aggregateCopy.detailRemaining}</span>
                          <span className="text-right font-semibold tabular-nums text-slate-900">
                            {formatMetric(totalRemaining, isPoint)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="min-w-full table-fixed text-xs text-slate-700">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="w-[40%] px-3 py-2 text-left font-semibold">{aggregateCopy.detailRoad}</th>
                            <th className="px-3 py-2 text-right font-semibold">{aggregateCopy.detailDesign}</th>
                            <th className="px-3 py-2 text-right font-semibold">{aggregateCopy.detailCompleted}</th>
                            <th className="px-3 py-2 text-right font-semibold">{aggregateCopy.detailRemaining}</th>
                            <th className="px-3 py-2 text-right font-semibold">{aggregateCopy.detailPercent}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phase.roadBreakdown.map((item) => (
                            <tr key={`${phase.id}-${item.roadId}`} className="border-t border-slate-200">
                              <td className="break-words px-3 py-2 font-medium text-slate-900">
                                {resolveRoadName(
                                  {
                                    slug: item.roadSlug,
                                    name: item.roadName,
                                    labels: item.roadLabels,
                                  },
                                  locale,
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMetric(item.designLength, isPoint)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMetric(item.completedLength, isPoint)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMetric(item.remainingLength, isPoint)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.completedPercent}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 bg-slate-100/80 text-slate-800">
                            <td className="px-3 py-2 font-semibold">{aggregateCopy.detailTotal}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatMetric(totalDesign, isPoint)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatMetric(totalCompleted, isPoint)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatMetric(totalRemaining, isPoint)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{percentLabel}%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-3 text-xs text-slate-500">
                    {aggregateCopy.detailEmpty}
                  </div>
                )}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
