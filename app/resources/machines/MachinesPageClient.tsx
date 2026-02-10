'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { ActionButton } from '@/components/ActionButton'
import { FilterDrawer } from '@/components/FilterDrawer'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'
import {
  EMPTY_MACHINE_FILTER_VALUE,
  MACHINE_COLUMN_STORAGE_KEY,
  MACHINE_SEARCH_STORAGE_KEY,
  defaultMachineSortStack,
  defaultVisibleMachineColumns,
  machineColumnGroups,
  machineColumnOrder,
  type MachineColumnKey,
  type MachineSortField,
  type MachineSortOrder,
} from '@/lib/resources/machines/constants'
import { getMachineEquipmentTypeLabel, isMachineEquipmentTypeKey } from '@/lib/resources/machines/equipmentTypes'
import { useMachineTableState } from '@/lib/resources/machines/useMachineTableState'
import type { MachineAsset, MachineBulkPatch } from '@/types/machines'

import { ResourcesHeader } from '../ResourcesHeader'
import { useResourcesSession } from '../hooks/useResourcesSession'
import { MachineCreateModal } from './components/MachineCreateModal'
import { MachineDetailModal } from './components/MachineDetailModal'
import { MachineEditModal } from './components/MachineEditModal'
import { MachineFiltersPanel } from './components/MachineFiltersPanel'
import { MachinesTable } from './components/MachinesTable'
import { PaginationBar } from './components/PaginationBar'
import { useFilteredMachines } from './hooks/useFilteredMachines'
import { useMachineImportExport } from './hooks/useMachineImportExport'
import { useMachinesData } from './hooks/useMachinesData'

type Option = { value: string; label: string }

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeKey = (value: string | null | undefined) => normalizeText(value).toLowerCase()

const buildOptions = (values: Array<string | null | undefined>, emptyLabel: string): Option[] => {
  const map = new Map<string, string>()
  values.forEach((value) => {
    const text = normalizeText(value)
    const key = normalizeKey(text)
    if (!key) return
    if (!map.has(key)) map.set(key, text)
  })
  const options = Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
  return [{ value: EMPTY_MACHINE_FILTER_VALUE, label: emptyLabel }, ...options]
}

const toMonthKey = (value: string | null | undefined) => {
  const text = normalizeText(value)
  if (!text) return null
  const iso = text.includes('T') ? text.split('T')[0] ?? '' : text
  if (iso.length >= 7) return iso.slice(0, 7)
  return null
}

const buildMonthOptions = (values: Array<string | null | undefined>, emptyLabel: string): Option[] => {
  const months = values.map(toMonthKey).filter(Boolean) as string[]
  const map = new Map<string, string>()
  months.forEach((month) => {
    if (!map.has(month)) map.set(month, month)
  })
  const options = Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => b.value.localeCompare(a.value))
  return [{ value: EMPTY_MACHINE_FILTER_VALUE, label: emptyLabel }, ...options]
}

