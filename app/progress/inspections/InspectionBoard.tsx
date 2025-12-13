'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  InspectionEntryDTO,
  InspectionListItem,
  InspectionStatus,
  IntervalSide,
  RoadSectionWithPhasesDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { PREFAB_ROAD_SLUG } from '@/lib/prefabInspection'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import {
  canonicalizeProgressList,
  localizeProgressList,
  localizeProgressTerm,
} from '@/lib/i18n/progressDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  roads: RoadSectionWithPhasesDTO[]
  loadError: string | null
  canBulkEdit: boolean
}

type PhaseOption = RoadSectionWithPhasesDTO['phases'][number] & {
  roadSlug?: string
  roadName?: string
}

type PhaseDefinitionOption = {
  id: number
  name: string
}

type SortField = 'road' | 'phase' | 'side' | 'appointmentDate' | 'createdAt' | 'updatedAt'
type SortOrder = 'asc' | 'desc'
type ColumnKey =
  | 'sequence'
  | 'road'
  | 'phase'
  | 'side'
  | 'range'
  | 'layers'
  | 'checks'
  | 'types'
  | 'submissionOrder'
  | 'status'
  | 'appointmentDate'
  | 'submittedAt'
  | 'submittedBy'
  | 'remark'
  | 'createdBy'
  | 'createdAt'
  | 'updatedBy'
  | 'updatedAt'
  | 'action'

const INSPECTION_COLUMN_STORAGE_KEY = 'inspection-visible-columns'
const defaultVisibleColumns: ColumnKey[] = [
  'sequence',
  'road',
  'phase',
  'range',
  'layers',
  'checks',
  'status',
  'updatedAt',
  'action',
]

const statusTone: Record<InspectionStatus, string> = {
  PENDING: 'bg-slate-800 text-slate-100 ring-1 ring-white/10',
  SCHEDULED: 'bg-sky-900/60 text-sky-100 ring-1 ring-sky-300/40',
  SUBMITTED: 'bg-indigo-700/40 text-indigo-100 ring-1 ring-indigo-300/40',
  IN_PROGRESS: 'bg-amber-200/30 text-amber-100 ring-1 ring-amber-200/50',
  APPROVED: 'bg-emerald-300/20 text-emerald-100 ring-1 ring-emerald-300/40',
}

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const statusPriority: Record<InspectionStatus, number> = {
  PENDING: 1,
  SCHEDULED: 2,
  SUBMITTED: 3,
  IN_PROGRESS: 4,
  APPROVED: 5,
}

const buildQuery = (params: Record<string, string | number | undefined | (string | number)[]>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)))
    } else {
      search.set(key, String(value))
    }
  })
  return search.toString()
}

const formatDateInputValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const formatDateTimeInputValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

const splitTokens = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)

const mapEntryToListItem = (entry: InspectionEntryDTO): InspectionListItem => {
  const status = entry.status ?? 'PENDING'
  const submittedAt = entry.submittedAt ?? entry.createdAt ?? new Date().toISOString()
  const rawRoad = (entry as any).road as { slug?: string; name?: string } | undefined
  const rawPhase = (entry as any).phase as { name?: string } | undefined
  return {
    id: entry.id,
    roadId: entry.roadId,
    roadName: entry.roadName ?? rawRoad?.name ?? '',
    roadSlug: entry.roadSlug ?? rawRoad?.slug ?? '',
    phaseId: entry.phaseId,
    phaseName: entry.phaseName ?? rawPhase?.name ?? '',
    submissionId: entry.submissionId ?? null,
    submissionCode: entry.submissionCode ?? undefined,
    side: entry.side,
    startPk: entry.startPk,
    endPk: entry.endPk,
    layers: entry.layerName ? [entry.layerName] : [],
    checks: entry.checkName ? [entry.checkName] : [],
    types: entry.types || [],
    submissionOrder: entry.submissionOrder ?? null,
    status,
    remark: entry.remark ?? undefined,
    appointmentDate: entry.appointmentDate ?? undefined,
    submittedAt,
    submittedBy: entry.submittedBy ?? null,
    createdBy: entry.createdBy ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    updatedBy: entry.updatedBy ?? null,
  }
}

type EditFormState = {
  phaseId: number | ''
  side: IntervalSide | ''
  startPk: string
  endPk: string
  layers: string
  checks: string
  types: string
  status: InspectionStatus | ''
  remark: string
  appointmentDate: string
  submissionOrder: string
  submittedAt: string
}

