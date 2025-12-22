'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import Link from 'next/link'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
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
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type ChineseProfile = {
  frenchName: string | null
  idNumber: string | null
  passportNumber: string | null
  educationAndMajor: string | null
  certifications: string[]
  domesticMobile: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  redBookValidYears: number | null
  cumulativeAbroadYears: number | null
  birthplace: string | null
  residenceInChina: string | null
  medicalHistory: string | null
  healthStatus: string | null
}

type ExpatProfile = {
  team: string | null
  contractNumber: string | null
  contractType: 'CTJ' | 'CDD' | null
  salaryCategory: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: 'MONTH' | 'HOUR' | null
  netMonthlyAmount: string | null
  netMonthlyUnit: 'MONTH' | 'HOUR' | null
  maritalStatus: string | null
  childrenCount: number | null
  cnpsNumber: string | null
  cnpsDeclarationCode: string | null
  provenance: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

type Member = {
  id: number
  name: string | null
  username: string
  gender: string | null
  nationality: string | null
  phones: string[]
  joinDate: string | null
  birthDate: string | null
  terminationDate: string | null
  terminationReason: string | null
  position: string | null
  employmentStatus: EmploymentStatus
  roles: { id: number; name: string }[]
  chineseProfile?: ChineseProfile | null
  expatProfile?: ExpatProfile | null
}

type Role = {
  id: number
  name: string
}

type MemberOption = {
  expatProfile?: {
    team?: string | null
  } | null
}

type ChineseProfileForm = {
  frenchName: string
  idNumber: string
  passportNumber: string
  educationAndMajor: string
  certifications: string[]
  domesticMobile: string
  emergencyContactName: string
  emergencyContactPhone: string
  redBookValidYears: string
  cumulativeAbroadYears: string
  birthplace: string
  residenceInChina: string
  medicalHistory: string
  healthStatus: string
}

type ExpatProfileForm = {
  team: string
  contractNumber: string
  contractType: '' | 'CTJ' | 'CDD'
  salaryCategory: string
  baseSalaryAmount: string
  baseSalaryUnit: '' | 'MONTH' | 'HOUR'
  netMonthlyAmount: string
  netMonthlyUnit: '' | 'MONTH'
  maritalStatus: string
  childrenCount: string
  cnpsNumber: string
  cnpsDeclarationCode: string
  provenance: string
  emergencyContactName: string
  emergencyContactPhone: string
}

type FormState = {
  username: string
  password: string
  name: string
  gender: string
  nationality: string
  phones: string[]
  joinDate: string
  birthDate: string
  terminationDate: string
  terminationReason: string
  position: string
  employmentStatus: EmploymentStatus
  roleIds: number[]
  chineseProfile: ChineseProfileForm
  expatProfile: ExpatProfileForm
}

type Props = {
  member: Member
  canAssignRole: boolean
}

const emptyChineseProfile: ChineseProfileForm = {
  frenchName: '',
  idNumber: '',
  passportNumber: '',
  educationAndMajor: '',
  certifications: [],
  domesticMobile: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  redBookValidYears: '',
  cumulativeAbroadYears: '',
  birthplace: '',
  residenceInChina: '',
  medicalHistory: '',
  healthStatus: '',
}

const emptyExpatProfile: ExpatProfileForm = {
  team: '',
  contractNumber: '',
  contractType: '',
  salaryCategory: '',
  baseSalaryAmount: '',
  baseSalaryUnit: '',
  netMonthlyAmount: '',
  netMonthlyUnit: '',
  maritalStatus: '',
  childrenCount: '',
  cnpsNumber: '',
  cnpsDeclarationCode: '',
  provenance: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
}

const toProfileNumberString = (value?: number | null) =>
  value === null || value === undefined ? '' : String(value)

const buildChineseProfileForm = (profile?: ChineseProfile | null): ChineseProfileForm => ({
  frenchName: profile?.frenchName ?? '',
  idNumber: profile?.idNumber ?? '',
  passportNumber: profile?.passportNumber ?? '',
  educationAndMajor: profile?.educationAndMajor ?? '',
  certifications: profile?.certifications ?? [],
  domesticMobile: profile?.domesticMobile ?? '',
  emergencyContactName: profile?.emergencyContactName ?? '',
  emergencyContactPhone: profile?.emergencyContactPhone ?? '',
  redBookValidYears: toProfileNumberString(profile?.redBookValidYears ?? null),
  cumulativeAbroadYears: toProfileNumberString(profile?.cumulativeAbroadYears ?? null),
  birthplace: profile?.birthplace ?? '',
  residenceInChina: profile?.residenceInChina ?? '',
  medicalHistory: profile?.medicalHistory ?? '',
  healthStatus: profile?.healthStatus ?? '',
})

const buildExpatProfileForm = (profile?: ExpatProfile | null): ExpatProfileForm => ({
  team: profile?.team ?? '',
  contractNumber: profile?.contractNumber ?? '',
  contractType: profile?.contractType ?? '',
  salaryCategory: profile?.salaryCategory ?? '',
  baseSalaryAmount: profile?.baseSalaryAmount ?? '',
  baseSalaryUnit: profile?.baseSalaryUnit ?? '',
  netMonthlyAmount: profile?.netMonthlyAmount ?? '',
  netMonthlyUnit: profile?.netMonthlyUnit === 'MONTH' ? 'MONTH' : '',
  maritalStatus: profile?.maritalStatus ?? '',
  childrenCount:
    profile?.childrenCount === null || profile?.childrenCount === undefined
      ? ''
      : String(profile.childrenCount),
  cnpsNumber: profile?.cnpsNumber ?? '',
  cnpsDeclarationCode: profile?.cnpsDeclarationCode ?? '',
  provenance: profile?.provenance ?? '',
  emergencyContactName: profile?.emergencyContactName ?? '',
  emergencyContactPhone: profile?.emergencyContactPhone ?? '',
})

const normalizeText = (value?: string | null) => (value ?? '').trim()

const normalizeProfileNumber = (value: string) => {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const parseBirthDateFromIdNumber = (value: string) => {
  const text = value.trim()
  if (!text) return ''
  let digits = ''
  if (/^\d{17}[\dXx]$/.test(text)) {
    digits = text.slice(6, 14)
  } else if (/^\d{15}$/.test(text)) {
    digits = `19${text.slice(6, 12)}`
  } else {
    return ''
  }
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return ''
  }
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(day).padStart(2, '0')
  return `${year}-${paddedMonth}-${paddedDay}`
}

export function MemberEditClient({ member, canAssignRole }: Props) {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
  const statusLabels = employmentStatusLabels[locale]
  const [rolesData, setRolesData] = useState<Role[]>([])
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [showPhonePicker, setShowPhonePicker] = useState(false)
  const phonePickerRef = useRef<HTMLDivElement | null>(null)
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [formState, setFormState] = useState<FormState>(() => ({
    username: member.username,
    password: '',
    name: member.name ?? '',
    gender: member.gender ?? (genderOptions[0]?.value ?? ''),
    nationality: member.nationality ?? (nationalityOptions[0]?.key ?? ''),
    phones: member.phones ?? [],
    joinDate: member.joinDate ? member.joinDate.slice(0, 10) : '',
    birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
    terminationDate: member.terminationDate ? member.terminationDate.slice(0, 10) : '',
    terminationReason: member.terminationReason ?? '',
    position: member.position ?? '',
    employmentStatus: member.employmentStatus ?? 'ACTIVE',
    roleIds: member.roles?.map((role) => role.id) ?? [],
    chineseProfile: buildChineseProfileForm(member.chineseProfile),
    expatProfile: buildExpatProfileForm(member.expatProfile),
  }))

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

  const optionCollator = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    return new Intl.Collator(localeId, {
      numeric: true,
      sensitivity: 'base',
    })
  }, [locale])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    memberOptions.forEach((memberOption) => {
      const value = normalizeText(memberOption.expatProfile?.team ?? null)
      if (value) set.add(value)
    })
    const currentTeam = normalizeText(formState.expatProfile.team)
    if (currentTeam) set.add(currentTeam)
    return Array.from(set).sort(optionCollator.compare)
  }, [formState.expatProfile.team, memberOptions, optionCollator])

  useEffect(() => {
    if (!canAssignRole) {
      setRolesData([])
      return
    }
    const loadRoles = async () => {
      try {
        const res = await fetch('/api/roles')
        if (!res.ok) return
        const data = (await res.json()) as { roles?: Role[] }
        setRolesData(data.roles ?? [])
      } catch {
        setRolesData([])
      }
    }
    void loadRoles()
  }, [canAssignRole])

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch('/api/members')
        if (!res.ok) return
        const data = (await res.json()) as { members?: MemberOption[] }
        setMemberOptions(Array.isArray(data.members) ? data.members : [])
      } catch {
        setMemberOptions([])
      }
    }
    void loadMembers()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (phonePickerRef.current && !phonePickerRef.current.contains(event.target as Node)) {
        setShowPhonePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    setSubmitting(true)
    setActionError(null)
    const phoneList = [
      ...(formState.phones ?? []).map((phone) => phone.trim()).filter(Boolean),
      phoneInput.trim(),
    ].filter(Boolean)
    const birthDateValue = formState.birthDate.trim()
    let resolvedBirthDate = birthDateValue
    if (!resolvedBirthDate && formState.nationality === 'china') {
      resolvedBirthDate = parseBirthDateFromIdNumber(formState.chineseProfile.idNumber)
    }
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
      joinDate?: string
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
      joinDate: formState.joinDate ? formState.joinDate : undefined,
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
        expatProfilePayload.contractType === 'CDD' &&
        expatProfilePayload.baseSalaryUnit === 'HOUR'
      ) {
        throw new Error(t.errors.baseSalaryUnitInvalid)
      }
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.feedback.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const isChineseForm = formState.nationality === 'china'
  const displayName = formState.name || formState.username
  const phoneSummary = formState.phones.length
    ? `${formState.phones.length} ${t.form.phones}`
    : t.form.phonePlaceholder

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-10 sm:px-8 xl:max-w-[1500px] xl:px-12 2xl:max-w-[1700px] 2xl:px-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs
            variant="light"
            items={[
              { label: t.breadcrumbs.home, href: '/' },
              { label: t.breadcrumbs.members, href: '/members' },
              { label: t.breadcrumbs.memberEdit },
            ]}
          />
          <LocaleSwitcher locale={locale} onChange={setLocale} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">MEMBER</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">{t.editTitle}</h1>
            <p className="mt-2 text-sm text-slate-600">{t.editSubtitle}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            {displayName}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.name}</span>
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="陈蓉 / Marie Dupont"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.username}</span>
                <input
                  value={formState.username}
                  onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder={t.form.passwordPlaceholder}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.gender}</span>
                <select
                  value={formState.gender}
                  onChange={(event) => setFormState((prev) => ({ ...prev, gender: event.target.value }))}
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
                  value={formState.position}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      position: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder={t.form.positionPlaceholder}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
                <span className="block font-semibold">{t.form.phones}</span>
                <div className="relative" ref={phonePickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowPhonePicker((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white"
                  >
                    <span>{phoneSummary}</span>
                    <span className="text-xs text-slate-500" aria-hidden>
                      ⌵
                    </span>
                  </button>
                  {showPhonePicker ? (
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.birthDate}</span>
                <input
                  type="date"
                  value={formState.birthDate}
                  onChange={(event) => setFormState((prev) => ({ ...prev, birthDate: event.target.value }))}
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
                            expatProfile: {
                              ...prev.expatProfile,
                              cnpsDeclarationCode: event.target.value,
                            },
                          }))
                        }
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
                            expatProfile: {
                              ...prev.expatProfile,
                              emergencyContactName: event.target.value,
                            },
                          }))
                        }
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
                            expatProfile: {
                              ...prev.expatProfile,
                              emergencyContactPhone: event.target.value,
                            },
                          }))
                        }
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
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Link
                href="/members"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t.actions.cancel}
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t.actions.saveChanges}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
