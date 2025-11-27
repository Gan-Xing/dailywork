'use client'

import Link from 'next/link'

import { LocalizedRoadName } from './LocalizedRoadName'
import type { RoadSectionDTO } from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function ProgressDetailHeader({ road }: { road: RoadSectionDTO }) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const breadcrumbHome = locale === 'fr' ? 'Accueil' : '首页'
  const breadcrumbProgress = locale === 'fr' ? '进度管理' : '进度管理'

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{t.detail.badge}</p>
      <h1 className="text-4xl font-semibold leading-tight text-slate-50">
        <LocalizedRoadName road={road} />
      </h1>
      <p className="text-sm text-slate-200/80">
        {formatProgressCopy(t.detail.slugLine, { slug: road.slug, start: road.startPk, end: road.endPk })}
      </p>
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
        >
          {breadcrumbHome}
        </Link>
        <span className="text-slate-500">/</span>
        <Link
          href="/progress"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
        >
          {breadcrumbProgress}
        </Link>
        <span className="text-slate-500">/</span>
        <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
          <LocalizedRoadName road={road} />
        </span>
      </nav>
    </>
  )
}
