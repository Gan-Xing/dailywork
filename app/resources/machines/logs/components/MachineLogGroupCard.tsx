'use client'

import Link from 'next/link'

import type { ResourcesCopy } from '@/lib/i18n/resources'
import type { MachineLogGroupSummary } from '@/types/machineLogs'

const formatNumber = (value: number | null) => {
  if (value == null) return '—'
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

export function MachineLogGroupCard({
  t,
  summary,
  date,
  projectId,
  mineOnly,
}: {
  t: ResourcesCopy
  summary: MachineLogGroupSummary
  date: string
  projectId: string
  mineOnly: boolean
}) {
  const params = new URLSearchParams()
  params.set('date', date)
  if (projectId) params.set('projectId', projectId)
  if (mineOnly) params.set('mine', '1')

  const href = `/resources/machines/logs/${encodeURIComponent(summary.groupBy)}/${encodeURIComponent(
    summary.groupKey,
  )}?${params.toString()}`

  const issues = summary.issues.negativeFuelConsumedCount + summary.issues.missingFuelRemainingEndCount

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10"
    >
      <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gradient-to-br from-sky-200 via-indigo-200 to-emerald-200 opacity-50 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 truncate">{summary.groupLabel}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {summary.machineCount} 台 · {t.machineLogs.labels.filledLogs} {summary.filledCount} ·{' '}
            {t.machineLogs.labels.missingLogs} {summary.missingCount}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
            {t.machineLogs.labels.fuelAddedTotal}: {formatNumber(summary.fuelAddedTotal)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
            {t.machineLogs.labels.dailyFuelConsumed}: {formatNumber(summary.fuelConsumedTotal)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
            {t.machineLogs.labels.dailyDepreciation}: {formatNumber(summary.dailyDepreciationTotal)}
          </span>
          {issues > 0 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700 ring-1 ring-rose-200">
              {t.machineLogs.labels.issues}: {issues}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {t.machineLogs.labels.issues}: 0
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {t.machineLogs.actions.enterGroup}
          </span>
          <span className="text-slate-400 transition group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
