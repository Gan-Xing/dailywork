'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'

import { useRouter } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import {
  employmentStatusLabels,
  genderOptions,
  memberCopy,
  nationalityOptions,
  nationalityRegionLabels,
  type EmploymentStatus,
  type NationalityRegion,
  type NationalityOption,
} from '@/lib/i18n/members'
import {
  defaultSortStack,
  defaultVisibleColumns,
  EMPTY_FILTER_VALUE,
  exportableColumnOrder,
  MEMBER_COLUMN_STORAGE_KEY,
  memberTemplateColumns,
  PAGE_SIZE_OPTIONS,
  PERMISSION_STATUS_OPTIONS,
  PHONE_PATTERN,
  REQUIRED_IMPORT_COLUMNS,
  type ColumnKey,
  type ImportError,
  type SortField,
  type SortOrder,
  type TemplateColumnKey,
} from '@/lib/members/constants'
import {
  buildChineseProfileForm,
  buildExpatProfileForm,
  emptyChineseProfile,
  emptyExpatProfile,
  getMonthKey,
  normalizeProfileNumber,
  normalizeText,
  parseBirthDateFromIdNumber,
  toNumberFilterValue,
  toSalaryFilterValue,
} from '@/lib/members/utils'
import { useMemberTableState } from '@/lib/members/useMemberTableState'
import { type SessionUser } from '@/lib/server/authSession'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { MemberDetailDrawer } from '@/components/members/MemberDetailDrawer'
import { MemberFilterDrawer } from '@/components/members/MemberFilterDrawer'
import { MembersHeader } from '@/components/members/MembersHeader'
import { ActionButton, TabButton } from '@/components/members/MemberButtons'
import type {
  Member,
  Role,
  Permission,
  MemberFormState as FormState,
  PermissionStatus,
  ExpatProfileForm,
} from '@/types/members'

export const dynamic = 'force-dynamic'







type TabKey = 'members' | 'roles' | 'permissions'

