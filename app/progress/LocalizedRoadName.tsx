'use client'

import type { RoadSectionDTO } from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function LocalizedRoadName({ road }: { road: RoadSectionDTO }) {
  const { locale } = usePreferredLocale('zh', locales)
  return <>{resolveRoadName(road, locale)}</>
}
