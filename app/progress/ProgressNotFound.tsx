'use client'

import Link from 'next/link'

import { getProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { ProgressHeader } from './ProgressHeader'
import { ProgressSectionNav } from './ProgressSectionNav'

export function ProgressNotFound() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title={t.detail.notFoundTitle}
        subtitle={t.detail.notFoundBody}
      breadcrumbs={[
        { label: t.nav.home, href: '/' },
        { label: t.nav.progress, href: '/progress' },
        { label: t.detail.notFoundTitle },
      ]}
      right={<ProgressSectionNav />}
      locale={locale}
      onLocaleChange={setLocale}
    />
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t.detail.notFoundTitle}</h2>
          <p className="mt-2 text-slate-600">{t.detail.notFoundBody}</p>
          <Link
            href="/progress"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600"
          >
            {t.detail.backToBoard}
          </Link>
        </div>
      </div>
    </main>
  )
}
