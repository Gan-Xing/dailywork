import { useMemo } from 'react'

import {
  genderOptions,
  memberCopy,
  type EmploymentStatus,
} from '@/lib/i18n/members'
import { EMPTY_FILTER_VALUE } from '@/lib/members/constants'
import {
  formatSupervisorLabel,
  getMonthKey,
  collectContractNumbers,
  normalizeTagKey,
  normalizeText,
  toNumberFilterValue,
  toSalaryFilterValue,
} from '@/lib/members/utils'
import type { Member, Role } from '@/types/members'
import type { ProjectItem } from './useProjects'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UseMemberFilterOptionsParams = {
  membersData: Member[]
  rolesData: Role[]
  projects?: ProjectItem[]
  locale: keyof typeof memberCopy
  t: MemberCopy
  canAssignRole: boolean
  statusLabels: Record<EmploymentStatus, string>
  findNationalityLabel: (value: string | null) => string
}

type Option = { value: string; label: string }

export function useMemberFilterOptions({
  membersData,
  rolesData,
  projects = [],
  locale,
  t,
  canAssignRole,
  statusLabels,
  findNationalityLabel,
}: UseMemberFilterOptionsParams) {
  const optionCollator = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    return new Intl.Collator(localeId, {
      numeric: true,
      sensitivity: 'base',
    })
  }, [locale])

  const positionOptions = useMemo(() => {
    const set = new Set<string>()
    membersData.forEach((member) => {
      const value = normalizeText(member.position)
      if (value) set.add(value)
    })
    return Array.from(set).sort(optionCollator.compare)
  }, [membersData, optionCollator])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.team)
      if (value) set.add(value)
    })
    return Array.from(set).sort(optionCollator.compare)
  }, [membersData, optionCollator])

  const nameFilterOptions = useMemo(() => {
    const names = membersData.map((member) => normalizeText(member.name)).filter(Boolean)
    const unique = Array.from(new Set(names)).sort(optionCollator.compare)
    const options = unique.map((value) => ({ value, label: value }))
    if (membersData.some((member) => !normalizeText(member.name))) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const usernameFilterOptions = useMemo(() => {
    const values = membersData.map((member) => normalizeText(member.username)).filter(Boolean)
    const sorted = values.slice().sort(optionCollator.compare)
    return sorted.map((value) => ({ value, label: value }))
  }, [membersData, optionCollator])

  const genderFilterOptions = useMemo(() => {
    const options = genderOptions.map((option) => ({
      value: option.value,
      label: option.label[locale],
    }))
    if (membersData.some((member) => !normalizeText(member.gender))) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [locale, membersData, t.labels.empty])

  const nationalityFilterOptions = useMemo(() => {
    const keys = new Set<string>()
    membersData.forEach((member) => {
      const value = normalizeText(member.nationality)
      if (value) keys.add(value)
    })
    const options = Array.from(keys)
      .map((value) => ({
        value,
        label: findNationalityLabel(value),
      }))
      .sort((a, b) => optionCollator.compare(a.label, b.label))
    if (membersData.some((member) => !normalizeText(member.nationality))) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, optionCollator, t.labels.empty, findNationalityLabel])

  const phoneFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      member.phones?.forEach((phone) => {
        const trimmed = normalizeText(phone)
        if (trimmed) values.add(trimmed)
      })
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.phones || member.phones.length === 0)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const tagFilterOptions = useMemo(() => {
    const tagsByKey = new Map<string, string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const tags = member.tags ?? []
      if (tags.length === 0) {
        hasEmpty = true
        return
      }
      tags.forEach((tag) => {
        const trimmed = normalizeText(tag)
        if (!trimmed) return
        const key = normalizeTagKey(trimmed)
        if (!key || tagsByKey.has(key)) return
        tagsByKey.set(key, trimmed)
      })
    })
    const options = Array.from(tagsByKey.values())
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const joinDateFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      const key = getMonthKey(member.joinDate)
      if (key) values.add(key)
    })
    const options = Array.from(values)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.joinDate)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, t.labels.empty])

  const positionFilterOptions = useMemo(() => {
    const options = positionOptions.map((value) => ({ value, label: value }))
    if (membersData.some((member) => !normalizeText(member.position))) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [positionOptions, membersData, t.labels.empty])

  const statusFilterOptions = useMemo(() => {
    const order: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']
    const options: Option[] = order.map((status) => ({
      value: status,
      label: statusLabels[status],
    }))
    if (membersData.some((member) => !member.employmentStatus)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, statusLabels, t.labels.empty])

  const roleFilterOptions = useMemo(() => {
    const names = rolesData.map((role) => normalizeText(role.name)).filter(Boolean)
    const unique = Array.from(new Set(names))
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.roles || member.roles.length === 0)) {
      unique.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return unique
  }, [rolesData, membersData, optionCollator, t.labels.empty])

  const teamFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.team)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const projectFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.project?.name)
      if (value) values.add(value)
      else hasEmpty = true
    })
    projects.forEach((project) => {
      const value = normalizeText(project.name)
      if (value) values.add(value)
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, projects, t.labels.empty])

  const chineseSupervisorFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const supervisor = member.expatProfile?.chineseSupervisor
      const label = normalizeText(
        formatSupervisorLabel({
          name: supervisor?.name ?? null,
          frenchName: supervisor?.chineseProfile?.frenchName ?? null,
          username: supervisor?.username ?? null,
        }),
      )
      if (label) values.add(label)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const contractNumberFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const contractNumbers = collectContractNumbers(member.expatProfile ?? null)
      if (contractNumbers.length === 0) {
        hasEmpty = true
        return
      }
      contractNumbers.forEach((value) => values.add(value))
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const contractTypeFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.contractType)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const contractStartDateFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      const key = getMonthKey(member.expatProfile?.contractStartDate)
      if (key) values.add(key)
    })
    const options = Array.from(values)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.expatProfile?.contractStartDate)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, t.labels.empty])

  const contractEndDateFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      const key = getMonthKey(member.expatProfile?.contractEndDate)
      if (key) values.add(key)
    })
    const options = Array.from(values)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.expatProfile?.contractEndDate)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, t.labels.empty])

  const salaryCategoryFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.salaryCategory)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const baseSalaryFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = toSalaryFilterValue(
        member.expatProfile?.baseSalaryAmount,
        member.expatProfile?.baseSalaryUnit,
      )
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const netMonthlyFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = toSalaryFilterValue(
        member.expatProfile?.netMonthlyAmount,
        member.expatProfile?.netMonthlyUnit,
        'MONTH',
      )
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const maritalStatusFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.maritalStatus)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const childrenCountFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = toNumberFilterValue(member.expatProfile?.childrenCount)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const cnpsNumberFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.cnpsNumber)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const cnpsDeclarationCodeFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.cnpsDeclarationCode)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const provenanceFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.provenance)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const frenchNameFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.frenchName)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const idNumberFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.idNumber)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const passportNumberFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.passportNumber)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const educationAndMajorFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.educationAndMajor)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const certificationsFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const list = member.chineseProfile?.certifications ?? []
      if (list.length === 0) {
        hasEmpty = true
        return
      }
      list.forEach((item) => {
        const value = normalizeText(item)
        if (value) values.add(value)
      })
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const domesticMobileFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.domesticMobile)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const emergencyContactNameFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(
        member.chineseProfile?.emergencyContactName ?? member.expatProfile?.emergencyContactName,
      )
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const emergencyContactPhoneFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(
        member.chineseProfile?.emergencyContactPhone ?? member.expatProfile?.emergencyContactPhone,
      )
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const redBookValidYearsFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = toNumberFilterValue(member.chineseProfile?.redBookValidYears)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const cumulativeAbroadYearsFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = toNumberFilterValue(member.chineseProfile?.cumulativeAbroadYears)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const birthplaceFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.birthplace)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const residenceInChinaFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.residenceInChina)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const medicalHistoryFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.medicalHistory)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const healthStatusFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.chineseProfile?.healthStatus)
      if (value) values.add(value)
      else hasEmpty = true
    })
    const options = Array.from(values)
      .sort(optionCollator.compare)
      .map((value) => ({ value, label: value }))
    if (hasEmpty) options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    return options
  }, [membersData, optionCollator, t.labels.empty])

  const createdAtFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      const key = getMonthKey(member.createdAt)
      if (key) values.add(key)
    })
    const options = Array.from(values)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.createdAt)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, t.labels.empty])

  const updatedAtFilterOptions = useMemo(() => {
    const values = new Set<string>()
    membersData.forEach((member) => {
      const key = getMonthKey(member.updatedAt)
      if (key) values.add(key)
    })
    const options = Array.from(values)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }))
    if (membersData.some((member) => !member.updatedAt)) {
      options.unshift({ value: EMPTY_FILTER_VALUE, label: t.labels.empty })
    }
    return options
  }, [membersData, t.labels.empty])

  return {
    optionCollator,
    positionOptions,
    teamOptions,
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
  }
}
