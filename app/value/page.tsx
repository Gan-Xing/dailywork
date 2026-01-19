'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import {
  buildActualBoqRows,
  sortBoqItemsByOrder,
  type BoqCompletionRecord,
} from '@/lib/boq/actualBoqRows'
import type { AggregatedPhaseProgress } from '@/lib/progressTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import type { PhaseItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'
import { getPhaseUnitPrice, type PhasePriceMap } from '@/lib/phasePricing'

type BoqLocalizedText = { zh: string; fr: string }
type BoqRowTone = 'section' | 'subsection' | 'item' | 'total'
type BoqSheetType = 'CONTRACT' | 'ACTUAL'
type BoqProject = { id: number; name: string; code: string | null; isActive: boolean }
type BoqItemRecord = {
  id: number
  projectId: number
  sheetType: BoqSheetType
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

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatNumber = (value: number, localeId: string) =>
  new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(Math.max(0, value))

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

const parseBoqNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const formatPercent = (value: number | null, localeId: string) => {
  if (value === null || !Number.isFinite(value)) return '—'
  const formatter = new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 })
  return `${formatter.format(value)}%`
}

const formatPk = (value: number) => {
  if (!Number.isFinite(value)) return '—'
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const sideLabelMap: Record<BoqCompletionDetailRecord['intervalSide'], string> = {
  LEFT: '左',
  RIGHT: '右',
  BOTH: '双侧',
}

const normalizeBoqCode = (value?: string | null) => (value ?? '').trim().toUpperCase()
const isVatCode = (code: string) => code === 'TVA'
const isTotalHtvaCode = (code: string) => code.startsWith('TOTAL HTVA')
const isTotalWithTaxCode = (code: string) => code.startsWith('TOTAL TTC')

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
]
const allowedBoqProjectNames = new Set([
  '邦杜库市政路项目',
  '丹达市政路项目',
  '邦杜库边境路项目',
])
const allowedBoqProjectOrder = new Map([
  ['project-bondoukou-city', 0],
  ['project-tanda-city', 1],
  ['project-bondoukou-border', 2],
  ['邦杜库市政路项目', 0],
  ['丹达市政路项目', 1],
  ['邦杜库边境路项目', 2],
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

type ValueTabKey = 'production' | 'completion' | 'boq'

type CompletionTotals = {
  completedQuantity: number
  completedValue: number
  totalPrice: number
  itemCount: number
}

type ValueRow = AggregatedPhaseProgress & {
  designAmount: number
  completedAmount: number
  unitPrice: number
  designValue: number
  completedValue: number
}

export default function ProductionValuePage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = productionValueCopy[locale]
  const localeId = formatLocaleId(locale)
  const isFrenchLocale = locale === 'fr'
  const { home: breadcrumbHome, value: breadcrumbValue } = copy.breadcrumbs
  const {
    priceLoading,
    priceLoadError,
    unauthorized: productionUnauthorized,
    error: productionError,
  } = copy.page.messages
  const priceUnauthorizedMessage = productionUnauthorized

  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab') ?? null
  const activeTab: ValueTabKey =
    tabParam === 'completion' ? 'completion' : tabParam === 'boq' ? 'boq' : 'production'
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

  const [rows, setRows] = useState<AggregatedPhaseProgress[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [priceGroups, setPriceGroups] = useState<PhasePricingGroup[]>([])
  const [phaseDefaultPrices, setPhaseDefaultPrices] = useState<PhasePriceMap>({})
  const [priceStatus, setPriceStatus] = useState<FetchStatus>('idle')
  const [priceError, setPriceError] = useState<string | null>(null)
  const errorToastRef = useRef<string | null>(null)
  const priceToastRef = useRef<string | null>(null)
  const boqProjectsToastRef = useRef<string | null>(null)
  const boqItemsToastRef = useRef<string | null>(null)
  const completionToastRef = useRef<string | null>(null)

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

    const loadData = async () => {
      setStatus('loading')
      setError(null)
      try {
        const response = await fetch('/api/progress/summary', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: AggregatedPhaseProgress[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403 ? productionUnauthorized : payload.message ?? productionError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setRows(payload.phases ?? [])
        setStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setStatus('error')
        setError((fetchError as Error).message)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [locale, productionError, productionUnauthorized])

  useEffect(() => {
    let cancelled = false

    const loadPrices = async () => {
      setPriceStatus('loading')
      setPriceError(null)
      try {
        const response = await fetch('/api/value/prices', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: PhasePricingGroup[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403
              ? priceUnauthorizedMessage
              : payload.message ?? priceLoadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        const phases = payload.phases ?? []
        const defaults: PhasePriceMap = {}
        phases.forEach((phase) => {
          defaults[phase.phaseDefinitionId] = phase.defaultUnitPrice
        })
        setPhaseDefaultPrices(defaults)
        setPriceGroups(phases)
        setPriceStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setPriceStatus('error')
        setPriceError((fetchError as Error).message)
      }
    }

    loadPrices()

    return () => {
      cancelled = true
    }
  }, [locale, priceLoadError, priceUnauthorizedMessage])

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
            response.status === 403 ? productionUnauthorized : payload.message ?? productionError
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
  }, [productionError, productionUnauthorized])

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
            response.status === 403 ? productionUnauthorized : payload.message ?? productionError
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
  }, [boqSheetType, productionError, productionUnauthorized, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId || activeTab !== 'completion') return
    let cancelled = false

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
            response.status === 403
              ? productionUnauthorized
              : payload.message ?? copy.completion.messages.loadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setCompletionItems(payload.items ?? [])
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
  }, [activeTab, copy.completion.messages.loadError, productionUnauthorized, selectedProjectId])

  useEffect(() => {
    if (activeTab !== 'completion') return
    setExpandedCompletionItems(new Set())
    setCompletionDetails(new Map())
    setCompletionDetailLoading(new Set())
    setCompletionDetailErrors(new Map())
  }, [activeTab, selectedProjectId])

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
    if (status !== 'error') return
    const message = error ?? productionError
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, error, permissionDenied, productionError, status])

  useEffect(() => {
    if (permissionDenied) return
    if (priceStatus !== 'error') return
    const message = priceError ?? priceLoadError
    if (!message || message === priceToastRef.current) return
    addToast(message, { tone: 'warning' })
    priceToastRef.current = message
  }, [addToast, permissionDenied, priceError, priceLoadError, priceStatus])

  useEffect(() => {
    if (permissionDenied) return
    if (boqProjectsStatus !== 'error') return
    const message = boqProjectsError ?? productionError
    if (!message || message === boqProjectsToastRef.current) return
    addToast(message, { tone: 'danger' })
    boqProjectsToastRef.current = message
  }, [addToast, boqProjectsError, boqProjectsStatus, permissionDenied, productionError])

  useEffect(() => {
    if (permissionDenied) return
    if (boqItemsStatus !== 'error') return
    const message = boqItemsError ?? productionError
    if (!message || message === boqItemsToastRef.current) return
    addToast(message, { tone: 'danger' })
    boqItemsToastRef.current = message
  }, [addToast, boqItemsError, boqItemsStatus, permissionDenied, productionError])

  useEffect(() => {
    if (permissionDenied) return
    if (completionStatus !== 'error') return
    const message = completionError ?? copy.completion.messages.loadError
    if (!message || message === completionToastRef.current) return
    addToast(message, { tone: 'danger' })
    completionToastRef.current = message
  }, [
    addToast,
    completionError,
    completionStatus,
    copy.completion.messages.loadError,
    permissionDenied,
  ])

  const priceItemMap = useMemo(() => {
    const map = new Map<string, PhaseItem>()
    priceGroups.forEach((group) => {
      group.priceItems.forEach((item) => {
        const key = `${group.phaseDefinitionId}::${item.spec ?? ''}`
        map.set(key, item)
      })
    })
    return map
  }, [priceGroups])

  const enrichedRows = useMemo<ValueRow[]>(() => {
    const enriched = rows.map((phase) => {
      const designAmount = Math.max(0, phase.totalDesignLength)
      const completedAmount = Math.max(0, phase.totalCompletedLength)
      const specKey = phase.phaseDefinitionId
        ? `${phase.phaseDefinitionId}::${phase.spec ?? ''}`
        : ''
      const fallbackKey = phase.phaseDefinitionId ? `${phase.phaseDefinitionId}::` : ''
      const priceItem =
        priceItemMap.get(specKey) ??
        (fallbackKey ? priceItemMap.get(fallbackKey) : undefined)
      const unitPriceOverride = priceItem?.unitPrice
      const unitPrice =
        unitPriceOverride != null
          ? unitPriceOverride
          : getPhaseUnitPrice(phase.phaseDefinitionId, phase.measure, phaseDefaultPrices)
      const designValue = designAmount * unitPrice
      const completedValue = completedAmount * unitPrice
      return {
        ...phase,
        designAmount,
        completedAmount,
        unitPrice,
        designValue,
        completedValue,
      }
    })

    return enriched.sort((a, b) => {
      if (b.latestUpdatedAt !== a.latestUpdatedAt) {
        return b.latestUpdatedAt - a.latestUpdatedAt
      }
      return a.name.localeCompare(b.name, localeId)
    })
  }, [rows, localeId, priceItemMap, phaseDefaultPrices])

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

  const boqSearchTokens = useMemo(
    () => boqSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [boqSearch],
  )

  const completionSearchTokens = useMemo(
    () => completionSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [completionSearch],
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

  const headers = copy.page.tableHeaders
  const boqHeaders = copy.boq.tableHeaders
  const completionHeaders = copy.completion.tableHeaders
  const completionColumnCount = 9
  const tabTitle =
    activeTab === 'production'
      ? copy.page.title
      : activeTab === 'completion'
        ? copy.completion.title
        : copy.boq.title
  const tabDescription =
    activeTab === 'production'
      ? copy.page.description
      : activeTab === 'completion'
        ? copy.completion.description
        : copy.boq.description
  const tabItems = [
    { key: 'production', label: copy.tabs.production, href: '/value' },
    { key: 'completion', label: copy.tabs.completion, href: '/value?tab=completion' },
    { key: 'boq', label: copy.tabs.boq, href: '/value?tab=boq' },
    { key: 'manage', label: copy.tabs.manage, href: '/value/prices' },
  ] as const
  const tabs = tabItems.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: tab.href,
    active: tab.key === activeTab,
  }))

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={copy.page.messages.unauthorized}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="z-30 py-4"
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
          {activeTab === 'production' ? (
            <div className="p-6">
              <div className="space-y-2 text-sm text-slate-600">
                {status === 'loading' && (
                  <p className="text-xs text-slate-500">{copy.page.messages.loading}</p>
                )}
                {status === 'error' && (
                  <p className="text-xs text-rose-600">{error ?? copy.page.messages.error}</p>
                )}
                {status === 'success' && !enrichedRows.length && (
                  <p className="text-xs text-slate-400">{copy.page.messages.empty}</p>
                )}
                {priceStatus === 'loading' && (
                  <p className="text-xs text-slate-500">{priceLoading}</p>
                )}
                {priceStatus === 'error' && (
                  <p className="text-xs text-amber-600">{priceError ?? priceLoadError}</p>
                )}
              </div>
              {!!enrichedRows.length && status !== 'error' && (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.phase}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.spec}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.designAmount}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.unitPrice}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.designValue}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.completedAmount}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.completedValue}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">
                          {headers.percent}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {enrichedRows.map((phase) => (
                        <tr key={phase.id} className="transition hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                            {phase.name}
                          </td>
                          <td className="px-3 py-3 text-slate-500">{phase.spec ?? '—'}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(phase.designAmount, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(phase.unitPrice, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(phase.designValue, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(phase.completedAmount, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(phase.completedValue, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {phase.completedPercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

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
                    <p className="text-rose-600">
                      {boqProjectsError ?? copy.completion.messages.loadError}
                    </p>
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
                    <p className="text-rose-600">{boqProjectsError ?? copy.boq.messages.loadError}</p>
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
