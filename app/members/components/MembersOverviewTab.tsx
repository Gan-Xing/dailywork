'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { EMPTY_FILTER_VALUE } from '@/lib/members/constants'
import { formatSupervisorLabel, normalizeText } from '@/lib/members/utils'
import type { Member } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type Props = {
  t: MemberCopy
  locale: Locale
  members: Member[]
  loading: boolean
  error: string | null
  canViewPayroll: boolean
  projectFilterOptions: MultiSelectOption[]
  statusFilterOptions: MultiSelectOption[]
  nationalityFilterOptions: MultiSelectOption[]
  teamFilterOptions: MultiSelectOption[]
  projectFilters: string[]
  statusFilters: string[]
  nationalityFilters: string[]
  teamFilters: string[]
  onProjectFiltersChange: (value: string[]) => void
  onStatusFiltersChange: (value: string[]) => void
  onNationalityFiltersChange: (value: string[]) => void
  onTeamFiltersChange: (value: string[]) => void
}

type BarItem = {
  label: string
  value: number
  color: string
  meta?: string
}

type TeamSortMode = 'count' | 'avgPayroll' | 'medianPayroll'

type TeamStatsItem = {
  label: string
  value: number
  payrollTotal: number
  payrollAverage: number
  payrollMedian: number
}

type TeamBarItem = TeamStatsItem & {
  color: string
}

type ContractCostItem = {
  label: string
  total: number
  avg: number
  count: number
  color: string
}

type SupervisorTeamDetail = {
  name: string
  count: number
  percent: number
}

type SupervisorItem = {
  label: string
  value: number
  teamDetails: SupervisorTeamDetail[]
  maxTeamCount: number
  payrollTotal: number
  payrollAverage: number
  payrollMedian: number
}

type DonutItem = {
  label: string
  value: number
  color: string
}

type PayrollPayout = {
  userId: number
  amount: string
}

const CHART_COLORS = [
  '#0ea5e9',
  '#f97316',
  '#10b981',
  '#6366f1',
  '#f43f5e',
  '#14b8a6',
  '#eab308',
  '#8b5cf6',
  '#22d3ee',
  '#0f766e',
  '#ec4899',
  '#84cc16',
  '#a855f7',
  '#f59e0b',
  '#06b6d4',
  '#d946ef',
]

const HOURS_PER_MONTH_CTJ = 22 * 8
const SALARY_RANGES = [
  { min: 0, max: 0 },
  { min: 1, max: 100000 },
  { min: 100001, max: 200000 },
  { min: 200001, max: 300000 },
  { min: 300001, max: 500000 },
  { min: 500001, max: Number.POSITIVE_INFINITY },
]

const toLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const parseNumber = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const getLastMonthKey = () => {
  const date = new Date()
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  utc.setUTCMonth(utc.getUTCMonth() - 1)
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
  }
}

const matchesValueFilter = (value: string | null | undefined, filters: string[]) => {
  if (filters.length === 0) return true
  const normalized = normalizeText(value)
  if (!normalized) return filters.includes(EMPTY_FILTER_VALUE)
  return filters.includes(normalized)
}

const resolveMonthlySalary = (member: Member) => {
  const profile = member.expatProfile
  if (!profile) return 0
  const netMonthly = parseNumber(profile.netMonthlyAmount)
  if (netMonthly !== null) {
    return profile.netMonthlyUnit === 'HOUR' ? netMonthly * HOURS_PER_MONTH_CTJ : netMonthly
  }
  const baseSalary = parseNumber(profile.baseSalaryAmount) ?? 0
  const prime = parseNumber(profile.prime) ?? 0
  const baseMonthly =
    profile.baseSalaryUnit === 'HOUR' ? baseSalary * HOURS_PER_MONTH_CTJ : baseSalary
  return Math.max(0, baseMonthly + prime)
}

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const buildSalaryDistribution = (
  values: number[],
  formatMoney: (value: number) => string,
) => {
  const labels = SALARY_RANGES.map((range) => {
    if (range.min === 0 && range.max === 0) return '0'
    if (range.max === Number.POSITIVE_INFINITY) return `${formatMoney(range.min)}+`
    return `${formatMoney(range.min)}-${formatMoney(range.max)}`
  })
  const counts = SALARY_RANGES.map(() => 0)
  values.forEach((value) => {
    const index = SALARY_RANGES.findIndex(
      (range) => value >= range.min && value <= range.max,
    )
    if (index >= 0) counts[index] += 1
  })
  return labels.map((label, idx) => ({
    label,
    value: counts[idx],
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }))
}

const buildTopItems = (items: Array<{ label: string; value: number }>, limit: number, otherLabel: string) => {
  if (items.length <= limit) return items
  const head = items.slice(0, limit - 1)
  const restTotal = items.slice(limit - 1).reduce((sum, item) => sum + item.value, 0)
  return [...head, { label: otherLabel, value: restTotal }]
}

const OverviewCard = ({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md h-full flex flex-col">
    <div className="mb-5 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {badge ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-600">
          {badge}
        </span>
      ) : null}
    </div>
    <div className="flex-1 min-h-0">
      {children}
    </div>
  </div>
)

