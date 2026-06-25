'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import {
  buildActualBoqRows,
  sortBoqItemsByOrder,
  type BoqCompletionRecord,
} from '@/lib/boq/actualBoqRows'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { formatCopy, locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'

type BoqLocalizedText = { zh: string; fr: string }
type BoqRowTone = 'section' | 'subsection' | 'item' | 'total'
type BoqSheetType = 'CONTRACT' | 'ACTUAL'
type BoqProject = { id: number; name: string; code: string | null; isActive: boolean }
type BoqItemRecord = {
  id: number
  projectId: number
  sheetType: BoqSheetType
  contractItemId?: number | null
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: string | null
  quantity: string | null
  totalPrice: string | null
  tone: 'SECTION' | 'SUBSECTION' | 'ITEM' | 'TOTAL'
  sortOrder: number
  isActive: boolean
}

type BoqCompletionDetailRecord = {
  boqItemId: number
  inputId: number
  phaseItemId: number
  phaseItemName: string
  phaseItemSpec: string | null
  intervalId: number
  intervalStartPk: number
  intervalEndPk: number
  intervalSide: 'LEFT' | 'RIGHT' | 'BOTH'
  intervalSpec: string | null
  roadId: number
  roadName: string
  roadSlug: string
  manualQuantity: number | null
  computedQuantity: number | null
  effectiveQuantity: number
  completionPercent: number
  completedQuantity: number
  unit: string | null
}

type BoqMeasurementRecord = {
  id: number
  projectId: number
  boqItemId: number
  period: string
  quantity: string
  unitPrice: string | null
  amount: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

type MeasurementDraftEntry = {
  quantity?: string
  amount?: string
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const resolveBoqText = (value: BoqLocalizedText, locale: Locale) =>
  locale === 'fr' ? value.fr : value.zh

const formatBoqCell = (
  value?: string | number | null,
  options?: { numeric?: boolean; localeId?: string },
) => {
  if (value === undefined || value === null) return '—'
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return '—'
  if (options?.numeric) {
    const normalized = trimmed.replace(/,/g, '')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return trimmed
    const formatter = new Intl.NumberFormat(options?.localeId ?? 'fr-FR', {
      maximumFractionDigits: 2,
    })
    return formatter.format(parsed)
  }
  return trimmed
}

const formatDecimalValue = (value: number | null, localeId: string, digits: number) => {
  if (value === null || !Number.isFinite(value)) return '—'
  const formatter = new Intl.NumberFormat(localeId, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return formatter.format(value)
}

const roundToInteger = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Math.round(value)

const roundToOneDecimal = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10

const parseBoqNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const toIntegerString = (value?: string | number | null) => {
  const parsed = parseBoqNumber(value)
  if (parsed === null) return ''
  return String(Math.round(parsed))
}

const toOneDecimalString = (value?: string | number | null) => {
  const parsed = parseBoqNumber(value)
  if (parsed === null) return ''
  return (Math.round(parsed * 10) / 10).toFixed(1)
}

const formatPercent = (value: number | null, localeId: string) => {
  if (value === null || !Number.isFinite(value)) return '—'
  const formatter = new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 })
  return `${formatter.format(value)}%`
}

const AMOUNT_EPSILON = 0.01

const formatPk = (value: number) => {
  if (!Number.isFinite(value)) return '—'
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const PERIOD_BASE_DATE = new Date(Date.UTC(2000, 0, 1))
const PERIOD_DAY_MS = 24 * 60 * 60 * 1000

const formatPeriodKey = (value: number) => String(value)

const parsePeriodKey = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.startsWith('P') || trimmed.startsWith('p') ? trimmed.slice(1) : trimmed
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}


const resolvePeriodKeyFromValue = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const diff = Math.round((parsed.getTime() - PERIOD_BASE_DATE.getTime()) / PERIOD_DAY_MS)
  if (!Number.isFinite(diff) || diff < 0) return null
  return formatPeriodKey(diff)
}

const buildMeasurementKey = (boqItemId: number, periodKey: string) =>
  `${boqItemId}:${periodKey}`
const buildAdvanceKey = (periodKey: string) => `advance:${periodKey}`
const buildMeasurementPeriodColumnKey = (periodKey: string, kind: 'quantity' | 'amount') =>
  `period:${periodKey}:${kind}`

const MEASUREMENT_COLUMN_STORAGE_KEY = 'value-measurement-visible-columns'
const MEASUREMENT_BASE_COLUMNS = [
  'code',
  'designation',
  'unit',
  'unitPrice',
  'quantity',
  'totalPrice',
  'totalMeasuredQuantity',
  'totalMeasuredValue',
] as const

const resolveItemPeriodAmount = (
  boqItemId: number,
  periodKey: string,
  unitPrice: string | null,
  measurementDrafts: Record<string, MeasurementDraftEntry>,
  measurementMap: Map<number, Map<string, BoqMeasurementRecord>>,
) => {
  const draftKey = buildMeasurementKey(boqItemId, periodKey)
  const draft = measurementDrafts[draftKey]
  const record = measurementMap.get(boqItemId)?.get(periodKey)
  const quantityRaw = draft?.quantity ?? record?.quantity ?? ''
  const quantityValue = parseBoqNumber(quantityRaw)
  const draftAmountRaw = draft?.amount
  const draftAmountValue =
    draftAmountRaw !== undefined && draftAmountRaw !== '' ? parseBoqNumber(draftAmountRaw) : null
  const recordAmountValue = parseBoqNumber(record?.amount ?? '')
  const recordQuantityValue = parseBoqNumber(record?.quantity ?? '')
  const unitPriceValue = parseBoqNumber(unitPrice ?? null)
  const recordAmountDerived =
    recordAmountValue !== null &&
    recordQuantityValue !== null &&
    unitPriceValue !== null &&
    Math.abs(recordAmountValue - recordQuantityValue * unitPriceValue) < 0.01
  const amountValue =
    draftAmountValue !== null
      ? draftAmountValue
      : recordAmountValue !== null && !recordAmountDerived
        ? recordAmountValue
        : quantityValue !== null && unitPriceValue !== null
          ? quantityValue * unitPriceValue
          : null

  return { quantityValue, amountValue }
}

const resolveAdvancePeriodAmount = (
  periodKey: string,
  measurementDrafts: Record<string, MeasurementDraftEntry>,
  advanceMeasurementMap: Map<string, BoqMeasurementRecord>,
) => {
  const draftKey = buildAdvanceKey(periodKey)
  const draft = measurementDrafts[draftKey]
  const record = advanceMeasurementMap.get(periodKey)
  const draftAmountRaw = draft?.amount
  const draftAmountValue =
    draftAmountRaw !== undefined && draftAmountRaw !== '' ? parseBoqNumber(draftAmountRaw) : null
  const recordAmountValue = parseBoqNumber(record?.amount ?? '')
  const amountValue =
    draftAmountValue !== null ? draftAmountValue : recordAmountValue !== null ? recordAmountValue : null
  return amountValue
}

const formatMeasurementPeriodLabel = (template: string, index: number) =>
  template.replace('{value}', String(index))

const sideLabelMap: Record<BoqCompletionDetailRecord['intervalSide'], string> = {
  LEFT: '左',
  RIGHT: '右',
  BOTH: '双侧',
}

const normalizeBoqCode = (value?: string | null) => (value ?? '').trim().toUpperCase()
const isVatCode = (code: string) => code === 'TVA'
const isTotalHtvaCode = (code: string) => code.startsWith('TOTAL HTVA')
const isTotalWithTaxCode = (code: string) => code.startsWith('TOTAL TTC')
const isMajorSubsectionCode = (value?: string | null) => {
  if (!value) return false
  const normalized = normalizeBoqCode(value)
  if (!/^\d{3}$/.test(normalized)) return false
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric % 100 === 0
}
const isSubtotalLabel = (value?: string | null) => {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.includes('小计')) return true
  const upper = trimmed.toUpperCase()
  return upper.includes('SOUS-TOTAL') || upper.includes('SOUS TOTAL') || upper.startsWith('TOTAL')
}

const boqRowToneStyles: Record<BoqRowTone, string> = {
  section: 'bg-slate-100/70 text-slate-900 font-semibold',
  subsection: 'bg-slate-50/70 text-slate-700 font-medium',
  item: 'text-slate-700',
  total: 'bg-emerald-100/80 text-emerald-900 font-semibold',
}

type BoqProjectMeta = {
  label: BoqLocalizedText
  headerLeft?: BoqLocalizedText
  headerRight?: BoqLocalizedText
}

const boqProjectMeta: Record<string, BoqProjectMeta> = {
  'project-bondoukou-city': {
    label: { zh: '邦杜库市政路', fr: 'Voiries de Bondoukou' },
    headerLeft: {
      zh: '5公里道路整治工程 / 邦杜库市政道路 5公里',
      fr: "TRAVAUX D'AMENAGEMENT DE 5 KM DE VOIRIES / VOIRIES DE BONDOUKOU 5 KM",
    },
    headerRight: {
      zh: '路面结构：5 BB +12 GNT+18 GN 3%',
      fr: 'Structure de chaussee : 5 BB +12 GNT+18 GN 3%',
    },
  },
  'project-bondoukou-border': {
    label: { zh: '邦杜库边境路项目', fr: 'Route frontaliere de Bondoukou' },
  },
  'project-anibilekrou-city': {
    label: { zh: '阿尼比莱克鲁市政路项目', fr: "Voiries d'Agnibilékrou" },
  },
  'project-tanda-city': {
    label: { zh: '丹达市政路', fr: 'Voiries de Tanda' },
    headerLeft: {
      zh: '5公里道路整治工程 / 丹达市政道路 5公里',
      fr: "TRAVAUX D'AMENAGEMENT DE 5 KM DE VOIRIES / VOIRIES DE TANDA 5 KM",
    },
    headerRight: {
      zh: '路面结构：5 BB +12 GNT+18 GN 3%',
      fr: 'Structure de chaussee : 5 BB +12 GNT+18 GN 3%',
    },
  },
}

const allowedBoqProjectCodes = [
  'project-bondoukou-city',
  'project-tanda-city',
  'project-bondoukou-border',
  'project-anibilekrou-city',
]
const allowedBoqProjectNames = new Set([
  '邦杜库市政路项目',
  '丹达市政路项目',
  '邦杜库边境路项目',
  '阿尼比莱克鲁市政路项目',
])
const allowedBoqProjectOrder = new Map([
  ['project-bondoukou-city', 0],
  ['project-tanda-city', 1],
  ['project-bondoukou-border', 2],
  ['project-anibilekrou-city', 3],
  ['邦杜库市政路项目', 0],
  ['丹达市政路项目', 1],
  ['邦杜库边境路项目', 2],
  ['阿尼比莱克鲁市政路项目', 3],
])

const getBoqProjectOrder = (project: BoqProject) => {
  if (project.code && allowedBoqProjectOrder.has(project.code)) {
    return allowedBoqProjectOrder.get(project.code) ?? 99
  }
  return allowedBoqProjectOrder.get(project.name) ?? 99
}

const mapBoqTone = (tone: BoqItemRecord['tone']): BoqRowTone => {
  switch (tone) {
    case 'SECTION':
      return 'section'
    case 'SUBSECTION':
      return 'subsection'
    case 'TOTAL':
      return 'total'
    default:
      return 'item'
  }
}

type ValueTabKey = 'completion' | 'boq' | 'measurement' | 'comparison'

type CompletionTotals = {
  completedQuantity: number
  completedValue: number
  totalPrice: number
  itemCount: number
}

type MeasurementTotals = {
  measuredQuantity: number
  measuredValue: number
  totalPrice: number
  itemCount: number
}

type ComparisonSource = 'contract' | 'new'

type ComparisonRow = {
  id: number
  source: ComparisonSource
  code: string
  designation: string
  unit: string | null
  unitPrice: number | null
  completedQuantity: number
  completedValue: number
  measuredQuantity: number
  measuredValue: number
  amountDelta: number
  unmeasuredQuantity: number
  unmeasuredValue: number
  overMeasuredValue: number
  searchable: string
}

type ComparisonSortField =
  | 'source'
  | 'code'
  | 'designation'
  | 'unit'
  | 'unitPrice'
  | 'completedQuantity'
  | 'completedValue'
  | 'measuredQuantity'
  | 'measuredValue'
  | 'unmeasuredQuantity'
  | 'unmeasuredValue'
  | 'overMeasuredValue'

type ComparisonSortOrder = 'asc' | 'desc'

type ComparisonSortSpec = {
  field: ComparisonSortField
  order: ComparisonSortOrder
}

type ComparisonSummaryRow = {
  key: 'totalHtva' | 'advance' | 'netHtva' | 'vat' | 'totalTtc'
  label: string
  completedQuantity: number | null
  completedValue: number
  measuredQuantity: number | null
  measuredValue: number
  amountDelta: number
  unmeasuredQuantity: number | null
  unmeasuredValue: number
  overMeasuredValue: number
}

type PeriodGroupTotals = {
  quantity: number
  amount: number
  hasQuantity: boolean
  hasAmount: boolean
}

type PeriodRowTotals = {
  quantity: number | null
  amount: number | null
}

