import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import { nationalityOptions } from '@/lib/i18n/members'
import { MEMBER_FILTER_STORAGE_KEY, type SortField, type SortOrder } from '@/lib/members/constants'

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
  tagFilters: string[]
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
}

type FilterAction =
  | { type: 'set'; key: keyof MemberFiltersState; value: string[] }
  | { type: 'reset' }
  | { type: 'hydrate'; value: Partial<MemberFiltersState> }

const defaultNonChineseNationalities = nationalityOptions
  .filter((opt) => opt.key !== 'china')
  .map((opt) => opt.key)

const initialFiltersState: MemberFiltersState = {
  nameFilters: [],
  usernameFilters: [],
  genderFilters: [],
  nationalityFilters: defaultNonChineseNationalities,
  phoneFilters: [],
  joinDateFilters: [],
  positionFilters: [],
  statusFilters: ['ACTIVE'],
  roleFilters: [],
  tagFilters: [],
  teamFilters: [],
  chineseSupervisorFilters: [],
  contractNumberFilters: [],
  contractTypeFilters: [],
  contractStartDateFilters: [],
  contractEndDateFilters: [],
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

const filterKeys = Object.keys(initialFiltersState) as Array<keyof MemberFiltersState>

const getStoredFilters = (value: unknown): Partial<MemberFiltersState> => {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return filterKeys.reduce((acc, key) => {
    const entry = record[key]
    if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) {
      acc[key] = entry as string[]
    }
    return acc
  }, {} as Partial<MemberFiltersState>)
}

const filterReducer = (state: MemberFiltersState, action: FilterAction): MemberFiltersState => {
  switch (action.type) {
    case 'set':
      if (state[action.key] === action.value) return state
      return { ...state, [action.key]: action.value }
    case 'reset':
      return initialFiltersState
    case 'hydrate':
      return { ...initialFiltersState, ...action.value }
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
  const [filtersHydrated, setFiltersHydrated] = useState(false)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(MEMBER_FILTER_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      const next = getStoredFilters(parsed)
      if (Object.keys(next).length > 0) {
        dispatch({ type: 'hydrate', value: next })
      }
    } catch (error) {
      console.error('Failed to load member filters', error)
    } finally {
      setFiltersHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MEMBER_FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch (error) {
      console.error('Failed to persist member filters', error)
    }
  }, [filters, filtersHydrated])

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
      setTagFilters: (value: string[]) => setFilter('tagFilters', value),
      setTeamFilters: (value: string[]) => setFilter('teamFilters', value),
      setChineseSupervisorFilters: (value: string[]) =>
        setFilter('chineseSupervisorFilters', value),
      setContractNumberFilters: (value: string[]) => setFilter('contractNumberFilters', value),
      setContractTypeFilters: (value: string[]) => setFilter('contractTypeFilters', value),
      setContractStartDateFilters: (value: string[]) => setFilter('contractStartDateFilters', value),
      setContractEndDateFilters: (value: string[]) => setFilter('contractEndDateFilters', value),
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