export function MachinesPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const {
    authLoaded,
    canViewMachines,
    canCreateMachines,
    canUpdateMachines,
    canManageMachines,
  } = useResourcesSession()

  const {
    filters,
    setFilter,
    page,
    setPage,
    pageInput,
    setPageInput,
    pageSize,
    setPageSize,
    sortStack,
    setSortStack,
    resetFilters,
    filtersHydrated,
  } = useMachineTableState({ defaultPageSize: 20, defaultSortStack: defaultMachineSortStack })

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<number, MachineBulkPatch>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  const { machines, setMachines, loading, error, loadData } = useMachinesData({
    authLoaded,
    canViewMachines,
    loadErrorMessage: t.common.loadFailed,
  })

  const [searchDraft, setSearchDraft] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(MACHINE_SEARCH_STORAGE_KEY)
      if (stored !== null) {
        setSearchKeyword(stored)
        setSearchDraft(stored)
      }
    } catch (err) {
      console.error('Failed to load machine search keyword', err)
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MACHINE_SEARCH_STORAGE_KEY, searchKeyword)
    } catch (err) {
      console.error('Failed to persist machine search keyword', err)
    }
  }, [searchKeyword])
  const commitSearch = useCallback(() => {
    const next = searchDraft.trim()
    setSearchKeyword(next)
    setSearchDraft(next)
  }, [searchDraft])

  const [visibleColumns, setVisibleColumns] = useState<MachineColumnKey[]>(() => [
    ...defaultVisibleMachineColumns,
  ])
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(MACHINE_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        setVisibleColumns(parsed as MachineColumnKey[])
      }
    } catch (err) {
      console.error('Failed to load machine columns', err)
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MACHINE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns))
    } catch (err) {
      console.error('Failed to persist machine columns', err)
    }
  }, [visibleColumns])

  const isVisible = useCallback((key: MachineColumnKey) => visibleColumns.includes(key), [visibleColumns])
  const toggleColumn = useCallback((key: MachineColumnKey) => {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])
  const selectAllColumns = useCallback(() => {
    setVisibleColumns(machineColumnOrder.filter((key) => key !== 'actions'))
  }, [])
  const clearColumns = useCallback(() => {
    setVisibleColumns([])
  }, [])
  const restoreDefaultColumns = useCallback(() => {
    setVisibleColumns([...defaultVisibleMachineColumns])
  }, [])
  const toggleColumnGroup = useCallback((keys: MachineColumnKey[]) => {
    setVisibleColumns((prev) => {
      const allSelected = keys.every((key) => prev.includes(key))
      if (allSelected) {
        return prev.filter((key) => !keys.includes(key))
      }
      const merged = new Set(prev)
      keys.forEach((key) => merged.add(key))
      return Array.from(merged)
    })
  }, [])

  const columns = useMemo(
    () => machineColumnOrder.filter((key) => key === 'actions' || visibleColumns.includes(key)),
    [visibleColumns],
  )

  const bulkReadOnlyColumns = useMemo(() => {
    const readOnly = new Set<MachineColumnKey>([
      'actions',
      'assetNumber',
      'equipmentTypeKey',
      'photoLinks',
      'currentValue',
      'depreciatedMonths',
      'remainingMonths',
      'createdAt',
      'updatedAt',
    ])
    if (!canManageMachines) {
      ;(
        [
          'assetCategoryName',
          'manufacturer',
          'assetName',
          'assetStatusName',
          'specModel',
          'registrationDate',
          'originalValue',
          'usedMonths',
        ] as MachineColumnKey[]
      ).forEach((key) => readOnly.add(key))
    }
    return readOnly
  }, [canManageMachines])

  const bulkEditableColumns = useMemo(
    () => visibleColumns.filter((key) => !bulkReadOnlyColumns.has(key)),
    [bulkReadOnlyColumns, visibleColumns],
  )

  const [showFilterDrawer, setShowFilterDrawer] = useState(false)

  const { filteredMachines, total } = useFilteredMachines({
    machines,
    keyword: searchKeyword,
    sortStack,
    filters,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const resolvedPage = Math.min(Math.max(1, page), totalPages)
  const paginated = useMemo(() => {
    const start = (resolvedPage - 1) * pageSize
    return filteredMachines.slice(start, start + pageSize)
  }, [filteredMachines, pageSize, resolvedPage])

  useEffect(() => {
    if (!filtersHydrated) return
    if (resolvedPage !== page) {
      setPage(resolvedPage)
      setPageInput(String(resolvedPage))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersHydrated, resolvedPage])

  const onPageChange = useCallback(
    (next: number) => {
      const safe = Math.min(totalPages, Math.max(1, next))
      setPage(safe)
      setPageInput(String(safe))
    },
    [setPage, setPageInput, totalPages],
  )

  const onPageSizeChange = useCallback(
    (next: number) => {
      if (!Number.isFinite(next) || next <= 0) return
      setPageSize(next)
      onPageChange(1)
    },
    [onPageChange, setPageSize],
  )

  const handleSortChange = useCallback(
    (field: MachineSortField) => {
      setSortStack((prev) => {
        const existing = prev.find((item) => item.field === field)
        const nextOrder: MachineSortOrder = existing
          ? existing.order === 'asc'
            ? 'desc'
            : 'asc'
          : 'asc'
        const filtered = prev.filter((item) => item.field !== field)
        return [{ field, order: nextOrder }, ...filtered].slice(0, 4)
      })
    },
    [setSortStack],
  )

  const isSortDefault = useMemo(
    () =>
      sortStack.length === defaultMachineSortStack.length &&
      sortStack.every(
        (spec, index) =>
          spec.field === defaultMachineSortStack[index]?.field &&
          spec.order === defaultMachineSortStack[index]?.order,
      ),
    [sortStack],
  )

  const updateBulkDraftField = useCallback(
    (
      machineId: number,
      key: keyof MachineBulkPatch,
      value: string | null | undefined,
    ) => {
      setBulkDrafts((prev) => {
        const next = { ...prev }
        const current = { ...(next[machineId] ?? {}) } as Record<string, unknown>
        if (value === undefined) {
          delete current[key as string]
        } else {
          current[key as string] = value
        }
        if (Object.keys(current).length === 0) {
          delete next[machineId]
          return next
        }
        next[machineId] = current as MachineBulkPatch
        return next
      })
    },
    [],
  )

  const isBulkPatchEmpty = (patch: MachineBulkPatch | undefined) =>
    !patch || Object.keys(patch).length === 0

  const bulkPageDrafts = useMemo(() => {
    const pageIds = new Set(paginated.map((machine) => machine.id))
    return Object.entries(bulkDrafts).filter(
      ([id, patch]) => pageIds.has(Number(id)) && !isBulkPatchEmpty(patch),
    )
  }, [bulkDrafts, paginated])
  const bulkHasChanges = bulkPageDrafts.length > 0

  const startBulkEdit = () => {
    setActionError(null)
    setActionNotice(null)
    setBulkEditMode(true)
  }

  const cancelBulkEdit = () => {
    setBulkDrafts({})
    setBulkSaving(false)
    setBulkEditMode(false)
  }

  const saveBulkEdits = async () => {
    if (!canUpdateMachines && !canManageMachines) {
      setActionError(t.machines.errors.needMachineCreateOrUpdate)
      setActionNotice(null)
      return
    }
    const pageIds = new Set(paginated.map((machine) => machine.id))
    const items = Object.entries(bulkDrafts)
      .filter(([id, patch]) => pageIds.has(Number(id)) && !isBulkPatchEmpty(patch))
      .map(([id, patch]) => ({ id: Number(id), patch }))

    if (items.length === 0) {
      setActionNotice(t.machines.notices.bulkSaveEmpty)
      setActionError(null)
      return
    }

    setBulkSaving(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const res = await fetch('/api/resources/machines/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        results?: Array<{ id: number; ok: boolean; error?: string }>
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? t.machines.errors.saveFailed)
      }

      const results = Array.isArray(data.results) ? data.results : []
      const failed = results.filter((result) => !result.ok)
      const successCount = results.length - failed.length

      if (failed.length > 0) {
        const failedIds = new Set(failed.map((result) => result.id))
        setBulkDrafts((prev) => {
          const next: Record<number, MachineBulkPatch> = {}
          Object.entries(prev).forEach(([id, patch]) => {
            if (failedIds.has(Number(id))) {
              next[Number(id)] = patch
            }
          })
          return next
        })
        setActionError(failed[0]?.error ? String(failed[0].error) : t.machines.errors.saveFailed)
        setActionNotice(t.machines.notices.bulkSavePartial(successCount, failed.length))
      } else {
        setActionNotice(t.machines.notices.bulkSaveSuccess(successCount))
        setBulkDrafts({})
        setBulkEditMode(false)
      }

      if (successCount > 0) {
        await loadData()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.machines.errors.saveFailed)
    } finally {
      setBulkSaving(false)
    }
  }

  const emptyLabel = locale === 'fr' ? 'Vide' : '（空）'

  const assetNumberOptions = useMemo(
    () => buildOptions(machines.map((m) => m.assetNumber), emptyLabel),
    [machines, emptyLabel],
  )
  const assetNameOptions = useMemo(
    () => buildOptions(machines.map((m) => m.assetName), emptyLabel),
    [machines, emptyLabel],
  )
  const assetCategoryNameOptions = useMemo(
    () => buildOptions(machines.map((m) => m.assetCategoryName), emptyLabel),
    [machines, emptyLabel],
  )
  const assetStatusNameOptions = useMemo(
    () => buildOptions(machines.map((m) => m.assetStatusName), emptyLabel),
    [machines, emptyLabel],
  )
  const manufacturerOptions = useMemo(
    () => buildOptions(machines.map((m) => m.manufacturer), emptyLabel),
    [machines, emptyLabel],
  )
  const specModelOptions = useMemo(
    () => buildOptions(machines.map((m) => m.specModel), emptyLabel),
    [machines, emptyLabel],
  )
  const equipmentTypeKeyOptions = useMemo(() => {
    const map = new Map<string, string>()
    machines.forEach((machine) => {
      const raw = (machine.equipmentTypeKey ?? '').trim()
      const key = normalizeKey(raw)
      if (!key) return
      const label = isMachineEquipmentTypeKey(raw) ? getMachineEquipmentTypeLabel(locale, raw) : raw
      if (!map.has(key)) map.set(key, label)
    })
    const options = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
      )
    return [{ value: EMPTY_MACHINE_FILTER_VALUE, label: emptyLabel }, ...options]
  }, [machines, emptyLabel, locale])

  const registrationMonthOptions = useMemo(
    () => buildMonthOptions(machines.map((m) => m.registrationDate), emptyLabel),
    [machines, emptyLabel],
  )
  const createdMonthOptions = useMemo(
    () => buildMonthOptions(machines.map((m) => m.createdAt), emptyLabel),
    [machines, emptyLabel],
  )
  const updatedMonthOptions = useMemo(
    () => buildMonthOptions(machines.map((m) => m.updatedAt), emptyLabel),
    [machines, emptyLabel],
  )

  const usageStatusOptions = useMemo(
    () => buildOptions(machines.map((m) => m.usageStatus), emptyLabel),
    [machines, emptyLabel],
  )
  const aliasOptions = useMemo(
    () => buildOptions(machines.map((m) => m.alias), emptyLabel),
    [machines, emptyLabel],
  )
  const plateNumberOptions = useMemo(
    () => buildOptions(machines.map((m) => m.plateNumber), emptyLabel),
    [machines, emptyLabel],
  )

  const originalValueOptions = useMemo(
    () => buildOptions(machines.map((m) => (m.originalValue == null ? null : String(m.originalValue))), emptyLabel),
    [machines, emptyLabel],
  )
  const usedMonthsOptions = useMemo(
    () => buildOptions(machines.map((m) => (m.usedMonths == null ? null : String(m.usedMonths))), emptyLabel),
    [machines, emptyLabel],
  )
  const currentValueOptions = useMemo(
    () => buildOptions(machines.map((m) => (m.currentValue == null ? null : String(m.currentValue))), emptyLabel),
    [machines, emptyLabel],
  )
  const depreciatedMonthsOptions = useMemo(
    () => buildOptions(machines.map((m) => (m.depreciatedMonths == null ? null : String(m.depreciatedMonths))), emptyLabel),
    [machines, emptyLabel],
  )
  const remainingMonthsOptions = useMemo(
    () => buildOptions(machines.map((m) => (m.remainingMonths == null ? null : String(m.remainingMonths))), emptyLabel),
    [machines, emptyLabel],
  )

  const photoLinksCountOptions = useMemo(() => {
    const map = new Map<string, string>()
    machines.forEach((machine) => {
      const count = String(machine.photoCount ?? 0)
      if (!map.has(count)) map.set(count, count)
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => Number(a.value) - Number(b.value))
  }, [machines])

  const filterOptions = useMemo(
    () => ({
      assetCategoryNameFilters: assetCategoryNameOptions,
      assetNumberFilters: assetNumberOptions,
      manufacturerFilters: manufacturerOptions,
      assetNameFilters: assetNameOptions,
      assetStatusNameFilters: assetStatusNameOptions,
      specModelFilters: specModelOptions,
      equipmentTypeKeyFilters: equipmentTypeKeyOptions,
      registrationMonthFilters: registrationMonthOptions,
      originalValueFilters: originalValueOptions,
      usedMonthsFilters: usedMonthsOptions,
      currentValueFilters: currentValueOptions,
      depreciatedMonthsFilters: depreciatedMonthsOptions,
      remainingMonthsFilters: remainingMonthsOptions,
      usageStatusFilters: usageStatusOptions,
      aliasFilters: aliasOptions,
      plateNumberFilters: plateNumberOptions,
      photoLinksCountFilters: photoLinksCountOptions,
      createdMonthFilters: createdMonthOptions,
      updatedMonthFilters: updatedMonthOptions,
    }),
    [
      aliasOptions,
      assetCategoryNameOptions,
      assetNameOptions,
      assetNumberOptions,
      assetStatusNameOptions,
      createdMonthOptions,
      currentValueOptions,
      depreciatedMonthsOptions,
      equipmentTypeKeyOptions,
      manufacturerOptions,
      originalValueOptions,
      photoLinksCountOptions,
      plateNumberOptions,
      registrationMonthOptions,
      remainingMonthsOptions,
      specModelOptions,
      updatedMonthOptions,
      usageStatusOptions,
      usedMonthsOptions,
    ],
  )

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((sum, selected) => sum + selected.length, 0),
    [filters],
  )
  const hasActiveFilters = activeFilterCount > 0

  const stats = useMemo(() => {
    const totalCount = machines.length
    const shownCount = total
    const withPhotos = filteredMachines.filter((machine) => (machine.photoCount ?? 0) > 0).length
    const photoCoverage = shownCount > 0 ? Math.round((withPhotos / shownCount) * 100) : 0

    const sumOriginalValue = filteredMachines.reduce((sum, machine) => {
      const value = machine.originalValue
      return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
    }, 0)
    const sumCurrentValue = filteredMachines.reduce((sum, machine) => {
      const value = machine.currentValue
      return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
    }, 0)

    const formatNumber = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
      maximumFractionDigits: 2,
    })

    const totalHelper =
      shownCount !== totalCount
        ? locale === 'fr'
          ? `${totalCount} total`
          : `总计 ${totalCount}`
        : undefined

    return [
      {
        label: t.machines.stats.count,
        value: String(shownCount),
        helper: totalHelper,
        accent: 'from-sky-500 to-indigo-500',
      },
      {
        label: t.machines.stats.photoCoverage,
        value: `${photoCoverage}%`,
        helper: shownCount > 0 ? `${withPhotos}/${shownCount}` : '—',
        accent: 'from-emerald-500 to-lime-500',
      },
      {
        label: t.machines.stats.originalValueTotal,
        value: formatNumber.format(sumOriginalValue),
        helper: undefined,
        accent: 'from-amber-500 to-orange-500',
      },
      {
        label: t.machines.stats.currentValueTotal,
        value: formatNumber.format(sumCurrentValue),
        helper: undefined,
        accent: 'from-slate-700 to-slate-900',
      },
    ]
  }, [filteredMachines, locale, machines.length, t, total])

  const [selectedMachine, setSelectedMachine] = useState<MachineAsset | null>(null)
  const [editingMachine, setEditingMachine] = useState<MachineAsset | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [ignoreBlanks, setIgnoreBlanks] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!showExportMenu) return
    const onClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showExportMenu])

  const {
    importing,
    exporting,
    templateDownloading,
    handleImportFileChange,
    handleExportFiltered,
    handleExportAll,
    handleDownloadTemplate,
  } =
    useMachineImportExport({
      t,
      canCreateMachines: canCreateMachines || canManageMachines,
      canUpdateMachines: canUpdateMachines || canManageMachines,
      exportMachines: filteredMachines,
      allMachines: machines,
      visibleColumns,
      loadData,
      setActionError,
      setActionNotice,
    })

  if (authLoaded && !canViewMachines) {
    return (
      <AccessDenied locale={locale} permissions={['machine:view']} hint={t.access.needMachineView} />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.breadcrumbs.machines },
        ]}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-8 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full bg-gradient-to-br ${stat.accent}`} />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                  {stat.helper ? (
                    <span className="text-xs font-medium text-emerald-600">{stat.helper}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0 w-full rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing || (!canCreateMachines && !canUpdateMachines && !canManageMachines)}
                >
                  {importing ? `${t.machines.actions.import}…` : t.machines.actions.import}
                </ActionButton>
                <ActionButton onClick={handleDownloadTemplate} disabled={templateDownloading}>
                  {templateDownloading ? `${t.machines.actions.downloadTemplate}…` : t.machines.actions.downloadTemplate}
                </ActionButton>
                <div className="relative" ref={exportMenuRef}>
                  <ActionButton
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    disabled={exporting || machines.length === 0}
                  >
                    <span>{exporting ? `${t.machines.actions.export}…` : t.machines.actions.export}</span>
                    <span aria-hidden>⌵</span>
                  </ActionButton>
                  {showExportMenu ? (
                    <div className="absolute left-0 top-full z-50 mt-2 w-60 origin-top-left rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
                      <div className="py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportMenu(false)
                            void handleExportFiltered()
                          }}
                          disabled={exporting || filteredMachines.length === 0}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>{t.machines.actions.exportFiltered}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            {filteredMachines.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportMenu(false)
                            void handleExportAll()
                          }}
                          disabled={exporting || machines.length === 0}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>{t.machines.actions.exportAll}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            {machines.length}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <ActionButton onClick={() => void loadData()} disabled={loading}>
                  {t.machines.actions.refresh}
                </ActionButton>
                {canManageMachines ? (
                  <ActionButton onClick={() => setCreateModalOpen(true)} disabled={loading}>
                    {t.machines.actions.create}
                  </ActionButton>
                ) : null}
                {!bulkEditMode ? (
                  <ActionButton
                    onClick={startBulkEdit}
                    disabled={loading || (!canUpdateMachines && !canManageMachines)}
                  >
                    {t.machines.actions.bulkEdit}
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton onClick={() => void saveBulkEdits()} disabled={!bulkHasChanges || bulkSaving}>
                      {bulkSaving ? `${t.machines.actions.saveChanges}…` : t.machines.actions.saveChanges}
                    </ActionButton>
                    <ActionButton onClick={cancelBulkEdit} disabled={bulkSaving}>
                      {t.machines.actions.cancel}
                    </ActionButton>
                  </>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    <input
                      type="checkbox"
                      checked={ignoreBlanks}
                      onChange={(event) => setIgnoreBlanks(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{locale === 'fr' ? 'Ignorer les vides' : '空值不覆盖'}</span>
                  </label>

                  <ActionButton onClick={() => setShowFilterDrawer(true)}>
                    {t.machines.actions.filters}
                    {hasActiveFilters ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </ActionButton>

                  <ActionButton onClick={() => setShowColumnSelector(true)}>
                    <span>{t.machines.actions.columns}</span>
                    <span aria-hidden>⌵</span>
                  </ActionButton>

                  <ActionButton
                    onClick={() => setSortStack(defaultMachineSortStack)}
                    disabled={isSortDefault}
                  >
                    {t.machines.actions.clearSort}
                  </ActionButton>

                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm">
                    <input
                      type="search"
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitSearch()
                        }
                      }}
                      placeholder={locale === 'fr' ? 'Rechercher (n°, nom, fabricant)…' : '搜索编号/名称/厂家/型号…'}
                      aria-label={t.machines.actions.search}
                      className="w-48 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none sm:w-64"
                    />
                    <button
                      type="button"
                      onClick={commitSearch}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
                    >
                      {t.machines.actions.search}
                    </button>
                  </div>
                </div>

                {showColumnSelector ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-slate-200/50 backdrop-blur-sm"
                      onClick={() => setShowColumnSelector(false)}
                    />
                    <div
                      className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {t.machines.actions.columns}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {t.common.selected(visibleColumns.length)} /{' '}
                            {machineColumnOrder.filter((key) => key !== 'actions').length}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowColumnSelector(false)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                        >
                          {t.common.close}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={selectAllColumns}
                        >
                          {t.common.selectAll}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={restoreDefaultColumns}
                        >
                          {t.machines.columnSelector.restore}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          onClick={clearColumns}
                        >
                          {t.common.clear}
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto bg-slate-50/30 px-6 py-6">
                        <div className="grid gap-6">
                          {machineColumnGroups.map((group) => {
                            const keys = Array.from(group.columns) as MachineColumnKey[]
                            const selectedCount = keys.filter((key) => visibleColumns.includes(key)).length
                            const isAllSelected = selectedCount === keys.length
                            return (
                              <section
                                key={group.key}
                                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                              >
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-900">
                                      {t.machines.columnGroups[group.key]}
                                    </h4>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                      {selectedCount} / {keys.length}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleColumnGroup(keys)}
                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                      isAllSelected
                                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                        : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                                    }`}
                                  >
                                    {isAllSelected
                                      ? t.machines.columnSelector.clearGroup
                                      : t.machines.columnSelector.selectGroup}
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                  {keys.map((key) => (
                                    <label
                                      key={key}
                                      className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition hover:bg-slate-50"
                                    >
                                      <div className="relative flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white transition group-hover:border-slate-400">
                                        <input
                                          type="checkbox"
                                          checked={visibleColumns.includes(key)}
                                          onChange={() => toggleColumn(key)}
                                          className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0"
                                        />
                                        <svg
                                          className={`pointer-events-none h-3 w-3 text-sky-600 transition-transform ${
                                            visibleColumns.includes(key) ? 'scale-100' : 'scale-0'
                                          }`}
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3}
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                      <span className="select-none text-xs font-medium text-slate-700 group-hover:text-slate-900">
                                        {t.machines.columns[key]}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </section>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => void handleImportFileChange(event, ignoreBlanks)}
                  className="hidden"
                />
              </div>

              {actionNotice ? (
                <div className="text-sm text-emerald-600 whitespace-pre-line">{actionNotice}</div>
              ) : null}
              {actionError ? (
                <div className="text-sm text-rose-600 whitespace-pre-line">{actionError}</div>
              ) : null}

              {error ? (
                <div className="text-sm text-rose-600 whitespace-pre-line">
                  {t.common.loadFailed}：{error}
                </div>
              ) : null}
            </div>

            <div className="w-full min-w-0 overflow-x-auto">
              {loading ? <div className="p-6 text-sm text-slate-500">{t.common.loading}</div> : null}
              {!loading && total === 0 ? (
                <div className="p-6 text-sm text-slate-500">{t.common.empty}</div>
              ) : null}
              {total > 0 ? (
                <>
                  <MachinesTable
                    t={t}
                    machines={paginated}
                    columns={columns}
                    sortStack={sortStack}
                    onSortChange={handleSortChange}
                    bulkEditMode={bulkEditMode}
                    bulkDrafts={bulkDrafts}
                    bulkEditableColumns={bulkEditableColumns}
                    bulkSaving={bulkSaving}
                    onBulkFieldChange={updateBulkDraftField}
                    onViewMachine={setSelectedMachine}
                    onEditMachine={setEditingMachine}
                    canEdit={canUpdateMachines || canManageMachines}
                    rowOffset={(resolvedPage - 1) * pageSize}
                    serialLabel={locale === 'fr' ? 'N°' : '序号'}
                  />
                  <PaginationBar
                    t={t}
                    totalItems={total}
                    page={resolvedPage}
                    totalPages={totalPages}
                    pageInput={pageInput}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                    onPageInputChange={setPageInput}
                    onPageSizeChange={onPageSizeChange}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <FilterDrawer
        open={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        onClearAll={() => {
          resetFilters()
          setShowFilterDrawer(false)
        }}
        title={t.machines.filters.title}
        clearLabel={t.machines.actions.clearFilters}
        closeLabel={t.common.close}
      >
        <MachineFiltersPanel
          t={t}
          options={filterOptions}
          filters={filters}
          setFilter={setFilter}
        />
      </FilterDrawer>

      <MachineDetailModal
        t={t}
        machine={selectedMachine}
        open={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
      />

      <MachineEditModal
        t={t}
        machine={editingMachine}
        open={Boolean(editingMachine)}
        canEditOperational={canUpdateMachines || canManageMachines}
        canManage={canManageMachines}
        onClose={() => setEditingMachine(null)}
        onSaved={(updated) => {
          setMachines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          setSelectedMachine((prev) => (prev?.id === updated.id ? updated : prev))
          setEditingMachine(null)
        }}
      />

      <MachineCreateModal
        t={t}
        open={createModalOpen}
        canManage={canManageMachines}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(created) => {
          setMachines((prev) => {
            const exists = prev.some((m) => m.id === created.id)
            return exists ? prev : [created, ...prev]
          })
          setCreateModalOpen(false)
          setEditingMachine(created)
        }}
      />
    </main>
  )
}
