import { useCallback, useEffect, useReducer, useState } from 'react'

import {
  MACHINE_FILTER_STORAGE_KEY,
  type MachineSortField,
  type MachineSortOrder,
} from './constants'

type SortSpec = { field: MachineSortField; order: MachineSortOrder }

export type MachineFiltersState = {
  assetCategoryNameFilters: string[]
  assetNumberFilters: string[]
  manufacturerFilters: string[]
  assetNameFilters: string[]
  assetStatusNameFilters: string[]
  specModelFilters: string[]
  equipmentTypeKeyFilters: string[]
  registrationMonthFilters: string[]
  originalValueFilters: string[]
  usedMonthsFilters: string[]
  currentValueFilters: string[]
  depreciatedMonthsFilters: string[]
  remainingMonthsFilters: string[]
  usageStatusFilters: string[]
  aliasFilters: string[]
  plateNumberFilters: string[]
  photoLinksCountFilters: string[]
  createdMonthFilters: string[]
  updatedMonthFilters: string[]
}

type FilterAction =
  | { type: 'set'; key: keyof MachineFiltersState; value: string[] }
  | { type: 'reset' }
  | { type: 'hydrate'; value: Partial<MachineFiltersState> }

const initialFiltersState: MachineFiltersState = {
  assetCategoryNameFilters: [],
  assetNumberFilters: [],
  manufacturerFilters: [],
  assetNameFilters: [],
  assetStatusNameFilters: [],
  specModelFilters: [],
  equipmentTypeKeyFilters: [],
  registrationMonthFilters: [],
  originalValueFilters: [],
  usedMonthsFilters: [],
  currentValueFilters: [],
  depreciatedMonthsFilters: [],
  remainingMonthsFilters: [],
  usageStatusFilters: [],
  aliasFilters: [],
  plateNumberFilters: [],
  photoLinksCountFilters: [],
  createdMonthFilters: [],
  updatedMonthFilters: [],
}

const filterKeys = Object.keys(initialFiltersState) as Array<keyof MachineFiltersState>

const getStoredFilters = (value: unknown): Partial<MachineFiltersState> => {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return filterKeys.reduce((acc, key) => {
    const entry = record[key]
    if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) {
      acc[key] = entry as string[]
    }
    return acc
  }, {} as Partial<MachineFiltersState>)
}

const filterReducer = (state: MachineFiltersState, action: FilterAction): MachineFiltersState => {
  switch (action.type) {
    case 'set':
      if (state[action.key] === action.value) return state
      return { ...state, [action.key]: action.value }
    case 'reset':
      return initialFiltersState
    case 'hydrate':
      return { ...initialFiltersState, ...action.value }
    default:
      return state
  }
}

type Options = {
  defaultPageSize?: number
  defaultSortStack?: SortSpec[]
}

export function useMachineTableState(options: Options = {}) {
  const [filters, dispatch] = useReducer(filterReducer, initialFiltersState)
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [filtersLoadedFromStorage, setFiltersLoadedFromStorage] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize, setPageSize] = useState(options.defaultPageSize ?? 20)
  const [sortStack, setSortStack] = useState<SortSpec[]>(options.defaultSortStack ?? [])

  const setFilter = useCallback((key: keyof MachineFiltersState, value: string[]) => {
    dispatch({ type: 'set', key, value })
  }, [])

  const resetFilters = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(MACHINE_FILTER_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      const next = getStoredFilters(parsed)
      if (Object.keys(next).length > 0) {
        dispatch({ type: 'hydrate', value: next })
        setFiltersLoadedFromStorage(true)
      }
    } catch (error) {
      console.error('Failed to load machine filters', error)
    } finally {
      setFiltersHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MACHINE_FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch (error) {
      console.error('Failed to persist machine filters', error)
    }
  }, [filters, filtersHydrated])

  return {
    filters,
    setFilter,
    filtersOpen,
    setFiltersOpen,
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
    filtersLoadedFromStorage,
  }
}
