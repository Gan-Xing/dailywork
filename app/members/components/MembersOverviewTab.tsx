'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { EMPTY_FILTER_VALUE } from '@/lib/members/constants'
import { formatSupervisorLabel, normalizeText, resolveTeamDisplayName } from '@/lib/members/utils'
import type { Member } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type Props = {
  t: MemberCopy
  locale: Locale
  members: Member[]
  loading: boolean
  error: string | null
  canViewPayroll: boolean
  canUpdateMember: boolean
  projectFilterOptions: MultiSelectOption[]
  statusFilterOptions: MultiSelectOption[]
  nationalityFilterOptions: MultiSelectOption[]
  teamFilterOptions: MultiSelectOption[]
  teamSupervisorMap: Map<string, { teamZh?: string | null }>
  projectFilters: string[]
  statusFilters: string[]
  nationalityFilters: string[]
  teamFilters: string[]
  onProjectFiltersChange: (value: string[]) => void
  onStatusFiltersChange: (value: string[]) => void
  onNationalityFiltersChange: (value: string[]) => void
  onTeamFiltersChange: (value: string[]) => void
  onViewMember: (member: Member) => void
  onRefreshMembers: () => Promise<void>
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

type TrendPoint = {
  label: string
  value: number
}

type ContractTypeTrendItem = {
  label: string
  ctj: number
  cdd: number
  other: number
  total: number
  delta: number
}

type PayoutRecordRow = {
  id: number
  team: string
  memberName: string
  supervisor: string
  amountsByDate: Record<string, number>
  total: number
}

type CompareLineSeries = {
  key: string
  label: string
  color: string
  values: number[]
}

type SelectableBarItem = BarItem & {
  key: string
}

type PositionGroupItem = {
  key: string
  label: string
  value: number
  color: string
  rawItems: Array<{ label: string; value: number }>
}

type ContractExpirySummary = {
  upcoming: number
  overdue: number
  beyond: number
  missing: number
}

type CompareTeamStats = {
  key: string
  label: string
  headcount: number
  activeCount: number
  onLeaveCount: number
  terminatedCount: number
  payrollTotal: number
  payrollAverage: number
  payrollMedian: number
  contractType: {
    ctj: number
    cdd: number
    other: number
  }
  contractTypePayroll: {
    ctj: number
    cdd: number
    other: number
  }
  contractExpiry: ContractExpirySummary
  topPositions: Array<{ label: string; value: number }>
  positionMissing: number
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
  id: number
  runId: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  payoutDate: string
  amount: string
  currency: string
  note: string | null
  createdAt: string
  updatedAt: string
}

type PayrollRun = {
  id: number
  year: number
  month: number
  sequence: number
  payoutDate: string
  attendanceCutoffDate: string
}

type PayrollContractSnapshot = {
  contractNumber: string | null
  contractType: string | null
  ctjOverlap?: boolean
  contractOverlap?: boolean
}

type PayrollContractSnapshotPayload = {
  runId: number
  cutoffDate: string
  contracts?: Record<string, PayrollContractSnapshot>
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

const PHONE_PLACEHOLDER = '0500000000'

const normalizePhoneDigits = (value: string) => value.replace(/[^\d]/g, '')

const hasValidPhone = (phones: string[]) => {
  const normalized = phones.map(normalizePhoneDigits).filter(Boolean)
  if (normalized.length === 0) return false
  return normalized.some((value) => value !== PHONE_PLACEHOLDER)
}

const countMissingPhones = (members: Member[]) => {
  let missing = 0
  members.forEach((member) => {
    const phones = Array.isArray(member.phones) ? member.phones : []
    if (!hasValidPhone(phones)) {
      missing += 1
    }
  })
  return missing
}

const isMissingPhone = (member: Member) => {
  const phones = Array.isArray(member.phones) ? member.phones : []
  return !hasValidPhone(phones)
}

const isMissingCnpsNumber = (member: Member) =>
  !normalizeText(member.expatProfile?.cnpsNumber)

const isMissingCnpsAndDeclaration = (member: Member) =>
  !normalizeText(member.expatProfile?.cnpsNumber) &&
  !normalizeText(member.expatProfile?.cnpsDeclarationCode)

const buildCnpsStats = (members: Member[]) => {
  let missing = 0
  let missingWithoutDeclaration = 0
  members.forEach((member) => {
    const cnpsNumber = normalizeText(member.expatProfile?.cnpsNumber)
    const cnpsDeclaration = normalizeText(member.expatProfile?.cnpsDeclarationCode)
    if (!cnpsNumber) {
      missing += 1
      if (!cnpsDeclaration) {
        missingWithoutDeclaration += 1
      }
    }
  })
  return { missing, missingWithoutDeclaration }
}

type ContractExpiryItem = {
  key: string
  label: string
  value: number
  color: string
}

type ContractExpiryStats = {
  items: ContractExpiryItem[]
  overdue: number
  beyond: number
  missing: number
  membersByKey: Map<string, Member[]>
  overdueMembers: Member[]
}

const buildContractExpiryStats = (members: Member[], overdueLabel: string): ContractExpiryStats => {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 3; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(date.toISOString().slice(0, 7))
  }
  const counts = new Map(months.map((key) => [key, 0]))
  const membersByKey = new Map<string, Member[]>(months.map((key) => [key, []]))
  let overdue = 0
  let beyond = 0
  let missing = 0
  const overdueMembers: Member[] = []

  members.forEach((member) => {
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
      overdueMembers.push(member)
      return
    }
    const key = parsed.toISOString().slice(0, 7)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      membersByKey.get(key)?.push(member)
    } else {
      beyond += 1
    }
  })

  const items: ContractExpiryItem[] = [
    {
      key: 'overdue',
      label: overdueLabel,
      value: overdue,
      color: CHART_COLORS[0],
    },
  ]
  months.forEach((key, idx) => {
    items.push({
      key,
      label: key,
      value: counts.get(key) ?? 0,
      color: CHART_COLORS[(idx + 1) % CHART_COLORS.length],
    })
  })

  return {
    items,
    overdue,
    beyond,
    missing,
    membersByKey,
    overdueMembers,
  }
}

const POSITION_GROUPS = [
  {
    key: 'safetyHse',
    matchers: [/\bhse\b/, /\bvigile\b/, /\bsecurite\b/, /regulateur/, /circulation/, /environnement/],
  },
  {
    key: 'labQuality',
    matchers: [/\blabo\b/, /\blaborantin\b/, /qualite/, /pesee/],
  },
  {
    key: 'plantQuarry',
    matchers: [/centrale/, /concassage/, /carriere/, /enrobage/, /bitume/],
  },
  {
    key: 'surveyTopo',
    matchers: [/topo/],
  },
  {
    key: 'maintenance',
    matchers: [/mecanicien/, /electricien/, /garage/],
  },
  {
    key: 'equipmentOps',
    matchers: [/\bconducteur\b/],
  },
  {
    key: 'driversTransport',
    matchers: [/\bchauffeur\b/, /graderiste/],
  },
  {
    key: 'livingServices',
    matchers: [/cuisine/, /menage/],
  },
  {
    key: 'warehouseLogistics',
    matchers: [/entrepot/, /logistique/],
  },
  {
    key: 'supervision',
    matchers: [/chef d equipe/, /responsab/],
  },
  {
    key: 'adminSupport',
    matchers: [/assistant/, /gestionnaire/, /interprete/, /guide/, /charge d affaires/, /vulgarisateur/],
  },
  {
    key: 'siteWork',
    matchers: [/ouvrier/, /macon/, /aide macon/, /ferrailleur/, /soudeur/, /menuisier/, /ratisseur/, /terrassier/, /ingenieur/, /genie civil/],
  },
  {
    key: 'other',
    matchers: [],
  },
] as const

const toLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const parseNumber = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const formatMonthValue = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const getLastMonthKey = () => {
  const date = new Date()
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  utc.setUTCMonth(utc.getUTCMonth() - 1)
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
  }
}

const getLastMonthValue = () => {
  const { year, month } = getLastMonthKey()
  return formatMonthValue(year, month)
}

