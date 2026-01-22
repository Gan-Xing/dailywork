'use client'

import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { getProgressCopy } from '@/lib/i18n/progress'

type ProgressCopy = ReturnType<typeof getProgressCopy>
type InspectionBoardCopy = ProgressCopy['inspectionBoard']

type FilterControlProps = {
  allLabel: string
  selectedLabel: (count: number) => string
  selectAllLabel: string
  clearLabel: string
  noOptionsLabel: string
  searchPlaceholder: string
}

type Option = { value: string; label: string }

type Props = {
  copy: InspectionBoardCopy
  filterControlProps: FilterControlProps
  roadOptions: Option[]
  phaseOptions: Option[]
  sideOptions: Option[]
  layerOptions: Option[]
  checkOptions: Option[]
  checkOptionsEmptyLabel: string
  typeOptions: Option[]
  statusOptions: Option[]
  userOptions: Option[]
  userOptionsEmptyLabel: string
  roadSlugs: string[]
  onRoadSlugsChange: (value: string[]) => void
  phaseDefinitionIds: string[]
  onPhaseDefinitionChange: (value: string[]) => void
  side: string
  onSideChange: (value: string) => void
  layerFilters: string[]
  onLayerFiltersChange: (value: string[]) => void
  checkFilters: string[]
  onCheckFiltersChange: (value: string[]) => void
  typeFilters: string[]
  onTypeFiltersChange: (value: string[]) => void
  statusFilters: string[]
  onStatusFiltersChange: (value: string[]) => void
  startPkFrom: string
  onStartPkFromChange: (value: string) => void
  startPkTo: string
  onStartPkToChange: (value: string) => void
  appointmentDateFrom: string
  appointmentDateTo: string
  onAppointmentDateFromChange: (value: string) => void
  onAppointmentDateToChange: (value: string) => void
  submissionNumbersInput: string
  onSubmissionNumbersInputChange: (value: string) => void
  submittedByIds: string[]
  onSubmittedByIdsChange: (value: string[]) => void
  createdByIds: string[]
  onCreatedByIdsChange: (value: string[]) => void
  updatedByIds: string[]
  onUpdatedByIdsChange: (value: string[]) => void
}

const sectionBaseClasses =
  'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md'
const sectionGridClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

const themes = {
  emerald: { wrapper: 'bg-emerald-50 border-l-emerald-500', text: 'text-emerald-900' },
  blue: { wrapper: 'bg-blue-50 border-l-blue-500', text: 'text-blue-900' },
  amber: { wrapper: 'bg-amber-50 border-l-amber-500', text: 'text-amber-900' },
  purple: { wrapper: 'bg-purple-50 border-l-purple-500', text: 'text-purple-900' },
  rose: { wrapper: 'bg-rose-50 border-l-rose-500', text: 'text-rose-900' },
}

const SectionTitle = ({ label, theme }: { label: string; theme: keyof typeof themes }) => {
  const style = themes[theme]
  return (
    <div className={`mb-4 rounded-r-lg border-l-4 px-3 py-2 ${style.wrapper}`}>
      <h3 className={`text-sm font-bold tracking-wide ${style.text}`}>{label}</h3>
    </div>
  )
}

const inputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner shadow-slate-900/5 focus:border-sky-400 focus:outline-none'

