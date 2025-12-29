import Link from 'next/link'

import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type FormActionsProps = {
  t: MemberCopy
  submitting: boolean
  actionError: string | null
  skipChangeHistory?: boolean
  onToggleSkipChangeHistory?: (value: boolean) => void
}

export function FormActions({
  t,
  submitting,
  actionError,
  skipChangeHistory,
  onToggleSkipChangeHistory,
}: FormActionsProps) {
  return (
    <>
      {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        {onToggleSkipChangeHistory ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(skipChangeHistory)}
              onChange={(event) => onToggleSkipChangeHistory(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>{t.form.skipChangeHistory}</span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Link
            href="/members"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t.actions.cancel}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t.actions.saveChanges}
          </button>
        </div>
      </div>
    </>
  )
}