const DonutChart = ({
  items,
  totalLabel,
  formatValue,
  emptyLabel,
}: {
  items: DonutItem[]
  totalLabel: string
  formatValue: (value: number) => string
  emptyLabel: string
}) => {
  const visibleItems = items.filter((item) => item.value > 0)
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm font-medium text-slate-400">{emptyLabel}</p>
      </div>
    )
  }
  const segments = visibleItems.reduce(
    (acc, item) => {
      const angle = (item.value / total) * 360
      const end = acc.start + angle
      return {
        start: end,
        segments: [...acc.segments, `${item.color} ${acc.start}deg ${end}deg`],
      }
    },
    { start: 0, segments: [] as string[] },
  ).segments

  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-center h-full justify-center">
      <div className="relative h-40 w-40 shrink-0 filter drop-shadow-sm self-center sm:self-auto">
        <div
          className="absolute inset-0 rounded-full"
          style={{ backgroundImage: `conic-gradient(${segments.join(',')})` }}
        />
        <div className="absolute inset-[18%] rounded-full bg-white shadow-inner" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-500 pointer-events-none p-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{totalLabel}</span>
          <span className="text-2xl font-extrabold text-slate-900 leading-none">{formatValue(total)}</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2.5">
        {visibleItems.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div key={item.label} className="group flex items-center justify-between gap-3 text-sm rounded-lg hover:bg-slate-50 p-1.5 -mx-1.5 transition-colors">
              <div className="flex items-center gap-3 overflow-hidden">
                <span 
                  className="h-3 w-3 shrink-0 rounded-full shadow-sm ring-2 ring-white" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="truncate font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                  {item.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="font-bold text-slate-900">{formatValue(item.value)}</span>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full min-w-[3rem] text-center">{percent}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const BarList = ({
  items,
  formatValue,
  emptyLabel,
}: {
  items: BarItem[]
  formatValue: (value: number) => string
  emptyLabel: string
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="space-y-5">
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
        return (
          <div key={item.label} className="group">
            <div className="mb-2 flex items-end justify-between gap-2">
              <span className="truncate font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
                {item.label}
              </span>
              <div className="text-right shrink-0">
                <span className="text-base font-bold text-slate-900">{formatValue(item.value)}</span>
                <span className="ml-1 text-xs font-medium text-slate-400">{percent}%</span>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-100/50">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-95 relative"
                style={{
                  width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                  backgroundColor: item.color,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
              </div>
            </div>
            {item.meta ? (
              <div className="mt-2 text-[10px] text-slate-400">{item.meta}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

const ContractCostBulletList = ({
  items,
  formatMoney,
  formatNumber,
  emptyLabel,
  labels,
}: {
  items: ContractCostItem[]
  formatMoney: (value: number) => string
  formatNumber: (value: number) => string
  emptyLabel: string
  labels: {
    people: string
    payrollAverage: string
  }
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const maxTotal = Math.max(...items.map((item) => item.total), 1)
  const maxAvg = Math.max(...items.map((item) => item.avg), 1)
  const totalSum = items.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="space-y-5">
      {items.map((item) => {
        const percent = totalSum > 0 ? Math.round((item.total / totalSum) * 100) : 0
        const totalRatio = Math.max(item.total / maxTotal, 0.02)
        const avgRatio = Math.min(Math.max(item.avg / maxAvg, 0), 1)
        const avgLeft = Math.min(Math.max(avgRatio, 0.02), 0.98) * 100

        return (
          <div key={item.label} className="group">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-semibold text-slate-700">{item.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-bold text-slate-900">{formatMoney(item.total)}</span>
                <span className="ml-1 text-xs font-medium text-slate-400">{percent}%</span>
              </div>
            </div>
            <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-100/60">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-95 relative"
                style={{
                  width: `${totalRatio * 100}%`,
                  backgroundColor: item.color,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
              </div>
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow-sm"
                style={{
                  left: `${avgLeft}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex flex-wrap gap-x-2">
              <span>
                <span className="font-medium text-slate-500">{labels.payrollAverage}</span>
                <span className="ml-1">{formatMoney(item.avg)}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <span className="font-medium text-slate-500">{formatNumber(item.count)}</span>
                <span className="ml-1">{labels.people}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TeamCostHeatmap = ({
  items,
  formatMoney,
  formatNumber,
  formatRatio,
  emptyLabel,
  hint,
  labels,
}: {
  items: TeamStatsItem[]
  formatMoney: (value: number) => string
  formatNumber: (value: number) => string
  formatRatio: (value: number) => string
  emptyLabel: string
  hint: string
  labels: {
    team: string
    people: string
    payrollTotal: string
    payrollAverage: string
    payrollMedian: string
    payrollRatio: string
  }
}) => {
  const hasPayroll = items.some((item) => item.payrollTotal > 0)
  if (!hasPayroll) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }

  const rows = items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.payrollTotal - a.payrollTotal)

  const metrics = rows.map((item) => ({
    count: item.value,
    total: item.payrollTotal,
    avg: item.payrollAverage,
    median: item.payrollMedian,
    ratio: item.payrollMedian > 0 ? item.payrollAverage / item.payrollMedian : 0,
  }))

  const getRange = (values: number[]) => {
    const min = Math.min(...values)
    const max = Math.max(...values, min + 1)
    return { min, max }
  }

  const ranges = {
    count: getRange(metrics.map((item) => item.count)),
    total: getRange(metrics.map((item) => item.total)),
    avg: getRange(metrics.map((item) => item.avg)),
    median: getRange(metrics.map((item) => item.median)),
    ratio: getRange(metrics.map((item) => item.ratio)),
  }

  const hues = {
    count: 200,
    total: 220,
    avg: 40,
    median: 280,
    ratio: 0,
  }

  const metricRows = [
    {
      key: 'count',
      label: labels.people,
      range: ranges.count,
      hue: hues.count,
      formatValue: formatNumber,
      getValue: (metric: (typeof metrics)[number]) => metric.count,
    },
    {
      key: 'total',
      label: labels.payrollTotal,
      range: ranges.total,
      hue: hues.total,
      formatValue: formatMoney,
      getValue: (metric: (typeof metrics)[number]) => metric.total,
    },
    {
      key: 'avg',
      label: labels.payrollAverage,
      range: ranges.avg,
      hue: hues.avg,
      formatValue: formatMoney,
      getValue: (metric: (typeof metrics)[number]) => metric.avg,
    },
    {
      key: 'median',
      label: labels.payrollMedian,
      range: ranges.median,
      hue: hues.median,
      formatValue: formatMoney,
      getValue: (metric: (typeof metrics)[number]) => metric.median,
    },
    {
      key: 'ratio',
      label: labels.payrollRatio,
      range: ranges.ratio,
      hue: hues.ratio,
      formatValue: formatRatio,
      getValue: (metric: (typeof metrics)[number]) => metric.ratio,
    },
  ] as const

  const getCellStyle = (value: number, range: { min: number; max: number }, hue: number) => {
    const t = (value - range.min) / Math.max(range.max - range.min, 1)
    const lightness = 95 - t * 45 // Slightly lighter base for better text contrast
    return {
      backgroundColor: `hsl(${hue} 70% ${lightness}%)`,
      color: lightness < 65 ? '#ffffff' : '#1e293b', // Darker text for light backgrounds, white for dark
    }
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {/* Mobile: one team per row */}
        <table className="min-w-full text-xs xl:hidden">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-bold sticky top-0 bg-slate-50 z-10">{labels.team}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.people}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.payrollTotal}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.payrollAverage}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item, index) => {
              const metric = metrics[index]
              return (
                <tr key={item.label} className="group hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800 font-bold truncate bg-white group-hover:bg-slate-50" title={item.label}>
                    {item.label}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-medium"
                    style={getCellStyle(metric.count, ranges.count, hues.count)}
                  >
                    {formatNumber(metric.count)}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-medium"
                    style={getCellStyle(metric.total, ranges.total, hues.total)}
                  >
                    {formatMoney(metric.total)}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-medium"
                    style={getCellStyle(metric.avg, ranges.avg, hues.avg)}
                  >
                    {formatMoney(metric.avg)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Desktop: one metric per row, teams as columns */}
        <table className="hidden min-w-max text-xs xl:table border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-bold bg-slate-50 text-slate-500 border-b border-r border-slate-200 sticky left-0 z-20 w-32 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                 {/* Empty corner cell */}
              </th>
              {rows.map((item) => (
                <th
                  key={item.label}
                  className="px-4 py-3 text-center font-bold text-slate-600 bg-slate-50 border-b border-slate-200 whitespace-nowrap min-w-[80px]"
                  title={item.label}
                >
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((metricRow) => (
              <tr key={metricRow.key}>
                <td className="px-4 py-3 text-slate-600 font-bold bg-slate-50 border-r border-b border-slate-200 sticky left-0 z-10 whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                  {metricRow.label}
                </td>
                {rows.map((item, index) => {
                  const metric = metrics[index]
                  const value = metricRow.getValue(metric)
                  return (
                    <td
                      key={`${metricRow.key}-${item.label}`}
                      className="px-4 py-3 text-center font-medium border-b border-white whitespace-nowrap transition-opacity hover:opacity-90"
                      style={getCellStyle(value, metricRow.range, metricRow.hue)}
                    >
                      {metricRow.formatValue(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 px-1 italic">{hint}</p>
    </div>
  )
}

const TeamDistributionGrid = ({
  items,
  missing,
  t,
  showPayroll,
  sortMode,
  onSortChange,
  formatMoney,
}: {
  items: TeamBarItem[]
  missing: number
  t: MemberCopy
  showPayroll: boolean
  sortMode: TeamSortMode
  onSortChange: (mode: TeamSortMode) => void
  formatMoney: (value: number) => string
}) => {
  if (items.length === 0 && missing === 0) return null
  
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  const total = items.reduce((sum, item) => sum + item.value, 0) + missing

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
         <div>
            <h3 className="text-lg font-bold text-slate-900">{t.overview.charts.team}</h3>
            <p className="text-sm text-slate-500 mt-1">
               {t.overview.labels.localScope}
            </p>
         </div>
         <div className="flex flex-col items-end gap-2 text-right">
            {showPayroll ? (
              <div className="inline-flex rounded-full bg-slate-100 p-1 text-[10px] font-semibold text-slate-500">
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 transition-all ${
                    sortMode === 'count'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => onSortChange('count')}
                  aria-pressed={sortMode === 'count'}
                >
                  {t.overview.labels.teamSortCount}
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 transition-all ${
                    sortMode === 'avgPayroll'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => onSortChange('avgPayroll')}
                  aria-pressed={sortMode === 'avgPayroll'}
                >
                  {t.overview.labels.teamSortAvg}
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 transition-all ${
                    sortMode === 'medianPayroll'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => onSortChange('medianPayroll')}
                  aria-pressed={sortMode === 'medianPayroll'}
                >
                  {t.overview.labels.teamSortMedian}
                </button>
              </div>
            ) : null}
            <div>
               <span className="text-2xl font-bold text-slate-900">{total}</span>
               <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.overview.labels.people}</span>
            </div>
         </div>
      </div>
      
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
           const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
           return (
             <div key={item.label} className="group relative">
                <div className="mb-2 flex items-end justify-between">
                   <div className="flex flex-col min-w-0 pr-2">
                       <span className="font-bold text-slate-700 truncate" title={item.label}>{item.label}</span>
                   </div>
                   <div className="text-right shrink-0">
                      <span className="text-xl font-bold text-slate-900 leading-none">{item.value}</span>
                      <span className="ml-1 text-xs font-medium text-slate-400">{percent}%</span>
                   </div>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-100/50">
                   <div 
                      className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-95 relative"
                      style={{ 
                        width: `${(item.value / maxValue) * 100}%`,
                        backgroundColor: item.color 
                      }}
                   >
                     <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                   </div>
                </div>
                {showPayroll ? (
                  <div className="mt-2 text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                    <span>
                      <span className="font-medium text-slate-500">{t.overview.labels.payrollTotal}</span>
                      <span className="ml-1">{formatMoney(item.payrollTotal)}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      <span className="font-medium text-slate-500">{t.overview.labels.payrollAverage}</span>
                      <span className="ml-1">{formatMoney(item.payrollAverage)}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      <span className="font-medium text-slate-500">{t.overview.labels.payrollMedian}</span>
                      <span className="ml-1">{formatMoney(item.payrollMedian)}</span>
                    </span>
                  </div>
                ) : null}
             </div>
           )
        })}
      </div>
      
      {missing > 0 && (
        <div className="mt-8 border-t border-slate-100 pt-4">
           <p className="text-xs font-medium text-slate-400 text-center">
              {t.overview.labels.unassignedTeam}: {missing}
           </p>
        </div>
      )}
    </div>
  )
}

const SupervisorPowerGrid = ({
  items,
  missing,
  t,
  showPayroll,
  sortMode,
  onSortChange,
  formatMoney,
}: {
  items: SupervisorItem[]
  missing: number
  t: MemberCopy
  showPayroll: boolean
  sortMode: TeamSortMode
  onSortChange: (mode: TeamSortMode) => void
  formatMoney: (value: number) => string
}) => {
  if (items.length === 0 && missing === 0) return null
  const maxSupervisorCount = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
         <div>
            <h3 className="text-lg font-bold text-slate-900">{t.overview.charts.supervisor}</h3>
            <p className="text-sm text-slate-500 mt-1">
               {t.overview.labels.localScope}
            </p>
         </div>
         {showPayroll ? (
           <div className="inline-flex rounded-full bg-slate-100 p-1 text-[10px] font-semibold text-slate-500">
             <button
               type="button"
               className={`rounded-full px-2.5 py-1 transition-all ${
                 sortMode === 'count'
                   ? 'bg-white text-slate-900 shadow-sm'
                   : 'text-slate-500 hover:text-slate-700'
               }`}
               onClick={() => onSortChange('count')}
               aria-pressed={sortMode === 'count'}
             >
               {t.overview.labels.teamSortCount}
             </button>
             <button
               type="button"
               className={`rounded-full px-2.5 py-1 transition-all ${
                 sortMode === 'avgPayroll'
                   ? 'bg-white text-slate-900 shadow-sm'
                   : 'text-slate-500 hover:text-slate-700'
               }`}
               onClick={() => onSortChange('avgPayroll')}
               aria-pressed={sortMode === 'avgPayroll'}
             >
               {t.overview.labels.teamSortAvg}
             </button>
             <button
               type="button"
               className={`rounded-full px-2.5 py-1 transition-all ${
                 sortMode === 'medianPayroll'
                   ? 'bg-white text-slate-900 shadow-sm'
                   : 'text-slate-500 hover:text-slate-700'
               }`}
               onClick={() => onSortChange('medianPayroll')}
               aria-pressed={sortMode === 'medianPayroll'}
             >
               {t.overview.labels.teamSortMedian}
             </button>
           </div>
         ) : null}
      </div>
      
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          return (
            <div key={item.label} className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md overflow-hidden">
               <div className="p-5 pb-3">
                 <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 text-base block truncate" title={item.label}>
                        {item.label}
                      </span>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                           <div
                              className="h-full rounded-full bg-slate-400"
                              style={{ width: `${(item.value / maxSupervisorCount) * 100}%` }}
                           />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-2xl font-bold text-slate-900 leading-none">
                        {item.value}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">
                        Total
                      </span>
                    </div>
                 </div>
               </div>
               
               {showPayroll ? (
                  <div className="bg-slate-50 border-y border-slate-100 px-5 py-3">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t.overview.labels.payrollTotal}</span>
                      <span className="font-bold text-slate-700 font-mono text-sm">{formatMoney(item.payrollTotal)}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-slate-200/50 pt-2">
                       <span className="text-[10px] text-slate-400 font-medium">
                         {t.overview.labels.payrollAverage} / {t.overview.labels.payrollMedian}
                       </span>
                       <span className="text-xs font-semibold text-slate-600 font-mono">
                         {formatMoney(item.payrollAverage)} / {formatMoney(item.payrollMedian)}
                       </span>
                    </div>
                  </div>
                ) : null}
               
               <div className="flex-1 space-y-3 p-5 pt-4">
                 {item.teamDetails.map((team, idx) => (
                    <div key={team.name} className="group">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-slate-600 truncate pr-2" title={team.name}>
                          {team.name}
                        </span>
                        <div className="text-right shrink-0 flex items-baseline gap-1">
                          <span className="text-xs font-bold text-slate-700">{team.count}</span>
                          <span className="text-[10px] text-slate-400">({team.percent}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-slate-400 group-hover:bg-slate-600 transition-colors"
                          style={{ width: `${team.percent}%` }}
                        />
                      </div>
                    </div>
                 ))}
                 {item.teamDetails.length === 0 && (
                     <p className="text-xs text-slate-400 italic text-center py-2">
                        {t.overview.labels.unassignedTeam}
                     </p>
                 )}
               </div>
            </div>
          )
        })}
      </div>
      
      {missing > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
           <p className="text-xs font-medium text-slate-400 text-center">
              {t.overview.labels.unassignedSupervisor}: {missing}
           </p>
        </div>
      )}
    </div>
  )
}

export function MembersOverviewTab({
  t,
  locale,
  members,
  loading,
  error,
  canViewPayroll,
  projectFilterOptions,
  statusFilterOptions,
  nationalityFilterOptions,
  teamFilterOptions,
  projectFilters,
  statusFilters,
  nationalityFilters,
  teamFilters,
  onProjectFiltersChange,
  onStatusFiltersChange,
  onNationalityFiltersChange,
  onTeamFiltersChange,
}: Props) {
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(toLocaleId(locale)),
    [locale],
  )
  const ratioFormatter = useMemo(
    () => new Intl.NumberFormat(toLocaleId(locale), { maximumFractionDigits: 2 }),
    [locale],
  )
  const formatNumber = useCallback(
    (value: number) => numberFormatter.format(Math.round(value)),
    [numberFormatter],
  )
  const formatMoney = useCallback(
    (value: number) => numberFormatter.format(Math.round(value)),
    [numberFormatter],
  )
  const formatRatio = useCallback(
    (value: number) => ratioFormatter.format(value),
    [ratioFormatter],
  )
  const nameCollator = useMemo(
    () => new Intl.Collator(toLocaleId(locale), { numeric: true, sensitivity: 'base' }),
    [locale],
  )

  const [payrollPayouts, setPayrollPayouts] = useState<PayrollPayout[]>([])
  const [payrollReady, setPayrollReady] = useState(false)
  const [viewMode, setViewMode] = useState<'overview' | 'detail' | 'compare'>('overview')
  const [teamSortMode, setTeamSortMode] = useState<TeamSortMode>('count')
  const [supervisorSortMode, setSupervisorSortMode] = useState<TeamSortMode>('count')

  // Fetch payroll data when permission is granted
  useEffect(() => {
    if (!canViewPayroll) return

    let cancelled = false
    const { year, month } = getLastMonthKey()
    
    fetch(`/api/payroll-runs?year=${year}&month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load payroll')
        return res.json() as Promise<{ payouts?: PayrollPayout[] }>
      })
      .then((data) => {
        if (cancelled) return
        setPayrollPayouts(Array.isArray(data.payouts) ? data.payouts : [])
        setPayrollReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setPayrollPayouts([])
        setPayrollReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [canViewPayroll])

  const showTeamPayroll = canViewPayroll && payrollReady

  const payrollPayoutsByMemberId = useMemo(() => {
    const map = new Map<number, number>()
    if (!showTeamPayroll) return map
    payrollPayouts.forEach((payout) => {
      const amount = parseNumber(payout.amount)
      if (amount === null) return
      map.set(payout.userId, (map.get(payout.userId) ?? 0) + amount)
    })
    return map
  }, [payrollPayouts, showTeamPayroll])

  const filterControlProps = {
    allLabel: t.filters.all,
    selectedLabel: t.filters.selected,
    selectAllLabel: t.filters.selectAll,
    clearLabel: t.filters.clear,
    searchPlaceholder: t.filters.searchPlaceholder,
    noOptionsLabel: t.filters.noOptions,
  }

  const scopedMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!matchesValueFilter(member.project?.name ?? null, projectFilters)) return false
        if (!matchesValueFilter(member.employmentStatus, statusFilters)) return false
        if (!matchesValueFilter(member.nationality, nationalityFilters)) return false
        if (!matchesValueFilter(member.expatProfile?.team ?? null, teamFilters)) return false
        return true
      }),
    [members, projectFilters, statusFilters, nationalityFilters, teamFilters],
  )

  const localMembers = useMemo(
    () => scopedMembers.filter((member) => Boolean(member.expatProfile)),
    [scopedMembers],
  )

  const nationalityStats = useMemo(() => {
    let china = 0
    let nonChina = 0
    let unknown = 0
    scopedMembers.forEach((member) => {
      if (member.nationality === 'china') {
        china += 1
      } else if (normalizeText(member.nationality)) {
        nonChina += 1
      } else {
        unknown += 1
      }
    })
    return { china, nonChina, unknown }
  }, [scopedMembers])

  const teamStats = useMemo(() => {
    const map = new Map<string, { count: number; payrollTotal: number; salaries: number[] }>()
    let missing = 0
    const teamMembers = localMembers.filter(m => m.nationality !== 'china')
    
    teamMembers.forEach((member) => {
      const team = normalizeText(member.expatProfile?.team)
      if (!team) {
        missing += 1
        return
      }
      const current = map.get(team) ?? { count: 0, payrollTotal: 0, salaries: [] }
      current.count += 1
      if (showTeamPayroll) {
        const salary = payrollPayoutsByMemberId.get(member.id) ?? 0
        current.payrollTotal += salary
        current.salaries.push(salary)
      }
      map.set(team, current)
    })
    const items: TeamStatsItem[] = Array.from(map.entries()).map(([label, data]) => ({
      label,
      value: data.count,
      payrollTotal: data.payrollTotal,
      payrollAverage: data.count ? data.payrollTotal / data.count : 0,
      payrollMedian: calculateMedian(data.salaries),
    }))

    return {
      items,
      missing,
    }
  }, [localMembers, payrollPayoutsByMemberId, showTeamPayroll])

  const sortedTeamItems = useMemo(() => {
    const mode: TeamSortMode = showTeamPayroll ? teamSortMode : 'count'
    const list = [...teamStats.items]
    const getSortValue = (item: TeamStatsItem) =>
      mode === 'avgPayroll'
        ? item.payrollAverage
        : mode === 'medianPayroll'
          ? item.payrollMedian
          : item.value
    list.sort((a, b) => {
      const diff = getSortValue(b) - getSortValue(a)
      if (diff !== 0) return diff
      if (a.value !== b.value) return b.value - a.value
      return nameCollator.compare(a.label, b.label)
    })
    return list.map((item, idx): TeamBarItem => ({
      ...item,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [teamStats.items, teamSortMode, showTeamPayroll, nameCollator])

  const supervisorStats = useMemo(() => {
    const map = new Map<string, { count: number, teamCounts: Map<string, number>, payrollTotal: number, salaries: number[] }>()
    let missing = 0
    localMembers.forEach((member) => {
      const supervisor = member.expatProfile?.chineseSupervisor
      const label = normalizeText(
        formatSupervisorLabel({
          name: supervisor?.name ?? null,
          frenchName: supervisor?.chineseProfile?.frenchName ?? null,
          username: supervisor?.username ?? null,
        }),
      )
      if (!label) {
        missing += 1
        return
      }
      
      const current = map.get(label) ?? { count: 0, teamCounts: new Map<string, number>(), payrollTotal: 0, salaries: [] }
      current.count += 1
      
      if (showTeamPayroll) {
         const salary = payrollPayoutsByMemberId.get(member.id) ?? 0
         current.payrollTotal += salary
         current.salaries.push(salary)
      }
      
      const teamName = normalizeText(member.expatProfile?.team)
      if (teamName) {
        current.teamCounts.set(teamName, (current.teamCounts.get(teamName) ?? 0) + 1)
      } else {
        const unassignedLabel = t.overview.labels.unassignedTeam
        current.teamCounts.set(unassignedLabel, (current.teamCounts.get(unassignedLabel) ?? 0) + 1)
      }
      
      map.set(label, current)
    })
    
    const items = Array.from(map.entries()).map(([label, data]) => {
      const teamDetails: SupervisorTeamDetail[] = Array.from(data.teamCounts.entries())
        .map(([name, count]) => ({
           name,
           count,
           percent: Math.round((count / data.count) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        
      return { 
        label, 
        value: data.count,
        teamDetails,
        maxTeamCount: teamDetails.length > 0 ? teamDetails[0].count : 0,
        payrollTotal: data.payrollTotal,
        payrollAverage: data.count ? data.payrollTotal / data.count : 0,
        payrollMedian: calculateMedian(data.salaries)
      }
    })

    return {
      items,
      missing,
    }
  }, [
    localMembers,
    t.overview.labels.unassignedTeam,
    payrollPayoutsByMemberId,
    showTeamPayroll,
  ])

  const sortedSupervisorItems = useMemo(() => {
    const mode: TeamSortMode = showTeamPayroll ? supervisorSortMode : 'count'
    const list = [...supervisorStats.items]
    const getSortValue = (item: SupervisorItem) =>
      mode === 'avgPayroll'
        ? item.payrollAverage
        : mode === 'medianPayroll'
          ? item.payrollMedian
          : item.value
    list.sort((a, b) => {
      const diff = getSortValue(b) - getSortValue(a)
      if (diff !== 0) return diff
      if (a.value !== b.value) return b.value - a.value
      return nameCollator.compare(a.label, b.label)
    })
    return list
  }, [supervisorStats.items, supervisorSortMode, showTeamPayroll, nameCollator])

  const provenanceStats = useMemo(() => {
    const map = new Map<string, number>()
    let missing = 0
    localMembers.forEach((member) => {
      const value = normalizeText(member.expatProfile?.provenance)
      if (!value) {
        missing += 1
        return
      }
      map.set(value, (map.get(value) ?? 0) + 1)
    })
    const sorted = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
    const list = buildTopItems(sorted, 6, t.overview.labels.other)
    return {
      items: list.map((item, idx) => ({
        ...item,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
      missing,
    }
  }, [localMembers, t.overview.labels.other])

  const contractSalaryStats = useMemo(() => {
    const values = localMembers.map((member) => resolveMonthlySalary(member))
    return buildSalaryDistribution(values, formatMoney)
  }, [localMembers, formatMoney])

  const payoutSalaryStats = useMemo(() => {
    if (!showTeamPayroll) return []
    const values = localMembers.map((member) => payrollPayoutsByMemberId.get(member.id) ?? 0)
    return buildSalaryDistribution(values, formatMoney)
  }, [localMembers, payrollPayoutsByMemberId, showTeamPayroll, formatMoney])

  const contractCostStats = useMemo(() => {
    if (!showTeamPayroll) {
      return { items: [], unknown: 0 }
    }
    let ctjTotal = 0
    let cddTotal = 0
    let ctjCount = 0
    let cddCount = 0
    let unknown = 0
    localMembers.forEach((member) => {
      const type = member.expatProfile?.contractType ?? null
      const salary = payrollPayoutsByMemberId.get(member.id) ?? 0
      if (type === 'CTJ') {
        ctjTotal += salary
        ctjCount += 1
      } else if (type === 'CDD') {
        cddTotal += salary
        cddCount += 1
      } else {
        unknown += 1
      }
    })
    return {
      items: [
        {
          label: 'CTJ',
          total: ctjTotal,
          avg: ctjCount ? ctjTotal / ctjCount : 0,
          count: ctjCount,
          color: CHART_COLORS[0],
        },
        {
          label: 'CDD',
          total: cddTotal,
          avg: cddCount ? cddTotal / cddCount : 0,
          count: cddCount,
          color: CHART_COLORS[1],
        },
      ],
      unknown,
    }
  }, [
    localMembers,
    payrollPayoutsByMemberId,
    showTeamPayroll,
  ])

  const tenureStats = useMemo(() => {
    const monthUnit = locale === 'fr' ? 'mois' : '月'
    const yearUnit = locale === 'fr' ? 'ans' : '年'
    const ranges = [
      { label: `0-3${monthUnit}`, min: 0, max: 2 },
      { label: `3-6${monthUnit}`, min: 3, max: 5 },
      { label: `6-12${monthUnit}`, min: 6, max: 11 },
      { label: `1-2${yearUnit}`, min: 12, max: 23 },
      { label: `2+${yearUnit}`, min: 24, max: Number.POSITIVE_INFINITY },
    ]
    const counts = ranges.map(() => 0)
    let missing = 0
    const now = new Date()
    scopedMembers.forEach((member) => {
      if (!member.joinDate) {
        missing += 1
        return
      }
      const joined = new Date(member.joinDate)
      if (Number.isNaN(joined.getTime())) {
        missing += 1
        return
      }
      const months =
        (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
      const normalized = Math.max(0, months)
      const index = ranges.findIndex(
        (range) => normalized >= range.min && normalized <= range.max,
      )
      if (index >= 0) counts[index] += 1
    })
    return {
      items: ranges.map((range, idx) => ({
        label: range.label,
        value: counts[idx],
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
      missing,
    }
  }, [scopedMembers, locale])

  const contractExpiryStats = useMemo(() => {
    const now = new Date()
    const months: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push(date.toISOString().slice(0, 7))
    }
    const counts = new Map(months.map((key) => [key, 0]))
    let overdue = 0
    let beyond = 0
    let missing = 0
    localMembers.forEach((member) => {
      const endDate = member.expatProfile?.contractEndDate
      if (!endDate) {
        missing += 1
        return
      }
      const parsed = new Date(endDate)
      if (Number.isNaN(parsed.getTime())) {
        missing += 1
        return
      }
      if (parsed < now) {
        overdue += 1
        return
      }
      const key = parsed.toISOString().slice(0, 7)
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      } else {
        beyond += 1
      }
    })
    const items = Array.from(counts.entries()).map(([label, value], idx) => ({
      label,
      value,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
    return {
      items,
      overdue,
      beyond,
      missing,
    }
  }, [localMembers])

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{t.feedback.loading}</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>
  }

  if (members.length === 0) {
    return <div className="p-6 text-sm text-slate-500">{t.feedback.empty}</div>
  }

  const totalCount = scopedMembers.length
  const chinaShare = totalCount ? Math.round((nationalityStats.china / totalCount) * 100) : 0
  const nonChinaShare = totalCount
    ? Math.round((nationalityStats.nonChina / totalCount) * 100)
    : 0

  const summaryStats = [
    {
      label: t.overview.summary.total,
      value: formatNumber(totalCount),
    },
    {
      label: t.overview.summary.china,
      value: formatNumber(nationalityStats.china),
      helper: `${chinaShare}%`,
    },
    {
      label: t.overview.summary.nonChina,
      value: formatNumber(nationalityStats.nonChina),
      helper: `${nonChinaShare}%`,
    },
    {
      label: t.overview.summary.local,
      value: formatNumber(localMembers.length),
    },
  ]

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
            {t.overview.title}
          </h2>
          <p className="text-sm text-slate-500">{t.overview.subtitle}</p>
        </div>
        
        {/* Top Segmented Control */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {(['overview', 'detail', 'compare'] as const).map((mode) => (
             <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === mode 
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
             >
                {mode === 'overview'
                  ? t.overview.labels.modeOverview
                  : mode === 'detail'
                    ? t.overview.labels.modeDetail
                    : t.overview.labels.modeCompare}
             </button>
          ))}
        </div>
      </div>
      
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {t.filters.title}
          </p>
          <p className="text-[11px] text-slate-400">
            {(() => {
              const selectedCount =
                projectFilters.length +
                statusFilters.length +
                nationalityFilters.length +
                teamFilters.length
              return selectedCount > 0 ? t.filters.selected(selectedCount) : t.filters.all
            })()}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MultiSelectFilter
            label={t.table.project}
            options={projectFilterOptions}
            selected={projectFilters}
            onChange={onProjectFiltersChange}
            allLabel={filterControlProps.allLabel}
            selectedLabel={filterControlProps.selectedLabel}
            selectAllLabel={filterControlProps.selectAllLabel}
            clearLabel={filterControlProps.clearLabel}
            searchPlaceholder={filterControlProps.searchPlaceholder}
            noOptionsLabel={filterControlProps.noOptionsLabel}
          />
          <MultiSelectFilter
            label={t.table.employmentStatus}
            options={statusFilterOptions}
            selected={statusFilters}
            onChange={onStatusFiltersChange}
            allLabel={filterControlProps.allLabel}
            selectedLabel={filterControlProps.selectedLabel}
            selectAllLabel={filterControlProps.selectAllLabel}
            clearLabel={filterControlProps.clearLabel}
            searchPlaceholder={filterControlProps.searchPlaceholder}
            noOptionsLabel={filterControlProps.noOptionsLabel}
          />
          <MultiSelectFilter
            label={t.table.nationality}
            options={nationalityFilterOptions}
            selected={nationalityFilters}
            onChange={onNationalityFiltersChange}
            allLabel={filterControlProps.allLabel}
            selectedLabel={filterControlProps.selectedLabel}
            selectAllLabel={filterControlProps.selectAllLabel}
            clearLabel={filterControlProps.clearLabel}
            searchPlaceholder={filterControlProps.searchPlaceholder}
            noOptionsLabel={filterControlProps.noOptionsLabel}
          />
          <MultiSelectFilter
            label={t.table.team}
            options={teamFilterOptions}
            selected={teamFilters}
            onChange={onTeamFiltersChange}
            allLabel={filterControlProps.allLabel}
            selectedLabel={filterControlProps.selectedLabel}
            selectAllLabel={filterControlProps.selectAllLabel}
            clearLabel={filterControlProps.clearLabel}
            searchPlaceholder={filterControlProps.searchPlaceholder}
            noOptionsLabel={filterControlProps.noOptionsLabel}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
          >
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900">{stat.value}</span>
              {stat.helper ? (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{stat.helper}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <TeamDistributionGrid 
        items={sortedTeamItems}
        missing={teamStats.missing} 
        t={t} 
        showPayroll={showTeamPayroll}
        sortMode={showTeamPayroll ? teamSortMode : 'count'}
        onSortChange={setTeamSortMode}
        formatMoney={formatMoney}
      />

      <SupervisorPowerGrid 
        items={sortedSupervisorItems}
        missing={supervisorStats.missing} 
        t={t} 
        showPayroll={showTeamPayroll}
        sortMode={showTeamPayroll ? supervisorSortMode : 'count'}
        onSortChange={setSupervisorSortMode}
        formatMoney={formatMoney}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3">
          <OverviewCard title={t.overview.charts.teamCostScatter} badge={t.overview.labels.localScope}>
            <TeamCostHeatmap
              items={teamStats.items}
              formatMoney={formatMoney}
              formatNumber={formatNumber}
              formatRatio={formatRatio}
              emptyLabel={t.overview.labels.noData}
              hint={t.overview.labels.scatterHint}
              labels={{
                team: t.table.team,
                people: t.overview.labels.people,
                payrollTotal: t.overview.labels.payrollTotal,
                payrollAverage: t.overview.labels.payrollAverage,
                payrollMedian: t.overview.labels.payrollMedian,
                payrollRatio: t.overview.labels.payrollRatio,
              }}
            />
          </OverviewCard>
        </div>

        <OverviewCard title={t.overview.charts.provenance} badge={t.overview.labels.localScope}>
          <DonutChart
            items={provenanceStats.items}
            totalLabel={t.overview.labels.total}
            formatValue={formatNumber}
            emptyLabel={t.overview.labels.noData}
          />
          {provenanceStats.missing ? (
            <p className="mt-2 text-xs text-slate-500">
              {t.overview.labels.missingProvenance}: {formatNumber(provenanceStats.missing)}
            </p>
          ) : null}
        </OverviewCard>

        <OverviewCard
          title={t.overview.charts.salary}
          subtitle={t.overview.helpers.salaryRule}
          badge={t.overview.labels.localScope}
        >
          <DonutChart
            items={contractSalaryStats}
            totalLabel={t.overview.labels.total}
            formatValue={formatNumber}
            emptyLabel={t.overview.labels.noData}
          />
        </OverviewCard>

        <OverviewCard
          title={t.overview.charts.actualSalary}
          subtitle={t.overview.helpers.actualSalaryRule}
          badge={t.overview.labels.localScope}
        >
          <DonutChart
            items={payoutSalaryStats}
            totalLabel={t.overview.labels.total}
            formatValue={formatNumber}
            emptyLabel={t.overview.labels.noData}
          />
        </OverviewCard>

        <OverviewCard title={t.overview.charts.contractCost} badge={t.overview.labels.localScope}>
          <ContractCostBulletList
            items={contractCostStats.items}
            formatMoney={formatMoney}
            formatNumber={formatNumber}
            emptyLabel={t.overview.labels.noData}
            labels={{
              people: t.overview.labels.people,
              payrollAverage: t.overview.labels.payrollAverage,
            }}
          />
          {contractCostStats.unknown ? (
            <p className="mt-2 text-xs text-slate-500">
              {t.overview.labels.missingContractType}: {formatNumber(contractCostStats.unknown)}
            </p>
          ) : null}
        </OverviewCard>

        <OverviewCard title={t.overview.charts.tenure}>
          <BarList
            items={tenureStats.items}
            formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
            emptyLabel={t.overview.labels.noData}
          />
          {tenureStats.missing ? (
            <p className="mt-2 text-xs text-slate-500">
              {t.labels.empty}: {formatNumber(tenureStats.missing)}
            </p>
          ) : null}
        </OverviewCard>

        <OverviewCard title={t.overview.charts.contractExpiry} badge={t.overview.labels.localScope}>
          <BarList
            items={contractExpiryStats.items}
            formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
            emptyLabel={t.overview.labels.noData}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              {t.overview.labels.overdue}: {formatNumber(contractExpiryStats.overdue)}
            </span>
            <span>
              {t.overview.labels.beyond}: {formatNumber(contractExpiryStats.beyond)}
            </span>
            <span>
              {t.overview.labels.missingContractDate}: {formatNumber(contractExpiryStats.missing)}
            </span>
          </div>
        </OverviewCard>
      </div>
    </div>
  )
}
