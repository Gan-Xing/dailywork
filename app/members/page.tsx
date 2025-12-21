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

import Link from 'next/link'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
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
import { type SessionUser } from '@/lib/server/authSession'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export const dynamic = 'force-dynamic'

type Member = {
  id: number
  name: string | null
  username: string
  gender: string | null
  nationality: string | null
  phones: string[]
  joinDate: string | null
  position: string | null
  employmentStatus: EmploymentStatus
  roles: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
}

type Role = {
  id: number
  name: string
  permissions: { id: number; code: string; name: string }[]
}

type Permission = {
  id: number
  code: string
  name: string
}

type FormState = {
  id?: number
  username: string
  password: string
  name: string
  gender: string
  nationality: string
  phones: string[]
  joinDate: string
  position: string
  employmentStatus: EmploymentStatus
  roleIds: number[]
}

type TabKey = 'members' | 'roles' | 'permissions'
type ColumnKey =
  | 'sequence'
  | 'name'
  | 'username'
  | 'gender'
  | 'nationality'
  | 'phones'
  | 'joinDate'
  | 'position'
  | 'employmentStatus'
  | 'roles'
  | 'createdAt'
  | 'updatedAt'
  | 'actions'
type SortOrder = 'asc' | 'desc'
type SortField = Exclude<ColumnKey, 'sequence' | 'actions'>
type TemplateColumnKey =
  | 'name'
  | 'username'
  | 'password'
  | 'gender'
  | 'nationality'
  | 'phones'
  | 'joinDate'
  | 'position'
  | 'employmentStatus'
  | 'roles'
type ImportErrorCode =
  | 'missing_username'
  | 'missing_password'
  | 'duplicate_username'
  | 'username_exists'
  | 'invalid_gender'
  | 'invalid_phone'
  | 'invalid_status'
  | 'invalid_join_date'
  | 'role_not_found'
type ImportError = { row: number; code: ImportErrorCode; value?: string }

const MEMBER_COLUMN_STORAGE_KEY = 'member-visible-columns'
const defaultVisibleColumns: ColumnKey[] = [
  'sequence',
  'name',
  'username',
  'gender',
  'nationality',
  'phones',
  'joinDate',
  'position',
  'employmentStatus',
  'roles',
  'actions',
]
const memberColumnOrder: ColumnKey[] = [
  'sequence',
  'name',
  'username',
  'gender',
  'nationality',
  'phones',
  'joinDate',
  'position',
  'employmentStatus',
  'roles',
  'createdAt',
  'updatedAt',
  'actions',
]
const exportableColumnOrder = memberColumnOrder.filter((key) => key !== 'actions')
const defaultSortStack: Array<{ field: SortField; order: SortOrder }> = [
  { field: 'createdAt', order: 'desc' },
]
const memberTemplateColumns: TemplateColumnKey[] = [
  'name',
  'username',
  'password',
  'gender',
  'nationality',
  'phones',
  'joinDate',
  'position',
  'employmentStatus',
  'roles',
]
const REQUIRED_IMPORT_COLUMNS: TemplateColumnKey[] = ['username', 'password']
const PHONE_PATTERN = /^[+\d][\d\s-]{4,}$/
const EMPTY_FILTER_VALUE = '__EMPTY__'
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100, 500]

const normalizeText = (value?: string | null) => (value ?? '').trim()
const getMonthKey = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 7)
}

