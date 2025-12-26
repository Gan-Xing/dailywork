import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { memberCopy } from '@/lib/i18n/members'

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

type MemberFiltersPanelProps = {
  t: MemberCopy
  filterControlProps: FilterControlProps
  canAssignRole: boolean
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
}

export function MemberFiltersPanel({
  t,
  filterControlProps,
  canAssignRole,
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
}: MemberFiltersPanelProps) {
  const sectionBaseClasses =
    'rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-900/5'
  const sectionTitleClasses =
    'text-sm font-semibold uppercase tracking-[0.22em] text-slate-800'
  const sectionHeaderClasses = 'flex items-center gap-3'
  const sectionRuleClasses = 'h-px flex-1 bg-slate-200'
  const sectionRowClasses = 'mt-3 flex flex-wrap items-start gap-3'
  const filterItemClasses = 'min-w-[220px] flex-1'
  const sharedFilterProps = { ...filterControlProps, className: filterItemClasses }

  return (
    <div className="flex flex-col gap-4">
      <section className={sectionBaseClasses}>
        <div className={sectionHeaderClasses}>
          <p className={sectionTitleClasses}>{t.fieldGroups.basicInfo}</p>
          <span aria-hidden className={sectionRuleClasses} />
        </div>
        <div className={sectionRowClasses}>
          <MultiSelectFilter
            label={t.table.name}
            options={nameFilterOptions}
            selected={nameFilters}
            onChange={setNameFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.username}
            options={usernameFilterOptions}
            selected={usernameFilters}
            onChange={setUsernameFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.gender}
            options={genderFilterOptions}
            selected={genderFilters}
            onChange={setGenderFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.nationality}
            options={nationalityFilterOptions}
            selected={nationalityFilters}
            onChange={setNationalityFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.phones}
            options={phoneFilterOptions}
            selected={phoneFilters}
            onChange={setPhoneFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.joinDate}
            options={joinDateFilterOptions}
            selected={joinDateFilters}
            onChange={setJoinDateFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.position}
            options={positionFilterOptions}
            selected={positionFilters}
            onChange={setPositionFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.employmentStatus}
            options={statusFilterOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            {...sharedFilterProps}
          />
          {canAssignRole ? (
            <MultiSelectFilter
              label={t.table.roles}
              options={roleFilterOptions}
              selected={roleFilters}
              onChange={setRoleFilters}
              {...sharedFilterProps}
            />
          ) : null}
          <MultiSelectFilter
            label={t.table.createdAt}
            options={createdAtFilterOptions}
            selected={createdAtFilters}
            onChange={setCreatedAtFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.updatedAt}
            options={updatedAtFilterOptions}
            selected={updatedAtFilters}
            onChange={setUpdatedAtFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <div className={sectionHeaderClasses}>
          <p className={sectionTitleClasses}>{t.fieldGroups.contract}</p>
          <span aria-hidden className={sectionRuleClasses} />
        </div>
        <div className={sectionRowClasses}>
          <MultiSelectFilter
            label={t.table.contractNumber}
            options={contractNumberFilterOptions}
            selected={contractNumberFilters}
            onChange={setContractNumberFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.contractType}
            options={contractTypeFilterOptions}
            selected={contractTypeFilters}
            onChange={setContractTypeFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <div className={sectionHeaderClasses}>
          <p className={sectionTitleClasses}>{t.fieldGroups.salary}</p>
          <span aria-hidden className={sectionRuleClasses} />
        </div>
        <div className={sectionRowClasses}>
          <MultiSelectFilter
            label={t.table.salaryCategory}
            options={salaryCategoryFilterOptions}
            selected={salaryCategoryFilters}
            onChange={setSalaryCategoryFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.baseSalary}
            options={baseSalaryFilterOptions}
            selected={baseSalaryFilters}
            onChange={setBaseSalaryFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.netMonthly}
            options={netMonthlyFilterOptions}
            selected={netMonthlyFilters}
            onChange={setNetMonthlyFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <div className={sectionHeaderClasses}>
          <p className={sectionTitleClasses}>{t.fieldGroups.localProfile}</p>
          <span aria-hidden className={sectionRuleClasses} />
        </div>
        <div className={sectionRowClasses}>
          <MultiSelectFilter
            label={t.table.team}
            options={teamFilterOptions}
            selected={teamFilters}
            onChange={setTeamFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.chineseSupervisor}
            options={chineseSupervisorFilterOptions}
            selected={chineseSupervisorFilters}
            onChange={setChineseSupervisorFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.maritalStatus}
            options={maritalStatusFilterOptions}
            selected={maritalStatusFilters}
            onChange={setMaritalStatusFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.childrenCount}
            options={childrenCountFilterOptions}
            selected={childrenCountFilters}
            onChange={setChildrenCountFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.cnpsNumber}
            options={cnpsNumberFilterOptions}
            selected={cnpsNumberFilters}
            onChange={setCnpsNumberFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.cnpsDeclarationCode}
            options={cnpsDeclarationCodeFilterOptions}
            selected={cnpsDeclarationCodeFilters}
            onChange={setCnpsDeclarationCodeFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.provenance}
            options={provenanceFilterOptions}
            selected={provenanceFilters}
            onChange={setProvenanceFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.emergencyContactName}
            options={emergencyContactNameFilterOptions}
            selected={emergencyContactNameFilters}
            onChange={setEmergencyContactNameFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.emergencyContactPhone}
            options={emergencyContactPhoneFilterOptions}
            selected={emergencyContactPhoneFilters}
            onChange={setEmergencyContactPhoneFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <div className={sectionHeaderClasses}>
          <p className={sectionTitleClasses}>{t.fieldGroups.chineseProfile}</p>
          <span aria-hidden className={sectionRuleClasses} />
        </div>
        <div className={sectionRowClasses}>
          <MultiSelectFilter
            label={t.table.frenchName}
            options={frenchNameFilterOptions}
            selected={frenchNameFilters}
            onChange={setFrenchNameFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.idNumber}
            options={idNumberFilterOptions}
            selected={idNumberFilters}
            onChange={setIdNumberFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.passportNumber}
            options={passportNumberFilterOptions}
            selected={passportNumberFilters}
            onChange={setPassportNumberFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.educationAndMajor}
            options={educationAndMajorFilterOptions}
            selected={educationAndMajorFilters}
            onChange={setEducationAndMajorFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.certifications}
            options={certificationsFilterOptions}
            selected={certificationsFilters}
            onChange={setCertificationsFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.domesticMobile}
            options={domesticMobileFilterOptions}
            selected={domesticMobileFilters}
            onChange={setDomesticMobileFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.redBookValidYears}
            options={redBookValidYearsFilterOptions}
            selected={redBookValidYearsFilters}
            onChange={setRedBookValidYearsFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.cumulativeAbroadYears}
            options={cumulativeAbroadYearsFilterOptions}
            selected={cumulativeAbroadYearsFilters}
            onChange={setCumulativeAbroadYearsFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.birthplace}
            options={birthplaceFilterOptions}
            selected={birthplaceFilters}
            onChange={setBirthplaceFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.residenceInChina}
            options={residenceInChinaFilterOptions}
            selected={residenceInChinaFilters}
            onChange={setResidenceInChinaFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.medicalHistory}
            options={medicalHistoryFilterOptions}
            selected={medicalHistoryFilters}
            onChange={setMedicalHistoryFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.healthStatus}
            options={healthStatusFilterOptions}
            selected={healthStatusFilters}
            onChange={setHealthStatusFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

    </div>
  )
}
