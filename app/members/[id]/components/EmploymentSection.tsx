import type { Dispatch, SetStateAction } from 'react'

import { memberCopy, type EmploymentStatus } from '@/lib/i18n/members'

import type { FormState } from '../types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type EmploymentSectionProps = {
  t: MemberCopy
  statusLabels: Record<EmploymentStatus, string>
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  projectOptions: { value: string; label: string }[]
}

export function EmploymentSection({
  t,
  statusLabels,
  formState,
  setFormState,
  projectOptions,
}: EmploymentSectionProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
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
                  ...(nextStatus === 'TERMINATED' ? {} : { terminationDate: '', terminationReason: '' }),
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
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block font-semibold">{t.form.project}</span>
          <select
            value={formState.projectId}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, projectId: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          >
            <option value="">{t.labels.empty}</option>
            {projectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
    </>
  )
}
