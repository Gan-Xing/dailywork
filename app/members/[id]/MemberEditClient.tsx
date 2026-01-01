'use client'

import { useMemo } from 'react'

import {
  employmentStatusLabels,
  memberCopy,
  nationalityOptions,
  type NationalityOption,
  type NationalityRegion,
} from '@/lib/i18n/members'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import { BasicInfoSection } from './components/BasicInfoSection'
import { EmploymentSection } from './components/EmploymentSection'
import { FormActions } from './components/FormActions'
import { MemberEditHeader } from './components/MemberEditHeader'
import { ProfileSection } from './components/ProfileSection'
import { RoleSelector } from './components/RoleSelector'
import { useMemberEditData } from './hooks/useMemberEditData'
import { useMemberEditForm } from './hooks/useMemberEditForm'
import { useTeamSupervisors } from '../hooks/useTeamSupervisors'
import { useProjects } from '../hooks/useProjects'
import { CompensationSection } from './modules/compensation/CompensationSection'
import type { Member } from './types'

type Props = {
  member: Member
  canAssignRole: boolean
}

export function MemberEditClient({ member, canAssignRole }: Props) {
  const { locale, setLocale } = usePreferredLocale()
  const t = memberCopy[locale]
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
    toggleRole,
    addPhoneFromInput,
    removePhone,
    handleSubmit,
  } = useMemberEditForm({ member, canAssignRole, t })
  const { rolesData, teamOptions } = useMemberEditData({
    locale,
    canAssignRole,
    currentTeam: formState.expatProfile.team,
  })
  const { teamSupervisorMap } = useTeamSupervisors()
  const { projectOptions } = useProjects()

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
  const displayName = formState.name || formState.username
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
          displayName={displayName}
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
              isChineseForm={isChineseForm}
              profileExpanded={profileExpanded}
              onToggleExpanded={() => setProfileExpanded((prev) => !prev)}
              formState={formState}
              setFormState={setFormState}
              teamOptions={teamOptions}
              teamSupervisorMap={teamSupervisorMap}
            />

            {!isChineseForm ? (
              <CompensationSection
                t={t}
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
              onToggleSkipChangeHistory={(value) =>
                setFormState((prev) => ({ ...prev, skipChangeHistory: value }))
              }
            />
          </form>
        </div>
      </div>
    </main>
  )
}
