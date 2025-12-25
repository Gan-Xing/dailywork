import type { Dispatch, SetStateAction } from 'react'

import { memberCopy } from '@/lib/i18n/members'

import type { FormState } from '../types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ExpatProfileFieldsProps = {
  t: MemberCopy
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  teamOptions: string[]
}

export function ExpatProfileFields({
  t,
  formState,
  setFormState,
  teamOptions,
}: ExpatProfileFieldsProps) {
  return (
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
}
