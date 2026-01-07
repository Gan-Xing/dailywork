import { useEffect, type Dispatch, type SetStateAction } from 'react'

import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { normalizeTeamKey, resolveTeamDisplayName, resolveTeamInputValue } from '@/lib/members/utils'

import type { FormState } from '../types'
import type { TeamSupervisorItem } from '../../hooks/useTeamSupervisors'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ExpatProfileFieldsProps = {
  t: MemberCopy
  locale: Locale
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  teamOptions: string[]
  teamSupervisorMap: Map<string, TeamSupervisorItem>
  salaryCategoryOptions: string[]
  maritalStatusOptions: string[]
  provenanceOptions: string[]
}

export function ExpatProfileFields({
  t,
  locale,
  formState,
  setFormState,
  teamOptions,
  teamSupervisorMap,
  salaryCategoryOptions,
  maritalStatusOptions,
  provenanceOptions,
}: ExpatProfileFieldsProps) {
  useEffect(() => {
    const teamKey = normalizeTeamKey(formState.expatProfile.team)
    if (!teamKey) return
    const binding = teamSupervisorMap.get(teamKey)
    if (!binding) return
    const nextSupervisorId = String(binding.supervisorId)
    const nextProjectId = binding.project?.id ? String(binding.project.id) : ''
    const shouldUpdateSupervisor = formState.expatProfile.chineseSupervisorId !== nextSupervisorId
    const shouldUpdateProject = !formState.projectId && nextProjectId
    if (!shouldUpdateSupervisor && !shouldUpdateProject) return
    setFormState((prev) => ({
      ...prev,
      projectId: shouldUpdateProject ? nextProjectId : prev.projectId,
      expatProfile: {
        ...prev.expatProfile,
        chineseSupervisorId: shouldUpdateSupervisor
          ? nextSupervisorId
          : prev.expatProfile.chineseSupervisorId,
      },
    }))
  }, [
    formState.expatProfile.team,
    formState.expatProfile.chineseSupervisorId,
    formState.projectId,
    setFormState,
    teamSupervisorMap,
  ])

  const teamSupervisorBinding = teamSupervisorMap.get(
    normalizeTeamKey(formState.expatProfile.team),
  )
  const supervisorLabel = teamSupervisorBinding?.supervisorLabel ?? ''
  const hasTeamSupervisor = Boolean(teamSupervisorBinding)
  const showMissingSupervisor =
    Boolean(normalizeTeamKey(formState.expatProfile.team)) && !hasTeamSupervisor

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm text-slate-700">
        <span className="block font-semibold">{t.form.team}</span>
        <input
          list="team-options"
          value={
            resolveTeamDisplayName(
              formState.expatProfile.team,
              locale,
              teamSupervisorMap,
            ) || formState.expatProfile.team
          }
          onChange={(event) => {
            const input = event.target.value
            const nextTeam = resolveTeamInputValue(input, locale, teamSupervisorMap)
            const binding = teamSupervisorMap.get(normalizeTeamKey(nextTeam))
            setFormState((prev) => ({
              ...prev,
              expatProfile: {
                ...prev.expatProfile,
                team: nextTeam,
                chineseSupervisorId: binding ? String(binding.supervisorId) : '',
              },
              projectId: binding?.project?.id ? String(binding.project.id) : '',
            }))
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <datalist id="team-options">
          {teamOptions.map((name) => (
            <option
              key={name}
              value={resolveTeamDisplayName(name, locale, teamSupervisorMap) || name}
            />
          ))}
        </datalist>
      </label>
      <label className="space-y-1 text-sm text-slate-700">
        <span className="block font-semibold">{t.form.chineseSupervisor}</span>
        <div
          className={`w-full rounded-xl border px-3 py-2 text-sm shadow-sm ${
            showMissingSupervisor
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {showMissingSupervisor ? t.teamSupervisor.missing : supervisorLabel || t.labels.empty}
        </div>
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
              const nextType = event.target.value as FormState['expatProfile']['contractType']
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
        <span className="block font-semibold">{t.form.contractStartDate}</span>
        <input
          type="date"
          value={formState.expatProfile.contractStartDate}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, contractStartDate: event.target.value },
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <label className="space-y-1 text-sm text-slate-700">
        <span className="block font-semibold">{t.form.contractEndDate}</span>
        <input
          type="date"
          value={formState.expatProfile.contractEndDate}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, contractEndDate: event.target.value },
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <label className="space-y-1 text-sm text-slate-700">
        <span className="block font-semibold">{t.form.salaryCategory}</span>
        <input
          list="salary-category-options"
          value={formState.expatProfile.salaryCategory}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, salaryCategory: event.target.value },
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <datalist id="salary-category-options">
          {salaryCategoryOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </label>
      <label className="space-y-1 text-sm text-slate-700">
        <span className="block font-semibold">{t.form.prime}</span>
        <input
          type="number"
          inputMode="decimal"
          value={formState.expatProfile.prime}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, prime: event.target.value },
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
                baseSalaryUnit: event.target.value as FormState['expatProfile']['baseSalaryUnit'],
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
                netMonthlyUnit: event.target.value as FormState['expatProfile']['netMonthlyUnit'],
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
          list="marital-status-options"
          value={formState.expatProfile.maritalStatus}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, maritalStatus: event.target.value },
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <datalist id="marital-status-options">
          {maritalStatusOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
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
          list="provenance-options"
          value={formState.expatProfile.provenance}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              expatProfile: { ...prev.expatProfile, provenance: event.target.value },
            }))
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <datalist id="provenance-options">
          {provenanceOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
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
}
