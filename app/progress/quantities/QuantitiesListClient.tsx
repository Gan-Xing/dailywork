'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

import type { MultiSelectOption } from '@/components/MultiSelectFilter'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { useToast } from '@/components/ToastProvider'
import type { IntervalBoundPhaseItemDTO, PhaseIntervalManagementRow } from '@/lib/phaseItemTypes'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import { ProgressHeader } from '../ProgressHeader'
import { ProgressSectionNav } from '../ProgressSectionNav'
import { QuantitiesDetailModal } from './QuantitiesDetailModal'

type Props = {
  rows: PhaseIntervalManagementRow[]
  canEdit: boolean
}

type SortKey =
  | 'project'
  | 'road'
  | 'phase'
  | 'startPk'
  | 'endPk'
  | 'side'
  | 'quantity'
  | 'display'
  | 'completed'
  | 'updatedAt'

type ColumnKey =
  | 'project'
  | 'road'
  | 'phase'
  | 'startPk'
  | 'endPk'
  | 'side'
  | 'quantity'
  | 'display'
  | 'completed'
  | 'updatedAt'

type DisplayRow = PhaseIntervalManagementRow & {
  displayLabel: string
  projectKey: string
  projectLabel: string
  updatedDate: string
  sideLabel: string
  completionBucket: string
}

const NO_PROJECT = '__none__'
const COLUMN_STORAGE_KEY = 'progress-quantity-columns'

const displayLabels: Record<string, string> = {
  LINEAR: '延米',
  POINT: '单体',
}

const sideLabels: Record<string, string> = {
  LEFT: '左',
  RIGHT: '右',
  BOTH: '双侧',
}

const defaultVisibleColumns: ColumnKey[] = [
  'road',
  'phase',
  'startPk',
  'endPk',
  'side',
  'quantity',
  'display',
  'completed',
  'updatedAt',
]

const columnOptions: Array<{ key: ColumnKey; label: string }> = [
  { key: 'project', label: '项目' },
  { key: 'road', label: '路段' },
  { key: 'phase', label: '分项名称' },
  { key: 'startPk', label: '起点 PK' },
  { key: 'endPk', label: '终点 PK' },
  { key: 'side', label: '位置' },
  { key: 'quantity', label: '数量' },
  { key: 'display', label: '显示方式' },
  { key: 'completed', label: '完成率' },
  { key: 'updatedAt', label: '更新时间' },
]

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

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value)

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'zh-CN', { sensitivity: 'base' })

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

