import type { ChangeEvent, ReactNode, RefObject } from 'react'

import { MemberFilterDrawer } from '@/components/members/MemberFilterDrawer'
import { ActionButton } from '@/components/members/MemberButtons'
import { memberCopy } from '@/lib/i18n/members'
import type { ColumnKey, SortField } from '@/lib/members/constants'
import type { Member, Role } from '@/types/members'

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
  canAssignRole: boolean
  loading: boolean
  error: string | null
  actionError: string | null
  actionNotice: string | null
  importing: boolean
  exporting: boolean
  templateDownloading: boolean
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
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
  joinDateFilterOptions: Option[]
  positionFilterOptions: Option[]
  statusFilterOptions: Option[]
  roleFilterOptions: Option[]
  teamFilterOptions: Option[]
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
  joinDateFilters: string[]
  positionFilters: string[]
  statusFilters: string[]
  roleFilters: string[]
  teamFilters: string[]
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
  setJoinDateFilters: (value: string[]) => void
  setPositionFilters: (value: string[]) => void
  setStatusFilters: (value: string[]) => void
  setRoleFilters: (value: string[]) => void
  setTeamFilters: (value: string[]) => void
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
  onSelectAllColumns: () => void
  onRestoreDefaultColumns: () => void
  onClearColumns: () => void
  onToggleColumnSelector: () => void
  isVisible: (key: ColumnKey) => boolean
  isSortDefault: boolean
  onClearSort: () => void
  onOpenCreateModal: () => void
  onImportClick: () => void
  onExport: () => void
  onDownloadTemplate: () => void
  importInputRef: RefObject<HTMLInputElement>
  columnSelectorRef: RefObject<HTMLDivElement>
  handleSort: (field: SortField) => void
  sortIndicator: (field: SortField) => string
  members: Member[]
  rolesData: Role[]
  locale: string
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
}

export function MembersTab(props: MembersTabProps) {
  const {
    t,
    canViewMembers,
    canCreateMember,
    canUpdateMember,
    canDeleteMember,
    submitting,
    canAssignRole,
    loading,
    error,
    actionError,
    actionNotice,
    importing,
    exporting,
    templateDownloading,
    onImportFileChange,
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
    joinDateFilterOptions,
    positionFilterOptions,
    statusFilterOptions,
    roleFilterOptions,
    teamFilterOptions,
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
    joinDateFilters,
    positionFilters,
    statusFilters,
    roleFilters,
    teamFilters,
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
    setJoinDateFilters,
    setPositionFilters,
    setStatusFilters,
    setRoleFilters,
    setTeamFilters,
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
    onSelectAllColumns,
    onRestoreDefaultColumns,
    onClearColumns,
    onToggleColumnSelector,
    isVisible,
    isSortDefault,
    onClearSort,
    onOpenCreateModal,
    onImportClick,
    onExport,
    onDownloadTemplate,
    importInputRef,
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
  } = props

  return (
    <>
      <div className="flex flex-col gap-6 border-b border-slate-100 px-6 pb-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
          <ActionButton onClick={onExport} disabled={!canViewMembers || exporting}>
            {t.actions.export}
          </ActionButton>
          <ActionButton onClick={onDownloadTemplate} disabled={templateDownloading}>
            {t.actions.template}
          </ActionButton>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onImportFileChange}
            className="hidden"
          />
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
              <div className="absolute right-0 z-10 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-slate-900/10">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <button type="button" className="hover:text-slate-800" onClick={onSelectAllColumns}>
                    {t.columnSelector.selectAll}
                  </button>
                  <button type="button" className="hover:text-slate-800" onClick={onRestoreDefaultColumns}>
                    {t.columnSelector.restore}
                  </button>
                  <button type="button" className="text-rose-600 hover:text-rose-700" onClick={onClearColumns}>
                    {t.columnSelector.clear}
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {columnOptions.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
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
          <div className="border-t border-slate-100 px-6 pb-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.filters.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton onClick={onClearFilters} disabled={!hasActiveFilters}>
                  {t.filters.reset}
                </ActionButton>
                <ActionButton onClick={onOpenFilterDrawer}>
                  {t.filters.expand}
                </ActionButton>
              </div>
            </div>
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
                joinDateFilterOptions={joinDateFilterOptions}
                positionFilterOptions={positionFilterOptions}
                statusFilterOptions={statusFilterOptions}
                roleFilterOptions={roleFilterOptions}
                teamFilterOptions={teamFilterOptions}
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
                joinDateFilters={joinDateFilters}
                positionFilters={positionFilters}
                statusFilters={statusFilters}
                roleFilters={roleFilters}
                teamFilters={teamFilters}
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
                setJoinDateFilters={setJoinDateFilters}
                setPositionFilters={setPositionFilters}
                setStatusFilters={setStatusFilters}
                setRoleFilters={setRoleFilters}
                setTeamFilters={setTeamFilters}
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
          </div>
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
