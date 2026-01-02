import { useMemo } from 'react'

export type MemberFiltersSummaryInput = {
  nameFilters: string[]
  usernameFilters: string[]
  genderFilters: string[]
  nationalityFilters: string[]
  phoneFilters: string[]
  joinDateFilters: string[]
  positionFilters: string[]
  statusFilters: string[]
  roleFilters: string[]
  tagFilters: string[]
  projectFilters: string[]
  teamFilters: string[]
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
  canAssignRole: boolean
}

export function useMemberFilterSummary(filters: MemberFiltersSummaryInput) {
  const {
    nameFilters,
    usernameFilters,
    genderFilters,
    nationalityFilters,
    phoneFilters,
    joinDateFilters,
    positionFilters,
    statusFilters,
    roleFilters,
    tagFilters,
    projectFilters,
    teamFilters,
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
    canAssignRole,
  } = filters

  const hasActiveFilters = useMemo(
    () =>
      nameFilters.length > 0 ||
      usernameFilters.length > 0 ||
      genderFilters.length > 0 ||
      nationalityFilters.length > 0 ||
      phoneFilters.length > 0 ||
      joinDateFilters.length > 0 ||
      positionFilters.length > 0 ||
      statusFilters.length > 0 ||
      (canAssignRole && roleFilters.length > 0) ||
      tagFilters.length > 0 ||
      projectFilters.length > 0 ||
      teamFilters.length > 0 ||
      chineseSupervisorFilters.length > 0 ||
      contractNumberFilters.length > 0 ||
      contractTypeFilters.length > 0 ||
      contractStartDateFilters.length > 0 ||
      contractEndDateFilters.length > 0 ||
      salaryCategoryFilters.length > 0 ||
      baseSalaryFilters.length > 0 ||
      netMonthlyFilters.length > 0 ||
      maritalStatusFilters.length > 0 ||
      childrenCountFilters.length > 0 ||
      cnpsNumberFilters.length > 0 ||
      cnpsDeclarationCodeFilters.length > 0 ||
      provenanceFilters.length > 0 ||
      frenchNameFilters.length > 0 ||
      idNumberFilters.length > 0 ||
      passportNumberFilters.length > 0 ||
      educationAndMajorFilters.length > 0 ||
      certificationsFilters.length > 0 ||
      domesticMobileFilters.length > 0 ||
      emergencyContactNameFilters.length > 0 ||
      emergencyContactPhoneFilters.length > 0 ||
      redBookValidYearsFilters.length > 0 ||
      cumulativeAbroadYearsFilters.length > 0 ||
      birthplaceFilters.length > 0 ||
      residenceInChinaFilters.length > 0 ||
      medicalHistoryFilters.length > 0 ||
      healthStatusFilters.length > 0 ||
      createdAtFilters.length > 0 ||
      updatedAtFilters.length > 0,
    [
      nameFilters,
      usernameFilters,
      genderFilters,
      nationalityFilters,
      phoneFilters,
      joinDateFilters,
      positionFilters,
      statusFilters,
      roleFilters,
      tagFilters,
      projectFilters,
      teamFilters,
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
      canAssignRole,
    ],
  )

  const activeFilterCount = useMemo(() => {
    const count =
      nameFilters.length +
      usernameFilters.length +
      genderFilters.length +
      nationalityFilters.length +
      phoneFilters.length +
      joinDateFilters.length +
      positionFilters.length +
      statusFilters.length +
      (canAssignRole ? roleFilters.length : 0) +
      tagFilters.length +
      projectFilters.length +
      teamFilters.length +
      chineseSupervisorFilters.length +
      contractNumberFilters.length +
      contractTypeFilters.length +
      contractStartDateFilters.length +
      contractEndDateFilters.length +
      salaryCategoryFilters.length +
      baseSalaryFilters.length +
      netMonthlyFilters.length +
      maritalStatusFilters.length +
      childrenCountFilters.length +
      cnpsNumberFilters.length +
      cnpsDeclarationCodeFilters.length +
      provenanceFilters.length +
      frenchNameFilters.length +
      idNumberFilters.length +
      passportNumberFilters.length +
      educationAndMajorFilters.length +
      certificationsFilters.length +
      domesticMobileFilters.length +
      emergencyContactNameFilters.length +
      emergencyContactPhoneFilters.length +
      redBookValidYearsFilters.length +
      cumulativeAbroadYearsFilters.length +
      birthplaceFilters.length +
      residenceInChinaFilters.length +
      medicalHistoryFilters.length +
      healthStatusFilters.length +
      createdAtFilters.length +
      updatedAtFilters.length
    return count
  }, [
    nameFilters,
    usernameFilters,
    genderFilters,
    nationalityFilters,
    phoneFilters,
    joinDateFilters,
    positionFilters,
    statusFilters,
    roleFilters,
    tagFilters,
    projectFilters,
    teamFilters,
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
    canAssignRole,
  ])

  return { hasActiveFilters, activeFilterCount }
}
