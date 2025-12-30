import { useMemo } from 'react'

import { type EmploymentStatus } from '@/lib/i18n/members'
import { EMPTY_FILTER_VALUE, type SortField, type SortOrder } from '@/lib/members/constants'
import {
  getMonthKey,
  formatSupervisorLabel,
  collectContractNumbers,
  normalizeTagKey,
  normalizeText,
  toNumberFilterValue,
  toSalaryFilterValue,
} from '@/lib/members/utils'
import type { Member } from '@/types/members'

type UseFilteredMembersParams = {
  membersData: Member[]
  sortStack: Array<{ field: SortField; order: SortOrder }>
  locale: string
  findGenderLabel: (value: string | null) => string
  findNationalityLabel: (value: string | null) => string
  resolveRoleName: (role: { id: number; name: string }) => string
  canAssignRole: boolean
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

export function useFilteredMembers({
  membersData,
  sortStack,
  locale,
  findGenderLabel,
  findNationalityLabel,
  resolveRoleName,
  canAssignRole,
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
}: UseFilteredMembersParams) {
  const filteredMembers = useMemo(() => {
    const matchesValueFilter = (value: string | null | undefined, filters: string[]) => {
      if (filters.length === 0) return true
      const normalized = normalizeText(value)
      if (!normalized) return filters.includes(EMPTY_FILTER_VALUE)
      return filters.includes(normalized)
    }
    const matchesListFilter = (values: string[] | null | undefined, filters: string[]) => {
      if (filters.length === 0) return true
      const normalized = (values ?? []).map(normalizeText).filter(Boolean)
      if (normalized.length === 0) return filters.includes(EMPTY_FILTER_VALUE)
      return normalized.some((value) => filters.includes(value))
    }
    const matchesMonthFilter = (value: string | null | undefined, filters: string[]) => {
      if (filters.length === 0) return true
      const key = getMonthKey(value)
      if (!key) return filters.includes(EMPTY_FILTER_VALUE)
      return filters.includes(key)
    }
    const matchesTagFilter = (values: string[] | null | undefined, filters: string[]) => {
      if (filters.length === 0) return true
      const wantsEmpty = filters.includes(EMPTY_FILTER_VALUE)
      const filterKeys = filters
        .filter((value) => value !== EMPTY_FILTER_VALUE)
        .map(normalizeTagKey)
        .filter(Boolean)
      const normalized = (values ?? []).map(normalizeTagKey).filter(Boolean)
      if (normalized.length === 0) return wantsEmpty
      if (filterKeys.length === 0) return true
      return normalized.some((value) => filterKeys.includes(value))
    }

    const list = membersData.filter((member) => {
      const chineseProfile = member.chineseProfile ?? null
      const expatProfile = member.expatProfile ?? null
      const emergencyContactName =
        chineseProfile?.emergencyContactName ?? expatProfile?.emergencyContactName
      const emergencyContactPhone =
        chineseProfile?.emergencyContactPhone ?? expatProfile?.emergencyContactPhone

      if (!matchesValueFilter(member.name, nameFilters)) return false
      if (!matchesValueFilter(member.username, usernameFilters)) return false
      if (!matchesValueFilter(member.gender, genderFilters)) return false
      if (!matchesValueFilter(member.nationality, nationalityFilters)) return false
      if (!matchesListFilter(member.phones, phoneFilters)) return false
      if (!matchesMonthFilter(member.joinDate, joinDateFilters)) return false
      if (!matchesValueFilter(member.position, positionFilters)) return false
      if (!matchesValueFilter(member.employmentStatus, statusFilters)) return false
      if (canAssignRole && roleFilters.length > 0) {
        const roleNames = member.roles.map(resolveRoleName).map(normalizeText).filter(Boolean)
        if (roleNames.length === 0) {
          if (!roleFilters.includes(EMPTY_FILTER_VALUE)) return false
        } else if (!roleNames.some((name) => roleFilters.includes(name))) {
          return false
        }
      }
      if (!matchesTagFilter(member.tags, tagFilters)) return false
      const supervisorLabel = normalizeText(
        formatSupervisorLabel({
          name: expatProfile?.chineseSupervisor?.name ?? null,
          frenchName: expatProfile?.chineseSupervisor?.chineseProfile?.frenchName ?? null,
          username: expatProfile?.chineseSupervisor?.username ?? null,
        }),
      )
      if (!matchesValueFilter(expatProfile?.team, teamFilters)) return false
      if (!matchesValueFilter(supervisorLabel, chineseSupervisorFilters)) return false
      if (!matchesListFilter(collectContractNumbers(expatProfile), contractNumberFilters))
        return false
      if (!matchesValueFilter(expatProfile?.contractType, contractTypeFilters)) return false
      if (!matchesValueFilter(expatProfile?.salaryCategory, salaryCategoryFilters)) return false
      if (
        !matchesValueFilter(
          toSalaryFilterValue(expatProfile?.baseSalaryAmount, expatProfile?.baseSalaryUnit),
          baseSalaryFilters,
        )
      )
        return false
      if (
        !matchesValueFilter(
          toSalaryFilterValue(expatProfile?.netMonthlyAmount, expatProfile?.netMonthlyUnit, 'MONTH'),
          netMonthlyFilters,
        )
      )
        return false
      if (!matchesValueFilter(expatProfile?.maritalStatus, maritalStatusFilters)) return false
      if (!matchesValueFilter(toNumberFilterValue(expatProfile?.childrenCount), childrenCountFilters))
        return false
      if (!matchesValueFilter(expatProfile?.cnpsNumber, cnpsNumberFilters)) return false
      if (!matchesValueFilter(expatProfile?.cnpsDeclarationCode, cnpsDeclarationCodeFilters))
        return false
      if (!matchesValueFilter(expatProfile?.provenance, provenanceFilters)) return false
      if (!matchesValueFilter(chineseProfile?.frenchName, frenchNameFilters)) return false
      if (!matchesValueFilter(chineseProfile?.idNumber, idNumberFilters)) return false
      if (!matchesValueFilter(chineseProfile?.passportNumber, passportNumberFilters)) return false
      if (!matchesValueFilter(chineseProfile?.educationAndMajor, educationAndMajorFilters))
        return false
      if (!matchesListFilter(chineseProfile?.certifications ?? [], certificationsFilters)) return false
      if (!matchesValueFilter(chineseProfile?.domesticMobile, domesticMobileFilters)) return false
      if (!matchesValueFilter(emergencyContactName, emergencyContactNameFilters)) return false
      if (!matchesValueFilter(emergencyContactPhone, emergencyContactPhoneFilters)) return false
      if (
        !matchesValueFilter(
          toNumberFilterValue(chineseProfile?.redBookValidYears),
          redBookValidYearsFilters,
        )
      )
        return false
      if (
        !matchesValueFilter(
          toNumberFilterValue(chineseProfile?.cumulativeAbroadYears),
          cumulativeAbroadYearsFilters,
        )
      )
        return false
      if (!matchesValueFilter(chineseProfile?.birthplace, birthplaceFilters)) return false
      if (!matchesValueFilter(chineseProfile?.residenceInChina, residenceInChinaFilters))
        return false
      if (!matchesValueFilter(chineseProfile?.medicalHistory, medicalHistoryFilters)) return false
      if (!matchesValueFilter(chineseProfile?.healthStatus, healthStatusFilters)) return false
      if (!matchesMonthFilter(member.createdAt, createdAtFilters)) return false
      if (!matchesMonthFilter(member.updatedAt, updatedAtFilters)) return false
      return true
    })

    if (sortStack.length === 0) return list
    const collator = new Intl.Collator(locale === 'fr' ? 'fr' : 'zh-Hans', {
      numeric: true,
      sensitivity: 'base',
    })
    const statusPriority: Record<EmploymentStatus, number> = {
      ACTIVE: 1,
      ON_LEAVE: 2,
      TERMINATED: 3,
    }
    const compareNullable = function <T extends string | number>(
      left: T | null | undefined | '',
      right: T | null | undefined | '',
      fn: (a: T, b: T) => number,
    ) {
      const isEmptyLeft = left === null || left === undefined || left === ''
      const isEmptyRight = right === null || right === undefined || right === ''
      if (isEmptyLeft && isEmptyRight) return 0
      if (isEmptyLeft) return 1
      if (isEmptyRight) return -1
      return fn(left as T, right as T)
    }
    const getDateValue = (value?: string | null) => {
      if (!value) return null
      const ts = new Date(value).getTime()
      return Number.isNaN(ts) ? null : ts
    }
    const getTextValue = (value?: string | null) => (value ?? '').trim()
    const getSalaryValue = (value?: string | null) => {
      if (!value) return null
      const normalized = value.replace(/[^\d.-]/g, '')
      if (!normalized) return null
      const parsed = Number.parseFloat(normalized)
      return Number.isFinite(parsed) ? parsed : null
    }

    const compareMembers = (left: Member, right: Member) => {
        const leftProfile = left.nationality === 'china' ? left.chineseProfile : null
        const rightProfile = right.nationality === 'china' ? right.chineseProfile : null
        const leftExpatProfile = left.nationality === 'china' ? null : left.expatProfile
        const rightExpatProfile = right.nationality === 'china' ? null : right.expatProfile
        const getSupervisorLabel = (profile?: typeof leftExpatProfile | null) => {
          if (!profile?.chineseSupervisor) return ''
          return formatSupervisorLabel({
            name: profile.chineseSupervisor.name,
            frenchName: profile.chineseSupervisor.chineseProfile?.frenchName ?? null,
            username: profile.chineseSupervisor.username,
          })
        }
        for (const sort of sortStack) {
          let result = 0
          switch (sort.field) {
          case 'name':
            result = compareNullable(getTextValue(left.name), getTextValue(right.name), (a, b) => collator.compare(a, b))
            break
          case 'username':
            result = collator.compare(left.username, right.username)
            break
          case 'gender':
            result = compareNullable(findGenderLabel(left.gender), findGenderLabel(right.gender), (a, b) => collator.compare(a, b))
            break
          case 'nationality':
            result = compareNullable(
              findNationalityLabel(left.nationality),
              findNationalityLabel(right.nationality),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'phones':
            result = compareNullable(
              left.phones?.join(' / '),
              right.phones?.join(' / '),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'joinDate':
            result = compareNullable(getDateValue(left.joinDate), getDateValue(right.joinDate), (a, b) => a - b)
            break
          case 'birthDate':
            result = compareNullable(getDateValue(left.birthDate), getDateValue(right.birthDate), (a, b) => a - b)
            break
          case 'position':
            result = compareNullable(getTextValue(left.position), getTextValue(right.position), (a, b) => collator.compare(a, b))
            break
          case 'employmentStatus':
            result = compareNullable(
              statusPriority[left.employmentStatus] ?? null,
              statusPriority[right.employmentStatus] ?? null,
              (a, b) => a - b,
            )
            break
          case 'terminationDate':
            result = compareNullable(
              getDateValue(left.terminationDate),
              getDateValue(right.terminationDate),
              (a, b) => a - b,
            )
            break
          case 'terminationReason':
            result = compareNullable(
              getTextValue(left.terminationReason),
              getTextValue(right.terminationReason),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'roles':
            result = compareNullable(
              left.roles.map(resolveRoleName).join(' / '),
              right.roles.map(resolveRoleName).join(' / '),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'tags':
            result = compareNullable(
              left.tags?.join(' / '),
              right.tags?.join(' / '),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'team':
            result = compareNullable(
              getTextValue(leftExpatProfile?.team),
              getTextValue(rightExpatProfile?.team),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'chineseSupervisor':
            result = compareNullable(
              getTextValue(getSupervisorLabel(leftExpatProfile)),
              getTextValue(getSupervisorLabel(rightExpatProfile)),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'contractNumber':
            result = compareNullable(
              getTextValue(leftExpatProfile?.contractNumber),
              getTextValue(rightExpatProfile?.contractNumber),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'contractType':
            result = compareNullable(
              getTextValue(leftExpatProfile?.contractType),
              getTextValue(rightExpatProfile?.contractType),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'contractStartDate':
            result = compareNullable(
              getDateValue(leftExpatProfile?.contractStartDate),
              getDateValue(rightExpatProfile?.contractStartDate),
              (a, b) => a - b,
            )
            break
          case 'contractEndDate':
            result = compareNullable(
              getDateValue(leftExpatProfile?.contractEndDate),
              getDateValue(rightExpatProfile?.contractEndDate),
              (a, b) => a - b,
            )
            break
          case 'salaryCategory':
            result = compareNullable(
              getTextValue(leftExpatProfile?.salaryCategory),
              getTextValue(rightExpatProfile?.salaryCategory),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'prime':
            result = compareNullable(
              getSalaryValue(leftExpatProfile?.prime),
              getSalaryValue(rightExpatProfile?.prime),
              (a, b) => a - b,
            )
            break
          case 'baseSalary':
            result = compareNullable(
              getSalaryValue(leftExpatProfile?.baseSalaryAmount),
              getSalaryValue(rightExpatProfile?.baseSalaryAmount),
              (a, b) => a - b,
            )
            break
          case 'netMonthly':
            result = compareNullable(
              getSalaryValue(leftExpatProfile?.netMonthlyAmount),
              getSalaryValue(rightExpatProfile?.netMonthlyAmount),
              (a, b) => a - b,
            )
            break
          case 'maritalStatus':
            result = compareNullable(
              getTextValue(leftExpatProfile?.maritalStatus),
              getTextValue(rightExpatProfile?.maritalStatus),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'childrenCount':
            result = compareNullable(
              leftExpatProfile?.childrenCount ?? null,
              rightExpatProfile?.childrenCount ?? null,
              (a, b) => a - b,
            )
            break
          case 'cnpsNumber':
            result = compareNullable(
              getTextValue(leftExpatProfile?.cnpsNumber),
              getTextValue(rightExpatProfile?.cnpsNumber),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'cnpsDeclarationCode':
            result = compareNullable(
              getTextValue(leftExpatProfile?.cnpsDeclarationCode),
              getTextValue(rightExpatProfile?.cnpsDeclarationCode),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'provenance':
            result = compareNullable(
              getTextValue(leftExpatProfile?.provenance),
              getTextValue(rightExpatProfile?.provenance),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'frenchName':
            result = compareNullable(
              getTextValue(leftProfile?.frenchName),
              getTextValue(rightProfile?.frenchName),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'idNumber':
            result = compareNullable(
              getTextValue(leftProfile?.idNumber),
              getTextValue(rightProfile?.idNumber),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'passportNumber':
            result = compareNullable(
              getTextValue(leftProfile?.passportNumber),
              getTextValue(rightProfile?.passportNumber),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'educationAndMajor':
            result = compareNullable(
              getTextValue(leftProfile?.educationAndMajor),
              getTextValue(rightProfile?.educationAndMajor),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'certifications':
            result = compareNullable(
              getTextValue(leftProfile?.certifications?.join(' / ')),
              getTextValue(rightProfile?.certifications?.join(' / ')),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'domesticMobile':
            result = compareNullable(
              getTextValue(leftProfile?.domesticMobile),
              getTextValue(rightProfile?.domesticMobile),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'emergencyContactName':
            result = compareNullable(
              getTextValue(leftProfile?.emergencyContactName ?? leftExpatProfile?.emergencyContactName),
              getTextValue(rightProfile?.emergencyContactName ?? rightExpatProfile?.emergencyContactName),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'emergencyContactPhone':
            result = compareNullable(
              getTextValue(leftProfile?.emergencyContactPhone ?? leftExpatProfile?.emergencyContactPhone),
              getTextValue(rightProfile?.emergencyContactPhone ?? rightExpatProfile?.emergencyContactPhone),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'redBookValidYears':
            result = compareNullable(
              leftProfile?.redBookValidYears ?? null,
              rightProfile?.redBookValidYears ?? null,
              (a, b) => a - b,
            )
            break
          case 'cumulativeAbroadYears':
            result = compareNullable(
              leftProfile?.cumulativeAbroadYears ?? null,
              rightProfile?.cumulativeAbroadYears ?? null,
              (a, b) => a - b,
            )
            break
          case 'birthplace':
            result = compareNullable(
              getTextValue(leftProfile?.birthplace),
              getTextValue(rightProfile?.birthplace),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'residenceInChina':
            result = compareNullable(
              getTextValue(leftProfile?.residenceInChina),
              getTextValue(rightProfile?.residenceInChina),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'medicalHistory':
            result = compareNullable(
              getTextValue(leftProfile?.medicalHistory),
              getTextValue(rightProfile?.medicalHistory),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'healthStatus':
            result = compareNullable(
              getTextValue(leftProfile?.healthStatus),
              getTextValue(rightProfile?.healthStatus),
              (a, b) => collator.compare(a, b),
            )
            break
          case 'createdAt':
            result = compareNullable(getDateValue(left.createdAt), getDateValue(right.createdAt), (a, b) => a - b)
            break
          case 'updatedAt':
            result = compareNullable(getDateValue(left.updatedAt), getDateValue(right.updatedAt), (a, b) => a - b)
            break
          default:
            break
        }
        if (result !== 0) {
          return sort.order === 'asc' ? result : -result
        }
      }
      return 0
    }

    return list.sort(compareMembers)
  }, [
    membersData,
    sortStack,
    locale,
    findGenderLabel,
    findNationalityLabel,
    resolveRoleName,
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
    canAssignRole,
  ])

  return filteredMembers
}
