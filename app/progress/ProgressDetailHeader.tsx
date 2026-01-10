'use client'

import { LocalizedRoadName } from './LocalizedRoadName'
import { ProgressHeader } from './ProgressHeader'
import { ProgressSectionNav } from './ProgressSectionNav'
import type { RoadSectionDTO } from '@/lib/progressTypes'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function ProgressDetailHeader({ road }: { road: RoadSectionDTO }) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const breadcrumbHome = t.nav.home
  const breadcrumbProgress = t.detail.breadcrumbProgress

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
      right={<ProgressSectionNav />}
      locale={locale}
      onLocaleChange={setLocale}
    />
  )
}
