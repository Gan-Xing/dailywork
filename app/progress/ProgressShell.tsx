'use client'

import Link from 'next/link'

import { RoadBoard } from './RoadBoard'
import type { RoadSectionProgressDTO } from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  roads: RoadSectionProgressDTO[]
  loadError: string | null
  canManage: boolean
  canViewInspections: boolean
}

export function ProgressShell({ roads, loadError, canManage, canViewInspections }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            {t.hero.badge}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">{t.hero.title}</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">{t.hero.description}</p>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
            >
              {t.hero.home}
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
            >
              {t.hero.reports}
            </Link>
            {canViewInspections ? (
              <Link
                href="/progress/inspections"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/10"
              >
                报检记录
              </Link>
            ) : null}
          </div>
          {loadError ? (
            <p className="text-sm text-amber-200">
              {formatProgressCopy(t.hero.loadError, { message: loadError })}
            </p>
          ) : null}
        </header>

        <div className="mt-10">
          <RoadBoard initialRoads={roads} canManage={canManage} />
        </div>
      </div>
    </main>
  )
}