export function InspectionBoard({ roads, loadError, canBulkEdit }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const copy = t.inspectionBoard
  const statusCopy = copy.status as Record<InspectionStatus, string>
  const sideCopy: Record<string, string> = {
    LEFT: copy.filters.sideLeft,
    RIGHT: copy.filters.sideRight,
    BOTH: copy.filters.sideBoth,
  }
  const prefabRoadLabel = copy.prefabRoadName
  const formatPhaseDefinitionLabel = useCallback(
    (definition: PhaseDefinitionOption) => localizeProgressTerm('phase', definition.name, locale),
    [locale],
  )
  const formatTypeLabel = useCallback((value: string) => localizeProgressTerm('type', value, locale), [locale])
  const formatRoadName = useCallback((slug?: string, name?: string) => resolveRoadName({ slug, name }, locale), [locale])
  const normalizeLayerLabels = useCallback(
    (values: string[], phaseName?: string) =>
      localizeProgressList('layer', canonicalizeProgressList('layer', values), locale, {
        phaseName,
      }),
    [locale],
  )
  const normalizeCheckLabels = useCallback(
    (values: string[]) => localizeProgressList('check', canonicalizeProgressList('check', values), locale),
    [locale],
  )
  const normalizeTypeLabels = useCallback(
    (values: string[]) => localizeProgressList('type', canonicalizeProgressList('type', values), locale),
    [locale],
  )
  const inspectionTypeOptions = useMemo(() => ['现场验收', '试验验收', '测量验收', '其他'], [])
  const [roadSlugs, setRoadSlugs] = useState<string[]>([])
  const [phaseDefinitionIds, setPhaseDefinitionIds] = useState<number[]>([])
  const [status, setStatus] = useState<InspectionStatus[]>([])
  const [side, setSide] = useState('')
  const [layerFilters, setLayerFilters] = useState<string[]>([])
  const layerFilterValues = useMemo(
    () => canonicalizeProgressList('layer', layerFilters),
    [layerFilters],
  )
  const [types, setTypes] = useState<string[]>([])
  const [checkFilters, setCheckFilters] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [checkOptions, setCheckOptions] = useState<string[]>([])
  const [checkOptionsError, setCheckOptionsError] = useState<string | null>(null)
  const [checkOptionsLoading, setCheckOptionsLoading] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [layerOpen, setLayerOpen] = useState(false)
  const [roadOpen, setRoadOpen] = useState(false)
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize] = useState(20)
  const [items, setItems] = useState<InspectionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(loadError)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditPending, setBulkEditPending] = useState(false)
  const [bulkEditError, setBulkEditError] = useState<string | null>(null)
  const [bulkEditForm, setBulkEditForm] = useState<EditFormState>({
    phaseId: '',
    side: '',
    startPk: '',
    endPk: '',
    layers: '',
    checks: '',
    types: '',
    status: '',
    remark: '',
    appointmentDate: '',
    submissionOrder: '',
    submittedAt: '',
  })
  const [pdfPending, setPdfPending] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const columnOptions: { key: ColumnKey; label: string }[] = useMemo(
    () => [
      { key: 'sequence', label: copy.columns.sequence },
      { key: 'road', label: copy.columns.road },
      { key: 'phase', label: copy.columns.phase },
      { key: 'side', label: copy.columns.side },
      { key: 'range', label: copy.columns.range },
      { key: 'layers', label: copy.columns.layers },
      { key: 'checks', label: copy.columns.checks },
      { key: 'types', label: copy.columns.types },
      { key: 'submissionOrder', label: copy.columns.submissionOrder },
      { key: 'status', label: copy.columns.status },
      { key: 'appointmentDate', label: copy.columns.appointmentDate },
      { key: 'submittedAt', label: copy.columns.submittedAt },
      { key: 'submittedBy', label: copy.columns.submittedBy },
      { key: 'createdBy', label: copy.columns.createdBy },
      { key: 'createdAt', label: copy.columns.createdAt },
      { key: 'updatedBy', label: copy.columns.updatedBy },
      { key: 'updatedAt', label: copy.columns.updatedAt },
      { key: 'action', label: copy.columns.actions },
      { key: 'remark', label: copy.columns.remark },
    ],
    [copy.columns],
  )
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
  const typeSelectorRef = useRef<HTMLDivElement | null>(null)
  const statusSelectorRef = useRef<HTMLDivElement | null>(null)
  const layerSelectorRef = useRef<HTMLDivElement | null>(null)
  const roadSelectorRef = useRef<HTMLDivElement | null>(null)
  const phaseSelectorRef = useRef<HTMLDivElement | null>(null)
  const checkSelectorRef = useRef<HTMLDivElement | null>(null)

  const persistVisibleColumns = (next: ColumnKey[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INSPECTION_COLUMN_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('Failed to persist visible columns', error)
      }
    }
    setVisibleColumns(next)
  }

  const handleSelectAllColumns = () => persistVisibleColumns(columnOptions.map((option) => option.key))
  const handleRestoreDefaultColumns = () => persistVisibleColumns([...defaultVisibleColumns])
  const handleClearColumns = () => persistVisibleColumns([])
  const [selected, setSelected] = useState<InspectionListItem | null>(null)
  const [editing, setEditing] = useState<InspectionListItem | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    phaseId: '',
    side: '',
    startPk: '',
    endPk: '',
    layers: '',
    checks: '',
    types: '',
    status: '',
    remark: '',
    appointmentDate: '',
    submissionOrder: '',
    submittedAt: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [editPending, setEditPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InspectionListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const dateLocaleTag = locale === 'fr' ? 'fr-FR' : 'zh-CN'

  const phaseDefinitions = useMemo<PhaseDefinitionOption[]>(() => {
    const map = new Map<number, PhaseDefinitionOption>()
    roads.forEach((road) => {
      ;(road.phases ?? []).forEach((phase) => {
        if (!map.has(phase.definitionId)) {
          map.set(phase.definitionId, { id: phase.definitionId, name: phase.definitionName })
        }
      })
    })
    const list = Array.from(map.values())
    const collator = new Intl.Collator(locale === 'fr' ? 'fr' : 'zh-Hans')
    return list.sort((a, b) =>
      collator.compare(
        localizeProgressTerm('phase', a.name, locale),
        localizeProgressTerm('phase', b.name, locale),
      ),
    )
  }, [locale, roads])

  useEffect(() => {
    let stopped = false
    const loadCheckOptions = async () => {
      setCheckOptionsLoading(true)
      setCheckOptionsError(null)
      try {
        const res = await fetch('/api/inspections/check-options')
        const data = (await res.json().catch(() => ({}))) as {
          items?: { id: number; name: string }[]
          message?: string
        }
        if (!res.ok || !data.items) {
          throw new Error(data.message ?? copy.errors.loadFailed)
        }
        if (stopped) return
        const names = data.items.map((item) => item.name).filter(Boolean)
        setCheckOptions(Array.from(new Set(names)))
      } catch (err) {
        if (!stopped) {
          setCheckOptionsError((err as Error).message)
        }
      } finally {
        if (!stopped) {
          setCheckOptionsLoading(false)
        }
      }
    }
    loadCheckOptions()
    return () => {
      stopped = true
    }
  }, [copy.errors.loadFailed])

  const layerOptions = useMemo(() => {
    const set = new Set<string>()
    roads.forEach((road) => {
      ;(road.phases ?? []).forEach((phase) => {
        ;(phase.resolvedLayers ?? []).forEach((layer) => {
          if (layer) set.add(layer)
        })
      })
    })
    items.forEach((item) => {
      ;(item.layers ?? []).forEach((layer) => {
        if (layer) set.add(layer)
      })
    })
    return Array.from(set)
  }, [items, roads])

  const editingPhases = useMemo(() => {
    if (!editing) return []
    const found = roads.find((road) => road.slug === editing.roadSlug)
    return found?.phases ?? []
  }, [editing, roads])

  const allPhaseOptions = useMemo<PhaseOption[]>(() => {
    const list: PhaseOption[] = []
    roads.forEach((road) => {
      ;(road.phases ?? []).forEach((phase) => {
        list.push({ ...phase, roadSlug: road.slug, roadName: road.name })
      })
    })
    return list
  }, [roads])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageIds = useMemo(() => items.map((item) => item.id), [items])
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const columnCount = visibleColumns.length + 1
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildQuery({
        roadSlug: roadSlugs.length ? roadSlugs : undefined,
        phaseDefinitionId: phaseDefinitionIds.length ? phaseDefinitionIds : undefined,
        status: status.length ? status : undefined,
        side: side || undefined,
        layerName: layerFilterValues.length ? layerFilterValues : undefined,
        type: types.length ? types : undefined,
        checkName: checkFilters.length ? checkFilters : undefined,
        keyword: keyword ? `remark:${keyword}` : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortField,
        sortOrder,
        page,
        pageSize,
      })
      const res = await fetch(`/api/inspection-entries?${query}`)
      const data = (await res.json()) as {
        message?: string
        items?: InspectionEntryDTO[]
        total?: number
        page?: number
      }
      if (!res.ok) {
        throw new Error(data.message ?? copy.errors.loadFailed)
      }
      if (!Array.isArray(data.items)) {
        setItems([])
        setTotal(0)
      } else {
        const list = data.items.map((entry) => mapEntryToListItem(entry))
        setItems(list)
        setTotal(data.total ?? list.length)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roadSlugs,
    phaseDefinitionIds,
    status,
    side,
    layerFilterValues,
    types,
    checkFilters,
    keyword,
    startDate,
    endDate,
    sortField,
    sortOrder,
    page,
    pageSize,
  ])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
  }, [items])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    setBulkError(null)
  }, [selectedIds])

  useEffect(() => {
    setBulkEditError(null)
  }, [bulkEditForm, selectedIds])

  useEffect(() => {
    setPdfError(null)
  }, [selectedIds])

  const statusOptions: InspectionStatus[] = ['PENDING', 'SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED']
  const toggleValue = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
      if (typeSelectorRef.current && !typeSelectorRef.current.contains(event.target as Node)) {
        setTypeOpen(false)
      }
      if (statusSelectorRef.current && !statusSelectorRef.current.contains(event.target as Node)) {
        setStatusOpen(false)
      }
      if (layerSelectorRef.current && !layerSelectorRef.current.contains(event.target as Node)) {
        setLayerOpen(false)
      }
      if (roadSelectorRef.current && !roadSelectorRef.current.contains(event.target as Node)) {
        setRoadOpen(false)
      }
      if (phaseSelectorRef.current && !phaseSelectorRef.current.contains(event.target as Node)) {
        setPhaseOpen(false)
      }
      if (checkSelectorRef.current && !checkSelectorRef.current.contains(event.target as Node)) {
        setCheckOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(INSPECTION_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return
      const filtered = parsed.filter((item) =>
        typeof item === 'string' && columnOptions.some((option) => option.key === item),
      ) as ColumnKey[]
      const trimmed = stored.trim()
      if (filtered.length || trimmed === '[]') {
        const ensured: ColumnKey[] = filtered.includes('action')
          ? filtered
          : [...filtered, 'action']
        setVisibleColumns(ensured)
        return
      }
      setVisibleColumns(defaultVisibleColumns)
    } catch (error) {
      console.error('Failed to load visible columns', error)
    }
  }, [columnOptions])

  const toggleStatus = (value: InspectionStatus) => {
    setPage(1)
    setStatus((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }

  const toggleColumnVisibility = (key: ColumnKey) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((item) => item !== key)
      : [...visibleColumns, key]
    persistVisibleColumns(next)
  }

  const resetBulkEditForm = () =>
    setBulkEditForm({
      phaseId: '',
      side: '',
      startPk: '',
      endPk: '',
      layers: '',
      checks: '',
      types: '',
      status: '',
      remark: '',
      appointmentDate: '',
      submissionOrder: '',
      submittedAt: '',
    })

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const isPrefabItem = (item: InspectionListItem) => item.roadSlug === PREFAB_ROAD_SLUG

  const handleSort = (field: SortField) => {
    setPage(1)
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const resetFilters = () => {
    setRoadSlugs([])
    setPhaseDefinitionIds([])
    setStatus([])
    setSide('')
    setLayerFilters([])
    setTypes([])
    setCheckFilters([])
    setKeyword('')
    setStartDate('')
    setEndDate('')
    setSortField('updatedAt')
    setSortOrder('desc')
    setPage(1)
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(dateLocaleTag, {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatAppointmentDate = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(dateLocaleTag, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    })
  }

  useEffect(() => {
    if (!editing) return
    const joiner = locale === 'fr' ? ', ' : '，'
    const nowIso = new Date().toISOString()
    const localizedLayers = normalizeLayerLabels(editing.layers, editing.phaseName).join(joiner)
    const localizedChecks = normalizeCheckLabels(editing.checks).join(joiner)
    const localizedTypes = normalizeTypeLabels(editing.types).join(joiner)
    setEditForm({
      phaseId: editing.phaseId,
      side: editing.side,
      startPk: String(editing.startPk),
      endPk: String(editing.endPk),
      layers: localizedLayers,
      checks: localizedChecks,
      types: localizedTypes,
      status: editing.status,
      remark: editing.remark ?? '',
      appointmentDate: formatDateInputValue(editing.appointmentDate),
      submissionOrder:
        editing.submissionOrder === null || editing.submissionOrder === undefined
          ? ''
          : String(editing.submissionOrder),
      submittedAt: formatDateTimeInputValue(editing.submittedAt ?? nowIso) || formatDateTimeInputValue(nowIso),
    })
    setEditError(null)
  }, [editing, locale, normalizeCheckLabels, normalizeLayerLabels, normalizeTypeLabels])

  const submitEdit = async () => {
    if (!editing) return
    const startPk = Number(editForm.startPk)
    const endPk = Number(editForm.endPk)
    const submissionOrderText = editForm.submissionOrder.trim()
    const submissionOrder = submissionOrderText === '' ? undefined : Number(submissionOrderText)
    const nextStatus = (editForm.status || editing.status) as InspectionStatus
    const submittedAtValue = editForm.submittedAt ? new Date(editForm.submittedAt) : new Date()
    if (!editForm.phaseId) {
      setEditError(copy.editModal.missingPhase)
      return
    }
    if (!Number.isFinite(startPk) || !Number.isFinite(endPk)) {
      setEditError(copy.editModal.invalidRange)
      return
    }
    if (Number.isNaN(submittedAtValue.getTime())) {
      setEditError(copy.editModal.invalidRange)
      return
    }
    const layers = splitTokens(editForm.layers)
    const checks = splitTokens(editForm.checks)
    const types = splitTokens(editForm.types)
    if (!layers.length || !checks.length || !types.length) {
      setEditError(copy.editModal.missingRequired)
      return
    }
    if (submissionOrderText && !Number.isFinite(submissionOrder)) {
      setEditError(copy.editModal.invalidSubmissionOrder)
      return
    }
    setEditPending(true)
    setEditError(null)
    try {
      const layerName = layers[0]
      const checkName = checks[0]
      const res = await fetch(`/api/inspection-entries/${editing.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseId: editForm.phaseId,
          side: editForm.side || 'BOTH',
          startPk,
          endPk,
          layerName,
          checkName,
          types,
          status: nextStatus,
          submissionOrder,
          remark: editForm.remark || undefined,
          appointmentDate: editForm.appointmentDate || undefined,
          submittedAt: submittedAtValue.toISOString(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { entry?: InspectionEntryDTO; message?: string }
      if (!res.ok || !data.entry) {
        throw new Error(data.message ?? copy.errors.updateFailed)
      }
      const updatedInspection = mapEntryToListItem(data.entry)
      setItems((prev) => prev.map((item) => (item.id === editing.id ? updatedInspection : item)))
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditPending(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletePending(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/inspection-entries/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? copy.errors.deleteFailed)
      }
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      setTotal((prev) => Math.max(0, prev - 1))
      if (items.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1))
      }
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  const applyBulkEdit = async () => {
    if (!canBulkEdit) {
      return
    }
    if (selectedIds.length === 0) {
      setBulkError(copy.bulk.missingSelection)
      return
    }

    const submissionOrderText = bulkEditForm.submissionOrder.trim()
    const payload: Record<string, unknown> = {}
    if (bulkEditForm.phaseId) payload.phaseId = bulkEditForm.phaseId
    if (bulkEditForm.side) payload.side = bulkEditForm.side
    const startProvided = bulkEditForm.startPk.trim() !== ''
    const endProvided = bulkEditForm.endPk.trim() !== ''
    if (startProvided || endProvided) {
      const startPk = Number(bulkEditForm.startPk)
      const endPk = Number(bulkEditForm.endPk)
      if (!Number.isFinite(startPk) || !Number.isFinite(endPk)) {
        setBulkEditError(copy.bulkEdit.invalidRange)
        return
      }
      payload.startPk = startPk
      payload.endPk = endPk
    }
    const layers = splitTokens(bulkEditForm.layers)
    if (layers.length) payload.layerName = layers[0]
    const checks = splitTokens(bulkEditForm.checks)
    if (checks.length) payload.checkName = checks[0]
    const types = splitTokens(bulkEditForm.types)
    if (types.length) payload.types = types
    if (bulkEditForm.status) payload.status = bulkEditForm.status
    const remark = bulkEditForm.remark.trim()
    if (remark) payload.remark = remark
    if (bulkEditForm.appointmentDate) payload.appointmentDate = bulkEditForm.appointmentDate
    if (bulkEditForm.submittedAt) {
      const submittedAt = new Date(bulkEditForm.submittedAt)
      if (Number.isNaN(submittedAt.getTime())) {
        setBulkEditError(copy.bulkEdit.invalidSubmittedAt)
        return
      }
      payload.submittedAt = submittedAt.toISOString()
    }
    if (submissionOrderText) {
      const submissionOrder = Number(submissionOrderText)
      if (!Number.isFinite(submissionOrder)) {
        setBulkEditError(copy.bulkEdit.invalidSubmissionOrder)
        return
      }
      payload.submissionOrder = submissionOrder
    }

    if (Object.keys(payload).length === 0) {
      setBulkEditError(copy.bulkEdit.missingFields)
      return
    }

    setBulkEditPending(true)
    setBulkEditError(null)
    try {
      const res = await fetch('/api/inspection-entries/bulk-edit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { items?: InspectionEntryDTO[]; message?: string }
      if (!res.ok || !data.items) {
        throw new Error(data.message ?? copy.errors.bulkFailed)
      }
      await fetchData()
      setSelectedIds([])
      setBulkEditOpen(false)
      setBulkEditForm({
        phaseId: '',
        side: '',
        startPk: '',
        endPk: '',
        layers: '',
        checks: '',
        types: '',
        status: '',
        remark: '',
        appointmentDate: '',
        submissionOrder: '',
        submittedAt: '',
      })
    } catch (err) {
      setBulkEditError((err as Error).message)
    } finally {
      setBulkEditPending(false)
    }
  }

  const handleExportPdf = async (mode: 'preview' | 'download') => {
    if (selectedIds.length === 0) {
      setPdfError(copy.bulk.missingSelection)
      return
    }
    setPdfPending(true)
    setPdfError(null)
    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000)
      const res = await fetch('/api/inspections/pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ ids: selectedIds, locale: 'fr', mode }),
      })
      window.clearTimeout(timeoutId)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data.message ?? copy.errors.exportFailed)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const filename = `inspection-export-${new Date().toISOString().slice(0, 10)}.pdf`

      if (mode === 'preview') {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (err) {
      const message =
        (err as Error).name === 'AbortError' ? copy.errors.exportFailed : (err as Error).message
      setPdfError(message)
    } finally {
      setPdfPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/15 via-blue-300/10 to-amber-200/10 blur-3xl" />
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{copy.badge}</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">{copy.title}</h1>
          <p className="text-sm text-slate-200/80 whitespace-nowrap">{copy.description}</p>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              {copy.breadcrumb.home}
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              {copy.breadcrumb.progress}
            </Link>
            <span className="text-slate-500">/</span>
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
              {copy.breadcrumb.current}
            </span>
          </nav>
          {error ? (
            <p className="text-sm text-amber-200">
              {formatProgressCopy(copy.errorHint, { message: error })}
            </p>
          ) : null}
        </header>
        <section className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-900/30 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.road}
              <div className="relative" ref={roadSelectorRef}>
                <button
                  type="button"
                  onClick={() => setRoadOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
                >
                  <span className="truncate">
                    {roadSlugs.length === 0
                      ? copy.filters.all
                      : formatProgressCopy(copy.typePicker.selected, { count: roadSlugs.length })}
                  </span>
                  <span className="text-xs text-slate-300">⌕</span>
                </button>
                {roadOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                      <span>
                        {formatProgressCopy(copy.typePicker.summary, {
                          count: roadSlugs.length ? roadSlugs.length : copy.typePicker.all,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="text-emerald-300 hover:underline"
                          onClick={() => {
                            setRoadSlugs(roads.map((road) => road.slug))
                            setPage(1)
                          }}
                        >
                          {copy.typePicker.selectAll}
                        </button>
                        <button
                          className="text-slate-400 hover:underline"
                          onClick={() => {
                            setRoadSlugs([])
                            setPage(1)
                          }}
                        >
                          {copy.typePicker.clear}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {roads.map((road) => (
                        <label
                          key={road.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                            checked={roadSlugs.includes(road.slug)}
                            onChange={() => {
                              setRoadSlugs((prev) => toggleValue(prev, road.slug))
                              setPage(1)
                            }}
                          />
                          <span className="truncate">{resolveRoadName(road, locale)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.phase}
              <div className="relative" ref={phaseSelectorRef}>
                <button
                  type="button"
                  onClick={() => setPhaseOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
                >
                  <span className="truncate">
                    {phaseDefinitionIds.length === 0
                      ? copy.filters.all
                      : formatProgressCopy(copy.typePicker.selected, { count: phaseDefinitionIds.length })}
                  </span>
                  <span className="text-xs text-slate-300">⌕</span>
                </button>
                {phaseOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                      <span>
                        {formatProgressCopy(copy.typePicker.summary, {
                          count: phaseDefinitionIds.length ? phaseDefinitionIds.length : copy.typePicker.all,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="text-emerald-300 hover:underline"
                          onClick={() => {
                            setPhaseDefinitionIds(phaseDefinitions.map((definition) => definition.id))
                            setPage(1)
                          }}
                        >
                          {copy.typePicker.selectAll}
                        </button>
                        <button
                          className="text-slate-400 hover:underline"
                          onClick={() => {
                            setPhaseDefinitionIds([])
                            setPage(1)
                          }}
                        >
                          {copy.typePicker.clear}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {phaseDefinitions.map((definition) => (
                        <label
                          key={definition.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                            checked={phaseDefinitionIds.includes(definition.id)}
                            onChange={() => {
                              setPhaseDefinitionIds((prev) => toggleValue(prev, definition.id))
                              setPage(1)
                            }}
                          />
                          <span className="truncate">{formatPhaseDefinitionLabel(definition)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            {copy.filters.side}
            <select
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
              value={side}
              onChange={(e) => {
                setSide(e.target.value)
                setPage(1)
              }}
            >
              <option value="">{copy.filters.all}</option>
              <option value="LEFT">{copy.filters.sideLeft}</option>
              <option value="RIGHT">{copy.filters.sideRight}</option>
              <option value="BOTH">{copy.filters.sideBoth}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            {copy.columns.layers}
            <div className="relative" ref={layerSelectorRef}>
              <button
                type="button"
                onClick={() => setLayerOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
              >
                <span className="truncate">
                  {layerFilters.length === 0
                    ? copy.filters.all
                    : formatProgressCopy(copy.typePicker.selected, { count: layerFilters.length })}
                </span>
                <span className="text-xs text-slate-300">⌕</span>
              </button>
              {layerOpen ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                    <span>
                      {formatProgressCopy(copy.typePicker.summary, {
                        count: layerFilters.length ? layerFilters.length : copy.typePicker.all,
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-emerald-300 hover:underline"
                        onClick={() => {
                          setLayerFilters(layerOptions)
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.selectAll}
                      </button>
                      <button
                        className="text-slate-400 hover:underline"
                        onClick={() => {
                          setLayerFilters([])
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.clear}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {layerOptions.map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                          checked={layerFilters.includes(option)}
                          onChange={() => {
                            setLayerFilters((prev) => toggleValue(prev, option))
                            setPage(1)
                          }}
                        />
                        <span className="truncate">{localizeProgressTerm('layer', option, locale)}</span>
                      </label>
                    ))}
                    {layerOptions.length === 0 ? (
                      <p className="px-2 py-1 text-[11px] text-slate-300">{copy.filters.loading}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            {copy.filters.type}
            <div className="relative" ref={typeSelectorRef}>
              <button
                type="button"
                onClick={() => setTypeOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
              >
                <span className="truncate">
                  {types.length === 0
                    ? copy.typePicker.placeholder
                    : formatProgressCopy(copy.typePicker.selected, { count: types.length })}
                </span>
                <span className="text-xs text-slate-300">⌕</span>
              </button>
              {typeOpen ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                    <span>
                      {formatProgressCopy(copy.typePicker.summary, {
                        count: types.length ? types.length : copy.typePicker.all,
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-emerald-300 hover:underline"
                        onClick={() => {
                          setTypes(inspectionTypeOptions)
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.selectAll}
                      </button>
                      <button
                        className="text-slate-400 hover:underline"
                        onClick={() => {
                          setTypes([])
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.clear}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {inspectionTypeOptions.map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                          checked={types.includes(option)}
                          onChange={() => {
                            setTypes((prev) => toggleValue(prev, option))
                            setPage(1)
                          }}
                        />
                        <span className="truncate">{formatTypeLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            {copy.filters.check}
            <div className="relative" ref={checkSelectorRef}>
              <button
                type="button"
                onClick={() => setCheckOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
              >
                <span className="truncate">
                  {checkFilters.length === 0
                    ? copy.filters.all
                    : formatProgressCopy(copy.typePicker.selected, { count: checkFilters.length })}
                </span>
                <span className="text-xs text-slate-300">⌕</span>
              </button>
              {checkOpen ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                    <span>
                      {formatProgressCopy(copy.typePicker.summary, {
                        count: checkFilters.length ? checkFilters.length : copy.typePicker.all,
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-emerald-300 hover:underline"
                        onClick={() => {
                          setCheckFilters(checkOptions)
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.selectAll}
                      </button>
                      <button
                        className="text-slate-400 hover:underline"
                        onClick={() => {
                          setCheckFilters([])
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.clear}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {checkOptions.map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                          checked={checkFilters.includes(option)}
                          onChange={() => {
                            setCheckFilters((prev) => toggleValue(prev, option))
                            setPage(1)
                          }}
                        />
                        <span className="truncate">{localizeProgressTerm('check', option, locale)}</span>
                      </label>
                    ))}
                    {checkOptionsLoading ? (
                      <span className="px-2 text-[11px] text-slate-300">{copy.filters.loading}</span>
                    ) : null}
                    {checkOptionsError ? (
                      <span className="px-2 text-[11px] text-amber-200">{checkOptionsError}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            {copy.filters.status}
            <div className="relative" ref={statusSelectorRef}>
              <button
                type="button"
                onClick={() => setStatusOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-50 shadow-inner shadow-slate-900/30 focus:border-emerald-300 focus:outline-none"
              >
                <span className="truncate">
                  {status.length === 0
                    ? copy.filters.all
                    : formatProgressCopy(copy.typePicker.selected, { count: status.length })}
                </span>
                <span className="text-xs text-slate-300">⌕</span>
              </button>
              {statusOpen ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                    <span>
                      {formatProgressCopy(copy.typePicker.summary, {
                        count: status.length ? status.length : copy.typePicker.all,
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-emerald-300 hover:underline"
                        onClick={() => {
                          setStatus(statusOptions)
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.selectAll}
                      </button>
                      <button
                        className="text-slate-400 hover:underline"
                        onClick={() => {
                          setStatus([])
                          setPage(1)
                        }}
                      >
                        {copy.typePicker.clear}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {statusOptions.map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                          checked={status.includes(option)}
                          onChange={() => {
                            setStatus((prev) => toggleValue(prev, option))
                            setPage(1)
                          }}
                        />
                        <span className="truncate">{statusCopy[option]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.startDate}
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.endDate}
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
              />
            </label>
            <div className="flex flex-col gap-1 text-xs text-slate-200 md:col-span-2">
              {copy.filters.keyword}
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
                <input
                  className="h-10 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value)
                    setPage(1)
                  }}
                  placeholder={copy.filters.keywordPlaceholder}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-white/20 px-4 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={resetFilters}
                  >
                    {copy.filters.reset}
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
                    onClick={() => {
                      setPage(1)
                      fetchData()
                    }}
                  >
                    {copy.filters.search}
                  </button>
                  {loading ? <span className="text-xs text-slate-200">{copy.filters.loading}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-slate-900/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-50">
                {formatProgressCopy(copy.bulk.selectedCount, { count: selectedIds.length })}
              </span>
              {bulkError ? <span className="text-xs text-amber-200">{bulkError}</span> : null}
              {pdfError ? <span className="text-xs text-amber-200">{pdfError}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative" ref={columnSelectorRef}>
                <button
                  type="button"
                  className="flex min-w-[140px] items-center justify-between rounded-xl border border-white/20 px-3 py-2 text-left text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={() => setShowColumnSelector((prev) => !prev)}
                >
                  <span className="truncate">
                    {visibleColumns.length
                      ? formatProgressCopy(copy.columnSelector.selectedCount, { count: visibleColumns.length })
                      : copy.columnSelector.noneSelected}
                  </span>
                  <span className="text-xs text-slate-400">⌕</span>
                </button>
                {showColumnSelector ? (
                  <div className="absolute right-0 z-10 mt-2 w-80 max-w-sm rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
                      <button className="text-emerald-300 hover:underline" onClick={handleSelectAllColumns}>
                        {copy.columnSelector.selectAll}
                      </button>
                      <div className="flex gap-2">
                        <button className="text-slate-400 hover:underline" onClick={handleRestoreDefaultColumns}>
                          {copy.columnSelector.restore}
                        </button>
                        <button className="text-slate-400 hover:underline" onClick={handleClearColumns}>
                          {copy.columnSelector.clear}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-xs text-slate-100">
                      {columnOptions.map((option) => (
                        <label
                          key={option.key}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
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
              {canBulkEdit ? (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    resetBulkEditForm()
                    setBulkEditOpen(true)
                    setBulkEditError(null)
                  }}
                  disabled={selectedIds.length === 0}
                >
                  {copy.bulk.edit}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleExportPdf('preview')}
                disabled={pdfPending || selectedIds.length === 0}
              >
                {pdfPending ? copy.pdf.previewing : copy.pdf.preview}
              </button>
              <button
                type="button"
                className="rounded-xl bg-sky-200 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-sky-300/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleExportPdf('download')}
                disabled={pdfPending || selectedIds.length === 0}
              >
                {pdfPending ? copy.pdf.exporting : copy.pdf.export}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-100">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="w-24 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label={copy.table.selectPage}
                      />
                    </div>
                  </th>
                  {isVisible('sequence') ? <th className="px-4 py-3">{copy.columns.sequence}</th> : null}
                  {isVisible('road') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort('road')}
                    >
                      {copy.columns.road} {sortField === 'road' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('phase') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort('phase')}
                    >
                      {copy.columns.phase} {sortField === 'phase' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('side') ? (
                    <th
                      className="px-4 py-3 min-w-[80px] cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort('side')}
                    >
                      {copy.columns.side} {sortField === 'side' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('range') ? (
                    <th className="px-4 py-3 whitespace-nowrap">
                      {copy.columns.range}
                    </th>
                  ) : null}
                  {isVisible('layers') ? (
                    <th className="px-4 py-3 whitespace-nowrap">
                      {copy.columns.layers}
                    </th>
                  ) : null}
                  {isVisible('checks') ? (
                    <th className="px-4 py-3">
                      {copy.columns.checks}
                    </th>
                  ) : null}
                  {isVisible('types') ? (
                    <th className="px-4 py-3">
                      {copy.columns.types}
                    </th>
                  ) : null}
                  {isVisible('submissionOrder') ? (
                    <th className="px-4 py-3 whitespace-nowrap">{copy.columns.submissionOrder}</th>
                  ) : null}
                  {isVisible('status') ? (
                    <th className="px-4 py-3 min-w-[120px]">
                      {copy.columns.status}
                    </th>
                  ) : null}
                  {isVisible('appointmentDate') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('appointmentDate')}
                    >
                      {copy.columns.appointmentDate}{' '}
                      {sortField === 'appointmentDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('submittedAt') ? (
                    <th className="px-4 py-3">
                      {copy.columns.submittedAt}
                    </th>
                  ) : null}
                  {isVisible('submittedBy') ? (
                    <th className="px-4 py-3">{copy.columns.submittedBy}</th>
                  ) : null}
                  {isVisible('createdBy') ? (
                    <th className="px-4 py-3">{copy.columns.createdBy}</th>
                  ) : null}
                  {isVisible('createdAt') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('createdAt')}
                    >
                      {copy.columns.createdAt}{' '}
                      {sortField === 'createdAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('updatedBy') ? (
                    <th className="px-4 py-3">{copy.columns.updatedBy}</th>
                  ) : null}
                  {isVisible('updatedAt') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('updatedAt')}
                    >
                      {copy.columns.updatedAt}{' '}
                      {sortField === 'updatedAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('action') ? (
                    <th className="px-4 py-3 text-center">
                    {copy.columns.actions}
                    </th>
                  ) : null}
                  {isVisible('remark') ? (
                    <th className="px-4 py-3">{copy.columns.remark}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-300">
                      {loading ? copy.table.loading : copy.table.empty}
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const displayIndex = (page - 1) * pageSize + index + 1
                    const isPrefab = isPrefabItem(item)
                    const isRowSelected = selectedIds.includes(item.id)
                    const roadText = isPrefab
                      ? prefabRoadLabel
                      : formatRoadName(item.roadSlug, item.roadName)
                    const sideText = isPrefab ? '—' : sideCopy[item.side] ?? item.side
                    const rangeText = isPrefab ? '—' : `${formatPK(item.startPk)} → ${formatPK(item.endPk)}`
                    const layersText = normalizeLayerLabels(
                      Array.isArray(item.layers) ? item.layers : [],
                      item.phaseName,
                    ).join(' / ')
                    const checksText = normalizeCheckLabels(Array.isArray(item.checks) ? item.checks : []).join(' / ')
                    const typesText = normalizeTypeLabels(Array.isArray(item.types) ? item.types : []).join(' / ')
                    const appointmentText = formatAppointmentDate(item.appointmentDate)
                    const submittedByText = item.submittedBy?.username ?? '—'
                    const createdByText = item.createdBy?.username ?? '—'
                    const updatedByText = item.updatedBy?.username ?? '—'
                  const remarkText = item.remark ?? '—'
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-white/5 transition ${isRowSelected ? 'bg-emerald-400/10' : 'bg-white/0'} hover:bg-white/5`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                            checked={selectedIds.includes(item.id)}
                            onChange={(event) => {
                              event.stopPropagation()
                              toggleSelect(item.id)
                            }}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={formatProgressCopy(copy.table.selectRow, { index: displayIndex })}
                          />
                        </div>
                      </td>
                      {isVisible('sequence') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{displayIndex}</td>
                      ) : null}
                      {isVisible('road') ? <td className="px-4 py-3 whitespace-nowrap">{roadText}</td> : null}
                      {isVisible('phase') ? (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.phaseName ? localizeProgressTerm('phase', item.phaseName, locale) : '—'}
                        </td>
                      ) : null}
                      {isVisible('side') ? (
                        <td className="px-4 py-3 min-w-[80px] whitespace-nowrap">{sideText}</td>
                      ) : null}
                      {isVisible('range') ? (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {rangeText}
                        </td>
                      ) : null}
                      {isVisible('layers') ? (
                        <td className="px-4 py-3 whitespace-nowrap" title={layersText}>
                          {layersText}
                        </td>
                      ) : null}
                      {isVisible('checks') ? (
                        <td
                          className="px-4 py-3 max-w-xs truncate"
                          title={checksText}
                        >
                          {checksText}
                        </td>
                      ) : null}
                      {isVisible('types') ? (
                        <td
                          className="px-4 py-3 max-w-xs truncate"
                          title={typesText}
                        >
                          {typesText}
                        </td>
                      ) : null}
                      {isVisible('submissionOrder') ? (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.submissionOrder === null || item.submissionOrder === undefined
                            ? '—'
                            : item.submissionOrder}
                        </td>
                      ) : null}
                      {isVisible('status') ? (
                        <td className="px-4 py-3 min-w-[120px]">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[item.status] ?? 'bg-white/10 text-slate-100'}`}>
                            {statusCopy[item.status] ?? item.status}
                          </span>
                        </td>
                      ) : null}
                      {isVisible('appointmentDate') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{appointmentText}</td>
                      ) : null}
                      {isVisible('submittedAt') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.submittedAt)}</td>
                      ) : null}
                      {isVisible('submittedBy') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{submittedByText}</td>
                      ) : null}
                      {isVisible('createdBy') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{createdByText}</td>
                      ) : null}
                      {isVisible('createdAt') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.createdAt)}</td>
                      ) : null}
                      {isVisible('updatedBy') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{updatedByText}</td>
                      ) : null}
                      {isVisible('updatedAt') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.updatedAt)}</td>
                      ) : null}
                      {isVisible('action') ? (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelected(item)
                              }}
                            >
                              {copy.table.view}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-emerald-200/70 hover:bg-emerald-200/15"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelected(null)
                                setEditing(item)
                              }}
                            >
                              {copy.table.edit}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:border-amber-200/70 hover:bg-amber-200/15"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelected(null)
                                setDeleteError(null)
                                setDeleteTarget(item)
                              }}
                            >
                              {copy.table.delete}
                            </button>
                          </div>
                        </td>
                      ) : null}
                      {isVisible('remark') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{remarkText}</td>
                      ) : null}
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-sm text-slate-200">
            <span>{formatProgressCopy(copy.pagination.summary, { total, page, totalPages })}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {copy.pagination.prev}
              </button>
              <div className="flex items-center gap-1 text-xs text-slate-200">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                    const value = Number(pageInput)
                    if (!Number.isFinite(value)) {
                      setPageInput(String(page))
                      return
                    }
                    const next = Math.min(totalPages, Math.max(1, Math.round(value)))
                    if (next !== page) setPage(next)
                    setPageInput(String(next))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = Number(pageInput)
                      const next = Number.isFinite(value) ? Math.min(totalPages, Math.max(1, Math.round(value))) : page
                      if (next !== page) setPage(next)
                      setPageInput(String(next))
                    }
                  }}
                  className="h-8 w-14 rounded-lg border border-white/20 bg-slate-900 px-2 py-1 text-center text-xs text-slate-50 focus:border-emerald-300 focus:outline-none"
                  aria-label={copy.pagination.goTo}
                />
                <span className="text-slate-400">/ {totalPages}</span>
              </div>
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {copy.pagination.next}
              </button>
            </div>
          </div>
        </section>

        {selected ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            {(() => {
              const isPrefab = isPrefabItem(selected)
              const sideText = isPrefab ? '—' : sideCopy[selected.side] ?? selected.side
              const rangeText = isPrefab ? '—' : `${formatPK(selected.startPk)} → ${formatPK(selected.endPk)}`
              const roadText = isPrefab ? prefabRoadLabel : formatRoadName(selected.roadSlug, selected.roadName)
              const joiner = locale === 'fr' ? ', ' : ' / '
              const layerText = normalizeLayerLabels(selected.layers, selected.phaseName).join(joiner)
              const checksText = normalizeCheckLabels(selected.checks).join(joiner)
              const typesText = normalizeTypeLabels(selected.types).join(joiner)
              const submittedByText = selected.submittedBy?.username ?? copy.detailModal.unknownUser
              const createdByText = selected.createdBy?.username ?? copy.detailModal.unknownUser
              const updatedByText = selected.updatedBy?.username ?? copy.detailModal.unknownUser
              const submissionOrderText =
                selected.submissionOrder === null || selected.submissionOrder === undefined
                  ? '—'
                  : String(selected.submissionOrder)
              return (
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-900/50 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{copy.detailModal.badge}</p>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {localizeProgressTerm('phase', selected.phaseName, locale)} · {sideText}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {roadText} · {rangeText}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setSelected(null)}
                  aria-label={copy.detailModal.closeAria}
                >
                  ×
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.road}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{roadText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.phase}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {localizeProgressTerm('phase', selected.phaseName, locale)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.side}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{sideText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.range}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{rangeText}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-400">{copy.columns.layers}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{layerText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.contentsLabel}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{checksText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.typesLabel}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{typesText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.statusLabel}</p>
                  <p>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[selected.status] ?? 'bg-white/10 text-slate-100'}`}>
                      {statusCopy[selected.status] ?? selected.status}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.submissionOrder}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{submissionOrderText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.submittedAt}</p>
                  <p>{formatDate(selected.submittedAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.updatedAt}</p>
                  <p>{formatDate(selected.updatedAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.submittedBy}</p>
                  <p>{submittedByText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.createdBy}</p>
                  <p>{createdByText}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.createdAt}</p>
                  <p>{formatDate(selected.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.columns.updatedBy}</p>
                  <p>{updatedByText}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-400">{copy.detailModal.remarkLabel}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {selected.remark || copy.detailModal.remarkEmpty}
                  </p>
                </div>
              </div>
            </div>
              )
            })()}
          </div>
        ) : null}

        {bulkEditOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setBulkEditOpen(false)
                resetBulkEditForm()
              }
            }}
          >
            <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-100 shadow-2xl shadow-emerald-400/30 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{copy.bulkEdit.badge}</p>
                  <h2 className="text-xl font-semibold text-slate-50">{copy.bulkEdit.title}</h2>
                  <p className="text-sm text-slate-300">
                    {formatProgressCopy(copy.bulk.selectedCount, { count: selectedIds.length })}
                  </p>
                  <p className="text-xs text-slate-400">{copy.bulkEdit.hint}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => {
                    setBulkEditOpen(false)
                    resetBulkEditForm()
                  }}
                  aria-label={copy.bulkEdit.closeAria}
                >
                  ×
                </button>
              </div>

              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.phaseLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.phaseId}
                      onChange={(e) =>
                        setBulkEditForm((prev) => ({
                          ...prev,
                          phaseId: e.target.value ? Number(e.target.value) : '',
                        }))
                      }
                    >
                      <option value="">{copy.bulkEdit.noChange}</option>
                      {allPhaseOptions.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {resolveRoadName({ slug: phase.roadSlug, name: phase.roadName }, locale)} ·{' '}
                          {localizeProgressTerm('phase', phase.name, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.sideLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.side}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, side: e.target.value as IntervalSide }))}
                    >
                      <option value="">{copy.bulkEdit.noChange}</option>
                      <option value="LEFT">{copy.editModal.sideLeft}</option>
                      <option value="RIGHT">{copy.editModal.sideRight}</option>
                      <option value="BOTH">{copy.editModal.sideBoth}</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span>{copy.editModal.startLabel}</span>
                      <span className="text-[11px] text-slate-400">{copy.bulkEdit.noChange}</span>
                    </span>
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.startPk}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, startPk: e.target.value }))}
                      placeholder={copy.bulkEdit.rangeHint}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.endLabel}
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.endPk}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, endPk: e.target.value }))}
                      placeholder={copy.bulkEdit.rangeHint}
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.layersLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.layers}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, layers: e.target.value }))}
                      placeholder={copy.bulkEdit.tokenHint}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.checksLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.checks}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, checks: e.target.value }))}
                      placeholder={copy.bulkEdit.tokenHint}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.typesLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.types}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, types: e.target.value }))}
                      placeholder={copy.bulkEdit.tokenHint}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.appointmentLabel}
                    <input
                      type="date"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.appointmentDate}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.submittedAtLabel}
                    <input
                      type="datetime-local"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.submittedAt}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, submittedAt: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.statusLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.status}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, status: e.target.value as InspectionStatus }))}
                    >
                      <option value="">{copy.bulkEdit.noChange}</option>
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>
                          {statusCopy[item] ?? item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.submissionOrderLabel}
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={bulkEditForm.submissionOrder}
                      onChange={(e) => setBulkEditForm((prev) => ({ ...prev, submissionOrder: e.target.value }))}
                      placeholder={copy.editModal.submissionOrderPlaceholder}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  {copy.editModal.remarkLabel}
                  <textarea
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    rows={3}
                    value={bulkEditForm.remark}
                    onChange={(e) => setBulkEditForm((prev) => ({ ...prev, remark: e.target.value }))}
                    placeholder={copy.bulkEdit.remarkHint}
                  />
                </label>
                <p className="text-xs text-slate-400">{copy.bulkEdit.noChangeHint}</p>
                {bulkEditError ? <p className="text-xs text-amber-200">{bulkEditError}</p> : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={() => {
                      setBulkEditOpen(false)
                      resetBulkEditForm()
                    }}
                  >
                    {copy.bulkEdit.cancel}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                    onClick={applyBulkEdit}
                    disabled={bulkEditPending}
                  >
                    {bulkEditPending ? copy.bulkEdit.saving : copy.bulkEdit.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {editing ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditing(null)
            }}
          >
            {(() => {
              const isPrefab = isPrefabItem(editing)
              const roadText = isPrefab ? prefabRoadLabel : formatRoadName(editing.roadSlug, editing.roadName)
              const rangeText = isPrefab ? '—' : `${formatPK(editing.startPk)} → ${formatPK(editing.endPk)}`
              return (
            <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{copy.editModal.badge}</p>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {roadText} · {localizeProgressTerm('phase', editing.phaseName, locale)}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {rangeText}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setEditing(null)}
                  aria-label={copy.editModal.closeAria}
                >
                  ×
                </button>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.phaseLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.phaseId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phaseId: e.target.value ? Number(e.target.value) : '' }))}
                    >
                      <option value="">{copy.editModal.phasePlaceholder}</option>
                      {editingPhases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {localizeProgressTerm('phase', phase.name, locale)}
                        </option>
                        ))}
                      </select>
                    </label>
                  {isPrefab ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-xs text-slate-300">{copy.editModal.sideLabel}</span>
                      <span>{copy.editModal.sidePrefabNote}</span>
                    </div>
                  ) : (
                    <label className="flex flex-col gap-1">
                      {copy.editModal.sideLabel}
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={editForm.side}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, side: e.target.value as IntervalSide }))}
                      >
                        <option value="">{copy.editModal.sidePlaceholder}</option>
                        <option value="LEFT">{copy.editModal.sideLeft}</option>
                        <option value="RIGHT">{copy.editModal.sideRight}</option>
                        <option value="BOTH">{copy.editModal.sideBoth}</option>
                      </select>
                    </label>
                  )}
                </div>
                {isPrefab ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-xs text-slate-300">{copy.editModal.rangeLabel}</span>
                      <span>{copy.editModal.rangePrefabNote}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      {copy.editModal.startLabel}
                      <input
                        type="number"
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={editForm.startPk}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, startPk: e.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      {copy.editModal.endLabel}
                      <input
                        type="number"
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={editForm.endPk}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, endPk: e.target.value }))}
                      />
                    </label>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.layersLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.layers}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, layers: e.target.value }))}
                      placeholder={copy.editModal.layersPlaceholder}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.checksLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.checks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, checks: e.target.value }))}
                      placeholder={copy.editModal.checksPlaceholder}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.editModal.typesLabel}
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.types}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, types: e.target.value }))}
                      placeholder={copy.editModal.typesPlaceholder}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.appointmentLabel}
                    <input
                      type="date"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.appointmentDate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.submittedAtLabel}
                    <input
                      type="datetime-local"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.submittedAt}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, submittedAt: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.statusLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.status}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as InspectionStatus }))}
                    >
                      <option value="">{copy.editModal.statusPlaceholder}</option>
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>
                          {statusCopy[item] ?? item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    {copy.editModal.submissionOrderLabel}
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.submissionOrder}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, submissionOrder: e.target.value }))}
                      placeholder={copy.editModal.submissionOrderPlaceholder}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  {copy.editModal.remarkLabel}
                  <textarea
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    rows={3}
                    value={editForm.remark}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, remark: e.target.value }))}
                    placeholder={copy.editModal.remarkPlaceholder}
                  />
                </label>
                {editError ? <p className="text-xs text-amber-200">{editError}</p> : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={() => setEditing(null)}
                  >
                    {copy.editModal.cancel}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                    onClick={submitEdit}
                    disabled={editPending}
                  >
                    {editPending ? copy.editModal.saving : copy.editModal.save}
                  </button>
                </div>
              </div>
            </div>
              )
            })()}
          </div>
        ) : null}

        {deleteTarget ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteTarget(null)
            }}
          >
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-100 shadow-2xl shadow-rose-500/20 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-100">{copy.deleteModal.badge}</p>
                  <h3 className="text-lg font-semibold text-slate-50">
                    {localizeProgressTerm('phase', deleteTarget.phaseName, locale)}
                  </h3>
                  <p className="text-sm text-slate-300">
                    {isPrefabItem(deleteTarget)
                      ? prefabRoadLabel
                      : formatRoadName(deleteTarget.roadSlug, deleteTarget.roadName)}{' '}
                    · {formatPK(deleteTarget.startPk)} → {formatPK(deleteTarget.endPk)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setDeleteTarget(null)}
                  aria-label={copy.deleteModal.closeAria}
                >
                  ×
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-200">{copy.deleteModal.confirmText}</p>
              {deleteError ? <p className="mt-2 text-xs text-amber-200">{deleteError}</p> : null}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={() => setDeleteTarget(null)}
                >
                  {copy.deleteModal.cancel}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-rose-300 px-4 py-2 text-xs font-semibold text-rose-900 shadow-lg shadow-rose-400/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                  onClick={confirmDelete}
                  disabled={deletePending}
                >
                  {deletePending ? copy.deleteModal.confirming : copy.deleteModal.confirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
