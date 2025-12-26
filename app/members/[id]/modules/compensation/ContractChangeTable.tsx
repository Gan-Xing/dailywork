import { useMemo, useState } from 'react'

import { memberCopy } from '@/lib/i18n/members'

import type { ExpatProfileForm, FormState } from '../../types'
import { CompensationModal } from './CompensationModal'
import type { ContractChange, SupervisorOption } from './types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ContractChangeForm = {
  contractNumber: string
  contractType: '' | 'CTJ' | 'CDD'
  salaryCategory: string
  salaryAmount: string
  salaryUnit: '' | 'MONTH' | 'HOUR'
  prime: string
  startDate: string
  endDate: string
  changeDate: string
  reason: string
  chineseSupervisorId: string
}

type ContractChangeTableProps = {
  t: MemberCopy
  userId: number
  loading: boolean
  records: ContractChange[]
  expatProfile: FormState['expatProfile']
  chineseSupervisorOptions: SupervisorOption[]
  onRefresh: () => void
}

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '')

const buildDefaults = (profile: ExpatProfileForm): ContractChangeForm => ({
  contractNumber: profile.contractNumber,
  contractType: profile.contractType,
  salaryCategory: profile.salaryCategory,
  salaryAmount: profile.baseSalaryAmount,
  salaryUnit: profile.baseSalaryUnit,
  prime: profile.prime,
  startDate: '',
  endDate: '',
  changeDate: formatDate(new Date().toISOString()),
  reason: '',
  chineseSupervisorId: profile.chineseSupervisorId,
})

export function ContractChangeTable({
  t,
  userId,
  loading,
  records,
  expatProfile,
  chineseSupervisorOptions,
  onRefresh,
}: ContractChangeTableProps) {
  const defaultForm = useMemo(() => buildDefaults(expatProfile), [expatProfile])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContractChange | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formState, setFormState] = useState<ContractChangeForm>(defaultForm)

  const openCreate = () => {
    setEditing(null)
    setFormState(defaultForm)
    setOpen(true)
  }

  const openEdit = (record: ContractChange) => {
    setEditing(record)
    setFormState({
      contractNumber: record.contractNumber ?? '',
      contractType: record.contractType ?? '',
      salaryCategory: record.salaryCategory ?? '',
      salaryAmount: record.salaryAmount ?? '',
      salaryUnit: record.salaryUnit ?? '',
      prime: record.prime ?? '',
      startDate: formatDate(record.startDate),
      endDate: formatDate(record.endDate),
      changeDate: formatDate(record.changeDate),
      reason: record.reason ?? '',
      chineseSupervisorId: record.chineseSupervisorId ? String(record.chineseSupervisorId) : '',
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
          ? `/api/members/${userId}/contract-changes/${editing.id}`
          : `/api/members/${userId}/contract-changes`,
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

  const deleteRecord = async (record: ContractChange) => {
    if (!confirm(`${t.compensation.actions.delete}: ${record.contractNumber ?? record.id}`)) {
      return
    }
    const res = await fetch(`/api/members/${userId}/contract-changes/${record.id}`, {
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
          <h4 className="text-sm font-semibold text-slate-800">{t.compensation.contractChanges}</h4>
          <p className="text-xs text-slate-500">{t.form.contractNumber}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {t.compensation.addContractChange}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-2">{t.compensation.fields.changeDate}</th>
              <th className="py-2">{t.form.contractNumber}</th>
              <th className="py-2">{t.form.contractType}</th>
              <th className="py-2">{t.form.salaryCategory}</th>
              <th className="py-2">{t.form.baseSalaryAmount}</th>
              <th className="py-2">{t.form.baseSalaryUnit}</th>
              <th className="py-2">{t.form.prime}</th>
              <th className="py-2">{t.compensation.fields.startDate}</th>
              <th className="py-2">{t.compensation.fields.endDate}</th>
              <th className="py-2">{t.compensation.fields.chineseSupervisor}</th>
              <th className="py-2">{t.compensation.fields.reason}</th>
              <th className="py-2">{t.table.actions}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={12} className="py-4 text-center text-sm text-slate-400">
                  {t.feedback.empty}
                </td>
              </tr>
            ) : null}
            {records.map((record) => (
              <tr key={record.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3">{formatDate(record.changeDate) || t.labels.empty}</td>
                <td className="py-3">{record.contractNumber || t.labels.empty}</td>
                <td className="py-3">{record.contractType || t.labels.empty}</td>
                <td className="py-3">{record.salaryCategory || t.labels.empty}</td>
                <td className="py-3">{record.salaryAmount || t.labels.empty}</td>
                <td className="py-3">{record.salaryUnit || t.labels.empty}</td>
                <td className="py-3">{record.prime || t.labels.empty}</td>
                <td className="py-3">{formatDate(record.startDate) || t.labels.empty}</td>
                <td className="py-3">{formatDate(record.endDate) || t.labels.empty}</td>
                <td className="py-3">{record.chineseSupervisorName || t.labels.empty}</td>
                <td className="py-3">{record.reason || t.labels.empty}</td>
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
        title={editing ? t.compensation.editContractChange : t.compensation.addContractChange}
        closeLabel={t.labels.close}
        onClose={closeModal}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.contractNumber}</span>
            <input
              value={formState.contractNumber}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, contractNumber: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.contractType}</span>
            <select
              value={formState.contractType}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  contractType: event.target.value as ContractChangeForm['contractType'],
                }))
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
              value={formState.salaryCategory}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, salaryCategory: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.baseSalaryAmount}</span>
            <input
              type="number"
              inputMode="decimal"
              value={formState.salaryAmount}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, salaryAmount: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.form.baseSalaryUnit}</span>
            <select
              value={formState.salaryUnit}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  salaryUnit: event.target.value as ContractChangeForm['salaryUnit'],
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
            <span className="block font-semibold">{t.compensation.fields.startDate}</span>
            <input
              type="date"
              value={formState.startDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, startDate: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.endDate}</span>
            <input
              type="date"
              value={formState.endDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, endDate: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
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
          <label className="space-y-1 text-sm text-slate-700">
            <span className="block font-semibold">{t.compensation.fields.chineseSupervisor}</span>
            <select
              value={formState.chineseSupervisorId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  chineseSupervisorId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">{t.labels.empty}</option>
              {chineseSupervisorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
            <span className="block font-semibold">{t.compensation.fields.reason}</span>
            <textarea
              rows={2}
              value={formState.reason}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, reason: event.target.value }))
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
