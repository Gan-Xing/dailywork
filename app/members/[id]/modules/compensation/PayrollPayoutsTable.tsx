import { useMemo, useState } from 'react'

import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { normalizeTeamKey, resolveTeamDisplayName, resolveTeamInputValue } from '@/lib/members/utils'

import type { FormState } from '../../types'
import type { TeamSupervisorItem } from '../../../hooks/useTeamSupervisors'
import { CompensationModal } from './CompensationModal'
import type { PayrollPayout } from './types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type PayrollPayoutForm = {
  payoutDate: string
  amount: string
  currency: string
  note: string
  team: string
  chineseSupervisorId: string
}

type PayrollPayoutsTableProps = {
  t: MemberCopy
  locale: Locale
  userId: number
  loading: boolean
  records: PayrollPayout[]
  expatProfile: FormState['expatProfile']
  teamOptions: string[]
  teamSupervisorMap: Map<string, TeamSupervisorItem>
  onRefresh: () => void
}

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '')

const buildDefaults = (
  profile: FormState['expatProfile'],
  teamSupervisorMap: Map<string, TeamSupervisorItem>,
): PayrollPayoutForm => {
  const teamKey = normalizeTeamKey(profile.team)
  const binding = teamKey ? teamSupervisorMap.get(teamKey) : null
  return {
    payoutDate: formatDate(new Date().toISOString()),
    amount: '',
    currency: 'XOF',
    note: '',
    team: profile.team,
    chineseSupervisorId: binding ? String(binding.supervisorId) : profile.chineseSupervisorId,
  }
}

export function PayrollPayoutsTable({
  t,
  locale,
  userId,
  loading,
  records,
  expatProfile,
  teamOptions,
  teamSupervisorMap,
  onRefresh,
}: PayrollPayoutsTableProps) {
  const resolveTeamLabel = (team?: string | null) =>
    resolveTeamDisplayName(team ?? null, locale, teamSupervisorMap)
  const defaultForm = useMemo(
    () => buildDefaults(expatProfile, teamSupervisorMap),
    [expatProfile, teamSupervisorMap],
  )
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PayrollPayout | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formState, setFormState] = useState<PayrollPayoutForm>(defaultForm)
  const currentBinding = teamSupervisorMap.get(normalizeTeamKey(formState.team))
  const supervisorLabel = currentBinding?.supervisorLabel ?? ''
  const showMissingSupervisor =
    Boolean(normalizeTeamKey(formState.team)) && !currentBinding

  const openCreate = () => {
    setEditing(null)
    setFormState(defaultForm)
    setOpen(true)
  }

  const openEdit = (record: PayrollPayout) => {
    setEditing(record)
    const binding = teamSupervisorMap.get(normalizeTeamKey(record.team))
    setFormState({
      payoutDate: formatDate(record.payoutDate),
      amount: record.amount,
      currency: record.currency,
      note: record.note ?? '',
      team: record.team ?? '',
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
          ? `/api/members/${userId}/payroll-payouts/${editing.id}`
          : `/api/members/${userId}/payroll-payouts`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        throw new Error((await res.json()).error ?? t.feedback.submitError)
      }
      await onRefresh()
      setOpen(false)
    } catch {
      setOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteRecord = async (record: PayrollPayout) => {
    if (!confirm(`${t.compensation.actions.delete}: ${record.payoutDate.slice(0, 10)}`)) {
      return
    }
    const res = await fetch(`/api/members/${userId}/payroll-payouts/${record.id}`, {
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
          <h4 className="text-sm font-semibold text-slate-800">{t.compensation.payrollPayouts}</h4>
          <p className="text-xs text-slate-500">{t.compensation.fields.amount}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {t.compensation.addPayrollPayout}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-2">{t.compensation.fields.payoutDate}</th>
              <th className="py-2">{t.compensation.fields.amount}</th>
              <th className="py-2">{t.compensation.fields.currency}</th>
              <th className="py-2">{t.compensation.fields.note}</th>
              <th className="py-2">{t.compensation.fields.team}</th>
              <th className="py-2">{t.compensation.fields.chineseSupervisor}</th>
              <th className="py-2">{t.table.actions}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-sm text-slate-400">
                  {t.feedback.empty}
                </td>
              </tr>
            ) : null}
            {records.map((record) => (
              <tr key={record.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3">{formatDate(record.payoutDate) || t.labels.empty}</td>
                <td className="py-3">{record.amount || t.labels.empty}</td>
                <td className="py-3">{record.currency || t.labels.empty}</td>
                <td className="py-3">{record.note || t.labels.empty}</td>
                <td className="py-3">{resolveTeamLabel(record.team) || t.labels.empty}</td>
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
        title={editing ? t.compensation.editPayrollPayout : t.compensation.addPayrollPayout}
        closeLabel={t.labels.close}
        onClose={closeModal}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.payoutDate}</span>
            <input
              type="date"
              value={formState.payoutDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, payoutDate: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.amount}</span>
            <input
              type="number"
              inputMode="decimal"
              value={formState.amount}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, amount: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.currency}</span>
            <input
              value={formState.currency}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, currency: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.team}</span>
            <input
              list="payout-team-options"
              value={resolveTeamDisplayName(formState.team, locale, teamSupervisorMap) || formState.team}
              onChange={(event) => {
                const input = event.target.value
                const nextTeam = resolveTeamInputValue(input, locale, teamSupervisorMap)
                const binding = teamSupervisorMap.get(normalizeTeamKey(nextTeam))
                setFormState((prev) => ({
                  ...prev,
                  team: nextTeam,
                  chineseSupervisorId: binding ? String(binding.supervisorId) : '',
                }))
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <datalist id="payout-team-options">
              {teamOptions.map((name) => (
                <option
                  key={name}
                  value={resolveTeamDisplayName(name, locale, teamSupervisorMap) || name}
                />
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
          <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
            <span className="block font-semibold">{t.compensation.fields.note}</span>
            <textarea
              rows={2}
              value={formState.note}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, note: event.target.value }))
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
