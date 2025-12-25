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
}: MemberFiltersPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <MultiSelectFilter
        label={t.table.name}
        options={nameFilterOptions}
        selected={nameFilters}
        onChange={setNameFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.username}
        options={usernameFilterOptions}
        selected={usernameFilters}
        onChange={setUsernameFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.gender}
        options={genderFilterOptions}
        selected={genderFilters}
        onChange={setGenderFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.nationality}
        options={nationalityFilterOptions}
        selected={nationalityFilters}
        onChange={setNationalityFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.phones}
        options={phoneFilterOptions}
        selected={phoneFilters}
        onChange={setPhoneFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.joinDate}
        options={joinDateFilterOptions}
        selected={joinDateFilters}
        onChange={setJoinDateFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.position}
        options={positionFilterOptions}
        selected={positionFilters}
        onChange={setPositionFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.employmentStatus}
        options={statusFilterOptions}
        selected={statusFilters}
        onChange={setStatusFilters}
        {...filterControlProps}
      />
      {canAssignRole ? (
        <MultiSelectFilter
          label={t.table.roles}
          options={roleFilterOptions}
          selected={roleFilters}
          onChange={setRoleFilters}
          {...filterControlProps}
        />
      ) : null}
      <MultiSelectFilter
        label={t.table.team}
        options={teamFilterOptions}
        selected={teamFilters}
        onChange={setTeamFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.contractNumber}
        options={contractNumberFilterOptions}
        selected={contractNumberFilters}
        onChange={setContractNumberFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.contractType}
        options={contractTypeFilterOptions}
        selected={contractTypeFilters}
        onChange={setContractTypeFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.salaryCategory}
        options={salaryCategoryFilterOptions}
        selected={salaryCategoryFilters}
        onChange={setSalaryCategoryFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.baseSalary}
        options={baseSalaryFilterOptions}
        selected={baseSalaryFilters}
        onChange={setBaseSalaryFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.netMonthly}
        options={netMonthlyFilterOptions}
        selected={netMonthlyFilters}
        onChange={setNetMonthlyFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.maritalStatus}
        options={maritalStatusFilterOptions}
        selected={maritalStatusFilters}
        onChange={setMaritalStatusFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.childrenCount}
        options={childrenCountFilterOptions}
        selected={childrenCountFilters}
        onChange={setChildrenCountFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.cnpsNumber}
        options={cnpsNumberFilterOptions}
        selected={cnpsNumberFilters}
        onChange={setCnpsNumberFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.cnpsDeclarationCode}
        options={cnpsDeclarationCodeFilterOptions}
        selected={cnpsDeclarationCodeFilters}
        onChange={setCnpsDeclarationCodeFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.provenance}
        options={provenanceFilterOptions}
        selected={provenanceFilters}
        onChange={setProvenanceFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.frenchName}
        options={frenchNameFilterOptions}
        selected={frenchNameFilters}
        onChange={setFrenchNameFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.idNumber}
        options={idNumberFilterOptions}
        selected={idNumberFilters}
        onChange={setIdNumberFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.passportNumber}
        options={passportNumberFilterOptions}
        selected={passportNumberFilters}
        onChange={setPassportNumberFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.educationAndMajor}
        options={educationAndMajorFilterOptions}
        selected={educationAndMajorFilters}
        onChange={setEducationAndMajorFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.certifications}
        options={certificationsFilterOptions}
        selected={certificationsFilters}
        onChange={setCertificationsFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.domesticMobile}
        options={domesticMobileFilterOptions}
        selected={domesticMobileFilters}
        onChange={setDomesticMobileFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.emergencyContactName}
        options={emergencyContactNameFilterOptions}
        selected={emergencyContactNameFilters}
        onChange={setEmergencyContactNameFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.emergencyContactPhone}
        options={emergencyContactPhoneFilterOptions}
        selected={emergencyContactPhoneFilters}
        onChange={setEmergencyContactPhoneFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.redBookValidYears}
        options={redBookValidYearsFilterOptions}
        selected={redBookValidYearsFilters}
        onChange={setRedBookValidYearsFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.cumulativeAbroadYears}
        options={cumulativeAbroadYearsFilterOptions}
        selected={cumulativeAbroadYearsFilters}
        onChange={setCumulativeAbroadYearsFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.birthplace}
        options={birthplaceFilterOptions}
        selected={birthplaceFilters}
        onChange={setBirthplaceFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.residenceInChina}
        options={residenceInChinaFilterOptions}
        selected={residenceInChinaFilters}
        onChange={setResidenceInChinaFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.medicalHistory}
        options={medicalHistoryFilterOptions}
        selected={medicalHistoryFilters}
        onChange={setMedicalHistoryFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.healthStatus}
        options={healthStatusFilterOptions}
        selected={healthStatusFilters}
        onChange={setHealthStatusFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.createdAt}
        options={createdAtFilterOptions}
        selected={createdAtFilters}
        onChange={setCreatedAtFilters}
        {...filterControlProps}
      />
      <MultiSelectFilter
        label={t.table.updatedAt}
        options={updatedAtFilterOptions}
        selected={updatedAtFilters}
        onChange={setUpdatedAtFilters}
        {...filterControlProps}
      />
    </div>
  )
}