const buildRecentMonthOptions = (count: number) => {
  const options: MultiSelectOption[] = []
  const { year, month } = getLastMonthKey()
  const cursor = new Date(Date.UTC(year, month - 1, 1))
  for (let i = 0; i < count; i += 1) {
    const value = formatMonthValue(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1)
    options.push({ value, label: value })
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  return options
}

const parseMonthValue = (value: string) => {
  const [year, month] = value.split('-').map((part) => Number(part))
  if (!year || !month) return null
  return { year, month }
}

const sortMonthValues = (values: string[]) => {
  return [...values].sort((a, b) => {
    const left = parseMonthValue(a)
    const right = parseMonthValue(b)
    if (!left && !right) return 0
    if (!left) return -1
    if (!right) return 1
    return left.year * 12 + left.month - (right.year * 12 + right.month)
  })
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

const buildContractExpirySummary = (members: Member[]): ContractExpirySummary => {
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
  members.forEach((member) => {
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
  const upcoming = Array.from(counts.values()).reduce((sum, value) => sum + value, 0)
  return { upcoming, overdue, beyond, missing }
}

const normalizePositionKey = (value: string) => {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const resolvePositionGroup = (normalized: string, raw: string) => {
  if (normalized) {
    for (const group of POSITION_GROUPS) {
      if (group.matchers.length === 0) continue
      if (group.matchers.some((matcher) => matcher.test(normalized))) {
        return group.key
      }
    }
  }
  const rawValue = normalizeText(raw)
  if (rawValue) {
    if (/修理/.test(rawValue)) return 'maintenance'
    if (/结构工程师|工程师|工程部/.test(rawValue)) return 'siteWork'
  }
  return 'other'
}

const buildPositionStats = (
  members: Member[],
  nameCollator: Intl.Collator,
  labels: MemberCopy['overview']['positionGroups'],
) => {
  const groupMap = new Map<string, { count: number; raw: Map<string, { label: string; value: number }> }>()
  POSITION_GROUPS.forEach((group) => {
    groupMap.set(group.key, { count: 0, raw: new Map() })
  })
  let missing = 0
  members.forEach((member) => {
    const rawPosition = normalizeText(member.position)
    if (!rawPosition) {
      missing += 1
      return
    }
    const normalized = normalizePositionKey(rawPosition)
    const groupKey = resolvePositionGroup(normalized, rawPosition)
    const group = groupMap.get(groupKey) ?? groupMap.get('other')
    if (!group) return
    group.count += 1
    const rawKey = normalized || normalizeText(rawPosition).toLowerCase()
    const existing = group.raw.get(rawKey)
    if (existing) {
      existing.value += 1
    } else {
      group.raw.set(rawKey, { label: rawPosition, value: 1 })
    }
  })
  const items: PositionGroupItem[] = POSITION_GROUPS.map((group, idx) => {
    const groupData = groupMap.get(group.key) ?? { count: 0, raw: new Map() }
    const rawItems = Array.from(groupData.raw.values())
      .sort((a, b) => {
        const diff = b.value - a.value
        if (diff !== 0) return diff
        return nameCollator.compare(a.label, b.label)
      })
    return {
      key: group.key,
      label: labels[group.key],
      value: groupData.count,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      rawItems,
    }
  }).filter((item) => item.value > 0)

  return { items, missing }
}

const getSalaryRanges = (multiplier: number) => {
  if (!Number.isFinite(multiplier) || multiplier <= 1) return SALARY_RANGES
  let prevMax = 0
  return SALARY_RANGES.map((range, index) => {
    if (index === 0) {
      prevMax = range.max
      return range
    }
    const max =
      range.max === Number.POSITIVE_INFINITY ? range.max : range.max * multiplier
    const min = index === 1 ? 1 : (prevMax === Number.POSITIVE_INFINITY ? prevMax : prevMax + 1)
    prevMax = max
    return { min, max }
  })
}

const buildSalaryDistribution = (
  values: number[],
  formatMoney: (value: number) => string,
  ranges: Array<{ min: number; max: number }>,
) => {
  const labels = ranges.map((range) => {
    if (range.min === 0 && range.max === 0) return '0'
    if (range.max === Number.POSITIVE_INFINITY) return `${formatMoney(range.min)}+`
    return `${formatMoney(range.min)}-${formatMoney(range.max)}`
  })
  const counts = ranges.map(() => 0)
  values.forEach((value) => {
    const index = ranges.findIndex(
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

type DataQualityKey = 'missingPhone' | 'missingCnps' | 'missingCnpsWithoutDeclaration'

type DataQualityItem = {
  key: DataQualityKey
  label: string
  value: number
  helper?: string
  scope?: string
}

type DataQualityRow = {
  id: number
  team: string
  name: string
  birthDate: string
  fieldValue: string
  member: Member
}

const DataQualityList = ({
  items,
  formatValue,
  emptyLabel,
  onSelect,
}: {
  items: DataQualityItem[]
  formatValue: (value: number) => string
  emptyLabel: string
  onSelect?: (key: DataQualityKey) => void
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const highlight = item.value > 0
        const content = (
          <>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                {item.scope ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    {item.scope}
                  </span>
                ) : null}
              </div>
              {item.helper ? (
                <p className="mt-1 text-[11px] text-slate-400">{item.helper}</p>
              ) : null}
            </div>
            <span className={`text-lg font-bold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatValue(item.value)}
            </span>
          </>
        )
        if (!onSelect) {
          return (
            <div
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
            >
              {content}
            </div>
          )
        }
        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onSelect(item.key)}
            className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

const DataQualityModal = ({
  open,
  title,
  rows,
  fieldLabel,
  placeholder,
  canEdit,
  drafts,
  onDraftChange,
  onSave,
  onClose,
  onViewMember,
  saving,
  hasChanges,
  error,
  notice,
  emptyLabel,
  emptyValueLabel,
  labels,
}: {
  open: boolean
  title: string
  rows: DataQualityRow[]
  fieldLabel: string
  placeholder?: string
  canEdit: boolean
  drafts: Record<number, string>
  onDraftChange: (memberId: number, value: string) => void
  onSave: () => void
  onClose: () => void
  onViewMember: (member: Member) => void
  saving: boolean
  hasChanges: boolean
  error: string | null
  notice: string | null
  emptyLabel: string
  emptyValueLabel: string
  labels: {
    team: string
    name: string
    birthDate: string
    save: string
    close: string
  }
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{fieldLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={onSave}
                disabled={!hasChanges || saving}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {labels.save}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              aria-label={labels.close}
            >
              {labels.close}
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full table-auto text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">{labels.team}</th>
                <th className="px-4 py-2">{labels.name}</th>
                <th className="px-4 py-2">{labels.birthDate}</th>
                <th className="px-4 py-2">{fieldLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const value = drafts[row.id] ?? row.fieldValue
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{row.team}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => onViewMember(row.member)}
                          className="text-left font-semibold text-slate-900 hover:underline"
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.birthDate}
                      </td>
                      <td className="px-4 py-2">
                        {canEdit ? (
                          <input
                            type="text"
                            value={value}
                            onChange={(event) => onDraftChange(row.id, event.target.value)}
                            placeholder={placeholder}
                            disabled={saving}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        ) : (
                          <span className="text-slate-500">
                            {value || emptyValueLabel}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

type ContractExpiryRow = {
  id: number
  team: string
  teamValue: string
  name: string
  nameValue: string
  birthDate: string
  birthDateValue: number | null
  contractNumber: string
  contractNumberValue: string
  contractType: string
  contractTypeValue: string
  contractStartDate: string
  contractStartValue: number | null
  contractEndDate: string
  contractEndValue: number | null
  member: Member
}

type ContractExpirySortKey =
  | 'team'
  | 'name'
  | 'birthDate'
  | 'contractNumber'
  | 'contractType'
  | 'contractStartDate'
  | 'contractEndDate'

const ContractExpiryList = ({
  items,
  formatValue,
  emptyLabel,
  onSelect,
}: {
  items: ContractExpiryItem[]
  formatValue: (value: number) => string
  emptyLabel: string
  onSelect?: (key: string) => void
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
        const content = (
          <>
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
          </>
        )
        if (!onSelect) {
          return (
            <div key={item.key} className="group">
              {content}
            </div>
          )
        }
        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onSelect(item.key)}
            className="group w-full text-left"
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

const ContractExpiryModal = ({
  open,
  title,
  rows,
  emptyLabel,
  canEdit,
  locale,
  onClose,
  onViewMember,
  onEditMember,
  labels,
}: {
  open: boolean
  title: string
  rows: ContractExpiryRow[]
  emptyLabel: string
  canEdit: boolean
  locale: Locale
  onClose: () => void
  onViewMember: (member: Member) => void
  onEditMember: (member: Member) => void
  labels: {
    team: string
    name: string
    birthDate: string
    contractNumber: string
    contractType: string
    contractStartDate: string
    contractEndDate: string
    actions: string
    edit: string
    close: string
  }
}) => {
  if (!open) return null
  const [sortKey, setSortKey] = useState<ContractExpirySortKey>('team')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const collator = useMemo(
    () => new Intl.Collator(toLocaleId(locale), { numeric: true, sensitivity: 'base' }),
    [locale],
  )

  const handleSort = (key: ContractExpirySortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        return current
      }
      setSortDirection('asc')
      return key
    })
  }

  const sortIndicator = (key: ContractExpirySortKey) => {
    if (sortKey !== key) return ''
    return sortDirection === 'asc' ? ' ^' : ' v'
  }

  const sortedRows = useMemo(() => {
    const compareOptionalString = (left: string, right: string) => {
      const leftValue = normalizeText(left)
      const rightValue = normalizeText(right)
      if (!leftValue && !rightValue) return 0
      if (!leftValue) return 1
      if (!rightValue) return -1
      const diff = collator.compare(leftValue, rightValue)
      return sortDirection === 'asc' ? diff : -diff
    }
    const compareOptionalNumber = (left: number | null, right: number | null) => {
      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1
      const diff = left - right
      return sortDirection === 'asc' ? diff : -diff
    }
    const list = [...rows]
    list.sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'team':
          diff = compareOptionalString(a.teamValue, b.teamValue)
          break
        case 'name':
          diff = compareOptionalString(a.nameValue, b.nameValue)
          break
        case 'birthDate':
          diff = compareOptionalNumber(a.birthDateValue, b.birthDateValue)
          break
        case 'contractNumber':
          diff = compareOptionalString(a.contractNumberValue, b.contractNumberValue)
          break
        case 'contractType':
          diff = compareOptionalString(a.contractTypeValue, b.contractTypeValue)
          break
        case 'contractStartDate':
          diff = compareOptionalNumber(a.contractStartValue, b.contractStartValue)
          break
        case 'contractEndDate':
          diff = compareOptionalNumber(a.contractEndValue, b.contractEndValue)
          break
        default:
          diff = 0
      }
      if (diff !== 0) return diff
      return collator.compare(a.nameValue, b.nameValue)
    })
    return list
  }, [collator, rows, sortDirection, sortKey])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label={labels.close}
          >
            {labels.close}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full table-auto text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('team')}
                >
                  {labels.team}
                  {sortIndicator('team')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  {labels.name}
                  {sortIndicator('name')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('birthDate')}
                >
                  {labels.birthDate}
                  {sortIndicator('birthDate')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('contractNumber')}
                >
                  {labels.contractNumber}
                  {sortIndicator('contractNumber')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('contractType')}
                >
                  {labels.contractType}
                  {sortIndicator('contractType')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('contractStartDate')}
                >
                  {labels.contractStartDate}
                  {sortIndicator('contractStartDate')}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort('contractEndDate')}
                >
                  {labels.contractEndDate}
                  {sortIndicator('contractEndDate')}
                </th>
                <th className="px-4 py-2 text-right">{labels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={8}>
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{row.team}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onViewMember(row.member)}
                        className="text-left font-semibold text-slate-900 hover:underline"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{row.birthDate}</td>
                    <td className="px-4 py-2 text-slate-600">{row.contractNumber}</td>
                    <td className="px-4 py-2 text-slate-600">{row.contractType}</td>
                    <td className="px-4 py-2 text-slate-600">{row.contractStartDate}</td>
                    <td className="px-4 py-2 text-slate-600">{row.contractEndDate}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onEditMember(row.member)}
                        disabled={!canEdit}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {labels.edit}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const SelectableBarList = ({
  items,
  selectedKey,
  onSelect,
  formatValue,
  emptyLabel,
  columns = 1,
}: {
  items: SelectableBarItem[]
  selectedKey: string | null
  onSelect: (key: string) => void
  formatValue: (value: number) => string
  emptyLabel: string
  columns?: 1 | 2
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className={columns === 2 ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
        const isActive = selectedKey === item.key
        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onSelect(item.key)}
            aria-pressed={isActive}
            className={`w-full rounded-xl p-2 text-left transition ${
              isActive
                ? 'bg-slate-50 ring-1 ring-slate-200'
                : 'hover:bg-slate-50/60'
            }`}
          >
            <div className="mb-2 flex items-end justify-between gap-2">
              <span className="truncate font-semibold text-slate-700">{item.label}</span>
              <div className="text-right shrink-0">
                <span className="text-base font-bold text-slate-900">{formatValue(item.value)}</span>
                <span className="ml-1 text-xs font-medium text-slate-400">{percent}%</span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-100/50">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </button>
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

const LineChart = ({
  items,
  formatValue,
  emptyLabel,
}: {
  items: TrendPoint[]
  formatValue: (value: number) => string
  emptyLabel: string
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const chart = useMemo(() => {
    if (items.length === 0 || size.width === 0 || size.height === 0) return null
    const padding = { top: 14, bottom: 18, left: 10, right: 10 }
    const values = items.map((item) => item.value)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    const rangePadding = (dataMax - dataMin) * 0.2
    const effectivePadding = rangePadding === 0 ? (dataMax * 0.1 || 10) : rangePadding
    const minValue = Math.max(0, dataMin - effectivePadding)
    const maxValue = dataMax + effectivePadding
    const range = maxValue - minValue || 1
    const plotWidth = size.width - padding.left - padding.right
    const plotHeight = size.height - padding.top - padding.bottom
    const points = items.map((item, index) => {
      const x =
        items.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (index / (items.length - 1)) * plotWidth
      const normalized = (item.value - minValue) / range
      const y = padding.top + (1 - normalized) * plotHeight
      return {
        x,
        y,
        xPercent: size.width ? (x / size.width) * 100 : 0,
        yPercent: size.height ? (y / size.height) * 100 : 0,
        value: item.value,
        label: item.label,
      }
    })
    return {
      padding,
      plotWidth,
      plotHeight,
      minValue,
      maxValue,
      points,
    }
  }, [items, size.height, size.width])

  useEffect(() => {
    if (!canvasRef.current || !chart) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)

    const { padding, plotHeight, points } = chart

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    points.forEach((point) => {
      ctx.beginPath()
      ctx.moveTo(point.x, padding.top)
      ctx.lineTo(point.x, padding.top + plotHeight)
      ctx.stroke()
    })

    if (points.length === 0) return
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight)
    gradient.addColorStop(0, 'rgba(99,102,241,0.18)')
    gradient.addColorStop(1, 'rgba(99,102,241,0)')
    ctx.beginPath()
    ctx.moveTo(points[0].x, padding.top + plotHeight)
    points.forEach((point) => {
      ctx.lineTo(point.x, point.y)
    })
    ctx.lineTo(points[points.length - 1].x, padding.top + plotHeight)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()

    if (hoveredIndex !== null && points[hoveredIndex]) {
      ctx.save()
      ctx.strokeStyle = 'rgba(148,163,184,0.8)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(points[hoveredIndex].x, padding.top)
      ctx.lineTo(points[hoveredIndex].x, padding.top + plotHeight)
      ctx.stroke()
      ctx.restore()
    }

    points.forEach((point, idx) => {
      const isActive = idx === hoveredIndex
      const radius = isActive ? 4 : 2
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isActive ? '#ffffff' : '#6366f1'
      ctx.strokeStyle = isActive ? '#6366f1' : '#ffffff'
      ctx.lineWidth = isActive ? 2 : 1
      ctx.fill()
      ctx.stroke()
    })

    ctx.font = '10px system-ui, -apple-system, sans-serif'
    points.forEach((point, idx) => {
      const isFirst = idx === 0
      const isLast = idx === items.length - 1
      const isActive = idx === hoveredIndex
      const showDense = items.length <= 6
      const showAlternate = items.length <= 12 && idx % 2 === 0
      const shouldShow = isActive || showDense || showAlternate || isFirst || isLast
      if (!shouldShow) return
      ctx.fillStyle = isActive ? 'rgba(51,65,85,0.9)' : 'rgba(100,116,139,0.55)'
      const text = formatValue(point.value)
      const textWidth = ctx.measureText(text).width
      const x =
        isFirst ? point.x : isLast ? point.x - textWidth : point.x - textWidth / 2
      const y = Math.max(point.y - 8, padding.top + 6)
      ctx.fillText(text, x, y)
    })
  }, [chart, hoveredIndex, items.length, formatValue, size.height, size.width])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!size.width || items.length <= 1) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    const index = Math.round(percent * (items.length - 1))
    setHoveredIndex(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm font-medium text-slate-400">{emptyLabel}</p>
      </div>
    )
  }

  const activePoint = hoveredIndex !== null && chart ? chart.points[hoveredIndex] : null

  return (
    <div
      className="group relative w-full select-none pt-2 pb-2"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={containerRef} className="relative h-56 w-full cursor-crosshair">
        <canvas ref={canvasRef} className="h-full w-full" />

        {activePoint ? (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full px-2 pb-2 transition-all duration-75 ease-out"
            style={{
              left: `${activePoint.xPercent}%`,
              top: `${activePoint.yPercent}%`,
            }}
          >
            <div className="flex flex-col items-center rounded-lg bg-slate-900/90 px-2 py-1 text-white shadow-xl backdrop-blur-sm">
              <span className="text-[10px] font-medium leading-none">{activePoint.label}</span>
              <span className="mt-0.5 text-[11px] font-semibold leading-none">
                {formatValue(activePoint.value)}
              </span>
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900/90" />
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="mt-3 grid gap-2 text-[10px]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, idx) => {
          const isActive = idx === hoveredIndex
          const valueLabel = formatValue(item.value)
          return (
            <div key={item.label} className="flex min-w-0 flex-col items-center">
              <span
                className={`max-w-full truncate text-[10px] font-semibold ${
                  isActive ? 'text-slate-900' : 'text-slate-500'
                }`}
                title={valueLabel}
              >
                {valueLabel}
              </span>
              <span
                className={`max-w-full truncate text-[9px] ${
                  isActive ? 'text-indigo-600 font-semibold' : 'text-slate-400'
                }`}
                title={item.label}
              >
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const MultiLineChart = ({
  labels,
  series,
  formatValue,
  emptyLabel,
}: {
  labels: string[]
  series: CompareLineSeries[]
  formatValue: (value: number) => string
  emptyLabel: string
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const chart = useMemo(() => {
    if (labels.length === 0 || series.length === 0 || size.width === 0 || size.height === 0) {
      return null
    }
    const padding = { top: 14, bottom: 18, left: 10, right: 10 }
    const values = series.flatMap((item) => item.values)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    const rangePadding = (dataMax - dataMin) * 0.2
    const effectivePadding = rangePadding === 0 ? (dataMax * 0.1 || 10) : rangePadding
    const minValue = Math.max(0, dataMin - effectivePadding)
    const maxValue = dataMax + effectivePadding
    const range = maxValue - minValue || 1
    const plotWidth = size.width - padding.left - padding.right
    const plotHeight = size.height - padding.top - padding.bottom
    const xPositions = labels.map((_, index) => {
      return labels.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (labels.length - 1)) * plotWidth
    })
    const pointsBySeries = series.map((item) => {
      const points = item.values.map((value, index) => {
        const normalized = (value - minValue) / range
        const y = padding.top + (1 - normalized) * plotHeight
        const x = xPositions[index] ?? padding.left
        return {
          x,
          y,
          xPercent: size.width ? (x / size.width) * 100 : 0,
          yPercent: size.height ? (y / size.height) * 100 : 0,
          value,
        }
      })
      return { ...item, points }
    })
    return {
      padding,
      plotWidth,
      plotHeight,
      minValue,
      maxValue,
      xPositions,
      pointsBySeries,
    }
  }, [labels, series, size.height, size.width])

  useEffect(() => {
    if (!canvasRef.current || !chart) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)

    const { padding, plotHeight, xPositions, pointsBySeries } = chart

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    xPositions.forEach((x) => {
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + plotHeight)
      ctx.stroke()
    })

    pointsBySeries.forEach((item) => {
      ctx.strokeStyle = item.color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      item.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()

      item.points.forEach((point, idx) => {
        const isActive = idx === hoveredIndex
        const radius = isActive ? 4 : 2.5
        ctx.beginPath()
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isActive ? '#ffffff' : item.color
        ctx.strokeStyle = isActive ? item.color : '#ffffff'
        ctx.lineWidth = isActive ? 2 : 1
        ctx.fill()
        ctx.stroke()
      })
    })

    if (hoveredIndex !== null && xPositions[hoveredIndex] !== undefined) {
      ctx.save()
      ctx.strokeStyle = 'rgba(148,163,184,0.7)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(xPositions[hoveredIndex], padding.top)
      ctx.lineTo(xPositions[hoveredIndex], padding.top + plotHeight)
      ctx.stroke()
      ctx.restore()
    }
  }, [chart, hoveredIndex, size.height, size.width])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!size.width || labels.length <= 1) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    const index = Math.round(percent * (labels.length - 1))
    setHoveredIndex(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  if (labels.length === 0 || series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm font-medium text-slate-400">{emptyLabel}</p>
      </div>
    )
  }

  const activeIndex = hoveredIndex ?? null
  const tooltipAlign =
    activeIndex === null
      ? 'center'
      : activeIndex <= 1
        ? 'left'
        : activeIndex >= labels.length - 2
          ? 'right'
          : 'center'

  return (
    <div
      className="group relative w-full select-none pt-2 pb-2"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
        {series.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-semibold text-slate-700">{item.label}</span>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="relative h-56 w-full cursor-crosshair">
        <canvas ref={canvasRef} className="h-full w-full" />
        {activeIndex !== null && chart ? (
          <div
            className="absolute pointer-events-none z-10 px-2 pb-2 transition-all duration-75 ease-out"
            style={{
              left: `${chart.pointsBySeries[0]?.points[activeIndex]?.xPercent ?? 0}%`,
              top: `${chart.pointsBySeries[0]?.points[activeIndex]?.yPercent ?? 0}%`,
              transform:
                tooltipAlign === 'left'
                  ? 'translate(0%, -100%)'
                  : tooltipAlign === 'right'
                    ? 'translate(-100%, -100%)'
                    : 'translate(-50%, -100%)',
            }}
          >
            <div className="min-w-[180px] rounded-lg bg-slate-900/90 px-2 py-1 text-white shadow-xl backdrop-blur-sm">
              <span className="text-[10px] font-medium">{labels[activeIndex]}</span>
              <div className="mt-1 space-y-0.5 text-[10px]">
                {series.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                    <span className="font-semibold">
                      {formatValue(item.values[activeIndex] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="mt-3 grid gap-2 text-[10px]"
        style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
      >
        {labels.map((label, idx) => {
          const isFirst = idx === 0
          const isLast = idx === labels.length - 1
          const showDense = labels.length <= 6
          const showAlternate = labels.length <= 12 && idx % 2 === 0
          const shouldShow = showDense || showAlternate || isFirst || isLast
          return (
            <div key={label} className="flex min-w-0 flex-col items-center">
              <span
                className={`max-w-full truncate text-[9px] ${
                  shouldShow ? 'text-slate-500' : 'text-transparent'
                }`}
                title={label}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ContractTypeTrendList = ({
  items,
  formatNumber,
  emptyLabel,
  labels,
}: {
  items: ContractTypeTrendItem[]
  formatNumber: (value: number) => string
  emptyLabel: string
  labels: {
    ctj: string
    cdd: string
    other: string
    total: string
    delta: string
  }
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const maxTotal = Math.max(...items.map((item) => item.total), 1)
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const totalWidth = Math.max((item.total / maxTotal) * 100, 6)
        const ctjWidth = item.total ? (item.ctj / item.total) * 100 : 0
        const cddWidth = item.total ? (item.cdd / item.total) * 100 : 0
        const otherWidth = item.total ? (item.other / item.total) * 100 : 0
        const deltaLabel = item.delta > 0 ? `+${formatNumber(item.delta)}` : formatNumber(item.delta)
        const deltaClass =
          item.delta > 0 ? 'text-emerald-600' : item.delta < 0 ? 'text-rose-600' : 'text-slate-400'
        return (
          <div key={item.label} className="flex flex-wrap items-center gap-3">
            <div className="w-16 text-xs font-semibold text-slate-600">{item.label}</div>
            <div className="flex-1 min-w-[160px]">
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full flex" style={{ width: `${totalWidth}%` }}>
                  <div className="h-full bg-sky-500" style={{ width: `${ctjWidth}%` }} />
                  <div className="h-full bg-emerald-500" style={{ width: `${cddWidth}%` }} />
                  {item.other > 0 ? (
                    <div className="h-full bg-slate-400" style={{ width: `${otherWidth}%` }} />
                  ) : null}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-400">
                <span>
                  {labels.ctj} {formatNumber(item.ctj)}
                </span>
                <span>
                  {labels.cdd} {formatNumber(item.cdd)}
                </span>
                {item.other > 0 ? (
                  <span>
                    {labels.other} {formatNumber(item.other)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-semibold text-slate-700">
                {labels.total} {formatNumber(item.total)}
              </div>
              <div className={deltaClass}>
                {labels.delta} {deltaLabel}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const SalaryPyramid = ({
  items,
  formatValue,
  emptyLabel,
}: {
  items: BarItem[]
  formatValue: (value: number) => string
  emptyLabel: string
}) => {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (items.length === 0 || total === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max((item.value / maxValue) * 100, 4)
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-20 text-[10px] font-medium text-slate-500">{item.label}</span>
            <div className="flex-1">
              <div className="h-3 w-full">
                <div
                  className="h-3 rounded-full mx-auto"
                  style={{ width: `${width}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
            <span className="w-14 text-right text-[10px] font-semibold text-slate-600">
              {formatValue(item.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const PayoutRecordsTable = ({
  columns,
  rows,
  sortKey,
  sortDirection,
  onSortChange,
  onViewMember,
  formatMoney,
  emptyLabel,
  labels,
}: {
  columns: string[]
  rows: PayoutRecordRow[]
  sortKey: string
  sortDirection: 'asc' | 'desc'
  onSortChange: (key: string) => void
  onViewMember: (memberId: number) => void
  formatMoney: (value: number) => string
  emptyLabel: string
  labels: {
    team: string
    member: string
    supervisor: string
    total: string
  }
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  const renderSort = (key: string) => {
    if (sortKey !== key) return null
    return <span className="ml-1 text-[10px] text-slate-400">{sortDirection === 'asc' ? '^' : 'v'}</span>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th
              className="px-3 py-2 text-left font-semibold cursor-pointer"
              onClick={() => onSortChange('team')}
            >
              {labels.team}
              {renderSort('team')}
            </th>
            <th
              className="px-3 py-2 text-left font-semibold cursor-pointer"
              onClick={() => onSortChange('member')}
            >
              {labels.member}
              {renderSort('member')}
            </th>
            <th
              className="px-3 py-2 text-left font-semibold cursor-pointer"
              onClick={() => onSortChange('supervisor')}
            >
              {labels.supervisor}
              {renderSort('supervisor')}
            </th>
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-right font-semibold cursor-pointer"
                onClick={() => onSortChange(column)}
              >
                {column}
                {renderSort(column)}
              </th>
            ))}
            <th
              className="px-3 py-2 text-right font-semibold cursor-pointer"
              onClick={() => onSortChange('total')}
            >
              {labels.total}
              {renderSort('total')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-700">{row.team}</td>
              <td className="px-3 py-2 text-slate-700 font-medium">
                <button
                  type="button"
                  onClick={() => onViewMember(row.id)}
                  className="text-left text-slate-900 hover:text-slate-700 hover:underline"
                >
                  {row.memberName}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-500">{row.supervisor}</td>
              {columns.map((column) => {
                const value = row.amountsByDate[column]
                return (
                  <td key={`${row.id}-${column}`} className="px-3 py-2 text-right text-slate-700">
                    {value ? formatMoney(value) : '-'}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-right font-semibold text-slate-800">
                {row.total ? formatMoney(row.total) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PositionDetailModal = ({
  open,
  title,
  items,
  formatValue,
  emptyLabel,
  onClose,
}: {
  open: boolean
  title: string
  items: BarItem[]
  formatValue: (value: number) => string
  emptyLabel: string
  onClose: () => void
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label="Close"
          >
            X
          </button>
        </div>
        <div className="mt-4">
          <BarList
            items={items}
            formatValue={formatValue}
            emptyLabel={emptyLabel}
          />
        </div>
      </div>
    </div>
  )
}

const CompareSummaryTable = ({
  rows,
  showPayroll,
  formatNumber,
  formatMoney,
  emptyLabel,
  labels,
  statusLabels,
}: {
  rows: CompareTeamStats[]
  showPayroll: boolean
  formatNumber: (value: number) => string
  formatMoney: (value: number) => string
  emptyLabel: string
  labels: {
    team: string
    people: string
    payrollTotal: string
    payrollAverage: string
    payrollMedian: string
    ctj: string
    cdd: string
    other: string
    expiringSoon: string
    overdue: string
    missing: string
  }
  statusLabels: {
    active: string
    onLeave: string
    terminated: string
  }
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="min-w-max w-full text-xs text-slate-700">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">{labels.team}</th>
            <th className="px-4 py-3 text-right">{labels.people}</th>
            <th className="px-4 py-3 text-right">{statusLabels.active}</th>
            <th className="px-4 py-3 text-right">{statusLabels.onLeave}</th>
            <th className="px-4 py-3 text-right">{statusLabels.terminated}</th>
            {showPayroll ? (
              <>
                <th className="px-4 py-3 text-right">{labels.payrollTotal}</th>
                <th className="px-4 py-3 text-right">{labels.payrollAverage}</th>
                <th className="px-4 py-3 text-right">{labels.payrollMedian}</th>
              </>
            ) : null}
            <th className="px-4 py-3 text-right">{labels.ctj}</th>
            <th className="px-4 py-3 text-right">{labels.cdd}</th>
            <th className="px-4 py-3 text-right">{labels.other}</th>
            <th className="px-4 py-3 text-right">{labels.expiringSoon}</th>
            <th className="px-4 py-3 text-right">{labels.overdue}</th>
            <th className="px-4 py-3 text-right">{labels.missing}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-semibold text-slate-800">{row.label}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.headcount)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.activeCount)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.onLeaveCount)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.terminatedCount)}</td>
              {showPayroll ? (
                <>
                  <td className="px-4 py-2 text-right">{formatMoney(row.payrollTotal)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.payrollAverage)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.payrollMedian)}</td>
                </>
              ) : null}
              <td className="px-4 py-2 text-right">{formatNumber(row.contractType.ctj)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.contractType.cdd)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.contractType.other)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.contractExpiry.upcoming)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.contractExpiry.overdue)}</td>
              <td className="px-4 py-2 text-right">{formatNumber(row.contractExpiry.missing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PositionCompareList = ({
  rows,
  formatNumber,
  emptyLabel,
  labels,
}: {
  rows: Array<{
    key: string
    label: string
    topPositions: Array<{ label: string; value: number }>
    positionMissing: number
  }>
  formatNumber: (value: number) => string
  emptyLabel: string
  labels: {
    people: string
    missingPosition: string
  }
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-slate-800">{row.label}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {row.topPositions.length === 0 ? (
              <p className="text-slate-400">{emptyLabel}</p>
            ) : (
              row.topPositions.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 font-semibold text-slate-700">
                    {formatNumber(item.value)} {labels.people}
                  </span>
                </div>
              ))
            )}
          </div>
          {row.positionMissing ? (
            <p className="mt-2 text-[10px] text-slate-400">
              {labels.missingPosition}: {formatNumber(row.positionMissing)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const TeamCostHeatmap = ({
  items,
  resolveTeamLabel,
  formatMoney,
  formatNumber,
  formatRatio,
  emptyLabel,
  hint,
  labels,
}: {
  items: TeamStatsItem[]
  resolveTeamLabel: (value: string) => string
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
              const displayLabel = resolveTeamLabel(item.label)
              return (
                <tr key={item.label} className="group hover:bg-slate-50">
                  <td
                    className="px-4 py-3 text-slate-800 font-bold truncate bg-white group-hover:bg-slate-50"
                    title={displayLabel}
                  >
                    {displayLabel}
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
              {rows.map((item) => {
                const displayLabel = resolveTeamLabel(item.label)
                return (
                  <th
                    key={item.label}
                    className="px-4 py-3 text-center font-bold text-slate-600 bg-slate-50 border-b border-slate-200 whitespace-nowrap min-w-[80px]"
                    title={displayLabel}
                  >
                    {displayLabel}
                  </th>
                )
              })}
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
  onTeamSelect,
  resolveTeamLabel,
}: {
  items: TeamBarItem[]
  missing: number
  t: MemberCopy
  showPayroll: boolean
  sortMode: TeamSortMode
  onSortChange: (mode: TeamSortMode) => void
  formatMoney: (value: number) => string
  onTeamSelect?: (team: string) => void
  resolveTeamLabel: (value: string) => string
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
           const cardClasses = `group relative text-left w-full ${
             onTeamSelect ? 'cursor-pointer' : 'cursor-default'
           }`
           const handleClick = onTeamSelect
             ? () => {
                 onTeamSelect(item.label)
               }
             : undefined
           const displayLabel = resolveTeamLabel(item.label)
           return (
             <button
               key={item.label}
               type="button"
               onClick={handleClick}
               className={cardClasses}
             >
                <div className="mb-2 flex items-end justify-between">
                   <div className="flex flex-col min-w-0 pr-2">
                       <span className="font-bold text-slate-700 truncate" title={displayLabel}>{displayLabel}</span>
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
             </button>
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
  onTeamsSelect,
  resolveTeamLabel,
}: {
  items: SupervisorItem[]
  missing: number
  t: MemberCopy
  showPayroll: boolean
  sortMode: TeamSortMode
  onSortChange: (mode: TeamSortMode) => void
  formatMoney: (value: number) => string
  onTeamsSelect?: (teams: string[]) => void
  resolveTeamLabel: (value: string) => string
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
          const selectableTeams = item.teamDetails
            .map((team) => team.name)
            .filter((name) => name && name !== t.overview.labels.unassignedTeam)
          const handleClick = onTeamsSelect
            ? () => {
                onTeamsSelect(selectableTeams)
              }
            : undefined
          return (
            <button
              key={item.label}
              type="button"
              onClick={handleClick}
              className={`flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md overflow-hidden text-left ${
                onTeamsSelect ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
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
                 {item.teamDetails.map((team) => {
                    const displayTeam = resolveTeamLabel(team.name)
                    return (
                    <div key={team.name} className="group">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-slate-600 truncate pr-2" title={displayTeam}>
                          {displayTeam}
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
                  )
                 })}
                 {item.teamDetails.length === 0 && (
                     <p className="text-xs text-slate-400 italic text-center py-2">
                        {t.overview.labels.unassignedTeam}
                     </p>
                 )}
               </div>
            </button>
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
  canUpdateMember,
  projectFilterOptions,
  statusFilterOptions,
  nationalityFilterOptions,
  teamFilterOptions,
  teamSupervisorMap,
  projectFilters,
  statusFilters,
  nationalityFilters,
  teamFilters,
  onProjectFiltersChange,
  onStatusFiltersChange,
  onNationalityFiltersChange,
  onTeamFiltersChange,
  onViewMember,
  onRefreshMembers,
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
  const resolveTeamLabel = useCallback(
    (team: string) => resolveTeamDisplayName(team, locale, teamSupervisorMap) || team,
    [locale, teamSupervisorMap],
  )

  const [payrollPayouts, setPayrollPayouts] = useState<PayrollPayout[]>([])
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [payrollContractSnapshots, setPayrollContractSnapshots] = useState<
    Record<number, Record<number, PayrollContractSnapshot>>
  >({})
  const [payrollReady, setPayrollReady] = useState(false)
  const [viewMode, setViewMode] = useState<'overview' | 'detail' | 'compare'>('overview')
  const [teamSortMode, setTeamSortMode] = useState<TeamSortMode>('count')
  const [supervisorSortMode, setSupervisorSortMode] = useState<TeamSortMode>('count')
  const [positionGroupFocus, setPositionGroupFocus] = useState<string | null>(null)
  const [detailTeams, setDetailTeams] = useState<string[]>([])
  const [detailAutoMonthsPending, setDetailAutoMonthsPending] = useState(false)
  const [detailMonthOptions, setDetailMonthOptions] = useState<string[]>([])
  const [dataQualityModal, setDataQualityModal] = useState<{
    key: DataQualityKey
    scope: 'overview' | 'detail'
  } | null>(null)
  const [dataQualityDrafts, setDataQualityDrafts] = useState<Record<number, string>>({})
  const [dataQualitySaving, setDataQualitySaving] = useState(false)
  const [dataQualityError, setDataQualityError] = useState<string | null>(null)
  const [dataQualityNotice, setDataQualityNotice] = useState<string | null>(null)
  const [contractExpiryModal, setContractExpiryModal] = useState<{
    key: string
    scope: 'overview' | 'detail'
  } | null>(null)
  const detailMemberIdsRef = useRef<Set<number>>(new Set())
  const [detailRecordSort, setDetailRecordSort] = useState<{
    key: string
    direction: 'asc' | 'desc'
  }>({ key: 'total', direction: 'desc' })
  const defaultPayrollMonth = useMemo(() => getLastMonthValue(), [])
  const [payrollMonthFilters, setPayrollMonthFilters] = useState<string[]>(() => [
    defaultPayrollMonth,
  ])
  const payrollMonthOptions = useMemo(() => buildRecentMonthOptions(12), [])
  const activePayrollMonths = useMemo(() => {
    const months = payrollMonthFilters.length > 0 ? payrollMonthFilters : [defaultPayrollMonth]
    return Array.from(new Set(months)).sort()
  }, [payrollMonthFilters, defaultPayrollMonth])
  const payrollMonthCount = Math.max(activePayrollMonths.length, 1)
  const handlePayrollMonthChange = useCallback(
    (next: string[]) => {
      setPayrollMonthFilters(next.length === 0 ? [defaultPayrollMonth] : next)
    },
    [defaultPayrollMonth],
  )

  useEffect(() => {
    if (!dataQualityModal) {
      setDataQualityDrafts({})
      setDataQualityError(null)
      setDataQualityNotice(null)
      return
    }
    setDataQualityDrafts({})
    setDataQualityError(null)
    setDataQualityNotice(null)
  }, [dataQualityModal])

  const triggerDetailAutoMonths = useCallback(() => {
    if (payrollMonthOptions.length === 0) return
    setDetailMonthOptions([])
    setDetailAutoMonthsPending(true)
  }, [payrollMonthOptions])

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

  const payrollRunsById = useMemo(() => {
    const map = new Map<number, PayrollRun>()
    payrollRuns.forEach((run) => {
      map.set(run.id, run)
    })
    return map
  }, [payrollRuns])

  const payrollSnapshotByMonth = useMemo(() => {
    const snapshotByMonth = new Map<string, Record<number, PayrollContractSnapshot>>()
    const seqByMonth = new Map<string, number>()
    payrollRuns.forEach((run) => {
      const snapshot = payrollContractSnapshots[run.id]
      if (!snapshot) return
      const key = formatMonthValue(run.year, run.month)
      const prevSeq = seqByMonth.get(key) ?? -1
      if (run.sequence >= prevSeq) {
        seqByMonth.set(key, run.sequence)
        snapshotByMonth.set(key, snapshot)
      }
    })
    return snapshotByMonth
  }, [payrollRuns, payrollContractSnapshots])

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

  const membersById = useMemo(() => {
    const map = new Map<number, Member>()
    members.forEach((member) => {
      map.set(member.id, member)
    })
    return map
  }, [members])
  const handleViewDetailMember = useCallback(
    (memberId: number) => {
      const member = membersById.get(memberId)
      if (member) {
        onViewMember(member)
      }
    },
    [membersById, onViewMember],
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
      return nameCollator.compare(resolveTeamLabel(a.label), resolveTeamLabel(b.label))
    })
    return list.map((item, idx): TeamBarItem => ({
      ...item,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [teamStats.items, teamSortMode, showTeamPayroll, nameCollator, resolveTeamLabel])

  const detailTeamOptions = useMemo(
    () =>
      sortedTeamItems.map((item) => ({
        value: item.label,
        label: resolveTeamLabel(item.label),
      })),
    [resolveTeamLabel, sortedTeamItems],
  )

  const defaultDetailTeam = useMemo(
    () => (sortedTeamItems[0]?.label ? [sortedTeamItems[0].label] : []),
    [sortedTeamItems],
  )

  const activeDetailTeams = useMemo(
    () => (detailTeams.length > 0 ? detailTeams : defaultDetailTeam),
    [detailTeams, defaultDetailTeam],
  )

  const handleDetailTeamChange = useCallback(
    (next: string[]) => {
      if (next.length === 0) {
        setDetailTeams(defaultDetailTeam)
        return
      }
      setDetailTeams(next)
    },
    [defaultDetailTeam],
  )

  const handleDetailRecordSort = useCallback((key: string) => {
    setDetailRecordSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'desc' }
    })
  }, [])

  const handleDetailJump = useCallback(
    (teams: string[]) => {
      const normalized = Array.from(new Set(teams.filter(Boolean)))
      if (normalized.length === 0) {
        setDetailTeams(defaultDetailTeam)
      } else {
        setDetailTeams(normalized)
      }
      triggerDetailAutoMonths()
      setViewMode('detail')
    },
    [defaultDetailTeam, triggerDetailAutoMonths],
  )

  const handleViewModeChange = useCallback(
    (mode: 'overview' | 'detail' | 'compare') => {
      if (mode === 'overview') {
        setPayrollMonthFilters([defaultPayrollMonth])
        setDetailMonthOptions([])
        setDetailAutoMonthsPending(false)
      }
      if (mode === 'detail' && detailTeams.length === 0) {
        setDetailTeams(defaultDetailTeam)
      }
      if (mode === 'detail') {
        triggerDetailAutoMonths()
      }
      if (mode === 'compare') {
        const selectedTeams = teamFilters.filter(
          (team) => team && team !== EMPTY_FILTER_VALUE,
        )
        if (selectedTeams.length < 2) {
          const options = teamFilterOptions
            .map((option) => option.value)
            .filter((value) => value && value !== EMPTY_FILTER_VALUE)
          if (options.length > 0) {
            if (selectedTeams.length === 0) {
              onTeamFiltersChange(options.slice(0, 2))
            } else {
              const fallback = options.find((value) => value !== selectedTeams[0])
              if (fallback) {
                onTeamFiltersChange([selectedTeams[0], fallback])
              }
            }
          }
        }
        const defaultMonths = payrollMonthOptions.slice(0, 5).map((option) => option.value)
        if (defaultMonths.length > 0) {
          setPayrollMonthFilters(defaultMonths)
        }
        setDetailMonthOptions([])
        setDetailAutoMonthsPending(false)
      }
      setViewMode(mode)
    },
    [
      defaultDetailTeam,
      defaultPayrollMonth,
      detailTeams.length,
      onTeamFiltersChange,
      payrollMonthOptions,
      teamFilterOptions,
      teamFilters,
      triggerDetailAutoMonths,
    ],
  )

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
    const ranges = getSalaryRanges(payrollMonthCount)
    const values = localMembers.map(
      (member) => resolveMonthlySalary(member) * payrollMonthCount,
    )
    return buildSalaryDistribution(values, formatMoney, ranges)
  }, [localMembers, formatMoney, payrollMonthCount])

  const payoutSalaryStats = useMemo(() => {
    if (!showTeamPayroll) return []
    const ranges = getSalaryRanges(payrollMonthCount)
    const values = localMembers.map((member) => payrollPayoutsByMemberId.get(member.id) ?? 0)
    return buildSalaryDistribution(values, formatMoney, ranges)
  }, [localMembers, payrollPayoutsByMemberId, showTeamPayroll, formatMoney, payrollMonthCount])

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

  const ageStats = useMemo(() => {
    const yearUnit = locale === 'fr' ? 'ans' : '岁'
    const ranges = [
      { label: `0-17${yearUnit}`, min: 0, max: 17 },
      { label: `18-24${yearUnit}`, min: 18, max: 24 },
      { label: `25-29${yearUnit}`, min: 25, max: 29 },
      { label: `30-34${yearUnit}`, min: 30, max: 34 },
      { label: `35-39${yearUnit}`, min: 35, max: 39 },
      { label: `40-44${yearUnit}`, min: 40, max: 44 },
      { label: `45-49${yearUnit}`, min: 45, max: 49 },
      { label: `50+${yearUnit}`, min: 50, max: Number.POSITIVE_INFINITY },
    ]
    const counts = ranges.map(() => 0)
    let missing = 0
    const now = new Date()
    scopedMembers.forEach((member) => {
      if (!member.birthDate) {
        missing += 1
        return
      }
      const birthDate = new Date(member.birthDate)
      if (Number.isNaN(birthDate.getTime())) {
        missing += 1
        return
      }
      let age = now.getFullYear() - birthDate.getFullYear()
      const monthDiff = now.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age -= 1
      }
      if (age < 0) {
        missing += 1
        return
      }
      const index = ranges.findIndex((range) => age >= range.min && age <= range.max)
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

  const detailTeamSet = useMemo(() => new Set(activeDetailTeams), [activeDetailTeams])

  const detailMembers = useMemo(
    () =>
      localMembers.filter(
        (member) =>
          member.nationality !== 'china' &&
          detailTeamSet.has(normalizeText(member.expatProfile?.team)),
      ),
    [localMembers, detailTeamSet],
  )

  const compareTeamKeys = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    teamFilters.forEach((team) => {
      const key = normalizeText(team)
      if (!key || key === EMPTY_FILTER_VALUE || seen.has(key)) return
      seen.add(key)
      list.push(key)
    })
    return list
  }, [teamFilters])

  const compareMonthLabels = useMemo(
    () => sortMonthValues(activePayrollMonths),
    [activePayrollMonths],
  )

  const compareTeamStats = useMemo(() => {
    return compareTeamKeys.map((teamKey) => {
      const teamMembers = localMembers.filter(
        (member) =>
          member.nationality !== 'china' &&
          normalizeText(member.expatProfile?.team) === teamKey,
      )
      const headcount = teamMembers.length
      const activeCount = teamMembers.filter(
        (member) => member.employmentStatus === 'ACTIVE',
      ).length
      const onLeaveCount = teamMembers.filter(
        (member) => member.employmentStatus === 'ON_LEAVE',
      ).length
      const terminatedCount = teamMembers.filter(
        (member) => member.employmentStatus === 'TERMINATED',
      ).length
      const payrollTotals = showTeamPayroll
        ? teamMembers.map((member) => payrollPayoutsByMemberId.get(member.id) ?? 0)
        : []
      const payrollTotal = showTeamPayroll
        ? payrollTotals.reduce((sum, value) => sum + value, 0)
        : 0
      const payrollAverage =
        showTeamPayroll && headcount > 0 ? payrollTotal / headcount : 0
      const payrollMedian = showTeamPayroll ? calculateMedian(payrollTotals) : 0
      const contractType = { ctj: 0, cdd: 0, other: 0 }
      const contractTypePayroll = { ctj: 0, cdd: 0, other: 0 }
      teamMembers.forEach((member) => {
        const type = member.expatProfile?.contractType ?? null
        if (type === 'CTJ') {
          contractType.ctj += 1
        } else if (type === 'CDD') {
          contractType.cdd += 1
        } else {
          contractType.other += 1
        }
        if (showTeamPayroll) {
          const payout = payrollPayoutsByMemberId.get(member.id) ?? 0
          if (type === 'CTJ') contractTypePayroll.ctj += payout
          else if (type === 'CDD') contractTypePayroll.cdd += payout
          else contractTypePayroll.other += payout
        }
      })
      const contractExpiry = buildContractExpirySummary(teamMembers)
      const positionStats = buildPositionStats(
        teamMembers,
        nameCollator,
        t.overview.positionGroups,
      )
      const topPositions = [...positionStats.items]
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map((item) => ({ label: item.label, value: item.value }))
      return {
        key: teamKey,
        label: resolveTeamLabel(teamKey),
        headcount,
        activeCount,
        onLeaveCount,
        terminatedCount,
        payrollTotal,
        payrollAverage,
        payrollMedian,
        contractType,
        contractTypePayroll,
        contractExpiry,
        topPositions,
        positionMissing: positionStats.missing,
      } as CompareTeamStats
    })
  }, [
    compareTeamKeys,
    localMembers,
    nameCollator,
    payrollPayoutsByMemberId,
    resolveTeamLabel,
    showTeamPayroll,
    t.overview.positionGroups,
  ])

  const compareMonthlySeries = useMemo(() => {
    if (!showTeamPayroll || compareMonthLabels.length === 0) {
      return { totalSeries: [], averageSeries: [] }
    }
    const monthIndex = new Map(compareMonthLabels.map((label, idx) => [label, idx]))
    const totalsByTeam = new Map<string, number[]>()
    const memberSetsByTeam = new Map<string, Array<Set<number>>>()
    compareTeamKeys.forEach((teamKey) => {
      totalsByTeam.set(teamKey, Array(compareMonthLabels.length).fill(0))
      memberSetsByTeam.set(
        teamKey,
        Array.from({ length: compareMonthLabels.length }, () => new Set<number>()),
      )
    })
    const memberTeamMap = new Map<number, string>()
    localMembers.forEach((member) => {
      if (member.nationality === 'china') return
      const teamKey = normalizeText(member.expatProfile?.team)
      if (!teamKey || !totalsByTeam.has(teamKey)) return
      memberTeamMap.set(member.id, teamKey)
    })
    payrollPayouts.forEach((payout) => {
      const teamKey = memberTeamMap.get(payout.userId)
      if (!teamKey) return
      const run = payrollRunsById.get(payout.runId)
      const monthKey = run
        ? formatMonthValue(run.year, run.month)
        : payout.payoutDate.slice(0, 7)
      const index = monthIndex.get(monthKey)
      if (index === undefined) return
      const amount = parseNumber(payout.amount)
      if (amount === null) return
      const totals = totalsByTeam.get(teamKey)
      if (!totals) return
      totals[index] += amount
      const memberSets = memberSetsByTeam.get(teamKey)
      if (memberSets) {
        memberSets[index]?.add(payout.userId)
      }
    })
    const totalSeries = compareTeamKeys.map((teamKey, idx) => ({
      key: teamKey,
      label: resolveTeamLabel(teamKey),
      color: CHART_COLORS[idx % CHART_COLORS.length],
      values: totalsByTeam.get(teamKey) ?? Array(compareMonthLabels.length).fill(0),
    }))
    const averageSeries = compareTeamKeys.map((teamKey, idx) => {
      const totals = totalsByTeam.get(teamKey) ?? Array(compareMonthLabels.length).fill(0)
      const memberSets = memberSetsByTeam.get(teamKey) ?? []
      const values = totals.map((total, index) => {
        const count = memberSets[index]?.size ?? 0
        return count > 0 ? total / count : 0
      })
      return {
        key: teamKey,
        label: resolveTeamLabel(teamKey),
        color: CHART_COLORS[idx % CHART_COLORS.length],
        values,
      }
    })
    return { totalSeries, averageSeries }
  }, [
    compareMonthLabels,
    compareTeamKeys,
    localMembers,
    payrollPayouts,
    payrollRunsById,
    resolveTeamLabel,
    showTeamPayroll,
  ])

  const compareHeatmapItems = useMemo(
    () =>
      compareTeamStats.map((team) => ({
        label: team.key,
        value: team.headcount,
        payrollTotal: team.payrollTotal,
        payrollAverage: team.payrollAverage,
        payrollMedian: team.payrollMedian,
      })),
    [compareTeamStats],
  )

  const compareHeadcountItems = useMemo(
    () =>
      compareTeamStats.map((team, idx) => ({
        label: team.label,
        value: team.headcount,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
    [compareTeamStats],
  )

  const comparePayrollItems = useMemo(() => {
    if (!showTeamPayroll) return []
    return compareTeamStats.map((team, idx) => ({
      label: team.label,
      value: team.payrollTotal,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [compareTeamStats, showTeamPayroll])

  const compareExpiryItems = useMemo(
    () =>
      compareTeamStats.map((team, idx) => ({
        label: team.label,
        value: team.contractExpiry.upcoming,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })),
    [compareTeamStats],
  )

  const compareExpiryTotals = useMemo(
    () =>
      compareTeamStats.reduce(
        (acc, team) => ({
          overdue: acc.overdue + team.contractExpiry.overdue,
          missing: acc.missing + team.contractExpiry.missing,
        }),
        { overdue: 0, missing: 0 },
      ),
    [compareTeamStats],
  )

  const compareHeatmapClass = useMemo(
    () => (compareTeamStats.length > 4 ? 'md:col-span-2' : 'md:col-span-1'),
    [compareTeamStats.length],
  )
  const compareChartColumnsClass = useMemo(
    () => (compareTeamStats.length > 4 ? 'md:grid-cols-2' : 'md:grid-cols-3'),
    [compareTeamStats.length],
  )

  const comparePositionRows = useMemo(
    () =>
      compareTeamStats.map((team) => ({
        key: team.key,
        label: team.label,
        topPositions: team.topPositions,
        positionMissing: team.positionMissing,
      })),
    [compareTeamStats],
  )

  const compareReady = compareTeamKeys.length >= 2

  const missingPhoneCount = useMemo(() => countMissingPhones(scopedMembers), [scopedMembers])
  const detailMissingPhoneCount = useMemo(
    () => countMissingPhones(detailMembers),
    [detailMembers],
  )
  const localNonChinaMembers = useMemo(
    () => localMembers.filter((member) => member.nationality !== 'china'),
    [localMembers],
  )
  const cnpsStats = useMemo(() => buildCnpsStats(localNonChinaMembers), [localNonChinaMembers])
  const detailCnpsStats = useMemo(() => buildCnpsStats(detailMembers), [detailMembers])

  const handleDataQualityOpen = useCallback(
    (key: DataQualityKey, scope: 'overview' | 'detail') => {
      setDataQualityModal({ key, scope })
    },
    [],
  )

  const handleDataQualityClose = useCallback(() => {
    setDataQualityModal(null)
  }, [])

  const handleDataQualityDraftChange = useCallback((memberId: number, value: string) => {
    setDataQualityDrafts((prev) => ({ ...prev, [memberId]: value }))
    setDataQualityError(null)
    setDataQualityNotice(null)
  }, [])

  const dataQualityFieldLabel = useMemo(() => {
    if (!dataQualityModal) return ''
    if (dataQualityModal.key === 'missingPhone') return t.table.phones
    if (dataQualityModal.key === 'missingCnps') return t.table.cnpsNumber
    return t.table.cnpsDeclarationCode
  }, [dataQualityModal, t.table.cnpsDeclarationCode, t.table.cnpsNumber, t.table.phones])

  const dataQualityPlaceholder = useMemo(() => {
    if (!dataQualityModal) return ''
    if (dataQualityModal.key === 'missingPhone') return t.form.phonePlaceholder
    if (dataQualityModal.key === 'missingCnps') return t.form.cnpsNumber
    return t.form.cnpsDeclarationCode
  }, [
    dataQualityModal,
    t.form.cnpsDeclarationCode,
    t.form.cnpsNumber,
    t.form.phonePlaceholder,
  ])

  const dataQualityRows = useMemo(() => {
    if (!dataQualityModal) return []
    const baseMembers =
      dataQualityModal.scope === 'detail'
        ? detailMembers
        : dataQualityModal.key === 'missingPhone'
          ? scopedMembers
          : localNonChinaMembers
    const filtered = baseMembers.filter((member) => {
      if (dataQualityModal.key === 'missingPhone') return isMissingPhone(member)
      if (dataQualityModal.key === 'missingCnps') return isMissingCnpsNumber(member)
      return isMissingCnpsAndDeclaration(member)
    })
    return filtered.map((member) => {
      const teamValue = normalizeText(member.expatProfile?.team)
      const teamLabel = teamValue
        ? resolveTeamLabel(teamValue)
        : t.overview.labels.unassignedTeam
      const displayName = normalizeText(member.name ?? null) || member.username || `#${member.id}`
      const parsedBirthDate = member.birthDate ? new Date(member.birthDate) : null
      const birthDate =
        parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
          ? parsedBirthDate.toLocaleDateString(locale)
          : t.labels.empty
      const fieldValue =
        dataQualityModal.key === 'missingPhone'
          ? member.phones?.join(' / ') ?? ''
          : dataQualityModal.key === 'missingCnps'
            ? member.expatProfile?.cnpsNumber ?? ''
            : member.expatProfile?.cnpsDeclarationCode ?? ''
      return {
        id: member.id,
        team: teamLabel,
        name: displayName,
        birthDate,
        fieldValue,
        member,
      }
    })
  }, [
    dataQualityModal,
    detailMembers,
    locale,
    localNonChinaMembers,
    resolveTeamLabel,
    scopedMembers,
    t.labels.empty,
    t.overview.labels.unassignedTeam,
  ])

  const dataQualityChanges = useMemo(() => {
    if (!dataQualityModal) return []
    return dataQualityRows.flatMap((row) => {
      const draft = dataQualityDrafts[row.id]
      if (draft === undefined) return []
      if (normalizeText(draft) === normalizeText(row.fieldValue)) return []
      return [{ id: row.id, value: draft }]
    })
  }, [dataQualityModal, dataQualityDrafts, dataQualityRows])

  const handleDataQualitySave = useCallback(async () => {
    if (!dataQualityModal) return
    if (!canUpdateMember) {
      setDataQualityError(t.errors.needMemberUpdate)
      return
    }
    if (dataQualityChanges.length === 0) {
      setDataQualityError(null)
      setDataQualityNotice(t.feedback.bulkSaveEmpty)
      return
    }
    setDataQualitySaving(true)
    setDataQualityError(null)
    setDataQualityNotice(null)
    try {
      const items = dataQualityChanges.map(({ id, value }) => {
        const trimmed = value.trim()
        const patch =
          dataQualityModal.key === 'missingPhone'
            ? { phones: trimmed }
            : dataQualityModal.key === 'missingCnps'
              ? { expatProfile: { cnpsNumber: trimmed } }
              : { expatProfile: { cnpsDeclarationCode: trimmed } }
        return { id, patch }
      })
      const res = await fetch('/api/members/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      const data = await res.json().catch(() => ({}))
      const results = Array.isArray(data.results) ? data.results : []
      const failed = results.filter((result: { ok: boolean }) => !result.ok)
      const successCount = results.length - failed.length
      if (failed.length > 0) {
        const failedIds = new Set(failed.map((result: { id: number }) => result.id))
        setDataQualityDrafts((prev) => {
          const next: Record<number, string> = {}
          Object.entries(prev).forEach(([id, value]) => {
            if (failedIds.has(Number(id))) {
              next[Number(id)] = value
            }
          })
          return next
        })
        setDataQualityError(
          failed[0]?.error ? String(failed[0].error) : t.feedback.submitError,
        )
        setDataQualityNotice(t.feedback.bulkSavePartial(successCount, failed.length))
      } else {
        setDataQualityNotice(t.feedback.bulkSaveSuccess(successCount))
        setDataQualityDrafts({})
      }
      if (successCount > 0) {
        await onRefreshMembers()
      }
    } catch (err) {
      setDataQualityError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setDataQualitySaving(false)
    }
  }, [
    canUpdateMember,
    dataQualityChanges,
    dataQualityModal,
    onRefreshMembers,
    t.errors.needMemberUpdate,
    t.feedback.bulkSaveEmpty,
    t.feedback.bulkSavePartial,
    t.feedback.bulkSaveSuccess,
    t.feedback.submitError,
  ])

  const detailMemberIds = useMemo(() => new Set(detailMembers.map((member) => member.id)), [detailMembers])

  useEffect(() => {
    detailMemberIdsRef.current = detailMemberIds
  }, [detailMemberIds])

  const detailMemberIdParam = useMemo(() => {
    if (viewMode !== 'detail') return ''
    const ids = Array.from(detailMemberIds).sort((a, b) => a - b)
    return ids.length > 0 ? ids.join(',') : ''
  }, [detailMemberIds, viewMode])

  // Fetch payroll data when permission is granted
  useEffect(() => {
    if (!canViewPayroll) return

    let cancelled = false
    const loadPayroll = async () => {
      setPayrollReady(false)
      const monthValues = detailAutoMonthsPending
        ? payrollMonthOptions.map((option) => option.value)
        : activePayrollMonths

      try {
        const monthsParam = monthValues.join(',')
        const params = new URLSearchParams()
        params.set('months', monthsParam)
        if (detailMemberIdParam) params.set('memberIds', detailMemberIdParam)
        const res = await fetch(`/api/payroll-runs?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load payroll')
        const payload = (await res.json()) as {
          runs?: PayrollRun[]
          payouts?: PayrollPayout[]
          contractSnapshots?: PayrollContractSnapshotPayload[]
        }
        if (cancelled) return
        const nextPayouts = Array.isArray(payload.payouts) ? payload.payouts : []
        const nextRuns = Array.isArray(payload.runs) ? payload.runs : []
        const runsById = new Map<number, PayrollRun>()
        nextRuns.forEach((run) => {
          runsById.set(run.id, run)
        })
        const snapshotsByRunId: Record<number, Record<number, PayrollContractSnapshot>> = {}
        const snapshots = Array.isArray(payload.contractSnapshots) ? payload.contractSnapshots : []
        snapshots.forEach((snapshot) => {
          const contracts: Record<number, PayrollContractSnapshot> = {}
          Object.entries(snapshot.contracts ?? {}).forEach(([userId, contract]) => {
            const id = Number(userId)
            if (Number.isNaN(id)) return
            contracts[id] = contract
          })
          snapshotsByRunId[snapshot.runId] = contracts
        })
        setPayrollPayouts(nextPayouts)
        setPayrollRuns(Array.from(runsById.values()))
        setPayrollContractSnapshots(snapshotsByRunId)
        setPayrollReady(true)

        if (detailAutoMonthsPending) {
          const monthSet = new Set<string>()
          const memberIds = detailMemberIdsRef.current
          nextPayouts.forEach((payout) => {
            if (!memberIds.has(payout.userId)) return
            const run = runsById.get(payout.runId)
            const key = run
              ? formatMonthValue(run.year, run.month)
              : payout.payoutDate.slice(0, 7)
            monthSet.add(key)
          })
          const available = sortMonthValues(Array.from(monthSet))
          const fallback = sortMonthValues(payrollMonthOptions.map((option) => option.value))
          const optionValues = available.length > 0 ? available : fallback
          const selection = optionValues.slice(-5)
          setDetailMonthOptions(optionValues)
          if (selection.length > 0) {
            setPayrollMonthFilters(selection)
          }
          setDetailAutoMonthsPending(false)
        }
      } catch {
        if (cancelled) return
        setPayrollPayouts([])
        setPayrollRuns([])
        setPayrollContractSnapshots({})
        setPayrollReady(false)
        if (detailAutoMonthsPending) {
          setDetailAutoMonthsPending(false)
        }
      }
    }

    void loadPayroll()

    return () => {
      cancelled = true
    }
  }, [
    canViewPayroll,
    activePayrollMonths,
    detailAutoMonthsPending,
    payrollMonthOptions,
    detailMemberIdParam,
  ])

  const positionStats = useMemo(() => {
    const positionMembers = localMembers.filter((member) => member.nationality !== 'china')
    return buildPositionStats(positionMembers, nameCollator, t.overview.positionGroups)
  }, [localMembers, nameCollator, t.overview.positionGroups])

  const detailPositionStats = useMemo(
    () => buildPositionStats(detailMembers, nameCollator, t.overview.positionGroups),
    [detailMembers, nameCollator, t.overview.positionGroups],
  )

  const currentPositionStats = viewMode === 'detail' ? detailPositionStats : positionStats

  const activePositionGroup = useMemo(
    () => currentPositionStats.items.find((item) => item.key === positionGroupFocus) ?? null,
    [positionGroupFocus, currentPositionStats.items],
  )

  const positionDetailItems = useMemo(() => {
    if (!activePositionGroup) return []
    return activePositionGroup.rawItems.map((item, idx) => ({
      label: item.label,
      value: item.value,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [activePositionGroup])

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

  const contractExpiryStats = useMemo(
    () => buildContractExpiryStats(localMembers, t.overview.labels.overdue),
    [localMembers, t.overview.labels.overdue],
  )

  const detailPayouts = useMemo(() => {
    if (!showTeamPayroll) return []
    return payrollPayouts.flatMap((payout) => {
      if (!detailMemberIds.has(payout.userId)) return []
      const amount = parseNumber(payout.amount)
      if (amount === null) return []
      return [{ payout, amount }]
    })
  }, [detailMemberIds, payrollPayouts, showTeamPayroll])

  const detailPayoutsByMemberId = useMemo(() => {
    const map = new Map<number, number>()
    detailPayouts.forEach(({ payout, amount }) => {
      map.set(payout.userId, (map.get(payout.userId) ?? 0) + amount)
    })
    return map
  }, [detailPayouts])

  const visiblePayrollMonthOptions = useMemo(() => {
    if (viewMode !== 'detail' || detailMonthOptions.length === 0) return payrollMonthOptions
    return detailMonthOptions.map((value) => ({ value, label: value }))
  }, [detailMonthOptions, payrollMonthOptions, viewMode])

  const detailMonthlyStats = useMemo(() => {
    const months = sortMonthValues(activePayrollMonths)
    const map = new Map<string, { total: number; memberIds: Set<number> }>()
    months.forEach((key) => {
      map.set(key, { total: 0, memberIds: new Set() })
    })
    detailPayouts.forEach(({ payout, amount }) => {
      const run = payrollRunsById.get(payout.runId)
      const key = run ? formatMonthValue(run.year, run.month) : payout.payoutDate.slice(0, 7)
      const entry = map.get(key)
      if (!entry) return
      entry.total += amount
      entry.memberIds.add(payout.userId)
    })
    return months.map((key) => {
      const entry = map.get(key) ?? { total: 0, memberIds: new Set() }
      const count = entry.memberIds.size
      return {
        key,
        label: key,
        total: entry.total,
        average: count > 0 ? entry.total / count : 0,
        memberIds: entry.memberIds,
      }
    })
  }, [activePayrollMonths, detailPayouts, payrollRunsById])

  const detailPayrollTotalSeries = useMemo(
    () =>
      detailMonthlyStats.map((item) => ({
        label: item.label,
        value: item.total,
      })),
    [detailMonthlyStats],
  )

  const detailPayrollAverageSeries = useMemo(
    () =>
      detailMonthlyStats.map((item) => ({
        label: item.label,
        value: item.average,
      })),
    [detailMonthlyStats],
  )

  const detailContractTypeTrend = useMemo(() => {
    const result: ContractTypeTrendItem[] = []
    let prevTotal = 0
    detailMonthlyStats.forEach((item, index) => {
      const snapshot = payrollSnapshotByMonth.get(item.key) ?? {}
      let ctj = 0
      let cdd = 0
      let other = 0
      item.memberIds.forEach((memberId) => {
        const type =
          snapshot[memberId]?.contractType ??
          membersById.get(memberId)?.expatProfile?.contractType ??
          null
        if (type === 'CTJ') ctj += 1
        else if (type === 'CDD') cdd += 1
        else other += 1
      })
      const total = ctj + cdd + other
      const delta = index === 0 ? 0 : total - prevTotal
      prevTotal = total
      result.push({
        label: item.label,
        ctj,
        cdd,
        other,
        total,
        delta,
      })
    })
    return result
  }, [detailMonthlyStats, payrollSnapshotByMonth, membersById])

  const detailProvenanceStats = useMemo(() => {
    const map = new Map<string, number>()
    let missing = 0
    detailMembers.forEach((member) => {
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
  }, [detailMembers, t.overview.labels.other])

  const detailContractSalaryStats = useMemo(() => {
    const ranges = getSalaryRanges(1)
    const values = detailMembers.map((member) => resolveMonthlySalary(member))
    return buildSalaryDistribution(values, formatMoney, ranges)
  }, [detailMembers, formatMoney])

  const detailPayoutSalaryStats = useMemo(() => {
    if (!showTeamPayroll) return []
    const ranges = getSalaryRanges(1)
    const divisor = Math.max(payrollMonthCount, 1)
    const values = detailMembers.map(
      (member) => (detailPayoutsByMemberId.get(member.id) ?? 0) / divisor,
    )
    return buildSalaryDistribution(values, formatMoney, ranges)
  }, [detailMembers, detailPayoutsByMemberId, formatMoney, payrollMonthCount, showTeamPayroll])

  const detailAgeStats = useMemo(() => {
    const yearUnit = locale === 'fr' ? 'ans' : '岁'
    const ranges = [
      { label: `0-17${yearUnit}`, min: 0, max: 17 },
      { label: `18-24${yearUnit}`, min: 18, max: 24 },
      { label: `25-29${yearUnit}`, min: 25, max: 29 },
      { label: `30-34${yearUnit}`, min: 30, max: 34 },
      { label: `35-39${yearUnit}`, min: 35, max: 39 },
      { label: `40-44${yearUnit}`, min: 40, max: 44 },
      { label: `45-49${yearUnit}`, min: 45, max: 49 },
      { label: `50+${yearUnit}`, min: 50, max: Number.POSITIVE_INFINITY },
    ]
    const counts = ranges.map(() => 0)
    let missing = 0
    const now = new Date()
    detailMembers.forEach((member) => {
      if (!member.birthDate) {
        missing += 1
        return
      }
      const birthDate = new Date(member.birthDate)
      if (Number.isNaN(birthDate.getTime())) {
        missing += 1
        return
      }
      let age = now.getFullYear() - birthDate.getFullYear()
      const monthDiff = now.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age -= 1
      }
      if (age < 0) {
        missing += 1
        return
      }
      const index = ranges.findIndex((range) => age >= range.min && age <= range.max)
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
  }, [detailMembers, locale])

  const detailTenureStats = useMemo(() => {
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
    detailMembers.forEach((member) => {
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
  }, [detailMembers, locale])

  const detailContractCostStats = useMemo(() => {
    if (!showTeamPayroll) {
      return { items: [], unknown: 0 }
    }
    let ctjTotal = 0
    let cddTotal = 0
    let ctjCount = 0
    let cddCount = 0
    let unknown = 0
    detailMembers.forEach((member) => {
      const type = member.expatProfile?.contractType ?? null
      const salary = detailPayoutsByMemberId.get(member.id) ?? 0
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
    const divisor = Math.max(payrollMonthCount, 1)
    return {
      items: [
        {
          label: 'CTJ',
          total: ctjTotal,
          avg: ctjCount ? ctjTotal / ctjCount / divisor : 0,
          count: ctjCount,
          color: CHART_COLORS[0],
        },
        {
          label: 'CDD',
          total: cddTotal,
          avg: cddCount ? cddTotal / cddCount / divisor : 0,
          count: cddCount,
          color: CHART_COLORS[1],
        },
      ],
      unknown,
    }
  }, [detailMembers, detailPayoutsByMemberId, payrollMonthCount, showTeamPayroll])

  const detailContractExpiryStats = useMemo(
    () => buildContractExpiryStats(detailMembers, t.overview.labels.overdue),
    [detailMembers, t.overview.labels.overdue],
  )

  const handleContractExpiryOpen = useCallback(
    (scope: 'overview' | 'detail', key: string) => {
      setContractExpiryModal({ scope, key })
    },
    [],
  )

  const handleContractExpiryClose = useCallback(() => {
    setContractExpiryModal(null)
  }, [])

  const handleEditMember = useCallback(
    (member: Member) => {
      setContractExpiryModal(null)
      if (typeof window !== 'undefined') {
        window.open(`/members/${member.id}`, '_blank', 'noopener,noreferrer')
      }
    },
    [],
  )

  const contractExpiryModalRows = useMemo(() => {
    if (!contractExpiryModal) return []
    const stats =
      contractExpiryModal.scope === 'detail' ? detailContractExpiryStats : contractExpiryStats
    const members =
      contractExpiryModal.key === 'overdue'
        ? stats.overdueMembers
        : stats.membersByKey.get(contractExpiryModal.key) ?? []
    const rows = members.map((member) => {
      const teamValue = normalizeText(member.expatProfile?.team)
      const teamLabel = teamValue
        ? resolveTeamLabel(teamValue)
        : t.overview.labels.unassignedTeam
      const displayName = normalizeText(member.name ?? null) || member.username || `#${member.id}`
      const parsedBirthDate = member.birthDate ? new Date(member.birthDate) : null
      const birthDateValue =
        parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
          ? parsedBirthDate.getTime()
          : null
      const birthDate =
        parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
          ? parsedBirthDate.toLocaleDateString(locale)
          : t.labels.empty
      const contractNumberValue = normalizeText(member.expatProfile?.contractNumber)
      const contractNumber = contractNumberValue || t.labels.empty
      const contractTypeRaw = normalizeText(member.expatProfile?.contractType).toUpperCase()
      const contractType =
        contractTypeRaw === 'CTJ'
          ? t.overview.labels.ctj
          : contractTypeRaw === 'CDD'
            ? t.overview.labels.cdd
            : t.labels.empty
      const contractStartDate = member.expatProfile?.contractStartDate
        ? new Date(member.expatProfile.contractStartDate)
        : null
      const contractStartValue =
        contractStartDate && !Number.isNaN(contractStartDate.getTime())
          ? contractStartDate.getTime()
          : null
      const contractStartLabel =
        contractStartDate && !Number.isNaN(contractStartDate.getTime())
          ? contractStartDate.toLocaleDateString(locale)
          : t.labels.empty
      const contractEndDate = member.expatProfile?.contractEndDate
        ? new Date(member.expatProfile.contractEndDate)
        : null
      const contractEndValue =
        contractEndDate && !Number.isNaN(contractEndDate.getTime())
          ? contractEndDate.getTime()
          : null
      const contractEndLabel =
        contractEndDate && !Number.isNaN(contractEndDate.getTime())
          ? contractEndDate.toLocaleDateString(locale)
          : t.labels.empty
      return {
        id: member.id,
        team: teamLabel,
        teamValue,
        name: displayName,
        nameValue: displayName,
        birthDate,
        birthDateValue,
        contractNumber,
        contractNumberValue,
        contractType,
        contractTypeValue: contractTypeRaw,
        contractStartDate: contractStartLabel,
        contractStartValue,
        contractEndDate: contractEndLabel,
        contractEndValue,
        member,
      }
    })
    return rows
  }, [
    contractExpiryModal,
    contractExpiryStats,
    detailContractExpiryStats,
    locale,
    resolveTeamLabel,
    t.labels.empty,
    t.overview.labels.cdd,
    t.overview.labels.ctj,
    t.overview.labels.unassignedTeam,
  ])

  const contractExpiryModalTitle = useMemo(() => {
    if (!contractExpiryModal) return ''
    const label =
      contractExpiryModal.key === 'overdue'
        ? t.overview.labels.overdue
        : contractExpiryModal.key
    return `${t.overview.charts.contractExpiry} · ${label}`
  }, [contractExpiryModal, t.overview.charts.contractExpiry, t.overview.labels.overdue])

  const salaryPyramidStats = useMemo(() => {
    if (!showTeamPayroll) return []
    const ranges = [
      { min: 0, max: 150000 },
      { min: 150001, max: 250000 },
      { min: 250001, max: 400000 },
      { min: 400001, max: Number.POSITIVE_INFINITY },
    ]
    const labels = ranges.map((range) => {
      if (range.max === Number.POSITIVE_INFINITY) return `${formatMoney(range.min)}+`
      return `${formatMoney(range.min)}-${formatMoney(range.max)}`
    })
    const counts = ranges.map(() => 0)
    const divisor = Math.max(payrollMonthCount, 1)
    detailMembers.forEach((member) => {
      const value = (detailPayoutsByMemberId.get(member.id) ?? 0) / divisor
      const index = ranges.findIndex(
        (range) => value >= range.min && value <= range.max,
      )
      if (index >= 0) counts[index] += 1
    })
    return labels.map((label, idx) => ({
      label,
      value: counts[idx],
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [detailMembers, detailPayoutsByMemberId, formatMoney, payrollMonthCount, showTeamPayroll])

  const detailPayoutDateColumns = useMemo(() => {
    const dates = new Set<string>()
    detailPayouts.forEach(({ payout }) => {
      dates.add(payout.payoutDate.slice(0, 10))
    })
    return Array.from(dates).sort()
  }, [detailPayouts])

  const detailPayoutRows = useMemo(() => {
    if (!showTeamPayroll) return []
    const payoutsByMember = new Map<number, Record<string, number>>()
    detailPayouts.forEach(({ payout, amount }) => {
      const date = payout.payoutDate.slice(0, 10)
      const existing = payoutsByMember.get(payout.userId) ?? {}
      existing[date] = (existing[date] ?? 0) + amount
      payoutsByMember.set(payout.userId, existing)
    })
    const rows: PayoutRecordRow[] = detailMembers.map((member) => {
      const supervisor = member.expatProfile?.chineseSupervisor
      const supervisorLabel = normalizeText(
        formatSupervisorLabel({
          name: supervisor?.name ?? null,
          frenchName: supervisor?.chineseProfile?.frenchName ?? null,
          username: supervisor?.username ?? null,
        }),
      ) || t.overview.labels.unassignedSupervisor
      const teamValue = normalizeText(member.expatProfile?.team)
      const team = teamValue ? resolveTeamLabel(teamValue) : t.overview.labels.unassignedTeam
      const memberName = member.name ?? member.username ?? `#${member.id}`
      const amountsByDate = payoutsByMember.get(member.id) ?? {}
      const total = Object.values(amountsByDate).reduce((sum, value) => sum + value, 0)
      return {
        id: member.id,
        team,
        memberName,
        supervisor: supervisorLabel,
        amountsByDate,
        total,
      }
    })
    const direction = detailRecordSort.direction === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      const key = detailRecordSort.key
      let diff = 0
      if (key === 'team') {
        diff = nameCollator.compare(a.team, b.team)
      } else if (key === 'member') {
        diff = nameCollator.compare(a.memberName, b.memberName)
      } else if (key === 'supervisor') {
        diff = nameCollator.compare(a.supervisor, b.supervisor)
      } else if (key === 'total') {
        diff = a.total - b.total
      } else {
        const left = a.amountsByDate[key] ?? 0
        const right = b.amountsByDate[key] ?? 0
        diff = left - right
      }
      if (diff !== 0) return diff * direction
      return nameCollator.compare(a.memberName, b.memberName)
    })
    return rows
  }, [
    detailMembers,
    detailPayouts,
    detailRecordSort.direction,
    detailRecordSort.key,
    nameCollator,
    resolveTeamLabel,
    showTeamPayroll,
    t.overview.labels.unassignedSupervisor,
    t.overview.labels.unassignedTeam,
  ])

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
                onClick={() => handleViewModeChange(mode)}
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
              const monthFilterCount =
                payrollMonthFilters.length === 1 &&
                payrollMonthFilters[0] === defaultPayrollMonth
                  ? 0
                  : payrollMonthFilters.length
              const selectedCount =
                projectFilters.length +
                statusFilters.length +
                nationalityFilters.length +
                teamFilters.length +
                monthFilterCount
              return selectedCount > 0 ? t.filters.selected(selectedCount) : t.filters.all
            })()}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <MultiSelectFilter
            label={t.filters.payrollMonth}
            options={visiblePayrollMonthOptions}
            selected={payrollMonthFilters}
            onChange={handlePayrollMonthChange}
            searchable={false}
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

      {viewMode === 'overview' ? (
        <>
          <TeamDistributionGrid 
            items={sortedTeamItems}
            missing={teamStats.missing} 
            t={t} 
            showPayroll={showTeamPayroll}
            sortMode={showTeamPayroll ? teamSortMode : 'count'}
            onSortChange={setTeamSortMode}
            formatMoney={formatMoney}
            onTeamSelect={(team) => handleDetailJump([team])}
            resolveTeamLabel={resolveTeamLabel}
          />

          <SupervisorPowerGrid 
            items={sortedSupervisorItems}
            missing={supervisorStats.missing} 
            t={t} 
            showPayroll={showTeamPayroll}
            sortMode={showTeamPayroll ? supervisorSortMode : 'count'}
            onSortChange={setSupervisorSortMode}
            formatMoney={formatMoney}
            onTeamsSelect={(teams) => handleDetailJump(teams)}
            resolveTeamLabel={resolveTeamLabel}
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3">
              <OverviewCard title={t.overview.charts.teamCostScatter} badge={t.overview.labels.localScope}>
                <TeamCostHeatmap
                  items={teamStats.items}
                  resolveTeamLabel={resolveTeamLabel}
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

            <OverviewCard
              title={t.overview.charts.dataQuality}
              subtitle={t.overview.labels.dataQualityHint}
            >
              <DataQualityList
                items={[
                  {
                    key: 'missingPhone',
                    label: t.overview.labels.missingPhone,
                    value: missingPhoneCount,
                    helper: t.overview.labels.missingPhoneHint,
                    scope: t.overview.labels.scopeAll,
                  },
                  {
                    key: 'missingCnps',
                    label: t.overview.labels.missingCnps,
                    value: cnpsStats.missing,
                    scope: t.overview.labels.localScope,
                  },
                  {
                    key: 'missingCnpsWithoutDeclaration',
                    label: t.overview.labels.missingCnpsWithoutDeclaration,
                    value: cnpsStats.missingWithoutDeclaration,
                    scope: t.overview.labels.localScope,
                  },
                ]}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
                onSelect={(key) => handleDataQualityOpen(key, 'overview')}
              />
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
              subtitle={t.overview.helpers.actualSalaryRuleDetail}
              badge={t.overview.labels.localScope}
            >
              <DonutChart
                items={payoutSalaryStats}
                totalLabel={t.overview.labels.total}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
              />
            </OverviewCard>

            <div className="md:col-span-2 xl:col-span-3">
              <OverviewCard
                title={t.overview.charts.position}
                subtitle={t.overview.helpers.positionRule}
                badge={t.overview.labels.localScope}
              >
                <SelectableBarList
                  items={positionStats.items.map((item) => ({
                    key: item.key,
                    label: item.label,
                    value: item.value,
                    color: item.color,
                  }))}
                  selectedKey={positionGroupFocus}
                  onSelect={(key) => setPositionGroupFocus((current) => (current === key ? null : key))}
                  formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                  emptyLabel={t.overview.labels.noData}
                  columns={2}
                />
                {positionStats.missing ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t.overview.labels.missingPosition}: {formatNumber(positionStats.missing)}
                  </p>
                ) : null}
                {positionStats.items.length ? (
                  <p className="mt-2 text-xs text-slate-400">{t.overview.labels.positionDetailHint}</p>
                ) : null}
              </OverviewCard>
            </div>

            <OverviewCard title={t.overview.charts.age}>
              <BarList
                items={ageStats.items}
                formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                emptyLabel={t.overview.labels.noData}
              />
              {ageStats.missing ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t.overview.labels.missingBirthDate}: {formatNumber(ageStats.missing)}
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

            <div className="md:col-span-2 xl:col-span-1 flex h-full flex-col gap-6">
              <div className="flex-1">
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
              </div>
              <div className="flex-1">
                <OverviewCard title={t.overview.charts.contractExpiry} badge={t.overview.labels.localScope}>
                  <ContractExpiryList
                    items={contractExpiryStats.items}
                    formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                    emptyLabel={t.overview.labels.noData}
                    onSelect={(key) => handleContractExpiryOpen('overview', key)}
                  />
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
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
          </div>
        </>
      ) : null}

      {viewMode === 'detail' ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {t.overview.labels.detailTeams}
                </p>
                <p className="text-[11px] text-slate-400">
                  {t.overview.labels.detailTeamsHint}
                </p>
              </div>
              <MultiSelectFilter
                label={t.table.team}
                options={detailTeamOptions}
                selected={activeDetailTeams}
                onChange={handleDetailTeamChange}
                className="min-w-[220px]"
                allLabel={filterControlProps.allLabel}
                selectedLabel={filterControlProps.selectedLabel}
                selectAllLabel={filterControlProps.selectAllLabel}
                clearLabel={filterControlProps.clearLabel}
                searchPlaceholder={filterControlProps.searchPlaceholder}
                noOptionsLabel={filterControlProps.noOptionsLabel}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeDetailTeams.map((team) => (
                <span
                  key={team}
                  className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
                >
                  {resolveTeamLabel(team)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <OverviewCard title={t.overview.charts.detailPayrollTotal} badge={t.overview.labels.localScope}>
              <LineChart
                items={detailPayrollTotalSeries}
                formatValue={formatMoney}
                emptyLabel={t.overview.labels.noData}
              />
            </OverviewCard>
            <OverviewCard title={t.overview.charts.detailPayrollAverage} badge={t.overview.labels.localScope}>
              <LineChart
                items={detailPayrollAverageSeries}
                formatValue={formatMoney}
                emptyLabel={t.overview.labels.noData}
              />
            </OverviewCard>
          </div>

          <OverviewCard title={t.overview.charts.contractTypeTrend} badge={t.overview.labels.localScope}>
            <ContractTypeTrendList
              items={detailContractTypeTrend}
              formatNumber={formatNumber}
              emptyLabel={t.overview.labels.noData}
              labels={{
                ctj: t.overview.labels.ctj,
                cdd: t.overview.labels.cdd,
                other: t.overview.labels.other,
                total: t.overview.labels.total,
                delta: t.overview.labels.delta,
              }}
            />
          </OverviewCard>

          <OverviewCard title={t.overview.charts.salaryPyramid} badge={t.overview.labels.localScope}>
            <SalaryPyramid
              items={salaryPyramidStats}
              formatValue={formatNumber}
              emptyLabel={t.overview.labels.noData}
            />
          </OverviewCard>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <OverviewCard
              title={t.overview.charts.dataQuality}
              subtitle={t.overview.labels.dataQualityHint}
              badge={t.overview.labels.localScope}
            >
              <DataQualityList
                items={[
                  {
                    key: 'missingPhone',
                    label: t.overview.labels.missingPhone,
                    value: detailMissingPhoneCount,
                    helper: t.overview.labels.missingPhoneHint,
                    scope: t.overview.labels.localScope,
                  },
                  {
                    key: 'missingCnps',
                    label: t.overview.labels.missingCnps,
                    value: detailCnpsStats.missing,
                    scope: t.overview.labels.localScope,
                  },
                  {
                    key: 'missingCnpsWithoutDeclaration',
                    label: t.overview.labels.missingCnpsWithoutDeclaration,
                    value: detailCnpsStats.missingWithoutDeclaration,
                    scope: t.overview.labels.localScope,
                  },
                ]}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
                onSelect={(key) => handleDataQualityOpen(key, 'detail')}
              />
            </OverviewCard>

            <OverviewCard title={t.overview.charts.provenance} badge={t.overview.labels.localScope}>
              <DonutChart
                items={detailProvenanceStats.items}
                totalLabel={t.overview.labels.total}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
              />
              {detailProvenanceStats.missing ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t.overview.labels.missingProvenance}: {formatNumber(detailProvenanceStats.missing)}
                </p>
              ) : null}
            </OverviewCard>

            <OverviewCard
              title={t.overview.charts.salary}
              subtitle={t.overview.helpers.salaryRule}
              badge={t.overview.labels.localScope}
            >
              <DonutChart
                items={detailContractSalaryStats}
                totalLabel={t.overview.labels.total}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
              />
            </OverviewCard>

            <OverviewCard
              title={t.overview.charts.actualSalary}
              subtitle={t.overview.helpers.actualSalaryRuleDetail}
              badge={t.overview.labels.localScope}
            >
              <DonutChart
                items={detailPayoutSalaryStats}
                totalLabel={t.overview.labels.total}
                formatValue={formatNumber}
                emptyLabel={t.overview.labels.noData}
              />
            </OverviewCard>

            <div className="md:col-span-2 xl:col-span-3">
              <OverviewCard
                title={t.overview.charts.position}
                subtitle={t.overview.helpers.positionRule}
                badge={t.overview.labels.localScope}
              >
                <SelectableBarList
                  items={detailPositionStats.items.map((item) => ({
                    key: item.key,
                    label: item.label,
                    value: item.value,
                    color: item.color,
                  }))}
                  selectedKey={positionGroupFocus}
                  onSelect={(key) => setPositionGroupFocus((current) => (current === key ? null : key))}
                  formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                  emptyLabel={t.overview.labels.noData}
                  columns={2}
                />
                {detailPositionStats.missing ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t.overview.labels.missingPosition}: {formatNumber(detailPositionStats.missing)}
                  </p>
                ) : null}
                {detailPositionStats.items.length ? (
                  <p className="mt-2 text-xs text-slate-400">{t.overview.labels.positionDetailHint}</p>
                ) : null}
              </OverviewCard>
            </div>

            <OverviewCard title={t.overview.charts.age}>
              <BarList
                items={detailAgeStats.items}
                formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                emptyLabel={t.overview.labels.noData}
              />
              {detailAgeStats.missing ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t.overview.labels.missingBirthDate}: {formatNumber(detailAgeStats.missing)}
                </p>
              ) : null}
            </OverviewCard>

            <OverviewCard title={t.overview.charts.tenure}>
              <BarList
                items={detailTenureStats.items}
                formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                emptyLabel={t.overview.labels.noData}
              />
              {detailTenureStats.missing ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t.labels.empty}: {formatNumber(detailTenureStats.missing)}
                </p>
              ) : null}
            </OverviewCard>

            <div className="md:col-span-2 xl:col-span-1 flex h-full flex-col gap-6">
              <div className="flex-1">
                <OverviewCard title={t.overview.charts.contractCost} badge={t.overview.labels.localScope}>
                  <ContractCostBulletList
                    items={detailContractCostStats.items}
                    formatMoney={formatMoney}
                    formatNumber={formatNumber}
                    emptyLabel={t.overview.labels.noData}
                    labels={{
                      people: t.overview.labels.people,
                      payrollAverage: t.overview.labels.payrollAverage,
                    }}
                  />
                  {detailContractCostStats.unknown ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {t.overview.labels.missingContractType}: {formatNumber(detailContractCostStats.unknown)}
                    </p>
                  ) : null}
                </OverviewCard>
              </div>
              <div className="flex-1">
                <OverviewCard title={t.overview.charts.contractExpiry} badge={t.overview.labels.localScope}>
                  <ContractExpiryList
                    items={detailContractExpiryStats.items}
                    formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                    emptyLabel={t.overview.labels.noData}
                    onSelect={(key) => handleContractExpiryOpen('detail', key)}
                  />
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>
                      {t.overview.labels.beyond}: {formatNumber(detailContractExpiryStats.beyond)}
                    </span>
                    <span>
                      {t.overview.labels.missingContractDate}: {formatNumber(detailContractExpiryStats.missing)}
                    </span>
                  </div>
                </OverviewCard>
              </div>
            </div>
          </div>

          <OverviewCard title={t.overview.charts.payoutRecords} badge={t.overview.labels.localScope}>
            <PayoutRecordsTable
              columns={detailPayoutDateColumns}
              rows={detailPayoutRows}
              sortKey={detailRecordSort.key}
              sortDirection={detailRecordSort.direction}
              onSortChange={handleDetailRecordSort}
              onViewMember={handleViewDetailMember}
              formatMoney={formatMoney}
              emptyLabel={t.overview.labels.noData}
              labels={{
                team: t.table.team,
                member: t.table.name,
                supervisor: t.table.chineseSupervisor,
                total: t.overview.labels.payoutTotal,
              }}
            />
          </OverviewCard>
        </div>
      ) : null}

      {viewMode === 'compare' ? (
        compareReady ? (
          <div className="space-y-6">
            <OverviewCard title={t.overview.charts.team} badge={t.overview.labels.localScope}>
              <CompareSummaryTable
                rows={compareTeamStats}
                showPayroll={showTeamPayroll}
                formatNumber={formatNumber}
                formatMoney={formatMoney}
                emptyLabel={t.overview.labels.noData}
                labels={{
                  team: t.table.team,
                  people: t.overview.labels.people,
                  payrollTotal: t.overview.labels.payoutTotal,
                  payrollAverage: t.overview.labels.payrollAverage,
                  payrollMedian: t.overview.labels.payrollMedian,
                  ctj: t.overview.labels.ctj,
                  cdd: t.overview.labels.cdd,
                  other: t.overview.labels.other,
                  expiringSoon: t.overview.labels.expiringSoon,
                  overdue: t.overview.labels.overdue,
                  missing: t.overview.labels.missingContractDate,
                }}
                statusLabels={{
                  active: t.status.ACTIVE,
                  onLeave: t.status.ON_LEAVE,
                  terminated: t.status.TERMINATED,
                }}
              />
              {showTeamPayroll ? (
                <p className="mt-3 text-xs text-slate-500">
                  {t.filters.payrollMonth}: {activePayrollMonths.join(', ')}
                </p>
              ) : null}
            </OverviewCard>

            {showTeamPayroll ? (
              <div className={`grid gap-6 ${compareChartColumnsClass}`}>
                <div className={compareHeatmapClass}>
                  <OverviewCard
                    title={t.overview.charts.teamCostScatter}
                    badge={t.overview.labels.localScope}
                  >
                    <TeamCostHeatmap
                      items={compareHeatmapItems}
                      resolveTeamLabel={resolveTeamLabel}
                      formatMoney={formatMoney}
                      formatNumber={formatNumber}
                      formatRatio={formatRatio}
                      emptyLabel={t.overview.labels.noData}
                      hint={t.overview.labels.scatterHint}
                      labels={{
                        team: t.table.team,
                        people: t.overview.labels.people,
                        payrollTotal: t.overview.labels.payoutTotal,
                        payrollAverage: t.overview.labels.payrollAverage,
                        payrollMedian: t.overview.labels.payrollMedian,
                        payrollRatio: t.overview.labels.payrollRatio,
                      }}
                    />
                  </OverviewCard>
                </div>
                <div className="md:col-span-1">
                  <OverviewCard
                    title={t.overview.charts.detailPayrollTotal}
                    badge={t.overview.labels.localScope}
                  >
                    <MultiLineChart
                      labels={compareMonthLabels}
                      series={compareMonthlySeries.totalSeries}
                      formatValue={formatMoney}
                      emptyLabel={t.overview.labels.noData}
                    />
                  </OverviewCard>
                </div>
                <div className="md:col-span-1">
                  <OverviewCard
                    title={t.overview.charts.detailPayrollAverage}
                    badge={t.overview.labels.localScope}
                  >
                    <MultiLineChart
                      labels={compareMonthLabels}
                      series={compareMonthlySeries.averageSeries}
                      formatValue={formatMoney}
                      emptyLabel={t.overview.labels.noData}
                    />
                  </OverviewCard>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <OverviewCard title={t.overview.charts.contractExpiry} badge={t.overview.labels.localScope}>
                <BarList
                  items={compareExpiryItems}
                  formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                  emptyLabel={t.overview.labels.noData}
                />
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>
                    {t.overview.labels.overdue}: {formatNumber(compareExpiryTotals.overdue)}
                  </span>
                  <span>
                    {t.overview.labels.missingContractDate}: {formatNumber(compareExpiryTotals.missing)}
                  </span>
                </div>
              </OverviewCard>

              <OverviewCard title={t.overview.charts.position} badge={t.overview.labels.localScope}>
                <PositionCompareList
                  rows={comparePositionRows}
                  formatNumber={formatNumber}
                  emptyLabel={t.overview.labels.noData}
                  labels={{
                    people: t.overview.labels.people,
                    missingPosition: t.overview.labels.missingPosition,
                  }}
                />
              </OverviewCard>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <OverviewCard title={t.overview.labels.teamSortCount} badge={t.overview.labels.localScope}>
                <BarList
                  items={compareHeadcountItems}
                  formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
                  emptyLabel={t.overview.labels.noData}
                />
              </OverviewCard>

              {showTeamPayroll ? (
                <OverviewCard title={t.overview.labels.payoutTotal} badge={t.overview.labels.localScope}>
                  <BarList
                    items={comparePayrollItems}
                    formatValue={formatMoney}
                    emptyLabel={t.overview.labels.noData}
                  />
                </OverviewCard>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            {t.overview.labels.compareHint}
          </div>
        )
      ) : null}

      <ContractExpiryModal
        open={Boolean(contractExpiryModal)}
        title={contractExpiryModalTitle}
        rows={contractExpiryModalRows}
        emptyLabel={t.overview.labels.noData}
        canEdit={canUpdateMember}
        locale={locale}
        onClose={handleContractExpiryClose}
        onViewMember={onViewMember}
        onEditMember={handleEditMember}
        labels={{
          team: t.table.team,
          name: t.table.name,
          birthDate: t.table.birthDate,
          contractNumber: t.table.contractNumber,
          contractType: t.table.contractType,
          contractStartDate: t.table.contractStartDate,
          contractEndDate: t.table.contractEndDate,
          actions: t.table.actions,
          edit: t.actions.edit,
          close: t.labels.close,
        }}
      />

      <DataQualityModal
        open={Boolean(dataQualityModal)}
        title={
          dataQualityModal?.key === 'missingPhone'
            ? t.overview.labels.missingPhone
            : dataQualityModal?.key === 'missingCnps'
              ? t.overview.labels.missingCnps
              : t.overview.labels.missingCnpsWithoutDeclaration
        }
        rows={dataQualityRows}
        fieldLabel={dataQualityFieldLabel}
        placeholder={dataQualityPlaceholder}
        canEdit={canUpdateMember}
        drafts={dataQualityDrafts}
        onDraftChange={handleDataQualityDraftChange}
        onSave={handleDataQualitySave}
        onClose={handleDataQualityClose}
        onViewMember={onViewMember}
        saving={dataQualitySaving}
        hasChanges={dataQualityChanges.length > 0}
        error={dataQualityError}
        notice={dataQualityNotice}
        emptyLabel={t.overview.labels.noData}
        emptyValueLabel={t.labels.empty}
        labels={{
          team: t.table.team,
          name: t.table.name,
          birthDate: t.table.birthDate,
          save: t.actions.saveChanges,
          close: t.labels.close,
        }}
      />

      <PositionDetailModal
        open={Boolean(activePositionGroup)}
        title={
          activePositionGroup
            ? `${t.overview.labels.positionDetailTitle} · ${activePositionGroup.label}`
            : ''
        }
        items={positionDetailItems}
        formatValue={(value) => `${formatNumber(value)} ${t.overview.labels.people}`}
        emptyLabel={t.overview.labels.noData}
        onClose={() => setPositionGroupFocus(null)}
      />
    </div>
  )
}
