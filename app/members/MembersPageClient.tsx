'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import {
  employmentStatusLabels,
  genderOptions,
  memberCopy,
  nationalityOptions,
  type EmploymentStatus,
} from '@/lib/i18n/members'
import {
  defaultSortStack,
  defaultVisibleColumns,
  MEMBER_COLUMN_STORAGE_KEY,
  type ColumnKey,
  type SortField,
  type SortOrder,
} from '@/lib/members/constants'
import {
  buildChineseProfileForm,
  buildExpatProfileForm,
  emptyChineseProfile,
  emptyExpatProfile,
  normalizeTagsInput,
  normalizeText,
  normalizeProfileNumber,
  parseBirthDateFromIdNumber,
} from '@/lib/members/utils'
import { useMemberTableState } from '@/lib/members/useMemberTableState'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { MemberDetailDrawerMount } from './components/MemberDetailDrawerMount'
import { MemberFormModal } from './components/MemberFormModal'
import { MembersTab } from './components/MembersTab'
import { MembersPageHeader } from './components/MembersPageHeader'
import { PayrollPayoutsTab } from './components/PayrollPayoutsTab'
import { PermissionsTab } from './components/PermissionsTab'
import { RoleModal } from './components/RoleModal'
import { RolesTab } from './components/RolesTab'
import { useMemberColumns } from './hooks/useMemberColumns'
import { useFilteredMembers } from './hooks/useFilteredMembers'
import { useMemberFilterOptions } from './hooks/useMemberFilterOptions'
import { useMemberFilterSummary } from './hooks/useMemberFilterSummary'
import { useMemberFormatters } from './hooks/useMemberFormatters'
import { useMemberImportExport } from './hooks/useMemberImportExport'
import { useMembersData } from './hooks/useMembersData'
import { usePermissionStatus } from './hooks/usePermissionStatus'
import { useRoleManagement } from './hooks/useRoleManagement'
import { useSessionPermissions } from './hooks/useSessionPermissions'
import type { Member, MemberFormState as FormState } from '@/types/members'







type TabKey = 'members' | 'roles' | 'permissions' | 'payroll'

