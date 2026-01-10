'use client'

import type { PhaseDTO } from '@/lib/progressTypes'
import type { getProgressCopy } from '@/lib/i18n/progress'
import { formatProgressCopy } from '@/lib/i18n/progress'

type PhaseCopy = ReturnType<typeof getProgressCopy>['phase']

export interface DeletePhaseDialogProps {
  open: boolean
  phase: PhaseDTO | null
  t: PhaseCopy
  deleteError: string | null
  deletingId: number | null
  onCancel: () => void
  onConfirm: () => void
}

export function DeletePhaseDialog({ open, phase, t, deleteError, deletingId, onCancel, onConfirm }: DeletePhaseDialogProps) {
  if (!open || !phase) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !deletingId) {
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">{t.delete.title}</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatProgressCopy(t.delete.confirmPrompt, { name: phase.name })}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              if (deletingId) return
              onCancel()
            }}
            aria-label={t.delete.close}
          >
            ×
          </button>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p>{t.delete.impactTitle}</p>
          <ul className="space-y-1">
            {t.delete.impactList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {deleteError ? <p className="mt-3 text-sm text-amber-700">{deleteError}</p> : null}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => {
              if (deletingId) return
              onCancel()
            }}
            disabled={Boolean(deletingId)}
          >
            {t.delete.cancel}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onConfirm}
            disabled={deletingId === phase.id}
          >
            {deletingId === phase.id ? t.delete.confirming : t.delete.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