export default function MembersPage() {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
  const { home: breadcrumbHome, members: breadcrumbMembers } = t.breadcrumbs

  const getTodayString = useCallback(() => new Date().toISOString().slice(0, 10), [])
  const [activeTab, setActiveTab] = useState<TabKey>('members')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create')
  const [formState, setFormState] = useState<FormState>({
    id: undefined,
    username: '',
    password: '',
    name: '',
    gender: genderOptions[0]?.value ?? '',
    nationality: nationalityOptions[0]?.key ?? '',
    phones: [] as string[],
    joinDate: getTodayString(),
    position: '',
    employmentStatus: 'ACTIVE' as EmploymentStatus,
    roleIds: [] as number[],
  })
  const [membersData, setMembersData] = useState<Member[]>([])
  const [rolesData, setRolesData] = useState<Role[]>([])
  const [permissionsData, setPermissionsData] = useState<Permission[]>([])
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
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [sortStack, setSortStack] = useState<Array<{ field: SortField; order: SortOrder }>>(
    defaultSortStack,
  )
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize, setPageSize] = useState(20)
  const [nameFilters, setNameFilters] = useState<string[]>([])
  const [usernameFilters, setUsernameFilters] = useState<string[]>([])
  const [genderFilters, setGenderFilters] = useState<string[]>([])
  const [nationalityFilters, setNationalityFilters] = useState<string[]>([])
  const [phoneFilters, setPhoneFilters] = useState<string[]>([])
  const [joinDateFilters, setJoinDateFilters] = useState<string[]>([])
  const [positionFilters, setPositionFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [createdAtFilters, setCreatedAtFilters] = useState<string[]>([])
  const [updatedAtFilters, setUpdatedAtFilters] = useState<string[]>([])
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const canViewMembers = session?.permissions.includes('member:view') ?? false
  const canEditMember = session?.permissions.includes('member:edit') ?? false
  const canManageMember = session?.permissions.includes('member:manage') ?? false
  const canManageRole = session?.permissions.includes('role:manage') ?? false
  const canViewPermissions = session?.permissions.includes('permission:view') ?? false
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

  const findNationalityLabel = (value: string | null) => {
    const option = nationalityOptions.find((item) => item.key === value)
    return option ? option.label[locale] : value || t.labels.empty
  }

  const findGenderLabel = (value: string | null) => {
    const option = genderOptions.find((item) => item.value === value)
    return option ? option.label[locale] : value || t.labels.empty
  }

  const columnOptions: { key: ColumnKey; label: ReactNode }[] = useMemo(() => {
    const baseOptions = [
      { key: 'sequence', label: t.table.sequence },
      { key: 'name', label: t.table.name },
      { key: 'username', label: t.table.username },
      { key: 'gender', label: t.table.gender },
      { key: 'nationality', label: t.table.nationality },
      { key: 'phones', label: t.table.phones },
      { key: 'joinDate', label: t.table.joinDate },
      { key: 'position', label: t.table.position },
      { key: 'employmentStatus', label: t.table.employmentStatus },
      { key: 'roles', label: t.table.roles },
      { key: 'createdAt', label: t.table.createdAt },
      { key: 'updatedAt', label: t.table.updatedAt },
      { key: 'actions', label: t.table.actions },
    ]
    return canManageRole ? baseOptions : baseOptions.filter((option) => option.key !== 'roles')
  }, [canManageRole, t.table])
  const columnLabels = useMemo(
    () => ({
      sequence: t.table.sequence,
      name: t.table.name,
      username: t.table.username,
      gender: t.table.gender,
      nationality: t.table.nationality,
      phones: t.table.phones,
      joinDate: t.table.joinDate,
      position: t.table.position,
      employmentStatus: t.table.employmentStatus,
      roles: t.table.roles,
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
      position: t.form.position,
      employmentStatus: t.form.status,
      roles: t.form.roles,
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
      add(copy.form.position, 'position')
      add(copy.form.status, 'employmentStatus')
      add(copy.form.roles, 'roles')
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
  const templateColumns = useMemo(() => {
    if (canManageRole) return memberTemplateColumns
    return memberTemplateColumns.filter((key) => key !== 'roles')
  }, [canManageRole])
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
    const options = order.map((status) => ({
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
      (canManageRole && roleFilters.length > 0) ||
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
      createdAtFilters,
      updatedAtFilters,
      canManageRole,
    ],
  )

  const clearFilters = () => {
    setNameFilters([])
    setUsernameFilters([])
    setGenderFilters([])
    setNationalityFilters([])
    setPhoneFilters([])
    setJoinDateFilters([])
    setPositionFilters([])
    setStatusFilters([])
    setRoleFilters([])
    setCreatedAtFilters([])
    setUpdatedAtFilters([])
  }

  const modalTitle =
    formMode === 'edit' ? t.actions.edit : formMode === 'view' ? t.actions.view : t.actions.create
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

      if (canViewMembers) {
        const rolesTask = fetch('/api/roles')
          .then((res) => {
            if (!res.ok) throw new Error(t.feedback.loadError)
            return res.json() as Promise<{ roles: Role[] }>
          })
          .then((rolesJson) => setRolesData(rolesJson.roles ?? []))
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
          .then((permissionsJson) => setPermissionsData(permissionsJson.permissions ?? []))
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
  }, [authLoaded, canViewMembers, canViewPermissions, t.feedback.loadError])

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
      position: '',
      employmentStatus: 'ACTIVE',
      roleIds: [],
    })
    setPhoneInput('')
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
    if (canManageRole) return
    setSortStack((prev) => prev.filter((item) => item.field !== 'roles'))
  }, [canManageRole])

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
    if (key === 'roles' && !canManageRole) return false
    return visibleColumns.includes(key)
  }

  const openCreateRoleModal = () => {
    if (!canManageRole) {
      setRoleError(t.errors.needRoleManage)
      return
    }
    resetRoleForm()
    setShowRoleModal(true)
  }

  const openCreateModal = () => {
    if (!canManageMember) {
      setActionError(t.errors.needMemberManage)
      return
    }
    setActionError(null)
    resetForm()
    setFormMode('create')
    setShowCreateModal(true)
  }

  const openEditModal = (member: Member) => {
    if (!canEditMember) {
      setActionError(t.errors.needMemberEdit)
      return
    }
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
      position: member.position ?? '',
      employmentStatus: member.employmentStatus ?? 'ACTIVE',
      roleIds: member.roles?.map((role) => role.id) ?? [],
    })
    setPhoneInput('')
    setFormMode('edit')
    setShowCreateModal(true)
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
      position: member.position ?? '',
      employmentStatus: member.employmentStatus ?? 'ACTIVE',
      roleIds: member.roles?.map((role) => role.id) ?? [],
    })
    setPhoneInput('')
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
    if (formMode === 'create' && !canManageMember) {
      setActionError(t.errors.needMemberManage)
      return
    }
    if (formMode === 'edit' && !canEditMember) {
      setActionError(t.errors.needMemberEdit)
      return
    }
    setSubmitting(true)
    setActionError(null)
    const phoneList = [
      ...(formState.phones ?? []).map((phone) => phone.trim()).filter(Boolean),
      phoneInput.trim(),
    ].filter(Boolean)
    const joinDateValue =
      formMode === 'create' ? formState.joinDate || getTodayString() : formState.joinDate || undefined
    const payload: {
      username: string
      password: string
      name: string
      gender: string
      nationality: string
      phones: string[]
      joinDate: string | undefined
      position: string | null
      employmentStatus: EmploymentStatus
      roleIds?: number[]
    } = {
      username: formState.username.trim(),
      password: formState.password,
      name: formState.name.trim(),
      gender: formState.gender,
      nationality: formState.nationality,
      phones: phoneList,
      joinDate: joinDateValue,
      position: formState.position.trim() || null,
      employmentStatus: formState.employmentStatus,
    }
    if (canManageRole) {
      payload.roleIds = formState.roleIds
    }

    try {
      if (!payload.username) {
        throw new Error(t.errors.usernameRequired)
      }
      if (formMode === 'create' && !payload.password) {
        throw new Error(t.errors.passwordRequired)
      }
      const isEdit = formMode === 'edit'
      const res = await fetch(isEdit ? `/api/members/${formState.id}` : '/api/members', {
        method: isEdit ? 'PUT' : 'POST',
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
    if (!canManageMember) {
      setActionError(t.errors.needMemberManage)
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
    if (!canManageRole) {
      setRoleError(t.errors.needRoleManage)
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
    if (!canManageRole) {
      setRoleError(t.errors.needRoleManage)
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

  const formatImportError = useCallback(
    (error: ImportError) => {
      let message = t.errors.importFailed
      switch (error.code) {
        case 'missing_username':
          message = t.errors.usernameRequired
          break
        case 'missing_password':
          message = t.errors.passwordRequired
          break
        case 'duplicate_username':
          message = t.errors.importDuplicateUsername
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
        case 'invalid_status':
          message = t.errors.importInvalidStatus
          break
        case 'invalid_join_date':
          message = t.errors.importInvalidJoinDate
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
    if (!canManageMember) {
      setActionError(t.errors.needMemberManage)
      setActionNotice(null)
      return
    }
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!canManageMember) {
      setActionError(t.errors.needMemberManage)
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
        username: string
        password: string
        name?: string
        gender?: string | null
        nationality?: string | null
        phones: string[]
        joinDate?: string | null
        position?: string | null
        employmentStatus?: EmploymentStatus | null
        roleIds?: number[]
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

      rows.slice(1).forEach((rowValues, index) => {
        const isEmpty = rowValues.every((cell) => !String(cell ?? '').trim())
        if (isEmpty) return
        const rowNumber = index + 2
        let hasJoinDateValue = false
        const record: {
          row: number
          username: string
          password: string
          name?: string
          gender?: string | null
          nationality?: string | null
          phones: string[]
          joinDate?: string | null
          position?: string | null
          employmentStatus?: EmploymentStatus | null
          roleIds?: number[]
        } = {
          row: rowNumber,
          username: '',
          password: '',
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
              record.username = String(rawValue ?? '').trim()
              break
            case 'password':
              record.password = String(rawValue ?? '').trim()
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
            case 'roles': {
              if (!canManageRole) break
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
            default:
              break
          }
        })

        let hasRowError = false
        const normalizedUsername = record.username.trim().toLowerCase()
        if (!normalizedUsername) {
          errors.push({ row: rowNumber, code: 'missing_username' })
          hasRowError = true
        } else if (seenUsernames.has(normalizedUsername)) {
          errors.push({ row: rowNumber, code: 'duplicate_username' })
          hasRowError = true
        } else {
          seenUsernames.add(normalizedUsername)
        }
        if (!record.password) {
          errors.push({ row: rowNumber, code: 'missing_password' })
          hasRowError = true
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
    if (field === 'roles' && !canManageRole) return
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
      if (!matchesValueFilter(member.name, nameFilters)) return false
      if (!matchesValueFilter(member.username, usernameFilters)) return false
      if (!matchesValueFilter(member.gender, genderFilters)) return false
      if (!matchesValueFilter(member.nationality, nationalityFilters)) return false
      if (!matchesListFilter(member.phones, phoneFilters)) return false
      if (!matchesMonthFilter(member.joinDate, joinDateFilters)) return false
      if (!matchesValueFilter(member.position, positionFilters)) return false
      if (!matchesValueFilter(member.employmentStatus, statusFilters)) return false
      if (canManageRole && roleFilters.length > 0) {
        const roleNames = member.roles.map(resolveRoleName).map(normalizeText).filter(Boolean)
        if (roleNames.length === 0) {
          if (!roleFilters.includes(EMPTY_FILTER_VALUE)) return false
        } else if (!roleNames.some((name) => roleFilters.includes(name))) {
          return false
        }
      }
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

    const compareMembers = (left: Member, right: Member) => {
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
          case 'roles':
            result = compareNullable(
              left.roles.map(resolveRoleName).join(' / '),
              right.roles.map(resolveRoleName).join(' / '),
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
    createdAtFilters,
    updatedAtFilters,
    canManageRole,
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
  }, [page])

  useEffect(() => {
    setPage((prev) => Math.min(totalPages, Math.max(1, prev)))
  }, [totalPages])

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
    createdAtFilters,
    updatedAtFilters,
  ])

  const handleExportMembers = async () => {
    if (!canViewMembers) {
      setActionError(t.access.needMemberView)
      return
    }
    if (exporting) return
    const selectedColumns = exportableColumnOrder.filter(
      (key) => visibleColumns.includes(key) && (key !== 'roles' || canManageRole),
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
            case 'position':
              return member.position || t.labels.empty
            case 'employmentStatus':
              return statusLabels[member.employmentStatus] ?? member.employmentStatus
            case 'roles':
              return member.roles.length
                ? member.roles.map(resolveRoleName).filter(Boolean).join(' / ')
                : t.labels.empty
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

  const permissions = useMemo(() => {
    const map = new Map<string, { code: string; name: string; roles: string[] }>()
    rolesData.forEach((role) => {
      role.permissions.forEach((perm) => {
        const existing = map.get(perm.code) ?? { code: perm.code, name: perm.name, roles: [] }
        existing.roles.push(role.name)
        map.set(perm.code, existing)
      })
    })
    return Array.from(map.values())
  }, [rolesData])

  const headcount = membersData.length
  const activeCount = membersData.filter((member) => member.employmentStatus === 'ACTIVE').length
  const roleCount = rolesData.length
  const permissionCoverage = permissions.length
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
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-14 pt-12 text-white">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 40%), radial-gradient(circle at 80% 0%, rgba(94,234,212,0.18), transparent 36%)' }} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 sm:px-8 xl:max-w-[1500px] xl:px-12 2xl:max-w-[1700px] 2xl:px-14">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-slate-200">RBAC · MEMBER</p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.title}</h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">{t.subtitle}</p>
              </div>
              <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-100">
                <Link
                  href="/"
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 transition hover:border-white/40 hover:bg-white/20"
                >
                  {breadcrumbHome}
                </Link>
                <span className="text-slate-300">/</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                  {breadcrumbMembers}
                </span>
              </nav>
            </div>
            <LocaleSwitcher locale={locale} onChange={setLocale} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6 2xl:gap-8">
            <StatCard label={t.stats.headcount} value={headcount} accent="from-sky-400 to-cyan-300" />
            <StatCard label={t.stats.active} value={activeCount} accent="from-emerald-400 to-lime-300" helper={headcount ? `${Math.round((activeCount / headcount) * 100)}%` : undefined} />
            <StatCard
              label={t.stats.roles}
              value={roleCount}
              accent="from-indigo-400 to-blue-300"
              helper="RBAC"
            />
            <StatCard
              label={t.stats.coverage}
              value={permissionCoverage}
              accent="from-amber-400 to-orange-300"
              helper={t.helpers.permissionCoverage}
            />
          </div>
        </div>
      </section>

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
                      disabled={!canManageMember}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t.actions.create}
                    </button>
                    <ActionButton onClick={handleImportClick} disabled={!canManageMember || importing}>
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
                          <ActionButton onClick={() => setFiltersOpen((prev) => !prev)}>
                            {filtersOpen ? t.filters.collapse : t.filters.expand}
                          </ActionButton>
                        </div>
                      </div>
                      {filtersOpen ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
                          {canManageRole ? (
                            <MultiSelectFilter
                              label={t.table.roles}
                              options={roleFilterOptions}
                              selected={roleFilters}
                              onChange={setRoleFilters}
                              {...filterControlProps}
                            />
                          ) : null}
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
                      ) : null}
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
                                {isVisible('roles') ? (
                                  <th
                                    className="min-w-[150px] px-3 py-3 whitespace-nowrap cursor-pointer select-none"
                                    onClick={() => handleSort('roles')}
                                  >
                                    {t.table.roles} {sortIndicator('roles')}
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
                                            onClick={() => openViewModal(member)}
                                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                          >
                                            {t.actions.view}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openEditModal(member)}
                                            disabled={!canEditMember}
                                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {t.actions.edit}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(member)}
                                            className="rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={!canManageMember || submitting}
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
                {!canViewMembers ? (
                  <div className="text-sm text-rose-600">
                    {t.access.needMemberViewRoles}
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
                          disabled={!canManageRole}
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
                            {canManageRole ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                  onClick={() => {
                                    setEditingRoleId(role.id)
                                    setRoleFormState({
                                      name: role.name,
                                      permissionIds: role.permissions.map((p) => p.id),
                                    })
                                    setRoleError(null)
                                    setShowRoleModal(true)
                                  }}
                                >
                                  {t.actions.edit}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                  onClick={() => handleDeleteRole(role.id)}
                                >
                                  {t.actions.delete}
                                </button>
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
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
                                    {t.permissionPanel.code}: {permission.code}
                                  </span>
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
              <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
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

            <form className="mt-4 space-y-4" onSubmit={handleCreateRole}>
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
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {permissionsData.map((permission) => (
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

              {roleError ? <p className="text-sm text-rose-600">{roleError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
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
                    placeholder="陈蓉 / Marie Dupont"
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
                      <span>{formState.phones.length ? `已保存 ${formState.phones.length} 个号码` : t.form.phonePlaceholder}</span>
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
                                  删除
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

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <span className="block font-semibold">{t.form.status}</span>
                  <select
                    value={formState.employmentStatus}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, employmentStatus: event.target.value as EmploymentStatus }))
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

              {canManageRole ? (
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
                    {formMode === 'edit' ? t.actions.saveChanges : t.actions.save}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StatCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: number | string
  helper?: string
  accent: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg shadow-slate-900/50 backdrop-blur">
      <div
        className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-40 blur-3xl`}
      />
      <p className="text-sm text-slate-200">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {helper ? <p className="text-xs text-slate-200">{helper}</p> : null}
    </div>
  )
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
        active
          ? 'bg-slate-900 text-white shadow-sm shadow-slate-300/40 ring-1 ring-slate-900'
          : 'bg-slate-100 text-slate-700 ring-1 ring-transparent hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}
