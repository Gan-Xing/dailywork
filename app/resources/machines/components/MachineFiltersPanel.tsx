import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import type { ResourcesCopy } from '@/lib/i18n/resources'

export function MachineFiltersPanel({
  t,
  assetCategoryNameOptions,
  assetStatusNameOptions,
  manufacturerOptions,
  registrationMonthOptions,
  assetCategoryNameFilters,
  assetStatusNameFilters,
  manufacturerFilters,
  registrationMonthFilters,
  setAssetCategoryNameFilters,
  setAssetStatusNameFilters,
  setManufacturerFilters,
  setRegistrationMonthFilters,
}: {
  t: ResourcesCopy
  assetCategoryNameOptions: MultiSelectOption[]
  assetStatusNameOptions: MultiSelectOption[]
  manufacturerOptions: MultiSelectOption[]
  registrationMonthOptions: MultiSelectOption[]
  assetCategoryNameFilters: string[]
  assetStatusNameFilters: string[]
  manufacturerFilters: string[]
  registrationMonthFilters: string[]
  setAssetCategoryNameFilters: (value: string[]) => void
  setAssetStatusNameFilters: (value: string[]) => void
  setManufacturerFilters: (value: string[]) => void
  setRegistrationMonthFilters: (value: string[]) => void
}) {
  const filterCopy = {
    allLabel: t.common.all,
    selectedLabel: t.common.selected,
    selectAllLabel: t.common.selectAll,
    clearLabel: t.common.clear,
    searchPlaceholder: t.common.searchPlaceholder,
    noOptionsLabel: t.common.noOptions,
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MultiSelectFilter
        label={t.machines.filters.assetCategoryName}
        options={assetCategoryNameOptions}
        selected={assetCategoryNameFilters}
        onChange={setAssetCategoryNameFilters}
        allLabel={filterCopy.allLabel}
        selectedLabel={filterCopy.selectedLabel}
        selectAllLabel={filterCopy.selectAllLabel}
        clearLabel={filterCopy.clearLabel}
        searchPlaceholder={filterCopy.searchPlaceholder}
        noOptionsLabel={filterCopy.noOptionsLabel}
      />
      <MultiSelectFilter
        label={t.machines.filters.assetStatusName}
        options={assetStatusNameOptions}
        selected={assetStatusNameFilters}
        onChange={setAssetStatusNameFilters}
        allLabel={filterCopy.allLabel}
        selectedLabel={filterCopy.selectedLabel}
        selectAllLabel={filterCopy.selectAllLabel}
        clearLabel={filterCopy.clearLabel}
        searchPlaceholder={filterCopy.searchPlaceholder}
        noOptionsLabel={filterCopy.noOptionsLabel}
      />
      <MultiSelectFilter
        label={t.machines.filters.manufacturer}
        options={manufacturerOptions}
        selected={manufacturerFilters}
        onChange={setManufacturerFilters}
        allLabel={filterCopy.allLabel}
        selectedLabel={filterCopy.selectedLabel}
        selectAllLabel={filterCopy.selectAllLabel}
        clearLabel={filterCopy.clearLabel}
        searchPlaceholder={filterCopy.searchPlaceholder}
        noOptionsLabel={filterCopy.noOptionsLabel}
      />
      <MultiSelectFilter
        label={t.machines.filters.registrationMonth}
        options={registrationMonthOptions}
        selected={registrationMonthFilters}
        onChange={setRegistrationMonthFilters}
        allLabel={filterCopy.allLabel}
        selectedLabel={filterCopy.selectedLabel}
        selectAllLabel={filterCopy.selectAllLabel}
        clearLabel={filterCopy.clearLabel}
        searchPlaceholder={filterCopy.searchPlaceholder}
        noOptionsLabel={filterCopy.noOptionsLabel}
        className="sm:col-span-2 lg:col-span-1"
      />
    </div>
  )
}

