'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useToast } from '@/components/ToastProvider'
import type { AggregatedPhaseProgress } from '@/lib/progressTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import type { PhasePriceItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'
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

const boqRowToneStyles: Record<BoqRowTone, string> = {
  section: 'bg-slate-100/70 text-slate-900 font-semibold',
  subsection: 'bg-slate-50/70 text-slate-700 font-medium',
  item: 'text-slate-700',
  total: 'bg-emerald-50 text-emerald-800 font-semibold',
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
  'project-danda-city': {
    label: { zh: '丹达市政路', fr: 'Voiries de Danda' },
  },
}

const allowedBoqProjectCodes = [
  'project-bondoukou-city',
  'project-danda-city',
  'project-bondoukou-border',
]
const allowedBoqProjectNames = new Set([
  '邦杜库市政路项目',
  '丹达市政路项目',
  '邦杜库边境路项目',
])
const allowedBoqProjectOrder = new Map([
  ['project-bondoukou-city', 0],
  ['project-danda-city', 1],
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

type ValueTabKey = 'production' | 'boq'

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

  const tabs: ValueTabKey[] = ['production', 'boq']
  const [activeTab, setActiveTab] = useState<ValueTabKey>('production')
  const [boqProjects, setBoqProjects] = useState<BoqProject[]>([])
  const [boqProjectsStatus, setBoqProjectsStatus] = useState<FetchStatus>('idle')
  const [boqProjectsError, setBoqProjectsError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [boqItems, setBoqItems] = useState<BoqItemRecord[]>([])
  const [boqItemsStatus, setBoqItemsStatus] = useState<FetchStatus>('idle')
  const [boqItemsError, setBoqItemsError] = useState<string | null>(null)
  const boqSheetType: BoqSheetType = 'CONTRACT'
  const [boqSearch, setBoqSearch] = useState('')
  const [boqViewMode, setBoqViewMode] = useState<'full' | 'summary'>('full')

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

  const priceItemMap = useMemo(() => {
    const map = new Map<string, PhasePriceItem>()
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
    return boqItems.map((item, index) => {
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

  const boqSearchTokens = useMemo(
    () => boqSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [boqSearch],
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

  const headers = copy.page.tableHeaders
  const boqHeaders = copy.boq.tableHeaders
  const tabTitle = activeTab === 'production' ? copy.page.title : copy.boq.title
  const tabDescription =
    activeTab === 'production' ? copy.page.description : copy.boq.description
  const tabBadge = activeTab === 'production' ? copy.card.badge : copy.tabs.boq

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
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Breadcrumbs
              variant="light"
              items={[{ label: breadcrumbHome, href: '/' }, { label: breadcrumbValue }]}
            />
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                {tabBadge}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{tabTitle}</h1>
                <p className="text-sm text-slate-600">{tabDescription}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    {copy.tabs[tab]}
                  </button>
                )
              })}
            </div>
            {activeTab === 'production' ? (
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {copy.page.unitLabel}
                </span>
                <Link
                  href="/value/prices"
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40"
                >
                  {copy.page.managePricesCta}
                </Link>
              </>
            ) : null}
            <LocaleSwitcher locale={locale} onChange={setLocale} variant="light" />
          </div>
        </div>
      </header>
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
