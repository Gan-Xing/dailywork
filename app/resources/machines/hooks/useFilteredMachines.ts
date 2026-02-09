import { useMemo } from 'react'

import { EMPTY_MACHINE_FILTER_VALUE, type MachineSortField, type MachineSortOrder } from '@/lib/resources/machines/constants'
import type { MachineAsset } from '@/types/machines'

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeKey = (value: string | null | undefined) => normalizeText(value).toLowerCase()

const parseSearchTerms = (keyword: string) =>
  keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

const toRegistrationMonth = (date: string | null) => {
  const text = normalizeText(date)
  if (!text) return null
  // Accept YYYY-MM-DD or ISO.
  const iso = text.includes('T') ? text.split('T')[0] ?? '' : text
  if (iso.length >= 7) return iso.slice(0, 7)
  return null
}

const compareNullable = <T,>(a: T | null | undefined, b: T | null | undefined) => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function useFilteredMachines({
  machines,
  keyword,
  sort,
  assetCategoryNameFilters,
  assetStatusNameFilters,
  manufacturerFilters,
  registrationMonthFilters,
}: {
  machines: MachineAsset[]
  keyword: string
  sort: { field: MachineSortField; order: MachineSortOrder }
  assetCategoryNameFilters: string[]
  assetStatusNameFilters: string[]
  manufacturerFilters: string[]
  registrationMonthFilters: string[]
}) {
  return useMemo(() => {
    const keywordTerms = parseSearchTerms(keyword)
    const hasKeyword = keywordTerms.length > 0

    const matchesValueFilter = (value: string | null | undefined, filters: string[]) => {
      if (filters.length === 0) return true
      const normalized = normalizeKey(value)
      if (!normalized) return filters.includes(EMPTY_MACHINE_FILTER_VALUE)
      return filters.includes(normalized)
    }

    const matchesMonthFilter = (value: string | null, filters: string[]) => {
      if (filters.length === 0) return true
      const key = toRegistrationMonth(value)
      if (!key) return filters.includes(EMPTY_MACHINE_FILTER_VALUE)
      return filters.includes(key)
    }

    const matchesKeyword = (machine: MachineAsset) => {
      if (!hasKeyword) return true
      const values: string[] = []
      const add = (value: string | null | undefined) => {
        const normalized = normalizeKey(value)
        if (normalized) values.push(normalized)
      }
      add(machine.assetNumber)
      add(machine.assetName)
      add(machine.assetCategoryName)
      add(machine.assetStatusName)
      add(machine.manufacturer)
      add(machine.specModel)
      add(machine.alias)
      add(machine.plateNumber)
      add(machine.usageStatus)
      const haystack = values.join(' ')
      return keywordTerms.every((term) => haystack.includes(term))
    }

    const filtered = machines
      .filter((machine) => matchesKeyword(machine))
      .filter((machine) => matchesValueFilter(machine.assetCategoryName, assetCategoryNameFilters))
      .filter((machine) => matchesValueFilter(machine.assetStatusName, assetStatusNameFilters))
      .filter((machine) => matchesValueFilter(machine.manufacturer, manufacturerFilters))
      .filter((machine) => matchesMonthFilter(machine.registrationDate, registrationMonthFilters))

    const orderMultiplier = sort.order === 'asc' ? 1 : -1
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

    const sorted = [...filtered].sort((a, b) => {
      const field = sort.field
      let cmp = 0
      switch (field) {
        case 'registrationDate':
          cmp = compareNullable(a.registrationDate ?? null, b.registrationDate ?? null)
          break
        case 'originalValue':
          cmp = compareNullable(a.originalValue, b.originalValue)
          break
        case 'currentValue':
          cmp = compareNullable(a.currentValue, b.currentValue)
          break
        case 'usedMonths':
          cmp = compareNullable(a.usedMonths, b.usedMonths)
          break
        case 'depreciatedMonths':
          cmp = compareNullable(a.depreciatedMonths, b.depreciatedMonths)
          break
        case 'remainingMonths':
          cmp = compareNullable(a.remainingMonths, b.remainingMonths)
          break
        case 'createdAt':
          cmp = compareNullable(a.createdAt, b.createdAt)
          break
        case 'updatedAt':
          cmp = compareNullable(a.updatedAt, b.updatedAt)
          break
        default: {
          const av = normalizeText((a as Record<string, unknown>)[field] as string | null)
          const bv = normalizeText((b as Record<string, unknown>)[field] as string | null)
          cmp = collator.compare(av, bv)
          break
        }
      }
      if (cmp === 0) {
        cmp = collator.compare(a.assetNumber, b.assetNumber)
      }
      return cmp * orderMultiplier
    })

    return {
      filteredMachines: sorted,
      total: sorted.length,
    }
  }, [
    machines,
    keyword,
    sort,
    assetCategoryNameFilters,
    assetStatusNameFilters,
    manufacturerFilters,
    registrationMonthFilters,
  ])
}

