'use client'

import type { ReactNode } from 'react'

import { LocaleProvider } from '@/lib/usePreferredLocale'

export default function Providers({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}
