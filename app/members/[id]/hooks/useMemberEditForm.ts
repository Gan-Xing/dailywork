import { useEffect, useRef, useState, type FormEvent } from 'react'

import { genderOptions, memberCopy, nationalityOptions, type EmploymentStatus } from '@/lib/i18n/members'
import { normalizeTagsInput } from '@/lib/members/utils'

import type { FormState, Member } from '../types'
import { buildChineseProfileForm, buildExpatProfileForm, normalizeProfileNumber, parseBirthDateFromIdNumber } from '../utils'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UseMemberEditFormParams = {
  member: Member
  canAssignRole: boolean
  t: MemberCopy
}

export function useMemberEditForm({ member, canAssignRole, t }: UseMemberEditFormParams) {
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
  }))

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
    const normalizedTags = normalizeTagsInput(formState.tags)
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
      tags: normalizedTags,
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

  return {
    formState,
    setFormState,
    phoneInput,
    setPhoneInput,
    showPhonePicker,
    setShowPhonePicker,
    phonePickerRef,
    profileExpanded,
    setProfileExpanded,
    submitting,
    actionError,
    toggleRole,
    addPhoneFromInput,
    removePhone,
    handleSubmit,
  }
}
