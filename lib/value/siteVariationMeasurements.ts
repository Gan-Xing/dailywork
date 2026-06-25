import type { Locale } from '@/lib/i18n'

export const SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE = 'site-variation-measurement'
export const SITE_VARIATION_MEASUREMENT_FILE_PURPOSE_EVIDENCE = 'variation-evidence'
export const SITE_VARIATION_MEASUREMENT_FILE_CATEGORY = 'measurement'

export const SITE_VARIATION_MEASUREMENT_STATUSES = [
  'PENDING_CONFIRMATION',
  'READY_TO_MEASURE',
  'MEASURED',
  'ARCHIVED',
  'VOID',
] as const

export const SITE_VARIATION_MEASUREMENT_TYPES = [
  'ADDITION',
  'INCREASE',
  'DECREASE',
  'LOCATION_ADJUSTMENT',
  'SPEC_ADJUSTMENT',
  'FIELD_SUBSTITUTION',
  'DESIGN_OMISSION',
  'OTHER',
] as const

export const SITE_VARIATION_MEASUREMENT_REASONS = [
  'SITE_CONDITION',
  'SUPERVISION_REQUIREMENT',
  'OWNER_REQUIREMENT',
  'DESIGN_ERROR',
  'CONSTRUCTION_OPTIMIZATION',
  'OTHER',
] as const

export type SiteVariationMeasurementStatusKey =
  (typeof SITE_VARIATION_MEASUREMENT_STATUSES)[number]
export type SiteVariationMeasurementTypeKey = (typeof SITE_VARIATION_MEASUREMENT_TYPES)[number]
export type SiteVariationMeasurementReasonKey =
  (typeof SITE_VARIATION_MEASUREMENT_REASONS)[number]

const statusLabels: Record<Locale, Record<SiteVariationMeasurementStatusKey, string>> = {
  zh: {
    PENDING_CONFIRMATION: '待确认',
    READY_TO_MEASURE: '待计量',
    MEASURED: '已计量',
    ARCHIVED: '已归档',
    VOID: '已作废',
  },
  fr: {
    PENDING_CONFIRMATION: 'À confirmer',
    READY_TO_MEASURE: 'À métrer',
    MEASURED: 'Métré',
    ARCHIVED: 'Archivé',
    VOID: 'Annulé',
  },
}

const typeLabels: Record<Locale, Record<SiteVariationMeasurementTypeKey, string>> = {
  zh: {
    ADDITION: '新增工程',
    INCREASE: '数量增加',
    DECREASE: '数量减少',
    LOCATION_ADJUSTMENT: '位置调整',
    SPEC_ADJUSTMENT: '规格调整',
    FIELD_SUBSTITUTION: '现场替代',
    DESIGN_OMISSION: '图纸遗漏',
    OTHER: '其他',
  },
  fr: {
    ADDITION: 'Travaux ajoutés',
    INCREASE: 'Quantité augmentée',
    DECREASE: 'Quantité réduite',
    LOCATION_ADJUSTMENT: 'Ajustement de localisation',
    SPEC_ADJUSTMENT: 'Ajustement de spécification',
    FIELD_SUBSTITUTION: 'Substitution sur site',
    DESIGN_OMISSION: 'Omission du plan',
    OTHER: 'Autre',
  },
}

const reasonLabels: Record<Locale, Record<SiteVariationMeasurementReasonKey, string>> = {
  zh: {
    SITE_CONDITION: '现场条件',
    SUPERVISION_REQUIREMENT: '监理要求',
    OWNER_REQUIREMENT: '业主要求',
    DESIGN_ERROR: '设计问题',
    CONSTRUCTION_OPTIMIZATION: '施工优化',
    OTHER: '其他',
  },
  fr: {
    SITE_CONDITION: 'Condition du site',
    SUPERVISION_REQUIREMENT: 'Demande de la mission',
    OWNER_REQUIREMENT: 'Demande du maître d’ouvrage',
    DESIGN_ERROR: 'Erreur de conception',
    CONSTRUCTION_OPTIMIZATION: 'Optimisation des travaux',
    OTHER: 'Autre',
  },
}

export const getSiteVariationMeasurementStatusLabel = (
  value: string | null | undefined,
  locale: Locale,
) => (value ? statusLabels[locale][value as SiteVariationMeasurementStatusKey] ?? value : '—')

export const getSiteVariationMeasurementTypeLabel = (
  value: string | null | undefined,
  locale: Locale,
) => (value ? typeLabels[locale][value as SiteVariationMeasurementTypeKey] ?? value : '—')

export const getSiteVariationMeasurementReasonLabel = (
  value: string | null | undefined,
  locale: Locale,
) => (value ? reasonLabels[locale][value as SiteVariationMeasurementReasonKey] ?? value : '—')
