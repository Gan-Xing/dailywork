import type { Locale } from '@/lib/i18n'

export const MACHINE_USAGE_STATUS_VALUES = ['非本项目', '可用', '维修中', '已报废'] as const

export type MachineUsageStatusValue = (typeof MACHINE_USAGE_STATUS_VALUES)[number]

const machineUsageStatusDefs: Array<{ value: MachineUsageStatusValue; zh: string; fr: string }> = [
  { value: '非本项目', zh: '非本项目', fr: 'Hors projet' },
  { value: '可用', zh: '可用', fr: 'Disponible' },
  { value: '维修中', zh: '维修中', fr: 'En maintenance' },
  { value: '已报废', zh: '已报废', fr: 'Réformé' },
]

const byValue = new Map(machineUsageStatusDefs.map((item) => [item.value, item]))

export const normalizeMachineUsageStatus = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

export const getMachineUsageStatusLabel = (locale: Locale, value: string | null | undefined) => {
  const normalized = normalizeMachineUsageStatus(value)
  if (!normalized) return ''
  const matched = byValue.get(normalized as MachineUsageStatusValue)
  if (!matched) return normalized
  return locale === 'fr' ? matched.fr : matched.zh
}

export const buildMachineUsageStatusSelectOptions = ({
  locale,
  includeEmpty = true,
  emptyLabel,
}: {
  locale: Locale
  includeEmpty?: boolean
  emptyLabel?: string
}) => {
  const options = machineUsageStatusDefs.map((item) => ({
    value: item.value,
    label: locale === 'fr' ? item.fr : item.zh,
  }))

  if (!includeEmpty) return options
  return [{ value: '', label: emptyLabel ?? (locale === 'fr' ? 'Non renseigné' : '未填写') }, ...options]
}
