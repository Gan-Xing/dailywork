'use client'

import { useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { LocalizedRoadName } from './LocalizedRoadName'
import { ProgressHeader } from './ProgressHeader'
import type { RoadSectionDTO } from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function ProgressDetailHeader({ road, roads }: { road: RoadSectionDTO; roads: RoadSectionDTO[] }) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const router = useRouter()
  const [isSwitching, startTransition] = useTransition()
  const t = getProgressCopy(locale)
  const breadcrumbHome = t.nav.home
  const breadcrumbProgress = t.detail.breadcrumbProgress
  const roadOptions = useMemo(() => {
    const deduped = new Map<string, RoadSectionDTO>()
    const sourceRoads = roads.length ? roads : [road]
    sourceRoads.forEach((item) => {
      deduped.set(item.slug, item)
    })
    if (!deduped.has(road.slug)) {
      deduped.set(road.slug, road)
    }
    return Array.from(deduped.values()).sort((left, right) =>
      resolveRoadName(left, locale).localeCompare(
        resolveRoadName(right, locale),
        locale === 'fr' ? 'fr-FR' : 'zh-CN',
      ),
    )
  }, [locale, road, roads])

  const switchRoad = (targetSlug: string) => {
    if (!targetSlug || targetSlug === road.slug) return
    startTransition(() => {
      router.push(`/progress/${targetSlug}`)
    })
  }

  return (
    <ProgressHeader
      title={<LocalizedRoadName road={road} />}
      subtitle={formatProgressCopy(t.detail.slugLine, {
        slug: road.slug,
        start: road.startPk,
        end: road.endPk,
      })}
      breadcrumbs={[
        { label: breadcrumbHome, href: '/' },
        { label: breadcrumbProgress, href: '/progress' },
        { label: <LocalizedRoadName road={road} /> },
      ]}
      locale={locale}
      onLocaleChange={setLocale}
      rightSlot={
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold">{t.detail.roadSwitchLabel}</span>
          <select
            className="h-9 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-emerald-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={road.slug}
            onChange={(event) => switchRoad(event.target.value)}
            disabled={isSwitching}
          >
            {roadOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {resolveRoadName(option, locale)}
              </option>
            ))}
          </select>
        </label>
      }
    />
  )
}
