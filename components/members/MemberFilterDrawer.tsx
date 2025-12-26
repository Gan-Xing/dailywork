'use client'

import { type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onClearAll: () => void
  title?: string
  clearLabel?: string
  closeLabel?: string
  clearHint?: string
  children: ReactNode
}

export function MemberFilterDrawer({ 
  open, 
  onClose, 
  onClearAll, 
  title = 'Filters', 
  clearLabel = 'Clear All',
  closeLabel = 'Close panel',
  clearHint,
  children 
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6" aria-labelledby="filter-panel-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold leading-6 text-slate-900" id="filter-panel-title">
              {title}
            </h2>
            {clearHint ? (
              <p className="mt-1 text-xs text-slate-500">{clearHint}</p>
            ) : null}
          </div>
          <div className="ml-3 flex h-7 items-center">
            <button
              type="button"
              className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">{closeLabel}</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto bg-slate-50/60 px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4">
            {children}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
            {clearLabel}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
