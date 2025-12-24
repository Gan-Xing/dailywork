'use client'

import type { ReactNode } from 'react'

export function TabButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
        active
          ? 'bg-slate-900 text-white shadow-sm shadow-slate-300/40 ring-1 ring-slate-900'
          : 'bg-slate-100 text-slate-700 ring-1 ring-transparent hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

export function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}
