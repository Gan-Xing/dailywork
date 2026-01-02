'use client'

import { useCallback, useMemo, type ReactNode } from 'react'

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
}

type DonutItem = {
  label: string
  value: number
  color: string
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

const toLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const parseNumber = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
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
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-full flex flex-col">
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
          {badge}
        </span>
      ) : null}
    </div>
    <div className="flex-1">
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
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
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
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center h-full justify-center">
      <div className="relative h-36 w-36 shrink-0 filter drop-shadow-sm">
        <div
          className="absolute inset-0 rounded-full"
          style={{ backgroundImage: `conic-gradient(${segments.join(',')})` }}
        />
        <div className="absolute inset-8 rounded-full bg-white shadow-inner" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[10px] text-slate-500 pointer-events-none">
          <span className="font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{totalLabel}</span>
          <span className="text-xl font-bold text-slate-900">{formatValue(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {visibleItems.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div key={item.label} className="group flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span 
                  className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="truncate font-medium text-slate-600 transition-colors group-hover:text-slate-900">
                  {item.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="font-bold text-slate-700">{formatValue(item.value)}</span>
                <span className="text-xs font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{percent}%</span>
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
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="group">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-700 transition-colors group-hover:text-slate-900">
              {item.label}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {formatValue(item.value)}
              {item.meta ? ` · ${item.meta}` : ''}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-100/50">
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
        </div>
      ))}
    </div>
  )
}

const TeamDistributionGrid = ({ items, missing, t }: { items: BarItem[], missing: number, t: MemberCopy }) => {
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
         <div className="text-right">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.overview.labels.people}</span>
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

const SupervisorPowerGrid = ({ items, missing, t }: { items: SupervisorItem[], missing: number, t: MemberCopy }) => {
  if (items.length === 0 && missing === 0) return null

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
         <div>
            <h3 className="text-lg font-bold text-slate-900">{t.overview.charts.supervisor}</h3>
            <p className="text-sm text-slate-500 mt-1">
               {t.overview.labels.localScope}
            </p>
         </div>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          return (
            <div key={item.label} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
               <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="font-bold text-slate-900 text-base block truncate" title={item.label}>{item.label}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-2xl font-bold text-slate-900 leading-none">{item.value}</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase">Total</span>
                  </div>
               </div>
               
               <div className="flex-1 space-y-3">
                 <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Power Structure</div>
                 {item.teamDetails.map((team, idx) => (
                    <div key={team.name} className="group">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-medium text-slate-700 truncate pr-2" title={team.name}>{team.name}</span>
                        <div className="text-right shrink-0 leading-none">
                          <span className="text-xs font-bold text-slate-900">{team.count}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({team.percent}%)</span>
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
  const formatNumber = useCallback(
    (value: number) => numberFormatter.format(Math.round(value)),
    [numberFormatter],
  )
  const formatMoney = useCallback(
    (value: number) => numberFormatter.format(Math.round(value)),
    [numberFormatter],
  )

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
    const map = new Map<string, number>()
    let missing = 0
    // Filter out Chinese nationals explicitly as requested by leadership
    // to show only local team composition
    const teamMembers = localMembers.filter(m => m.nationality !== 'china')
    
    teamMembers.forEach((member) => {
      const team = normalizeText(member.expatProfile?.team)
      if (!team) {
        missing += 1
        return
      }
      map.set(team, (map.get(team) ?? 0) + 1)
    })
    const sorted = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      
    // Display ALL teams, do not aggregate into "Other"
    return {
      items: sorted.map((item, idx) => ({
        ...item,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
      missing,
    }
  }, [localMembers])

  const supervisorStats = useMemo(() => {
    const map = new Map<string, { count: number, teamCounts: Map<string, number> }>()
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
      
      const current = map.get(label) ?? { count: 0, teamCounts: new Map<string, number>() }
      current.count += 1
      
      const teamName = normalizeText(member.expatProfile?.team)
      if (teamName) {
        current.teamCounts.set(teamName, (current.teamCounts.get(teamName) ?? 0) + 1)
      } else {
        const unassignedLabel = t.overview.labels.unassignedTeam
        current.teamCounts.set(unassignedLabel, (current.teamCounts.get(unassignedLabel) ?? 0) + 1)
      }
      
      map.set(label, current)
    })
    
    const items = Array.from(map.entries())
      .map(([label, data]) => {
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
          maxTeamCount: teamDetails.length > 0 ? teamDetails[0].count : 0
        }
      })
      .sort((a, b) => b.value - a.value)
      
    return {
      items,
      missing,
    }
  }, [localMembers, t.overview.labels.unassignedTeam])

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

  const salaryStats = useMemo(() => {
    const salaryRanges = [
      { min: 0, max: 0 },
      { min: 1, max: 100000 },
      { min: 100001, max: 200000 },
      { min: 200001, max: 300000 },
      { min: 300001, max: 500000 },
      { min: 500001, max: Number.POSITIVE_INFINITY },
    ]
    const labels = salaryRanges.map((range) => {
      if (range.min === 0 && range.max === 0) return '0'
      if (range.max === Number.POSITIVE_INFINITY) return `${formatMoney(range.min)}+`
      return `${formatMoney(range.min)}-${formatMoney(range.max)}`
    })
    const counts = salaryRanges.map(() => 0)
    localMembers.forEach((member) => {
      const value = resolveMonthlySalary(member)
      const index = salaryRanges.findIndex(
        (range) => value >= range.min && value <= range.max,
      )
      if (index >= 0) counts[index] += 1
    })
    return labels.map((label, idx) => ({
      label,
      value: counts[idx],
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [localMembers, formatMoney])

  const contractCostStats = useMemo(() => {
    let ctjTotal = 0
    let cddTotal = 0
    let ctjCount = 0
    let cddCount = 0
    let unknown = 0
    localMembers.forEach((member) => {
      const type = member.expatProfile?.contractType ?? null
      const salary = resolveMonthlySalary(member)
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
          value: ctjTotal,
          color: CHART_COLORS[0],
          meta: `${formatNumber(ctjCount)} ${t.overview.labels.people}`,
        },
        {
          label: 'CDD',
          value: cddTotal,
          color: CHART_COLORS[1],
          meta: `${formatNumber(cddCount)} ${t.overview.labels.people}`,
        },
      ],
      unknown,
    }
  }, [localMembers, formatNumber, t.overview.labels.people])

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

      {/* Prominent Team Distribution Section */}
      <TeamDistributionGrid 
        items={teamStats.items} 
        missing={teamStats.missing} 
        t={t} 
      />

      {/* Prominent Supervisor Power Grid Section */}
      <SupervisorPowerGrid 
        items={supervisorStats.items} 
        missing={supervisorStats.missing} 
        t={t} 
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Removed the Nationality chart from here */}

        {/* Removed Supervisor chart from here as it's promoted above */}

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

        <OverviewCard title={t.overview.charts.salary} badge={t.overview.labels.localScope}>
          <DonutChart
            items={salaryStats}
            totalLabel={t.overview.labels.total}
            formatValue={formatNumber}
            emptyLabel={t.overview.labels.noData}
          />
          <p className="mt-2 text-xs text-slate-500">{t.overview.helpers.salaryRule}</p>
        </OverviewCard>

        <OverviewCard title={t.overview.charts.contractCost} badge={t.overview.labels.localScope}>
          <BarList
            items={contractCostStats.items}
            formatValue={formatMoney}
            emptyLabel={t.overview.labels.noData}
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