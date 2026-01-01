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
  tagFilterOptions: Option[]
  joinDateFilterOptions: Option[]
  positionFilterOptions: Option[]
  statusFilterOptions: Option[]
  roleFilterOptions: Option[]
  teamFilterOptions: Option[]
  projectFilterOptions: Option[]
  chineseSupervisorFilterOptions: Option[]
  contractNumberFilterOptions: Option[]
  contractTypeFilterOptions: Option[]
  contractStartDateFilterOptions: Option[]
  contractEndDateFilterOptions: Option[]
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
  projectFilters: string[]
  chineseSupervisorFilters: string[]
  contractNumberFilters: string[]
  contractTypeFilters: string[]
  contractStartDateFilters: string[]
  contractEndDateFilters: string[]
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
  setProjectFilters: (value: string[]) => void
  setChineseSupervisorFilters: (value: string[]) => void
  setContractNumberFilters: (value: string[]) => void
  setContractTypeFilters: (value: string[]) => void
  setContractStartDateFilters: (value: string[]) => void
  setContractEndDateFilters: (value: string[]) => void
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

export function MemberFiltersPanel({
  t,
  filterControlProps,
  canAssignRole,
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
  projectFilterOptions,
  chineseSupervisorFilterOptions,
  contractNumberFilterOptions,
  contractTypeFilterOptions,
  contractStartDateFilterOptions,
  contractEndDateFilterOptions,
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
  projectFilters,
  chineseSupervisorFilters,
  contractNumberFilters,
  contractTypeFilters,
  contractStartDateFilters,
  contractEndDateFilters,
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
  setProjectFilters,
  setChineseSupervisorFilters,
  setContractNumberFilters,
  setContractTypeFilters,
  setContractStartDateFilters,
  setContractEndDateFilters,
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
  const sharedFilterProps = { ...filterControlProps, className: 'w-full' }

  return (
    <div className="flex flex-col gap-6">
      <section className={sectionBaseClasses}>
        <SectionTitle label={t.fieldGroups.basicInfo} theme="emerald" />
        <div className={sectionGridClasses}>
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
            label={t.table.tags}
            options={tagFilterOptions}
            selected={tagFilters}
            onChange={setTagFilters}
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
        <SectionTitle label={t.fieldGroups.contract} theme="blue" />
        <div className={sectionGridClasses}>
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
          <MultiSelectFilter
            label={t.table.contractStartDate}
            options={contractStartDateFilterOptions}
            selected={contractStartDateFilters}
            onChange={setContractStartDateFilters}
            {...sharedFilterProps}
          />
          <MultiSelectFilter
            label={t.table.contractEndDate}
            options={contractEndDateFilterOptions}
            selected={contractEndDateFilters}
            onChange={setContractEndDateFilters}
            {...sharedFilterProps}
          />
        </div>
      </section>

      <section className={sectionBaseClasses}>
        <SectionTitle label={t.fieldGroups.salary} theme="amber" />
        <div className={sectionGridClasses}>
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
        <SectionTitle label={t.fieldGroups.localProfile} theme="purple" />
        <div className={sectionGridClasses}>
          <MultiSelectFilter
            label={t.table.project}
            options={projectFilterOptions}
            selected={projectFilters}
            onChange={setProjectFilters}
            {...sharedFilterProps}
          />
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
        <SectionTitle label={t.fieldGroups.chineseProfile} theme="rose" />
        <div className={sectionGridClasses}>
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