export default function QuantitiesListClient({ rows, canEdit }: Props) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
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
  const [selectedRoads, setSelectedRoads] = useState<string[]>([])
  const [selectedPhases, setSelectedPhases] = useState<string[]>([])
  const [selectedStartPks, setSelectedStartPks] = useState<string[]>([])
  const [selectedEndPks, setSelectedEndPks] = useState<string[]>([])
  const [selectedSides, setSelectedSides] = useState<string[]>([])
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([])
  const [selectedCompletions, setSelectedCompletions] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [columnsReady, setColumnsReady] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)

  const rowsWithMeta = useMemo<DisplayRow[]>(
    () =>
      rows.map((row) => {
        const projectKey = row.projectId ? String(row.projectId) : NO_PROJECT
        const projectLabel = row.projectName
          ? row.projectCode
            ? `${row.projectName}（${row.projectCode}）`
            : row.projectName
          : '未绑定项目'
        const completedPercent = Math.min(100, Math.max(0, row.completedPercent ?? 0))
        return {
          ...row,
          displayLabel: displayLabels[row.measure] ?? row.measure,
          projectKey,
          projectLabel,
          updatedDate: formatUpdatedDate(row.updatedAt),
          sideLabel: sideLabels[row.side] ?? row.side,
          completionBucket: getCompletionBucket(completedPercent),
        }
      }),
    [rows],
  )

  const projectOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.projectKey,
          label: row.projectLabel,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const roadOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: String(row.roadId),
          label: `${row.roadName}（${row.roadSlug}）`,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const phaseOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.phaseName,
          label: row.phaseName,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const startPkOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: String(row.startPk),
          label: formatNumber(row.startPk, 3),
        })),
      ).sort((a, b) => Number(a.value) - Number(b.value)),
    [rowsWithMeta],
  )
  const endPkOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: String(row.endPk),
          label: formatNumber(row.endPk, 3),
        })),
      ).sort((a, b) => Number(a.value) - Number(b.value)),
    [rowsWithMeta],
  )
  const sideOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.side,
          label: row.sideLabel,
        })),
      ).sort((a, b) => (sideSortWeight[a.value] ?? 99) - (sideSortWeight[b.value] ?? 99)),
    [rowsWithMeta],
  )
  const displayOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.measure,
          label: row.displayLabel,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const completionOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.completionBucket,
          label: row.completionBucket,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const updatedOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.updatedDate,
          label: row.updatedDate,
        })),
      ).sort((a, b) => b.value.localeCompare(a.value)),
    [rowsWithMeta],
  )

  const filterControlProps = {
    allLabel: '全部',
    selectedLabel: (count: number) => `已选 ${count} 项`,
    selectAllLabel: '全选',
    clearLabel: '清空',
    noOptionsLabel: '暂无选项',
    searchPlaceholder: '搜索',
  }
  const sharedFilterProps = { ...filterControlProps, className: 'w-full text-slate-700' }

  const filteredRows = useMemo(() => {
    return rowsWithMeta.filter((row) => {
      if (selectedProjects.length && !selectedProjects.includes(row.projectKey)) {
        return false
      }
      if (selectedRoads.length && !selectedRoads.includes(String(row.roadId))) {
        return false
      }
      if (selectedPhases.length && !selectedPhases.includes(row.phaseName)) {
        return false
      }
      if (selectedStartPks.length && !selectedStartPks.includes(String(row.startPk))) {
        return false
      }
      if (selectedEndPks.length && !selectedEndPks.includes(String(row.endPk))) {
        return false
      }
      if (selectedSides.length && !selectedSides.includes(row.side)) {
        return false
      }
      if (selectedDisplays.length && !selectedDisplays.includes(row.measure)) {
        return false
      }
      if (selectedCompletions.length && !selectedCompletions.includes(row.completionBucket)) {
        return false
      }
      if (selectedDates.length && !selectedDates.includes(row.updatedDate)) {
        return false
      }
      return true
    })
  }, [
    rowsWithMeta,
    selectedProjects,
    selectedRoads,
    selectedPhases,
    selectedStartPks,
    selectedEndPks,
    selectedSides,
    selectedDisplays,
    selectedCompletions,
    selectedDates,
  ])

  const sortedRows = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1
    const sorted = [...filteredRows].sort((a, b) => {
      let result = 0
      switch (sortKey) {
        case 'project':
          result = compareText(a.projectLabel, b.projectLabel)
          break
        case 'road':
          result = compareText(a.roadName, b.roadName)
          break
        case 'phase':
          result = compareText(a.phaseName, b.phaseName)
          break
        case 'startPk':
          result = a.startPk - b.startPk
          break
        case 'endPk':
          result = a.endPk - b.endPk
          break
        case 'side':
          result = (sideSortWeight[a.side] ?? 99) - (sideSortWeight[b.side] ?? 99)
          break
        case 'quantity':
          result = a.quantity - b.quantity
          break
        case 'display':
          result = compareText(a.displayLabel, b.displayLabel)
          break
        case 'completed':
          result = a.completedPercent - b.completedPercent
          break
        case 'updatedAt':
          result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        default:
          result = 0
      }
      if (result === 0) {
        return (a.intervalId - b.intervalId) * direction
      }
      return result * direction
    })
    return sorted
  }, [filteredRows, sortKey, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortOrder('asc')
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-[10px] text-slate-400">↕</span>
    return (
      <span className="text-[10px] text-emerald-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
    )
  }

  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)

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
  }, [])

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

  const columnCount = visibleColumns.length + 1

  const openDetail = (phaseId: number, intervalId: number) => {
    setDetailPhaseId(phaseId)
    setDetailIntervalId(intervalId)
    setDetailOpen(true)
  }

  const unbindInput = async (intervalId: number, inputId: number) => {
    if (!canEdit) return
    try {
      const response = await fetch(`/api/progress/quantities/input?inputId=${inputId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? '解绑失败')
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
      addToast('已解绑该分项内容', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? '解绑失败', { tone: 'danger' })
    }
  }

  const loadBoundItemsBatch = async (intervalIds: number[]) => {
    const pending = intervalIds.filter((id) => !boundItemsByInterval.has(id) && !boundLoading.has(id))
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
      const response = await fetch('/api/progress/quantities/bound-items/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ intervalIds: pending }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        itemsByInterval?: Record<string, IntervalBoundPhaseItemDTO[]>
        message?: string
      }
      if (!response.ok) {
        throw new Error(payload.message ?? '加载绑定明细失败')
      }
      const itemsByInterval = payload.itemsByInterval ?? {}
      setBoundItemsByInterval((prev) => {
        const next = new Map(prev)
        Object.entries(itemsByInterval).forEach(([key, items]) => {
          const id = Number(key)
          if (Number.isInteger(id) && id > 0) {
            next.set(id, Array.isArray(items) ? items : [])
          }
        })
        pending.forEach((id) => {
          if (!next.has(id)) next.set(id, [])
        })
        return next
      })
    } catch (error) {
      setBoundErrors((prev) => {
        const next = new Map(prev)
        pending.forEach((id) => next.set(id, (error as Error).message ?? '加载失败'))
        return next
      })
    } finally {
      setBoundLoading((prev) => {
        const next = new Set(prev)
        pending.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  useEffect(() => {
    if (!showAllDetails) return
    void loadBoundItemsBatch(sortedRows.map((row) => row.intervalId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllDetails, sortedRows])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title="分项工程管理列表"
        subtitle="按区间查看分项工程进度，进入详情可配置公式与清单绑定。"
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '进度管理', href: '/progress' },
          { label: '分项工程管理' },
        ]}
        right={<ProgressSectionNav />}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <span>
              共 {rowsWithMeta.length} 条区间记录，筛选后 {sortedRows.length} 条
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllDetails((prev) => !prev)}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {showAllDetails ? '收起全部明细' : '展开全部明细'}
              </button>
              <div className="relative" ref={columnSelectorRef}>
              <button
                type="button"
                className="flex min-w-[140px] items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setShowColumnSelector((prev) => !prev)}
              >
                <span className="truncate">
                  {visibleColumns.length ? `已选 ${visibleColumns.length} 列` : '未选择列'}
                </span>
                <span className="text-xs text-slate-400">⌕</span>
              </button>
              {showColumnSelector ? (
                <div className="absolute right-0 z-10 mt-2 w-80 max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] text-slate-600">
                    <button className="text-emerald-600 hover:underline" onClick={handleSelectAllColumns}>
                      全选
                    </button>
                    <div className="flex gap-2">
                      <button className="text-slate-500 hover:underline" onClick={handleRestoreDefaultColumns}>
                        恢复默认
                      </button>
                      <button className="text-slate-500 hover:underline" onClick={handleClearColumns}>
                        清空
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
                label="项目"
                options={projectOptions}
                selected={selectedProjects}
                onChange={setSelectedProjects}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="路段"
                options={roadOptions}
                selected={selectedRoads}
                onChange={setSelectedRoads}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="分项名称"
                options={phaseOptions}
                selected={selectedPhases}
                onChange={setSelectedPhases}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="起点 PK"
                options={startPkOptions}
                selected={selectedStartPks}
                onChange={setSelectedStartPks}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="终点 PK"
                options={endPkOptions}
                selected={selectedEndPks}
                onChange={setSelectedEndPks}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="位置"
                options={sideOptions}
                selected={selectedSides}
                onChange={setSelectedSides}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="显示方式"
                options={displayOptions}
                selected={selectedDisplays}
                onChange={setSelectedDisplays}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="完成率"
                options={completionOptions}
                selected={selectedCompletions}
                onChange={setSelectedCompletions}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="更新时间"
                options={updatedOptions}
                selected={selectedDates}
                onChange={setSelectedDates}
                {...sharedFilterProps}
              />
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
                          项目
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
                          路段
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
                          分项名称
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
                          起点 PK
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
                          终点 PK
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
                          位置
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
                          数量
                          {renderSortIcon('quantity')}
                        </button>
                      </th>
                    ) : null}
                    {isVisible('display') ? (
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort('display')}
                          className="flex items-center gap-2 text-left"
                        >
                          显示方式
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
                          完成率
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
                          更新时间
                          {renderSortIcon('updatedAt')}
                        </button>
                      </th>
                    ) : null}
                    <th className="px-4 py-3 text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-500">
                        暂无区间记录
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => {
                      const percent = Math.min(100, Math.max(0, row.completedPercent))
                      const isExpanded = showAllDetails
                      const boundItems = boundItemsByInterval.get(row.intervalId)
                      const boundError = boundErrors.get(row.intervalId) ?? null
                      const isBoundLoading = boundLoading.has(row.intervalId)
                      return (
                        <Fragment key={row.intervalId}>
                          <tr className="text-slate-700">
                            {isVisible('project') ? (
                              <td className="px-4 py-3 text-slate-600">{row.projectLabel}</td>
                            ) : null}
                            {isVisible('road') ? (
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.roadName}</div>
                                <div className="text-xs text-slate-500">{row.roadSlug}</div>
                              </td>
                            ) : null}
                          {isVisible('phase') ? (
                            <td className="px-4 py-3">
                              {row.phaseName}
                              {row.spec ? `（${row.spec}）` : ''}
                            </td>
                          ) : null}
                            {isVisible('startPk') ? (
                              <td className="px-4 py-3 text-slate-600">
                                {formatNumber(row.startPk, 3)}
                              </td>
                            ) : null}
                            {isVisible('endPk') ? (
                              <td className="px-4 py-3 text-slate-600">
                                {formatNumber(row.endPk, 3)}
                              </td>
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
                                      手动
                                    </span>
                                  ) : null}
                                </div>
                                {row.quantityOverridden ? (
                                  <div className="mt-1 text-[10px] text-slate-400">
                                    PK差 {formatNumber(row.rawQuantity, 3)}
                                  </div>
                                ) : null}
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
                                {new Date(row.updatedAt).toLocaleString('zh-CN', {
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
                                  进入详情
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-slate-50/80">
                              <td colSpan={columnCount} className="px-4 py-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      已绑定分项内容
                                    </div>
                                    <div className="text-xs text-slate-500">区间 #{row.intervalId}</div>
                                  </div>

                                  {isBoundLoading ? (
                                    <div className="mt-3 text-sm text-slate-500">正在加载…</div>
                                  ) : boundError ? (
                                    <div className="mt-3 text-sm text-rose-600">{boundError}</div>
                                  ) : !boundItems || boundItems.length === 0 ? (
                                    <div className="mt-3 text-sm text-slate-500">暂无绑定明细</div>
                                  ) : (
                                    <div className="mt-3 overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                                          <tr>
                                            <th className="px-3 py-2 text-left">分项内容</th>
                                            <th className="px-3 py-2 text-right">工程量</th>
                                            <th className="px-3 py-2 text-left">单位</th>
                                            <th className="px-3 py-2 text-left">清单编号</th>
                                            <th className="px-3 py-2 text-right">操作</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                          {boundItems.map((item) => {
                                            const name = `${item.phaseItemName}${item.phaseItemSpec ? `（${item.phaseItemSpec}）` : ''}`
                                            const intervalSpec = item.intervalSpec ? `【${item.intervalSpec}】` : ''
                                            const hasManual = item.manualQuantity !== null
                                            const quantityLabel =
                                              item.effectiveQuantity === null
                                                ? '—'
                                                : formatNumber(item.effectiveQuantity, 3)
                                            return (
                                              <tr key={item.inputId} className="text-slate-700">
                                                <td className="px-3 py-2">
                                                  <div className="font-semibold text-slate-900">
                                                    {intervalSpec} {name}
                                                  </div>
                                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                                    inputId {item.inputId} ·{' '}
                                                    {new Date(item.updatedAt).toLocaleString('zh-CN', {
                                                      dateStyle: 'medium',
                                                      timeStyle: 'short',
                                                    })}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  <div className="flex items-center justify-end gap-2">
                                                    <span>{quantityLabel}</span>
                                                    {hasManual ? (
                                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                        手动
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">{item.unit ?? '—'}</td>
                                                <td className="px-3 py-2 text-slate-600">{item.boqCode ?? '—'}</td>
                                                <td className="px-3 py-2 text-right">
                                                  {canEdit ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => unbindInput(row.intervalId, item.inputId)}
                                                      className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                                    >
                                                      解绑
                                                    </button>
                                                  ) : (
                                                    <span className="text-xs text-slate-400">无权限</span>
                                                  )}
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
                    })
                  )}
                </tbody>
              </table>
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
