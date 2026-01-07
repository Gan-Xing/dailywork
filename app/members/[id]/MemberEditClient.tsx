'use client'

import { useCallback, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import {
  employmentStatusLabels,
  memberCopy,
  nationalityOptions,
  type NationalityOption,
  type NationalityRegion,
} from '@/lib/i18n/members'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { normalizeText, normalizeTeamKey, resolveTeamDisplayName } from '@/lib/members/utils'

import { BasicInfoSection } from './components/BasicInfoSection'
import { EmploymentSection } from './components/EmploymentSection'
import { FormActions } from './components/FormActions'
import { MemberEditHeader } from './components/MemberEditHeader'
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog'
import { ProfileSection } from './components/ProfileSection'
import { RoleSelector } from './components/RoleSelector'
import { SignatureSection } from './components/SignatureSection'
import { useMemberEditData } from './hooks/useMemberEditData'
import { useMemberEditForm } from './hooks/useMemberEditForm'
import { useTeamSupervisors } from '../hooks/useTeamSupervisors'
import { useProjects } from '../hooks/useProjects'
import { CompensationSection } from './modules/compensation/CompensationSection'
import type { Member } from './types'

type Props = {
  member: Member
  canAssignRole: boolean
  canDeleteMember: boolean
  isViewerChinese: boolean
  canViewSignature: boolean
  canUploadSignature: boolean
  canDeleteSignature: boolean
}

export function MemberEditClient({
  member,
  canAssignRole,
  canDeleteMember,
  isViewerChinese,
  canViewSignature,
  canUploadSignature,
  canDeleteSignature,
}: Props) {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
  const router = useRouter()
  const statusLabels = employmentStatusLabels[locale]
  const {
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
    isDirty,
    toggleRole,
    addPhoneFromInput,
    removePhone,
    handleSubmit,
    submitForm,
  } = useMemberEditForm({ member, canAssignRole, t })
  const {
    rolesData,
    teamOptions,
    memberOptions,
    salaryCategoryOptions,
    maritalStatusOptions,
    provenanceOptions,
  } = useMemberEditData({
    locale,
    canAssignRole,
    currentTeam: formState.expatProfile.team,
  })
  const { teamSupervisorMap } = useTeamSupervisors()
  const { projectOptions } = useProjects()
  const [selectedTeamState, setSelectedTeamState] = useState(() => ({
    memberId: member.id,
    value: member.expatProfile?.team ?? '',
  }))
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null)

  const selectedTeam =
    selectedTeamState.memberId === member.id
      ? selectedTeamState.value
      : member.expatProfile?.team ?? ''

  const optionCollator = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    return new Intl.Collator(localeId, {
      numeric: true,
      sensitivity: 'base',
    })
  }, [locale])

  const teamSelectOptions = useMemo(
    () =>
      teamOptions.map((team) => {
        const label = resolveTeamDisplayName(team, locale, teamSupervisorMap) || team
        const searchText = label === team ? label : `${label} ${team}`
        return {
          value: team,
          label,
          searchText,
        }
      }),
    [teamOptions, locale, teamSupervisorMap],
  )
  const selectedTeamKey = normalizeTeamKey(selectedTeam)
  const currentTeamKey = normalizeTeamKey(member.expatProfile?.team ?? null)
  const memberSelectOptions = useMemo(() => {
    const activeMembers = memberOptions.filter((option) => {
      const teamKey = normalizeTeamKey(option.expatProfile?.team ?? null)
      const isActive = option.employmentStatus === 'ACTIVE'
      return isActive && teamKey === selectedTeamKey
    })
    let candidates = activeMembers
    if (selectedTeamKey === currentTeamKey) {
      const hasCurrent = activeMembers.some((option) => option.id === member.id)
      if (!hasCurrent) {
        candidates = [
          {
            id: member.id,
            username: member.username,
            name: member.name ?? null,
            nationality: member.nationality,
          },
          ...activeMembers,
        ]
      }
    }
    return candidates
      .map((option) => {
        const name = normalizeText(option.name ?? null)
        const label = name || `#${option.id}`
        return { value: String(option.id), label }
      })
      .sort((a, b) => optionCollator.compare(a.label, b.label))
  }, [
    memberOptions,
    member.id,
    member.name,
    member.nationality,
    member.username,
    selectedTeamKey,
    currentTeamKey,
    optionCollator,
  ])
  const selectedMemberId = selectedTeamKey === currentTeamKey ? String(member.id) : ''

  const handleTeamSelect = useCallback(
    (value: string) => {
      setSelectedTeamState({ memberId: member.id, value })
    },
    [member.id],
  )

  const handleMemberSelect = useCallback(
    (value: string) => {
      const nextId = Number(value)
      if (!nextId || nextId === member.id) return
      if (!isDirty) {
        router.push(`/members/${nextId}`)
        return
      }
      setPendingMemberId(nextId)
    },
    [isDirty, member.id, router],
  )

  const handleDiscardSwitch = useCallback(() => {
    if (pendingMemberId) {
      router.push(`/members/${pendingMemberId}`)
    }
    setPendingMemberId(null)
  }, [pendingMemberId, router])

  const handleCancelSwitch = useCallback(() => {
    setPendingMemberId(null)
  }, [])

  const handleSaveSwitch = useCallback(async () => {
    if (!pendingMemberId) return
    const ok = await submitForm()
    if (ok) {
      router.push(`/members/${pendingMemberId}`)
    }
    setPendingMemberId(null)
  }, [pendingMemberId, router, submitForm])

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

  const isChineseForm = formState.nationality === 'china'
  const canViewChineseProfile = isViewerChinese || member.nationality !== 'china'
  const phoneSummary = formState.phones.length
    ? `${formState.phones.length} ${t.form.phones}`
    : t.form.phonePlaceholder

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-10 sm:px-8 xl:max-w-[1500px] xl:px-12 2xl:max-w-[1700px] 2xl:px-14">
        <MemberEditHeader
          t={t}
          locale={locale}
          onLocaleChange={setLocale}
          teamOptions={teamSelectOptions}
          memberOptions={memberSelectOptions}
          selectedTeam={selectedTeam}
          selectedMemberId={selectedMemberId}
          onTeamSelect={handleTeamSelect}
          onMemberSelect={handleMemberSelect}
        />

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <BasicInfoSection
              t={t}
              locale={locale}
              formState={formState}
              setFormState={setFormState}
              nationalityByRegion={nationalityByRegion}
              phoneSummary={phoneSummary}
              phoneInput={phoneInput}
              onPhoneInputChange={setPhoneInput}
              onAddPhone={addPhoneFromInput}
              onRemovePhone={removePhone}
              showPhonePicker={showPhonePicker}
              onTogglePhonePicker={() => setShowPhonePicker((prev) => !prev)}
              phonePickerRef={phonePickerRef}
            />

            <EmploymentSection
              t={t}
              statusLabels={statusLabels}
              formState={formState}
              setFormState={setFormState}
              projectOptions={projectOptions}
            />

            <ProfileSection
              t={t}
              locale={locale}
              isChineseForm={isChineseForm}
              canViewChineseProfile={canViewChineseProfile}
              profileExpanded={profileExpanded}
              onToggleExpanded={() => setProfileExpanded((prev) => !prev)}
              formState={formState}
              setFormState={setFormState}
              teamOptions={teamOptions}
              teamSupervisorMap={teamSupervisorMap}
              salaryCategoryOptions={salaryCategoryOptions}
              maritalStatusOptions={maritalStatusOptions}
              provenanceOptions={provenanceOptions}
            />

            <SignatureSection
              t={t}
              memberId={member.id}
              canViewSignature={canViewSignature}
              canUploadSignature={canUploadSignature}
              canDeleteSignature={canDeleteSignature}
            />

            {isViewerChinese || member.nationality !== 'china' ? (
              <CompensationSection
                t={t}
                locale={locale}
                userId={member.id}
                formState={formState}
                teamOptions={teamOptions}
                teamSupervisorMap={teamSupervisorMap}
                onApplyExpatProfile={(patch) =>
                  setFormState((prev) => ({
                    ...prev,
                    expatProfile: { ...prev.expatProfile, ...patch },
                  }))
                }
                onApplyJoinDate={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    joinDate: value,
                  }))
                }
                onApplyPosition={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    position: value,
                  }))
                }
              />
            ) : null}

            <RoleSelector
              t={t}
              rolesData={rolesData}
              roleIds={formState.roleIds}
              onToggleRole={toggleRole}
              canAssignRole={canAssignRole}
            />

            <FormActions
              t={t}
              submitting={submitting}
              actionError={actionError}
              skipChangeHistory={formState.skipChangeHistory}
              onToggleSkipChangeHistory={
                canDeleteMember
                  ? (value) => setFormState((prev) => ({ ...prev, skipChangeHistory: value }))
                  : undefined
              }
            />
          </form>
        </div>
      </div>
      <UnsavedChangesDialog
        open={pendingMemberId !== null}
        title={t.labels.unsavedTitle}
        description={t.labels.unsavedDescription}
        badge={t.labels.unsavedBadge}
        onSave={handleSaveSwitch}
        onDiscard={handleDiscardSwitch}
        onCancel={handleCancelSwitch}
        saveLabel={t.actions.saveAndSwitch}
        discardLabel={t.actions.discardAndSwitch}
        cancelLabel={t.actions.cancel}
        submitting={submitting}
      />
    </main>
  )
}
