import { useCallback, useMemo, useReducer, useState } from 'react'

import type { SortField, SortOrder } from '@/lib/members/constants'

type SortSpec = { field: SortField; order: SortOrder }

export type MemberFiltersState = {
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
}

type FilterAction =
  | { type: 'set'; key: keyof MemberFiltersState; value: string[] }
  | { type: 'reset' }

const initialFiltersState: MemberFiltersState = {
  nameFilters: [],
  usernameFilters: [],
  genderFilters: [],
  nationalityFilters: [],
  phoneFilters: [],
  joinDateFilters: [],
  positionFilters: [],
  statusFilters: [],
  roleFilters: [],
  teamFilters: [],
  chineseSupervisorFilters: [],
  contractNumberFilters: [],
  contractTypeFilters: [],
  salaryCategoryFilters: [],
  baseSalaryFilters: [],
  netMonthlyFilters: [],
  maritalStatusFilters: [],
  childrenCountFilters: [],
  cnpsNumberFilters: [],
  cnpsDeclarationCodeFilters: [],
  provenanceFilters: [],
  frenchNameFilters: [],
  idNumberFilters: [],
  passportNumberFilters: [],
  educationAndMajorFilters: [],
  certificationsFilters: [],
  domesticMobileFilters: [],
  emergencyContactNameFilters: [],
  emergencyContactPhoneFilters: [],
  redBookValidYearsFilters: [],
  cumulativeAbroadYearsFilters: [],
  birthplaceFilters: [],
  residenceInChinaFilters: [],
  medicalHistoryFilters: [],
  healthStatusFilters: [],
  createdAtFilters: [],
  updatedAtFilters: [],
}

const filterReducer = (state: MemberFiltersState, action: FilterAction): MemberFiltersState => {
  switch (action.type) {
    case 'set':
      if (state[action.key] === action.value) return state
      return { ...state, [action.key]: action.value }
    case 'reset':
      return initialFiltersState
    default:
      return state
  }
}

type Options = {
  defaultPageSize?: number
  defaultSortStack?: SortSpec[]
}

export function useMemberTableState(options: Options = {}) {
  const [filters, dispatch] = useReducer(filterReducer, initialFiltersState)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize, setPageSize] = useState(options.defaultPageSize ?? 20)
  const [sortStack, setSortStack] = useState<SortSpec[]>(options.defaultSortStack ?? [])

  const setFilter = useCallback((key: keyof MemberFiltersState, value: string[]) => {
    dispatch({ type: 'set', key, value })
  }, [])
  const resetFilters = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const filterActions = useMemo(
    () => ({
      setNameFilters: (value: string[]) => setFilter('nameFilters', value),
      setUsernameFilters: (value: string[]) => setFilter('usernameFilters', value),
      setGenderFilters: (value: string[]) => setFilter('genderFilters', value),
      setNationalityFilters: (value: string[]) => setFilter('nationalityFilters', value),
      setPhoneFilters: (value: string[]) => setFilter('phoneFilters', value),
      setJoinDateFilters: (value: string[]) => setFilter('joinDateFilters', value),
      setPositionFilters: (value: string[]) => setFilter('positionFilters', value),
      setStatusFilters: (value: string[]) => setFilter('statusFilters', value),
      setRoleFilters: (value: string[]) => setFilter('roleFilters', value),
      setTeamFilters: (value: string[]) => setFilter('teamFilters', value),
      setChineseSupervisorFilters: (value: string[]) =>
        setFilter('chineseSupervisorFilters', value),
      setContractNumberFilters: (value: string[]) => setFilter('contractNumberFilters', value),
      setContractTypeFilters: (value: string[]) => setFilter('contractTypeFilters', value),
      setSalaryCategoryFilters: (value: string[]) => setFilter('salaryCategoryFilters', value),
      setBaseSalaryFilters: (value: string[]) => setFilter('baseSalaryFilters', value),
      setNetMonthlyFilters: (value: string[]) => setFilter('netMonthlyFilters', value),
      setMaritalStatusFilters: (value: string[]) => setFilter('maritalStatusFilters', value),
      setChildrenCountFilters: (value: string[]) => setFilter('childrenCountFilters', value),
      setCnpsNumberFilters: (value: string[]) => setFilter('cnpsNumberFilters', value),
      setCnpsDeclarationCodeFilters: (value: string[]) => setFilter('cnpsDeclarationCodeFilters', value),
      setProvenanceFilters: (value: string[]) => setFilter('provenanceFilters', value),
      setFrenchNameFilters: (value: string[]) => setFilter('frenchNameFilters', value),
      setIdNumberFilters: (value: string[]) => setFilter('idNumberFilters', value),
      setPassportNumberFilters: (value: string[]) => setFilter('passportNumberFilters', value),
      setEducationAndMajorFilters: (value: string[]) => setFilter('educationAndMajorFilters', value),
      setCertificationsFilters: (value: string[]) => setFilter('certificationsFilters', value),
      setDomesticMobileFilters: (value: string[]) => setFilter('domesticMobileFilters', value),
      setEmergencyContactNameFilters: (value: string[]) =>
        setFilter('emergencyContactNameFilters', value),
      setEmergencyContactPhoneFilters: (value: string[]) =>
        setFilter('emergencyContactPhoneFilters', value),
      setRedBookValidYearsFilters: (value: string[]) => setFilter('redBookValidYearsFilters', value),
      setCumulativeAbroadYearsFilters: (value: string[]) =>
        setFilter('cumulativeAbroadYearsFilters', value),
      setBirthplaceFilters: (value: string[]) => setFilter('birthplaceFilters', value),
      setResidenceInChinaFilters: (value: string[]) => setFilter('residenceInChinaFilters', value),
      setMedicalHistoryFilters: (value: string[]) => setFilter('medicalHistoryFilters', value),
      setHealthStatusFilters: (value: string[]) => setFilter('healthStatusFilters', value),
      setCreatedAtFilters: (value: string[]) => setFilter('createdAtFilters', value),
      setUpdatedAtFilters: (value: string[]) => setFilter('updatedAtFilters', value),
    }),
    [setFilter],
  )

  return {
    filters,
    filterActions,
    filtersOpen,
    setFiltersOpen,
    page,
    setPage,
    pageInput,
    setPageInput,
    pageSize,
    setPageSize,
    sortStack,
    setSortStack,
    resetFilters,
  }
}
