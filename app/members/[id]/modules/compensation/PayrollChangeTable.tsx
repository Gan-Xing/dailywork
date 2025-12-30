import { useMemo, useState } from 'react'

import { memberCopy } from '@/lib/i18n/members'
import { normalizeTeamKey } from '@/lib/members/utils'

import type { FormState } from '../../types'
import type { TeamSupervisorItem } from '../../../hooks/useTeamSupervisors'
import { CompensationModal } from './CompensationModal'
import type { PayrollChange } from './types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type PayrollChangeForm = {
  salaryCategory: string
  prime: string
  baseSalaryAmount: string
  baseSalaryUnit: '' | 'MONTH' | 'HOUR'
  netMonthlyAmount: string
  netMonthlyUnit: '' | 'MONTH' | 'HOUR'
  team: string
  changeDate: string
  chineseSupervisorId: string
}

type PayrollChangeTableProps = {
  t: MemberCopy
  userId: number
  loading: boolean
  records: PayrollChange[]
  expatProfile: FormState['expatProfile']
  teamOptions: string[]
  teamSupervisorMap: Map<string, TeamSupervisorItem>
  onRefresh: () => void
  onApplyExpatProfile: (patch: Partial<FormState['expatProfile']>) => void
}

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '')

const buildDefaults = (
  profile: FormState['expatProfile'],
  teamSupervisorMap: Map<string, TeamSupervisorItem>,
): PayrollChangeForm => {
  const teamKey = normalizeTeamKey(profile.team)
  const binding = teamKey ? teamSupervisorMap.get(teamKey) : null
  return {
    salaryCategory: profile.salaryCategory,
    prime: profile.prime,
    baseSalaryAmount: profile.baseSalaryAmount,
    baseSalaryUnit: profile.baseSalaryUnit,
    netMonthlyAmount: profile.netMonthlyAmount,
    netMonthlyUnit: profile.netMonthlyUnit,
    team: profile.team,
    changeDate: formatDate(new Date().toISOString()),
    chineseSupervisorId: binding ? String(binding.supervisorId) : profile.chineseSupervisorId,
  }
}

