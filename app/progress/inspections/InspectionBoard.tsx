'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  InspectionListItem,
  InspectionStatus,
  IntervalSide,
  RoadSectionWithPhasesDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import {
  PREFAB_ROAD_NAME,
  PREFAB_ROAD_SLUG,
  prefabCheckOptions,
  prefabPhaseOptions,
  prefabTypeOptions,
  type PrefabPhaseKey,
} from '@/lib/prefabInspection'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressList, localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  roads: RoadSectionWithPhasesDTO[]
  loadError: string | null
}

type PhaseOption = RoadSectionWithPhasesDTO['phases'][number] & {
  roadSlug?: string
  roadName?: string
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
  | 'status'
  | 'appointmentDate'
  | 'submittedAt'
  | 'submittedBy'
  | 'remark'
  | 'createdBy'
  | 'createdAt'
  | 'updatedBy'
  | 'updatedAt'

const INSPECTION_COLUMN_STORAGE_KEY = 'inspection-visible-columns'
const defaultVisibleColumns: ColumnKey[] = [
  'sequence',
  'road',
  'phase',
  'side',
  'range',
  'layers',
  'checks',
  'types',
  'status',
  'appointmentDate',
  'submittedAt',
  'submittedBy',
  'remark',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
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

const splitTokens = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)

type EditFormState = {
  phaseId: number | ''
  side: IntervalSide | ''
  startPk: string
  endPk: string
  layers: string
  checks: string
  types: string
  remark: string
  appointmentDate: string
}

export function InspectionBoard({ roads, loadError }: Props) {
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
  const getPrefabPhaseLabel = (key: PrefabPhaseKey) => copy.prefabModal.phaseOptions[key] ?? key
  const getPrefabLayerLabel = (key: PrefabPhaseKey, fallback: string) =>
    copy.prefabModal.layerOptions[key] ?? fallback
  const getPrefabCheckLabel = (value: string) => copy.prefabModal.checkOptions[value] ?? value
  const getPrefabTypeLabel = (value: string) => copy.prefabModal.typeOptions[value] ?? value
  const [roadSlug, setRoadSlug] = useState('')
  const [phaseId, setPhaseId] = useState<number | ''>('')
  const [status, setStatus] = useState<InspectionStatus[]>([])
  const [side, setSide] = useState('')
  const [type, setType] = useState('')
  const [check, setCheck] = useState('')
  const [keyword, setKeyword] = useState('')
  const [checkOptions, setCheckOptions] = useState<string[]>([])
  const [checkOptionsError, setCheckOptionsError] = useState<string | null>(null)
  const [checkOptionsLoading, setCheckOptionsLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [items, setItems] = useState<InspectionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(loadError)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkStatus, setBulkStatus] = useState<InspectionStatus | ''>('')
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [showPrefabModal, setShowPrefabModal] = useState(false)
  const [prefabPending, setPrefabPending] = useState(false)
  const [prefabError, setPrefabError] = useState<string | null>(null)
  const [prefabForm, setPrefabForm] = useState<{
    phaseKey: PrefabPhaseKey
    layers: string[]
    checks: string[]
    types: string[]
    appointmentDate: string
    remark: string
  }>({
    phaseKey: 'ditch',
    layers: [prefabPhaseOptions[0]?.layer ?? ''],
    checks: prefabCheckOptions,
    types: prefabTypeOptions,
    appointmentDate: '',
    remark: '',
  })
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
      { key: 'status', label: copy.columns.status },
      { key: 'appointmentDate', label: copy.columns.appointmentDate },
      { key: 'submittedAt', label: copy.columns.submittedAt },
      { key: 'submittedBy', label: copy.columns.submittedBy },
      { key: 'remark', label: copy.columns.remark },
      { key: 'createdBy', label: copy.columns.createdBy },
      { key: 'createdAt', label: copy.columns.createdAt },
      { key: 'updatedBy', label: copy.columns.updatedBy },
      { key: 'updatedAt', label: copy.columns.updatedAt },
    ],
    [copy.columns],
  )
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)

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
    remark: '',
    appointmentDate: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [editPending, setEditPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InspectionListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const dateLocaleTag = locale === 'fr' ? 'fr-FR' : 'zh-CN'

  const phases = useMemo<PhaseOption[]>(() => {
    if (roadSlug) {
      const found = roads.find((road) => road.slug === roadSlug)
      return found?.phases ?? []
    }
    return roads.flatMap((road) =>
      (road.phases ?? []).map((phase) => ({
        ...phase,
        roadSlug: road.slug,
        roadName: resolveRoadName(road, locale),
      })),
    )
  }, [locale, roadSlug, roads])

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

  const editingPhases = useMemo(() => {
    if (!editing) return []
    const found = roads.find((road) => road.slug === editing.roadSlug)
    return found?.phases ?? []
  }, [editing, roads])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageIds = useMemo(() => items.map((item) => item.id), [items])
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const columnCount = visibleColumns.length + 2
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildQuery({
        roadSlug: roadSlug || undefined,
        phaseId: phaseId || undefined,
        status: status.length ? status : undefined,
        side: side || undefined,
        type: type || undefined,
        check: check || undefined,
        keyword: keyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortField,
        sortOrder,
        page,
        pageSize,
      })
      const res = await fetch(`/api/inspections?${query}`)
      const data = (await res.json()) as { message?: string; items?: InspectionListItem[]; total?: number; page?: number }
      if (!res.ok) {
        throw new Error(data.message ?? copy.errors.loadFailed)
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadSlug, phaseId, status, side, type, check, keyword, startDate, endDate, sortField, sortOrder, page, pageSize])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
  }, [items])

  useEffect(() => {
    setBulkError(null)
  }, [selectedIds, bulkStatus])

  const statusOptions: InspectionStatus[] = ['PENDING', 'SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED']

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
        setVisibleColumns(filtered)
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

  const togglePrefabArrayValue = (field: 'layers' | 'checks' | 'types', value: string) => {
    setPrefabForm((prev) => {
      const next = prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value]
      return { ...prev, [field]: next }
    })
  }

  const handlePrefabPhaseChange = (value: PrefabPhaseKey) => {
    const matched = prefabPhaseOptions.find((item) => item.key === value)
    setPrefabForm((prev) => ({
      ...prev,
      phaseKey: value,
      layers: matched ? [matched.layer] : prev.layers,
    }))
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
    setRoadSlug('')
    setPhaseId('')
    setStatus([])
    setSide('')
    setType('')
    setCheck('')
    setKeyword('')
    setStartDate('')
    setEndDate('')
    setSortField('updatedAt')
    setSortOrder('desc')
    setPage(1)
  }

  const submitPrefab = async () => {
    if (!prefabForm.layers.length || !prefabForm.checks.length || !prefabForm.types.length) {
      setPrefabError(copy.editModal.missingRequired)
      return
    }
    if (!prefabForm.appointmentDate) {
      setPrefabError(copy.editModal.appointmentMissing)
      return
    }
    setPrefabPending(true)
    setPrefabError(null)
    try {
      const res = await fetch('/api/inspections/prefab', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseKey: prefabForm.phaseKey,
          layers: prefabForm.layers,
          checks: prefabForm.checks,
          types: prefabForm.types,
          appointmentDate: prefabForm.appointmentDate,
          remark: prefabForm.remark || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { inspection?: InspectionListItem; message?: string }
      if (!res.ok || !data.inspection) {
        throw new Error(data.message ?? copy.errors.createFailed)
      }
      setShowPrefabModal(false)
      setPrefabForm((prev) => ({
        ...prev,
        appointmentDate: '',
        remark: '',
      }))
      await fetchData()
    } catch (err) {
      setPrefabError((err as Error).message)
    } finally {
      setPrefabPending(false)
    }
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
    setEditForm({
      phaseId: editing.phaseId,
      side: editing.side,
      startPk: String(editing.startPk),
      endPk: String(editing.endPk),
      layers: editing.layers.join(joiner),
      checks: editing.checks.join(joiner),
      types: editing.types.join(joiner),
      remark: editing.remark ?? '',
      appointmentDate: formatDateInputValue(editing.appointmentDate),
    })
    setEditError(null)
  }, [editing, locale])

  const submitEdit = async () => {
    if (!editing) return
    const startPk = Number(editForm.startPk)
    const endPk = Number(editForm.endPk)
    if (!editForm.phaseId) {
      setEditError(copy.editModal.missingPhase)
      return
    }
    if (!Number.isFinite(startPk) || !Number.isFinite(endPk)) {
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
    setEditPending(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/inspections/${editing.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseId: editForm.phaseId,
          side: editForm.side || 'BOTH',
          startPk,
          endPk,
          layers,
          checks,
          types,
          remark: editForm.remark || undefined,
          appointmentDate: editForm.appointmentDate || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { inspection?: InspectionListItem; message?: string }
      if (!res.ok || !data.inspection) {
        throw new Error(data.message ?? copy.errors.updateFailed)
      }
      const updatedInspection = data.inspection!
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
      const res = await fetch(`/api/inspections/${deleteTarget.id}`, {
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

  const applyBulkStatus = async () => {
    if (selectedIds.length === 0) {
      setBulkError(copy.bulk.missingSelection)
      return
    }
    if (!bulkStatus) {
      setBulkError(copy.bulk.missingStatus)
      return
    }
    setBulkPending(true)
    setBulkError(null)
    try {
      const res = await fetch('/api/inspections/bulk-status', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      })
      const data = (await res.json().catch(() => ({}))) as { items?: InspectionListItem[]; message?: string }
      if (!res.ok || !data.items) {
        throw new Error(data.message ?? copy.errors.bulkFailed)
      }
      const updatedMap = new Map(data.items.map((item) => [item.id, item]))
      setItems((prev) => prev.map((item) => updatedMap.get(item.id) ?? item))
      setSelectedIds([])
      await fetchData()
    } catch (err) {
      setBulkError((err as Error).message)
    } finally {
      setBulkPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/15 via-blue-300/10 to-amber-200/10 blur-3xl" />
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{copy.badge}</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">{copy.title}</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">{copy.description}</p>
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
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={roadSlug}
                onChange={(e) => {
                  setRoadSlug(e.target.value)
                  setPhaseId('')
                  setPage(1)
                }}
              >
                <option value="">{copy.filters.all}</option>
                {roads.map((road) => (
                  <option key={road.id} value={road.slug}>
                    {resolveRoadName(road, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.phase}
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={phaseId}
                onChange={(e) => {
                  const value = e.target.value
                  setPhaseId(value ? Number(value) : '')
                  setPage(1)
                }}
              >
                <option value="">{copy.filters.all}</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.roadName ? `${phase.roadName} · ${phase.name}` : phase.name}
                  </option>
                ))}
              </select>
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
              {copy.filters.type}
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setPage(1)
                }}
                placeholder={copy.filters.typePlaceholder}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              {copy.filters.check}
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={check}
                onChange={(e) => {
                  setCheck(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{copy.filters.all}</option>
                {checkOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {checkOptionsLoading ? (
                <span className="text-[11px] text-slate-300">{copy.filters.loading}</span>
              ) : null}
              {checkOptionsError ? (
                <span className="text-[11px] text-amber-200">{checkOptionsError}</span>
              ) : null}
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="whitespace-nowrap">{copy.filters.status}</span>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      status.includes(item)
                        ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                        : 'bg-white/10 text-slate-100'
                    }`}
                    onClick={() => toggleStatus(item)}
                  >
                    {statusCopy[item]}
                  </button>
                ))}
              </div>
            </div>
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
            <label className="flex flex-col gap-1 text-xs text-slate-200 md:col-span-2">
              {copy.filters.keyword}
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder={copy.filters.keywordPlaceholder}
              />
            </label>
            <div className="flex items-center gap-3 md:col-span-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                onClick={resetFilters}
              >
                {copy.filters.reset}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
                onClick={() => {
                  setPage(1)
                  fetchData()
                }}
              >
                {copy.filters.search}
              </button>
              <button
                type="button"
                className="rounded-xl bg-sky-200 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-sky-300/30 transition hover:-translate-y-0.5"
                onClick={() => {
                  setShowPrefabModal(true)
                  setPrefabError(null)
                }}
              >
                {copy.filters.addPrefab}
              </button>
              {loading ? <span className="text-xs text-slate-200">{copy.filters.loading}</span> : null}
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  <div className="absolute right-0 z-10 mt-2 w-64 max-w-full rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
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
                          <span className="truncate">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as InspectionStatus)}
              >
                <option value="">{copy.bulk.statusPlaceholder}</option>
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {statusCopy[item] ?? item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={applyBulkStatus}
                disabled={bulkPending || selectedIds.length === 0}
              >
                {bulkPending ? copy.bulk.applying : copy.bulk.apply}
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
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('road')}
                    >
                      {copy.columns.road} {sortField === 'road' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('phase') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('phase')}
                    >
                      {copy.columns.phase} {sortField === 'phase' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('side') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('side')}
                    >
                      {copy.columns.side} {sortField === 'side' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('range') ? (
                    <th className="px-4 py-3">
                      {copy.columns.range}
                    </th>
                  ) : null}
                  {isVisible('layers') ? (
                    <th className="px-4 py-3">
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
                  {isVisible('remark') ? (
                    <th className="px-4 py-3">{copy.columns.remark}</th>
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
                  <th className="px-4 py-3 text-center">
                    {copy.columns.actions}
                  </th>
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
                    const roadText = isPrefab ? prefabRoadLabel : item.roadName
                    const sideText = isPrefab ? '—' : sideCopy[item.side] ?? item.side
                    const rangeText = isPrefab ? '—' : `${formatPK(item.startPk)} → ${formatPK(item.endPk)}`
                    const layersText = localizeProgressList('layer', item.layers, locale, {
                      phaseName: item.phaseName,
                    }).join(' / ')
                    const appointmentText = formatAppointmentDate(item.appointmentDate)
                    const submittedByText = item.submittedBy?.username ?? '—'
                    const createdByText = item.createdBy?.username ?? '—'
                    const updatedByText = item.updatedBy?.username ?? '—'
                    const remarkText = item.remark ?? '—'
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-white/5 bg-white/0 transition hover:bg-white/5"
                        onClick={() => setSelected(item)}
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
                      {isVisible('road') ? <td className="px-4 py-3">{roadText}</td> : null}
                      {isVisible('phase') ? (
                        <td className="px-4 py-3">{localizeProgressTerm('phase', item.phaseName, locale)}</td>
                      ) : null}
                      {isVisible('side') ? <td className="px-4 py-3">{sideText}</td> : null}
                      {isVisible('range') ? (
                        <td className="px-4 py-3">
                          {rangeText}
                        </td>
                      ) : null}
                      {isVisible('layers') ? (
                        <td className="px-4 py-3 max-w-xs truncate" title={layersText}>
                          {layersText}
                        </td>
                      ) : null}
                      {isVisible('checks') ? (
                        <td
                          className="px-4 py-3 max-w-xs truncate"
                          title={localizeProgressList('check', item.checks, locale).join(' / ')}
                        >
                          {localizeProgressList('check', item.checks, locale).join(' / ')}
                        </td>
                      ) : null}
                      {isVisible('types') ? (
                        <td
                          className="px-4 py-3 max-w-xs truncate"
                          title={localizeProgressList('type', item.types, locale).join(' / ')}
                        >
                          {localizeProgressList('type', item.types, locale).join(' / ')}
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
                      {isVisible('remark') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{remarkText}</td>
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
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

        {showPrefabModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPrefabModal(false)
            }}
          >
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-sky-400/20 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-100">{copy.prefabModal.badge}</p>
                  <h2 className="text-xl font-semibold text-slate-50">{copy.prefabModal.title}</h2>
                  <p className="text-sm text-slate-300">{copy.prefabModal.subtitle}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setShowPrefabModal(false)}
                  aria-label={copy.prefabModal.closeAria}
                >
                  ×
                </button>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    {copy.prefabModal.phaseLabel}
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={prefabForm.phaseKey}
                        onChange={(e) => handlePrefabPhaseChange(e.target.value as PrefabPhaseKey)}
                      >
                        {prefabPhaseOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {getPrefabPhaseLabel(option.key)}
                          </option>
                        ))}
                      </select>
                    </label>
                  <label className="flex flex-col gap-1">
                    {copy.prefabModal.appointmentLabel}
                    <input
                      type="date"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={prefabForm.appointmentDate}
                      onChange={(e) => setPrefabForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">{copy.prefabModal.layersLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {prefabPhaseOptions.map((option) => (
                        <button
                          key={option.layer}
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            prefabForm.layers.includes(option.layer)
                              ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/30'
                              : 'border border-white/20 bg-white/5 text-slate-100'
                          }`}
                          onClick={() => togglePrefabArrayValue('layers', option.layer)}
                        >
                          {getPrefabLayerLabel(option.key, option.layer)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">{copy.prefabModal.typesLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {prefabTypeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            prefabForm.types.includes(option)
                              ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/30'
                              : 'border border-white/20 bg-white/5 text-slate-100'
                          }`}
                          onClick={() => togglePrefabArrayValue('types', option)}
                        >
                          {getPrefabTypeLabel(option)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-300">{copy.prefabModal.checksLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {prefabCheckOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          prefabForm.checks.includes(option)
                            ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/30'
                            : 'border border-white/20 bg-white/5 text-slate-100'
                        }`}
                        onClick={() => togglePrefabArrayValue('checks', option)}
                      >
                          {getPrefabCheckLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  {copy.prefabModal.remarkLabel}
                  <textarea
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    rows={3}
                    value={prefabForm.remark}
                    onChange={(e) => setPrefabForm((prev) => ({ ...prev, remark: e.target.value }))}
                    placeholder={copy.prefabModal.remarkPlaceholder}
                  />
                </label>
                {prefabError ? <p className="text-xs text-amber-200">{prefabError}</p> : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={() => setShowPrefabModal(false)}
                  >
                    {copy.prefabModal.cancel}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-sky-200 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-sky-300/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                    onClick={submitPrefab}
                    disabled={prefabPending}
                  >
                    {prefabPending ? copy.prefabModal.submitting : copy.prefabModal.submit}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
              const roadText = isPrefab ? prefabRoadLabel : selected.roadName
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
                  <p className="text-xs text-slate-400">{copy.detailModal.contentsLabel}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {localizeProgressList('check', selected.checks, locale).join(locale === 'fr' ? ', ' : '，')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.typesLabel}</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {localizeProgressList('type', selected.types, locale).join(locale === 'fr' ? ', ' : '，')}
                  </p>
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
                  <p className="text-xs text-slate-400">{copy.detailModal.submittedAt}</p>
                  <p>{formatDate(selected.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.updatedAt}</p>
                  <p>{formatDate(selected.updatedAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">{copy.detailModal.submittedBy}</p>
                  <p>{selected.createdBy?.username ?? copy.detailModal.unknownUser}</p>
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

        {editing ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditing(null)
            }}
          >
            {(() => {
              const isPrefab = isPrefabItem(editing)
              const roadText = isPrefab ? prefabRoadLabel : editing.roadName
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
                  <h3 className="text-lg font-semibold text-slate-50">{deleteTarget.phaseName}</h3>
                  <p className="text-sm text-slate-300">
                    {deleteTarget.roadName} · {formatPK(deleteTarget.startPk)} → {formatPK(deleteTarget.endPk)}
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
