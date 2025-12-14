'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import Link from 'next/link'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { AccessDenied } from '@/components/AccessDenied'
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
  const [actionError, setActionError] = useState<string | null>(null)
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

  const columnOptions: { key: ColumnKey; label: ReactNode }[] = useMemo(
    () => [
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
    ],
    [t.table],
  )
  const positionOptions = useMemo(() => {
    const set = new Set<string>()
    membersData.forEach((member) => {
      if (member.position) set.add(member.position)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [membersData])

  const modalTitle =
    formMode === 'edit' ? t.actions.edit : formMode === 'view' ? t.actions.view : t.actions.create
  const modalSubtitle = t.modalSubtitle

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
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)

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
    const payload = {
      username: formState.username.trim(),
      password: formState.password,
      name: formState.name.trim(),
      gender: formState.gender,
      nationality: formState.nationality,
      phones: phoneList,
      joinDate: joinDateValue,
      position: formState.position.trim() || null,
      employmentStatus: formState.employmentStatus,
      roleIds: formState.roleIds,
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

  const filteredMembers = useMemo(
    () =>
      [...membersData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [membersData],
  )

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
                    <ActionButton>{t.actions.import}</ActionButton>
                    <ActionButton>{t.actions.export}</ActionButton>
                    <ActionButton>{t.actions.template}</ActionButton>
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
                  </div>
                </div>

                {actionError && !showCreateModal ? (
                  <div className="px-6 pt-2 text-sm text-rose-600">{actionError}</div>
                ) : null}

                {!canViewMembers ? (
                  <div className="p-6 text-sm text-rose-600">
                    {t.access.needMemberView}
                  </div>
                ) : (
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
                      <table className="w-full table-auto text-left text-base text-slate-900">
                        <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-600">
                          <tr>
                            {isVisible('sequence') ? (
                              <th className="px-3 py-3 text-center whitespace-nowrap">{t.table.sequence}</th>
                            ) : null}
                            {isVisible('name') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.name}</th>
                            ) : null}
                            {isVisible('username') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.username}</th>
                            ) : null}
                            {isVisible('gender') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.gender}</th>
                            ) : null}
                            {isVisible('nationality') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.nationality}</th>
                            ) : null}
                            {isVisible('phones') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.phones}</th>
                            ) : null}
                            {isVisible('joinDate') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.joinDate}</th>
                            ) : null}
                            {isVisible('position') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.position}</th>
                            ) : null}
                            {isVisible('employmentStatus') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.employmentStatus}</th>
                            ) : null}
                            {isVisible('roles') ? (
                              <th className="min-w-[150px] px-3 py-3 whitespace-nowrap">{t.table.roles}</th>
                            ) : null}
                            {isVisible('createdAt') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.createdAt}</th>
                            ) : null}
                            {isVisible('updatedAt') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.updatedAt}</th>
                            ) : null}
                            {isVisible('actions') ? (
                              <th className="px-3 py-3 whitespace-nowrap">{t.table.actions}</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 align-middle">
                          {filteredMembers.map((member, index) => (
                            <tr key={member.id} className="hover:bg-slate-50 align-middle">
                              {isVisible('sequence') ? (
                                <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700 align-middle">
                                  {index + 1}
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
                                      const role = rolesData.find((item) => item.id === roleKey.id || item.name === roleKey.name)
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
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
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

function ActionButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      {children}
    </button>
  )
}
