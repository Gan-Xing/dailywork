import type { Dispatch, SetStateAction } from 'react'

import { memberCopy } from '@/lib/i18n/members'

import type { FormState } from '../types'
import { ChineseProfileFields } from './ChineseProfileFields'
import { ExpatProfileFields } from './ExpatProfileFields'
import type { TeamSupervisorItem } from '../../hooks/useTeamSupervisors'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ProfileSectionProps = {
  t: MemberCopy
  isChineseForm: boolean
  profileExpanded: boolean
  onToggleExpanded: () => void
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  teamOptions: string[]
  teamSupervisorMap: Map<string, TeamSupervisorItem>
}

export function ProfileSection({
  t,
  isChineseForm,
  profileExpanded,
  onToggleExpanded,
  formState,
  setFormState,
  teamOptions,
  teamSupervisorMap,
}: ProfileSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={onToggleExpanded}
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
          <ChineseProfileFields t={t} formState={formState} setFormState={setFormState} />
        ) : (
          <ExpatProfileFields
            t={t}
            formState={formState}
            setFormState={setFormState}
            teamOptions={teamOptions}
            teamSupervisorMap={teamSupervisorMap}
          />
        )
      ) : null}
    </div>
  )
}
