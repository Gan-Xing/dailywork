'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

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
  permissions: { code: string; name: string }[]
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

export default function MembersPage() {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]

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

  const positionOptions = useMemo(() => {
    const set = new Set<string>()
    membersData.forEach((member) => {
      if (member.position) set.add(member.position)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [membersData])

  const modalTitle =
    formMode === 'edit' ? t.actions.edit : formMode === 'view' ? t.actions.view : t.actions.create
  const modalSubtitle =
    locale === 'fr'
      ? 'Renseignez les champs communs; les détails avancés pourront suivre.'
      : '录入共享字段，扩展资料后续在详情页维护。'

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
  }

  const openCreateRoleModal = () => {
    if (!canManageRole) {
      setRoleError(locale === 'fr' ? '权限不足：role:manage' : '缺少 role:manage 权限')
      return
    }
    resetRoleForm()
    setShowRoleModal(true)
  }

  const openCreateModal = () => {
    if (!canManageMember) {
      setActionError(locale === 'fr' ? '权限不足：member:manage' : '缺少成员管理权限')
      return
    }
    setActionError(null)
    resetForm()
    setFormMode('create')
    setShowCreateModal(true)
  }

  const openEditModal = (member: Member) => {
    if (!canEditMember) {
      setActionError(locale === 'fr' ? '权限不足：member:edit' : '缺少成员编辑权限')
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
    setFormState((prev) => ({ ...prev, phones: [...prev.phones.filter(Boolean), trimmed] }))
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
      setActionError(locale === 'fr' ? '权限不足：member:manage' : '缺少成员管理权限')
      return
    }
    if (formMode === 'edit' && !canEditMember) {
      setActionError(locale === 'fr' ? '权限不足：member:edit' : '缺少成员编辑权限')
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
        throw new Error(locale === 'fr' ? "L'identifiant est obligatoire" : '账号必填')
      }
      if (formMode === 'create' && !payload.password) {
        throw new Error(locale === 'fr' ? 'Mot de passe requis' : '初始密码必填')
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
      setActionError(locale === 'fr' ? '权限不足：member:manage' : '缺少成员管理权限')
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
      setRoleError(locale === 'fr' ? '权限不足：role:manage' : '缺少角色管理权限')
      return
    }
    setRoleSubmitting(true)
    setRoleError(null)
    try {
      if (!roleFormState.name.trim()) {
        throw new Error(locale === 'fr' ? 'Nom du rôle requis' : '角色名称必填')
      }
      const res = await fetch('/api/roles', {
        method: 'POST',
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

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['member:view']}
        hint={locale === 'fr' ? "Connectez-vous puis obtenez member:view pour accéder à la liste." : '请先登录并开通 member:view 权限后再试。'}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-14 pt-12 text-white">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 40%), radial-gradient(circle at 80% 0%, rgba(94,234,212,0.18), transparent 36%)' }} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-200">RBAC · MEMBER</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.title}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">{t.subtitle}</p>
            </div>
            <LocaleSwitcher locale={locale} onChange={setLocale} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              helper={locale === 'fr' ? 'Permissions' : '权限条目'}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6 sm:pt-10">
        <div className="grid gap-8">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
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
                  <div className="flex flex-wrap gap-3">
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
                  </div>
                </div>

                {actionError && !showCreateModal ? (
                  <div className="px-6 pt-2 text-sm text-rose-600">{actionError}</div>
                ) : null}

                {!canViewMembers ? (
                  <div className="p-6 text-sm text-rose-600">
                    {locale === 'fr' ? '权限不足：member:view' : '缺少 member:view 权限，无法查看成员列表。'}
                  </div>
                ) : (
                  <div className="overflow-x-auto border-t border-slate-100">
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
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left">{t.table.name}</th>
                            <th className="px-4 py-3 text-left">{t.table.username}</th>
                            <th className="px-4 py-3 text-left">{t.table.gender}</th>
                            <th className="px-4 py-3 text-left">{t.table.nationality}</th>
                            <th className="px-4 py-3 text-left">{t.table.phones}</th>
                            <th className="px-4 py-3 text-left">{t.table.joinDate}</th>
                            <th className="px-4 py-3 text-left">{t.table.position}</th>
                            <th className="px-4 py-3 text-left">{t.table.employmentStatus}</th>
                            <th className="px-4 py-3 text-left">{t.table.roles}</th>
                            <th className="px-4 py-3 text-left">{t.table.createdAt}</th>
                            <th className="px-4 py-3 text-left">{t.table.updatedAt}</th>
                            <th className="px-4 py-3 text-left">{t.table.actions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50">
                              <td className="whitespace-nowrap px-4 py-3">
                                <p className="font-semibold text-slate-900">
                                  {member.name?.length ? member.name : t.labels.empty}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <p className="font-semibold text-slate-900">{member.username}</p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {findGenderLabel(member.gender)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {findNationalityLabel(member.nationality)}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {member.phones?.length ? member.phones.join(' / ') : t.labels.empty}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {member.joinDate
                                  ? new Date(member.joinDate).toLocaleDateString(locale)
                                  : t.labels.empty}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {member.position || t.labels.empty}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200">
                                  {statusLabels[member.employmentStatus] ?? member.employmentStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <div className="flex flex-wrap gap-2">
                                  {member.roles.map((roleKey) => {
                                    const role = rolesData.find((item) => item.id === roleKey.id || item.name === roleKey.name)
                                    return (
                                      <span
                                        key={`${member.id}-${roleKey.id ?? roleKey.name}`}
                                        className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100"
                                      >
                                        {role?.name ?? roleKey.name}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {new Date(member.createdAt).toLocaleString(locale)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {new Date(member.updatedAt).toLocaleString(locale)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                <div className="flex flex-wrap gap-2">
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
                    {locale === 'fr' ? '权限不足：member:view' : '缺少 member:view 权限，无法查看角色列表。'}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {t.rolePanel.title}
                        </p>
                        <p className="text-xs text-slate-500">RBAC · {rolesData.length} roles</p>
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
                    <div className="grid gap-3 md:grid-cols-2">
                      {rolesData.map((role) => (
                        <div
                          key={role.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-inner"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                              <p className="text-xs text-slate-600">
                                {locale === 'fr' ? 'Permissions' : '权限数'}：{role.permissions.length}
                              </p>
                            </div>
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
                    {locale === 'fr' ? '权限不足：permission:view' : '缺少 permission:view 权限，无法查看权限列表。'}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                          {t.permissionPanel.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {locale === 'fr'
                            ? 'Les permissions suivent le format ressource:action et peuvent être réutilisées côté API.'
                            : '权限遵循资源-动作编码，可直接复用到 API 鉴权策略。'}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
                        {permissions.length} items
                      </span>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm">
                      {permissions.map((permission) => (
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
                <p className="text-lg font-semibold text-slate-900">{t.rolePanel.title}</p>
                <p className="text-sm text-slate-500">
                  {locale === 'fr'
                    ? 'Ajoutez un rôle et associez les permissions nécessaires.'
                    : '新增角色并绑定需要的权限。'}
                </p>
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
                  placeholder={locale === 'fr' ? 'Saisir le nom du rôle' : '请输入角色名称'}
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

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="block font-semibold">{t.form.nationality}</span>
                  <select
                    value={formState.nationality}
                    onChange={(event) => setFormState((prev) => ({ ...prev, nationality: event.target.value }))}
                    disabled={formMode === 'view'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="block font-semibold">{t.form.phones}</span>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {formState.phones.map((phone, index) => (
                      <span
                        key={`phone-${index}-${phone}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200"
                      >
                        {phone}
                        {formMode !== 'view' ? (
                          <button
                            type="button"
                            onClick={() => removePhone(index)}
                            className="text-slate-500 hover:text-rose-600"
                          >
                            ×
                          </button>
                        ) : null}
                      </span>
                    ))}
                    {formMode !== 'view' ? (
                      <>
                        <input
                          value={phoneInput}
                          onChange={(event) => setPhoneInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ',') {
                              event.preventDefault()
                              addPhoneFromInput()
                            }
                          }}
                          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                          placeholder={t.form.phonePlaceholder}
                        />
                        <button
                          type="button"
                          onClick={addPhoneFromInput}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t.form.addPhone}
                        </button>
                      </>
                    ) : null}
                  </div>
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={locale === 'fr' ? 'Sélectionner ou saisir' : '选择或输入岗位'}
                  />
                  <datalist id="position-options">
                    {positionOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
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