export default function MembersPage() {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
  const router = useRouter()
  const { home: breadcrumbHome, members: breadcrumbMembers } = t.breadcrumbs

  const getTodayString = useCallback(() => new Date().toISOString().slice(0, 10), [])
  const [activeTab, setActiveTab] = useState<TabKey>('members')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'view'>('create')
  const [formState, setFormState] = useState<FormState>({
    id: undefined,
    username: '',
    password: '',
    name: '',
    gender: genderOptions[0]?.value ?? '',
    nationality: nationalityOptions[0]?.key ?? '',
    phones: [] as string[],
    joinDate: getTodayString(),
    birthDate: '',
    terminationDate: '',
    terminationReason: '',
    position: '',
    employmentStatus: 'ACTIVE' as EmploymentStatus,
    roleIds: [] as number[],
    chineseProfile: { ...emptyChineseProfile },
    expatProfile: { ...emptyExpatProfile },
  })
  const [membersData, setMembersData] = useState<Member[]>([])
  const [rolesData, setRolesData] = useState<Role[]>([])
  const [permissionsData, setPermissionsData] = useState<Permission[]>([])
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [editingPermissionId, setEditingPermissionId] = useState<number | null>(null)
  const [permissionStatusDraft, setPermissionStatusDraft] = useState<PermissionStatus>('ACTIVE')
  const [permissionUpdatingId, setPermissionUpdatingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleFormState, setRoleFormState] = useState<{ name: string; permissionIds: number[] }>({
    name: '',
    permissionIds: [],
  })
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => [...defaultVisibleColumns])
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
  const [showPhonePicker, setShowPhonePicker] = useState(false)
  const phonePickerRef = useRef<HTMLDivElement | null>(null)
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const {
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
  } = useMemberTableState({ defaultPageSize: 20, defaultSortStack })
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
  } = filters
  const {
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
  } = filterActions
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const sessionPermissions = session?.permissions ?? []
  const hasSessionPermission = (permission: string) => sessionPermissions.includes(permission)
  const canViewMembers = hasSessionPermission('member:view')
  const canCreateMember =
    hasSessionPermission('member:create') || hasSessionPermission('member:manage')
  const canUpdateMember =
    hasSessionPermission('member:update') ||
    hasSessionPermission('member:edit') ||
    hasSessionPermission('member:manage')
  const canDeleteMember =
    hasSessionPermission('member:delete') || hasSessionPermission('member:manage')
  const canCreateRole =
    hasSessionPermission('role:create') || hasSessionPermission('role:manage')
  const canUpdateRole =
    hasSessionPermission('role:update') || hasSessionPermission('role:manage')
  const canDeleteRole =
    hasSessionPermission('role:delete') || hasSessionPermission('role:manage')
  const canViewRole =
    hasSessionPermission('role:view') || canCreateRole || canUpdateRole || canDeleteRole
  const canAssignRole = canUpdateRole
  const canViewPermissions = hasSessionPermission('permission:view')
  const canUpdatePermissions = hasSessionPermission('permission:update')
  const shouldShowAccessDenied = authLoaded && !canViewMembers
  const statusLabels = employmentStatusLabels[locale]
  const nationalityByRegion = useMemo(() => {
    const grouped = new Map<NationalityRegion, NationalityOption[]>()
    nationalityOptions.forEach((option) => {
      option.regions.forEach((region) => {
        const bucket = grouped.get(region) ?? []
        bucket.push(option)
        grouped.set(region, bucket)
      })
    })
    return grouped
  }, [])

  const findNationalityLabel = useCallback(
    (value: string | null) => {
      const option = nationalityOptions.find((item) => item.key === value)
      return option ? option.label[locale] : value || t.labels.empty
    },
    [locale, t.labels.empty],
  )

  const findGenderLabel = useCallback(
    (value: string | null) => {
      const option = genderOptions.find((item) => item.value === value)
      return option ? option.label[locale] : value || t.labels.empty
    },
    [locale, t.labels.empty],
  )

  const formatProfileText = useCallback(
    (value?: string | null) => {
      const normalized = normalizeText(value)
      return normalized ? normalized : t.labels.empty
    },
    [t.labels.empty],
  )

  const formatProfileNumber = useCallback(
    (value?: number | null) => (value === null || value === undefined ? t.labels.empty : String(value)),
    [t.labels.empty],
  )

  const formatProfileList = useCallback(
    (values?: string[] | null) => (values && values.length ? values.join(' / ') : t.labels.empty),
    [t.labels.empty],
  )
  const formatSalary = useCallback(
    (amount?: string | null, unit?: 'MONTH' | 'HOUR' | null, fallbackUnit?: 'MONTH' | 'HOUR' | null) => {
      const normalized = normalizeText(amount)
      if (!normalized) return t.labels.empty
      const resolvedUnit = unit ?? fallbackUnit
      if (!resolvedUnit) return normalized
      return `${normalized}/${resolvedUnit === 'MONTH' ? 'M' : 'H'}`
    },
    [t.labels.empty],
  )

  const columnOptions: { key: ColumnKey; label: ReactNode }[] = useMemo(() => {
    const baseOptions: { key: ColumnKey; label: ReactNode }[] = [
      { key: 'sequence', label: t.table.sequence },
      { key: 'name', label: t.table.name },
      { key: 'username', label: t.table.username },
      { key: 'gender', label: t.table.gender },
      { key: 'nationality', label: t.table.nationality },
      { key: 'phones', label: t.table.phones },
      { key: 'joinDate', label: t.table.joinDate },
      { key: 'birthDate', label: t.table.birthDate },
      { key: 'position', label: t.table.position },
      { key: 'employmentStatus', label: t.table.employmentStatus },
      { key: 'terminationDate', label: t.table.terminationDate },
      { key: 'terminationReason', label: t.table.terminationReason },
      { key: 'roles', label: t.table.roles },
      { key: 'team', label: t.table.team },
      { key: 'contractNumber', label: t.table.contractNumber },
      { key: 'contractType', label: t.table.contractType },
      { key: 'salaryCategory', label: t.table.salaryCategory },
      { key: 'baseSalary', label: t.table.baseSalary },
      { key: 'netMonthly', label: t.table.netMonthly },
      { key: 'maritalStatus', label: t.table.maritalStatus },
      { key: 'childrenCount', label: t.table.childrenCount },
      { key: 'cnpsNumber', label: t.table.cnpsNumber },
      { key: 'cnpsDeclarationCode', label: t.table.cnpsDeclarationCode },
      { key: 'provenance', label: t.table.provenance },
      { key: 'frenchName', label: t.table.frenchName },
      { key: 'idNumber', label: t.table.idNumber },
      { key: 'passportNumber', label: t.table.passportNumber },
      { key: 'educationAndMajor', label: t.table.educationAndMajor },
      { key: 'certifications', label: t.table.certifications },
      { key: 'domesticMobile', label: t.table.domesticMobile },
      { key: 'emergencyContactName', label: t.table.emergencyContactName },
      { key: 'emergencyContactPhone', label: t.table.emergencyContactPhone },
      { key: 'redBookValidYears', label: t.table.redBookValidYears },
      { key: 'cumulativeAbroadYears', label: t.table.cumulativeAbroadYears },
      { key: 'birthplace', label: t.table.birthplace },
      { key: 'residenceInChina', label: t.table.residenceInChina },
      { key: 'medicalHistory', label: t.table.medicalHistory },
      { key: 'healthStatus', label: t.table.healthStatus },
      { key: 'createdAt', label: t.table.createdAt },
      { key: 'updatedAt', label: t.table.updatedAt },
      { key: 'actions', label: t.table.actions },
    ]
    return canAssignRole ? baseOptions : baseOptions.filter((option) => option.key !== 'roles')
  }, [canAssignRole, t.table])
  const columnLabels = useMemo(
    () => ({
      sequence: t.table.sequence,
      name: t.table.name,
      username: t.table.username,
      gender: t.table.gender,
      nationality: t.table.nationality,
      phones: t.table.phones,
      joinDate: t.table.joinDate,
      birthDate: t.table.birthDate,
      position: t.table.position,
      employmentStatus: t.table.employmentStatus,
      terminationDate: t.table.terminationDate,
      terminationReason: t.table.terminationReason,
      roles: t.table.roles,
      team: t.table.team,
      contractNumber: t.table.contractNumber,
      contractType: t.table.contractType,
      salaryCategory: t.table.salaryCategory,
      baseSalary: t.table.baseSalary,
      netMonthly: t.table.netMonthly,
      maritalStatus: t.table.maritalStatus,
      childrenCount: t.table.childrenCount,
      cnpsNumber: t.table.cnpsNumber,
      cnpsDeclarationCode: t.table.cnpsDeclarationCode,
      provenance: t.table.provenance,
      frenchName: t.table.frenchName,
      idNumber: t.table.idNumber,
      passportNumber: t.table.passportNumber,
      educationAndMajor: t.table.educationAndMajor,
      certifications: t.table.certifications,
      domesticMobile: t.table.domesticMobile,
      emergencyContactName: t.table.emergencyContactName,
      emergencyContactPhone: t.table.emergencyContactPhone,
      redBookValidYears: t.table.redBookValidYears,
      cumulativeAbroadYears: t.table.cumulativeAbroadYears,
      birthplace: t.table.birthplace,
      residenceInChina: t.table.residenceInChina,
      medicalHistory: t.table.medicalHistory,
      healthStatus: t.table.healthStatus,
      createdAt: t.table.createdAt,
      updatedAt: t.table.updatedAt,
      actions: t.table.actions,
    }),
    [t.table],
  )
  const templateColumnLabels = useMemo<Record<TemplateColumnKey, string>>(
    () => ({
      name: t.form.name,
      username: t.form.username,
      password: t.form.password,
      gender: t.form.gender,
      nationality: t.form.nationality,
      phones: t.form.phones,
      joinDate: t.form.joinDate,
      birthDate: t.form.birthDate,
      position: t.form.position,
      employmentStatus: t.form.status,
      terminationDate: t.form.terminationDate,
      terminationReason: t.form.terminationReason,
      roles: t.form.roles,
      team: t.form.team,
      contractNumber: t.form.contractNumber,
      contractType: t.form.contractType,
      salaryCategory: t.form.salaryCategory,
      baseSalary: t.form.baseSalary,
      netMonthly: t.form.netMonthly,
      maritalStatus: t.form.maritalStatus,
      childrenCount: t.form.childrenCount,
      cnpsNumber: t.form.cnpsNumber,
      cnpsDeclarationCode: t.form.cnpsDeclarationCode,
      provenance: t.form.provenance,
      emergencyContact: t.form.emergencyContact,
      frenchName: t.form.frenchName,
      idNumber: t.form.idNumber,
      passportNumber: t.form.passportNumber,
      educationAndMajor: t.form.educationAndMajor,
      certifications: t.form.certifications,
      domesticMobile: t.form.domesticMobile,
      emergencyContactName: t.form.emergencyContactName,
      emergencyContactPhone: t.form.emergencyContactPhone,
      redBookValidYears: t.form.redBookValidYears,
      cumulativeAbroadYears: t.form.cumulativeAbroadYears,
      birthplace: t.form.birthplace,
      residenceInChina: t.form.residenceInChina,
      medicalHistory: t.form.medicalHistory,
      healthStatus: t.form.healthStatus,
    }),
    [t.form],
  )
  const importHeaderMap = useMemo(() => {
    const map = new Map<string, TemplateColumnKey>()
    const normalize = (value: string) => value.trim().toLowerCase()
    const add = (label: string, key: TemplateColumnKey) => {
      if (label) map.set(normalize(label), key)
    }
    const register = (copy: (typeof memberCopy)[keyof typeof memberCopy]) => {
      add(copy.form.name, 'name')
      add(copy.form.username, 'username')
      add(copy.form.password, 'password')
      add(copy.form.gender, 'gender')
      add(copy.form.nationality, 'nationality')
      add(copy.form.phones, 'phones')
      add(copy.form.joinDate, 'joinDate')
      add(copy.form.birthDate, 'birthDate')
      add(copy.form.position, 'position')
      add(copy.form.status, 'employmentStatus')
      add(copy.form.terminationDate, 'terminationDate')
      add(copy.form.terminationReason, 'terminationReason')
      add(copy.form.roles, 'roles')
      add(copy.form.team, 'team')
      add(copy.form.contractNumber, 'contractNumber')
      add(copy.form.contractType, 'contractType')
      add(copy.form.salaryCategory, 'salaryCategory')
      add(copy.form.baseSalary, 'baseSalary')
      add(copy.form.netMonthly, 'netMonthly')
      add(copy.form.maritalStatus, 'maritalStatus')
      add(copy.form.childrenCount, 'childrenCount')
      add(copy.form.cnpsNumber, 'cnpsNumber')
      add(copy.form.cnpsDeclarationCode, 'cnpsDeclarationCode')
      add(copy.form.provenance, 'provenance')
      add(copy.form.emergencyContact, 'emergencyContact')
      add(copy.form.frenchName, 'frenchName')
      add(copy.form.idNumber, 'idNumber')
      add(copy.form.passportNumber, 'passportNumber')
      add(copy.form.educationAndMajor, 'educationAndMajor')
      add(copy.form.certifications, 'certifications')
      add(copy.form.domesticMobile, 'domesticMobile')
      add(copy.form.emergencyContactName, 'emergencyContactName')
      add(copy.form.emergencyContactPhone, 'emergencyContactPhone')
      add(copy.form.redBookValidYears, 'redBookValidYears')
      add(copy.form.cumulativeAbroadYears, 'cumulativeAbroadYears')
      add(copy.form.birthplace, 'birthplace')
      add(copy.form.residenceInChina, 'residenceInChina')
      add(copy.form.medicalHistory, 'medicalHistory')
      add(copy.form.healthStatus, 'healthStatus')
    }
    register(memberCopy.zh)
    register(memberCopy.fr)
    return map
  }, [])
  const nationalityLookup = useMemo(() => {
    const map = new Map<string, string>()
    const normalize = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
    nationalityOptions.forEach((option) => {
      map.set(normalize(option.key), option.key)
      map.set(normalize(option.label.zh), option.key)
      map.set(normalize(option.label.fr), option.key)
    })
    return map
  }, [])
  const genderLookup = useMemo(() => {
    const map = new Map<string, string>()
    const normalize = (value: string) => value.trim().toLowerCase()
    genderOptions.forEach((option) => {
      map.set(normalize(option.value), option.value)
      map.set(normalize(option.label.zh), option.value)
      map.set(normalize(option.label.fr), option.value)
    })
    map.set('male', '男')
    map.set('female', '女')
    map.set('m', '男')
    map.set('f', '女')
    return map
  }, [])
  const statusLookup = useMemo(() => {
    const map = new Map<string, EmploymentStatus>()
    const normalize = (value: string) => value.trim().toLowerCase()
    map.set('active', 'ACTIVE')
    map.set('on_leave', 'ON_LEAVE')
    map.set('on leave', 'ON_LEAVE')
    map.set('terminated', 'TERMINATED')
    map.set(normalize(memberCopy.zh.status.ACTIVE), 'ACTIVE')
    map.set(normalize(memberCopy.zh.status.ON_LEAVE), 'ON_LEAVE')
    map.set(normalize(memberCopy.zh.status.TERMINATED), 'TERMINATED')
    map.set(normalize(memberCopy.fr.status.ACTIVE), 'ACTIVE')
    map.set(normalize(memberCopy.fr.status.ON_LEAVE), 'ON_LEAVE')
    map.set(normalize(memberCopy.fr.status.TERMINATED), 'TERMINATED')
    return map
  }, [])
  const activePermissions = useMemo(
    () => permissionsData.filter((permission) => permission.status === 'ACTIVE'),
    [permissionsData],
  )
  const templateColumns = useMemo(() => {
    if (canAssignRole) return memberTemplateColumns
    return memberTemplateColumns.filter((key) => key !== 'roles')
  }, [canAssignRole])
  const isSortDefault = useMemo(
    () =>
      sortStack.length === defaultSortStack.length &&
      sortStack.every(
        (spec, index) =>
          spec.field === defaultSortStack[index]?.field &&
          spec.order === defaultSortStack[index]?.order,
      ),
    [sortStack],
  )
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
    const options: Array<{ value: string; label: string }> = order.map((status) => ({
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

  const contractNumberFilterOptions = useMemo(() => {
    const values = new Set<string>()
    let hasEmpty = false
    membersData.forEach((member) => {
      const value = normalizeText(member.expatProfile?.contractNumber)
      if (value) values.add(value)
      else hasEmpty = true
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
      teamFilters.length > 0 ||
      contractNumberFilters.length > 0 ||
      contractTypeFilters.length > 0 ||
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
      teamFilters.length +
      contractNumberFilters.length +
      contractTypeFilters.length +
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
    canAssignRole,
  ])

  const clearFilters = () => {
    resetFilters()
  }

  const modalTitle = formMode === 'view' ? t.actions.view : t.actions.create
  const modalSubtitle = t.modalSubtitle
  const filterControlProps = {
    allLabel: t.filters.all,
    selectedLabel: t.filters.selected,
    selectAllLabel: t.filters.selectAll,
    clearLabel: t.filters.clear,
    noOptionsLabel: t.filters.noOptions,
    searchPlaceholder: t.filters.searchPlaceholder,
  }

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        const data = (await res.json()) as { user?: SessionUser | null }
        setSession(data.user ?? null)
      } catch {
        setSession(null)
      } finally {
        setAuthLoaded(true)
      }
    }
    void fetchSession()
  }, [])

  const loadData = useCallback(async () => {
    if (!authLoaded) return
    setLoading(true)
    setError(null)
    try {
      const tasks: Promise<void>[] = []
      const shouldLoadRoles = canViewRole || canAssignRole

      if (canViewMembers) {
        const memberTask = fetch('/api/members')
          .then((res) => {
            if (!res.ok) throw new Error(t.feedback.loadError)
            return res.json() as Promise<{ members: Member[] }>
          })
          .then((membersJson) =>
            setMembersData(
              (membersJson.members ?? []).map((member) => ({
                ...member,
                employmentStatus: (member.employmentStatus ?? 'ACTIVE') as EmploymentStatus,
                phones: member.phones ?? [],
              })),
            ),
          )
        tasks.push(memberTask)
      } else {
        setMembersData([])
      }

      if (shouldLoadRoles) {
        const rolesTask = fetch('/api/roles')
          .then((res) => {
            if (!res.ok) throw new Error(t.feedback.loadError)
            return res.json() as Promise<{ roles: Role[] }>
          })
          .then((rolesJson) =>
            setRolesData(
              (rolesJson.roles ?? []).map((role) => ({
                ...role,
                permissions: role.permissions.map((permission) => ({
                  ...permission,
                  status: permission.status ?? 'ACTIVE',
                })),
              })),
            ),
          )
        tasks.push(rolesTask)
      } else {
        setRolesData([])
      }

      if (canViewPermissions) {
        const permissionsTask = fetch('/api/auth/permissions')
          .then((res) => {
            if (!res.ok) throw new Error(t.feedback.loadError)
            return res.json() as Promise<{ permissions: Permission[] }>
          })
          .then((permissionsJson) =>
            setPermissionsData(
              (permissionsJson.permissions ?? []).map((permission) => ({
                ...permission,
                status: permission.status ?? 'ACTIVE',
              })),
            ),
          )
        tasks.push(permissionsTask)
      } else {
        setPermissionsData([])
      }

      await Promise.all(tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.feedback.loadError)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMembers, canViewPermissions, canViewRole, canAssignRole, t.feedback.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const resetForm = () => {
    setFormState({
      id: undefined,
      username: '',
      password: '',
      name: '',
      gender: genderOptions[0]?.value ?? '',
      nationality: nationalityOptions[0]?.key ?? '',
      phones: [],
      joinDate: getTodayString(),
      birthDate: '',
      terminationDate: '',
      terminationReason: '',
      position: '',
      employmentStatus: 'ACTIVE',
      roleIds: [],
      chineseProfile: { ...emptyChineseProfile },
      expatProfile: { ...emptyExpatProfile },
    })
    setPhoneInput('')
    setProfileExpanded(false)
  }

  const resetRoleForm = () => {
    setRoleFormState({ name: '', permissionIds: [] })
    setRoleError(null)
    setEditingRoleId(null)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
      if (phonePickerRef.current && !phonePickerRef.current.contains(event.target as Node)) {
        setShowPhonePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(MEMBER_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return
      const filtered = parsed.filter((item) =>
        typeof item === 'string' && columnOptions.some((opt) => opt.key === item),
      ) as ColumnKey[]
      if (filtered.length || stored.trim() === '[]') {
        setVisibleColumns(filtered)
      } else {
        setVisibleColumns(defaultVisibleColumns)
      }
    } catch (error) {
      console.error('Failed to load member columns', error)
    }
  }, [columnOptions])

useEffect(() => {
  if (canAssignRole) return
  setSortStack((prev) => prev.filter((item) => item.field !== 'roles'))
}, [canAssignRole, setSortStack])

  const persistVisibleColumns = (next: ColumnKey[]) => {
    setVisibleColumns(next)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MEMBER_COLUMN_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('Failed to persist member columns', error)
      }
    }
  }

  const toggleColumn = (key: ColumnKey) => {
    persistVisibleColumns(
      visibleColumns.includes(key)
        ? visibleColumns.filter((item) => item !== key)
        : [...visibleColumns, key],
    )
  }

  const selectAllColumns = () => persistVisibleColumns(columnOptions.map((item) => item.key))
  const restoreDefaultColumns = () => persistVisibleColumns([...defaultVisibleColumns])
  const clearColumns = () => persistVisibleColumns([])
  const isVisible = (key: ColumnKey) => {
    if (key === 'roles' && !canAssignRole) return false
    return visibleColumns.includes(key)
  }

  const openCreateRoleModal = () => {
    if (!canCreateRole) {
      setRoleError(t.errors.needRoleCreate)
      return
    }
    resetRoleForm()
    setShowRoleModal(true)
  }

  const openCreateModal = () => {
    if (!canCreateMember) {
      setActionError(t.errors.needMemberCreate)
      return
    }
    setActionError(null)
    resetForm()
    setFormMode('create')
    setShowCreateModal(true)
  }

  const openEditPage = (member: Member) => {
    if (!canUpdateMember) {
      setActionError(t.errors.needMemberUpdate)
      return
    }
    setActionError(null)
    router.push(`/members/${member.id}`)
  }

  const openViewModal = (member: Member) => {
    setActionError(null)
    setFormState({
      id: member.id,
      username: member.username,
      password: '',
      name: member.name ?? '',
      gender: member.gender ?? (genderOptions[0]?.value ?? ''),
      nationality: member.nationality ?? (nationalityOptions[0]?.key ?? ''),
      phones: member.phones?.length ? member.phones : [],
      joinDate: member.joinDate ? member.joinDate.slice(0, 10) : '',
      birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
      terminationDate: member.terminationDate ? member.terminationDate.slice(0, 10) : '',
      terminationReason: member.terminationReason ?? '',
      position: member.position ?? '',
      employmentStatus: member.employmentStatus ?? 'ACTIVE',
      roleIds: member.roles?.map((role) => role.id) ?? [],
      chineseProfile: buildChineseProfileForm(member.chineseProfile),
      expatProfile: buildExpatProfileForm(member.expatProfile),
    })
    setPhoneInput('')
    setProfileExpanded(true)
    setFormMode('view')
    setShowCreateModal(true)
  }

  const toggleRole = (roleId: number) => {
    setFormState((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }))
  }

  const addPhoneFromInput = () => {
    const trimmed = phoneInput.trim()
    if (!trimmed) return
    setFormState((prev) => {
      const next = Array.from(new Set([...prev.phones.filter(Boolean), trimmed]))
      return { ...prev, phones: next }
    })
    setPhoneInput('')
  }

  const removePhone = (index: number) => {
    setFormState((prev) => {
      const next = [...prev.phones]
      next.splice(index, 1)
      return { ...prev, phones: next }
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canCreateMember) {
      setActionError(t.errors.needMemberCreate)
      return
    }
    setSubmitting(true)
    setActionError(null)
    const phoneList = [
      ...(formState.phones ?? []).map((phone) => phone.trim()).filter(Boolean),
      phoneInput.trim(),
    ].filter(Boolean)
    const joinDateValue = formState.joinDate || getTodayString()
    const birthDateValue = formState.birthDate.trim()
    let resolvedBirthDate = birthDateValue
    if (!resolvedBirthDate && formState.nationality === 'china') {
      resolvedBirthDate = parseBirthDateFromIdNumber(formState.chineseProfile.idNumber)
    }
    const isChinese = formState.nationality === 'china'
    const isTerminated = formState.employmentStatus === 'TERMINATED'
    const terminationDateValue = formState.terminationDate.trim()
    const terminationReasonValue = formState.terminationReason.trim()
    const chineseProfilePayload = {
      frenchName: formState.chineseProfile.frenchName.trim() || null,
      idNumber: formState.chineseProfile.idNumber.trim() || null,
      passportNumber: formState.chineseProfile.passportNumber.trim() || null,
      educationAndMajor: formState.chineseProfile.educationAndMajor.trim() || null,
      certifications: formState.chineseProfile.certifications.map((item) => item.trim()).filter(Boolean),
      domesticMobile: formState.chineseProfile.domesticMobile.trim() || null,
      emergencyContactName: formState.chineseProfile.emergencyContactName.trim() || null,
      emergencyContactPhone: formState.chineseProfile.emergencyContactPhone.trim() || null,
      redBookValidYears: normalizeProfileNumber(formState.chineseProfile.redBookValidYears),
      cumulativeAbroadYears: normalizeProfileNumber(formState.chineseProfile.cumulativeAbroadYears),
      birthplace: formState.chineseProfile.birthplace.trim() || null,
      residenceInChina: formState.chineseProfile.residenceInChina.trim() || null,
      medicalHistory: formState.chineseProfile.medicalHistory.trim() || null,
      healthStatus: formState.chineseProfile.healthStatus.trim() || null,
    }
    const expatProfilePayload = {
      team: formState.expatProfile.team.trim() || null,
      contractNumber: formState.expatProfile.contractNumber.trim() || null,
      contractType: formState.expatProfile.contractType || null,
      salaryCategory: formState.expatProfile.salaryCategory.trim() || null,
      baseSalaryAmount: formState.expatProfile.baseSalaryAmount.trim() || null,
      baseSalaryUnit: formState.expatProfile.baseSalaryUnit || null,
      netMonthlyAmount: formState.expatProfile.netMonthlyAmount.trim() || null,
      netMonthlyUnit: formState.expatProfile.netMonthlyUnit || null,
      maritalStatus: formState.expatProfile.maritalStatus.trim() || null,
      childrenCount: formState.expatProfile.childrenCount.trim() || null,
      cnpsNumber: formState.expatProfile.cnpsNumber.trim() || null,
      cnpsDeclarationCode: formState.expatProfile.cnpsDeclarationCode.trim() || null,
      provenance: formState.expatProfile.provenance.trim() || null,
      emergencyContactName: formState.expatProfile.emergencyContactName.trim() || null,
      emergencyContactPhone: formState.expatProfile.emergencyContactPhone.trim() || null,
    }
    if (expatProfilePayload.netMonthlyAmount && !expatProfilePayload.netMonthlyUnit) {
      expatProfilePayload.netMonthlyUnit = 'MONTH'
    }
    const payload: {
      username: string
      password: string
      name: string
      gender: string
      nationality: string
      phones: string[]
      joinDate: string | undefined
      birthDate: string
      terminationDate: string | null
      terminationReason: string | null
      position: string | null
      employmentStatus: EmploymentStatus
      roleIds?: number[]
      chineseProfile: typeof chineseProfilePayload
      expatProfile: typeof expatProfilePayload
    } = {
      username: formState.username.trim(),
      password: formState.password,
      name: formState.name.trim(),
      gender: formState.gender,
      nationality: formState.nationality,
      phones: phoneList,
      joinDate: joinDateValue,
      birthDate: resolvedBirthDate,
      terminationDate: isTerminated ? terminationDateValue : null,
      terminationReason: isTerminated ? terminationReasonValue : null,
      position: formState.position.trim() || null,
      employmentStatus: formState.employmentStatus,
      chineseProfile: chineseProfilePayload,
      expatProfile: expatProfilePayload,
    }
    if (canAssignRole) {
      payload.roleIds = formState.roleIds
    }

    try {
      if (!payload.username) {
        throw new Error(t.errors.usernameRequired)
      }
      if (!payload.password) {
        throw new Error(t.errors.passwordRequired)
      }
      if (!payload.birthDate) {
        throw new Error(t.errors.birthDateRequired)
      }
      if (isTerminated && !terminationDateValue) {
        throw new Error(t.errors.terminationDateRequired)
      }
      if (isTerminated && !terminationReasonValue) {
        throw new Error(t.errors.terminationReasonRequired)
      }
      if (
        !isChinese &&
        expatProfilePayload.contractType === 'CDD' &&
        expatProfilePayload.baseSalaryUnit === 'HOUR'
      ) {
        throw new Error(t.errors.baseSalaryUnitInvalid)
      }
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      setShowCreateModal(false)
      await loadData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (member: Member) => {
    if (!canDeleteMember) {
      setActionError(t.errors.needMemberDelete)
      return
    }
    if (!window.confirm(t.feedback.deleteConfirm(member.username))) return
    setSubmitting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      await loadData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRole = async (roleId: number) => {
    if (!canDeleteRole) {
      setRoleError(t.errors.needRoleDelete)
      return
    }
    if (!window.confirm(t.errors.roleDeleteConfirm)) return
    setRoleSubmitting(true)
    setRoleError(null)
    try {
      const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      await loadData()
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setRoleSubmitting(false)
    }
  }

  const togglePermission = (permissionId: number) => {
    setRoleFormState((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }))
  }

  const handleCreateRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const isEditing = Boolean(editingRoleId)
    if (isEditing && !canUpdateRole) {
      setRoleError(t.errors.needRoleUpdate)
      return
    }
    if (!isEditing && !canCreateRole) {
      setRoleError(t.errors.needRoleCreate)
      return
    }
    setRoleSubmitting(true)
    setRoleError(null)
    try {
      if (!roleFormState.name.trim()) {
        throw new Error(t.errors.roleNameRequired)
      }
      const target = editingRoleId ? `/api/roles/${editingRoleId}` : '/api/roles'
      const method = editingRoleId ? 'PUT' : 'POST'
      const res = await fetch(target, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleFormState.name.trim(),
          permissionIds: roleFormState.permissionIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      setShowRoleModal(false)
      await loadData()
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setRoleSubmitting(false)
    }
  }

  const startEditPermission = (permission: Permission) => {
    if (!canUpdatePermissions) {
      setPermissionError(t.errors.needPermissionUpdate)
      return
    }
    setPermissionError(null)
    setEditingPermissionId(permission.id)
    setPermissionStatusDraft(permission.status)
  }

  const cancelEditPermission = () => {
    setEditingPermissionId(null)
    setPermissionStatusDraft('ACTIVE')
  }

  const savePermissionStatus = async () => {
    if (!editingPermissionId) return
    if (!canUpdatePermissions) {
      setPermissionError(t.errors.needPermissionUpdate)
      return
    }
    setPermissionUpdatingId(editingPermissionId)
    setPermissionError(null)
    try {
      const res = await fetch(`/api/auth/permissions/${editingPermissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: permissionStatusDraft }),
      })
      const payload = (await res.json().catch(() => ({}))) as { permission?: Permission; error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? t.errors.permissionUpdateFailed)
      }
      const updated = payload.permission
      setPermissionsData((prev) =>
        prev.map((permission) =>
          permission.id === editingPermissionId
            ? { ...permission, status: updated?.status ?? permissionStatusDraft }
            : permission,
        ),
      )
      setEditingPermissionId(null)
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : t.errors.permissionUpdateFailed)
    } finally {
      setPermissionUpdatingId(null)
    }
  }

  const formatImportError = useCallback(
    (error: ImportError) => {
      let message = t.errors.importFailed
      switch (error.code) {
        case 'missing_name':
          message = t.errors.nameRequired
          break
        case 'missing_username':
          message = t.errors.usernameRequired
          break
        case 'missing_password':
          message = t.errors.passwordRequired
          break
        case 'duplicate_username':
          message = t.errors.importDuplicateUsername
          break
        case 'duplicate_identity':
          message = t.errors.importDuplicateIdentity
          break
        case 'username_exists':
          message = t.errors.importUsernameExists
          break
        case 'invalid_gender':
          message = t.errors.importInvalidGender
          break
        case 'invalid_phone':
          message = t.errors.importInvalidPhone
          break
        case 'invalid_contract_type':
          message = t.errors.importInvalidContractType
          break
        case 'invalid_base_salary_unit':
          message = t.errors.importInvalidBaseSalaryUnit
          break
        case 'invalid_status':
          message = t.errors.importInvalidStatus
          break
        case 'invalid_join_date':
          message = t.errors.importInvalidJoinDate
          break
        case 'missing_birth_date':
          message = t.errors.importMissingBirthDate
          break
        case 'invalid_birth_date':
          message = t.errors.importInvalidBirthDate
          break
        case 'missing_termination_date':
          message = t.errors.terminationDateRequired
          break
        case 'invalid_termination_date':
          message = t.errors.terminationDateInvalid
          break
        case 'missing_termination_reason':
          message = t.errors.terminationReasonRequired
          break
        case 'duplicate_contract_number':
          message = t.errors.importDuplicateContractNumber
          break
        case 'contract_number_exists':
          message = t.errors.importContractNumberExists
          break
        case 'role_not_found':
          message = t.errors.importRoleNotFound(error.value ?? '')
          break
        default:
          message = t.errors.importFailed
      }
      return t.feedback.importRowError(error.row, message)
    },
    [t],
  )

  const handleImportClick = () => {
    if (!canCreateMember) {
      setActionError(t.errors.needMemberCreate)
      setActionNotice(null)
      return
    }
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!canCreateMember) {
      setActionError(t.errors.needMemberCreate)
      setActionNotice(null)
      return
    }
    setImporting(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const worksheet = sheetName ? workbook.Sheets[sheetName] : null
      if (!worksheet) {
        throw new Error(t.errors.importInvalidFile)
      }
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as unknown[][]
      if (!rows.length) {
        throw new Error(t.errors.importNoData)
      }
      const headerRow =
        rows[0]?.map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim()) ?? []
      const headerKeys = headerRow.map((label) => {
        if (!label) return null
        return importHeaderMap.get(label.toLowerCase()) ?? null
      })
      const usedKeys = headerKeys.filter(Boolean) as TemplateColumnKey[]
      const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((key) => !usedKeys.includes(key))
      if (missingRequired.length > 0) {
        throw new Error(t.errors.importMissingHeaders)
      }
      const errors: ImportError[] = []
      const prepared: Array<{
        row: number
        username?: string
        password?: string
        name?: string
        gender?: string | null
        nationality?: string | null
        phones: string[]
        joinDate?: string | null
        birthDate?: string | null
        terminationDate?: string | null
        terminationReason?: string | null
        position?: string | null
        employmentStatus?: EmploymentStatus | null
        roleIds?: number[]
        team?: string | null
        contractNumber?: string | null
        contractType?: string | null
        salaryCategory?: string | null
        baseSalary?: string | null
        netMonthly?: string | null
        maritalStatus?: string | null
        childrenCount?: number | string | null
        cnpsNumber?: string | null
        cnpsDeclarationCode?: string | null
        provenance?: string | null
        emergencyContact?: string | null
        frenchName?: string | null
        idNumber?: string | null
        passportNumber?: string | null
        educationAndMajor?: string | null
        certifications?: string[] | string | null
        domesticMobile?: string | null
        emergencyContactName?: string | null
        emergencyContactPhone?: string | null
        redBookValidYears?: number | string | null
        cumulativeAbroadYears?: number | string | null
        birthplace?: string | null
        residenceInChina?: string | null
        medicalHistory?: string | null
        healthStatus?: string | null
      }> = []
      const seenUsernames = new Set<string>()

      const normalizeDate = (value: unknown) => {
        if (!value) return null
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toISOString().slice(0, 10)
        }
        if (typeof value === 'number') {
          const parsed = XLSX.SSF.parse_date_code(value)
          if (parsed) {
            const month = String(parsed.m).padStart(2, '0')
            const day = String(parsed.d).padStart(2, '0')
            return `${parsed.y}-${month}-${day}`
          }
        }
        const text = String(value).trim()
        if (!text) return null
        const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
        if (match) {
          const [, year, month, day] = match
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
        return null
      }

      const normalizePhones = (value: unknown) => {
        if (value == null) return []
        const text = String(value).trim()
        if (!text) return []
        return text
          .split(/[\/,，;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      }

      const normalizeList = (value: unknown) => {
        if (value == null) return []
        const text = String(value).trim()
        if (!text) return []
        return text
          .split(/[\/,，;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      }

      const normalizeNumber = (value: unknown) => {
        if (value == null) return null
        const text = String(value).trim()
        if (!text) return null
        const parsed = Number.parseInt(text, 10)
        return Number.isFinite(parsed) ? parsed : null
      }

      rows.slice(1).forEach((rowValues, index) => {
        const isEmpty = rowValues.every((cell) => !String(cell ?? '').trim())
        if (isEmpty) return
        const rowNumber = index + 2
        let hasJoinDateValue = false
        let hasBirthDateValue = false
        let hasTerminationDateValue = false
        const record: {
          row: number
          username?: string
          password?: string
          name?: string
          gender?: string | null
          nationality?: string | null
          phones: string[]
          joinDate?: string | null
          birthDate?: string | null
          terminationDate?: string | null
          terminationReason?: string | null
          position?: string | null
          employmentStatus?: EmploymentStatus | null
          roleIds?: number[]
          team?: string | null
          contractNumber?: string | null
          contractType?: string | null
          salaryCategory?: string | null
          baseSalary?: string | null
          netMonthly?: string | null
          maritalStatus?: string | null
          childrenCount?: number | string | null
          cnpsNumber?: string | null
          cnpsDeclarationCode?: string | null
          provenance?: string | null
          emergencyContact?: string | null
          frenchName?: string | null
          idNumber?: string | null
          passportNumber?: string | null
          educationAndMajor?: string | null
          certifications?: string[] | string | null
          domesticMobile?: string | null
          emergencyContactName?: string | null
          emergencyContactPhone?: string | null
          redBookValidYears?: number | string | null
          cumulativeAbroadYears?: number | string | null
          birthplace?: string | null
          residenceInChina?: string | null
          medicalHistory?: string | null
          healthStatus?: string | null
        } = {
          row: rowNumber,
          phones: [],
        }
        headerKeys.forEach((key, columnIndex) => {
          if (!key) return
          const rawValue = rowValues[columnIndex]
          switch (key) {
            case 'name':
              record.name = String(rawValue ?? '').trim()
              break
            case 'username':
              {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.username = text
                }
              }
              break
            case 'password':
              {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.password = text
                }
              }
              break
            case 'gender': {
              const text = String(rawValue ?? '').trim()
              if (text) {
                record.gender = genderLookup.get(text.toLowerCase()) ?? text
              }
              break
            }
            case 'nationality': {
              const text = String(rawValue ?? '').trim()
              if (text) {
                const normalized = text
                  .toLowerCase()
                  .replace(/[’']/g, "'")
                  .replace(/\s+/g, ' ')
                record.nationality = nationalityLookup.get(normalized) ?? text
              }
              break
            }
            case 'phones':
              record.phones = normalizePhones(rawValue)
              break
            case 'joinDate':
              if (String(rawValue ?? '').trim()) {
                hasJoinDateValue = true
              }
              record.joinDate = normalizeDate(rawValue)
              break
            case 'birthDate':
              if (String(rawValue ?? '').trim()) {
                hasBirthDateValue = true
              }
              record.birthDate = normalizeDate(rawValue)
              break
            case 'position':
              record.position = String(rawValue ?? '').trim()
              break
            case 'employmentStatus': {
              const text = String(rawValue ?? '').trim()
              if (text) {
                record.employmentStatus = statusLookup.get(text.toLowerCase()) ?? (text as EmploymentStatus)
              }
              break
            }
            case 'terminationDate':
              if (String(rawValue ?? '').trim()) {
                hasTerminationDateValue = true
              }
              record.terminationDate = normalizeDate(rawValue)
              break
            case 'terminationReason':
              record.terminationReason = String(rawValue ?? '').trim()
              break
            case 'roles': {
              if (!canAssignRole) break
              const text = String(rawValue ?? '').trim()
              if (text) {
                const names = text
                  .split(/[\/,，;]+/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                if (names.length) {
                  const roleIds = names.map((name) => rolesData.find((role) => role.name === name)?.id)
                  const missingRole = roleIds.find((id) => !id)
                  if (missingRole) {
                    errors.push({ row: rowNumber, code: 'role_not_found', value: text })
                  } else {
                    record.roleIds = roleIds.filter(Boolean) as number[]
                  }
                }
              }
              break
            }
            case 'team':
              record.team = String(rawValue ?? '').trim()
              break
            case 'contractNumber':
              record.contractNumber = String(rawValue ?? '').trim()
              break
            case 'contractType':
              record.contractType = String(rawValue ?? '').trim()
              break
            case 'salaryCategory':
              record.salaryCategory = String(rawValue ?? '').trim()
              break
            case 'baseSalary':
              record.baseSalary = String(rawValue ?? '').trim()
              break
            case 'netMonthly':
              record.netMonthly = String(rawValue ?? '').trim()
              break
            case 'maritalStatus':
              record.maritalStatus = String(rawValue ?? '').trim()
              break
            case 'childrenCount':
              record.childrenCount = String(rawValue ?? '').trim()
              break
            case 'cnpsNumber':
              record.cnpsNumber = String(rawValue ?? '').trim()
              break
            case 'cnpsDeclarationCode':
              record.cnpsDeclarationCode = String(rawValue ?? '').trim()
              break
            case 'provenance':
              record.provenance = String(rawValue ?? '').trim()
              break
            case 'emergencyContact':
              record.emergencyContact = String(rawValue ?? '').trim()
              break
            case 'frenchName':
              record.frenchName = String(rawValue ?? '').trim()
              break
            case 'idNumber':
              record.idNumber = String(rawValue ?? '').trim()
              break
            case 'passportNumber':
              record.passportNumber = String(rawValue ?? '').trim()
              break
            case 'educationAndMajor':
              record.educationAndMajor = String(rawValue ?? '').trim()
              break
            case 'certifications':
              record.certifications = normalizeList(rawValue)
              break
            case 'domesticMobile':
              record.domesticMobile = String(rawValue ?? '').trim()
              break
            case 'emergencyContactName':
              record.emergencyContactName = String(rawValue ?? '').trim()
              break
            case 'emergencyContactPhone':
              record.emergencyContactPhone = String(rawValue ?? '').trim()
              break
            case 'redBookValidYears':
              record.redBookValidYears = normalizeNumber(rawValue)
              break
            case 'cumulativeAbroadYears':
              record.cumulativeAbroadYears = normalizeNumber(rawValue)
              break
            case 'birthplace':
              record.birthplace = String(rawValue ?? '').trim()
              break
            case 'residenceInChina':
              record.residenceInChina = String(rawValue ?? '').trim()
              break
            case 'medicalHistory':
              record.medicalHistory = String(rawValue ?? '').trim()
              break
            case 'healthStatus':
              record.healthStatus = String(rawValue ?? '').trim()
              break
            default:
              break
          }
        })

        let hasRowError = false
        if (!record.name) {
          errors.push({ row: rowNumber, code: 'missing_name' })
          hasRowError = true
        }
        const normalizedUsername = record.username ? record.username.trim().toLowerCase() : ''
        record.username = normalizedUsername || undefined
        if (normalizedUsername) {
          if (seenUsernames.has(normalizedUsername)) {
            errors.push({ row: rowNumber, code: 'duplicate_username' })
            hasRowError = true
          } else {
            seenUsernames.add(normalizedUsername)
          }
        }
        if (record.gender && !['男', '女'].includes(record.gender)) {
          errors.push({ row: rowNumber, code: 'invalid_gender', value: record.gender })
          hasRowError = true
        }
        const invalidPhone = record.phones.find((phone) => !PHONE_PATTERN.test(phone))
        if (invalidPhone) {
          errors.push({ row: rowNumber, code: 'invalid_phone', value: invalidPhone })
          hasRowError = true
        }
        if (record.employmentStatus && !['ACTIVE', 'ON_LEAVE', 'TERMINATED'].includes(record.employmentStatus)) {
          errors.push({ row: rowNumber, code: 'invalid_status', value: record.employmentStatus })
          hasRowError = true
        }
        if (hasJoinDateValue && !record.joinDate) {
          errors.push({ row: rowNumber, code: 'invalid_join_date' })
          hasRowError = true
        }
        if (hasBirthDateValue && !record.birthDate) {
          errors.push({ row: rowNumber, code: 'invalid_birth_date' })
          hasRowError = true
        }
        if (hasTerminationDateValue && !record.terminationDate) {
          errors.push({ row: rowNumber, code: 'invalid_termination_date' })
          hasRowError = true
        }
        if (!record.birthDate && !hasBirthDateValue && record.nationality === 'china') {
          const derivedBirthDate = parseBirthDateFromIdNumber(record.idNumber ?? '')
          if (derivedBirthDate) {
            record.birthDate = derivedBirthDate
          }
        }
        if (!record.birthDate && !hasBirthDateValue) {
          errors.push({ row: rowNumber, code: 'missing_birth_date' })
          hasRowError = true
        }
        if (record.employmentStatus === 'TERMINATED') {
          if (!record.terminationDate) {
            errors.push({ row: rowNumber, code: 'missing_termination_date' })
            hasRowError = true
          }
          if (!record.terminationReason) {
            errors.push({ row: rowNumber, code: 'missing_termination_reason' })
            hasRowError = true
          }
        }
        if (!hasRowError) {
          prepared.push(record)
        }
      })

      if (errors.length > 0) {
        setActionError(errors.map(formatImportError).join('\n'))
        if (prepared.length === 0) {
          return
        }
        const errorRowsCount = new Set(errors.map((item) => item.row)).size
        const shouldContinue = window.confirm(
          t.feedback.importSkipConfirm(prepared.length, errorRowsCount),
        )
        if (!shouldContinue) {
          return
        }
      }
      if (prepared.length === 0) {
        throw new Error(t.errors.importNoData)
      }
      const res = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: prepared, ignoreErrors: errors.length > 0 }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        imported?: number
        error?: string
        errors?: ImportError[]
      }
      if (!res.ok) {
        if (payload.errors?.length) {
          setActionError(payload.errors.map(formatImportError).join('\n'))
          return
        }
        throw new Error(payload.error ?? t.errors.importFailed)
      }
      const combinedErrors = [...errors, ...(payload.errors ?? [])]
      if (combinedErrors.length > 0) {
        setActionError(combinedErrors.map(formatImportError).join('\n'))
        setActionNotice(
          t.feedback.importPartialSuccess(
            payload.imported ?? prepared.length,
            new Set(combinedErrors.map((item) => item.row)).size,
          ),
        )
      } else {
        setActionNotice(t.feedback.importSuccess(payload.imported ?? prepared.length))
      }
      await loadData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.importFailed)
    } finally {
      setImporting(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (field === 'roles' && !canAssignRole) return
    setSortStack((prev) => {
      const existing = prev.find((item) => item.field === field)
      const nextOrder: SortOrder = existing ? (existing.order === 'asc' ? 'desc' : 'asc') : 'desc'
      const filtered = prev.filter((item) => item.field !== field)
      return [{ field, order: nextOrder }, ...filtered].slice(0, 4)
    })
  }

  const clearSort = () => {
    setSortStack(defaultSortStack)
  }

  const sortIndicator = (field: SortField) => {
    const idx = sortStack.findIndex((item) => item.field === field)
    if (idx === -1) return ''
    const arrow = sortStack[idx].order === 'asc' ? '↑' : '↓'
    return `${arrow}${idx + 1}`
  }

  const resolveRoleName = useCallback(
    (role: { id: number; name: string }) => {
      const match = rolesData.find((item) => item.id === role.id || item.name === role.name)
      return match?.name ?? role.name
    },
    [rolesData],
  )
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
      if (!matchesValueFilter(expatProfile?.team, teamFilters)) return false
      if (!matchesValueFilter(expatProfile?.contractNumber, contractNumberFilters)) return false
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
          case 'team':
            result = compareNullable(
              getTextValue(leftExpatProfile?.team),
              getTextValue(rightExpatProfile?.team),
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
          case 'salaryCategory':
            result = compareNullable(
              getTextValue(leftExpatProfile?.salaryCategory),
              getTextValue(rightExpatProfile?.salaryCategory),
              (a, b) => collator.compare(a, b),
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
    canAssignRole,
  ])
  const totalMembers = filteredMembers.length
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalMembers / Math.max(pageSize, 1))),
    [totalMembers, pageSize],
  )
  const paginatedMembers = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredMembers.slice(startIndex, startIndex + pageSize)
  }, [filteredMembers, page, pageSize])

useEffect(() => {
  setPageInput(String(page))
}, [page, setPageInput])

useEffect(() => {
  setPage((prev) => Math.min(totalPages, Math.max(1, prev)))
}, [totalPages, setPage])

  useEffect(() => {
    setPage(1)
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
    setPage,
  ])

  const handleExportMembers = async () => {
    if (!canViewMembers) {
      setActionError(t.access.needMemberView)
      return
    }
    if (exporting) return
    const selectedColumns = exportableColumnOrder.filter(
      (key) => visibleColumns.includes(key) && (key !== 'roles' || canAssignRole),
    )
    if (selectedColumns.length === 0) {
      setActionError(t.errors.exportMissingColumns)
      return
    }
    if (filteredMembers.length === 0) {
      setActionError(t.errors.exportNoData)
      return
    }
    setExporting(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const headerRow = selectedColumns.map((key) => columnLabels[key])
      const dataRows = filteredMembers.map((member, index) =>
        selectedColumns.map((key) => {
          const chineseProfile = member.nationality === 'china' ? member.chineseProfile : null
          const expatProfile = member.nationality === 'china' ? null : member.expatProfile
          switch (key) {
            case 'sequence':
              return index + 1
            case 'name':
              return member.name?.length ? member.name : t.labels.empty
            case 'username':
              return member.username
            case 'gender':
              return findGenderLabel(member.gender)
            case 'nationality':
              return findNationalityLabel(member.nationality)
            case 'phones':
              return member.phones?.length ? member.phones.join(' / ') : t.labels.empty
            case 'joinDate':
              return member.joinDate ? new Date(member.joinDate).toLocaleDateString(locale) : t.labels.empty
            case 'birthDate':
              return member.birthDate ? new Date(member.birthDate).toLocaleDateString(locale) : t.labels.empty
            case 'position':
              return member.position || t.labels.empty
            case 'employmentStatus':
              return statusLabels[member.employmentStatus] ?? member.employmentStatus
            case 'terminationDate':
              return member.terminationDate
                ? new Date(member.terminationDate).toLocaleDateString(locale)
                : t.labels.empty
            case 'terminationReason':
              return member.terminationReason?.length ? member.terminationReason : t.labels.empty
            case 'roles':
              return member.roles.length
                ? member.roles.map(resolveRoleName).filter(Boolean).join(' / ')
                : t.labels.empty
            case 'team':
              return formatProfileText(expatProfile?.team)
            case 'contractNumber':
              return formatProfileText(expatProfile?.contractNumber)
            case 'contractType':
              return formatProfileText(expatProfile?.contractType)
            case 'salaryCategory':
              return formatProfileText(expatProfile?.salaryCategory)
            case 'baseSalary':
              return formatSalary(expatProfile?.baseSalaryAmount, expatProfile?.baseSalaryUnit)
            case 'netMonthly':
              return formatSalary(expatProfile?.netMonthlyAmount, expatProfile?.netMonthlyUnit, 'MONTH')
            case 'maritalStatus':
              return formatProfileText(expatProfile?.maritalStatus)
            case 'childrenCount':
              return formatProfileNumber(expatProfile?.childrenCount ?? null)
            case 'cnpsNumber':
              return formatProfileText(expatProfile?.cnpsNumber)
            case 'cnpsDeclarationCode':
              return formatProfileText(expatProfile?.cnpsDeclarationCode)
            case 'provenance':
              return formatProfileText(expatProfile?.provenance)
            case 'frenchName':
              return formatProfileText(chineseProfile?.frenchName)
            case 'idNumber':
              return formatProfileText(chineseProfile?.idNumber)
            case 'passportNumber':
              return formatProfileText(chineseProfile?.passportNumber)
            case 'educationAndMajor':
              return formatProfileText(chineseProfile?.educationAndMajor)
            case 'certifications':
              return formatProfileList(chineseProfile?.certifications)
            case 'domesticMobile':
              return formatProfileText(chineseProfile?.domesticMobile)
            case 'emergencyContactName':
              return formatProfileText(
                chineseProfile?.emergencyContactName ?? expatProfile?.emergencyContactName,
              )
            case 'emergencyContactPhone':
              return formatProfileText(
                chineseProfile?.emergencyContactPhone ?? expatProfile?.emergencyContactPhone,
              )
            case 'redBookValidYears':
              return formatProfileNumber(chineseProfile?.redBookValidYears)
            case 'cumulativeAbroadYears':
              return formatProfileNumber(chineseProfile?.cumulativeAbroadYears)
            case 'birthplace':
              return formatProfileText(chineseProfile?.birthplace)
            case 'residenceInChina':
              return formatProfileText(chineseProfile?.residenceInChina)
            case 'medicalHistory':
              return formatProfileText(chineseProfile?.medicalHistory)
            case 'healthStatus':
              return formatProfileText(chineseProfile?.healthStatus)
            case 'createdAt':
              return new Date(member.createdAt).toLocaleString(locale)
            case 'updatedAt':
              return new Date(member.updatedAt).toLocaleString(locale)
            default:
              return ''
          }
        }),
      )
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t.tabs.members)
      const filename = `members-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (templateDownloading) return
    setTemplateDownloading(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const headerRow = templateColumns.map((key) => templateColumnLabels[key])
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow])
      const instructionsRows = [
        [t.template.columnsHeader, t.template.notesHeader],
        ...templateColumns.map((key) => [templateColumnLabels[key], t.template.notes[key]]),
      ]
      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t.tabs.members)
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, t.template.instructionsSheet)
      const filename = `members-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.templateDownloadFailed)
    } finally {
      setTemplateDownloading(false)
    }
  }

  const permissionRolesMap = useMemo(() => {
    const map = new Map<number, string[]>()
    rolesData.forEach((role) => {
      role.permissions.forEach((perm) => {
        const bucket = map.get(perm.id) ?? []
        bucket.push(role.name)
        map.set(perm.id, bucket)
      })
    })
    return map
  }, [rolesData])

  const permissions = useMemo(
    () =>
      permissionsData.map((permission) => ({
        ...permission,
        roles: permissionRolesMap.get(permission.id) ?? [],
      })),
    [permissionsData, permissionRolesMap],
  )

  const headcount = membersData.length
  const activeCount = membersData.filter((member) => member.employmentStatus === 'ACTIVE').length
  const roleCount = rolesData.length
  const permissionCoverage = permissions.length
  const headerStats = [
    { label: t.stats.headcount, value: headcount, accent: 'from-sky-400 to-cyan-300' },
    {
      label: t.stats.active,
      value: activeCount,
      accent: 'from-emerald-400 to-lime-300',
      helper: headcount ? `${Math.round((activeCount / headcount) * 100)}%` : undefined,
    },
    { label: t.stats.roles, value: roleCount, accent: 'from-indigo-400 to-blue-300', helper: 'RBAC' },
    {
      label: t.stats.coverage,
      value: permissionCoverage,
      accent: 'from-amber-400 to-orange-300',
      helper: t.helpers.permissionCoverage,
    },
  ]
  const permissionGroups = useMemo(() => {
    const grouped = new Map<string, typeof permissions>()
    permissions.forEach((permission) => {
      const prefix = permission.code.includes(':') ? permission.code.split(':')[0] : 'other'
      const bucket = grouped.get(prefix) ?? []
      bucket.push(permission)
      grouped.set(prefix, bucket)
    })
    return Array.from(grouped.entries()).map(([key, items]) => ({ key, items }))
  }, [permissions])

  const isChineseForm = formState.nationality === 'china'

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['member:view']}
        hint={t.access.hint}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <MembersHeader
        title={t.title}
        subtitle={t.subtitle}
        breadcrumbHome={breadcrumbHome}
        breadcrumbMembers={breadcrumbMembers}
        locale={locale}
        onLocaleChange={setLocale}
        stats={headerStats}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-14 pt-6 sm:px-8 sm:pt-10 xl:max-w-[1500px] xl:gap-10 xl:px-12 xl:pt-12 2xl:max-w-[1700px] 2xl:gap-12 2xl:px-14 min-w-0">
          <div className="min-w-0 w-full rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{t.tabs[activeTab]}</h2>
                <p className="text-sm text-slate-500">{t.tabDescriptions[activeTab]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['members', 'roles', 'permissions'] as TabKey[]).map((tab) => (
                  <TabButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                    {t.tabs[tab]}
                  </TabButton>
                ))}
              </div>
            </div>

            {activeTab === 'members' ? (
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
                      onClick={openCreateModal}
                      disabled={!canCreateMember}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t.actions.create}
                    </button>
                    <ActionButton onClick={handleImportClick} disabled={!canCreateMember || importing}>
                      {t.actions.import}
                    </ActionButton>
                    <ActionButton onClick={handleExportMembers} disabled={!canViewMembers || exporting}>
                      {t.actions.export}
                    </ActionButton>
                    <ActionButton onClick={handleDownloadTemplate} disabled={templateDownloading}>
                      {t.actions.template}
                    </ActionButton>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                    <div className="relative" ref={columnSelectorRef}>
                      <button
                        type="button"
                        onClick={() => setShowColumnSelector((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t.columnSelector.label}
                        <span aria-hidden>⌵</span>
                      </button>
                      {showColumnSelector ? (
                        <div className="absolute right-0 z-10 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-slate-900/10">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <button type="button" className="hover:text-slate-800" onClick={selectAllColumns}>
                              {t.columnSelector.selectAll}
                            </button>
                            <button type="button" className="hover:text-slate-800" onClick={restoreDefaultColumns}>
                              {t.columnSelector.restore}
                            </button>
                            <button type="button" className="text-rose-600 hover:text-rose-700" onClick={clearColumns}>
                              {t.columnSelector.clear}
                            </button>
                          </div>
                          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                            {columnOptions.map((option) => (
                              <label key={option.key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns.includes(option.key)}
                                  onChange={() => toggleColumn(option.key)}
                                  className="accent-emerald-500"
                                />
                                <span className="truncate">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <ActionButton onClick={clearSort} disabled={isSortDefault}>
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
                          <ActionButton onClick={clearFilters} disabled={!hasActiveFilters}>
                            {t.filters.reset}
                          </ActionButton>
                          <ActionButton onClick={() => setShowFilterDrawer(true)}>
                            {t.filters.expand}
                          </ActionButton>
                        </div>
                      </div>
                      <MemberFilterDrawer
                        open={showFilterDrawer}
                        onClose={() => setShowFilterDrawer(false)}
                        onClearAll={clearFilters}
                        title={t.filters.title}
                        clearLabel={t.filters.clear}
                        closeLabel={t.labels.close}
                        clearHint={t.filters.selected(hasActiveFilters ? activeFilterCount : 0)}
                      >
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
                      {filteredMembers.length === 0 && !loading ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                          {t.feedback.empty}
                        </div>
                      ) : (
                        <>
                          <table className="w-full table-auto text-left text-base text-slate-900">
                            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-600">
                              <tr>
                                {isVisible('sequence') ? (
                                  <th className="px-3 py-3 text-center whitespace-nowrap">{t.table.sequence}</th>
                                ) : null}
                                {isVisible('name') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('name')}
                                  >
                                    {t.table.name} {sortIndicator('name')}
                                  </th>
                                ) : null}
                                {isVisible('username') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('username')}
                                  >
                                    {t.table.username} {sortIndicator('username')}
                                  </th>
                                ) : null}
                                {isVisible('gender') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('gender')}
                                  >
                                    {t.table.gender} {sortIndicator('gender')}
                                  </th>
                                ) : null}
                                {isVisible('nationality') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('nationality')}
                                  >
                                    {t.table.nationality} {sortIndicator('nationality')}
                                  </th>
                                ) : null}
                                {isVisible('phones') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('phones')}
                                  >
                                    {t.table.phones} {sortIndicator('phones')}
                                  </th>
                                ) : null}
                                {isVisible('joinDate') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('joinDate')}
                                  >
                                    {t.table.joinDate} {sortIndicator('joinDate')}
                                  </th>
                                ) : null}
                                {isVisible('birthDate') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('birthDate')}
                                  >
                                    {t.table.birthDate} {sortIndicator('birthDate')}
                                  </th>
                                ) : null}
                                {isVisible('position') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('position')}
                                  >
                                    {t.table.position} {sortIndicator('position')}
                                  </th>
                                ) : null}
                                {isVisible('employmentStatus') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('employmentStatus')}
                                  >
                                    {t.table.employmentStatus} {sortIndicator('employmentStatus')}
                                  </th>
                                ) : null}
                                {isVisible('terminationDate') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('terminationDate')}
                                  >
                                    {t.table.terminationDate} {sortIndicator('terminationDate')}
                                  </th>
                                ) : null}
                                {isVisible('terminationReason') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('terminationReason')}
                                  >
                                    {t.table.terminationReason} {sortIndicator('terminationReason')}
                                  </th>
                                ) : null}
                                {isVisible('roles') ? (
                                  <th
                                    className="min-w-[150px] px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('roles')}
                                  >
                                    {t.table.roles} {sortIndicator('roles')}
                                  </th>
                                ) : null}
                                {isVisible('team') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('team')}
                                  >
                                    {t.table.team} {sortIndicator('team')}
                                  </th>
                                ) : null}
                                {isVisible('contractNumber') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('contractNumber')}
                                  >
                                    {t.table.contractNumber} {sortIndicator('contractNumber')}
                                  </th>
                                ) : null}
                                {isVisible('contractType') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('contractType')}
                                  >
                                    {t.table.contractType} {sortIndicator('contractType')}
                                  </th>
                                ) : null}
                                {isVisible('salaryCategory') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('salaryCategory')}
                                  >
                                    {t.table.salaryCategory} {sortIndicator('salaryCategory')}
                                  </th>
                                ) : null}
                                {isVisible('baseSalary') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('baseSalary')}
                                  >
                                    {t.table.baseSalary} {sortIndicator('baseSalary')}
                                  </th>
                                ) : null}
                                {isVisible('netMonthly') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('netMonthly')}
                                  >
                                    {t.table.netMonthly} {sortIndicator('netMonthly')}
                                  </th>
                                ) : null}
                                {isVisible('maritalStatus') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('maritalStatus')}
                                  >
                                    {t.table.maritalStatus} {sortIndicator('maritalStatus')}
                                  </th>
                                ) : null}
                                {isVisible('childrenCount') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('childrenCount')}
                                  >
                                    {t.table.childrenCount} {sortIndicator('childrenCount')}
                                  </th>
                                ) : null}
                                {isVisible('cnpsNumber') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('cnpsNumber')}
                                  >
                                    {t.table.cnpsNumber} {sortIndicator('cnpsNumber')}
                                  </th>
                                ) : null}
                                {isVisible('cnpsDeclarationCode') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('cnpsDeclarationCode')}
                                  >
                                    {t.table.cnpsDeclarationCode} {sortIndicator('cnpsDeclarationCode')}
                                  </th>
                                ) : null}
                                {isVisible('provenance') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('provenance')}
                                  >
                                    {t.table.provenance} {sortIndicator('provenance')}
                                  </th>
                                ) : null}
                                {isVisible('frenchName') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('frenchName')}
                                  >
                                    {t.table.frenchName} {sortIndicator('frenchName')}
                                  </th>
                                ) : null}
                                {isVisible('idNumber') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('idNumber')}
                                  >
                                    {t.table.idNumber} {sortIndicator('idNumber')}
                                  </th>
                                ) : null}
                                {isVisible('passportNumber') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('passportNumber')}
                                  >
                                    {t.table.passportNumber} {sortIndicator('passportNumber')}
                                  </th>
                                ) : null}
                                {isVisible('educationAndMajor') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('educationAndMajor')}
                                  >
                                    {t.table.educationAndMajor} {sortIndicator('educationAndMajor')}
                                  </th>
                                ) : null}
                                {isVisible('certifications') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('certifications')}
                                  >
                                    {t.table.certifications} {sortIndicator('certifications')}
                                  </th>
                                ) : null}
                                {isVisible('domesticMobile') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('domesticMobile')}
                                  >
                                    {t.table.domesticMobile} {sortIndicator('domesticMobile')}
                                  </th>
                                ) : null}
                                {isVisible('emergencyContactName') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('emergencyContactName')}
                                  >
                                    {t.table.emergencyContactName} {sortIndicator('emergencyContactName')}
                                  </th>
                                ) : null}
                                {isVisible('emergencyContactPhone') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('emergencyContactPhone')}
                                  >
                                    {t.table.emergencyContactPhone} {sortIndicator('emergencyContactPhone')}
                                  </th>
                                ) : null}
                                {isVisible('redBookValidYears') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('redBookValidYears')}
                                  >
                                    {t.table.redBookValidYears} {sortIndicator('redBookValidYears')}
                                  </th>
                                ) : null}
                                {isVisible('cumulativeAbroadYears') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('cumulativeAbroadYears')}
                                  >
                                    {t.table.cumulativeAbroadYears} {sortIndicator('cumulativeAbroadYears')}
                                  </th>
                                ) : null}
                                {isVisible('birthplace') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('birthplace')}
                                  >
                                    {t.table.birthplace} {sortIndicator('birthplace')}
                                  </th>
                                ) : null}
                                {isVisible('residenceInChina') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('residenceInChina')}
                                  >
                                    {t.table.residenceInChina} {sortIndicator('residenceInChina')}
                                  </th>
                                ) : null}
                                {isVisible('medicalHistory') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('medicalHistory')}
                                  >
                                    {t.table.medicalHistory} {sortIndicator('medicalHistory')}
                                  </th>
                                ) : null}
                                {isVisible('healthStatus') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('healthStatus')}
                                  >
                                    {t.table.healthStatus} {sortIndicator('healthStatus')}
                                  </th>
                                ) : null}
                                {isVisible('createdAt') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('createdAt')}
                                  >
                                    {t.table.createdAt} {sortIndicator('createdAt')}
                                  </th>
                                ) : null}
                                {isVisible('updatedAt') ? (
                                  <th
                                    className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('updatedAt')}
                                  >
                                    {t.table.updatedAt} {sortIndicator('updatedAt')}
                                  </th>
                                ) : null}
                                {isVisible('actions') ? (
                                  <th className="px-3 py-3 whitespace-nowrap">{t.table.actions}</th>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 align-middle">
                              {paginatedMembers.map((member, index) => {
                                const displayIndex = (page - 1) * pageSize + index + 1
                                const chineseProfile =
                                  member.nationality === 'china' ? member.chineseProfile : null
                                const expatProfile =
                                  member.nationality === 'china' ? null : member.expatProfile
                                return (
                                  <tr key={member.id} className="hover:bg-slate-50 align-middle">
                                    {isVisible('sequence') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700 align-middle">
                                        {displayIndex}
                                      </td>
                                    ) : null}
                                    {isVisible('name') ? (
                                      <td className="px-4 py-3 align-middle">
                                        <p className="max-w-[10rem] text-sm font-semibold text-slate-900 break-words leading-snug">
                                          {member.name?.length ? member.name : t.labels.empty}
                                        </p>
                                      </td>
                                    ) : null}
                                    {isVisible('username') ? (
                                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                                        <p className="font-semibold text-slate-900">{member.username}</p>
                                      </td>
                                    ) : null}
                                    {isVisible('gender') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 min-w-[80px] align-middle">
                                        {findGenderLabel(member.gender)}
                                      </td>
                                    ) : null}
                                    {isVisible('nationality') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {findNationalityLabel(member.nationality)}
                                      </td>
                                    ) : null}
                                    {isVisible('phones') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {member.phones?.length ? (
                                          <div className="space-y-1">
                                            {member.phones.map((phone, idx) => (
                                              <div key={`${member.id}-phone-${idx}`} className="whitespace-nowrap">
                                                {phone}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          t.labels.empty
                                        )}
                                      </td>
                                    ) : null}
                                    {isVisible('joinDate') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {member.joinDate
                                          ? new Date(member.joinDate).toLocaleDateString(locale)
                                          : t.labels.empty}
                                      </td>
                                    ) : null}
                                    {isVisible('birthDate') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {member.birthDate
                                          ? new Date(member.birthDate).toLocaleDateString(locale)
                                          : t.labels.empty}
                                      </td>
                                    ) : null}
                                    {isVisible('position') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {member.position || t.labels.empty}
                                      </td>
                                    ) : null}
                                    {isVisible('employmentStatus') ? (
                                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200">
                                          {statusLabels[member.employmentStatus] ?? member.employmentStatus}
                                        </span>
                                      </td>
                                    ) : null}
                                    {isVisible('terminationDate') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {member.terminationDate
                                          ? new Date(member.terminationDate).toLocaleDateString(locale)
                                          : t.labels.empty}
                                      </td>
                                    ) : null}
                                    {isVisible('terminationReason') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {member.terminationReason?.length ? member.terminationReason : t.labels.empty}
                                      </td>
                                    ) : null}
                                    {isVisible('roles') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle min-w-[150px]">
                                        <div className="flex flex-col gap-1">
                                          {member.roles.map((roleKey) => {
                                            const role = rolesData.find(
                                              (item) => item.id === roleKey.id || item.name === roleKey.name,
                                            )
                                            return (
                                              <div
                                                key={`${member.id}-${roleKey.id ?? roleKey.name}`}
                                                className="inline-flex items-center justify-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100 whitespace-nowrap"
                                              >
                                                {role?.name ?? roleKey.name}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </td>
                                    ) : null}
                                    {isVisible('team') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.team)}
                                      </td>
                                    ) : null}
                                    {isVisible('contractNumber') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.contractNumber)}
                                      </td>
                                    ) : null}
                                    {isVisible('contractType') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.contractType)}
                                      </td>
                                    ) : null}
                                    {isVisible('salaryCategory') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.salaryCategory)}
                                      </td>
                                    ) : null}
                                    {isVisible('baseSalary') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatSalary(
                                          expatProfile?.baseSalaryAmount,
                                          expatProfile?.baseSalaryUnit,
                                        )}
                                      </td>
                                    ) : null}
                                    {isVisible('netMonthly') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatSalary(
                                          expatProfile?.netMonthlyAmount,
                                          expatProfile?.netMonthlyUnit,
                                          'MONTH',
                                        )}
                                      </td>
                                    ) : null}
                                    {isVisible('maritalStatus') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.maritalStatus)}
                                      </td>
                                    ) : null}
                                    {isVisible('childrenCount') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileNumber(expatProfile?.childrenCount ?? null)}
                                      </td>
                                    ) : null}
                                    {isVisible('cnpsNumber') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.cnpsNumber)}
                                      </td>
                                    ) : null}
                                    {isVisible('cnpsDeclarationCode') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.cnpsDeclarationCode)}
                                      </td>
                                    ) : null}
                                    {isVisible('provenance') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(expatProfile?.provenance)}
                                      </td>
                                    ) : null}
                                    {isVisible('frenchName') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.frenchName)}
                                      </td>
                                    ) : null}
                                    {isVisible('idNumber') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.idNumber)}
                                      </td>
                                    ) : null}
                                    {isVisible('passportNumber') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.passportNumber)}
                                      </td>
                                    ) : null}
                                    {isVisible('educationAndMajor') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.educationAndMajor)}
                                      </td>
                                    ) : null}
                                    {isVisible('certifications') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileList(chineseProfile?.certifications)}
                                      </td>
                                    ) : null}
                                    {isVisible('domesticMobile') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.domesticMobile)}
                                      </td>
                                    ) : null}
                                    {isVisible('emergencyContactName') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(
                                          chineseProfile?.emergencyContactName ??
                                            expatProfile?.emergencyContactName,
                                        )}
                                      </td>
                                    ) : null}
                                    {isVisible('emergencyContactPhone') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(
                                          chineseProfile?.emergencyContactPhone ??
                                            expatProfile?.emergencyContactPhone,
                                        )}
                                      </td>
                                    ) : null}
                                    {isVisible('redBookValidYears') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileNumber(chineseProfile?.redBookValidYears)}
                                      </td>
                                    ) : null}
                                    {isVisible('cumulativeAbroadYears') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileNumber(chineseProfile?.cumulativeAbroadYears)}
                                      </td>
                                    ) : null}
                                    {isVisible('birthplace') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.birthplace)}
                                      </td>
                                    ) : null}
                                    {isVisible('residenceInChina') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.residenceInChina)}
                                      </td>
                                    ) : null}
                                    {isVisible('medicalHistory') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.medicalHistory)}
                                      </td>
                                    ) : null}
                                    {isVisible('healthStatus') ? (
                                      <td className="px-4 py-3 text-slate-700 align-middle">
                                        {formatProfileText(chineseProfile?.healthStatus)}
                                      </td>
                                    ) : null}
                                    {isVisible('createdAt') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {new Date(member.createdAt).toLocaleString(locale)}
                                      </td>
                                    ) : null}
                                    {isVisible('updatedAt') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        {new Date(member.updatedAt).toLocaleString(locale)}
                                      </td>
                                    ) : null}
                                    {isVisible('actions') ? (
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                                        <div className="flex flex-nowrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedMember(member)}
                                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                          >
                                            {t.actions.view}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openEditPage(member)}
                                            disabled={!canUpdateMember}
                                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {t.actions.edit}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(member)}
                                            className="rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={!canDeleteMember || submitting}
                                          >
                                            {t.actions.delete}
                                          </button>
                                        </div>
                                      </td>
                                    ) : null}
                                  </tr>
                                )
                              })}
                            </tbody>
                        </table>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
                          <span>{t.pagination.summary(totalMembers, page, totalPages)}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="text-slate-400">{t.pagination.pageSizeLabel}</span>
                              <select
                                value={pageSize}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isFinite(value)) return
                                  setPageSize(value)
                                  setPage(1)
                                }}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
                                aria-label={t.pagination.pageSizeLabel}
                              >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                              disabled={page <= 1}
                              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            >
                              {t.pagination.prev}
                            </button>
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={pageInput}
                                onChange={(event) => setPageInput(event.target.value)}
                                onBlur={() => {
                                  const value = Number(pageInput)
                                  if (!Number.isFinite(value)) {
                                    setPageInput(String(page))
                                    return
                                  }
                                  const next = Math.min(totalPages, Math.max(1, Math.round(value)))
                                  if (next !== page) setPage(next)
                                  setPageInput(String(next))
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    const value = Number(pageInput)
                                    const next = Number.isFinite(value)
                                      ? Math.min(totalPages, Math.max(1, Math.round(value)))
                                      : page
                                    if (next !== page) setPage(next)
                                    setPageInput(String(next))
                                  }
                                }}
                                className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
                                aria-label={t.pagination.goTo}
                              />
                              <span className="text-slate-400">/ {totalPages}</span>
                            </div>
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                              disabled={page >= totalPages}
                              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            >
                              {t.pagination.next}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  </>
                )}
              </>
            ) : null}

            {activeTab === 'roles' ? (
              <div className="space-y-4 p-6">
                {!canViewRole ? (
                  <div className="text-sm text-rose-600">
                    {t.access.needRoleView}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t.rolePanel.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.rolePanel.countPrefix} · {rolesData.length} {t.rolePanel.countUnit}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={openCreateRoleModal}
                          disabled={!canCreateRole}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t.actions.createRole}
                        </button>
                        <ActionButton>{t.actions.import}</ActionButton>
                        <ActionButton>{t.actions.export}</ActionButton>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {rolesData.map((role) => (
                        <div
                          key={role.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-inner"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                              <p className="text-xs text-slate-600">
                                {t.rolePanel.permissions}：{role.permissions.length}
                              </p>
                            </div>
                            {canUpdateRole || canDeleteRole ? (
                              <div className="flex items-center gap-2">
                                {canUpdateRole ? (
                                  <button
                                    type="button"
                                    className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                    onClick={() => {
                                    setEditingRoleId(role.id)
                                    setRoleFormState({
                                      name: role.name,
                                      permissionIds: role.permissions
                                        .filter((permission) => permission.status !== 'ARCHIVED')
                                        .map((permission) => permission.id),
                                    })
                                      setRoleError(null)
                                      setShowRoleModal(true)
                                    }}
                                  >
                                    {t.actions.edit}
                                  </button>
                                ) : null}
                                {canDeleteRole ? (
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                    onClick={() => handleDeleteRole(role.id)}
                                  >
                                    {t.actions.delete}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {role.permissions.map((permission) => (
                              <span
                                key={`${role.id}-${permission.code}`}
                                className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200"
                              >
                                {permission.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {activeTab === 'permissions' ? (
              <div className="space-y-4 p-6">
                {!canViewPermissions ? (
                  <div className="text-sm text-rose-600">
                    {t.access.needPermissionView}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                          {t.permissionPanel.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.helpers.permissionFormat}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
                        {permissions.length} items
                      </span>
                    </div>
                    {permissionError ? (
                      <div className="text-sm text-rose-600">{permissionError}</div>
                    ) : null}
                    <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm">
                      {permissionGroups.map((group) => (
                        <div key={group.key} className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                {group.key}
                              </span>
                              <span className="text-xs text-slate-500">
                                {group.items.length} {t.permissionPanel.title.toLowerCase()}
                              </span>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.items.map((permission) => (
                              <div
                                key={permission.code}
                                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-inner"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{permission.code}</p>
                                    <p className="text-xs text-slate-600">{permission.name}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2 text-[11px]">
                                    <span
                                      className={`rounded-full px-2 py-1 font-semibold uppercase ring-1 ${
                                        permission.status === 'ARCHIVED'
                                          ? 'bg-amber-100 text-amber-700 ring-amber-200'
                                          : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                                      }`}
                                    >
                                      {t.permissionPanel.status}: {t.permissionPanel.statusLabels[permission.status] ?? permission.status}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
                                      {t.permissionPanel.code}: {permission.code}
                                    </span>
                                    {canUpdatePermissions ? (
                                      editingPermissionId === permission.id ? (
                                        <div className="flex flex-col items-end gap-2">
                                          <select
                                            value={permissionStatusDraft}
                                            onChange={(event) =>
                                              setPermissionStatusDraft(event.target.value as PermissionStatus)
                                            }
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-sky-400 focus:outline-none"
                                          >
                                            {PERMISSION_STATUS_OPTIONS.map((status) => (
                                              <option key={status} value={status}>
                                                {t.permissionPanel.statusLabels[status]}
                                              </option>
                                            ))}
                                          </select>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={savePermissionStatus}
                                              disabled={permissionUpdatingId === permission.id}
                                              className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {t.actions.save}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditPermission}
                                              disabled={permissionUpdatingId === permission.id}
                                              className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {t.actions.cancel}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEditPermission(permission)}
                                          className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          {t.permissionPanel.edit}
                                        </button>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-700">
                                  <span className="rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
                                    {t.permissionPanel.roles}: {permission.roles.length}
                                  </span>
                                  {permission.roles.map((role) => (
                                    <span
                                      key={`${permission.code}-${role}`}
                                      className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-800 ring-1 ring-sky-200"
                                    >
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

          </div>
        </div>
      </section>

      {showRoleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {editingRoleId ? t.rolePanel.editTitle : t.rolePanel.title}
                </p>
                <p className="text-sm text-slate-500">{t.rolePanel.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                X
              </button>
            </div>

            <form className="mt-4 flex min-h-0 flex-1 flex-col" onSubmit={handleCreateRole}>
              <div className="space-y-4 overflow-y-auto pr-1">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.roleName}</span>
                  <input
                    value={roleFormState.name}
                    onChange={(event) =>
                      setRoleFormState((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={t.rolePanel.namePlaceholder}
                  />
                </label>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">{t.rolePanel.permissions}</p>
                  {permissionsData.length === 0 ? (
                    <p className="text-xs text-slate-500">{t.feedback.loading}</p>
                  ) : activePermissions.length === 0 ? (
                    <p className="text-xs text-slate-500">{t.filters.noOptions}</p>
                  ) : (
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                      {activePermissions.map((permission) => (
                        <label
                          key={permission.id}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                            roleFormState.permissionIds.includes(permission.id)
                              ? 'border-sky-300 bg-white text-sky-800 ring-1 ring-sky-100'
                              : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-sky-600"
                            checked={roleFormState.permissionIds.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <div className="flex flex-col">
                            <span>{permission.code}</span>
                            <span className="text-[10px] font-normal text-slate-500">{permission.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {roleError ? <p className="pt-3 text-sm text-rose-600">{roleError}</p> : null}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{modalTitle}</p>
                <p className="text-sm text-slate-500">{modalSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                X
              </button>
            </div>

            <form
              className="mt-4 grid gap-4"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.name}</span>
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={t.form.namePlaceholder}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.username}</span>
                  <input
                    value={formState.username}
                    onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder="chen.rong"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.password}</span>
                  <input
                    type="password"
                    value={formState.password}
                    onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={t.form.passwordPlaceholder}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.gender}</span>
                  <select
                    value={formState.gender}
                    onChange={(event) => setFormState((prev) => ({ ...prev, gender: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[locale]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.nationality}</span>
                  <select
                    value={formState.nationality}
                    onChange={(event) => setFormState((prev) => ({ ...prev, nationality: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">{t.form.nationalityPlaceholder}</option>
                    {Array.from(nationalityByRegion.entries()).map(([region, options]) => (
                      <optgroup key={region} label={nationalityRegionLabels[locale][region as NationalityRegion]}>
                        {options.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label[locale]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.position}</span>
                  <input
                    list="position-options"
                    value={formState.position}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        position: event.target.value,
                      }))
                    }
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={t.form.positionPlaceholder}
                  />
                  <datalist id="position-options">
                    {positionOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
                <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
                  <span className="block font-semibold">{t.form.phones}</span>
                  <div className="relative" ref={phonePickerRef}>
                    <button
                      type="button"
                      disabled={formMode === 'view'}
                      onClick={() => setShowPhonePicker((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>
                        {formState.phones.length ? t.form.phoneSaved(formState.phones.length) : t.form.phonePlaceholder}
                      </span>
                      <span className="text-xs text-slate-500" aria-hidden>
                        ⌵
                      </span>
                    </button>
                    {showPhonePicker && formMode !== 'view' ? (
                      <div className="absolute z-20 mt-2 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl shadow-slate-900/10">
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            list="phone-options"
                            value={phoneInput}
                            onChange={(event) => setPhoneInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ',') {
                                event.preventDefault()
                                addPhoneFromInput()
                              }
                            }}
                            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                            placeholder={t.form.phonePlaceholder}
                          />
                          <datalist id="phone-options">
                            {formState.phones.map((phone) => (
                              <option key={phone} value={phone} />
                            ))}
                          </datalist>
                          <button
                            type="button"
                            onClick={addPhoneFromInput}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t.form.addPhone}
                          </button>
                        </div>
                        <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
                          {formState.phones.length === 0 ? (
                            <p className="text-xs text-slate-500">{t.labels.empty}</p>
                          ) : (
                            formState.phones.map((phone, index) => (
                              <div
                                key={`phone-${index}-${phone}`}
                                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200"
                              >
                                <span className="truncate">{phone}</span>
                                <button
                                  type="button"
                                  onClick={() => removePhone(index)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                >
                                  {t.actions.delete}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.joinDate}</span>
                  <input
                    type="date"
                    value={formState.joinDate}
                    onChange={(event) => setFormState((prev) => ({ ...prev, joinDate: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.birthDate}</span>
                  <input
                    type="date"
                    value={formState.birthDate}
                    onChange={(event) => setFormState((prev) => ({ ...prev, birthDate: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.status}</span>
                  <select
                    value={formState.employmentStatus}
                    onChange={(event) =>
                      setFormState((prev) => {
                        const nextStatus = event.target.value as EmploymentStatus
                        return {
                          ...prev,
                          employmentStatus: nextStatus,
                          ...(nextStatus === 'TERMINATED'
                            ? {}
                            : { terminationDate: '', terminationReason: '' }),
                        }
                      })
                    }
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    {(['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as EmploymentStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {formState.employmentStatus === 'TERMINATED' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.terminationDate}</span>
                    <input
                      type="date"
                      value={formState.terminationDate}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, terminationDate: event.target.value }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.terminationReason}</span>
                    <textarea
                      rows={2}
                      value={formState.terminationReason}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, terminationReason: event.target.value }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => setProfileExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t.form.profileSection}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isChineseForm ? t.form.profileChinaHint : t.form.profileExpatHint}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {profileExpanded ? t.form.collapse : t.form.expand}
                  </span>
                </button>
                {profileExpanded ? (
                  isChineseForm ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.frenchName}</span>
                        <input
                          value={formState.chineseProfile.frenchName}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, frenchName: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.idNumber}</span>
                        <input
                          value={formState.chineseProfile.idNumber}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              birthDate:
                                prev.birthDate || prev.nationality !== 'china'
                                  ? prev.birthDate
                                  : parseBirthDateFromIdNumber(event.target.value) || prev.birthDate,
                              chineseProfile: { ...prev.chineseProfile, idNumber: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.passportNumber}</span>
                        <input
                          value={formState.chineseProfile.passportNumber}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, passportNumber: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.educationAndMajor}</span>
                        <input
                          value={formState.chineseProfile.educationAndMajor}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, educationAndMajor: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                        <span className="block font-semibold">{t.form.certifications}</span>
                        <textarea
                          rows={2}
                          value={formState.chineseProfile.certifications.join('\n')}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: {
                                ...prev.chineseProfile,
                                certifications: event.target.value
                                  .split(/[\/,，;\n]+/)
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                          placeholder={t.form.certificationsPlaceholder}
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.domesticMobile}</span>
                        <input
                          value={formState.chineseProfile.domesticMobile}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, domesticMobile: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.emergencyContactName}</span>
                        <input
                          value={formState.chineseProfile.emergencyContactName}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, emergencyContactName: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.emergencyContactPhone}</span>
                        <input
                          value={formState.chineseProfile.emergencyContactPhone}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, emergencyContactPhone: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.redBookValidYears}</span>
                        <input
                          type="number"
                          min={0}
                          value={formState.chineseProfile.redBookValidYears}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, redBookValidYears: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.cumulativeAbroadYears}</span>
                        <input
                          type="number"
                          min={0}
                          value={formState.chineseProfile.cumulativeAbroadYears}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: {
                                ...prev.chineseProfile,
                                cumulativeAbroadYears: event.target.value,
                              },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.birthplace}</span>
                        <input
                          value={formState.chineseProfile.birthplace}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, birthplace: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.residenceInChina}</span>
                        <input
                          value={formState.chineseProfile.residenceInChina}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, residenceInChina: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                        <span className="block font-semibold">{t.form.medicalHistory}</span>
                        <textarea
                          rows={2}
                          value={formState.chineseProfile.medicalHistory}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, medicalHistory: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                        <span className="block font-semibold">{t.form.healthStatus}</span>
                        <textarea
                          rows={2}
                          value={formState.chineseProfile.healthStatus}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              chineseProfile: { ...prev.chineseProfile, healthStatus: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.team}</span>
                        <input
                          list="team-options"
                          value={formState.expatProfile.team}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, team: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                        <datalist id="team-options">
                          {teamOptions.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.contractNumber}</span>
                        <input
                          value={formState.expatProfile.contractNumber}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, contractNumber: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.contractType}</span>
                        <select
                          value={formState.expatProfile.contractType}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextType = event.target.value as ExpatProfileForm['contractType']
                              const nextUnit =
                                nextType === 'CDD' && prev.expatProfile.baseSalaryUnit === 'HOUR'
                                  ? 'MONTH'
                                  : prev.expatProfile.baseSalaryUnit
                              return {
                                ...prev,
                                expatProfile: {
                                  ...prev.expatProfile,
                                  contractType: nextType,
                                  baseSalaryUnit: nextUnit,
                                },
                              }
                            })
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">{t.labels.empty}</option>
                          <option value="CTJ">CTJ</option>
                          <option value="CDD">CDD</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.salaryCategory}</span>
                        <input
                          value={formState.expatProfile.salaryCategory}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, salaryCategory: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.baseSalaryAmount}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formState.expatProfile.baseSalaryAmount}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, baseSalaryAmount: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.baseSalaryUnit}</span>
                        <select
                          value={formState.expatProfile.baseSalaryUnit}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: {
                                ...prev.expatProfile,
                                baseSalaryUnit: event.target.value as ExpatProfileForm['baseSalaryUnit'],
                              },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">{t.labels.empty}</option>
                          <option value="MONTH">{t.form.salaryUnitMonth}</option>
                          <option value="HOUR">{t.form.salaryUnitHour}</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.netMonthlyAmount}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={formState.expatProfile.netMonthlyAmount}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: {
                                ...prev.expatProfile,
                                netMonthlyAmount: event.target.value,
                                netMonthlyUnit: 'MONTH',
                              },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.netMonthlyUnit}</span>
                        <select
                          value={formState.expatProfile.netMonthlyUnit || 'MONTH'}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: {
                                ...prev.expatProfile,
                                netMonthlyUnit: event.target.value as ExpatProfileForm['netMonthlyUnit'],
                              },
                            }))
                          }
                          disabled
                          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="MONTH">{t.form.salaryUnitMonth}</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.maritalStatus}</span>
                        <input
                          value={formState.expatProfile.maritalStatus}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, maritalStatus: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.childrenCount}</span>
                        <input
                          type="number"
                          min={0}
                          value={formState.expatProfile.childrenCount}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, childrenCount: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.cnpsNumber}</span>
                        <input
                          value={formState.expatProfile.cnpsNumber}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, cnpsNumber: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.cnpsDeclarationCode}</span>
                        <input
                          value={formState.expatProfile.cnpsDeclarationCode}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, cnpsDeclarationCode: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.provenance}</span>
                        <input
                          value={formState.expatProfile.provenance}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, provenance: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.emergencyContactName}</span>
                        <input
                          value={formState.expatProfile.emergencyContactName}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, emergencyContactName: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-700">
                        <span className="block font-semibold">{t.form.emergencyContactPhone}</span>
                        <input
                          value={formState.expatProfile.emergencyContactPhone}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              expatProfile: { ...prev.expatProfile, emergencyContactPhone: event.target.value },
                            }))
                          }
                          disabled={formMode === 'view'}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                  )
                ) : null}
              </div>

              {canAssignRole ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">{t.form.roles}</p>
                  <div className="flex flex-wrap gap-2">
                    {rolesData.map((role) => (
                      <label
                        key={role.id}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                          formState.roleIds.includes(role.id)
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-sky-600"
                          checked={formState.roleIds.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                          disabled={formMode === 'view'}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                {formMode !== 'view' ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {t.actions.save}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
              {/* Member Detail Drawer */}
              <MemberDetailDrawer
                key={selectedMember?.id ?? 'member-detail-drawer'}
                member={selectedMember}
                open={!!selectedMember}
                onClose={() => setSelectedMember(null)}
                onEdit={(m) => {
                   setSelectedMember(null)
                   openEditPage(m)
                }}
              />
            </main>
  )
}