export default function ValuePage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = productionValueCopy[locale]
  const localeId = formatLocaleId(locale)
  const comparisonSortCollator = useMemo(
    () => new Intl.Collator(localeId, { numeric: true, sensitivity: 'base' }),
    [localeId],
  )
  const isFrenchLocale = locale === 'fr'
  const { home: breadcrumbHome, value: breadcrumbValue } = copy.breadcrumbs
  const { unauthorized: unauthorizedMessage, projectLoadError } = copy.messages

  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab') ?? null
  const activeTab: ValueTabKey =
    tabParam === 'boq'
      ? 'boq'
      : tabParam === 'measurement'
        ? 'measurement'
        : tabParam === 'comparison'
          ? 'comparison'
          : 'completion'
  const [boqProjects, setBoqProjects] = useState<BoqProject[]>([])
  const [boqProjectsStatus, setBoqProjectsStatus] = useState<FetchStatus>('idle')
  const [boqProjectsError, setBoqProjectsError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [boqItems, setBoqItems] = useState<BoqItemRecord[]>([])
  const [boqItemsStatus, setBoqItemsStatus] = useState<FetchStatus>('idle')
  const [boqItemsError, setBoqItemsError] = useState<string | null>(null)
  const [completionItems, setCompletionItems] = useState<BoqItemRecord[]>([])
  const [completionStatus, setCompletionStatus] = useState<FetchStatus>('idle')
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [completionMap, setCompletionMap] = useState<Map<number, BoqCompletionRecord>>(
    new Map(),
  )
  const [completionDetails, setCompletionDetails] = useState<
    Map<number, BoqCompletionDetailRecord[]>
  >(new Map())
  const [completionDetailLoading, setCompletionDetailLoading] = useState<Set<number>>(
    new Set(),
  )
  const [completionDetailErrors, setCompletionDetailErrors] = useState<Map<number, string>>(
    new Map(),
  )
  const [expandedCompletionItems, setExpandedCompletionItems] = useState<Set<number>>(
    new Set(),
  )
  const boqSheetType: BoqSheetType = 'CONTRACT'
  const [boqSearch, setBoqSearch] = useState('')
  const [boqViewMode, setBoqViewMode] = useState<'full' | 'summary'>('full')
  const [completionSearch, setCompletionSearch] = useState('')
  const [completionViewMode, setCompletionViewMode] = useState<'full' | 'summary'>('full')
  const [measurementSearch, setMeasurementSearch] = useState('')
  const [comparisonSearch, setComparisonSearch] = useState('')
  const [comparisonSourceFilter, setComparisonSourceFilter] = useState<
    'all' | ComparisonSource
  >('all')
  const [comparisonSortStack, setComparisonSortStack] = useState<ComparisonSortSpec[]>([])
  const [measurementRecords, setMeasurementRecords] = useState<BoqMeasurementRecord[]>([])
  const [measurementStatus, setMeasurementStatus] = useState<FetchStatus>('idle')
  const [measurementError, setMeasurementError] = useState<string | null>(null)
  const [measurementDrafts, setMeasurementDrafts] = useState<Record<string, MeasurementDraftEntry>>({})
  const [measurementPeriods, setMeasurementPeriods] = useState<string[]>([])
  const [measurementSaving, setMeasurementSaving] = useState(false)
  const [advanceItemId, setAdvanceItemId] = useState<number | null>(null)
  const [measurementVisibleColumns, setMeasurementVisibleColumns] = useState<string[]>(
    Array.from(MEASUREMENT_BASE_COLUMNS),
  )
  const [showMeasurementColumnSelector, setShowMeasurementColumnSelector] = useState(false)
  const measurementColumnSelectorRef = useRef<HTMLDivElement | null>(null)

  const [permissionDenied, setPermissionDenied] = useState(false)
  const boqProjectsToastRef = useRef<string | null>(null)
  const boqItemsToastRef = useRef<string | null>(null)
  const completionToastRef = useRef<string | null>(null)
  const measurementToastRef = useRef<string | null>(null)
  const measurementSaveToastRef = useRef<string | null>(null)
  const measurementPeriodKeysRef = useRef<string[]>([])

  const selectedBoqProject = useMemo(() => {
    if (!selectedProjectId) return null
    return boqProjects.find((project) => String(project.id) === selectedProjectId) ?? null
  }, [boqProjects, selectedProjectId])

  const selectedProjectMeta = useMemo(() => {
    if (!selectedBoqProject) return null
    const key = selectedBoqProject.code ?? selectedBoqProject.name
    return boqProjectMeta[key] ?? null
  }, [selectedBoqProject])

  const headerLeftLine = selectedProjectMeta?.headerLeft
    ? resolveBoqText(selectedProjectMeta.headerLeft, locale)
    : ''
  const headerRightLine = selectedProjectMeta?.headerRight
    ? resolveBoqText(selectedProjectMeta.headerRight, locale)
    : ''
  const hasBoqHeader = Boolean(headerLeftLine || headerRightLine)
  const resolveProjectLabel = (project: BoqProject) => {
    const key = project.code ?? project.name
    const meta = boqProjectMeta[key]
    return meta ? resolveBoqText(meta.label, locale) : project.name
  }
  useEffect(() => {
    let cancelled = false

    const loadBoqProjects = async () => {
      setBoqProjectsStatus('loading')
      setBoqProjectsError(null)
      try {
        const response = await fetch('/api/value/boq-projects', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { projects?: BoqProject[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403 ? unauthorizedMessage : payload.message ?? projectLoadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        const rawProjects = payload.projects ?? []
        const filteredProjects = rawProjects
          .filter((project) => {
            if (project.code && allowedBoqProjectOrder.has(project.code)) return true
            return allowedBoqProjectNames.has(project.name)
          })
          .sort((a, b) => {
            const aOrder = getBoqProjectOrder(a)
            const bOrder = getBoqProjectOrder(b)
            return aOrder - bOrder
          })
        setBoqProjects(filteredProjects)
        setBoqProjectsStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setBoqProjectsStatus('error')
        setBoqProjectsError((fetchError as Error).message)
      }
    }

    loadBoqProjects()

    return () => {
      cancelled = true
    }
  }, [projectLoadError, unauthorizedMessage])

  useEffect(() => {
    if (!boqProjects.length) return
    const exists = boqProjects.some((project) => String(project.id) === selectedProjectId)
    const defaultProject =
      boqProjects.find((project) => project.code === 'project-bondoukou-city') ??
      boqProjects.find((project) => project.name === '邦杜库市政路项目') ??
      boqProjects[0]
    if (!selectedProjectId || !exists) {
      setSelectedProjectId(String(defaultProject.id))
    }
  }, [boqProjects, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false

    const loadBoqItems = async () => {
      setBoqItemsStatus('loading')
      setBoqItemsError(null)
      try {
        const response = await fetch(
          `/api/value/boq-items?projectId=${selectedProjectId}&sheetType=${boqSheetType}`,
          {
            credentials: 'include',
          },
        )
        const payload = (await response
          .json()
          .catch(() => ({}))) as { items?: BoqItemRecord[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403
              ? unauthorizedMessage
              : payload.message ?? copy.boq.messages.loadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setBoqItems(payload.items ?? [])
        setBoqItemsStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setBoqItemsStatus('error')
        setBoqItemsError((fetchError as Error).message)
      }
    }

    loadBoqItems()

    return () => {
      cancelled = true
    }
  }, [boqSheetType, copy.boq.messages.loadError, selectedProjectId, unauthorizedMessage])

  useEffect(() => {
    if (
      !selectedProjectId ||
      (activeTab !== 'completion' &&
        activeTab !== 'measurement' &&
        activeTab !== 'comparison')
    ) {
      return
    }
    let cancelled = false
    const loadErrorMessage =
      activeTab === 'measurement'
        ? copy.measurement.messages.loadError
        : activeTab === 'comparison'
          ? copy.comparison.messages.loadError
        : copy.completion.messages.loadError

    const loadCompletion = async () => {
      setCompletionStatus('loading')
      setCompletionError(null)
      try {
        const response = await fetch(
          `/api/value/boq-completion?projectId=${selectedProjectId}`,
          { credentials: 'include' },
        )
        const payload = (await response
          .json()
          .catch(() => ({}))) as {
          items?: BoqItemRecord[]
          completion?: BoqCompletionRecord[]
          message?: string
        }

        if (!response.ok) {
          const message =
            response.status === 403 ? unauthorizedMessage : payload.message ?? loadErrorMessage
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        const filteredItems = (payload.items ?? []).filter(
          (item) => normalizeBoqCode(item.code) !== 'AVANCE',
        )
        setCompletionItems(filteredItems)
        const map = new Map<number, BoqCompletionRecord>()
        ;(payload.completion ?? []).forEach((entry) => {
          map.set(entry.boqItemId, entry)
        })
        setCompletionMap(map)
        setCompletionStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setCompletionStatus('error')
        setCompletionError((fetchError as Error).message)
      }
    }

    loadCompletion()

    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    copy.completion.messages.loadError,
    copy.comparison.messages.loadError,
    copy.measurement.messages.loadError,
    selectedProjectId,
    unauthorizedMessage,
  ])

  useEffect(() => {
    if (activeTab !== 'completion') return
    setExpandedCompletionItems(new Set())
    setCompletionDetails(new Map())
    setCompletionDetailLoading(new Set())
    setCompletionDetailErrors(new Map())
  }, [activeTab, selectedProjectId])

  useEffect(() => {
    if (activeTab !== 'measurement') return
    setMeasurementDrafts({})
    setMeasurementPeriods([])
  }, [activeTab, selectedProjectId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        measurementColumnSelectorRef.current &&
        !measurementColumnSelectorRef.current.contains(event.target as Node)
      ) {
        setShowMeasurementColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeTab !== 'measurement') {
      setShowMeasurementColumnSelector(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (!selectedProjectId || (activeTab !== 'measurement' && activeTab !== 'comparison')) return
    let cancelled = false

    const loadMeasurements = async () => {
      setMeasurementStatus('loading')
      setMeasurementError(null)
      try {
        const response = await fetch(
          `/api/value/boq-measurements?projectId=${selectedProjectId}`,
          { credentials: 'include' },
        )
        const payload = (await response
          .json()
          .catch(() => ({}))) as {
          measurements?: BoqMeasurementRecord[]
          advanceItemId?: number | null
          message?: string
        }

        if (!response.ok) {
          const message =
            response.status === 403
              ? unauthorizedMessage
              : payload.message ?? copy.measurement.messages.loadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setMeasurementRecords(payload.measurements ?? [])
        setAdvanceItemId(
          typeof payload.advanceItemId === 'number' ? payload.advanceItemId : null,
        )
        setMeasurementStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setMeasurementStatus('error')
        setMeasurementError((fetchError as Error).message)
      }
    }

    loadMeasurements()

    return () => {
      cancelled = true
    }
  }, [activeTab, copy.measurement.messages.loadError, selectedProjectId, unauthorizedMessage])

  const loadCompletionDetails = async (boqItemId: number) => {
    if (!selectedProjectId) return
    setCompletionDetailLoading((prev) => {
      const next = new Set(prev)
      next.add(boqItemId)
      return next
    })
    setCompletionDetailErrors((prev) => {
      const next = new Map(prev)
      next.delete(boqItemId)
      return next
    })
    try {
      const response = await fetch(
        `/api/value/boq-completion/${boqItemId}?projectId=${selectedProjectId}`,
        { credentials: 'include' },
      )
      const payload = (await response
        .json()
        .catch(() => ({}))) as { details?: BoqCompletionDetailRecord[]; message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? copy.completion.messages.loadError)
      }
      setCompletionDetails((prev) => {
        const next = new Map(prev)
        next.set(boqItemId, payload.details ?? [])
        return next
      })
    } catch (error) {
      setCompletionDetailErrors((prev) => {
        const next = new Map(prev)
        next.set(boqItemId, (error as Error).message ?? copy.completion.messages.loadError)
        return next
      })
    } finally {
      setCompletionDetailLoading((prev) => {
        const next = new Set(prev)
        next.delete(boqItemId)
        return next
      })
    }
  }

  const toggleCompletionDetails = (boqItemId: number) => {
    const isExpanded = expandedCompletionItems.has(boqItemId)
    setExpandedCompletionItems((prev) => {
      const next = new Set(prev)
      if (next.has(boqItemId)) {
        next.delete(boqItemId)
      } else {
        next.add(boqItemId)
      }
      return next
    })
    if (!isExpanded && !completionDetails.has(boqItemId) && !completionDetailLoading.has(boqItemId)) {
      void loadCompletionDetails(boqItemId)
    }
  }

  useEffect(() => {
    if (permissionDenied) return
    if (boqProjectsStatus !== 'error') return
    const message = boqProjectsError ?? projectLoadError
    if (!message || message === boqProjectsToastRef.current) return
    addToast(message, { tone: 'danger' })
    boqProjectsToastRef.current = message
  }, [addToast, boqProjectsError, boqProjectsStatus, permissionDenied, projectLoadError])

  useEffect(() => {
    if (permissionDenied) return
    if (boqItemsStatus !== 'error') return
    const message = boqItemsError ?? copy.boq.messages.loadError
    if (!message || message === boqItemsToastRef.current) return
    addToast(message, { tone: 'danger' })
    boqItemsToastRef.current = message
  }, [addToast, boqItemsError, boqItemsStatus, copy.boq.messages.loadError, permissionDenied])

  useEffect(() => {
    if (permissionDenied) return
    if (completionStatus !== 'error') return
    const fallbackMessage =
      activeTab === 'measurement'
        ? copy.measurement.messages.loadError
        : activeTab === 'comparison'
          ? copy.comparison.messages.loadError
        : copy.completion.messages.loadError
    const message = completionError ?? fallbackMessage
    if (!message || message === completionToastRef.current) return
    addToast(message, { tone: 'danger' })
    completionToastRef.current = message
  }, [
    addToast,
    activeTab,
    completionError,
    completionStatus,
    copy.completion.messages.loadError,
    copy.comparison.messages.loadError,
    copy.measurement.messages.loadError,
    permissionDenied,
  ])

  useEffect(() => {
    if (permissionDenied) return
    if (measurementStatus !== 'error') return
    const message = measurementError ?? copy.measurement.messages.loadError
    if (!message || message === measurementToastRef.current) return
    addToast(message, { tone: 'danger' })
    measurementToastRef.current = message
  }, [
    addToast,
    measurementError,
    measurementStatus,
    copy.measurement.messages.loadError,
    permissionDenied,
  ])

  const boqRowData = useMemo(() => {
    return sortBoqItemsByOrder(boqItems).map((item, index) => {
      const designation = locale === 'fr' ? item.designationFr : item.designationZh
      const searchable = `${item.code} ${designation}`.toLowerCase()
      return {
        index,
        id: item.id,
        code: item.code,
        designation,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        tone: mapBoqTone(item.tone),
        searchable,
      }
    })
  }, [boqItems, locale])

  const completionRowData = useMemo(() => {
    if (!completionItems.length) return []
    const baseRows = buildActualBoqRows({
      items: completionItems,
      completion: completionMap,
      locale,
    }).map((row) => {
      const isItem = row.tone === 'ITEM'
      const unitPriceValue = parseBoqNumber(row.unitPrice)
      const unitPriceMissing = unitPriceValue === null || unitPriceValue === 0
      const rawCompletedQuantity = row.completedQuantity ?? 0
      const completedQuantity =
        isItem && Number.isFinite(rawCompletedQuantity) ? rawCompletedQuantity : 0
      const completedValue = isItem
        ? unitPriceMissing
          ? 0
          : completedQuantity * (unitPriceValue ?? 0)
        : null
      const completedPercent =
        isItem && row.totalPriceValue !== null && row.totalPriceValue > 0
          ? (completedValue ?? 0) / row.totalPriceValue * 100
          : null
      const completionRisk = isItem && unitPriceMissing && completedQuantity !== 0

      return {
        ...row,
        tone: mapBoqTone(row.tone),
        completedQuantity: isItem ? completedQuantity : null,
        completedValue,
        completedPercent,
        completionRisk,
      }
    })

    const totalsBySection = new Map<number, CompletionTotals>()
    const totalsBySubsection = new Map<number, CompletionTotals>()
    const totalsBySubsectionCode = new Map<string, CompletionTotals>()
    const totalsByMajorCode = new Map<string, CompletionTotals>()
    const subsectionIndexBySectionAndCode = new Map<number, Map<string, number>>()
    const overallTotals: CompletionTotals = {
      completedQuantity: 0,
      completedValue: 0,
      totalPrice: 0,
      itemCount: 0,
    }
    const sectionIndexByRow: Array<number | null> = []
    let currentSectionIndex: number | null = null
    let currentSubsectionIndex: number | null = null
    let currentSubsectionCode: string | null = null

    const addTotals = (target: CompletionTotals, addition: CompletionTotals) => {
      target.completedQuantity += addition.completedQuantity
      target.completedValue += addition.completedValue
      target.totalPrice += addition.totalPrice
      target.itemCount += addition.itemCount
    }

    const addToMap = (
      map: Map<number, CompletionTotals>,
      key: number,
      addition: CompletionTotals,
    ) => {
      const existing = map.get(key) ?? {
        completedQuantity: 0,
        completedValue: 0,
        totalPrice: 0,
        itemCount: 0,
      }
      addTotals(existing, addition)
      map.set(key, existing)
    }

    const addToCodeMap = (
      map: Map<string, CompletionTotals>,
      key: string,
      addition: CompletionTotals,
    ) => {
      const existing = map.get(key) ?? {
        completedQuantity: 0,
        completedValue: 0,
        totalPrice: 0,
        itemCount: 0,
      }
      addTotals(existing, addition)
      map.set(key, existing)
    }

    baseRows.forEach((row, index) => {
      if (row.tone === 'section') {
        currentSectionIndex = index
        currentSubsectionIndex = null
        currentSubsectionCode = null
      } else if (row.tone === 'subsection') {
        const code = row.subtotalCode
        const isMajor =
          code !== null && Number.isFinite(Number(code)) && Number(code) % 100 === 0
        if (isMajor) {
          if (currentSectionIndex !== null) {
            const map = subsectionIndexBySectionAndCode.get(currentSectionIndex) ?? new Map()
            map.set(code, index)
            subsectionIndexBySectionAndCode.set(currentSectionIndex, map)
          }
          currentSubsectionIndex = index
        }
      }
      if (row.tone !== 'item') {
        if (row.subtotalCode && /^\d{3}$/.test(row.subtotalCode)) {
          currentSubsectionCode = row.subtotalCode
        }
      }
      sectionIndexByRow[index] = currentSectionIndex
      if (row.tone !== 'item') return
      const addition: CompletionTotals = {
        completedQuantity: row.completedQuantity ?? 0,
        completedValue: row.completedValue ?? 0,
        totalPrice: row.totalPriceValue ?? 0,
        itemCount: 1,
      }
      addTotals(overallTotals, addition)
      if (currentSectionIndex !== null) {
        addToMap(totalsBySection, currentSectionIndex, addition)
      }
      if (currentSubsectionIndex !== null) {
        addToMap(totalsBySubsection, currentSubsectionIndex, addition)
      }
      if (currentSubsectionCode) {
        addToCodeMap(totalsBySubsectionCode, currentSubsectionCode, addition)
      }
      if (row.majorCode) {
        addToCodeMap(totalsByMajorCode, row.majorCode, addition)
      }
    })

    const applyTotals = (
      row: (typeof baseRows)[number],
      totals: CompletionTotals | undefined,
      options?: { hideCompletedQuantity?: boolean },
    ) => {
      if (!totals || totals.itemCount === 0) {
        const fallbackTotalPrice = row.totalPriceValue ?? row.totalPrice
        return {
          ...row,
          totalPrice: fallbackTotalPrice ?? null,
          completedQuantity: null,
          completedValue: null,
          completedPercent: null,
          completionRisk: false,
        }
      }
      const completedPercent =
        totals.totalPrice > 0 ? (totals.completedValue / totals.totalPrice) * 100 : null
      return {
        ...row,
        totalPrice: totals.totalPrice,
        completedQuantity: options?.hideCompletedQuantity ? null : totals.completedQuantity,
        completedValue: totals.completedValue,
        completedPercent,
        completionRisk: false,
      }
    }

    const scaleTotals = (totals: CompletionTotals, factor: number): CompletionTotals => ({
      completedQuantity: totals.completedQuantity,
      completedValue: totals.completedValue * factor,
      totalPrice: totals.totalPrice * factor,
      itemCount: totals.itemCount,
    })

    const resolveTotalsForTotalRow = (
      row: (typeof baseRows)[number],
      index: number,
    ): CompletionTotals | undefined => {
      const normalizedCode = normalizeBoqCode(row.code)
      const useOverall =
        isVatCode(normalizedCode) || isTotalHtvaCode(normalizedCode) || isTotalWithTaxCode(normalizedCode)
      if (useOverall) {
        const factor = isVatCode(normalizedCode) ? 0.18 : isTotalWithTaxCode(normalizedCode) ? 1.18 : 1
        return scaleTotals(overallTotals, factor)
      }

      const subtotalCode = row.subtotalCode
      const majorCode = row.majorCode
      if (majorCode && totalsByMajorCode.has(majorCode)) {
        return totalsByMajorCode.get(majorCode)
      }
      if (subtotalCode && totalsBySubsectionCode.has(subtotalCode)) {
        return totalsBySubsectionCode.get(subtotalCode)
      }

      const sectionIndex = sectionIndexByRow[index]
      if (sectionIndex !== null) {
        const matchingSubsectionIndex = subtotalCode
          ? subsectionIndexBySectionAndCode.get(sectionIndex)?.get(subtotalCode) ?? null
          : null
        return matchingSubsectionIndex !== null
          ? totalsBySubsection.get(matchingSubsectionIndex)
          : totalsBySection.get(sectionIndex)
      }

      return overallTotals
    }

    const totalRowTotalsByKey = new Map<string, CompletionTotals>()
    const totalRowTotalsByCode = new Map<string, CompletionTotals>()
    baseRows.forEach((row, index) => {
      if (row.tone !== 'total') return
      const sectionIndex = sectionIndexByRow[index]
      if (sectionIndex === null) return
      const subtotalCode = row.subtotalCode
      const majorCode = row.majorCode
      if (!subtotalCode) return
      const totals = resolveTotalsForTotalRow(row, index)
      if (!totals) return
      totalRowTotalsByKey.set(`${sectionIndex}:${subtotalCode}`, totals)
      if (majorCode && !totalRowTotalsByCode.has(majorCode)) {
        totalRowTotalsByCode.set(majorCode, totals)
      }
      if (!totalRowTotalsByCode.has(subtotalCode)) {
        totalRowTotalsByCode.set(subtotalCode, totals)
      }
    })

    return baseRows.map((row, index) => {
      if (row.tone === 'subsection') {
        const normalizedCode = normalizeBoqCode(row.code)
        if (isVatCode(normalizedCode)) {
          return applyTotals(row, scaleTotals(overallTotals, 0.18), { hideCompletedQuantity: true })
        }
        const isMajorSubsection =
          isMajorSubsectionCode(normalizedCode) || isMajorSubsectionCode(row.subtotalCode)
        const isSummarySubsection =
          isTotalHtvaCode(normalizedCode) || isTotalWithTaxCode(normalizedCode)
        const isSubtotalRow =
          /^T\d+/i.test(normalizedCode) || isSubtotalLabel(row.designation ?? null)
        if (!isMajorSubsection && !isSummarySubsection && !isSubtotalRow) {
          return applyTotals(row, undefined, { hideCompletedQuantity: true })
        }
        const subsectionTotals = totalsBySubsection.get(index)
        const sectionIndex = sectionIndexByRow[index]
        const subtotalCode = row.subtotalCode
        const majorCode = row.majorCode
        const fallbackTotals =
          sectionIndex !== null && subtotalCode
            ? totalRowTotalsByKey.get(`${sectionIndex}:${subtotalCode}`)
            : undefined
        const codeTotals = majorCode
          ? totalRowTotalsByCode.get(majorCode) ?? totalsByMajorCode.get(majorCode)
          : subtotalCode
            ? totalRowTotalsByCode.get(subtotalCode) ?? totalsBySubsectionCode.get(subtotalCode)
            : undefined
        const resolvedTotals =
          subsectionTotals && subsectionTotals.itemCount > 0 ? subsectionTotals : fallbackTotals
        return applyTotals(row, resolvedTotals ?? codeTotals, { hideCompletedQuantity: true })
      }
      if (row.tone === 'total') {
        return applyTotals(row, resolveTotalsForTotalRow(row, index), { hideCompletedQuantity: true })
      }
      if (row.tone === 'section') {
        return {
          ...row,
          completedQuantity: null,
          completedValue: null,
          completedPercent: null,
          completionRisk: false,
        }
      }
      return row
    })
  }, [completionItems, completionMap, locale])

  const measurementMap = useMemo(() => {
    const map = new Map<number, Map<string, BoqMeasurementRecord>>()
    measurementRecords.forEach((record) => {
      if (advanceItemId && record.boqItemId === advanceItemId) return
      const periodKey = resolvePeriodKeyFromValue(record.period)
      if (!periodKey) return
      const existing = map.get(record.boqItemId) ?? new Map<string, BoqMeasurementRecord>()
      existing.set(periodKey, record)
      map.set(record.boqItemId, existing)
    })
    return map
  }, [advanceItemId, measurementRecords])

  const advanceMeasurementMap = useMemo(() => {
    const map = new Map<string, BoqMeasurementRecord>()
    if (!advanceItemId) return map
    measurementRecords.forEach((record) => {
      if (record.boqItemId !== advanceItemId) return
      const periodKey = resolvePeriodKeyFromValue(record.period)
      if (!periodKey) return
      map.set(periodKey, record)
    })
    return map
  }, [advanceItemId, measurementRecords])

  const measurementPeriodKeys = useMemo(() => {
    const keySet = new Set<string>()
    measurementRecords.forEach((record) => {
      const periodKey = resolvePeriodKeyFromValue(record.period)
      if (periodKey) keySet.add(periodKey)
    })
    measurementPeriods.forEach((period) => {
      if (period) keySet.add(period)
    })
    return Array.from(keySet).sort((a, b) => {
      const aIndex = parsePeriodKey(a)
      const bIndex = parsePeriodKey(b)
      if (aIndex !== null && bIndex !== null) return aIndex - bIndex
      return a.localeCompare(b)
    })
  }, [measurementPeriods, measurementRecords])

  const measurementPeriodMeta = useMemo(
    () =>
      measurementPeriodKeys.map((key) => ({
        key,
        label: formatMeasurementPeriodLabel(
          copy.measurement.periodLabel,
          parsePeriodKey(key) ?? 0,
        ),
      })),
    [copy.measurement.periodLabel, measurementPeriodKeys],
  )

  const measurementRowData = useMemo(() => {
    if (!completionItems.length) return []
    const baseRows = buildActualBoqRows({
      items: completionItems,
      completion: completionMap,
      locale,
    }).map((row) => {
      const isItem = row.tone === 'ITEM'
      let measuredQuantity: number | null = null
      let measuredValue: number | null = null

      if (isItem && measurementPeriodKeys.length) {
        let quantityTotal = 0
        let valueTotal = 0
        let hasQuantity = false
        let hasValue = false

        measurementPeriodKeys.forEach((periodKey) => {
          const { quantityValue, amountValue } = resolveItemPeriodAmount(
            row.id,
            periodKey,
            row.unitPrice,
            measurementDrafts,
            measurementMap,
          )

          if (quantityValue !== null) {
            quantityTotal += quantityValue
            hasQuantity = true
          }
          if (amountValue !== null) {
            valueTotal += amountValue
            hasValue = true
          }
        })

        measuredQuantity = hasQuantity ? quantityTotal : null
        measuredValue = hasValue ? valueTotal : null
      }

      return {
        ...row,
        tone: mapBoqTone(row.tone),
        measuredQuantity,
        measuredValue,
      }
    })

    const totalsBySection = new Map<number, MeasurementTotals>()
    const totalsBySubsection = new Map<number, MeasurementTotals>()
    const totalsBySubsectionCode = new Map<string, MeasurementTotals>()
    const totalsByMajorCode = new Map<string, MeasurementTotals>()
    const subsectionIndexBySectionAndCode = new Map<number, Map<string, number>>()
    const overallTotals: MeasurementTotals = {
      measuredQuantity: 0,
      measuredValue: 0,
      totalPrice: 0,
      itemCount: 0,
    }
    const sectionIndexByRow: Array<number | null> = []
    let currentSectionIndex: number | null = null
    let currentSubsectionIndex: number | null = null
    let currentSubsectionCode: string | null = null

    const addTotals = (target: MeasurementTotals, addition: MeasurementTotals) => {
      target.measuredQuantity += addition.measuredQuantity
      target.measuredValue += addition.measuredValue
      target.totalPrice += addition.totalPrice
      target.itemCount += addition.itemCount
    }

    const addToMap = (
      map: Map<number, MeasurementTotals>,
      key: number,
      addition: MeasurementTotals,
    ) => {
      const existing = map.get(key) ?? {
        measuredQuantity: 0,
        measuredValue: 0,
        totalPrice: 0,
        itemCount: 0,
      }
      addTotals(existing, addition)
      map.set(key, existing)
    }

    const addToCodeMap = (
      map: Map<string, MeasurementTotals>,
      key: string,
      addition: MeasurementTotals,
    ) => {
      const existing = map.get(key) ?? {
        measuredQuantity: 0,
        measuredValue: 0,
        totalPrice: 0,
        itemCount: 0,
      }
      addTotals(existing, addition)
      map.set(key, existing)
    }

    baseRows.forEach((row, index) => {
      if (row.tone === 'section') {
        currentSectionIndex = index
        currentSubsectionIndex = null
        currentSubsectionCode = null
      } else if (row.tone === 'subsection') {
        const code = row.subtotalCode
        const isMajor =
          code !== null && Number.isFinite(Number(code)) && Number(code) % 100 === 0
        if (isMajor) {
          if (currentSectionIndex !== null) {
            const map = subsectionIndexBySectionAndCode.get(currentSectionIndex) ?? new Map()
            map.set(code, index)
            subsectionIndexBySectionAndCode.set(currentSectionIndex, map)
          }
          currentSubsectionIndex = index
        }
      }
      if (row.tone !== 'item') {
        if (row.subtotalCode && /^\d{3}$/.test(row.subtotalCode)) {
          currentSubsectionCode = row.subtotalCode
        }
      }
      sectionIndexByRow[index] = currentSectionIndex
      if (row.tone !== 'item') return
      const addition: MeasurementTotals = {
        measuredQuantity: row.measuredQuantity ?? 0,
        measuredValue: row.measuredValue ?? 0,
        totalPrice: row.totalPriceValue ?? 0,
        itemCount: 1,
      }
      addTotals(overallTotals, addition)
      if (currentSectionIndex !== null) {
        addToMap(totalsBySection, currentSectionIndex, addition)
      }
      if (currentSubsectionIndex !== null) {
        addToMap(totalsBySubsection, currentSubsectionIndex, addition)
      }
      if (currentSubsectionCode) {
        addToCodeMap(totalsBySubsectionCode, currentSubsectionCode, addition)
      }
      if (row.majorCode) {
        addToCodeMap(totalsByMajorCode, row.majorCode, addition)
      }
    })

    const applyTotals = (
      row: (typeof baseRows)[number],
      totals: MeasurementTotals | undefined,
    ) => {
      if (!totals || totals.itemCount === 0) {
        const fallbackTotalPrice = row.totalPriceValue ?? row.totalPrice
        return {
          ...row,
          totalPrice: fallbackTotalPrice ?? null,
          measuredQuantity: null,
          measuredValue: null,
        }
      }
      return {
        ...row,
        totalPrice: totals.totalPrice,
        measuredQuantity: null,
        measuredValue: totals.measuredValue,
      }
    }

    const scaleTotals = (totals: MeasurementTotals, factor: number): MeasurementTotals => ({
      measuredQuantity: totals.measuredQuantity,
      measuredValue: totals.measuredValue * factor,
      totalPrice: totals.totalPrice * factor,
      itemCount: totals.itemCount,
    })

    const resolveTotalsForTotalRow = (
      row: (typeof baseRows)[number],
      index: number,
    ): MeasurementTotals | undefined => {
      const normalizedCode = normalizeBoqCode(row.code)
      const useOverall =
        isVatCode(normalizedCode) ||
        isTotalHtvaCode(normalizedCode) ||
        isTotalWithTaxCode(normalizedCode)
      if (useOverall) {
        const factor = isVatCode(normalizedCode) ? 0.18 : isTotalWithTaxCode(normalizedCode) ? 1.18 : 1
        return scaleTotals(overallTotals, factor)
      }

      const subtotalCode = row.subtotalCode
      const majorCode = row.majorCode
      if (majorCode && totalsByMajorCode.has(majorCode)) {
        return totalsByMajorCode.get(majorCode)
      }
      if (subtotalCode && totalsBySubsectionCode.has(subtotalCode)) {
        return totalsBySubsectionCode.get(subtotalCode)
      }

      const sectionIndex = sectionIndexByRow[index]
      if (sectionIndex !== null) {
        const matchingSubsectionIndex = subtotalCode
          ? subsectionIndexBySectionAndCode.get(sectionIndex)?.get(subtotalCode) ?? null
          : null
        return matchingSubsectionIndex !== null
          ? totalsBySubsection.get(matchingSubsectionIndex)
          : totalsBySection.get(sectionIndex)
      }

      return overallTotals
    }

    const totalRowTotalsByKey = new Map<string, MeasurementTotals>()
    const totalRowTotalsByCode = new Map<string, MeasurementTotals>()
    baseRows.forEach((row, index) => {
      if (row.tone !== 'total') return
      const sectionIndex = sectionIndexByRow[index]
      if (sectionIndex === null) return
      const subtotalCode = row.subtotalCode
      const majorCode = row.majorCode
      if (!subtotalCode) return
      const totals = resolveTotalsForTotalRow(row, index)
      if (!totals) return
      totalRowTotalsByKey.set(`${sectionIndex}:${subtotalCode}`, totals)
      if (majorCode && !totalRowTotalsByCode.has(majorCode)) {
        totalRowTotalsByCode.set(majorCode, totals)
      }
      if (!totalRowTotalsByCode.has(subtotalCode)) {
        totalRowTotalsByCode.set(subtotalCode, totals)
      }
    })

    return baseRows.map((row, index) => {
      if (row.tone === 'subsection') {
        const normalizedCode = normalizeBoqCode(row.code)
        if (isVatCode(normalizedCode)) {
          return applyTotals(row, scaleTotals(overallTotals, 0.18))
        }
        const isMajorSubsection =
          isMajorSubsectionCode(normalizedCode) || isMajorSubsectionCode(row.subtotalCode)
        const isSummarySubsection =
          isTotalHtvaCode(normalizedCode) || isTotalWithTaxCode(normalizedCode)
        const isSubtotalRow =
          /^T\d+/i.test(normalizedCode) || isSubtotalLabel(row.designation ?? null)
        if (!isMajorSubsection && !isSummarySubsection && !isSubtotalRow) {
          return {
            ...row,
            measuredQuantity: null,
            measuredValue: null,
          }
        }
        const subsectionTotals = totalsBySubsection.get(index)
        const sectionIndex = sectionIndexByRow[index]
        const subtotalCode = row.subtotalCode
        const majorCode = row.majorCode
        const fallbackTotals =
          sectionIndex !== null && subtotalCode
            ? totalRowTotalsByKey.get(`${sectionIndex}:${subtotalCode}`)
            : undefined
        const codeTotals = majorCode
          ? totalRowTotalsByCode.get(majorCode) ?? totalsByMajorCode.get(majorCode)
          : subtotalCode
            ? totalRowTotalsByCode.get(subtotalCode) ?? totalsBySubsectionCode.get(subtotalCode)
            : undefined
        const resolvedTotals =
          subsectionTotals && subsectionTotals.itemCount > 0 ? subsectionTotals : fallbackTotals
        return applyTotals(row, resolvedTotals ?? codeTotals)
      }
      if (row.tone === 'total') {
        return applyTotals(row, resolveTotalsForTotalRow(row, index))
      }
      if (row.tone === 'section') {
        return {
          ...row,
          measuredQuantity: null,
          measuredValue: null,
        }
      }
      return row
    })
  }, [
    completionItems,
    completionMap,
    locale,
    measurementDrafts,
    measurementMap,
    measurementPeriodKeys,
  ])

  const comparisonRowData = useMemo<ComparisonRow[]>(() => {
    const rows = sortBoqItemsByOrder(completionItems)
      .filter((item) => item.tone === 'ITEM' && normalizeBoqCode(item.code) !== 'AVANCE')
      .map((item) => {
        const designation = locale === 'fr' ? item.designationFr : item.designationZh
        const completion = completionMap.get(item.id)
        const completedQuantity = Number.isFinite(completion?.completedQuantity ?? NaN)
          ? (completion?.completedQuantity ?? 0)
          : 0
        const unitPrice = parseBoqNumber(item.unitPrice)
        const completedValue = unitPrice !== null ? completedQuantity * unitPrice : 0

        let measuredQuantity = 0
        let measuredValue = 0
        const records = measurementMap.get(item.id)
        if (records) {
          records.forEach((record) => {
            const quantityValue = parseBoqNumber(record.quantity)
            if (quantityValue !== null) {
              measuredQuantity += quantityValue
            }
            const amountValue = parseBoqNumber(record.amount)
            if (amountValue !== null) {
              measuredValue += amountValue
            } else if (quantityValue !== null && unitPrice !== null) {
              measuredValue += quantityValue * unitPrice
            }
          })
        }

        const source: ComparisonSource = item.contractItemId ? 'contract' : 'new'
        const quantityDelta = completedQuantity - measuredQuantity
        const amountDelta = completedValue - measuredValue
        const unmeasuredQuantity = quantityDelta > 0 ? quantityDelta : 0
        const unmeasuredValue = amountDelta > 0 ? amountDelta : 0
        const overMeasuredValue = amountDelta < 0 ? Math.abs(amountDelta) : 0
        const searchable = `${item.code} ${designation}`.toLowerCase()

        return {
          id: item.id,
          source,
          code: item.code,
          designation,
          unit: item.unit,
          unitPrice,
          completedQuantity,
          completedValue,
          measuredQuantity,
          measuredValue,
          amountDelta,
          unmeasuredQuantity,
          unmeasuredValue,
          overMeasuredValue,
          searchable,
        }
      })

    return rows
  }, [completionItems, completionMap, locale, measurementMap])

  const measurementUnitPriceMap = useMemo(() => {
    const map = new Map<number, string | null>()
    measurementRowData.forEach((row) => {
      map.set(row.id, row.unitPrice ?? null)
    })
    return map
  }, [measurementRowData])

  const measurementPeriodTotals = useMemo(() => {
    const totalByPeriod = new Map<string, number | null>()
    const advanceByPeriod = new Map<string, number | null>()
    const netByPeriod = new Map<string, number | null>()
    const tvaByPeriod = new Map<string, number | null>()
    const ttcByPeriod = new Map<string, number | null>()

    let overallTotal = 0
    let overallAdvance = 0
    let hasOverallTotal = false
    let hasOverallAdvance = false

    measurementPeriodKeys.forEach((periodKey) => {
      let periodTotal = 0
      let hasPeriodTotal = false
      measurementRowData.forEach((row) => {
        if (row.tone !== 'item') return
        const { amountValue } = resolveItemPeriodAmount(
          row.id,
          periodKey,
          row.unitPrice ?? null,
          measurementDrafts,
          measurementMap,
        )
        if (amountValue === null) return
        periodTotal += amountValue
        hasPeriodTotal = true
      })

      const advanceAmount = resolveAdvancePeriodAmount(
        periodKey,
        measurementDrafts,
        advanceMeasurementMap,
      )
      const hasAdvance = advanceAmount !== null

      const totalValue = hasPeriodTotal ? periodTotal : null
      const advanceValue = hasAdvance ? advanceAmount : null
      const netValueRaw =
        totalValue !== null || advanceValue !== null
          ? (totalValue ?? 0) + (advanceValue ?? 0)
          : null
      const netValue = netValueRaw !== null ? Math.round(netValueRaw) : null
      const tvaValue = netValue !== null ? netValue * 0.18 : null
      const ttcValue = netValue !== null ? netValue + netValue * 0.18 : null

      totalByPeriod.set(periodKey, totalValue)
      advanceByPeriod.set(periodKey, advanceValue)
      netByPeriod.set(periodKey, netValue)
      tvaByPeriod.set(periodKey, tvaValue)
      ttcByPeriod.set(periodKey, ttcValue)

      if (totalValue !== null) {
        overallTotal += totalValue
        hasOverallTotal = true
      }
      if (advanceValue !== null) {
        overallAdvance += advanceValue
        hasOverallAdvance = true
      }
    })

    const overallNetRaw =
      hasOverallTotal || hasOverallAdvance ? overallTotal + overallAdvance : null
    const overallNet = overallNetRaw !== null ? Math.round(overallNetRaw) : null
    const overallTva = overallNet !== null ? overallNet * 0.18 : null
    const overallTtc = overallNet !== null ? overallNet + overallNet * 0.18 : null

    return {
      totalByPeriod,
      advanceByPeriod,
      netByPeriod,
      tvaByPeriod,
      ttcByPeriod,
      overallTotal: hasOverallTotal ? overallTotal : null,
      overallAdvance: hasOverallAdvance ? overallAdvance : null,
      overallNet,
      overallTva,
      overallTtc,
    }
  }, [
    advanceMeasurementMap,
    measurementDrafts,
    measurementMap,
    measurementPeriodKeys,
    measurementRowData,
  ])

  const measurementPeriodRowTotals = useMemo(() => {
    if (!measurementRowData.length || !measurementPeriodKeys.length) {
      return new Map<string, Map<number, PeriodRowTotals>>()
    }

    const sectionIndexByRow: Array<number | null> = []
    const subsectionIndexBySectionAndCode = new Map<number, Map<string, number>>()
    const itemGroups: Array<{
      id: number
      unitPrice: string | null
      sectionIndex: number | null
      subsectionIndex: number | null
      subsectionCode: string | null
      majorCode: string | null
    }> = []

    let currentSectionIndex: number | null = null
    let currentSubsectionIndex: number | null = null
    let currentSubsectionCode: string | null = null

    measurementRowData.forEach((row, index) => {
      if (row.tone === 'section') {
        currentSectionIndex = index
        currentSubsectionIndex = null
        currentSubsectionCode = null
      } else if (row.tone === 'subsection') {
        const code = row.subtotalCode
        const isMajor =
          code !== null && Number.isFinite(Number(code)) && Number(code) % 100 === 0
        if (isMajor) {
          if (currentSectionIndex !== null) {
            const map = subsectionIndexBySectionAndCode.get(currentSectionIndex) ?? new Map()
            map.set(code, index)
            subsectionIndexBySectionAndCode.set(currentSectionIndex, map)
          }
          currentSubsectionIndex = index
        }
      }
      if (row.tone !== 'item') {
        if (row.subtotalCode && /^\d{3}$/.test(row.subtotalCode)) {
          currentSubsectionCode = row.subtotalCode
        }
      }
      sectionIndexByRow[index] = currentSectionIndex
      if (row.tone !== 'item') return
      itemGroups.push({
        id: row.id,
        unitPrice: row.unitPrice ?? null,
        sectionIndex: currentSectionIndex,
        subsectionIndex: currentSubsectionIndex,
        subsectionCode: currentSubsectionCode,
        majorCode: row.majorCode,
      })
    })

    const initTotals = (): PeriodGroupTotals => ({
      quantity: 0,
      amount: 0,
      hasQuantity: false,
      hasAmount: false,
    })

    const addTotals = (
      target: PeriodGroupTotals,
      quantityValue: number | null,
      amountValue: number | null,
    ) => {
      if (quantityValue !== null) {
        target.quantity += quantityValue
        target.hasQuantity = true
      }
      if (amountValue !== null) {
        target.amount += amountValue
        target.hasAmount = true
      }
    }

    const addToMap = (
      map: Map<number, PeriodGroupTotals>,
      key: number,
      quantityValue: number | null,
      amountValue: number | null,
    ) => {
      const existing = map.get(key) ?? initTotals()
      addTotals(existing, quantityValue, amountValue)
      map.set(key, existing)
    }

    const addToCodeMap = (
      map: Map<string, PeriodGroupTotals>,
      key: string,
      quantityValue: number | null,
      amountValue: number | null,
    ) => {
      const existing = map.get(key) ?? initTotals()
      addTotals(existing, quantityValue, amountValue)
      map.set(key, existing)
    }

    const scaleTotals = (totals: PeriodGroupTotals, factor: number): PeriodGroupTotals => ({
      quantity: totals.quantity,
      amount: totals.amount * factor,
      hasQuantity: totals.hasQuantity,
      hasAmount: totals.hasAmount,
    })

    const toRowTotals = (totals: PeriodGroupTotals | undefined): PeriodRowTotals | null => {
      if (!totals) return null
      return {
        quantity: totals.hasQuantity ? totals.quantity : null,
        amount: totals.hasAmount ? totals.amount : null,
      }
    }

    const resolveTotalsForTotalRow = (
      row: (typeof measurementRowData)[number],
      index: number,
      totalsBySection: Map<number, PeriodGroupTotals>,
      totalsBySubsection: Map<number, PeriodGroupTotals>,
      totalsBySubsectionCode: Map<string, PeriodGroupTotals>,
      totalsByMajorCode: Map<string, PeriodGroupTotals>,
      overallTotals: PeriodGroupTotals,
    ): PeriodGroupTotals | undefined => {
      const normalizedCode = normalizeBoqCode(row.code)
      const useOverall =
        isVatCode(normalizedCode) ||
        isTotalHtvaCode(normalizedCode) ||
        isTotalWithTaxCode(normalizedCode)
      if (useOverall) {
        const factor = isVatCode(normalizedCode)
          ? 0.18
          : isTotalWithTaxCode(normalizedCode)
            ? 1.18
            : 1
        return scaleTotals(overallTotals, factor)
      }

      const subtotalCode = row.subtotalCode
      const majorCode = row.majorCode
      if (majorCode && totalsByMajorCode.has(majorCode)) {
        return totalsByMajorCode.get(majorCode)
      }
      if (subtotalCode && totalsBySubsectionCode.has(subtotalCode)) {
        return totalsBySubsectionCode.get(subtotalCode)
      }

      const sectionIndex = sectionIndexByRow[index]
      if (sectionIndex !== null) {
        const matchingSubsectionIndex = subtotalCode
          ? subsectionIndexBySectionAndCode.get(sectionIndex)?.get(subtotalCode) ?? null
          : null
        return matchingSubsectionIndex !== null
          ? totalsBySubsection.get(matchingSubsectionIndex)
          : totalsBySection.get(sectionIndex)
      }

      return overallTotals
    }

    const periodRowTotals = new Map<string, Map<number, PeriodRowTotals>>()

    measurementPeriodKeys.forEach((periodKey) => {
      const totalsBySection = new Map<number, PeriodGroupTotals>()
      const totalsBySubsection = new Map<number, PeriodGroupTotals>()
      const totalsBySubsectionCode = new Map<string, PeriodGroupTotals>()
      const totalsByMajorCode = new Map<string, PeriodGroupTotals>()
      const overallTotals = initTotals()

      itemGroups.forEach((group) => {
        const { quantityValue, amountValue } = resolveItemPeriodAmount(
          group.id,
          periodKey,
          group.unitPrice,
          measurementDrafts,
          measurementMap,
        )
        addTotals(overallTotals, quantityValue, amountValue)
        if (group.sectionIndex !== null) {
          addToMap(totalsBySection, group.sectionIndex, quantityValue, amountValue)
        }
        if (group.subsectionIndex !== null) {
          addToMap(totalsBySubsection, group.subsectionIndex, quantityValue, amountValue)
        }
        if (group.subsectionCode) {
          addToCodeMap(totalsBySubsectionCode, group.subsectionCode, quantityValue, amountValue)
        }
        if (group.majorCode) {
          addToCodeMap(totalsByMajorCode, group.majorCode, quantityValue, amountValue)
        }
      })

      const totalRowTotalsByKey = new Map<string, PeriodGroupTotals>()
      const totalRowTotalsByCode = new Map<string, PeriodGroupTotals>()
      measurementRowData.forEach((row, index) => {
        if (row.tone !== 'total') return
        const sectionIndex = sectionIndexByRow[index]
        if (sectionIndex === null) return
        const subtotalCode = row.subtotalCode
        const majorCode = row.majorCode
        if (!subtotalCode) return
        const totals = resolveTotalsForTotalRow(
          row,
          index,
          totalsBySection,
          totalsBySubsection,
          totalsBySubsectionCode,
          totalsByMajorCode,
          overallTotals,
        )
        if (!totals) return
        totalRowTotalsByKey.set(`${sectionIndex}:${subtotalCode}`, totals)
        if (majorCode && !totalRowTotalsByCode.has(majorCode)) {
          totalRowTotalsByCode.set(majorCode, totals)
        }
        if (!totalRowTotalsByCode.has(subtotalCode)) {
          totalRowTotalsByCode.set(subtotalCode, totals)
        }
      })

      const rowTotals = new Map<number, PeriodRowTotals>()
      measurementRowData.forEach((row, index) => {
        if (row.tone === 'item' || row.tone === 'section') return
        const normalizedCode = normalizeBoqCode(row.code)
        if (row.tone === 'subsection') {
        if (isVatCode(normalizedCode)) {
          const totals = scaleTotals(overallTotals, 0.18)
          const resolved = toRowTotals(totals)
          if (resolved && resolved.amount !== null) {
            rowTotals.set(row.index, { quantity: null, amount: resolved.amount })
          }
          return
        }
          const isMajorSubsection =
            isMajorSubsectionCode(normalizedCode) || isMajorSubsectionCode(row.subtotalCode)
          const isSummarySubsection =
            isTotalHtvaCode(normalizedCode) || isTotalWithTaxCode(normalizedCode)
          const isSubtotalRow =
            /^T\d+/i.test(normalizedCode) || isSubtotalLabel(row.designation ?? null)
          if (!isMajorSubsection && !isSummarySubsection && !isSubtotalRow) return

          const subsectionTotals = totalsBySubsection.get(index)
          const sectionIndex = sectionIndexByRow[index]
          const subtotalCode = row.subtotalCode
          const majorCode = row.majorCode
          const fallbackTotals =
            sectionIndex !== null && subtotalCode
              ? totalRowTotalsByKey.get(`${sectionIndex}:${subtotalCode}`)
              : undefined
          const codeTotals = majorCode
            ? totalRowTotalsByCode.get(majorCode) ?? totalsByMajorCode.get(majorCode)
            : subtotalCode
              ? totalRowTotalsByCode.get(subtotalCode) ?? totalsBySubsectionCode.get(subtotalCode)
              : undefined
          const resolvedTotals = subsectionTotals ?? fallbackTotals ?? codeTotals
          const resolved = toRowTotals(resolvedTotals)
          if (resolved && resolved.amount !== null) {
            rowTotals.set(row.index, { quantity: null, amount: resolved.amount })
          }
          return
        }

        if (row.tone === 'total') {
          const totals = resolveTotalsForTotalRow(
            row,
            index,
            totalsBySection,
            totalsBySubsection,
            totalsBySubsectionCode,
            totalsByMajorCode,
            overallTotals,
          )
          const resolved = toRowTotals(totals)
          if (resolved && resolved.amount !== null) {
            rowTotals.set(row.index, { quantity: null, amount: resolved.amount })
          }
        }
      })

      periodRowTotals.set(periodKey, rowTotals)
    })

    return periodRowTotals
  }, [measurementDrafts, measurementMap, measurementPeriodKeys, measurementRowData])

  const handleMeasurementChange = (
    boqItemId: number,
    periodKey: string,
    field: 'quantity' | 'amount',
    value: string,
  ) => {
    const draftKey = buildMeasurementKey(boqItemId, periodKey)
    setMeasurementDrafts((prev) => {
      const next = { ...prev }
      const existing = next[draftKey] ?? {}
      next[draftKey] = { ...existing, [field]: value }
      return next
    })
  }

  const handleAdvanceChange = (periodKey: string, value: string) => {
    const draftKey = buildAdvanceKey(periodKey)
    setMeasurementDrafts((prev) => {
      const next = { ...prev }
      const existing = next[draftKey] ?? {}
      next[draftKey] = { ...existing, amount: value }
      return next
    })
  }

  const handleMeasurementBlur = (
    boqItemId: number,
    periodKey: string,
    field: 'quantity' | 'amount',
  ) => {
    const draftKey = buildMeasurementKey(boqItemId, periodKey)
    setMeasurementDrafts((prev) => {
      const existing = prev[draftKey]
      if (!existing) return prev
      const value = existing[field]
      const next = { ...prev }
      if (value === '') {
        const { [field]: _removed, ...rest } = existing
        if (Object.keys(rest).length) {
          next[draftKey] = rest
        } else {
          delete next[draftKey]
        }
        return next
      }
      if (field === 'amount') {
        const rounded = toIntegerString(value)
        if (rounded && rounded !== value) {
          next[draftKey] = { ...existing, amount: rounded }
          return next
        }
      }
      return prev
    })
  }

  const handleAdvanceBlur = (periodKey: string) => {
    const draftKey = buildAdvanceKey(periodKey)
    setMeasurementDrafts((prev) => {
      const existing = prev[draftKey]
      if (!existing) return prev
      const value = existing.amount
      const next = { ...prev }
      if (value === '') {
        delete next[draftKey]
        return next
      }
      const rounded = toOneDecimalString(value)
      if (rounded && rounded !== value) {
        next[draftKey] = { ...existing, amount: rounded }
        return next
      }
      return prev
    })
  }

  const handleAddMeasurementPeriod = () => {
    const existingKeys = new Set(measurementPeriodKeys)
    const indices = measurementPeriodKeys
      .map((key) => parsePeriodKey(key))
      .filter((value): value is number => value !== null)
    const nextIndex = indices.length ? Math.max(...indices) + 1 : 0
    const candidateKey = formatPeriodKey(nextIndex)
    if (existingKeys.has(candidateKey)) {
      return
    }
    setMeasurementPeriods((prev) => [...prev, candidateKey])
  }

  const handleSaveMeasurements = async () => {
    if (!selectedProjectId) return
    const itemEntries: Array<{
      boqItemId: number
      period: string
      quantity: string
      amount: string | null
      unitPrice: string | null
    }> = []
    const advanceEntries: Array<{
      period: string
      amount: string | null
    }> = []

    Object.entries(measurementDrafts).forEach(([key, draft]) => {
      if (key.startsWith('advance:')) {
        const periodKey = key.split(':')[1]
        if (!periodKey) return
        const rawAmount = draft.amount ?? ''
        if (rawAmount === '') {
          advanceEntries.push({ period: periodKey, amount: null })
          return
        }
        const parsed = parseBoqNumber(rawAmount)
        const amount =
          parsed !== null
            ? toOneDecimalString(parsed)
            : typeof rawAmount === 'string'
              ? rawAmount
              : null
        advanceEntries.push({ period: periodKey, amount })
        return
      }

      const [boqItemIdText, periodKey] = key.split(':')
      const boqItemId = Number(boqItemIdText)
      if (!Number.isFinite(boqItemId) || !periodKey) return
      const record = measurementMap.get(boqItemId)?.get(periodKey)
      const quantity = draft.quantity ?? record?.quantity ?? ''
      const unitPrice = record?.unitPrice ?? measurementUnitPriceMap.get(boqItemId) ?? null
      const quantityValue = parseBoqNumber(quantity)
      const unitPriceValue = parseBoqNumber(unitPrice ?? null)
      const draftAmountRaw = draft.amount
      const hasDraftAmount =
        Object.prototype.hasOwnProperty.call(draft, 'amount') && draftAmountRaw !== undefined
      const recordAmountRaw = record?.amount ?? null
      const recordQuantityValue = parseBoqNumber(record?.quantity ?? '')
      const recordAmountValue = parseBoqNumber(recordAmountRaw ?? '')
      const recordAmountDerived =
        recordAmountValue !== null &&
        recordQuantityValue !== null &&
        unitPriceValue !== null &&
        Math.abs(recordAmountValue - recordQuantityValue * unitPriceValue) < 0.01
      const computedAmount =
        quantityValue !== null && unitPriceValue !== null
          ? (quantityValue * unitPriceValue).toFixed(2)
          : null
      const amount =
        hasDraftAmount && draftAmountRaw !== ''
          ? draftAmountRaw ?? null
          : recordAmountRaw && !recordAmountDerived
            ? recordAmountRaw
            : computedAmount
      itemEntries.push({
        boqItemId,
        period: periodKey,
        quantity,
        amount,
        unitPrice,
      })
    })

    const entries = [
      ...itemEntries.map((entry) => ({ ...entry, kind: 'ITEM' })),
      ...advanceEntries.map((entry) => ({ ...entry, kind: 'ADVANCE', quantity: '0' })),
    ]

    if (!entries.length) return

    const hasInvalid = itemEntries.some((entry) => parseBoqNumber(entry.quantity) === null)
    if (hasInvalid) {
      addToast(copy.measurement.messages.requiredQuantity, { tone: 'warning' })
      return
    }

    setMeasurementSaving(true)
    try {
      const response = await fetch('/api/value/boq-measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: Number(selectedProjectId),
          entries,
        }),
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { measurements?: BoqMeasurementRecord[]; message?: string }

      if (!response.ok) {
        const message =
          response.status === 403
            ? unauthorizedMessage
            : payload.message ?? copy.measurement.messages.saveError
        if (response.status === 403) {
          setPermissionDenied(true)
        }
        throw new Error(message)
      }

      setMeasurementRecords(payload.measurements ?? [])
      setMeasurementDrafts({})
      if (measurementSaveToastRef.current !== copy.measurement.messages.saved) {
        addToast(copy.measurement.messages.saved, { tone: 'success' })
        measurementSaveToastRef.current = copy.measurement.messages.saved
      }
    } catch (error) {
      addToast((error as Error).message ?? copy.measurement.messages.saveError, { tone: 'danger' })
    } finally {
      setMeasurementSaving(false)
    }
  }

  const boqSearchTokens = useMemo(
    () => boqSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [boqSearch],
  )

  const completionSearchTokens = useMemo(
    () => completionSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [completionSearch],
  )

  const measurementSearchTokens = useMemo(
    () => measurementSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [measurementSearch],
  )

  const comparisonSearchTokens = useMemo(
    () => comparisonSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [comparisonSearch],
  )

  const handleComparisonSort = useCallback((field: ComparisonSortField) => {
    setComparisonSortStack((prev) => {
      const existing = prev.find((item) => item.field === field)
      const nextOrder: ComparisonSortOrder =
        existing?.order === 'asc' ? 'desc' : existing?.order === 'desc' ? 'asc' : 'desc'
      const filtered = prev.filter((item) => item.field !== field)
      return [{ field, order: nextOrder }, ...filtered].slice(0, 4)
    })
  }, [])

  const clearComparisonSort = useCallback(() => {
    setComparisonSortStack([])
  }, [])

  const comparisonSortIndicator = useCallback(
    (field: ComparisonSortField) => {
      const idx = comparisonSortStack.findIndex((item) => item.field === field)
      if (idx === -1) return ''
      const arrow = comparisonSortStack[idx].order === 'asc' ? '↑' : '↓'
      return `${arrow}${idx + 1}`
    },
    [comparisonSortStack],
  )

  const comparisonAriaSort = useCallback(
    (field: ComparisonSortField): 'none' | 'ascending' | 'descending' | 'other' => {
      const idx = comparisonSortStack.findIndex((item) => item.field === field)
      if (idx === -1) return 'none'
      if (idx > 0) return 'other'
      return comparisonSortStack[idx].order === 'asc' ? 'ascending' : 'descending'
    },
    [comparisonSortStack],
  )

  const { displayBoqRows, highlightedBoqIndices } = useMemo(() => {
    if (!boqRowData.length) {
      return { displayBoqRows: [], highlightedBoqIndices: new Set<number>() }
    }

    const summaryCodes = new Set([
      '000',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      'TOTAL HTVA',
      'TVA',
      'TOTAL TTC',
    ])
    const baseRows =
      boqViewMode === 'summary'
        ? boqRowData.filter(
            (row) =>
              summaryCodes.has(row.code) && (row.tone === 'subsection' || row.tone === 'total'),
          )
        : boqRowData

    const visibleIndices = new Set<number>()
    const highlightedIndices = new Set<number>()

    if (boqSearchTokens.length) {
      baseRows.forEach((row) => {
        const isMatch = boqSearchTokens.every((token) => row.searchable.includes(token))
        if (!isMatch) return
        highlightedIndices.add(row.index)
        visibleIndices.add(row.index)
        if (boqViewMode !== 'summary') {
          for (let i = row.index - 1; i >= 0; i -= 1) {
            if (boqRowData[i]?.tone === 'section') {
              visibleIndices.add(i)
              break
            }
          }
        }
      })
    } else {
      baseRows.forEach((row) => visibleIndices.add(row.index))
    }

    const displayRows = boqRowData.filter((row) => visibleIndices.has(row.index))
    return { displayBoqRows: displayRows, highlightedBoqIndices: highlightedIndices }
  }, [boqRowData, boqSearchTokens, boqViewMode])

  const { displayCompletionRows, highlightedCompletionIndices } = useMemo(() => {
    if (!completionRowData.length) {
      return { displayCompletionRows: [], highlightedCompletionIndices: new Set<number>() }
    }

    const summaryCodes = new Set([
      '000',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      'TOTAL HTVA',
      'TVA',
      'TOTAL TTC',
    ])
    const baseRows =
      completionViewMode === 'summary'
        ? completionRowData.filter(
            (row) =>
              summaryCodes.has(normalizeBoqCode(row.code)) &&
              (row.tone === 'subsection' || row.tone === 'total'),
          )
        : completionRowData

    const visibleIndices = new Set<number>()
    const highlightedIndices = new Set<number>()

    if (completionSearchTokens.length) {
      baseRows.forEach((row) => {
        const isMatch = completionSearchTokens.every((token) =>
          row.searchable.includes(token),
        )
        if (!isMatch) return
        highlightedIndices.add(row.index)
        visibleIndices.add(row.index)
        if (completionViewMode !== 'summary') {
          for (let i = row.index - 1; i >= 0; i -= 1) {
            if (completionRowData[i]?.tone === 'section') {
              visibleIndices.add(i)
              break
            }
          }
        }
      })
    } else {
      baseRows.forEach((row) => visibleIndices.add(row.index))
    }

    const displayRows = completionRowData.filter((row) => visibleIndices.has(row.index))
    return { displayCompletionRows: displayRows, highlightedCompletionIndices: highlightedIndices }
  }, [completionRowData, completionSearchTokens, completionViewMode])

  const { displayMeasurementRows, highlightedMeasurementIndices } = useMemo(() => {
    if (!measurementRowData.length) {
      return { displayMeasurementRows: [], highlightedMeasurementIndices: new Set<number>() }
    }

    const visibleIndices = new Set<number>()
    const highlightedIndices = new Set<number>()

    if (measurementSearchTokens.length) {
      measurementRowData.forEach((row) => {
        const isMatch = measurementSearchTokens.every((token) =>
          row.searchable.includes(token),
        )
        if (!isMatch) return
        highlightedIndices.add(row.index)
        visibleIndices.add(row.index)
        for (let i = row.index - 1; i >= 0; i -= 1) {
          if (measurementRowData[i]?.tone === 'section') {
            visibleIndices.add(i)
            break
          }
        }
      })
    } else {
      measurementRowData.forEach((row) => visibleIndices.add(row.index))
    }

    const displayRows = measurementRowData.filter((row) => visibleIndices.has(row.index))
    return { displayMeasurementRows: displayRows, highlightedMeasurementIndices: highlightedIndices }
  }, [measurementRowData, measurementSearchTokens])

  const { displayComparisonRows, highlightedComparisonIds } = useMemo(() => {
    if (!comparisonRowData.length) {
      return { displayComparisonRows: [], highlightedComparisonIds: new Set<number>() }
    }

    const sourceFiltered =
      comparisonSourceFilter === 'all'
        ? comparisonRowData
        : comparisonRowData.filter((row) => row.source === comparisonSourceFilter)

    const highlightedIds = new Set<number>()
    const filteredRows = comparisonSearchTokens.length
      ? sourceFiltered.filter((row) => {
          const isMatch = comparisonSearchTokens.every((token) => row.searchable.includes(token))
          if (isMatch) highlightedIds.add(row.id)
          return isMatch
        })
      : sourceFiltered

    if (!comparisonSortStack.length) {
      return { displayComparisonRows: filteredRows, highlightedComparisonIds: highlightedIds }
    }

    const orderById = new Map<number, number>()
    comparisonRowData.forEach((row, index) => {
      orderById.set(row.id, index)
    })

    const compareNullableNumber = (left: number | null, right: number | null) => {
      if (left === right) return 0
      if (left === null) return 1
      if (right === null) return -1
      return left - right
    }

    const sortedRows = [...filteredRows].sort((left, right) => {
      for (const sort of comparisonSortStack) {
        let result = 0
        switch (sort.field) {
          case 'source':
            result =
              (left.source === 'contract' ? 0 : 1) - (right.source === 'contract' ? 0 : 1)
            break
          case 'code':
            result = comparisonSortCollator.compare(left.code, right.code)
            break
          case 'designation':
            result = comparisonSortCollator.compare(left.designation, right.designation)
            break
          case 'unit':
            result = comparisonSortCollator.compare(left.unit ?? '', right.unit ?? '')
            break
          case 'unitPrice':
            result = compareNullableNumber(left.unitPrice, right.unitPrice)
            break
          case 'completedQuantity':
            result = left.completedQuantity - right.completedQuantity
            break
          case 'completedValue':
            result = left.completedValue - right.completedValue
            break
          case 'measuredQuantity':
            result = left.measuredQuantity - right.measuredQuantity
            break
          case 'measuredValue':
            result = left.measuredValue - right.measuredValue
            break
          case 'unmeasuredQuantity':
            result = left.unmeasuredQuantity - right.unmeasuredQuantity
            break
          case 'unmeasuredValue':
            result = left.unmeasuredValue - right.unmeasuredValue
            break
          case 'overMeasuredValue':
            result = left.overMeasuredValue - right.overMeasuredValue
            break
          default:
            result = 0
        }
        if (result !== 0) {
          return sort.order === 'asc' ? result : -result
        }
      }
      return (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0)
    })
    return { displayComparisonRows: sortedRows, highlightedComparisonIds: highlightedIds }
  }, [
    comparisonRowData,
    comparisonSearchTokens,
    comparisonSourceFilter,
    comparisonSortCollator,
    comparisonSortStack,
  ])

  const comparisonTotals = useMemo(
    () =>
      displayComparisonRows.reduce(
        (acc, row) => ({
          completedQuantity: acc.completedQuantity + row.completedQuantity,
          completedValue: acc.completedValue + row.completedValue,
          measuredQuantity: acc.measuredQuantity + row.measuredQuantity,
          measuredValue: acc.measuredValue + row.measuredValue,
          unmeasuredQuantity: acc.unmeasuredQuantity + row.unmeasuredQuantity,
          unmeasuredValue: acc.unmeasuredValue + row.unmeasuredValue,
          overMeasuredValue: acc.overMeasuredValue + row.overMeasuredValue,
        }),
        {
          completedQuantity: 0,
          completedValue: 0,
          measuredQuantity: 0,
          measuredValue: 0,
          unmeasuredQuantity: 0,
          unmeasuredValue: 0,
          overMeasuredValue: 0,
        },
      ),
    [displayComparisonRows],
  )

  const comparisonSummaryRows = useMemo<ComparisonSummaryRow[]>(() => {
    const labels = copy.comparison.summaryRows
    const measuredAdvance = measurementPeriodTotals.overallAdvance ?? 0
    const totalHtvaCompleted = comparisonTotals.completedValue
    const totalHtvaMeasured = comparisonTotals.measuredValue
    const netCompleted = totalHtvaCompleted
    const netMeasured = totalHtvaMeasured + measuredAdvance
    const vatCompleted = netCompleted * 0.18
    const vatMeasured = netMeasured * 0.18
    const totalTtcCompleted = netCompleted + vatCompleted
    const totalTtcMeasured = netMeasured + vatMeasured

    const buildRow = (
      key: ComparisonSummaryRow['key'],
      label: string,
      completedValue: number,
      measuredValue: number,
      options?: {
        completedQuantity?: number | null
        measuredQuantity?: number | null
        unmeasuredQuantity?: number | null
        unmeasuredValue?: number
        overMeasuredValue?: number
      },
    ): ComparisonSummaryRow => {
      const amountDelta = completedValue - measuredValue
      return {
        key,
        label,
        completedQuantity: options?.completedQuantity ?? null,
        completedValue,
        measuredQuantity: options?.measuredQuantity ?? null,
        measuredValue,
        amountDelta,
        unmeasuredQuantity: options?.unmeasuredQuantity ?? null,
        unmeasuredValue:
          options?.unmeasuredValue ?? (amountDelta > AMOUNT_EPSILON ? amountDelta : 0),
        overMeasuredValue:
          options?.overMeasuredValue ?? (amountDelta < -AMOUNT_EPSILON ? Math.abs(amountDelta) : 0),
      }
    }

    return [
      buildRow('totalHtva', labels.totalHtva, totalHtvaCompleted, totalHtvaMeasured, {
        completedQuantity: comparisonTotals.completedQuantity,
        measuredQuantity: comparisonTotals.measuredQuantity,
        unmeasuredQuantity: comparisonTotals.unmeasuredQuantity,
        unmeasuredValue: comparisonTotals.unmeasuredValue,
        overMeasuredValue: comparisonTotals.overMeasuredValue,
      }),
      buildRow('advance', labels.advance, 0, measuredAdvance),
      buildRow('netHtva', labels.netHtva, netCompleted, netMeasured),
      buildRow('vat', labels.vat, vatCompleted, vatMeasured),
      buildRow('totalTtc', labels.totalTtc, totalTtcCompleted, totalTtcMeasured),
    ]
  }, [comparisonTotals, copy.comparison.summaryRows, measurementPeriodTotals.overallAdvance])

  type MeasurementDisplayRow = (typeof measurementRowData)[number] & {
    virtual?: 'advance' | 'net-htva'
  }

  const measurementDisplayRows = useMemo<MeasurementDisplayRow[]>(() => {
    if (!displayMeasurementRows.length) return []
    const rows = [...displayMeasurementRows]
    const totalIndex = rows.findIndex(
      (row) => normalizeBoqCode(row.code) === 'TOTAL HTVA',
    )
    if (totalIndex === -1) return rows
    const baseIndex = rows[totalIndex]?.index ?? totalIndex
    const advanceRow = {
      ...rows[totalIndex],
      id: -100,
      code: 'AVANCE',
      designation: copy.measurement.advanceLabel,
      unit: null,
      unitPrice: null,
      quantity: null,
      totalPrice: null,
      tone: 'total' as const,
      searchable: `${copy.measurement.advanceLabel}`.toLowerCase(),
      index: baseIndex + 0.1,
      virtual: 'advance' as const,
    }
    const netRow = {
      ...rows[totalIndex],
      id: -101,
      code: 'NET HTVA',
      designation: copy.measurement.netHtvaLabel,
      unit: null,
      unitPrice: null,
      quantity: null,
      totalPrice: null,
      tone: 'total' as const,
      searchable: `${copy.measurement.netHtvaLabel}`.toLowerCase(),
      index: baseIndex + 0.2,
      virtual: 'net-htva' as const,
    }
    rows.splice(totalIndex + 1, 0, advanceRow, netRow)
    return rows
  }, [copy.measurement.advanceLabel, copy.measurement.netHtvaLabel, displayMeasurementRows])

  const boqHeaders = copy.boq.tableHeaders
  const completionHeaders = copy.completion.tableHeaders
  const comparisonHeaders = copy.comparison.tableHeaders
  const comparisonSortHint = copy.comparison.actions.sortHint
  const hasComparisonSort = comparisonSortStack.length > 0
  const comparisonStickyHeadClass = 'bg-slate-100/95'
  const [comparisonStickyTop, setComparisonStickyTop] = useState(0)
  const comparisonStickyStyle = useMemo<CSSProperties>(
    () => ({ top: `${comparisonStickyTop}px` }),
    [comparisonStickyTop],
  )
  const measurementHeaders = copy.measurement.tableHeaders
  const measurementColumnSelectorCopy = copy.measurement.columnSelector
  const measurementBaseColumnOptions = useMemo(
    () => [
      { key: 'code', label: measurementHeaders.code },
      { key: 'designation', label: measurementHeaders.designation },
      { key: 'unit', label: measurementHeaders.unit },
      { key: 'unitPrice', label: measurementHeaders.unitPrice },
      { key: 'quantity', label: measurementHeaders.quantity },
      { key: 'totalPrice', label: measurementHeaders.totalPrice },
      { key: 'totalMeasuredQuantity', label: measurementHeaders.totalMeasuredQuantity },
      { key: 'totalMeasuredValue', label: measurementHeaders.totalMeasuredValue },
    ],
    [measurementHeaders],
  )
  const measurementPeriodColumnOptions = useMemo(
    () =>
      measurementPeriodMeta.flatMap((period) => [
        {
          key: buildMeasurementPeriodColumnKey(period.key, 'quantity'),
          label: `${period.label} · ${measurementHeaders.periodQuantity}`,
        },
        {
          key: buildMeasurementPeriodColumnKey(period.key, 'amount'),
          label: `${period.label} · ${measurementHeaders.periodAmount}`,
        },
      ]),
    [measurementHeaders.periodAmount, measurementHeaders.periodQuantity, measurementPeriodMeta],
  )
  const measurementColumnOptions = useMemo(
    () => [...measurementBaseColumnOptions, ...measurementPeriodColumnOptions],
    [measurementBaseColumnOptions, measurementPeriodColumnOptions],
  )
  const measurementDefaultColumns = useMemo(
    () => measurementColumnOptions.map((option) => option.key),
    [measurementColumnOptions],
  )
  const measurementVisiblePeriodMeta = useMemo(
    () =>
      measurementPeriodMeta
        .map((period) => {
          const quantityKey = buildMeasurementPeriodColumnKey(period.key, 'quantity')
          const amountKey = buildMeasurementPeriodColumnKey(period.key, 'amount')
          const showQuantity = measurementVisibleColumns.includes(quantityKey)
          const showAmount = measurementVisibleColumns.includes(amountKey)
          return {
            ...period,
            quantityKey,
            amountKey,
            showQuantity,
            showAmount,
          }
        })
        .filter((period) => period.showQuantity || period.showAmount),
    [measurementPeriodMeta, measurementVisibleColumns],
  )
  const measurementVisiblePeriodColumnCount = useMemo(
    () =>
      measurementVisiblePeriodMeta.reduce(
        (total, period) =>
          total + (period.showQuantity ? 1 : 0) + (period.showAmount ? 1 : 0),
        0,
      ),
    [measurementVisiblePeriodMeta],
  )
  const measurementColumnStatusLabel = measurementVisibleColumns.length
    ? formatCopy(measurementColumnSelectorCopy.selectedTemplate, {
        count: measurementVisibleColumns.length,
      })
    : measurementColumnSelectorCopy.noneSelected
  const persistMeasurementColumns = useCallback((next: string[]) => {
    setMeasurementVisibleColumns(next)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MEASUREMENT_COLUMN_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('Failed to persist measurement columns', error)
      }
    }
  }, [])
  const toggleMeasurementColumn = (key: string) => {
    persistMeasurementColumns(
      measurementVisibleColumns.includes(key)
        ? measurementVisibleColumns.filter((item) => item !== key)
        : [...measurementVisibleColumns, key],
    )
  }
  const selectAllMeasurementColumns = () =>
    persistMeasurementColumns(measurementColumnOptions.map((option) => option.key))
  const restoreMeasurementColumns = () =>
    persistMeasurementColumns([...measurementDefaultColumns])
  const clearMeasurementColumns = () => persistMeasurementColumns([])

  useEffect(() => {
    if (!measurementColumnOptions.length) return
    if (typeof window === 'undefined') {
      setMeasurementVisibleColumns(measurementDefaultColumns)
      return
    }
    try {
      const stored = localStorage.getItem(MEASUREMENT_COLUMN_STORAGE_KEY)
      if (!stored) {
        setMeasurementVisibleColumns(measurementDefaultColumns)
        return
      }
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) {
        setMeasurementVisibleColumns(measurementDefaultColumns)
        return
      }
      const filtered = parsed.filter(
        (item) =>
          typeof item === 'string' &&
          measurementColumnOptions.some((option) => option.key === item),
      ) as string[]
      if (filtered.length || stored.trim() === '[]') {
        setMeasurementVisibleColumns(filtered)
      } else {
        setMeasurementVisibleColumns(measurementDefaultColumns)
      }
    } catch (error) {
      console.error('Failed to load measurement columns', error)
      setMeasurementVisibleColumns(measurementDefaultColumns)
    }
  }, [measurementColumnOptions, measurementDefaultColumns])

  useEffect(() => {
    if (activeTab !== 'comparison') return
    const pageHeader = document.querySelector('header.value-page-header') as HTMLElement | null
    if (!pageHeader) {
      setComparisonStickyTop(0)
      return
    }
    const resolveStickyTop = () => {
      setComparisonStickyTop(Math.ceil(pageHeader.getBoundingClientRect().height))
    }
    resolveStickyTop()
    window.addEventListener('resize', resolveStickyTop)
    const observer = new ResizeObserver(resolveStickyTop)
    observer.observe(pageHeader)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resolveStickyTop)
    }
  }, [activeTab, locale])

  useEffect(() => {
    const currentKeys = measurementPeriodMeta.map((period) => period.key)
    if (measurementPeriodKeysRef.current.length === 0) {
      measurementPeriodKeysRef.current = currentKeys
      return
    }
    const previousKeys = new Set(measurementPeriodKeysRef.current)
    const addedKeys = currentKeys.filter((key) => !previousKeys.has(key))
    measurementPeriodKeysRef.current = currentKeys
    if (!addedKeys.length) return
    const nextColumns = new Set(measurementVisibleColumns)
    addedKeys.forEach((key) => {
      nextColumns.add(buildMeasurementPeriodColumnKey(key, 'quantity'))
      nextColumns.add(buildMeasurementPeriodColumnKey(key, 'amount'))
    })
    if (nextColumns.size !== measurementVisibleColumns.length) {
      persistMeasurementColumns(Array.from(nextColumns))
    }
  }, [measurementPeriodMeta, measurementVisibleColumns, persistMeasurementColumns])

  const completionColumnCount = 9
  const tabTitle =
    activeTab === 'boq'
      ? copy.boq.title
      : activeTab === 'comparison'
        ? copy.comparison.title
      : activeTab === 'measurement'
        ? copy.measurement.title
        : copy.completion.title
  const tabDescription =
    activeTab === 'boq'
      ? copy.boq.description
      : activeTab === 'comparison'
        ? copy.comparison.description
      : activeTab === 'measurement'
        ? copy.measurement.description
        : copy.completion.description
  const tabItems = [
    { key: 'completion', label: copy.tabs.completion, href: '/value' },
    { key: 'comparison', label: copy.tabs.comparison, href: '/value?tab=comparison' },
    { key: 'boq', label: copy.tabs.boq, href: '/value?tab=boq' },
    { key: 'measurement', label: copy.tabs.measurement, href: '/value?tab=measurement' },
    { key: 'variation', label: copy.tabs.variation, href: '/value/variation-measurements' },
    { key: 'manage', label: copy.tabs.manage, href: '/value/prices' },
  ] as const
  const tabs = tabItems.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: tab.href,
    active: tab.key === activeTab,
  }))
  const hasMeasurementDrafts = Object.keys(measurementDrafts).length > 0
  const measurementColumnVisibility = useMemo(
    () => ({
      code: measurementVisibleColumns.includes('code'),
      designation: measurementVisibleColumns.includes('designation'),
      unit: measurementVisibleColumns.includes('unit'),
      unitPrice: measurementVisibleColumns.includes('unitPrice'),
      quantity: measurementVisibleColumns.includes('quantity'),
      totalPrice: measurementVisibleColumns.includes('totalPrice'),
      totalMeasuredQuantity: measurementVisibleColumns.includes('totalMeasuredQuantity'),
      totalMeasuredValue: measurementVisibleColumns.includes('totalMeasuredValue'),
    }),
    [measurementVisibleColumns],
  )
  const measurementHeaderRowSpan = measurementVisiblePeriodColumnCount ? 2 : 1

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={copy.messages.unauthorized}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="value-page-header z-30 py-4"
        breadcrumbs={[{ label: breadcrumbHome, href: '/' }, { label: breadcrumbValue }]}
        title={tabTitle}
        subtitle={tabDescription || undefined}
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
      />
      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          {activeTab === 'completion' ? (
            <div className="p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {copy.completion.title}
                    </h2>
                    <p className="text-sm text-slate-600">{copy.completion.description}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.completion.projectLabel}</span>
                      <select
                        className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                      >
                        {!boqProjects.length ? (
                          <option value="">{copy.completion.projectPlaceholder}</option>
                        ) : null}
                        {boqProjects.map((project) => (
                          <option key={project.id} value={String(project.id)}>
                            {resolveProjectLabel(project)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.completion.actions.searchLabel}</span>
                      <input
                        type="search"
                        className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={completionSearch}
                        onChange={(event) => setCompletionSearch(event.target.value)}
                        placeholder={copy.completion.actions.searchPlaceholder}
                      />
                    </label>
                    <div className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.completion.actions.viewLabel}</span>
                      <div className="flex items-center rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setCompletionViewMode('full')}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                            completionViewMode === 'full'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                              : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          {copy.completion.actions.viewAll}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletionViewMode('summary')}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                            completionViewMode === 'summary'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                              : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          {copy.completion.actions.viewSummary}
                        </button>
                      </div>
                    </div>
                    <Link
                      href="/value/boq/manage"
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      {copy.completion.actions.manageCta}
                    </Link>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  {boqProjectsStatus === 'loading' && (
                    <p>{copy.completion.messages.projectLoading}</p>
                  )}
                  {boqProjectsStatus === 'error' && (
                    <p className="text-rose-600">{boqProjectsError ?? projectLoadError}</p>
                  )}
                  {completionStatus === 'loading' && (
                    <p>{copy.completion.messages.loading}</p>
                  )}
                  {completionStatus === 'error' && (
                    <p className="text-rose-600">
                      {completionError ?? copy.completion.messages.loadError}
                    </p>
                  )}
                </div>

                {hasBoqHeader ? (
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {headerLeftLine ? (
                        <p className="text-left text-base font-semibold text-slate-900">
                          {headerLeftLine}
                        </p>
                      ) : null}
                      {headerRightLine ? (
                        <p className="text-left text-sm font-medium text-slate-700 sm:text-right sm:text-base">
                          {headerRightLine}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-400">
                    {copy.boq.messages.noHeader}
                  </div>
                )}

                {displayCompletionRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-100/70">
                        <tr
                          className={`text-[11px] font-semibold text-slate-500 ${
                            isFrenchLocale ? 'uppercase tracking-[0.24em]' : 'tracking-[0.12em]'
                          }`}
                        >
                          <th className="w-[10%] px-3 py-3 text-left">
                            {completionHeaders.code}
                          </th>
                          <th className="px-3 py-3 text-left">
                            {completionHeaders.designation}
                          </th>
                          <th className="w-[8%] px-3 py-3 text-left">
                            {completionHeaders.unit}
                          </th>
                          <th className="w-[12%] px-3 py-3 text-right">
                            {completionHeaders.unitPrice}
                          </th>
                          <th className="w-[10%] px-3 py-3 text-right">
                            {completionHeaders.quantity}
                          </th>
                          <th className="w-[12%] px-3 py-3 text-right">
                            {completionHeaders.totalPrice}
                          </th>
                          <th className="w-[12%] px-3 py-3 text-right">
                            {completionHeaders.completedQuantity}
                          </th>
                          <th className="w-[12%] px-3 py-3 text-right">
                            {completionHeaders.completedValue}
                          </th>
                          <th className="w-[10%] px-3 py-3 text-right">
                            {completionHeaders.percent}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {displayCompletionRows.map((row) => {
                          const tone = row.tone ?? 'item'
                          const isHighlighted = highlightedCompletionIndices.has(row.index)
                          const bindingCount = row.bindingCount ?? 0
                          const isExpandable = tone === 'item' && bindingCount > 0
                          const isExpanded = isExpandable && expandedCompletionItems.has(row.id)
                          const detailItems = completionDetails.get(row.id) ?? []
                          const detailLoading = completionDetailLoading.has(row.id)
                          const detailError = completionDetailErrors.get(row.id) ?? null
                          return (
                            <Fragment key={`${row.code}-${row.index}`}>
                              <tr
                                className={`transition ${
                                  tone === 'item' ? 'hover:bg-slate-50' : ''
                                } ${boqRowToneStyles[tone]} ${
                                  isHighlighted ? 'bg-amber-50/70' : ''
                                } ${row.completionRisk ? 'bg-rose-50/80' : ''}`}
                              >
                                <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.2em]">
                                  {row.code}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-start gap-2">
                                    {isExpandable ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleCompletionDetails(row.id)}
                                        className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                                        aria-label={
                                          isExpanded
                                            ? copy.completion.details.collapse
                                            : copy.completion.details.expand
                                        }
                                      >
                                        {isExpanded ? '▾' : '▸'}
                                      </button>
                                    ) : (
                                      <span className="mt-0.5 inline-block h-5 w-5" />
                                    )}
                                    <span className="whitespace-pre-line leading-relaxed">
                                      {row.designation}
                                    </span>
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3">
                                  {formatBoqCell(row.unit)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.unitPrice, { numeric: true, localeId })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.quantity, { numeric: true, localeId })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.totalPrice, { numeric: true, localeId })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.completedQuantity, {
                                    numeric: true,
                                    localeId,
                                  })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.completedValue, {
                                    numeric: true,
                                    localeId,
                                  })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatPercent(row.completedPercent, localeId)}
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={completionColumnCount} className="px-4 py-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          {copy.completion.details.title}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {detailItems.length ? `共 ${detailItems.length} 条` : ''}
                                        </div>
                                      </div>
                                      {detailLoading ? (
                                        <div className="mt-3 text-sm text-slate-500">
                                          {copy.completion.details.loading}
                                        </div>
                                      ) : detailError ? (
                                        <div className="mt-3 text-sm text-rose-600">{detailError}</div>
                                      ) : detailItems.length === 0 ? (
                                        <div className="mt-3 text-sm text-slate-500">
                                          {copy.completion.details.empty}
                                        </div>
                                      ) : (
                                        <div className="mt-3 overflow-x-auto">
                                          <table className="min-w-full text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                                              <tr>
                                                <th className="px-3 py-2 text-left">
                                                  {copy.completion.details.headers.road}
                                                </th>
                                                <th className="px-3 py-2 text-left">
                                                  {copy.completion.details.headers.interval}
                                                </th>
                                                <th className="px-3 py-2 text-left">
                                                  {copy.completion.details.headers.side}
                                                </th>
                                                <th className="px-3 py-2 text-right">
                                                  {copy.completion.details.headers.quantity}
                                                </th>
                                                <th className="px-3 py-2 text-left">
                                                  {copy.completion.details.headers.unit}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                              {detailItems.map((detail) => {
                                                const sideLabel =
                                                  sideLabelMap[detail.intervalSide] ??
                                                  detail.intervalSide
                                                const intervalLabel = `${formatPk(detail.intervalStartPk)} - ${formatPk(detail.intervalEndPk)}`
                                                const specLabel = detail.intervalSpec
                                                  ? ` · ${detail.intervalSpec}`
                                                  : ''
                                                const manualBadge = detail.manualQuantity !== null
                                                return (
                                                  <tr key={detail.inputId} className="text-slate-700">
                                                    <td className="px-3 py-2">
                                                      <div className="font-semibold text-slate-900">
                                                        {detail.roadName}
                                                      </div>
                                                      <div className="text-[11px] text-slate-500">
                                                        {detail.roadSlug}
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                      {intervalLabel}
                                                      {specLabel}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                      {sideLabel}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums">
                                                      <div className="flex items-center justify-end gap-2">
                                                        <span>
                                                          {formatBoqCell(detail.effectiveQuantity, {
                                                            numeric: true,
                                                            localeId,
                                                          })}
                                                        </span>
                                                        {manualBadge ? (
                                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                            {copy.completion.details.manualBadge}
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                      {detail.unit ?? '—'}
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : completionSearchTokens.length ? (
                  <p className="text-sm text-slate-500">{copy.completion.messages.noMatches}</p>
                ) : completionStatus === 'success' ? (
                  <p className="text-sm text-slate-500">{copy.completion.messages.empty}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'comparison' ? (
            <div className="p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {copy.comparison.title}
                    </h2>
                    <p className="text-sm text-slate-600">{copy.comparison.description}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.comparison.projectLabel}</span>
                      <select
                        className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                      >
                        {!boqProjects.length ? (
                          <option value="">{copy.comparison.projectPlaceholder}</option>
                        ) : null}
                        {boqProjects.map((project) => (
                          <option key={project.id} value={String(project.id)}>
                            {resolveProjectLabel(project)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.comparison.actions.searchLabel}</span>
                      <input
                        type="search"
                        className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={comparisonSearch}
                        onChange={(event) => setComparisonSearch(event.target.value)}
                        placeholder={copy.comparison.actions.searchPlaceholder}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.comparison.actions.sourceLabel}</span>
                      <select
                        className="w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={comparisonSourceFilter}
                        onChange={(event) =>
                          setComparisonSourceFilter(
                            event.target.value as 'all' | ComparisonSource,
                          )
                        }
                      >
                        <option value="all">{copy.comparison.actions.sourceAll}</option>
                        <option value="contract">{copy.comparison.actions.sourceContract}</option>
                        <option value="new">{copy.comparison.actions.sourceNew}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={clearComparisonSort}
                      disabled={!hasComparisonSort}
                      className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        hasComparisonSort
                          ? 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      }`}
                    >
                      {copy.comparison.actions.clearSort}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{comparisonSortHint}</p>

                <div className="space-y-1 text-xs text-slate-500">
                  {boqProjectsStatus === 'loading' && (
                    <p>{copy.comparison.messages.projectLoading}</p>
                  )}
                  {boqProjectsStatus === 'error' && (
                    <p className="text-rose-600">{boqProjectsError ?? projectLoadError}</p>
                  )}
                  {completionStatus === 'loading' && (
                    <p>{copy.comparison.messages.loading}</p>
                  )}
                  {completionStatus === 'error' && (
                    <p className="text-rose-600">
                      {completionError ?? copy.comparison.messages.loadError}
                    </p>
                  )}
                  {measurementStatus === 'loading' && (
                    <p>{copy.comparison.messages.loading}</p>
                  )}
                  {measurementStatus === 'error' && (
                    <p className="text-rose-600">
                      {measurementError ?? copy.comparison.messages.loadError}
                    </p>
                  )}
                </div>

                {hasBoqHeader ? (
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {headerLeftLine ? (
                        <p className="text-left text-base font-semibold text-slate-900">
                          {headerLeftLine}
                        </p>
                      ) : null}
                      {headerRightLine ? (
                        <p className="text-left text-sm font-medium text-slate-700 sm:text-right sm:text-base">
                          {headerRightLine}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-400">
                    {copy.boq.messages.noHeader}
                  </div>
                )}

                {completionStatus === 'success' &&
                measurementStatus === 'success' &&
                displayComparisonRows.length ? (
                  <div className="overflow-x-auto overflow-y-visible rounded-2xl border border-slate-200 lg:overflow-x-visible">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead
                        className="sticky z-20 bg-slate-100/95 shadow-[0_1px_0_rgba(148,163,184,0.35)]"
                        style={comparisonStickyStyle}
                      >
                        <tr
                          className={`text-[11px] font-semibold text-slate-500 ${
                            isFrenchLocale ? 'uppercase tracking-[0.24em]' : 'tracking-[0.12em]'
                          }`}
                        >
                          <th
                            className={`${comparisonStickyHeadClass} w-[7%] px-3 py-3 text-left`}
                            aria-sort={comparisonAriaSort('source')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('source')}
                              className="inline-flex w-full items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.source}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('source')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('source') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[7%] px-3 py-3 text-left`}
                            aria-sort={comparisonAriaSort('code')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('code')}
                              className="inline-flex w-full items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.code}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('code')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('code') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[18%] px-3 py-3 text-left`}
                            aria-sort={comparisonAriaSort('designation')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('designation')}
                              className="inline-flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.designation}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('designation')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('designation') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[6%] px-3 py-3 text-left`}
                            aria-sort={comparisonAriaSort('unit')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('unit')}
                              className="inline-flex w-full items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.unit}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('unit')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('unit') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('unitPrice')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('unitPrice')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.unitPrice}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('unitPrice')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('unitPrice') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('completedQuantity')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('completedQuantity')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.completedQuantity}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('completedQuantity')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('completedQuantity') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('completedValue')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('completedValue')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.completedValue}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('completedValue')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('completedValue') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('measuredQuantity')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('measuredQuantity')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.measuredQuantity}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('measuredQuantity')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('measuredQuantity') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('measuredValue')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('measuredValue')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.measuredValue}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('measuredValue')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('measuredValue') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('unmeasuredQuantity')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('unmeasuredQuantity')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.unmeasuredQuantity}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('unmeasuredQuantity')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('unmeasuredQuantity') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[8%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('unmeasuredValue')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('unmeasuredValue')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.unmeasuredValue}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('unmeasuredValue')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('unmeasuredValue') || '↕'}
                              </span>
                            </button>
                          </th>
                          <th
                            className={`${comparisonStickyHeadClass} w-[6%] px-3 py-3 text-right`}
                            aria-sort={comparisonAriaSort('overMeasuredValue')}
                          >
                            <button
                              type="button"
                              onClick={() => handleComparisonSort('overMeasuredValue')}
                              className="inline-flex w-full items-center justify-end gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/70"
                              title={comparisonSortHint}
                            >
                              <span>{comparisonHeaders.overMeasuredValue}</span>
                              <span
                                className={`text-[10px] ${
                                  comparisonSortIndicator('overMeasuredValue')
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {comparisonSortIndicator('overMeasuredValue') || '↕'}
                              </span>
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {displayComparisonRows.map((row) => {
                          const isHighlighted = highlightedComparisonIds.has(row.id)
                          const needsReceivable = row.amountDelta > AMOUNT_EPSILON
                          const isOverMeasured = row.amountDelta < -AMOUNT_EPSILON
                          const sourceLabel =
                            row.source === 'contract'
                              ? copy.comparison.sourceLabels.contract
                              : copy.comparison.sourceLabels.new
                          return (
                            <tr
                              key={row.id}
                              className={`transition hover:bg-slate-50 ${
                                needsReceivable
                                  ? 'bg-rose-50/80'
                                  : isOverMeasured
                                    ? 'bg-emerald-50/60'
                                    : isHighlighted
                                      ? 'bg-amber-50/70'
                                      : ''
                              }`}
                            >
                              <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                {sourceLabel}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.2em] text-slate-700">
                                {row.code}
                              </td>
                              <td className="px-3 py-3 text-slate-700">{row.designation}</td>
                              <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                {formatBoqCell(row.unit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                {formatBoqCell(row.unitPrice, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                {formatBoqCell(row.completedQuantity, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                {formatBoqCell(row.completedValue, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                {formatBoqCell(row.measuredQuantity, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                {formatBoqCell(row.measuredValue, { numeric: true, localeId })}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  needsReceivable ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(row.unmeasuredQuantity, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  needsReceivable ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(
                                  row.unmeasuredValue > AMOUNT_EPSILON
                                    ? row.unmeasuredValue
                                    : null,
                                  { numeric: true, localeId },
                                )}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  isOverMeasured ? 'text-emerald-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(
                                  row.overMeasuredValue > AMOUNT_EPSILON
                                    ? row.overMeasuredValue
                                    : null,
                                  { numeric: true, localeId },
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="border-t border-slate-300 bg-slate-100/80">
                        {comparisonSummaryRows.map((summaryRow) => {
                          const needsReceivable = summaryRow.amountDelta > AMOUNT_EPSILON
                          const isOverMeasured = summaryRow.amountDelta < -AMOUNT_EPSILON
                          return (
                            <tr
                              key={summaryRow.key}
                              className={`border-t border-slate-200/70 font-semibold text-slate-900 first:border-t-0 ${
                                needsReceivable
                                  ? 'bg-rose-50/70'
                                  : isOverMeasured
                                    ? 'bg-emerald-50/50'
                                    : ''
                              }`}
                            >
                              <td colSpan={5} className="px-3 py-3 text-left">
                                {summaryRow.label}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(summaryRow.completedQuantity, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(summaryRow.completedValue, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(summaryRow.measuredQuantity, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(summaryRow.measuredValue, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  needsReceivable ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(summaryRow.unmeasuredQuantity, {
                                  numeric: true,
                                  localeId,
                                })}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  needsReceivable ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(
                                  summaryRow.unmeasuredValue > AMOUNT_EPSILON
                                    ? summaryRow.unmeasuredValue
                                    : null,
                                  { numeric: true, localeId },
                                )}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                                  isOverMeasured ? 'text-emerald-700' : 'text-slate-700'
                                }`}
                              >
                                {formatBoqCell(
                                  summaryRow.overMeasuredValue > AMOUNT_EPSILON
                                    ? summaryRow.overMeasuredValue
                                    : null,
                                  { numeric: true, localeId },
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tfoot>
                    </table>
                  </div>
                ) : completionStatus === 'success' && measurementStatus === 'success' &&
                  (comparisonSearchTokens.length || comparisonSourceFilter !== 'all') ? (
                  <p className="text-sm text-slate-500">{copy.comparison.messages.noMatches}</p>
                ) : completionStatus === 'success' && measurementStatus === 'success' ? (
                  <p className="text-sm text-slate-500">{copy.comparison.messages.empty}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'measurement' ? (
            <div className="p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {copy.measurement.title}
                    </h2>
                    <p className="text-sm text-slate-600">{copy.measurement.description}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.measurement.projectLabel}</span>
                      <select
                        className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                      >
                        {!boqProjects.length ? (
                          <option value="">{copy.measurement.projectPlaceholder}</option>
                        ) : null}
                        {boqProjects.map((project) => (
                          <option key={project.id} value={String(project.id)}>
                            {resolveProjectLabel(project)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.measurement.actions.searchLabel}</span>
                      <input
                        type="search"
                        className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={measurementSearch}
                        onChange={(event) => setMeasurementSearch(event.target.value)}
                        placeholder={copy.measurement.actions.searchPlaceholder}
                      />
                    </label>
                    <div
                      className="relative text-sm font-semibold text-slate-700"
                      ref={measurementColumnSelectorRef}
                    >
                      <span className="mb-1 block">{measurementColumnSelectorCopy.label}</span>
                      <button
                        type="button"
                        onClick={() => setShowMeasurementColumnSelector((prev) => !prev)}
                        className="flex w-full min-w-[220px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm hover:bg-slate-50"
                      >
                        <span className="truncate">{measurementColumnStatusLabel}</span>
                        <span className="text-xs text-slate-500">⌕</span>
                      </button>
                      {showMeasurementColumnSelector ? (
                        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                            <button
                              className="text-emerald-700 hover:underline"
                              onClick={selectAllMeasurementColumns}
                            >
                              {measurementColumnSelectorCopy.selectAll}
                            </button>
                            <div className="flex gap-2">
                              <button
                                className="text-slate-600 hover:underline"
                                onClick={restoreMeasurementColumns}
                              >
                                {measurementColumnSelectorCopy.restore}
                              </button>
                              <button
                                className="text-slate-600 hover:underline"
                                onClick={clearMeasurementColumns}
                              >
                                {measurementColumnSelectorCopy.clear}
                              </button>
                            </div>
                          </div>
                          <div className="max-h-72 space-y-2 overflow-y-auto p-2 text-sm">
                            <div>
                              <p className="px-2 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                {measurementColumnSelectorCopy.baseGroup}
                              </p>
                              {measurementBaseColumnOptions.map((option) => (
                                <label
                                  key={option.key}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={measurementVisibleColumns.includes(option.key)}
                                    onChange={() => toggleMeasurementColumn(option.key)}
                                  />
                                  <span className="truncate">{option.label}</span>
                                </label>
                              ))}
                            </div>
                            {measurementPeriodColumnOptions.length ? (
                              <div className="border-t border-slate-100 pt-2">
                                <p className="px-2 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                  {measurementColumnSelectorCopy.periodGroup}
                                </p>
                                {measurementPeriodColumnOptions.map((option) => (
                                  <label
                                    key={option.key}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4"
                                      checked={measurementVisibleColumns.includes(option.key)}
                                      onChange={() => toggleMeasurementColumn(option.key)}
                                    />
                                    <span className="truncate">{option.label}</span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMeasurementPeriod}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
                    >
                      {copy.measurement.actions.addPeriod}
                    </button>
                    <Link
                      href={
                        selectedProjectId
                          ? `/value/measurement-ledger?projectId=${encodeURIComponent(selectedProjectId)}`
                          : '/value/measurement-ledger'
                      }
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {copy.measurement.actions.detailLedger}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSaveMeasurements}
                      disabled={!hasMeasurementDrafts || measurementSaving}
                      className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                        hasMeasurementDrafts && !measurementSaving
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100'
                          : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                      }`}
                    >
                      {measurementSaving
                        ? copy.measurement.actions.saving
                        : copy.measurement.actions.save}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  {boqProjectsStatus === 'loading' && (
                    <p>{copy.measurement.messages.projectLoading}</p>
                  )}
                  {boqProjectsStatus === 'error' && (
                    <p className="text-rose-600">{boqProjectsError ?? projectLoadError}</p>
                  )}
                  {completionStatus === 'loading' && (
                    <p>{copy.measurement.messages.loading}</p>
                  )}
                  {completionStatus === 'error' && (
                    <p className="text-rose-600">
                      {completionError ?? copy.measurement.messages.loadError}
                    </p>
                  )}
                  {measurementStatus === 'loading' && (
                    <p>{copy.measurement.messages.loading}</p>
                  )}
                  {measurementStatus === 'error' && (
                    <p className="text-rose-600">
                      {measurementError ?? copy.measurement.messages.loadError}
                    </p>
                  )}
                </div>

                {hasBoqHeader ? (
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {headerLeftLine ? (
                        <p className="text-left text-base font-semibold text-slate-900">
                          {headerLeftLine}
                        </p>
                      ) : null}
                      {headerRightLine ? (
                        <p className="text-left text-sm font-medium text-slate-700 sm:text-right sm:text-base">
                          {headerRightLine}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-400">
                    {copy.boq.messages.noHeader}
                  </div>
                )}

                {measurementDisplayRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full table-fixed border-collapse text-left text-sm">
                      <colgroup>
                        {measurementColumnVisibility.code ? (
                          <col style={{ width: 'min(90px, 10vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.designation ? (
                          <col style={{ width: 'min(320px, 36vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.unit ? (
                          <col style={{ width: 'min(80px, 9vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.unitPrice ? (
                          <col style={{ width: 'min(120px, 12vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.quantity ? (
                          <col style={{ width: 'min(110px, 12vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.totalPrice ? (
                          <col style={{ width: 'min(130px, 14vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.totalMeasuredQuantity ? (
                          <col style={{ width: 'min(140px, 14vw)' }} />
                        ) : null}
                        {measurementColumnVisibility.totalMeasuredValue ? (
                          <col style={{ width: 'min(140px, 14vw)' }} />
                        ) : null}
                        {measurementVisiblePeriodMeta.map((period) => (
                          <Fragment key={`period-cols-${period.key}`}>
                            {period.showQuantity ? (
                              <col style={{ width: 'min(110px, 12vw)' }} />
                            ) : null}
                            {period.showAmount ? (
                              <col style={{ width: 'min(130px, 14vw)' }} />
                            ) : null}
                          </Fragment>
                        ))}
                      </colgroup>
                      <thead className="bg-slate-100/70">
                        <tr
                          className={`text-[11px] font-semibold text-slate-500 ${
                            isFrenchLocale ? 'uppercase tracking-[0.24em]' : 'tracking-[0.12em]'
                          }`}
                        >
                          {measurementColumnVisibility.code ? (
                            <th
                              className="w-[8%] px-3 py-3 text-left"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.code}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.designation ? (
                            <th
                              className="w-[24%] max-w-[320px] px-3 py-3 text-left"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.designation}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.unit ? (
                            <th
                              className="w-[8%] px-3 py-3 text-left"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.unit}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.unitPrice ? (
                            <th
                              className="w-[12%] px-3 py-3 text-right"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.unitPrice}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.quantity ? (
                            <th
                              className="w-[10%] px-3 py-3 text-right"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.quantity}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.totalPrice ? (
                            <th
                              className="w-[12%] px-3 py-3 text-right"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              {measurementHeaders.totalPrice}
                            </th>
                          ) : null}
                          {measurementColumnVisibility.totalMeasuredQuantity ? (
                            <th
                              className="px-3 py-3 text-right"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              <span className="block truncate">
                                {measurementHeaders.totalMeasuredQuantity}
                              </span>
                            </th>
                          ) : null}
                          {measurementColumnVisibility.totalMeasuredValue ? (
                            <th
                              className="px-3 py-3 text-right"
                              rowSpan={measurementHeaderRowSpan}
                            >
                              <span className="block truncate">
                                {measurementHeaders.totalMeasuredValue}
                              </span>
                            </th>
                          ) : null}
                          {measurementVisiblePeriodMeta.map((period) => (
                            <th
                              key={period.key}
                              className="px-3 py-3 text-center"
                              colSpan={(period.showQuantity ? 1 : 0) + (period.showAmount ? 1 : 0)}
                            >
                              {period.label}
                            </th>
                          ))}
                        </tr>
                        {measurementVisiblePeriodColumnCount ? (
                          <tr className="text-[11px] font-semibold text-slate-500">
                            {measurementVisiblePeriodMeta.map((period) => (
                              <Fragment key={`${period.key}-headers`}>
                                {period.showQuantity ? (
                                  <th className="max-w-[110px] px-3 py-2 text-center">
                                    {measurementHeaders.periodQuantity}
                                  </th>
                                ) : null}
                                {period.showAmount ? (
                                  <th className="max-w-[130px] px-3 py-2 text-center">
                                    {measurementHeaders.periodAmount}
                                  </th>
                                ) : null}
                              </Fragment>
                            ))}
                          </tr>
                        ) : null}
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {measurementDisplayRows.map((row) => {
                          const tone = row.tone ?? 'item'
                          const normalizedCode = normalizeBoqCode(row.code)
                          const rowKind =
                            row.virtual ??
                            (normalizedCode === 'TOTAL HTVA'
                              ? 'total-htva'
                              : normalizedCode === 'TVA'
                                ? 'tva'
                                : normalizedCode === 'TOTAL TTC'
                                  ? 'total-ttc'
                                  : null)
                          const isHighlighted = highlightedMeasurementIndices.has(row.index)
                          const isEditable = tone === 'item'
                          const isAdvanceRow = rowKind === 'advance'
                          const isNetRow = rowKind === 'net-htva'
                          const isTvaRow = rowKind === 'tva'
                          const isTotalTtcRow = rowKind === 'total-ttc'
                          const isTotalHtvaRow = rowKind === 'total-htva'
                          const totalPriceValue = parseBoqNumber(
                            row.totalPrice ?? row.totalPriceValue ?? null,
                          )
                          const displayTotalPrice =
                            isTvaRow || isTotalTtcRow || isTotalHtvaRow
                              ? roundToInteger(totalPriceValue)
                              : row.totalPrice
                          const displayMeasuredValueRaw =
                            rowKind === 'advance'
                              ? measurementPeriodTotals.overallAdvance
                              : rowKind === 'net-htva'
                                ? measurementPeriodTotals.overallNet
                                : rowKind === 'tva'
                                  ? measurementPeriodTotals.overallTva
                                  : rowKind === 'total-ttc'
                                    ? measurementPeriodTotals.overallTtc
                                    : rowKind === 'total-htva'
                                      ? measurementPeriodTotals.overallTotal ?? row.measuredValue
                                      : row.measuredValue
                          const displayMeasuredValueText = isAdvanceRow
                            ? formatDecimalValue(
                                roundToOneDecimal(displayMeasuredValueRaw),
                                localeId,
                                1,
                              )
                            : formatBoqCell(roundToInteger(displayMeasuredValueRaw), {
                                numeric: true,
                                localeId,
                              })
                          return (
                            <tr
                              key={`${row.code}-${row.index}`}
                              className={`transition ${
                                tone === 'item' ? 'hover:bg-slate-50' : ''
                              } ${boqRowToneStyles[tone]} ${isHighlighted ? 'bg-amber-50/70' : ''}`}
                            >
                              {measurementColumnVisibility.code ? (
                                <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.2em]">
                                  {row.code}
                                </td>
                              ) : null}
                              {measurementColumnVisibility.designation ? (
                                <td className="max-w-[320px] px-3 py-3 align-top">
                                  <div className="break-words text-sm leading-relaxed">
                                    {row.designation}
                                  </div>
                                </td>
                              ) : null}
                              {measurementColumnVisibility.unit ? (
                                <td className="whitespace-nowrap px-3 py-3">
                                  {formatBoqCell(row.unit)}
                                </td>
                              ) : null}
                              {measurementColumnVisibility.unitPrice ? (
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.unitPrice, { numeric: true, localeId })}
                                </td>
                              ) : null}
                              {measurementColumnVisibility.quantity ? (
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(row.quantity, { numeric: true, localeId })}
                                </td>
                              ) : null}
                              {measurementColumnVisibility.totalPrice ? (
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                  {formatBoqCell(displayTotalPrice, { numeric: true, localeId })}
                                </td>
                              ) : null}
                              {measurementColumnVisibility.totalMeasuredQuantity ? (
                                <td className="px-3 py-3 text-right tabular-nums">
                                  <div className="truncate">
                                    {formatBoqCell(
                                      rowKind ? null : row.measuredQuantity,
                                      { numeric: true, localeId },
                                    )}
                                  </div>
                                </td>
                              ) : null}
                              {measurementColumnVisibility.totalMeasuredValue ? (
                                <td className="px-3 py-3 text-right tabular-nums">
                                  <div className="truncate">
                                    {displayMeasuredValueText}
                                  </div>
                                </td>
                              ) : null}
                              {measurementVisiblePeriodMeta.map((period) => {
                                const draftKey = buildMeasurementKey(row.id, period.key)
                                const draft = measurementDrafts[draftKey]
                                const record = measurementMap.get(row.id)?.get(period.key)
                                const quantityValue = draft?.quantity ?? record?.quantity ?? ''
                                const hasDraftAmount =
                                  draft !== undefined &&
                                  Object.prototype.hasOwnProperty.call(draft, 'amount')
                                const amountBase = hasDraftAmount ? draft?.amount ?? '' : ''
                                const quantityNumber = parseBoqNumber(quantityValue)
                                const unitPriceNumber = parseBoqNumber(row.unitPrice)
                                const recordQuantityNumber = parseBoqNumber(record?.quantity ?? '')
                                const recordAmountNumber = parseBoqNumber(record?.amount ?? '')
                                const recordAmountDerived =
                                  recordAmountNumber !== null &&
                                  recordQuantityNumber !== null &&
                                  unitPriceNumber !== null &&
                                  Math.abs(recordAmountNumber - recordQuantityNumber * unitPriceNumber) < 0.01
                                const computedAmount =
                                  quantityNumber !== null && unitPriceNumber !== null
                                    ? String(Math.round(quantityNumber * unitPriceNumber))
                                    : ''
                                const amountValue = hasDraftAmount
                                  ? amountBase
                                  : record?.amount && !recordAmountDerived
                                    ? toIntegerString(record.amount)
                                    : computedAmount
                                const advanceDraftKey = buildAdvanceKey(period.key)
                                const advanceDraft = measurementDrafts[advanceDraftKey]
                                const advanceRecord = advanceMeasurementMap.get(period.key)
                                const advanceAmountValue =
                                  advanceDraft?.amount ?? toOneDecimalString(advanceRecord?.amount) ?? ''
                                const periodTotalAmount =
                                  measurementPeriodTotals.totalByPeriod.get(period.key) ?? null
                                const periodNetAmount =
                                  measurementPeriodTotals.netByPeriod.get(period.key) ?? null
                                const periodTvaAmount =
                                  measurementPeriodTotals.tvaByPeriod.get(period.key) ?? null
                                const periodTtcAmount =
                                  measurementPeriodTotals.ttcByPeriod.get(period.key) ?? null
                                const rowPeriodTotals = Number.isInteger(row.index)
                                  ? measurementPeriodRowTotals.get(period.key)?.get(row.index)
                                  : undefined
                                const periodRowQuantity = rowPeriodTotals?.quantity ?? null
                                const periodRowAmount = rowPeriodTotals?.amount ?? null
                                return (
                                  <Fragment key={`${row.id}-${period.key}`}>
                                    {period.showQuantity ? (
                                      <td className="px-3 py-2">
                                        {isEditable ? (
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={quantityValue}
                                            onChange={(event) =>
                                              handleMeasurementChange(
                                                row.id,
                                                period.key,
                                                'quantity',
                                                event.target.value,
                                              )
                                            }
                                            onBlur={() =>
                                              handleMeasurementBlur(row.id, period.key, 'quantity')
                                            }
                                            className="w-full max-w-[110px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                          />
                                        ) : isAdvanceRow ||
                                          isNetRow ||
                                          isTvaRow ||
                                          isTotalTtcRow ||
                                          isTotalHtvaRow ? (
                                          <span className="text-slate-400">—</span>
                                        ) : periodRowQuantity !== null ? (
                                          <span className="block text-right tabular-nums text-slate-600">
                                            {formatBoqCell(periodRowQuantity, {
                                              numeric: true,
                                              localeId,
                                            })}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                    ) : null}
                                    {period.showAmount ? (
                                      <td className="px-3 py-2">
                                        {isEditable ? (
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={amountValue}
                                            onChange={(event) =>
                                              handleMeasurementChange(
                                                row.id,
                                                period.key,
                                                'amount',
                                                event.target.value,
                                              )
                                            }
                                            onBlur={() =>
                                              handleMeasurementBlur(row.id, period.key, 'amount')
                                            }
                                            className="w-full max-w-[130px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                          />
                                        ) : isAdvanceRow ? (
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={advanceAmountValue}
                                            onChange={(event) =>
                                              handleAdvanceChange(period.key, event.target.value)
                                            }
                                            onBlur={() => handleAdvanceBlur(period.key)}
                                            className="w-full max-w-[130px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                          />
                                      ) : isNetRow ? (
                                        <span className="block text-right tabular-nums text-slate-600">
                                          {formatBoqCell(roundToInteger(periodNetAmount), {
                                            numeric: true,
                                            localeId,
                                          })}
                                        </span>
                                        ) : isTvaRow ? (
                                          <span className="block text-right tabular-nums text-slate-600">
                                            {formatBoqCell(roundToInteger(periodTvaAmount), {
                                              numeric: true,
                                              localeId,
                                            })}
                                          </span>
                                        ) : isTotalTtcRow ? (
                                          <span className="block text-right tabular-nums text-slate-600">
                                            {formatBoqCell(roundToInteger(periodTtcAmount), {
                                              numeric: true,
                                              localeId,
                                            })}
                                          </span>
                                        ) : isTotalHtvaRow ? (
                                          <span className="block text-right tabular-nums text-slate-600">
                                            {formatBoqCell(roundToInteger(periodTotalAmount), {
                                              numeric: true,
                                              localeId,
                                            })}
                                          </span>
                                        ) : periodRowAmount !== null ? (
                                          <span className="block text-right tabular-nums text-slate-600">
                                            {formatBoqCell(roundToInteger(periodRowAmount), {
                                              numeric: true,
                                              localeId,
                                            })}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                    ) : null}
                                  </Fragment>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : measurementSearchTokens.length ? (
                  <p className="text-sm text-slate-500">{copy.measurement.messages.noMatches}</p>
                ) : measurementStatus === 'success' ? (
                  <p className="text-sm text-slate-500">{copy.measurement.messages.empty}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'boq' ? (
            <div className="p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{copy.boq.title}</h2>
                    <p className="text-sm text-slate-600">{copy.boq.description}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.boq.projectLabel}</span>
                      <select
                        className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                      >
                        {!boqProjects.length ? (
                          <option value="">{copy.boq.projectPlaceholder}</option>
                        ) : null}
                        {boqProjects.map((project) => (
                          <option key={project.id} value={String(project.id)}>
                            {resolveProjectLabel(project)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.boq.actions.searchLabel}</span>
                      <input
                        type="search"
                        className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={boqSearch}
                        onChange={(event) => setBoqSearch(event.target.value)}
                        placeholder={copy.boq.actions.searchPlaceholder}
                      />
                    </label>
                    <div className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">{copy.boq.actions.viewLabel}</span>
                      <div className="flex items-center rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setBoqViewMode('full')}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                            boqViewMode === 'full'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                              : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          {copy.boq.actions.viewAll}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoqViewMode('summary')}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                            boqViewMode === 'summary'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                              : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          {copy.boq.actions.viewSummary}
                        </button>
                      </div>
                    </div>
                    <Link
                      href="/value/boq/manage"
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      {copy.boq.actions.manageCta}
                    </Link>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  {boqProjectsStatus === 'loading' && <p>{copy.boq.messages.projectLoading}</p>}
                  {boqProjectsStatus === 'error' && (
                    <p className="text-rose-600">{boqProjectsError ?? projectLoadError}</p>
                  )}
                  {boqItemsStatus === 'loading' && <p>{copy.boq.messages.loading}</p>}
                  {boqItemsStatus === 'error' && (
                    <p className="text-rose-600">{boqItemsError ?? copy.boq.messages.loadError}</p>
                  )}
                </div>

                {hasBoqHeader ? (
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {headerLeftLine ? (
                        <p className="text-left text-base font-semibold text-slate-900">
                          {headerLeftLine}
                        </p>
                      ) : null}
                      {headerRightLine ? (
                        <p className="text-left text-sm font-medium text-slate-700 sm:text-right sm:text-base">
                          {headerRightLine}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-400">
                    {copy.boq.messages.noHeader}
                  </div>
                )}

                {displayBoqRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-100/70">
                        <tr
                          className={`text-[11px] font-semibold text-slate-500 ${
                            isFrenchLocale ? 'uppercase tracking-[0.24em]' : 'tracking-[0.12em]'
                          }`}
                        >
                          <th className="w-[10%] px-3 py-3 text-left">{boqHeaders.code}</th>
                          <th className="px-3 py-3 text-left">{boqHeaders.designation}</th>
                          <th className="w-[10%] px-3 py-3 text-left">{boqHeaders.unit}</th>
                          <th className="w-[15%] px-3 py-3 text-right">{boqHeaders.unitPrice}</th>
                          <th className="w-[12%] px-3 py-3 text-right">{boqHeaders.quantity}</th>
                          <th className="w-[16%] px-3 py-3 text-right">{boqHeaders.totalPrice}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {displayBoqRows.map((row) => {
                          const tone = row.tone ?? 'item'
                          const isHighlighted = highlightedBoqIndices.has(row.index)
                          return (
                            <tr
                              key={`${row.code}-${row.index}`}
                              className={`transition ${
                                tone === 'item' ? 'hover:bg-slate-50' : ''
                              } ${boqRowToneStyles[tone]} ${
                                isHighlighted ? 'bg-amber-50/70' : ''
                              }`}
                            >
                              <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.2em]">
                                {row.code}
                              </td>
                              <td className="whitespace-pre-line px-3 py-3 leading-relaxed">
                                {row.designation}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3">
                                {formatBoqCell(row.unit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(row.unitPrice, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(row.quantity, { numeric: true, localeId })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                {formatBoqCell(row.totalPrice, { numeric: true, localeId })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : boqSearchTokens.length ? (
                  <p className="text-sm text-slate-500">{copy.boq.messages.noMatches}</p>
                ) : boqItemsStatus === 'success' ? (
                  <p className="text-sm text-slate-500">{copy.boq.messages.empty}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