export function PayrollChangeTable({
  t,
  userId,
  loading,
  records,
  expatProfile,
  teamOptions,
  teamSupervisorMap,
  onRefresh,
  onApplyExpatProfile,
}: PayrollChangeTableProps) {
  const defaultForm = useMemo(
    () => buildDefaults(expatProfile, teamSupervisorMap),
    [expatProfile, teamSupervisorMap],
  )
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PayrollChange | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formState, setFormState] = useState<PayrollChangeForm>(defaultForm)
  const currentBinding = teamSupervisorMap.get(normalizeTeamKey(formState.team))
  const supervisorLabel = currentBinding?.supervisorLabel ?? ''
  const showMissingSupervisor =
    Boolean(normalizeTeamKey(formState.team)) && !currentBinding

  const openCreate = () => {
    setEditing(null)
    setFormState(defaultForm)
    setOpen(true)
  }

  const openEdit = (record: PayrollChange) => {
    setEditing(record)
    const binding = teamSupervisorMap.get(normalizeTeamKey(record.team))
    setFormState({
      salaryCategory: record.salaryCategory ?? '',
      prime: record.prime ?? '',
      baseSalaryAmount: record.baseSalaryAmount ?? '',
      baseSalaryUnit: record.baseSalaryUnit ?? '',
      netMonthlyAmount: record.netMonthlyAmount ?? '',
      netMonthlyUnit: record.netMonthlyUnit ?? '',
      team: record.team ?? '',
      changeDate: formatDate(record.changeDate),
      chineseSupervisorId: binding
        ? String(binding.supervisorId)
        : record.chineseSupervisorId
          ? String(record.chineseSupervisorId)
          : '',
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
  }

  const submitForm = async () => {
    setSubmitting(true)
    try {
      const payload = {
        ...formState,
        chineseSupervisorId: formState.chineseSupervisorId || null,
      }
      const res = await fetch(
        editing
          ? `/api/members/${userId}/payroll-changes/${editing.id}`
          : `/api/members/${userId}/payroll-changes`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        payrollChange?: PayrollChange
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? t.feedback.submitError)
      }
      if (data.payrollChange) {
        const change = data.payrollChange
        const netMonthlyUnit =
          change.netMonthlyUnit === 'MONTH' ? 'MONTH' : ''
        onApplyExpatProfile({
          salaryCategory: change.salaryCategory ?? '',
          prime: change.prime ?? '',
          baseSalaryAmount: change.baseSalaryAmount ?? change.salaryAmount ?? '',
          baseSalaryUnit: (change.baseSalaryUnit ?? change.salaryUnit ?? '') as FormState['expatProfile']['baseSalaryUnit'],
          netMonthlyAmount: change.netMonthlyAmount ?? '',
          netMonthlyUnit,
          team: change.team ?? '',
          chineseSupervisorId: change.chineseSupervisorId ? String(change.chineseSupervisorId) : '',
        })
      }
      await onRefresh()
      setOpen(false)
    } catch {
      setOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteRecord = async (record: PayrollChange) => {
    if (!confirm(`${t.compensation.actions.delete}: ${record.changeDate.slice(0, 10)}`)) {
      return
    }
    const res = await fetch(`/api/members/${userId}/payroll-changes/${record.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      onRefresh()
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{t.compensation.payrollChanges}</h4>
          <p className="text-xs text-slate-500">{t.form.baseSalaryAmount}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {t.compensation.addPayrollChange}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-2">{t.compensation.fields.changeDate}</th>
              <th className="py-2">{t.form.salaryCategory}</th>
              <th className="py-2">{t.form.prime}</th>
              <th className="py-2">{t.form.baseSalaryAmount}</th>
              <th className="py-2">{t.form.baseSalaryUnit}</th>
              <th className="py-2">{t.form.netMonthlyAmount}</th>
              <th className="py-2">{t.compensation.fields.team}</th>
              <th className="py-2">{t.compensation.fields.chineseSupervisor}</th>
              <th className="py-2">{t.table.actions}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} className="py-4 text-center text-sm text-slate-400">
                  {t.feedback.emptyHistory}
                </td>
              </tr>
            ) : null}
            {records.map((record) => (
              <tr key={record.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3">{formatDate(record.changeDate) || t.labels.empty}</td>
                <td className="py-3">{record.salaryCategory || t.labels.empty}</td>
                <td className="py-3">{record.prime || t.labels.empty}</td>
                <td className="py-3">{record.baseSalaryAmount || record.salaryAmount || t.labels.empty}</td>
                <td className="py-3">{record.baseSalaryUnit || record.salaryUnit || t.labels.empty}</td>
                <td className="py-3">{record.netMonthlyAmount || t.labels.empty}</td>
                <td className="py-3">{record.team || t.labels.empty}</td>
                <td className="py-3">{record.chineseSupervisorName || t.labels.empty}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(record)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      {t.compensation.actions.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRecord(record)}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                    >
                      {t.compensation.actions.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CompensationModal
        open={open}
        title={editing ? t.compensation.editPayrollChange : t.compensation.addPayrollChange}
        closeLabel={t.labels.close}
        onClose={closeModal}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.salaryCategory}</span>
            <input
              value={formState.salaryCategory}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, salaryCategory: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.prime}</span>
            <input
              type="number"
              inputMode="decimal"
              value={formState.prime}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, prime: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.baseSalaryAmount}</span>
            <input
              type="number"
              inputMode="decimal"
              value={formState.baseSalaryAmount}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, baseSalaryAmount: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.baseSalaryUnit}</span>
            <select
              value={formState.baseSalaryUnit}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  baseSalaryUnit: event.target.value as PayrollChangeForm['baseSalaryUnit'],
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
              value={formState.netMonthlyAmount}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, netMonthlyAmount: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.netMonthlyUnit}</span>
            <select
              value={formState.netMonthlyUnit}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  netMonthlyUnit: event.target.value as PayrollChangeForm['netMonthlyUnit'],
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">{t.labels.empty}</option>
              <option value="MONTH">{t.form.salaryUnitMonth}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.team}</span>
            <input
              list="payroll-team-options"
              value={formState.team}
              onChange={(event) => {
                const nextTeam = event.target.value
                const binding = teamSupervisorMap.get(normalizeTeamKey(nextTeam))
                setFormState((prev) => ({
                  ...prev,
                  team: nextTeam,
                  chineseSupervisorId: binding ? String(binding.supervisorId) : '',
                }))
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <datalist id="payroll-team-options">
              {teamOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.chineseSupervisor}</span>
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
            <span className="block font-semibold">{t.compensation.fields.changeDate}</span>
            <input
              type="date"
              value={formState.changeDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, changeDate: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              {t.compensation.actions.cancel}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (!submitting) void submitForm()
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {t.compensation.actions.save}
            </button>
          </div>
        </div>
      </CompensationModal>
    </div>
  )
}
