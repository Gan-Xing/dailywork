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
  defaultMachineSort,
  defaultVisibleMachineColumns,
  machineColumnOrder,
  type MachineColumnKey,
  type MachineSortField,
} from '@/lib/resources/machines/constants'
import { useMachineTableState } from '@/lib/resources/machines/useMachineTableState'
import type { MachineAsset } from '@/types/machines'

import { ResourcesHeader } from '../ResourcesHeader'
import { useResourcesSession } from '../hooks/useResourcesSession'
import { MachineDetailModal } from './components/MachineDetailModal'
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

const toRegistrationMonth = (date: string | null) => {
  const text = normalizeText(date)
  if (!text) return null
  const iso = text.includes('T') ? text.split('T')[0] ?? '' : text
  if (iso.length >= 7) return iso.slice(0, 7)
  return null
}

export function MachinesPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const {
    authLoaded,
    canViewMachines,
    canCreateMachines,
    canUpdateMachines,
  } = useResourcesSession()

  const {
    filters,
    filterActions,
    page,
    setPage,
    pageInput,
    setPageInput,
    pageSize,
    setPageSize,
    sort,
    setSort,
    resetFilters,
    filtersHydrated,
  } = useMachineTableState({ defaultPageSize: 20, defaultSort: defaultMachineSort })

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const { machines, loading, error, loadData } = useMachinesData({
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
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
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
  useEffect(() => {
    if (!showColumnSelector) return
    const onClick = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showColumnSelector])

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

  const columns = useMemo(
    () => machineColumnOrder.filter((key) => key === 'actions' || visibleColumns.includes(key)),
    [visibleColumns],
  )

  const [showFilterDrawer, setShowFilterDrawer] = useState(false)

  const { filteredMachines, total } = useFilteredMachines({
    machines,
    keyword: searchKeyword,
    sort,
    assetCategoryNameFilters: filters.assetCategoryNameFilters,
    assetStatusNameFilters: filters.assetStatusNameFilters,
    manufacturerFilters: filters.manufacturerFilters,
    registrationMonthFilters: filters.registrationMonthFilters,
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
      setSort((prev) => {
        if (prev.field === field) {
          return { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        }
        return { field, order: 'asc' }
      })
    },
    [setSort],
  )

  const emptyLabel = locale === 'fr' ? 'Vide' : '（空）'

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
  const registrationMonthOptions = useMemo(() => {
    const months = machines.map((m) => toRegistrationMonth(m.registrationDate)).filter(Boolean) as string[]
    const map = new Map<string, string>()
    months.forEach((month) => {
      if (!map.has(month)) map.set(month, month)
    })
    const options = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value))
    return [{ value: EMPTY_MACHINE_FILTER_VALUE, label: emptyLabel }, ...options]
  }, [machines, emptyLabel])

  const hasActiveFilters = Boolean(
    filters.assetCategoryNameFilters.length ||
      filters.assetStatusNameFilters.length ||
      filters.manufacturerFilters.length ||
      filters.registrationMonthFilters.length,
  )

  const [selectedMachine, setSelectedMachine] = useState<MachineAsset | null>(null)

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [ignoreBlanks, setIgnoreBlanks] = useState(true)

  const { importing, exporting, templateDownloading, handleImportFileChange, handleExport, handleDownloadTemplate } =
    useMachineImportExport({
      t,
      canCreateMachines,
      canUpdateMachines,
      machines,
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
          <div className="min-w-0 w-full rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing || (!canCreateMachines && !canUpdateMachines)}
                >
                  {importing ? `${t.machines.actions.import}…` : t.machines.actions.import}
                </ActionButton>
                <ActionButton onClick={handleDownloadTemplate} disabled={templateDownloading}>
                  {templateDownloading ? `${t.machines.actions.downloadTemplate}…` : t.machines.actions.downloadTemplate}
                </ActionButton>
                <ActionButton onClick={handleExport} disabled={exporting || machines.length === 0}>
                  {exporting ? `${t.machines.actions.export}…` : t.machines.actions.export}
                </ActionButton>
                <ActionButton onClick={() => void loadData()} disabled={loading}>
                  {t.machines.actions.refresh}
                </ActionButton>

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
                        {filters.assetCategoryNameFilters.length +
                          filters.assetStatusNameFilters.length +
                          filters.manufacturerFilters.length +
                          filters.registrationMonthFilters.length}
                      </span>
                    ) : null}
                  </ActionButton>

                  <div className="relative" ref={columnSelectorRef}>
                    <ActionButton onClick={() => setShowColumnSelector((prev) => !prev)}>
                      {t.machines.actions.columns}
                    </ActionButton>
                    {showColumnSelector ? (
                      <div className="absolute right-0 mt-2 w-[min(520px,90vw)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 z-50">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{t.machines.actions.columns}</p>
                            <p className="text-xs text-slate-500">
                              {visibleColumns.filter((k) => k !== 'actions').length} /{' '}
                              {machineColumnOrder.filter((k) => k !== 'actions').length}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllColumns}
                              className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                            >
                              {t.common.selectAll}
                            </button>
                            <button
                              type="button"
                              onClick={restoreDefaultColumns}
                              className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              {locale === 'fr' ? 'Défaut' : '默认'}
                            </button>
                            <button
                              type="button"
                              onClick={clearColumns}
                              className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              {t.common.clear}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3">
                          {machineColumnOrder
                            .filter((key) => key !== 'actions')
                            .map((key) => (
                              <label
                                key={key}
                                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={visibleColumns.includes(key)}
                                  onChange={() => toggleColumn(key)}
                                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="truncate" title={t.machines.columns[key]}>
                                  {t.machines.columns[key]}
                                </span>
                              </label>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

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
                    sort={sort}
                    onSortChange={handleSortChange}
                    onViewMachine={setSelectedMachine}
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
          assetCategoryNameOptions={assetCategoryNameOptions}
          assetStatusNameOptions={assetStatusNameOptions}
          manufacturerOptions={manufacturerOptions}
          registrationMonthOptions={registrationMonthOptions}
          assetCategoryNameFilters={filters.assetCategoryNameFilters}
          assetStatusNameFilters={filters.assetStatusNameFilters}
          manufacturerFilters={filters.manufacturerFilters}
          registrationMonthFilters={filters.registrationMonthFilters}
          setAssetCategoryNameFilters={filterActions.setAssetCategoryNameFilters}
          setAssetStatusNameFilters={filterActions.setAssetStatusNameFilters}
          setManufacturerFilters={filterActions.setManufacturerFilters}
          setRegistrationMonthFilters={filterActions.setRegistrationMonthFilters}
        />
      </FilterDrawer>

      <MachineDetailModal
        t={t}
        machine={selectedMachine}
        open={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
      />
    </main>
  )
}