export function MembersPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
  const router = useRouter()
  const searchParams = useSearchParams()
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
    tags: [],
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
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => [...defaultVisibleColumns])
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)
  const [showPhonePicker, setShowPhonePicker] = useState(false)
  const phonePickerRef = useRef<HTMLDivElement | null>(null)
  const [profileExpanded, setProfileExpanded] = useState(false)
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
    setTagFilters,
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
  } = filterActions
  const {
    authLoaded,
    canViewMembers,
    canCreateMember,
    canUpdateMember,
    canDeleteMember,
    canCreateRole,
    canUpdateRole,
    canDeleteRole,
    canViewRole,
    canAssignRole,
    canViewPermissions,
    canUpdatePermissions,
    canViewPayroll,
    canManagePayroll,
    shouldShowAccessDenied,
  } = useSessionPermissions()
  useEffect(() => {
    if (activeTab === 'permissions' && !canViewPermissions) {
      setActiveTab('members')
    }
    if (activeTab === 'payroll' && !canViewPayroll) {
      setActiveTab('members')
    }
  }, [activeTab, canViewPermissions, canViewPayroll])

  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (!tabParam) return
    if (tabParam === 'payroll' && canViewPayroll) {
      setActiveTab('payroll')
      return
    }
    if (tabParam === 'permissions' && canViewPermissions) {
      setActiveTab('permissions')
      return
    }
    if (tabParam === 'roles') {
      setActiveTab('roles')
      return
    }
    if (tabParam === 'members') {
      setActiveTab('members')
    }
  }, [searchParams, canViewPayroll, canViewPermissions])
  const statusLabels = employmentStatusLabels[locale]
  const {
    nationalityByRegion,
    findNationalityLabel,
    findGenderLabel,
    formatProfileText,
    formatProfileNumber,
    formatProfileList,
    formatSalary,
  } = useMemberFormatters({ locale, t })
  const {
    membersData,
    rolesData,
    permissionsData,
    setPermissionsData,
    loading,
    error,
    loadData,
  } = useMembersData({
    authLoaded,
    canViewMembers,
    canViewPermissions,
    canViewRole,
    canAssignRole,
    loadErrorMessage: t.feedback.loadError,
  })
  const chineseSupervisorOptions = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    const collator = new Intl.Collator(localeId, { numeric: true, sensitivity: 'base' })
    return membersData
      .filter((member) => member.nationality === 'china')
      .map((member) => ({
        value: String(member.id),
        label: normalizeText(member.chineseProfile?.frenchName) || member.username,
      }))
      .sort((a, b) => collator.compare(a.label, b.label))
  }, [membersData, locale])
  const {
    showRoleModal,
    roleSubmitting,
    roleError,
    roleFormState,
    editingRoleId,
    setRoleFormState,
    openCreateRoleModal,
    openEditRoleModal,
    closeRoleModal,
    togglePermission,
    handleCreateRole,
    handleDeleteRole,
  } = useRoleManagement({
    t,
    canCreateRole,
    canUpdateRole,
    canDeleteRole,
    loadData,
  })
  const {
    permissionError,
    editingPermissionId,
    permissionStatusDraft,
    permissionUpdatingId,
    setPermissionStatusDraft,
    startEditPermission,
    cancelEditPermission,
    savePermissionStatus,
  } = usePermissionStatus({
    t,
    canUpdatePermissions,
    setPermissionsData,
  })
  const { columnOptions, columnLabels, templateColumnLabels, templateColumns } = useMemberColumns({
    t,
    canAssignRole,
  })
  const {
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
  } = useMemberFilterOptions({
    membersData,
    rolesData,
    locale,
    t,
    canAssignRole,
    statusLabels,
    findNationalityLabel,
  })
  const resolveRoleName = useCallback(
    (role: { id: number; name: string }) => {
      const match = rolesData.find((item) => item.id === role.id || item.name === role.name)
      return match?.name ?? role.name
    },
    [rolesData],
  )
  const activePermissions = useMemo(
    () => permissionsData.filter((permission) => permission.status === 'ACTIVE'),
    [permissionsData],
  )
  const filteredMembers = useFilteredMembers({
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
  })
  const { hasActiveFilters, activeFilterCount } = useMemberFilterSummary({
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
  })
  const {
    importing,
    exporting,
    templateDownloading,
    handleImportFileChange,
    handleExportMembers,
    handleDownloadTemplate,
  } = useMemberImportExport({
    t,
    locale,
    canCreateMember,
    canViewMembers,
    canAssignRole,
    rolesData,
    members: filteredMembers,
    visibleColumns,
    columnLabels,
    templateColumns,
    templateColumnLabels,
    statusLabels,
    formatProfileText,
    formatProfileNumber,
    formatProfileList,
    formatSalary,
    findGenderLabel,
    findNationalityLabel,
    resolveRoleName,
    loadData,
    setActionError,
    setActionNotice,
  })
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


  const resetForm = () => {
    setFormState({
      id: undefined,
      username: '',
      password: '',
      name: '',
      gender: genderOptions[0]?.value ?? '',
      nationality: nationalityOptions[0]?.key ?? '',
      phones: [],
      tags: [],
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

  const toggleColumnGroup = (keys: ColumnKey[]) => {
    if (keys.length === 0) return
    const hasAll = keys.every((key) => visibleColumns.includes(key))
    if (hasAll) {
      persistVisibleColumns(visibleColumns.filter((key) => !keys.includes(key)))
      return
    }
    const next = Array.from(new Set([...visibleColumns, ...keys]))
    persistVisibleColumns(next)
  }

  const selectAllColumns = () => persistVisibleColumns(columnOptions.map((item) => item.key))
  const restoreDefaultColumns = () => persistVisibleColumns([...defaultVisibleColumns])
  const clearColumns = () => persistVisibleColumns([])
  const isVisible = (key: ColumnKey) => {
    if (key === 'roles' && !canAssignRole) return false
    return visibleColumns.includes(key)
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
      tags: member.tags ?? [],
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
    const normalizedTags = normalizeTagsInput(formState.tags)
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
      chineseSupervisorId: formState.expatProfile.chineseSupervisorId
        ? Number(formState.expatProfile.chineseSupervisorId)
        : null,
      contractNumber: formState.expatProfile.contractNumber.trim() || null,
      contractType: formState.expatProfile.contractType || null,
      contractStartDate: formState.expatProfile.contractStartDate.trim() || null,
      contractEndDate: formState.expatProfile.contractEndDate.trim() || null,
      salaryCategory: formState.expatProfile.salaryCategory.trim() || null,
      prime: formState.expatProfile.prime.trim() || null,
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
      tags: string[]
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
      tags: normalizedTags,
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

  const handleImportClick = () => {
    if (!canCreateMember) {
      setActionError(t.errors.needMemberCreate)
      setActionNotice(null)
      return
    }
    importInputRef.current?.click()
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
    tagFilters,
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
    ...(canViewPermissions
      ? [
          {
            label: t.stats.coverage,
            value: permissionCoverage,
            accent: 'from-amber-400 to-orange-300',
            helper: t.helpers.permissionCoverage,
          },
        ]
      : []),
  ]
  const availableTabs = useMemo<TabKey[]>(() => {
    const tabs: TabKey[] = ['members', 'roles']
    if (canViewPermissions) tabs.push('permissions')
    if (canViewPayroll) tabs.push('payroll')
    return tabs
  }, [canViewPermissions, canViewPayroll])
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
      <MembersPageHeader
        t={t}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        tabs={availableTabs}
        breadcrumbHome={breadcrumbHome}
        breadcrumbMembers={breadcrumbMembers}
        locale={locale}
        onLocaleChange={setLocale}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-8 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="min-w-0 w-full rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            {activeTab === 'members' ? (
              <MembersTab
                t={t}
                canViewMembers={canViewMembers}
                canCreateMember={canCreateMember}
                canUpdateMember={canUpdateMember}
                canDeleteMember={canDeleteMember}
                submitting={submitting}
                canAssignRole={canAssignRole}
                loading={loading}
                error={error}
                actionError={actionError}
                actionNotice={actionNotice}
                importing={importing}
                exporting={exporting}
                templateDownloading={templateDownloading}
                onImportFileChange={handleImportFileChange}
                showCreateModal={showCreateModal}
                showFilterDrawer={showFilterDrawer}
                onOpenFilterDrawer={() => setShowFilterDrawer(true)}
                onCloseFilterDrawer={() => setShowFilterDrawer(false)}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                filterControlProps={filterControlProps}
                nameFilterOptions={nameFilterOptions}
                usernameFilterOptions={usernameFilterOptions}
                genderFilterOptions={genderFilterOptions}
                nationalityFilterOptions={nationalityFilterOptions}
                phoneFilterOptions={phoneFilterOptions}
                tagFilterOptions={tagFilterOptions}
                joinDateFilterOptions={joinDateFilterOptions}
                positionFilterOptions={positionFilterOptions}
                statusFilterOptions={statusFilterOptions}
                roleFilterOptions={roleFilterOptions}
                teamFilterOptions={teamFilterOptions}
                chineseSupervisorFilterOptions={chineseSupervisorFilterOptions}
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
                tagFilters={tagFilters}
                joinDateFilters={joinDateFilters}
                positionFilters={positionFilters}
                statusFilters={statusFilters}
                roleFilters={roleFilters}
                teamFilters={teamFilters}
                chineseSupervisorFilters={chineseSupervisorFilters}
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
                setTagFilters={setTagFilters}
                setJoinDateFilters={setJoinDateFilters}
                setPositionFilters={setPositionFilters}
                setStatusFilters={setStatusFilters}
                setRoleFilters={setRoleFilters}
                setTeamFilters={setTeamFilters}
                setChineseSupervisorFilters={setChineseSupervisorFilters}
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
                columnOptions={columnOptions}
                visibleColumns={visibleColumns}
                showColumnSelector={showColumnSelector}
                onToggleColumn={toggleColumn}
                onToggleColumnGroup={toggleColumnGroup}
                onSelectAllColumns={selectAllColumns}
                onRestoreDefaultColumns={restoreDefaultColumns}
                onClearColumns={clearColumns}
                onToggleColumnSelector={() => setShowColumnSelector((prev) => !prev)}
                isVisible={isVisible}
                isSortDefault={isSortDefault}
                onClearSort={clearSort}
                onOpenCreateModal={openCreateModal}
                onImportClick={handleImportClick}
                onExport={handleExportMembers}
                onDownloadTemplate={handleDownloadTemplate}
                importInputRef={importInputRef}
                columnSelectorRef={columnSelectorRef}
                handleSort={handleSort}
                sortIndicator={sortIndicator}
                members={paginatedMembers}
                rolesData={rolesData}
                locale={locale}
                statusLabels={statusLabels}
                formatProfileText={formatProfileText}
                formatProfileNumber={formatProfileNumber}
                formatProfileList={formatProfileList}
                formatSalary={formatSalary}
                findGenderLabel={findGenderLabel}
                findNationalityLabel={findNationalityLabel}
                onViewMember={(member) => setSelectedMember(member)}
                onEditMember={openEditPage}
                onDeleteMember={handleDelete}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                totalMembers={totalMembers}
                pageInput={pageInput}
                onPageChange={setPage}
                onPageInputChange={setPageInput}
                onPageSizeChange={(value) => {
                  setPageSize(value)
                  setPage(1)
                }}
                stats={headerStats}
              />
            ) : null}

            {activeTab === 'roles' ? (
              <RolesTab
                t={t}
                rolesData={rolesData}
                canViewRole={canViewRole}
                canCreateRole={canCreateRole}
                canUpdateRole={canUpdateRole}
                canDeleteRole={canDeleteRole}
                onOpenCreateRoleModal={openCreateRoleModal}
                onEditRole={openEditRoleModal}
                onDeleteRole={handleDeleteRole}
              />
            ) : null}

            {activeTab === 'permissions' && canViewPermissions ? (
              <PermissionsTab
                t={t}
                permissions={permissions}
                permissionGroups={permissionGroups}
                permissionError={permissionError}
                canViewPermissions={canViewPermissions}
                canUpdatePermissions={canUpdatePermissions}
                editingPermissionId={editingPermissionId}
                permissionStatusDraft={permissionStatusDraft}
                permissionUpdatingId={permissionUpdatingId}
                onStartEdit={startEditPermission}
                onCancelEdit={cancelEditPermission}
                onSave={savePermissionStatus}
                onChangeDraft={setPermissionStatusDraft}
              />
            ) : null}

            {activeTab === 'payroll' ? (
              <PayrollPayoutsTab
                t={t}
                locale={locale}
                members={membersData}
                membersLoading={loading}
                membersError={error}
                teamOptions={teamOptions}
                chineseSupervisorOptions={chineseSupervisorOptions}
                canViewPayroll={canViewPayroll}
                canManagePayroll={canManagePayroll}
              />
            ) : null}
          </div>
        </div>
      </section>

      <RoleModal
        t={t}
        open={showRoleModal}
        editingRoleId={editingRoleId}
        roleFormState={roleFormState}
        roleError={roleError}
        roleSubmitting={roleSubmitting}
        permissionsData={permissionsData}
        activePermissions={activePermissions}
        onClose={closeRoleModal}
        onSubmit={handleCreateRole}
        onNameChange={(value) => setRoleFormState((prev) => ({ ...prev, name: value }))}
        onTogglePermission={togglePermission}
      />

      <MemberFormModal
        t={t}
        open={showCreateModal}
        modalTitle={modalTitle}
        modalSubtitle={modalSubtitle}
        locale={locale}
        formMode={formMode}
        formState={formState}
        setFormState={setFormState}
        rolesData={rolesData}
        canAssignRole={canAssignRole}
        onToggleRole={toggleRole}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleSubmit}
        positionOptions={positionOptions}
        teamOptions={teamOptions}
        chineseSupervisorOptions={chineseSupervisorOptions}
        nationalityByRegion={nationalityByRegion}
        statusLabels={statusLabels}
        isChineseForm={isChineseForm}
        profileExpanded={profileExpanded}
        setProfileExpanded={setProfileExpanded}
        showPhonePicker={showPhonePicker}
        setShowPhonePicker={setShowPhonePicker}
        phoneInput={phoneInput}
        setPhoneInput={setPhoneInput}
        addPhoneFromInput={addPhoneFromInput}
        removePhone={removePhone}
        phonePickerRef={phonePickerRef}
        actionError={actionError}
        submitting={submitting}
      />

      <MemberDetailDrawerMount
        selectedMember={selectedMember}
        onClose={() => setSelectedMember(null)}
        onEdit={(member) => {
          setSelectedMember(null)
          openEditPage(member)
        }}
      />
    </main>
  )
}
