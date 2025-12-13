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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !deletingId) {
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-50">{t.delete.title}</p>
            <p className="text-sm font-semibold text-slate-100">
              {formatProgressCopy(t.delete.confirmPrompt, { name: phase.name })}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
            onClick={() => {
              if (deletingId) return
              onCancel()
            }}
            aria-label={t.delete.close}
          >
            ×
          </button>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <p>{t.delete.impactTitle}</p>
          <ul className="space-y-1">
            {t.delete.impactList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {deleteError ? <p className="mt-3 text-sm text-amber-200">{deleteError}</p> : null}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
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
            className="inline-flex items-center justify-center rounded-xl border border-red-300/80 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-100 shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-red-500/20 hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-70"
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
