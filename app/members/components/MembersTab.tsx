import type { ChangeEvent, ReactNode, RefObject } from 'react'

import { MemberFilterDrawer } from '@/components/members/MemberFilterDrawer'
import { ActionButton } from '@/components/members/MemberButtons'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import type { ColumnKey, SortField } from '@/lib/members/constants'
import type { Member, MemberBulkPatch, Role } from '@/types/members'

import { MemberFiltersPanel } from './MemberFiltersPanel'
import { MembersTable } from './MembersTable'
import { PaginationBar } from './PaginationBar'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type FilterControlProps = {
  allLabel: string
  selectedLabel: (count: number) => string
  selectAllLabel: string
  clearLabel: string
  noOptionsLabel: string
  searchPlaceholder: string
}

type Option = { value: string; label: string }

type MembersTabProps = {
  t: MemberCopy
  canViewMembers: boolean
  canCreateMember: boolean
  canUpdateMember: boolean
  canDeleteMember: boolean
  submitting: boolean
  bulkEditMode: boolean
  bulkSaving: boolean
  bulkHasChanges: boolean
  bulkDrafts: Record<number, MemberBulkPatch>
  bulkEditableColumns: ColumnKey[]
  teamOptions: string[]
  chineseSupervisorOptions: { value: string; label: string }[]
  onStartBulkEdit: () => void
  onCancelBulkEdit: () => void
  onSaveBulkEdit: () => void
  onBulkFieldChange: (memberId: number, path: string, value: string | null | undefined) => void
  canAssignRole: boolean
  loading: boolean
  error: string | null
  actionError: string | null
  actionNotice: string | null
  importing: boolean
  contractChangeImporting: boolean
  contractChangeTemplateDownloading: boolean
  exporting: boolean
  templateDownloading: boolean
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onContractChangeImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onContractChangeTemplateDownload: () => void
  showCreateModal: boolean
  showFilterDrawer: boolean
  onOpenFilterDrawer: () => void
  onCloseFilterDrawer: () => void
  onClearFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
  filterControlProps: FilterControlProps
  nameFilterOptions: Option[]
  usernameFilterOptions: Option[]
  genderFilterOptions: Option[]
  nationalityFilterOptions: Option[]
  phoneFilterOptions: Option[]
  tagFilterOptions: Option[]
  joinDateFilterOptions: Option[]
  positionFilterOptions: Option[]
  statusFilterOptions: Option[]
  roleFilterOptions: Option[]
  teamFilterOptions: Option[]
  chineseSupervisorFilterOptions: Option[]
  contractNumberFilterOptions: Option[]
  contractTypeFilterOptions: Option[]
  salaryCategoryFilterOptions: Option[]
  baseSalaryFilterOptions: Option[]
  netMonthlyFilterOptions: Option[]
  maritalStatusFilterOptions: Option[]
  childrenCountFilterOptions: Option[]
  cnpsNumberFilterOptions: Option[]
  cnpsDeclarationCodeFilterOptions: Option[]
  provenanceFilterOptions: Option[]
  frenchNameFilterOptions: Option[]
  idNumberFilterOptions: Option[]
  passportNumberFilterOptions: Option[]
  educationAndMajorFilterOptions: Option[]
  certificationsFilterOptions: Option[]
  domesticMobileFilterOptions: Option[]
  emergencyContactNameFilterOptions: Option[]
  emergencyContactPhoneFilterOptions: Option[]
  redBookValidYearsFilterOptions: Option[]
  cumulativeAbroadYearsFilterOptions: Option[]
  birthplaceFilterOptions: Option[]
  residenceInChinaFilterOptions: Option[]
  medicalHistoryFilterOptions: Option[]
  healthStatusFilterOptions: Option[]
  createdAtFilterOptions: Option[]
  updatedAtFilterOptions: Option[]
  nameFilters: string[]
  usernameFilters: string[]
  genderFilters: string[]
  nationalityFilters: string[]
  phoneFilters: string[]
  tagFilters: string[]
  joinDateFilters: string[]
  positionFilters: string[]
  statusFilters: string[]
  roleFilters: string[]
  teamFilters: string[]
  chineseSupervisorFilters: string[]
  contractNumberFilters: string[]
  contractTypeFilters: string[]
  salaryCategoryFilters: string[]
  baseSalaryFilters: string[]
  netMonthlyFilters: string[]
  maritalStatusFilters: string[]
  childrenCountFilters: string[]
  cnpsNumberFilters: string[]
  cnpsDeclarationCodeFilters: string[]
  provenanceFilters: string[]
  frenchNameFilters: string[]
  idNumberFilters: string[]
  passportNumberFilters: string[]
  educationAndMajorFilters: string[]
  certificationsFilters: string[]
  domesticMobileFilters: string[]
  emergencyContactNameFilters: string[]
  emergencyContactPhoneFilters: string[]
  redBookValidYearsFilters: string[]
  cumulativeAbroadYearsFilters: string[]
  birthplaceFilters: string[]
  residenceInChinaFilters: string[]
  medicalHistoryFilters: string[]
  healthStatusFilters: string[]
  createdAtFilters: string[]
  updatedAtFilters: string[]
  setNameFilters: (value: string[]) => void
  setUsernameFilters: (value: string[]) => void
  setGenderFilters: (value: string[]) => void
  setNationalityFilters: (value: string[]) => void
  setPhoneFilters: (value: string[]) => void
  setTagFilters: (value: string[]) => void
  setJoinDateFilters: (value: string[]) => void
  setPositionFilters: (value: string[]) => void
  setStatusFilters: (value: string[]) => void
  setRoleFilters: (value: string[]) => void
  setTeamFilters: (value: string[]) => void
  setChineseSupervisorFilters: (value: string[]) => void
  setContractNumberFilters: (value: string[]) => void
  setContractTypeFilters: (value: string[]) => void
  setSalaryCategoryFilters: (value: string[]) => void
  setBaseSalaryFilters: (value: string[]) => void
  setNetMonthlyFilters: (value: string[]) => void
  setMaritalStatusFilters: (value: string[]) => void
  setChildrenCountFilters: (value: string[]) => void
  setCnpsNumberFilters: (value: string[]) => void
  setCnpsDeclarationCodeFilters: (value: string[]) => void
  setProvenanceFilters: (value: string[]) => void
  setFrenchNameFilters: (value: string[]) => void
  setIdNumberFilters: (value: string[]) => void
  setPassportNumberFilters: (value: string[]) => void
  setEducationAndMajorFilters: (value: string[]) => void
  setCertificationsFilters: (value: string[]) => void
  setDomesticMobileFilters: (value: string[]) => void
  setEmergencyContactNameFilters: (value: string[]) => void
  setEmergencyContactPhoneFilters: (value: string[]) => void
  setRedBookValidYearsFilters: (value: string[]) => void
  setCumulativeAbroadYearsFilters: (value: string[]) => void
  setBirthplaceFilters: (value: string[]) => void
  setResidenceInChinaFilters: (value: string[]) => void
  setMedicalHistoryFilters: (value: string[]) => void
  setHealthStatusFilters: (value: string[]) => void
  setCreatedAtFilters: (value: string[]) => void
  setUpdatedAtFilters: (value: string[]) => void
  columnOptions: { key: ColumnKey; label: ReactNode }[]
  visibleColumns: ColumnKey[]
  showColumnSelector: boolean
  onToggleColumn: (key: ColumnKey) => void
  onToggleColumnGroup: (keys: ColumnKey[]) => void
  onSelectAllColumns: () => void
  onRestoreDefaultColumns: () => void
  onClearColumns: () => void
  onToggleColumnSelector: () => void
  isVisible: (key: ColumnKey) => boolean
  isSortDefault: boolean
  onClearSort: () => void
  onOpenCreateModal: () => void
  onImportClick: () => void
  onContractChangeImportClick: () => void
  onExport: () => void
  onDownloadTemplate: () => void
  importInputRef: RefObject<HTMLInputElement>
  contractChangeImportInputRef: RefObject<HTMLInputElement>
  columnSelectorRef: RefObject<HTMLDivElement>
  handleSort: (field: SortField) => void
  sortIndicator: (field: SortField) => string
  members: Member[]
  rolesData: Role[]
  locale: Locale
  statusLabels: Record<string, string>
  formatProfileText: (value?: string | null) => string
  formatProfileNumber: (value?: number | null) => string
  formatProfileList: (values?: string[] | null) => string
  formatSalary: (amount?: string | null, unit?: 'MONTH' | 'HOUR' | null, fallbackUnit?: 'MONTH' | 'HOUR' | null) => string
  findGenderLabel: (value: string | null) => string
  findNationalityLabel: (value: string | null) => string
  onViewMember: (member: Member) => void
  onEditMember: (member: Member) => void
  onDeleteMember: (member: Member) => void
  page: number
  pageSize: number
  totalPages: number
  totalMembers: number
  pageInput: string
  onPageChange: (next: number) => void
  onPageInputChange: (next: string) => void
  onPageSizeChange: (next: number) => void
  stats: { label: string; value: number | string; accent: string; helper?: string }[]
}

