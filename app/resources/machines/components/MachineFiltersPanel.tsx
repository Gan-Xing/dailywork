import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import type { ResourcesCopy } from '@/lib/i18n/resources'
import type { MachineFiltersState } from '@/lib/resources/machines/useMachineTableState'

const sectionBaseClasses =
  'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md'
const sectionGridClasses = 'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

const themes = {
  emerald: { wrapper: 'bg-emerald-50 border-l-emerald-500', text: 'text-emerald-900' },
  blue: { wrapper: 'bg-blue-50 border-l-blue-500', text: 'text-blue-900' },
  amber: { wrapper: 'bg-amber-50 border-l-amber-500', text: 'text-amber-900' },
  purple: { wrapper: 'bg-purple-50 border-l-purple-500', text: 'text-purple-900' },
}

const SectionHeader = ({ label, theme }: { label: string; theme: keyof typeof themes }) => {
  const style = themes[theme]
  return (
    <div className={`rounded-r-lg border-l-4 px-3 py-2 ${style.wrapper}`}>
      <h3 className={`text-sm font-bold tracking-wide ${style.text}`}>{label}</h3>
    </div>
  )
}

export function MachineFiltersPanel({
  t,
  options,
  filters,
  setFilter,
}: {
  t: ResourcesCopy
  options: Record<keyof MachineFiltersState, MultiSelectOption[]>
  filters: MachineFiltersState
  setFilter: (key: keyof MachineFiltersState, value: string[]) => void
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
    <div className="grid gap-4">
      <details open className={sectionBaseClasses}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader label={t.machines.columnGroups.base} theme="emerald" />
          <span className="text-xs font-semibold text-slate-400" aria-hidden>
            ⌵
          </span>
        </summary>
        <div className={sectionGridClasses}>
          {(
            [
              { key: 'assetNumberFilters', label: t.machines.columns.assetNumber },
              { key: 'assetNameFilters', label: t.machines.columns.assetName },
              { key: 'assetCategoryNameFilters', label: t.machines.columns.assetCategoryName },
              { key: 'manufacturerFilters', label: t.machines.columns.manufacturer },
              { key: 'assetStatusNameFilters', label: t.machines.columns.assetStatusName },
              { key: 'specModelFilters', label: t.machines.columns.specModel },
              { key: 'equipmentTypeKeyFilters', label: t.machines.columns.equipmentTypeKey },
              { key: 'registrationMonthFilters', label: t.machines.filters.registrationMonth },
            ] as Array<{ key: keyof MachineFiltersState; label: string }>
          ).map((item) => (
            <MultiSelectFilter
              key={item.key}
              label={item.label}
              options={options[item.key]}
              selected={filters[item.key]}
              onChange={(value) => setFilter(item.key, value)}
              allLabel={filterCopy.allLabel}
              selectedLabel={filterCopy.selectedLabel}
              selectAllLabel={filterCopy.selectAllLabel}
              clearLabel={filterCopy.clearLabel}
              searchPlaceholder={filterCopy.searchPlaceholder}
              noOptionsLabel={filterCopy.noOptionsLabel}
            />
          ))}
        </div>
      </details>

      <details open className={sectionBaseClasses}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader label={t.machines.columnGroups.finance} theme="blue" />
          <span className="text-xs font-semibold text-slate-400" aria-hidden>
            ⌵
          </span>
        </summary>
        <div className={sectionGridClasses}>
          {(
            [
              { key: 'originalValueFilters', label: t.machines.columns.originalValue },
              { key: 'usedMonthsFilters', label: t.machines.columns.usedMonths },
              { key: 'currentValueFilters', label: t.machines.columns.currentValue },
              { key: 'depreciatedMonthsFilters', label: t.machines.columns.depreciatedMonths },
              { key: 'remainingMonthsFilters', label: t.machines.columns.remainingMonths },
            ] as Array<{ key: keyof MachineFiltersState; label: string }>
          ).map((item) => (
            <MultiSelectFilter
              key={item.key}
              label={item.label}
              options={options[item.key]}
              selected={filters[item.key]}
              onChange={(value) => setFilter(item.key, value)}
              allLabel={filterCopy.allLabel}
              selectedLabel={filterCopy.selectedLabel}
              selectAllLabel={filterCopy.selectAllLabel}
              clearLabel={filterCopy.clearLabel}
              searchPlaceholder={filterCopy.searchPlaceholder}
              noOptionsLabel={filterCopy.noOptionsLabel}
            />
          ))}
        </div>
      </details>

      <details open className={sectionBaseClasses}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader label={t.machines.columnGroups.operations} theme="amber" />
          <span className="text-xs font-semibold text-slate-400" aria-hidden>
            ⌵
          </span>
        </summary>
        <div className={sectionGridClasses}>
          {(
            [
              { key: 'usageStatusFilters', label: t.machines.columns.usageStatus },
              { key: 'aliasFilters', label: t.machines.columns.alias },
              { key: 'plateNumberFilters', label: t.machines.columns.plateNumber },
              { key: 'photoLinksCountFilters', label: t.machines.columns.photoLinks },
            ] as Array<{ key: keyof MachineFiltersState; label: string }>
          ).map((item) => (
            <MultiSelectFilter
              key={item.key}
              label={item.label}
              options={options[item.key]}
              selected={filters[item.key]}
              onChange={(value) => setFilter(item.key, value)}
              allLabel={filterCopy.allLabel}
              selectedLabel={filterCopy.selectedLabel}
              selectAllLabel={filterCopy.selectAllLabel}
              clearLabel={filterCopy.clearLabel}
              searchPlaceholder={filterCopy.searchPlaceholder}
              noOptionsLabel={filterCopy.noOptionsLabel}
            />
          ))}
        </div>
      </details>

      <details className={sectionBaseClasses}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader label={t.machines.columnGroups.system} theme="purple" />
          <span className="text-xs font-semibold text-slate-400" aria-hidden>
            ⌵
          </span>
        </summary>
        <div className={sectionGridClasses}>
          {(
            [
              { key: 'createdMonthFilters', label: t.machines.columns.createdAt },
              { key: 'updatedMonthFilters', label: t.machines.columns.updatedAt },
            ] as Array<{ key: keyof MachineFiltersState; label: string }>
          ).map((item) => (
            <MultiSelectFilter
              key={item.key}
              label={item.label}
              options={options[item.key]}
              selected={filters[item.key]}
              onChange={(value) => setFilter(item.key, value)}
              allLabel={filterCopy.allLabel}
              selectedLabel={filterCopy.selectedLabel}
              selectAllLabel={filterCopy.selectAllLabel}
              clearLabel={filterCopy.clearLabel}
              searchPlaceholder={filterCopy.searchPlaceholder}
              noOptionsLabel={filterCopy.noOptionsLabel}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
