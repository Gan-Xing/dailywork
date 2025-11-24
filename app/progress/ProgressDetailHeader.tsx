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

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{t.detail.badge}</p>
      <h1 className="text-4xl font-semibold leading-tight text-slate-50">
        <LocalizedRoadName road={road} />
      </h1>
      <p className="text-sm text-slate-200/80">
        {formatProgressCopy(t.detail.slugLine, { slug: road.slug, start: road.startPk, end: road.endPk })}
      </p>
      <div className="flex gap-3">
        <Link
          href="/progress"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
        >
          {t.detail.back}
        </Link>
      </div>
    </>
  )
}
