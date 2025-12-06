'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastTone = 'success' | 'info' | 'warning' | 'danger'

type Toast = {
  id: string
  message: string
  tone: ToastTone
  duration: number
}

type ToastContextValue = {
  addToast: (message: string, options?: { tone?: ToastTone; duration?: number }) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-200/60 bg-emerald-50/90 text-emerald-900 shadow-emerald-400/30',
  info: 'border-sky-200/60 bg-sky-50/90 text-sky-900 shadow-sky-400/30',
  warning: 'border-amber-200/70 bg-amber-50/95 text-amber-900 shadow-amber-400/40',
  danger: 'border-rose-200/70 bg-rose-50/95 text-rose-900 shadow-rose-400/40',
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, options?: { tone?: ToastTone; duration?: number }) => {
      const id = uid()
      const duration = Math.max(1200, options?.duration ?? 2500)
      const tone = options?.tone ?? 'info'
      setToasts((prev) => [...prev, { id, message, tone, duration }])
      window.setTimeout(() => removeToast(id), duration)
      return id
    },
    [removeToast],
  )

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ring-1 ring-white/5 ${toneStyles[toast.tone]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
