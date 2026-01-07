'use client'

type UnsavedChangesDialogProps = {
  open: boolean
  title: string
  description: string
  badge?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  saveLabel: string
  discardLabel: string
  cancelLabel: string
  submitting?: boolean
}

export function UnsavedChangesDialog({
  open,
  title,
  description,
  badge,
  onSave,
  onDiscard,
  onCancel,
  saveLabel,
  discardLabel,
  cancelLabel,
  submitting = false,
}: UnsavedChangesDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/30 bg-slate-900 shadow-2xl shadow-amber-400/30 ring-1 ring-white/5">
        <div className="bg-gradient-to-r from-amber-400/25 via-orange-300/20 to-rose-300/20 p-4">
          {badge ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/90">
              {badge}
            </p>
          ) : null}
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-50/90">{description}</p>
        </div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-50 shadow-inner shadow-slate-900/40 transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/30 bg-rose-100/10 px-4 py-2 text-sm font-semibold text-rose-100 shadow-inner shadow-rose-900/30 transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {discardLabel}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-400/35 transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
