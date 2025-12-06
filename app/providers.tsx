'use client'

import type { ReactNode } from 'react'

import { LocaleProvider } from '@/lib/usePreferredLocale'
import { ToastProvider } from '@/components/ToastProvider'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>{children}</ToastProvider>
    </LocaleProvider>
  )
}
