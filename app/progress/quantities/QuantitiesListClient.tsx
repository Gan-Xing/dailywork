'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { MultiSelectOption } from '@/components/MultiSelectFilter'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { useToast } from '@/components/ToastProvider'
import { formatProgressCopy, getProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import type {
  IntervalBoundPhaseItemDTO,
  PhaseIntervalManagementFacet,
  PhaseIntervalManagementRow,
  PhaseIntervalSortField,
  PhaseIntervalSortSpec,
} from '@/lib/phaseItemTypes'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import { ProgressHeader } from '../ProgressHeader'
import { QuantitiesDetailModal } from './QuantitiesDetailModal'

type Props = {
  canEdit: boolean
}

type SortKey = PhaseIntervalSortField

type ColumnKey =
  | 'project'
  | 'road'
  | 'phase'
  | 'startPk'
  | 'endPk'
  | 'side'
  | 'quantity'
  | 'phaseItem'
  | 'boundQuantity'
  | 'unit'
  | 'boqCode'
  | 'display'
  | 'completed'
  | 'updatedAt'

type DisplayRow = PhaseIntervalManagementRow & {
  displayLabel: string
  phaseLabel: string
  displayRoadId: number
  displayRoadName: string
  displayRoadSlug: string
  projectKey: string
  projectLabel: string
  updatedDate: string
  sideLabel: string
  completionBucket: string
  bindingStatus: 'BOUND' | 'UNBOUND'
  bindingLabel: string
}

type TableDisplayRow = {
  key: string
  row: DisplayRow
  boundItem: IntervalBoundPhaseItemDTO | null
}

type PhaseIntervalListPayload = {
  items?: PhaseIntervalManagementRow[]
  total?: number
  unfilteredTotal?: number
  page?: number
  pageSize?: number
  facets?: PhaseIntervalManagementFacet
  message?: string
}

type StoredFilters = {
  projects: string[]
  roads: string[]
  phases: string[]
  startPks: string[]
  endPks: string[]
  sides: string[]
  displays: string[]
  completions: string[]
  dates: string[]
  bindings: string[]
  quantitySources: string[]
}

const defaultFacets: PhaseIntervalManagementFacet = {
  projects: [],
  roads: [],
  phases: [],
  startPks: [],
  endPks: [],
  sides: [],
  displays: [],
  completions: [],
  updatedDates: [],
  bindings: [],
  quantitySources: [],
}

const NO_PROJECT = '__none__'
const COLUMN_STORAGE_KEY = 'progress-quantity-columns'
const FILTER_STORAGE_KEY = 'progress-quantity-filters-v1'

const defaultVisibleColumns: ColumnKey[] = [
  'road',
  'phase',
  'startPk',
  'endPk',
  'side',
  'quantity',
  'phaseItem',
  'boundQuantity',
  'unit',
  'boqCode',
  'display',
  'completed',
  'updatedAt',
]

const columnKeys: ColumnKey[] = [
  'project',
  'road',
  'phase',
  'startPk',
  'endPk',
  'side',
  'quantity',
  'phaseItem',
  'boundQuantity',
  'unit',
  'boqCode',
  'display',
  'completed',
  'updatedAt',
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200]
const BOUND_EXPORT_BATCH_LIMIT = 500
const boundColumnKeys: ColumnKey[] = ['phaseItem', 'boundQuantity', 'unit', 'boqCode']

const isSameSelection = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

const sortSelectedFirst = (options: MultiSelectOption[], selected: string[]) => {
  if (!selected.length) return options
  const selectedSet = new Set(selected)
  const selectedOptions: MultiSelectOption[] = []
  const unselectedOptions: MultiSelectOption[] = []
  options.forEach((option) => {
    if (selectedSet.has(option.value)) {
      selectedOptions.push(option)
    } else {
      unselectedOptions.push(option)
    }
  })
  return [...selectedOptions, ...unselectedOptions]
}

const buildOptions = (options: MultiSelectOption[]) => {
  const map = new Map<string, MultiSelectOption>()
  options.forEach((option) => {
    if (!map.has(option.value)) {
      map.set(option.value, option)
    }
  })
  return Array.from(map.values())
}

const formatUpdatedDate = (value: string) => value.slice(0, 10)

const getCompletionBucket = (percent: number) => {
  if (percent >= 100) return '100%'
  if (percent >= 50) return '50-99%'
  if (percent > 0) return '1-49%'
  return '0%'
}

const sideSortWeight: Record<string, number> = {
  LEFT: 1,
  RIGHT: 2,
  BOTH: 3,
}

export default function QuantitiesListClient({ canEdit }: Props) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = getProgressCopy(locale).quantitiesBoard
  const localeTag = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(localeTag, { maximumFractionDigits: 2 }),
    [localeTag],
  )
  const collator = useMemo(
    () => new Intl.Collator(localeTag, { sensitivity: 'base' }),
    [localeTag],
  )
  const displayLabels = useMemo(
    () => ({
      LINEAR: copy.options.displayLinear,
      POINT: copy.options.displayPoint,
    }),
    [copy.options.displayLinear, copy.options.displayPoint],
  )
  const sideLabels = useMemo(
    () => ({
      LEFT: copy.options.sideLeft,
      RIGHT: copy.options.sideRight,
      BOTH: copy.options.sideBoth,
    }),
    [copy.options.sideBoth, copy.options.sideLeft, copy.options.sideRight],
  )
  const bindingLabels = useMemo(
    () => ({
      BOUND: copy.options.bindingBound,
      UNBOUND: copy.options.bindingUnbound,
    }),
    [copy.options.bindingBound, copy.options.bindingUnbound],
  )
  const quantitySourceOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: 'MANUAL', label: copy.options.quantitySourceManual },
      { value: 'AUTO', label: copy.options.quantitySourceAuto },
    ],
    [copy.options.quantitySourceAuto, copy.options.quantitySourceManual],
  )
  const formatNumber = useCallback(
    (value: number, digits = 2) =>
      new Intl.NumberFormat(localeTag, { maximumFractionDigits: digits }).format(value),
    [localeTag],
  )
  const compareText = useCallback((a: string, b: string) => collator.compare(a, b), [collator])
  const [listRows, setListRows] = useState<PhaseIntervalManagementRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [unfilteredTotalRows, setUnfilteredTotalRows] = useState(0)
  const [facets, setFacets] = useState<PhaseIntervalManagementFacet>(defaultFacets)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize, setPageSize] = useState(20)
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPhaseId, setDetailPhaseId] = useState<number | null>(null)
  const [detailIntervalId, setDetailIntervalId] = useState<number | null>(null)
  const [showAllDetails, setShowAllDetails] = useState(false)
  const [boundItemsByInterval, setBoundItemsByInterval] = useState<
    Map<number, IntervalBoundPhaseItemDTO[]>
  >(() => new Map())
  const [boundLoading, setBoundLoading] = useState<Set<number>>(() => new Set())
  const [boundErrors, setBoundErrors] = useState<Map<number, string>>(() => new Map())
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [draftProjects, setDraftProjects] = useState<string[]>([])
  const [selectedRoads, setSelectedRoads] = useState<string[]>([])
  const [draftRoads, setDraftRoads] = useState<string[]>([])
  const [selectedPhases, setSelectedPhases] = useState<string[]>([])
  const [draftPhases, setDraftPhases] = useState<string[]>([])
  const [selectedStartPks, setSelectedStartPks] = useState<string[]>([])
  const [draftStartPks, setDraftStartPks] = useState<string[]>([])
  const [selectedEndPks, setSelectedEndPks] = useState<string[]>([])
  const [draftEndPks, setDraftEndPks] = useState<string[]>([])
  const [selectedSides, setSelectedSides] = useState<string[]>([])
  const [draftSides, setDraftSides] = useState<string[]>([])
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([])
  const [draftDisplays, setDraftDisplays] = useState<string[]>([])
  const [selectedCompletions, setSelectedCompletions] = useState<string[]>([])
  const [draftCompletions, setDraftCompletions] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [draftDates, setDraftDates] = useState<string[]>([])
  const [selectedBindings, setSelectedBindings] = useState<string[]>([])
  const [draftBindings, setDraftBindings] = useState<string[]>([])
  const [selectedQuantitySources, setSelectedQuantitySources] = useState<string[]>([])
  const [draftQuantitySources, setDraftQuantitySources] = useState<string[]>([])
  const [sortStack, setSortStack] = useState<PhaseIntervalSortSpec[]>([
    { field: 'updatedAt', order: 'desc' },
  ])
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [columnsReady, setColumnsReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [unbindingInputIds, setUnbindingInputIds] = useState<Set<number>>(() => new Set())
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
  const columnOptions = useMemo<Array<{ key: ColumnKey; label: string }>>(
    () => [
      { key: 'project', label: copy.columns.project },
      { key: 'road', label: copy.columns.road },
      { key: 'phase', label: copy.columns.phase },
      { key: 'startPk', label: copy.columns.startPk },
      { key: 'endPk', label: copy.columns.endPk },
      { key: 'side', label: copy.columns.side },
      { key: 'quantity', label: copy.columns.quantity },
      { key: 'phaseItem', label: copy.columns.phaseItem },
      { key: 'boundQuantity', label: copy.columns.boundQuantity },
      { key: 'unit', label: copy.columns.unit },
      { key: 'boqCode', label: copy.columns.boqCode },
      { key: 'display', label: copy.columns.display },
      { key: 'completed', label: copy.columns.completed },
      { key: 'updatedAt', label: copy.columns.updatedAt },
    ],
    [copy.columns],
  )

  const mapRowToDisplayRow = useCallback(
    (row: PhaseIntervalManagementRow): DisplayRow => {
      const projectKey = row.projectId ? String(row.projectId) : NO_PROJECT
      const unboundProjectLabel = copy.options.projectUnbound
      const projectLabel = row.projectName
        ? row.projectCode
          ? `${row.projectName} (${row.projectCode})`
          : row.projectName
        : unboundProjectLabel
      const displayRoadId = row.locationRoadId ?? row.roadId
      const displayRoadName = row.locationRoadName ?? row.roadName
      const displayRoadSlug = row.locationRoadSlug ?? row.roadSlug
      const completedPercent = Math.min(100, Math.max(0, row.completedPercent ?? 0))
      const bindingStatus = row.hasBoundItems ? 'BOUND' : 'UNBOUND'
      const phaseLabel = localizeProgressTerm('phase', row.phaseName, locale)
      return {
        ...row,
        displayLabel: displayLabels[row.measure] ?? row.measure,
        phaseLabel,
        displayRoadId,
        displayRoadName,
        displayRoadSlug,
        projectKey,
        projectLabel,
        updatedDate: formatUpdatedDate(row.updatedAt),
        sideLabel: sideLabels[row.side] ?? row.side,
        completionBucket: getCompletionBucket(completedPercent),
        bindingStatus,
        bindingLabel: bindingLabels[bindingStatus],
      }
    },
    [bindingLabels, copy.options.projectUnbound, displayLabels, locale, sideLabels],
  )

  const rowsWithMeta = useMemo<DisplayRow[]>(
    () => listRows.map((row) => mapRowToDisplayRow(row)),
    [listRows, mapRowToDisplayRow],
  )

  const projectOptions = useMemo(
    () =>
      buildOptions(
        facets.projects.map((project) => ({
          value: project.key,
          label: project.projectName
            ? project.projectCode
              ? `${project.projectName} (${project.projectCode})`
              : project.projectName
            : copy.options.projectUnbound,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [compareText, copy.options.projectUnbound, facets.projects],
  )
  const roadOptions = useMemo(
    () =>
      buildOptions(
        facets.roads.map((road) => ({
          value: String(road.id),
          label: `${road.name}（${road.slug}）`,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [compareText, facets.roads],
  )
  const phaseOptions = useMemo(
    () =>
      buildOptions(
        facets.phases.map((phaseName) => ({
          value: phaseName,
          label: localizeProgressTerm('phase', phaseName, locale),
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [compareText, facets.phases, locale],
  )
  const startPkOptions = useMemo(
    () =>
      buildOptions(
        facets.startPks.map((startPk) => ({
          value: String(startPk),
          label: formatNumber(startPk, 3),
        })),
      ).sort((a, b) => Number(a.value) - Number(b.value)),
    [facets.startPks, formatNumber],
  )
  const endPkOptions = useMemo(
    () =>
      buildOptions(
        facets.endPks.map((endPk) => ({
          value: String(endPk),
          label: formatNumber(endPk, 3),
        })),
      ).sort((a, b) => Number(a.value) - Number(b.value)),
    [facets.endPks, formatNumber],
  )
  const sideOptions = useMemo(
    () =>
      buildOptions(
        facets.sides.map((side) => ({
          value: side,
          label: sideLabels[side] ?? side,
        })),
      ).sort((a, b) => (sideSortWeight[a.value] ?? 99) - (sideSortWeight[b.value] ?? 99)),
    [facets.sides, sideLabels],
  )
  const displayOptions = useMemo(
    () =>
      buildOptions(
        facets.displays.map((display) => ({
          value: display,
          label: displayLabels[display] ?? display,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [compareText, displayLabels, facets.displays],
  )
  const completionOptions = useMemo(
    () =>
      buildOptions(
        facets.completions.map((completionBucket) => ({
          value: completionBucket,
          label: completionBucket,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [compareText, facets.completions],
  )
  const bindingOptions = useMemo(
    () =>
      buildOptions(
        facets.bindings.map((bindingStatus) => ({
          value: bindingStatus,
          label: bindingLabels[bindingStatus] ?? bindingStatus,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [bindingLabels, compareText, facets.bindings],
  )
  const updatedOptions = useMemo(
    () =>
      buildOptions(
        facets.updatedDates.map((updatedDate) => ({
          value: updatedDate,
          label: updatedDate,
        })),
      ).sort((a, b) => b.value.localeCompare(a.value)),
    [facets.updatedDates],
  )

  const filterControlProps = {
    allLabel: copy.filters.all,
    selectedLabel: (count: number) =>
      formatProgressCopy(copy.filters.selected, { count }),
    selectAllLabel: copy.filters.selectAll,
    clearLabel: copy.filters.clear,
    noOptionsLabel: copy.filters.noOptions,
    searchPlaceholder: copy.filters.search,
  }
  const sharedFilterProps = { ...filterControlProps, className: 'w-full text-slate-700' }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<StoredFilters>
      const toArray = (value: unknown) =>
        Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
      setSelectedProjects(toArray(parsed.projects))
      setSelectedRoads(toArray(parsed.roads))
      setSelectedPhases(toArray(parsed.phases))
      setSelectedStartPks(toArray(parsed.startPks))
      setSelectedEndPks(toArray(parsed.endPks))
      setSelectedSides(toArray(parsed.sides))
      setSelectedDisplays(toArray(parsed.displays))
      setSelectedCompletions(toArray(parsed.completions))
      setSelectedDates(toArray(parsed.dates))
      setSelectedBindings(toArray(parsed.bindings))
      setSelectedQuantitySources(toArray(parsed.quantitySources))
    } catch {
      // ignore
    } finally {
      setFiltersHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    const next: StoredFilters = {
      projects: selectedProjects,
      roads: selectedRoads,
      phases: selectedPhases,
      startPks: selectedStartPks,
      endPks: selectedEndPks,
      sides: selectedSides,
      displays: selectedDisplays,
      completions: selectedCompletions,
      dates: selectedDates,
      bindings: selectedBindings,
      quantitySources: selectedQuantitySources,
    }
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [
    filtersHydrated,
    selectedBindings,
    selectedCompletions,
    selectedDates,
    selectedDisplays,
    selectedEndPks,
    selectedPhases,
    selectedProjects,
    selectedQuantitySources,
    selectedRoads,
    selectedSides,
    selectedStartPks,
  ])

  const buildQueryParams = useCallback(
    (overrides?: { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams()
      sortStack.forEach((spec) => params.append('sort', `${spec.field}:${spec.order}`))
      selectedProjects.forEach((value) => params.append('project', value))
      selectedRoads.forEach((value) => params.append('roadId', value))
      selectedPhases.forEach((value) => params.append('phase', value))
      selectedStartPks.forEach((value) => params.append('startPk', value))
      selectedEndPks.forEach((value) => params.append('endPk', value))
      selectedSides.forEach((value) => params.append('side', value))
      selectedDisplays.forEach((value) => params.append('display', value))
      selectedCompletions.forEach((value) => params.append('completed', value))
      selectedBindings.forEach((value) => params.append('binding', value))
      selectedQuantitySources.forEach((value) => params.append('quantitySource', value))
      selectedDates.forEach((value) => params.append('updatedAt', value))
      params.set('page', String(overrides?.page ?? page))
      params.set('pageSize', String(overrides?.pageSize ?? pageSize))
      return params
    },
    [
      page,
      pageSize,
      selectedBindings,
      selectedCompletions,
      selectedDates,
      selectedDisplays,
      selectedEndPks,
      selectedPhases,
      selectedProjects,
      selectedQuantitySources,
      selectedRoads,
      selectedSides,
      selectedStartPks,
      sortStack,
    ],
  )

  useEffect(() => {
    if (!filtersHydrated) return
    let stopped = false
    const controller = new AbortController()

    const loadRows = async () => {
      setListLoading(true)
      setListError(null)
      try {
        const query = buildQueryParams().toString()
        const response = await fetch(
          query ? `/api/progress/quantities?${query}` : '/api/progress/quantities',
          {
            credentials: 'include',
            signal: controller.signal,
          },
        )
        const payload = (await response.json().catch(() => ({}))) as PhaseIntervalListPayload
        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.message ?? copy.messages.listLoadFailed)
        }
        if (!stopped) {
          setListRows(payload.items)
          setTotalRows(payload.total ?? payload.items.length)
          setUnfilteredTotalRows(payload.unfilteredTotal ?? payload.total ?? payload.items.length)
          setFacets(payload.facets ?? defaultFacets)
          if (typeof payload.page === 'number' && Number.isFinite(payload.page)) {
            setPage(payload.page)
          }
          if (typeof payload.pageSize === 'number' && Number.isFinite(payload.pageSize)) {
            setPageSize(payload.pageSize)
          }
        }
      } catch (error) {
        if (!stopped && (error as Error).name !== 'AbortError') {
          setListError((error as Error).message ?? copy.messages.listLoadFailed)
        }
      } finally {
        if (!stopped) {
          setListLoading(false)
        }
      }
    }

    void loadRows()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [buildQueryParams, copy.messages.listLoadFailed, filtersHydrated])

  const sortedRows = rowsWithMeta
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(pageSize, 1)))

  const hasPendingFilterChanges = useMemo(
    () =>
      !isSameSelection(draftProjects, selectedProjects) ||
      !isSameSelection(draftRoads, selectedRoads) ||
      !isSameSelection(draftPhases, selectedPhases) ||
      !isSameSelection(draftStartPks, selectedStartPks) ||
      !isSameSelection(draftEndPks, selectedEndPks) ||
      !isSameSelection(draftSides, selectedSides) ||
      !isSameSelection(draftDisplays, selectedDisplays) ||
      !isSameSelection(draftCompletions, selectedCompletions) ||
      !isSameSelection(draftBindings, selectedBindings) ||
      !isSameSelection(draftQuantitySources, selectedQuantitySources) ||
      !isSameSelection(draftDates, selectedDates),
    [
      draftBindings,
      draftCompletions,
      draftDates,
      draftDisplays,
      draftEndPks,
      draftPhases,
      draftProjects,
      draftQuantitySources,
      draftRoads,
      draftSides,
      draftStartPks,
      selectedBindings,
      selectedCompletions,
      selectedDates,
      selectedDisplays,
      selectedEndPks,
      selectedPhases,
      selectedProjects,
      selectedQuantitySources,
      selectedRoads,
      selectedSides,
      selectedStartPks,
    ],
  )

  const applyDraftFilters = useCallback(() => {
    setSelectedProjects(draftProjects)
    setSelectedRoads(draftRoads)
    setSelectedPhases(draftPhases)
    setSelectedStartPks(draftStartPks)
    setSelectedEndPks(draftEndPks)
    setSelectedSides(draftSides)
    setSelectedDisplays(draftDisplays)
    setSelectedCompletions(draftCompletions)
    setSelectedBindings(draftBindings)
    setSelectedQuantitySources(draftQuantitySources)
    setSelectedDates(draftDates)
    setPage(1)
    setPageInput('1')
  }, [
    draftBindings,
    draftCompletions,
    draftDates,
    draftDisplays,
    draftEndPks,
    draftPhases,
    draftProjects,
    draftQuantitySources,
    draftRoads,
    draftSides,
    draftStartPks,
  ])

  const resetAllFilters = useCallback(() => {
    const empty: string[] = []
    setDraftProjects(empty)
    setDraftRoads(empty)
    setDraftPhases(empty)
    setDraftStartPks(empty)
    setDraftEndPks(empty)
    setDraftSides(empty)
    setDraftDisplays(empty)
    setDraftCompletions(empty)
    setDraftBindings(empty)
    setDraftQuantitySources(empty)
    setDraftDates(empty)
    setSelectedProjects(empty)
    setSelectedRoads(empty)
    setSelectedPhases(empty)
    setSelectedStartPks(empty)
    setSelectedEndPks(empty)
    setSelectedSides(empty)
    setSelectedDisplays(empty)
    setSelectedCompletions(empty)
    setSelectedBindings(empty)
    setSelectedQuantitySources(empty)
    setSelectedDates(empty)
    setPage(1)
    setPageInput('1')
  }, [])

  const handleSort = (key: SortKey) => {
    setSortStack((prev) => {
      const existing = prev.find((item) => item.field === key)
      const nextOrder: 'asc' | 'desc' = existing ? (existing.order === 'asc' ? 'desc' : 'asc') : 'desc'
      const filtered = prev.filter((item) => item.field !== key)
      return [{ field: key, order: nextOrder }, ...filtered].slice(0, 4)
    })
    setPage(1)
    setPageInput('1')
  }

  const onPageChange = useCallback((next: number) => {
    const safe = Math.min(totalPages, Math.max(1, next))
    setPage(safe)
    setPageInput(String(safe))
  }, [totalPages])

  const onPageSizeChange = useCallback((next: number) => {
    if (!Number.isFinite(next) || next <= 0) return
    setPageSize(next)
    setPage(1)
    setPageInput('1')
  }, [])

  const renderSortIcon = (key: SortKey) => {
    const idx = sortStack.findIndex((item) => item.field === key)
    if (idx === -1) return <span className="text-[10px] text-slate-400">↕</span>
    const arrow = sortStack[idx].order === 'asc' ? '↑' : '↓'
    return <span className="text-[10px] text-emerald-600">{`${arrow}${idx + 1}`}</span>
  }

  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)
  const needsBoundColumns = boundColumnKeys.some((key) => isVisible(key))
  const shouldLoadBoundItems = needsBoundColumns || showAllDetails

  const formatBoundItemName = useCallback(
    (item: IntervalBoundPhaseItemDTO) => {
      return item.phaseItemName?.trim() || item.phaseItemSpec?.trim() || '—'
    },
    [],
  )

  const formatBoundQuantityValue = useCallback(
    (item: IntervalBoundPhaseItemDTO) => {
      if (item.effectiveQuantity === null) return '—'
      const quantity = formatNumber(item.effectiveQuantity, 3)
      return item.manualQuantity !== null
        ? formatProgressCopy(copy.export.quantityWithManual, { value: quantity })
        : quantity
    },
    [copy.export.quantityWithManual, formatNumber],
  )

  const tableRows = useMemo<TableDisplayRow[]>(() => {
    const next: TableDisplayRow[] = []
    sortedRows.forEach((row) => {
      const boundItems = boundItemsByInterval.get(row.intervalId) ?? []
      if (showAllDetails && boundItems.length > 0) {
        boundItems.forEach((item) => {
          next.push({
            key: `${row.intervalId}-${item.inputId}`,
            row,
            boundItem: item,
          })
        })
        return
      }
      next.push({
        key: `${row.intervalId}-${showAllDetails ? 'empty' : 'summary'}`,
        row,
        boundItem: showAllDetails ? null : boundItems[0] ?? null,
      })
    })
    return next
  }, [boundItemsByInterval, showAllDetails, sortedRows])

  const persistVisibleColumns = (next: ColumnKey[]) => {
    setVisibleColumns(next)
  }

  const handleSelectAllColumns = () =>
    persistVisibleColumns(columnOptions.map((option) => option.key))
  const handleRestoreDefaultColumns = () => persistVisibleColumns([...defaultVisibleColumns])
  const handleClearColumns = () => persistVisibleColumns([])

  const toggleColumnVisibility = (key: ColumnKey) => {
    persistVisibleColumns(
      visibleColumns.includes(key)
        ? visibleColumns.filter((item) => item !== key)
        : [...visibleColumns, key],
    )
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        const filtered = (Array.isArray(parsed)
          ? parsed.filter((item) => typeof item === 'string')
          : []) as ColumnKey[]
        const valid = filtered.filter((item) => columnOptions.some((opt) => opt.key === item))
        setVisibleColumns(valid.length ? valid : [...defaultVisibleColumns])
      } else {
        setVisibleColumns([...defaultVisibleColumns])
      }
    } catch {
      setVisibleColumns([...defaultVisibleColumns])
    } finally {
      setColumnsReady(true)
    }
  }, [columnOptions])

  useEffect(() => {
    if (!columnsReady) return
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns))
    } catch {
      // ignore
    }
  }, [columnsReady, visibleColumns])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    setDraftProjects(selectedProjects)
  }, [selectedProjects])
  useEffect(() => {
    setDraftRoads(selectedRoads)
  }, [selectedRoads])
  useEffect(() => {
    setDraftPhases(selectedPhases)
  }, [selectedPhases])
  useEffect(() => {
    setDraftStartPks(selectedStartPks)
  }, [selectedStartPks])
  useEffect(() => {
    setDraftEndPks(selectedEndPks)
  }, [selectedEndPks])
  useEffect(() => {
    setDraftSides(selectedSides)
  }, [selectedSides])
  useEffect(() => {
    setDraftDisplays(selectedDisplays)
  }, [selectedDisplays])
  useEffect(() => {
    setDraftCompletions(selectedCompletions)
  }, [selectedCompletions])
  useEffect(() => {
    setDraftBindings(selectedBindings)
  }, [selectedBindings])
  useEffect(() => {
    setDraftQuantitySources(selectedQuantitySources)
  }, [selectedQuantitySources])
  useEffect(() => {
    setDraftDates(selectedDates)
  }, [selectedDates])

  const columnCount = visibleColumns.length + 1

  const openDetail = (phaseId: number, intervalId: number) => {
    setDetailPhaseId(phaseId)
    setDetailIntervalId(intervalId)
    setDetailOpen(true)
  }

  const fetchBoundItemsForExport = useCallback(
    async (intervalIds: number[]) => {
      const uniqueIds = Array.from(
        new Set(intervalIds.filter((id) => Number.isInteger(id) && id > 0)),
      )
      const map = new Map<number, IntervalBoundPhaseItemDTO[]>()
      if (!uniqueIds.length) return map
      for (let start = 0; start < uniqueIds.length; start += BOUND_EXPORT_BATCH_LIMIT) {
        const chunk = uniqueIds.slice(start, start + BOUND_EXPORT_BATCH_LIMIT)
        const response = await fetch('/api/progress/quantities/bound-items/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ intervalIds: chunk }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          itemsByInterval?: Record<string, IntervalBoundPhaseItemDTO[]>
          message?: string
        }
        if (!response.ok) {
          throw new Error(payload.message ?? copy.messages.boundLoadFailed)
        }
        const itemsByInterval = payload.itemsByInterval ?? {}
        chunk.forEach((id) => {
          const items = itemsByInterval[String(id)]
          map.set(id, Array.isArray(items) ? items : [])
        })
      }
      return map
    },
    [copy.messages.boundLoadFailed],
  )

  const handleExportExcel = async () => {
    if (exporting) return
    try {
      const selectedColumns = columnOptions.filter((option) => visibleColumns.includes(option.key))
      if (selectedColumns.length === 0) {
        addToast(copy.export.missingColumns, { tone: 'warning' })
        return
      }
      if (!totalRows) {
        addToast(copy.export.noData, { tone: 'warning' })
        return
      }

      setExporting(true)
      const exportPageSize = 200
      const expectedPages = Math.max(1, Math.ceil(totalRows / exportPageSize))
      const exportRows: DisplayRow[] = []
      for (let exportPage = 1; exportPage <= expectedPages; exportPage += 1) {
        const params = buildQueryParams({ page: exportPage, pageSize: exportPageSize })
        const response = await fetch(`/api/progress/quantities?${params.toString()}`, {
          credentials: 'include',
        })
        const payload = (await response.json().catch(() => ({}))) as PhaseIntervalListPayload
        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.message ?? copy.export.failed)
        }
        payload.items.forEach((row) => {
          exportRows.push(mapRowToDisplayRow(row))
        })
      }
      if (!exportRows.length) {
        addToast(copy.export.noData, { tone: 'warning' })
        return
      }

      const needsBoundRows = selectedColumns.some((column) =>
        boundColumnKeys.includes(column.key),
      )
      let exportTableRows: TableDisplayRow[] = exportRows.map((row) => ({
        key: `${row.intervalId}-summary`,
        row,
        boundItem: null,
      }))

      if (needsBoundRows) {
        const boundMap = await fetchBoundItemsForExport(exportRows.map((row) => row.intervalId))
        exportTableRows = exportRows.flatMap<TableDisplayRow>((row) => {
          const boundItems = boundMap.get(row.intervalId) ?? []
          if (boundItems.length === 0) {
            return [
              {
                key: `${row.intervalId}-empty`,
                row,
                boundItem: null,
              },
            ]
          }
          return boundItems.map((item) => ({
            key: `${row.intervalId}-${item.inputId}`,
            row,
            boundItem: item,
          }))
        })
      }

      const XLSX = await import('xlsx')
      const headerRow = selectedColumns.map((column) => {
        switch (column.key) {
          case 'project':
            return copy.columns.project
          case 'road':
            return copy.columns.road
          case 'phase':
            return copy.columns.phase
          case 'startPk':
            return copy.columns.startPk
          case 'endPk':
            return copy.columns.endPk
          case 'side':
            return copy.columns.side
          case 'quantity':
            return copy.columns.quantity
          case 'phaseItem':
            return copy.columns.phaseItem
          case 'boundQuantity':
            return copy.columns.boundQuantity
          case 'unit':
            return copy.columns.unit
          case 'boqCode':
            return copy.columns.boqCode
          case 'display':
            return copy.columns.display
          case 'completed':
            return copy.columns.completed
          case 'updatedAt':
            return copy.columns.updatedAt
          default:
            return column.label
        }
      })
      const dataRows = exportTableRows.map(({ row, boundItem }) =>
        selectedColumns.map((column) => {
          switch (column.key) {
            case 'project':
              return row.projectLabel
            case 'road':
              return `${row.displayRoadName} (${row.displayRoadSlug})`
            case 'phase':
              return `${row.phaseLabel}${row.spec ? ` (${row.spec})` : ''}`
            case 'startPk':
              return formatNumber(row.startPk, 3)
            case 'endPk':
              return formatNumber(row.endPk, 3)
            case 'side':
              return row.sideLabel
            case 'quantity': {
              const quantity = formatNumber(row.quantity, 3)
              return row.quantityOverridden
                ? formatProgressCopy(copy.export.quantityWithManual, { value: quantity })
                : quantity
            }
            case 'phaseItem':
              return boundItem ? formatBoundItemName(boundItem) : ''
            case 'boundQuantity':
              return boundItem ? formatBoundQuantityValue(boundItem) : ''
            case 'unit':
              return boundItem?.unit ?? ''
            case 'boqCode':
              return boundItem?.boqCode ?? ''
            case 'display':
              return row.displayLabel
            case 'completed':
              return `${Math.min(100, Math.max(0, row.completedPercent))}%`
            case 'updatedAt':
              return new Date(row.updatedAt).toLocaleString(localeTag, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            default:
              return ''
          }
        }),
      )
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, copy.export.sheetName)
      const filename = `${copy.export.filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (error) {
      addToast((error as Error).message || copy.export.failed, { tone: 'danger' })
    } finally {
      setExporting(false)
    }
  }

  const unbindInput = async (intervalId: number, inputId: number) => {
    if (!canEdit) return
    if (unbindingInputIds.has(inputId)) return
    setUnbindingInputIds((prev) => {
      const next = new Set(prev)
      next.add(inputId)
      return next
    })
    try {
      const response = await fetch(`/api/progress/quantities/input?inputId=${inputId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? copy.messages.unbindFailed)
      }
      setBoundItemsByInterval((prev) => {
        const next = new Map(prev)
        const current = next.get(intervalId) ?? []
        next.set(
          intervalId,
          current.filter((item) => item.inputId !== inputId),
        )
        return next
      })
      addToast(copy.messages.unbindSuccess, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? copy.messages.unbindFailed, { tone: 'danger' })
    } finally {
      setUnbindingInputIds((prev) => {
        const next = new Set(prev)
        next.delete(inputId)
        return next
      })
    }
  }

  const loadBoundItemsBatch = useCallback(
    async (intervalIds: number[]) => {
      const uniqueIds = Array.from(
        new Set(intervalIds.filter((id) => Number.isInteger(id) && id > 0)),
      )
      const pending = uniqueIds.filter(
        (id) => !boundItemsByInterval.has(id) && !boundLoading.has(id),
      )
      if (!pending.length) return
      setBoundLoading((prev) => {
        const next = new Set(prev)
        pending.forEach((id) => next.add(id))
        return next
      })
      setBoundErrors((prev) => {
        const next = new Map(prev)
        pending.forEach((id) => next.delete(id))
        return next
      })
      try {
        const merged = new Map<number, IntervalBoundPhaseItemDTO[]>()
        for (let start = 0; start < pending.length; start += BOUND_EXPORT_BATCH_LIMIT) {
          const chunk = pending.slice(start, start + BOUND_EXPORT_BATCH_LIMIT)
          const response = await fetch('/api/progress/quantities/bound-items/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ intervalIds: chunk }),
          })
          const payload = (await response.json().catch(() => ({}))) as {
            itemsByInterval?: Record<string, IntervalBoundPhaseItemDTO[]>
            message?: string
          }
          if (!response.ok) {
            throw new Error(payload.message ?? copy.messages.boundLoadFailed)
          }
          const itemsByInterval = payload.itemsByInterval ?? {}
          chunk.forEach((id) => {
            const items = itemsByInterval[String(id)]
            merged.set(id, Array.isArray(items) ? items : [])
          })
        }

        setBoundItemsByInterval((prev) => {
          const next = new Map(prev)
          pending.forEach((id) => {
            next.set(id, merged.get(id) ?? [])
          })
          return next
        })
      } catch (error) {
        setBoundErrors((prev) => {
          const next = new Map(prev)
          pending.forEach((id) => next.set(id, (error as Error).message ?? copy.bound.loadFailed))
          return next
        })
      } finally {
        setBoundLoading((prev) => {
          const next = new Set(prev)
          pending.forEach((id) => next.delete(id))
          return next
        })
      }
    },
    [boundItemsByInterval, boundLoading, copy.bound.loadFailed, copy.messages.boundLoadFailed],
  )

  useEffect(() => {
    if (!shouldLoadBoundItems) return
    void loadBoundItemsBatch(sortedRows.map((row) => row.intervalId))
  }, [loadBoundItemsBatch, shouldLoadBoundItems, sortedRows])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title={copy.title}
        subtitle={copy.description}
        breadcrumbs={[
          { label: copy.breadcrumb.home, href: '/' },
          { label: copy.breadcrumb.progress, href: '/progress' },
          { label: copy.breadcrumb.current },
        ]}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <span>
              {formatProgressCopy(copy.summary.totalFiltered, {
                total: unfilteredTotalRows,
                filtered: totalRows,
              })}
            </span>
            {listLoading ? <span className="text-xs text-slate-500">{copy.summary.sortedLoading}</span> : null}
            {listError ? <span className="text-xs text-rose-600">{listError}</span> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllDetails((prev) => !prev)}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {showAllDetails ? copy.actions.collapseDetails : copy.actions.expandDetails}
              </button>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exporting}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? copy.actions.exporting : copy.actions.exportExcel}
              </button>
              <div className="relative" ref={columnSelectorRef}>
              <button
                type="button"
                className="flex min-w-[140px] items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setShowColumnSelector((prev) => !prev)}
              >
                <span className="truncate">
                  {visibleColumns.length
                    ? formatProgressCopy(copy.actions.selectedColumns, { count: visibleColumns.length })
                    : copy.actions.noColumns}
                </span>
                <span className="text-xs text-slate-400">⌕</span>
              </button>
              {showColumnSelector ? (
                <div className="absolute right-0 z-10 mt-2 w-80 max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] text-slate-600">
                    <button className="text-emerald-600 hover:underline" onClick={handleSelectAllColumns}>
                      {copy.actions.selectAll}
                    </button>
                    <div className="flex gap-2">
                      <button className="text-slate-500 hover:underline" onClick={handleRestoreDefaultColumns}>
                        {copy.actions.restoreDefault}
                      </button>
                      <button className="text-slate-500 hover:underline" onClick={handleClearColumns}>
                        {copy.actions.clear}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-xs text-slate-700">
                    {columnOptions.map((option) => (
                      <label
                        key={option.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 bg-white accent-emerald-500"
                          checked={visibleColumns.includes(option.key)}
                          onChange={() => toggleColumnVisibility(option.key)}
                        />
                        <span className="break-words whitespace-normal">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MultiSelectFilter
                label={copy.filters.project}
                options={sortSelectedFirst(projectOptions, draftProjects)}
                selected={draftProjects}
                onChange={setDraftProjects}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.road}
                options={sortSelectedFirst(roadOptions, draftRoads)}
                selected={draftRoads}
                onChange={setDraftRoads}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.phase}
                options={sortSelectedFirst(phaseOptions, draftPhases)}
                selected={draftPhases}
                onChange={setDraftPhases}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.startPk}
                options={sortSelectedFirst(startPkOptions, draftStartPks)}
                selected={draftStartPks}
                onChange={setDraftStartPks}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.endPk}
                options={sortSelectedFirst(endPkOptions, draftEndPks)}
                selected={draftEndPks}
                onChange={setDraftEndPks}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.side}
                options={sortSelectedFirst(sideOptions, draftSides)}
                selected={draftSides}
                onChange={setDraftSides}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.display}
                options={sortSelectedFirst(displayOptions, draftDisplays)}
                selected={draftDisplays}
                onChange={setDraftDisplays}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.completed}
                options={sortSelectedFirst(completionOptions, draftCompletions)}
                selected={draftCompletions}
                onChange={setDraftCompletions}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.binding}
                options={sortSelectedFirst(bindingOptions, draftBindings)}
                selected={draftBindings}
                onChange={setDraftBindings}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.quantitySource}
                options={sortSelectedFirst(quantitySourceOptions, draftQuantitySources)}
                selected={draftQuantitySources}
                onChange={setDraftQuantitySources}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label={copy.filters.updatedAt}
                options={sortSelectedFirst(updatedOptions, draftDates)}
                selected={draftDates}
                onChange={setDraftDates}
                {...sharedFilterProps}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {copy.filters.reset}
              </button>
              <button
                type="button"
                onClick={applyDraftFilters}
                disabled={!hasPendingFilterChanges}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.filters.apply}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    {isVisible('project') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('project')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.project}
                          {renderSortIcon('project')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('road') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('road')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.road}
                          {renderSortIcon('road')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('phase') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('phase')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.phase}
                          {renderSortIcon('phase')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('startPk') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('startPk')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.startPk}
                          {renderSortIcon('startPk')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('endPk') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('endPk')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.endPk}
                          {renderSortIcon('endPk')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('side') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('side')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.side}
                          {renderSortIcon('side')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('quantity') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('quantity')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.quantity}
                          {renderSortIcon('quantity')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('phaseItem') ? (
                      <th className="px-4 py-3 text-left">{copy.columns.phaseItem}</th>
                    ) : null}
                    {isVisible('boundQuantity') ? (
                      <th className="px-4 py-3 text-left">{copy.columns.boundQuantity}</th>
                    ) : null}
                    {isVisible('unit') ? (
                      <th className="px-4 py-3 text-left">{copy.columns.unit}</th>
                    ) : null}
                    {isVisible('boqCode') ? (
                      <th className="px-4 py-3 text-left">{copy.columns.boqCode}</th>
                    ) : null}
                    {isVisible('display') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('display')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.display}
                          {renderSortIcon('display')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('completed') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('completed')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.completed}
                          {renderSortIcon('completed')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('updatedAt') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('updatedAt')}
                          className="flex items-center gap-2 text-left"
                        >
                          {copy.columns.updatedAt}
                          {renderSortIcon('updatedAt')}
                        </button>
                      </th>
                    ) : null}
                    <th className="px-4 py-3 text-right whitespace-nowrap">{copy.columns.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-500">
                        {copy.summary.empty}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map(({ key, row, boundItem }) => {
                      const percent = Math.min(100, Math.max(0, row.completedPercent))
                      const boundItems = boundItemsByInterval.get(row.intervalId) ?? []
                      const boundError = boundErrors.get(row.intervalId) ?? null
                      const isBoundLoading = shouldLoadBoundItems && boundLoading.has(row.intervalId)
                      const summaryItem =
                        !showAllDetails && !boundItem && boundItems.length > 1
                          ? boundItems[0] ?? null
                          : null
                      const displayBoundItem = boundItem ?? summaryItem
                      const hasSingleBound = !showAllDetails && boundItems.length === 1
                      const unbindTarget = showAllDetails ? boundItem : hasSingleBound ? boundItems[0] : null
                      return (
                        <tr key={key} className="text-slate-700">
                          {isVisible('project') ? (
                            <td className="px-4 py-3 text-slate-600">{row.projectLabel}</td>
                          ) : null}
                          {isVisible('road') ? (
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.displayRoadName}</div>
                              <div className="text-xs text-slate-500">{row.displayRoadSlug}</div>
                            </td>
                          ) : null}
                          {isVisible('phase') ? (
                            <td className="px-4 py-3">
                              {row.phaseLabel}
                              {row.spec ? ` (${row.spec})` : ''}
                            </td>
                          ) : null}
                          {isVisible('startPk') ? (
                            <td className="px-4 py-3 text-slate-600">{formatNumber(row.startPk, 3)}</td>
                          ) : null}
                          {isVisible('endPk') ? (
                            <td className="px-4 py-3 text-slate-600">{formatNumber(row.endPk, 3)}</td>
                          ) : null}
                          {isVisible('side') ? (
                            <td className="px-4 py-3 text-slate-600">{row.sideLabel}</td>
                          ) : null}
                          {isVisible('quantity') ? (
                            <td className="px-4 py-3 text-slate-600">
                              <div className="flex items-center gap-2">
                                <span>{formatNumber(row.quantity, 3)}</span>
                                {row.quantityOverridden ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    {copy.badges.manual}
                                  </span>
                                ) : null}
                              </div>
                              {row.quantityOverridden ? (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  PK diff {formatNumber(row.rawQuantity, 3)}
                                </div>
                              ) : null}
                            </td>
                          ) : null}
                          {isVisible('phaseItem') ? (
                            <td className="px-4 py-3 text-slate-600">
                              {isBoundLoading ? (
                                <span className="text-slate-500">{copy.bound.loading}</span>
                              ) : boundError ? (
                                <span className="text-rose-600">{boundError}</span>
                              ) : displayBoundItem ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-900">
                                    {formatBoundItemName(displayBoundItem)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                          {isVisible('boundQuantity') ? (
                            <td className="px-4 py-3 text-slate-600">
                              {isBoundLoading ? (
                                <span className="text-slate-500">{copy.bound.loading}</span>
                              ) : boundError ? (
                                <span className="text-rose-600">{boundError}</span>
                              ) : displayBoundItem ? (
                                <div className="space-y-1">
                                  <div className="tabular-nums">
                                    {formatBoundQuantityValue(displayBoundItem)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                          {isVisible('unit') ? (
                            <td className="px-4 py-3 text-slate-600">
                              {isBoundLoading ? (
                                <span className="text-slate-500">{copy.bound.loading}</span>
                              ) : boundError ? (
                                <span className="text-rose-600">{boundError}</span>
                              ) : displayBoundItem ? (
                                displayBoundItem.unit ?? '—'
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                          {isVisible('boqCode') ? (
                            <td className="px-4 py-3 text-slate-600">
                              {isBoundLoading ? (
                                <span className="text-slate-500">{copy.bound.loading}</span>
                              ) : boundError ? (
                                <span className="text-rose-600">{boundError}</span>
                              ) : displayBoundItem ? (
                                displayBoundItem.boqCode ?? '—'
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                          {isVisible('display') ? (
                            <td className="px-4 py-3 text-slate-600">{row.displayLabel}</td>
                          ) : null}
                          {isVisible('completed') ? (
                            <td className="px-4 py-3 text-slate-600">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 rounded-full bg-slate-200">
                                  <div
                                    className="h-1.5 rounded-full bg-emerald-400"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span>{percent}%</span>
                              </div>
                            </td>
                          ) : null}
                          {isVisible('updatedAt') ? (
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(row.updatedAt).toLocaleString(localeTag, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                          ) : null}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(row.phaseId, row.intervalId)}
                                className="inline-flex items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              >
                                {copy.actions.enterDetail}
                              </button>
                              {unbindTarget ? (
                                canEdit ? (
                                  <button
                                    type="button"
                                    disabled={unbindingInputIds.has(unbindTarget.inputId)}
                                    onClick={() => unbindInput(row.intervalId, unbindTarget.inputId)}
                                    className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {unbindingInputIds.has(unbindTarget.inputId)
                                      ? copy.actions.unbinding
                                      : copy.actions.unbind}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">{copy.actions.noPermission}</span>
                                )
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
              <span>{formatProgressCopy(copy.pagination.summary, { total: totalRows, page, totalPages })}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="text-slate-500">{copy.pagination.pageSizeLabel}</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      onPageSizeChange(value)
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-emerald-300 focus:outline-none"
                    aria-label={copy.pagination.pageSizeLabel}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                >
                  {copy.pagination.prev}
                </button>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    onBlur={() => {
                      const value = Number(pageInput)
                      if (!Number.isFinite(value)) {
                        setPageInput(String(page))
                        return
                      }
                      onPageChange(Math.min(totalPages, Math.max(1, Math.round(value))))
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        const value = Number(pageInput)
                        if (!Number.isFinite(value)) {
                          setPageInput(String(page))
                          return
                        }
                        onPageChange(Math.min(totalPages, Math.max(1, Math.round(value))))
                      }
                    }}
                    className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-900 focus:border-emerald-300 focus:outline-none"
                    aria-label={copy.pagination.goTo}
                  />
                  <span className="text-slate-500">/ {totalPages}</span>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                >
                  {copy.pagination.next}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <QuantitiesDetailModal
        open={detailOpen}
        phaseId={detailPhaseId}
        intervalId={detailIntervalId}
        onClose={() => setDetailOpen(false)}
      />
    </main>
  )
}
