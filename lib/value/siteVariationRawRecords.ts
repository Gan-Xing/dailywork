import type { Locale } from '@/lib/i18n'

export const SITE_VARIATION_RAW_RECORD_STATUSES = [
  'PENDING_REVIEW',
  'IN_REVIEW',
  'CONFIRMED',
  'CONVERTED',
  'DUPLICATE',
  'VOID',
] as const

export type SiteVariationRawRecordStatusKey =
  (typeof SITE_VARIATION_RAW_RECORD_STATUSES)[number]

const statusLabels: Record<Locale, Record<SiteVariationRawRecordStatusKey, string>> = {
  zh: {
    PENDING_REVIEW: '待核对',
    IN_REVIEW: '核对中',
    CONFIRMED: '已确认',
    CONVERTED: '已转正式变更',
    DUPLICATE: '重复',
    VOID: '作废',
  },
  fr: {
    PENDING_REVIEW: 'À vérifier',
    IN_REVIEW: 'En vérification',
    CONFIRMED: 'Confirmé',
    CONVERTED: 'Converti',
    DUPLICATE: 'Doublon',
    VOID: 'Annulé',
  },
}

export const getSiteVariationRawRecordStatusLabel = (
  value: string | null | undefined,
  locale: Locale,
) => (value ? statusLabels[locale][value as SiteVariationRawRecordStatusKey] ?? value : '—')
