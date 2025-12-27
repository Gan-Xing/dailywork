import { memberCopy } from '@/lib/i18n/members'
import type { PayrollPayout } from './types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type PayrollPayoutTableProps = {
  t: MemberCopy
  loading: boolean
  records: PayrollPayout[]
}

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '')

export function PayrollPayoutTable({
  t,
  loading,
  records,
}: PayrollPayoutTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{t.compensation.payrollPayouts}</h4>
          <p className="text-xs text-slate-500">{t.payroll.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-2">{t.compensation.fields.payoutDate}</th>
              <th className="py-2">{t.compensation.fields.amount}</th>
              <th className="py-2">{t.compensation.fields.currency}</th>
              <th className="py-2">{t.compensation.fields.team}</th>
              <th className="py-2">{t.compensation.fields.chineseSupervisor}</th>
              <th className="py-2">{t.compensation.fields.note}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm text-slate-400">
                  {t.feedback.emptyHistory}
                </td>
              </tr>
            ) : null}
            {records.map((record) => (
              <tr key={record.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3">{formatDate(record.payoutDate) || t.labels.empty}</td>
                <td className="py-3 font-medium">{record.amount}</td>
                <td className="py-3">{record.currency || 'XOF'}</td>
                <td className="py-3">{record.team || t.labels.empty}</td>
                <td className="py-3">{record.chineseSupervisorName || t.labels.empty}</td>
                <td className="py-3 text-slate-500">{record.note || t.labels.empty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
