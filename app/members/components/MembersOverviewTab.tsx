'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { EMPTY_FILTER_VALUE } from '@/lib/members/constants'
import { formatSupervisorLabel, normalizeTagKey, normalizeText } from '@/lib/members/utils'
import type { Member } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type Props = {
  t: MemberCopy
  locale: Locale
  members: Member[]
  loading: boolean
  error: string | null
}

type BarItem = {
  label: string
  value: number
  color: string
  meta?: string
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
]

const HOURS_PER_MONTH_CTJ = 22 * 8

const toLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const parseNumber = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
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
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-2">
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
    {children}
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative h-36 w-36 shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{ backgroundImage: `conic-gradient(${segments.join(',')})` }}
        />
        <div className="absolute inset-6 rounded-full bg-white shadow-inner" />
        <div className="absolute inset-10 flex flex-col items-center justify-center text-center text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{totalLabel}</span>
          <span className="text-sm font-bold text-slate-900">{formatValue(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {visibleItems.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div key={item.label} className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-slate-700">{item.label}</span>
              </div>
              <span>{`${formatValue(item.value)} · ${percent}%`}</span>
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
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-2 text-sm text-slate-700">
            <span className="truncate font-medium">{item.label}</span>
            <span className="text-xs text-slate-500">
              {formatValue(item.value)}
              {item.meta ? ` · ${item.meta}` : ''}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MembersOverviewTab({ t, locale, members, loading, error }: Props) {
  const [tagFilters, setTagFilters] = useState<string[]>([])
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

  const tagOptions = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    const collator = new Intl.Collator(localeId, { numeric: true, sensitivity: 'base' })
    const tagsByKey = new Map<string, string>()
    let hasEmpty = false
    members.forEach((member) => {
      const tags = member.tags ?? []
      if (tags.length === 0) {
        hasEmpty = true
        return
      }
      tags.forEach((tag) => {
        const trimmed = normalizeText(tag)
        if (!trimmed) return
        const key = normalizeTagKey(trimmed)
        if (!key || tagsByKey.has(key)) return
        tagsByKey.set(key, trimmed)
      })
    })
    const options = Array.from(tagsByKey.values())
      .sort(collator.compare)
      .map((value) => ({ value: normalizeTagKey(value), label: value }))
    if (hasEmpty) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [members, locale, t.labels.empty])

  const scopedMembers = useMemo(() => {
    if (tagFilters.length === 0) return members
    const wantsEmpty = tagFilters.includes(EMPTY_FILTER_VALUE)
    const filterKeys = tagFilters
      .filter((value) => value !== EMPTY_FILTER_VALUE)
      .map((value) => normalizeTagKey(value))
      .filter(Boolean)
    return members.filter((member) => {
      const tags = (member.tags ?? []).map((tag) => normalizeTagKey(tag)).filter(Boolean)
      if (tags.length === 0) return wantsEmpty
      if (filterKeys.length === 0) return true
      return tags.some((tag) => filterKeys.includes(tag))
    })
  }, [members, tagFilters])

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
    localMembers.forEach((member) => {
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
    const list = buildTopItems(sorted, 8, t.overview.labels.other)
    return {
      items: list.map((item, idx) => ({
        ...item,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
      missing,
    }
  }, [localMembers, t.overview.labels.other])

  const supervisorStats = useMemo(() => {
    const map = new Map<string, number>()
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
      map.set(label, (map.get(label) ?? 0) + 1)
    })
    const sorted = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
    const list = buildTopItems(sorted, 8, t.overview.labels.other)
    return {
      items: list.map((item, idx) => ({
        ...item,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
      missing,
    }
  }, [localMembers, t.overview.labels.other])

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

  const nationalityItems: DonutItem[] = [
    {
      label: t.overview.labels.china,
      value: nationalityStats.china,
      color: CHART_COLORS[0],
    },
    {
      label: t.overview.labels.nonChina,
      value: nationalityStats.nonChina,
      color: CHART_COLORS[1],
    },
  ]
  if (nationalityStats.unknown > 0) {
    nationalityItems.push({
      label: t.labels.empty,
      value: nationalityStats.unknown,
      color: CHART_COLORS[2],
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.overview.title}
          </p>
          <p className="text-xs text-slate-500">{t.overview.subtitle}</p>
        </div>
        <div className="min-w-[260px]">
          <MultiSelectFilter
            label={t.overview.filters.tagLabel}
            options={tagOptions}
            selected={tagFilters}
            onChange={setTagFilters}
            allLabel={filterControlProps.allLabel}
            selectedLabel={filterControlProps.selectedLabel}
            selectAllLabel={filterControlProps.selectAllLabel}
            clearLabel={filterControlProps.clearLabel}
            searchPlaceholder={filterControlProps.searchPlaceholder}
            noOptionsLabel={filterControlProps.noOptionsLabel}
          />
          <p className="mt-2 text-[11px] text-slate-400">
            {t.overview.filters.tagHint}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
              {stat.helper ? (
                <span className="text-xs font-medium text-emerald-600">{stat.helper}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OverviewCard title={t.overview.charts.nationality}>
          <DonutChart
            items={nationalityItems}
            totalLabel={t.overview.labels.total}
            formatValue={formatNumber}
            emptyLabel={t.overview.labels.noData}
          />
        </OverviewCard>

        <OverviewCard title={t.overview.charts.team} badge={t.overview.labels.localScope}>
          <BarList
            items={teamStats.items}
            formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
            emptyLabel={t.overview.labels.noData}
          />
          {teamStats.missing ? (
            <p className="mt-2 text-xs text-slate-500">
              {t.overview.labels.unassignedTeam}: {formatNumber(teamStats.missing)}
            </p>
          ) : null}
        </OverviewCard>

        <OverviewCard title={t.overview.charts.supervisor} badge={t.overview.labels.localScope}>
          <BarList
            items={supervisorStats.items}
            formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
            emptyLabel={t.overview.labels.noData}
          />
          {supervisorStats.missing ? (
            <p className="mt-2 text-xs text-slate-500">
              {t.overview.labels.unassignedSupervisor}: {formatNumber(supervisorStats.missing)}
            </p>
          ) : null}
        </OverviewCard>

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
