'use client'

import type { ReactNode } from 'react'

export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

type AlertDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  tone?: AlertTone
  actionLabel?: string
  badge?: string
  cancelLabel?: string
  onAction?: () => void
  onCancel?: () => void
}

const toneStyles: Record<
  AlertTone,
  { badge: string; header: string; button: string; border: string; shadow: string }
> = {
  info: {
    badge: '提示',
    header: 'from-cyan-400/20 via-emerald-300/20 to-sky-300/15',
    button: 'from-cyan-300 via-emerald-200 to-sky-300',
    border: 'border-cyan-200/30',
    shadow: 'shadow-cyan-400/30',
  },
  warning: {
    badge: '提醒',
    header: 'from-amber-400/25 via-orange-300/20 to-rose-300/20',
    button: 'from-amber-200 via-orange-200 to-rose-200',
    border: 'border-amber-200/30',
    shadow: 'shadow-amber-400/30',
  },
  danger: {
    badge: '警告',
    header: 'from-rose-400/25 via-red-300/20 to-orange-300/20',
    button: 'from-rose-200 via-red-200 to-orange-200',
    border: 'border-rose-200/35',
    shadow: 'shadow-rose-400/40',
  },
  success: {
    badge: '完成',
    header: 'from-emerald-300/25 via-lime-300/20 to-teal-300/20',
    button: 'from-emerald-200 via-lime-200 to-teal-200',
    border: 'border-emerald-200/35',
    shadow: 'shadow-emerald-400/35',
  },
}

export function AlertDialog({
  open,
  title,
  description,
  onClose,
  tone = 'info',
  actionLabel = '好的',
  badge,
  cancelLabel,
  onAction,
  onCancel,
}: AlertDialogProps) {
  if (!open) return null
  const style = toneStyles[tone]

  const handlePrimary = () => {
    onAction?.()
    onClose()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur"
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-3xl border ${style.border} bg-slate-900 shadow-2xl ${style.shadow} ring-1 ring-white/5`}
      >
        <div className={`bg-gradient-to-r ${style.header} p-4`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/90">
            {badge ?? style.badge}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-50/90">{description}</p> : null}
        </div>
        <div className="p-5">
          <div className={cancelLabel ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-3'}>
            {cancelLabel ? (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-50 shadow-inner shadow-slate-900/40 transition hover:-translate-y-0.5"
              >
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handlePrimary}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${style.button} px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg ${style.shadow} transition hover:-translate-y-0.5`}
            >
              {actionLabel}
              <span aria-hidden>⎋</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
