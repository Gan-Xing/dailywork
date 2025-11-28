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

interface Props {
  roads: RoadSectionWithPhasesDTO[]
  loadError: string | null
}

type SortField = 'createdAt' | 'updatedAt'
type SortOrder = 'asc' | 'desc'
type ColumnKey =
  | 'road'
  | 'phase'
  | 'side'
  | 'range'
  | 'checks'
  | 'types'
  | 'status'
  | 'createdAt'
  | 'updatedAt'

const statusCopy: Record<string, string> = {
  PENDING: '待处理',
  IN_PROGRESS: '验收中',
  APPROVED: '已通过',
}

const statusTone: Record<string, string> = {
  PENDING: 'bg-slate-800 text-slate-100 ring-1 ring-white/10',
  IN_PROGRESS: 'bg-amber-200/30 text-amber-100 ring-1 ring-amber-200/50',
  APPROVED: 'bg-emerald-300/20 text-emerald-100 ring-1 ring-emerald-300/40',
}

const sideCopy: Record<string, string> = { LEFT: '左侧', RIGHT: '右侧', BOTH: '双侧' }

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
  const [roadSlug, setRoadSlug] = useState('')
  const [phaseId, setPhaseId] = useState<number | ''>('')
  const [status, setStatus] = useState<string[]>([])
  const [side, setSide] = useState('')
  const [type, setType] = useState('')
  const [keyword, setKeyword] = useState('')
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
  const columnOptions: { key: ColumnKey; label: string }[] = useMemo(
    () => [
      { key: 'road', label: '道路' },
      { key: 'phase', label: '分项' },
      { key: 'side', label: '侧别' },
      { key: 'range', label: '区间' },
      { key: 'checks', label: '验收内容' },
      { key: 'types', label: '验收类型' },
      { key: 'status', label: '状态' },
      { key: 'createdAt', label: '提交时间' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    [],
  )
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => columnOptions.map((item) => item.key))
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
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

  const phases = useMemo(() => {
    const found = roads.find((road) => road.slug === roadSlug)
    return found?.phases ?? []
  }, [roadSlug, roads])

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
        throw new Error(data.message ?? '加载失败')
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
  }, [roadSlug, phaseId, status, side, type, keyword, startDate, endDate, sortField, sortOrder, page, pageSize])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
  }, [items])

  useEffect(() => {
    setBulkError(null)
  }, [selectedIds, bulkStatus])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleStatus = (value: string) => {
    setPage(1)
    setStatus((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }

  const toggleColumnVisibility = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== key)
      }
      return [...prev, key]
    })
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
    setKeyword('')
    setStartDate('')
    setEndDate('')
    setSortField('updatedAt')
    setSortOrder('desc')
    setPage(1)
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  useEffect(() => {
    if (!editing) return
    setEditForm({
      phaseId: editing.phaseId,
      side: editing.side,
      startPk: String(editing.startPk),
      endPk: String(editing.endPk),
      layers: editing.layers.join('，'),
      checks: editing.checks.join('，'),
      types: editing.types.join('，'),
      remark: editing.remark ?? '',
      appointmentDate: formatDateInputValue(editing.appointmentDate),
    })
    setEditError(null)
  }, [editing])

  const submitEdit = async () => {
    if (!editing) return
    const startPk = Number(editForm.startPk)
    const endPk = Number(editForm.endPk)
    if (!editForm.phaseId) {
      setEditError('请选择分项')
      return
    }
    if (!Number.isFinite(startPk) || !Number.isFinite(endPk)) {
      setEditError('请输入有效的起止里程')
      return
    }
    const layers = splitTokens(editForm.layers)
    const checks = splitTokens(editForm.checks)
    const types = splitTokens(editForm.types)
    if (!layers.length || !checks.length || !types.length) {
      setEditError('层次、验收内容、验收类型均不能为空')
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
        throw new Error(data.message ?? '更新失败')
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
        throw new Error(data.message ?? '删除失败')
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
      setBulkError('请选择至少一条报检记录')
      return
    }
    if (!bulkStatus) {
      setBulkError('请选择要更新的状态')
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
        throw new Error(data.message ?? '批量更新失败')
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">报检列表</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">所有报检记录</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">
            可按道路、分项、状态、侧别、时间等条件筛选，点击表头可排序，点击行查看详情。
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              首页
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              进度管理
            </Link>
            <span className="text-slate-500">/</span>
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
              报检记录
            </span>
          </nav>
          {error ? <p className="text-sm text-amber-200">加载提示：{error}</p> : null}
        </header>

        <section className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-900/30 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              道路
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={roadSlug}
                onChange={(e) => {
                  setRoadSlug(e.target.value)
                  setPhaseId('')
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                {roads.map((road) => (
                  <option key={road.id} value={road.slug}>
                    {resolveRoadName(road, 'zh')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              分项
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={phaseId}
                onChange={(e) => {
                  const value = e.target.value
                  setPhaseId(value ? Number(value) : '')
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              侧别
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={side}
                onChange={(e) => {
                  setSide(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                <option value="LEFT">左侧</option>
                <option value="RIGHT">右侧</option>
                <option value="BOTH">双侧</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              验收类型
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setPage(1)
                }}
                placeholder="试验验收"
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="whitespace-nowrap">状态</span>
              <div className="flex flex-wrap gap-2">
                {(['PENDING', 'IN_PROGRESS', 'APPROVED'] as const).map((item) => (
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
              开始日期
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
              结束日期
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
              关键字（分项/备注/验收内容）
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder="输入关键字后自动过滤"
              />
            </label>
            <div className="flex items-center gap-3 md:col-span-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                onClick={resetFilters}
              >
                重置筛选
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
                onClick={() => {
                  setPage(1)
                  fetchData()
                }}
              >
                立即查询
              </button>
              {loading ? <span className="text-xs text-slate-200">加载中...</span> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-slate-900/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-50">
                已选 {selectedIds.length} 条
              </span>
              {bulkError ? <span className="text-xs text-amber-200">{bulkError}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={columnSelectorRef}>
                <button
                  type="button"
                  className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={() => setShowColumnSelector((prev) => !prev)}
                >
                  选择显示列
                </button>
                {showColumnSelector ? (
                  <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
                    <p className="mb-2 text-[11px] text-slate-300">选择需要展示的字段</p>
                    <div className="flex max-h-48 flex-col gap-2 overflow-auto">
                      {columnOptions.map((option) => (
                        <label key={option.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-slate-900/60 accent-emerald-300"
                            checked={visibleColumns.includes(option.key)}
                            onChange={() => toggleColumnVisibility(option.key)}
                          />
                          <span>{option.label}</span>
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
                <option value="">选择要更新的状态</option>
                {(['PENDING', 'IN_PROGRESS', 'APPROVED'] as InspectionStatus[]).map((item) => (
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
                {bulkPending ? '批量更新中...' : '批量修改状态'}
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
                        aria-label="全选当页报检记录"
                      />
                      <span className="whitespace-nowrap">序号</span>
                    </div>
                  </th>
                  {isVisible('road') ? (
                    <th className="px-4 py-3">
                      道路
                    </th>
                  ) : null}
                  {isVisible('phase') ? (
                    <th className="px-4 py-3">
                      分项
                    </th>
                  ) : null}
                  {isVisible('side') ? (
                    <th className="px-4 py-3">
                      侧别
                    </th>
                  ) : null}
                  {isVisible('range') ? (
                    <th className="px-4 py-3">
                      区间
                    </th>
                  ) : null}
                  {isVisible('checks') ? (
                    <th className="px-4 py-3">
                      验收内容
                    </th>
                  ) : null}
                  {isVisible('types') ? (
                    <th className="px-4 py-3">
                      验收类型
                    </th>
                  ) : null}
                  {isVisible('status') ? (
                    <th className="px-4 py-3 min-w-[120px]">
                      状态
                    </th>
                  ) : null}
                  {isVisible('createdAt') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('createdAt')}
                    >
                      提交时间 {sortField === 'createdAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  {isVisible('updatedAt') ? (
                    <th
                      className="px-4 py-3 cursor-pointer select-none"
                      onClick={() => handleSort('updatedAt')}
                    >
                      更新时间 {sortField === 'updatedAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-center">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-300">
                      {loading ? '加载中...' : '暂无记录'}
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const displayIndex = (page - 1) * pageSize + index + 1
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
                            aria-label={`选择报检 ${displayIndex}`}
                          />
                          <span>{displayIndex}</span>
                        </div>
                      </td>
                      {isVisible('road') ? <td className="px-4 py-3">{item.roadName}</td> : null}
                      {isVisible('phase') ? <td className="px-4 py-3">{item.phaseName}</td> : null}
                      {isVisible('side') ? <td className="px-4 py-3">{sideCopy[item.side] ?? item.side}</td> : null}
                      {isVisible('range') ? (
                        <td className="px-4 py-3">
                          {formatPK(item.startPk)} → {formatPK(item.endPk)}
                        </td>
                      ) : null}
                      {isVisible('checks') ? (
                        <td className="px-4 py-3 max-w-xs truncate" title={item.checks.join(' / ')}>
                          {item.checks.join(' / ')}
                        </td>
                      ) : null}
                      {isVisible('types') ? (
                        <td className="px-4 py-3 max-w-xs truncate" title={item.types.join(' / ')}>
                          {item.types.join(' / ')}
                        </td>
                      ) : null}
                      {isVisible('status') ? (
                        <td className="px-4 py-3 min-w-[120px]">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[item.status] ?? 'bg-white/10 text-slate-100'}`}>
                            {statusCopy[item.status] ?? item.status}
                          </span>
                        </td>
                      ) : null}
                      {isVisible('createdAt') ? (
                        <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.createdAt)}</td>
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
                            编辑
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
                            删除
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
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一页
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
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-900/50 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">报检详情</p>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {selected.phaseName} · {sideCopy[selected.side] ?? selected.side}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {selected.roadName} · {formatPK(selected.startPk)} → {formatPK(selected.endPk)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setSelected(null)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">验收内容</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{selected.checks.join('，')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">验收类型</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{selected.types.join('，')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">状态</p>
                  <p>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[selected.status] ?? 'bg-white/10 text-slate-100'}`}>
                      {statusCopy[selected.status] ?? selected.status}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">提交时间</p>
                  <p>{formatDate(selected.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">更新时间</p>
                  <p>{formatDate(selected.updatedAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">提交人</p>
                  <p>{selected.createdBy?.username ?? '未知'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-400">备注</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {selected.remark || '无备注'}
                  </p>
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
            <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">编辑报检</p>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {editing.roadName} · {editing.phaseName}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {formatPK(editing.startPk)} → {formatPK(editing.endPk)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setEditing(null)}
                  aria-label="关闭编辑"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    分项
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.phaseId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phaseId: e.target.value ? Number(e.target.value) : '' }))}
                    >
                      <option value="">选择分项</option>
                      {editingPhases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    侧别
                    <select
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.side}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, side: e.target.value as IntervalSide }))}
                    >
                      <option value="">选择侧别</option>
                      <option value="LEFT">左侧</option>
                      <option value="RIGHT">右侧</option>
                      <option value="BOTH">双侧</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    起点 PK
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.startPk}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, startPk: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    终点 PK
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.endPk}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, endPk: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    验收层次（逗号分隔）
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.layers}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, layers: e.target.value }))}
                      placeholder="如：基层，面层"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    验收内容（逗号分隔）
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.checks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, checks: e.target.value }))}
                      placeholder="如：厚度，密实度"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    验收类型（逗号分隔）
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={editForm.types}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, types: e.target.value }))}
                      placeholder="如：试验验收"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    预约日期
                    <input
                      type="date"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={editForm.appointmentDate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  备注
                  <textarea
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    rows={3}
                    value={editForm.remark}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, remark: e.target.value }))}
                    placeholder="补充说明"
                  />
                </label>
                {editError ? <p className="text-xs text-amber-200">{editError}</p> : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={() => setEditing(null)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                    onClick={submitEdit}
                    disabled={editPending}
                  >
                    {editPending ? '保存中...' : '保存修改'}
                  </button>
                </div>
              </div>
            </div>
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
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-100">删除确认</p>
                  <h3 className="text-lg font-semibold text-slate-50">{deleteTarget.phaseName}</h3>
                  <p className="text-sm text-slate-300">
                    {deleteTarget.roadName} · {formatPK(deleteTarget.startPk)} → {formatPK(deleteTarget.endPk)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setDeleteTarget(null)}
                  aria-label="关闭删除确认"
                >
                  ×
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-200">确定删除该报检记录吗？此操作不可恢复。</p>
              {deleteError ? <p className="mt-2 text-xs text-amber-200">{deleteError}</p> : null}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={() => setDeleteTarget(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-rose-300 px-4 py-2 text-xs font-semibold text-rose-900 shadow-lg shadow-rose-400/30 transition hover:-translate-y-0.5 disabled:opacity-60"
                  onClick={confirmDelete}
                  disabled={deletePending}
                >
                  {deletePending ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