export function InspectionFiltersPanel({
  copy,
  filterControlProps,
  roadOptions,
  phaseOptions,
  sideOptions,
  layerOptions,
  checkOptions,
  checkOptionsEmptyLabel,
  typeOptions,
  statusOptions,
  userOptions,
  userOptionsEmptyLabel,
  roadSlugs,
  onRoadSlugsChange,
  phaseDefinitionIds,
  onPhaseDefinitionChange,
  side,
  onSideChange,
  layerFilters,
  onLayerFiltersChange,
  checkFilters,
  onCheckFiltersChange,
  typeFilters,
  onTypeFiltersChange,
  statusFilters,
  onStatusFiltersChange,
  startPkFrom,
  onStartPkFromChange,
  startPkTo,
  onStartPkToChange,
  appointmentDateFrom,
  appointmentDateTo,
  onAppointmentDateFromChange,
  onAppointmentDateToChange,
  submissionNumbersInput,
  onSubmissionNumbersInputChange,
  submittedByIds,
  onSubmittedByIdsChange,
  createdByIds,
  onCreatedByIdsChange,
  updatedByIds,
  onUpdatedByIdsChange,
}: Props) {
  const sharedFilterProps = { ...filterControlProps, className: 'w-full' }
  const userFilterProps = { ...sharedFilterProps, noOptionsLabel: userOptionsEmptyLabel }

  return (
    <div className="flex flex-col gap-6">
      <section className={sectionBaseClasses}>
        <SectionTitle label={copy.filters.groups.location} theme="emerald" />
        <div className={sectionGridClasses}>
          <MultiSelectFilter
            label={copy.filters.road}
            options={roadOptions}
            selected={roadSlugs}
            onChange={onRoadSlugsChange}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={copy.filters.phase}
            options={phaseOptions}
            selected={phaseDefinitionIds}
            onChange={onPhaseDefinitionChange}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={copy.filters.side}
            options={sideOptions}
            selected={side ? [side] : []}
            multiple={false}
            onChange={(value) => onSideChange(value[0] ?? '')}
            {...sharedFilterProps}
          />
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {copy.filters.startPkFrom}
            <input
              type="number"
              inputMode="decimal"
              className={inputClassName}
              value={startPkFrom}
              onChange={(event) => onStartPkFromChange(event.target.value)}
              placeholder="e.g. 480"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {copy.filters.startPkTo}
            <input
              type="number"
              inputMode="decimal"
              className={inputClassName}
              value={startPkTo}
              onChange={(event) => onStartPkToChange(event.target.value)}
              placeholder="e.g. 1500"
            />
          </label>
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <SectionTitle label={copy.filters.groups.content} theme="blue" />
        <div className={sectionGridClasses}>
          <MultiSelectFilter
            label={copy.columns.layers}
            options={layerOptions}
            selected={layerFilters}
            onChange={onLayerFiltersChange}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={copy.filters.check}
            options={checkOptions}
            selected={checkFilters}
            onChange={onCheckFiltersChange}
            {...sharedFilterProps}
            noOptionsLabel={checkOptionsEmptyLabel}
          />
          <MultiSelectFilter
            label={copy.filters.type}
            options={typeOptions}
            selected={typeFilters}
            onChange={onTypeFiltersChange}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <SectionTitle label={copy.filters.groups.status} theme="amber" />
        <div className={sectionGridClasses}>
          <MultiSelectFilter
            label={copy.filters.status}
            options={statusOptions}
            selected={statusFilters}
            onChange={onStatusFiltersChange}
            {...sharedFilterProps}
          />
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {copy.filters.appointmentDateFrom}
            <input
              type="date"
              className={inputClassName}
              value={appointmentDateFrom}
              onChange={(event) => onAppointmentDateFromChange(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {copy.filters.appointmentDateTo}
            <input
              type="date"
              className={inputClassName}
              value={appointmentDateTo}
              onChange={(event) => onAppointmentDateToChange(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <SectionTitle label={copy.filters.groups.submission} theme="purple" />
        <div className={sectionGridClasses}>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {copy.filters.submissionNumber}
            <input
              type="text"
              className={inputClassName}
              value={submissionNumbersInput}
              onChange={(event) => onSubmissionNumbersInputChange(event.target.value)}
              placeholder={copy.filters.submissionNumberPlaceholder}
            />
          </label>
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <SectionTitle label={copy.filters.groups.people} theme="rose" />
        <div className={sectionGridClasses}>
          <MultiSelectFilter
            label={copy.filters.submittedBy}
            options={userOptions}
            selected={submittedByIds}
            onChange={onSubmittedByIdsChange}
            {...userFilterProps}
          />
          <MultiSelectFilter
            label={copy.filters.createdBy}
            options={userOptions}
            selected={createdByIds}
            onChange={onCreatedByIdsChange}
            {...userFilterProps}
          />
          <MultiSelectFilter
            label={copy.filters.updatedBy}
            options={userOptions}
            selected={updatedByIds}
            onChange={onUpdatedByIdsChange}
            {...userFilterProps}
          />
        </div>
      </section>
    </div>
  )
}
