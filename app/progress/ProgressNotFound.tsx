'use client'

import Link from 'next/link'

import { getProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function ProgressNotFound() {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-14 sm:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
          <h1 className="text-2xl font-semibold text-slate-50">{t.detail.notFoundTitle}</h1>
          <p className="mt-2 text-slate-300">{t.detail.notFoundBody}</p>
          <Link
            href="/progress"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
          >
            {t.detail.backToBoard}
          </Link>
        </div>
      </div>
    </main>
  )
}