export function MembersTab(props: MembersTabProps) {
  const {
    t,
    canViewMembers,
    canCreateMember,
    canUpdateMember,
    canDeleteMember,
    submitting,
    bulkEditMode,
    bulkSaving,
    bulkHasChanges,
    bulkDrafts,
    bulkEditableColumns,
    teamOptions,
    chineseSupervisorOptions,
    onStartBulkEdit,
    onCancelBulkEdit,
    onSaveBulkEdit,
    onBulkFieldChange,
    canAssignRole,
    loading,
    error,
    actionError,
    actionNotice,
  importing,
  contractChangeImporting,
  contractChangeTemplateDownloading,
  exporting,
  templateDownloading,
  onImportFileChange,
  onContractChangeImportFileChange,
  onContractChangeTemplateDownload,
    showCreateModal,
    showFilterDrawer,
    onOpenFilterDrawer,
    onCloseFilterDrawer,
    onClearFilters,
    hasActiveFilters,
    activeFilterCount,
    filterControlProps,
    nameFilterOptions,
    usernameFilterOptions,
    genderFilterOptions,
    nationalityFilterOptions,
    phoneFilterOptions,
    tagFilterOptions,
    joinDateFilterOptions,
    positionFilterOptions,
    statusFilterOptions,
    roleFilterOptions,
    teamFilterOptions,
    chineseSupervisorFilterOptions,
    contractNumberFilterOptions,
    contractTypeFilterOptions,
    salaryCategoryFilterOptions,
    baseSalaryFilterOptions,
    netMonthlyFilterOptions,
    maritalStatusFilterOptions,
    childrenCountFilterOptions,
    cnpsNumberFilterOptions,
    cnpsDeclarationCodeFilterOptions,
    provenanceFilterOptions,
    frenchNameFilterOptions,
    idNumberFilterOptions,
    passportNumberFilterOptions,
    educationAndMajorFilterOptions,
    certificationsFilterOptions,
    domesticMobileFilterOptions,
    emergencyContactNameFilterOptions,
    emergencyContactPhoneFilterOptions,
    redBookValidYearsFilterOptions,
    cumulativeAbroadYearsFilterOptions,
    birthplaceFilterOptions,
    residenceInChinaFilterOptions,
    medicalHistoryFilterOptions,
    healthStatusFilterOptions,
    createdAtFilterOptions,
    updatedAtFilterOptions,
    nameFilters,
    usernameFilters,
    genderFilters,
    nationalityFilters,
    phoneFilters,
    tagFilters,
    joinDateFilters,
    positionFilters,
    statusFilters,
    roleFilters,
    teamFilters,
    chineseSupervisorFilters,
    contractNumberFilters,
    contractTypeFilters,
    salaryCategoryFilters,
    baseSalaryFilters,
    netMonthlyFilters,
    maritalStatusFilters,
    childrenCountFilters,
    cnpsNumberFilters,
    cnpsDeclarationCodeFilters,
    provenanceFilters,
    frenchNameFilters,
    idNumberFilters,
    passportNumberFilters,
    educationAndMajorFilters,
    certificationsFilters,
    domesticMobileFilters,
    emergencyContactNameFilters,
    emergencyContactPhoneFilters,
    redBookValidYearsFilters,
    cumulativeAbroadYearsFilters,
    birthplaceFilters,
    residenceInChinaFilters,
    medicalHistoryFilters,
    healthStatusFilters,
    createdAtFilters,
    updatedAtFilters,
    setNameFilters,
    setUsernameFilters,
    setGenderFilters,
    setNationalityFilters,
    setPhoneFilters,
    setTagFilters,
    setJoinDateFilters,
    setPositionFilters,
    setStatusFilters,
    setRoleFilters,
    setTeamFilters,
    setChineseSupervisorFilters,
    setContractNumberFilters,
    setContractTypeFilters,
    setSalaryCategoryFilters,
    setBaseSalaryFilters,
    setNetMonthlyFilters,
    setMaritalStatusFilters,
    setChildrenCountFilters,
    setCnpsNumberFilters,
    setCnpsDeclarationCodeFilters,
    setProvenanceFilters,
    setFrenchNameFilters,
    setIdNumberFilters,
    setPassportNumberFilters,
    setEducationAndMajorFilters,
    setCertificationsFilters,
    setDomesticMobileFilters,
    setEmergencyContactNameFilters,
    setEmergencyContactPhoneFilters,
    setRedBookValidYearsFilters,
    setCumulativeAbroadYearsFilters,
    setBirthplaceFilters,
    setResidenceInChinaFilters,
    setMedicalHistoryFilters,
    setHealthStatusFilters,
    setCreatedAtFilters,
    setUpdatedAtFilters,
    columnOptions,
    visibleColumns,
    showColumnSelector,
    onToggleColumn,
    onToggleColumnGroup,
    onSelectAllColumns,
    onRestoreDefaultColumns,
    onClearColumns,
    onToggleColumnSelector,
    isVisible,
    isSortDefault,
    onClearSort,
    onOpenCreateModal,
    onImportClick,
    onContractChangeImportClick,
    onExport,
    onDownloadTemplate,
    importInputRef,
    contractChangeImportInputRef,
    columnSelectorRef,
    handleSort,
    sortIndicator,
    members,
    rolesData,
    locale,
    statusLabels,
    formatProfileText,
    formatProfileNumber,
    formatProfileList,
    formatSalary,
    findGenderLabel,
    findNationalityLabel,
    onViewMember,
    onEditMember,
    onDeleteMember,
    page,
    pageSize,
    totalPages,
    totalMembers,
    pageInput,
    onPageChange,
    onPageInputChange,
    onPageSizeChange,
    stats,
  } = props

  const columnGroups = [
    {
      key: 'basic',
      label: t.fieldGroups.basicInfo,
      keys: [
        'sequence',
        'name',
        'username',
        'gender',
        'nationality',
        'phones',
        'joinDate',
        'birthDate',
        'position',
        'employmentStatus',
        'terminationDate',
        'terminationReason',
        'roles',
        'tags',
        'createdAt',
        'updatedAt',
        'actions',
      ] as ColumnKey[],
    },
    {
      key: 'contract',
      label: t.fieldGroups.contract,
      keys: ['contractNumber', 'contractType', 'contractStartDate', 'contractEndDate'] as ColumnKey[],
    },
    {
      key: 'salary',
      label: t.fieldGroups.salary,
      keys: ['salaryCategory', 'prime', 'baseSalary', 'netMonthly'] as ColumnKey[],
    },
    {
      key: 'local',
      label: t.fieldGroups.localProfile,
      keys: [
        'team',
        'chineseSupervisor',
        'maritalStatus',
        'childrenCount',
        'cnpsNumber',
        'cnpsDeclarationCode',
        'provenance',
        'emergencyContactName',
        'emergencyContactPhone',
      ] as ColumnKey[],
    },
    {
      key: 'chinese',
      label: t.fieldGroups.chineseProfile,
      keys: [
        'frenchName',
        'idNumber',
        'passportNumber',
        'educationAndMajor',
        'certifications',
        'domesticMobile',
        'redBookValidYears',
        'cumulativeAbroadYears',
        'birthplace',
        'residenceInChina',
        'medicalHistory',
        'healthStatus',
      ] as ColumnKey[],
    },
  ]
    .map((group) => ({
      ...group,
      options: group.keys
        .map((key) => columnOptions.find((option) => option.key === key))
        .filter((option): option is { key: ColumnKey; label: ReactNode } => Boolean(option)),
    }))
    .filter((group) => group.options.length > 0)

  return (
    <>
      {/* Mini Stats Dashboard */}
      <div className="grid grid-cols-2 gap-4 px-6 pt-6 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full bg-gradient-to-br ${stat.accent}`}
              />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
              {stat.helper && (
                <span className="text-xs font-medium text-emerald-600">{stat.helper}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 border-b border-slate-100 px-6 pb-6 pt-6 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-500">
            {t.listHeading}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenCreateModal}
            disabled={!canCreateMember}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.actions.create}
          </button>
          <ActionButton onClick={onImportClick} disabled={!canCreateMember || importing}>
            {t.actions.import}
          </ActionButton>
          <ActionButton
            onClick={onContractChangeImportClick}
            disabled={!canUpdateMember || contractChangeImporting}
          >
            {t.actions.importContractChanges}
          </ActionButton>
          <ActionButton
            onClick={onContractChangeTemplateDownload}
            disabled={contractChangeTemplateDownloading}
          >
            {t.actions.contractChangeTemplate}
          </ActionButton>
          <ActionButton onClick={onExport} disabled={!canViewMembers || exporting}>
            {t.actions.export}
          </ActionButton>
          <ActionButton onClick={onDownloadTemplate} disabled={templateDownloading}>
            {t.actions.template}
          </ActionButton>
          {!bulkEditMode ? (
            <ActionButton onClick={onStartBulkEdit} disabled={!canUpdateMember || loading}>
              {t.actions.bulkEdit}
            </ActionButton>
          ) : (
            <>
              <ActionButton onClick={onSaveBulkEdit} disabled={!bulkHasChanges || bulkSaving}>
                {t.actions.saveChanges}
              </ActionButton>
              <ActionButton onClick={onCancelBulkEdit} disabled={bulkSaving}>
                {t.actions.cancel}
              </ActionButton>
            </>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onImportFileChange}
            className="hidden"
          />
          <input
            ref={contractChangeImportInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onContractChangeImportFileChange}
            className="hidden"
          />
          <ActionButton onClick={onClearFilters} disabled={!hasActiveFilters}>
            {t.filters.reset}
          </ActionButton>
          <ActionButton onClick={onOpenFilterDrawer}>
            {t.filters.expand}
          </ActionButton>
          <div className="relative" ref={columnSelectorRef}>
            <button
              type="button"
              onClick={onToggleColumnSelector}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t.columnSelector.label}
              <span aria-hidden>⌵</span>
            </button>
            {showColumnSelector ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
                <div
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  onClick={onToggleColumnSelector}
                />
                <div
                  className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/30"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{t.columnSelector.label}</p>
                      <p className="text-xs text-slate-500">
                        {t.filters.selected(visibleColumns.length)} / {columnOptions.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleColumnSelector}
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t.labels.close}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-3 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                        onClick={onSelectAllColumns}
                      >
                        {t.columnSelector.selectAll}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                        onClick={onRestoreDefaultColumns}
                      >
                        {t.columnSelector.restore}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                        onClick={onClearColumns}
                      >
                        {t.columnSelector.clear}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
                    <div className="grid gap-4">
                      {columnGroups.map((group) => {
                        const keys = group.options.map((option) => option.key)
                        const selectedCount = keys.filter((key) => visibleColumns.includes(key)).length
                        const isAllSelected = selectedCount === keys.length
                        return (
                          <section
                            key={group.key}
                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800">{group.label}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                                  {selectedCount}/{keys.length}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onToggleColumnGroup(keys)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  isAllSelected
                                    ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                                    : 'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100'
                                }`}
                              >
                                {isAllSelected ? t.columnSelector.clearGroup : t.columnSelector.selectGroup}
                              </button>
                            </div>
                            <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                              {group.options.map((option) => (
                                <label
                                  key={option.key}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(option.key)}
                                    onChange={() => onToggleColumn(option.key)}
                                    className="accent-emerald-500"
                                  />
                                  <span className="truncate">{option.label}</span>
                                </label>
                              ))}
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3">
                    <button
                      type="button"
                      onClick={onToggleColumnSelector}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t.labels.close}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <ActionButton onClick={onClearSort} disabled={isSortDefault}>
            {t.actions.clearSort}
          </ActionButton>
        </div>
      </div>

      {actionNotice && !showCreateModal ? (
        <div className="px-6 pt-2 text-sm text-emerald-600 whitespace-pre-line">
          {actionNotice}
        </div>
      ) : null}
      {actionError && !showCreateModal ? (
        <div className="px-6 pt-2 text-sm text-rose-600 whitespace-pre-line">
          {actionError}
        </div>
      ) : null}

      {!canViewMembers ? (
        <div className="p-6 text-sm text-rose-600">
          {t.access.needMemberView}
        </div>
      ) : (
        <>
          <MemberFilterDrawer
            open={showFilterDrawer}
            onClose={onCloseFilterDrawer}
            onClearAll={onClearFilters}
            title={t.filters.title}
            clearLabel={t.filters.clear}
            closeLabel={t.labels.close}
            clearHint={t.filters.selected(hasActiveFilters ? activeFilterCount : 0)}
          >
          <MemberFiltersPanel
            t={t}
            filterControlProps={filterControlProps}
            canAssignRole={canAssignRole}
            nameFilterOptions={nameFilterOptions}
            usernameFilterOptions={usernameFilterOptions}
            genderFilterOptions={genderFilterOptions}
            nationalityFilterOptions={nationalityFilterOptions}
            phoneFilterOptions={phoneFilterOptions}
            tagFilterOptions={tagFilterOptions}
            joinDateFilterOptions={joinDateFilterOptions}
            positionFilterOptions={positionFilterOptions}
            statusFilterOptions={statusFilterOptions}
            roleFilterOptions={roleFilterOptions}
            teamFilterOptions={teamFilterOptions}
              chineseSupervisorFilterOptions={chineseSupervisorFilterOptions}
              contractNumberFilterOptions={contractNumberFilterOptions}
              contractTypeFilterOptions={contractTypeFilterOptions}
              salaryCategoryFilterOptions={salaryCategoryFilterOptions}
              baseSalaryFilterOptions={baseSalaryFilterOptions}
              netMonthlyFilterOptions={netMonthlyFilterOptions}
              maritalStatusFilterOptions={maritalStatusFilterOptions}
              childrenCountFilterOptions={childrenCountFilterOptions}
              cnpsNumberFilterOptions={cnpsNumberFilterOptions}
              cnpsDeclarationCodeFilterOptions={cnpsDeclarationCodeFilterOptions}
              provenanceFilterOptions={provenanceFilterOptions}
              frenchNameFilterOptions={frenchNameFilterOptions}
              idNumberFilterOptions={idNumberFilterOptions}
              passportNumberFilterOptions={passportNumberFilterOptions}
              educationAndMajorFilterOptions={educationAndMajorFilterOptions}
              certificationsFilterOptions={certificationsFilterOptions}
              domesticMobileFilterOptions={domesticMobileFilterOptions}
              emergencyContactNameFilterOptions={emergencyContactNameFilterOptions}
              emergencyContactPhoneFilterOptions={emergencyContactPhoneFilterOptions}
              redBookValidYearsFilterOptions={redBookValidYearsFilterOptions}
              cumulativeAbroadYearsFilterOptions={cumulativeAbroadYearsFilterOptions}
              birthplaceFilterOptions={birthplaceFilterOptions}
              residenceInChinaFilterOptions={residenceInChinaFilterOptions}
              medicalHistoryFilterOptions={medicalHistoryFilterOptions}
              healthStatusFilterOptions={healthStatusFilterOptions}
              createdAtFilterOptions={createdAtFilterOptions}
              updatedAtFilterOptions={updatedAtFilterOptions}
              nameFilters={nameFilters}
              usernameFilters={usernameFilters}
            genderFilters={genderFilters}
            nationalityFilters={nationalityFilters}
            phoneFilters={phoneFilters}
            tagFilters={tagFilters}
            joinDateFilters={joinDateFilters}
            positionFilters={positionFilters}
            statusFilters={statusFilters}
            roleFilters={roleFilters}
            teamFilters={teamFilters}
              chineseSupervisorFilters={chineseSupervisorFilters}
              contractNumberFilters={contractNumberFilters}
              contractTypeFilters={contractTypeFilters}
              salaryCategoryFilters={salaryCategoryFilters}
              baseSalaryFilters={baseSalaryFilters}
              netMonthlyFilters={netMonthlyFilters}
              maritalStatusFilters={maritalStatusFilters}
              childrenCountFilters={childrenCountFilters}
              cnpsNumberFilters={cnpsNumberFilters}
              cnpsDeclarationCodeFilters={cnpsDeclarationCodeFilters}
              provenanceFilters={provenanceFilters}
              frenchNameFilters={frenchNameFilters}
              idNumberFilters={idNumberFilters}
              passportNumberFilters={passportNumberFilters}
              educationAndMajorFilters={educationAndMajorFilters}
              certificationsFilters={certificationsFilters}
              domesticMobileFilters={domesticMobileFilters}
              emergencyContactNameFilters={emergencyContactNameFilters}
              emergencyContactPhoneFilters={emergencyContactPhoneFilters}
              redBookValidYearsFilters={redBookValidYearsFilters}
              cumulativeAbroadYearsFilters={cumulativeAbroadYearsFilters}
              birthplaceFilters={birthplaceFilters}
              residenceInChinaFilters={residenceInChinaFilters}
              medicalHistoryFilters={medicalHistoryFilters}
              healthStatusFilters={healthStatusFilters}
              createdAtFilters={createdAtFilters}
              updatedAtFilters={updatedAtFilters}
              setNameFilters={setNameFilters}
              setUsernameFilters={setUsernameFilters}
            setGenderFilters={setGenderFilters}
            setNationalityFilters={setNationalityFilters}
            setPhoneFilters={setPhoneFilters}
            setTagFilters={setTagFilters}
            setJoinDateFilters={setJoinDateFilters}
            setPositionFilters={setPositionFilters}
            setStatusFilters={setStatusFilters}
              setRoleFilters={setRoleFilters}
              setTeamFilters={setTeamFilters}
              setChineseSupervisorFilters={setChineseSupervisorFilters}
              setContractNumberFilters={setContractNumberFilters}
              setContractTypeFilters={setContractTypeFilters}
              setSalaryCategoryFilters={setSalaryCategoryFilters}
              setBaseSalaryFilters={setBaseSalaryFilters}
              setNetMonthlyFilters={setNetMonthlyFilters}
              setMaritalStatusFilters={setMaritalStatusFilters}
              setChildrenCountFilters={setChildrenCountFilters}
              setCnpsNumberFilters={setCnpsNumberFilters}
              setCnpsDeclarationCodeFilters={setCnpsDeclarationCodeFilters}
              setProvenanceFilters={setProvenanceFilters}
              setFrenchNameFilters={setFrenchNameFilters}
              setIdNumberFilters={setIdNumberFilters}
              setPassportNumberFilters={setPassportNumberFilters}
              setEducationAndMajorFilters={setEducationAndMajorFilters}
              setCertificationsFilters={setCertificationsFilters}
              setDomesticMobileFilters={setDomesticMobileFilters}
              setEmergencyContactNameFilters={setEmergencyContactNameFilters}
              setEmergencyContactPhoneFilters={setEmergencyContactPhoneFilters}
              setRedBookValidYearsFilters={setRedBookValidYearsFilters}
              setCumulativeAbroadYearsFilters={setCumulativeAbroadYearsFilters}
              setBirthplaceFilters={setBirthplaceFilters}
              setResidenceInChinaFilters={setResidenceInChinaFilters}
              setMedicalHistoryFilters={setMedicalHistoryFilters}
              setHealthStatusFilters={setHealthStatusFilters}
              setCreatedAtFilters={setCreatedAtFilters}
              setUpdatedAtFilters={setUpdatedAtFilters}
            />
          </MemberFilterDrawer>
          <div className="w-full min-w-0 overflow-x-auto border-t border-slate-100">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">{t.feedback.loading}</div>
            ) : null}
            {error ? (
              <div className="p-6 text-sm text-rose-600">
                {t.feedback.loadError}：{error}
              </div>
            ) : null}
            {totalMembers === 0 && !loading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                {t.feedback.empty}
              </div>
            ) : (
              <>
                <MembersTable
                  members={members}
                  page={page}
                  pageSize={pageSize}
                  locale={locale}
                  t={t}
                  isVisible={isVisible}
                  handleSort={handleSort}
                  sortIndicator={sortIndicator}
                  rolesData={rolesData}
                  canUpdateMember={canUpdateMember}
                  canDeleteMember={canDeleteMember}
                  submitting={submitting}
                  bulkEditMode={bulkEditMode}
                  bulkDrafts={bulkDrafts}
                  bulkEditableColumns={bulkEditableColumns}
                  teamOptions={teamOptions}
                  chineseSupervisorOptions={chineseSupervisorOptions}
                  onBulkFieldChange={onBulkFieldChange}
                  onViewMember={onViewMember}
                  onEditMember={onEditMember}
                  onDeleteMember={onDeleteMember}
                  statusLabels={statusLabels}
                  formatProfileText={formatProfileText}
                  formatProfileNumber={formatProfileNumber}
                  formatProfileList={formatProfileList}
                  formatSalary={formatSalary}
                  findGenderLabel={findGenderLabel}
                  findNationalityLabel={findNationalityLabel}
                />
                <PaginationBar
                  t={t}
                  totalMembers={totalMembers}
                  page={page}
                  totalPages={totalPages}
                  pageInput={pageInput}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                  onPageInputChange={onPageInputChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
