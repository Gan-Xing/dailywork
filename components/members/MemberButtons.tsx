'use client'

import type { ReactNode } from 'react'

import { ActionButton as BaseActionButton } from '@/components/ActionButton'

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
    <BaseActionButton onClick={onClick} disabled={disabled}>
      {children}
    </BaseActionButton>
  )
}
