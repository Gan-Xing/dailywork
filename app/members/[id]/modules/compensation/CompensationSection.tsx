import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { memberCopy } from '@/lib/i18n/members'

import type { FormState } from '../../types'

import { ContractChangeTable } from './ContractChangeTable'
import { PayrollChangeTable } from './PayrollChangeTable'
import type { ContractChange, PayrollChange, SupervisorOption } from './types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type CompensationSectionProps = {
  t: MemberCopy
  userId: number
  formState: FormState
  teamOptions: string[]
  chineseSupervisorOptions: SupervisorOption[]
}

export function CompensationSection({
  t,
  userId,
  formState,
  teamOptions,
  chineseSupervisorOptions,
}: CompensationSectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contractChanges, setContractChanges] = useState<ContractChange[]>([])
  const [payrollChanges, setPayrollChanges] = useState<PayrollChange[]>([])

  const loadCompensation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/members/${userId}/compensation`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.loadError)
      }
      const data = (await res.json()) as {
        contractChanges?: ContractChange[]
        payrollChanges?: PayrollChange[]
      }
      setContractChanges(Array.isArray(data.contractChanges) ? data.contractChanges : [])
      setPayrollChanges(Array.isArray(data.payrollChanges) ? data.payrollChanges : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t.feedback.loadError)
    } finally {
      setLoading(false)
    }
  }, [t.feedback.loadError, userId])

  useEffect(() => {
    void loadCompensation()
  }, [loadCompensation])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t.compensation.title}
          </p>
          <p className="text-xs text-slate-500">{t.editSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadCompensation}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          {t.compensation.actions.refresh}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6">
        <ContractChangeTable
          t={t}
          userId={userId}
          loading={loading}
          records={contractChanges}
          onRefresh={loadCompensation}
          expatProfile={formState.expatProfile}
          chineseSupervisorOptions={chineseSupervisorOptions}
        />
        <PayrollChangeTable
          t={t}
          userId={userId}
          loading={loading}
          records={payrollChanges}
          onRefresh={loadCompensation}
          expatProfile={formState.expatProfile}
          teamOptions={teamOptions}
          chineseSupervisorOptions={chineseSupervisorOptions}
        />
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{t.compensation.payrollPayouts}</h4>
              <p className="text-xs text-slate-500">{t.payroll.subtitle}</p>
            </div>
            <Link
              href="/members?tab=payroll"
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              {t.payroll.title}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
