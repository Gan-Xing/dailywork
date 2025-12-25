import { useCallback, useMemo } from 'react'

import {
  genderOptions,
  memberCopy,
  nationalityOptions,
  type NationalityRegion,
  type NationalityOption,
} from '@/lib/i18n/members'
import { normalizeText } from '@/lib/members/utils'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UseMemberFormattersParams = {
  locale: keyof typeof memberCopy
  t: MemberCopy
}

export function useMemberFormatters({ locale, t }: UseMemberFormattersParams) {
  const nationalityByRegion = useMemo(() => {
    const grouped = new Map<NationalityRegion, NationalityOption[]>()
    nationalityOptions.forEach((option) => {
      option.regions.forEach((region) => {
        const bucket = grouped.get(region) ?? []
        bucket.push(option)
        grouped.set(region, bucket)
      })
    })
    return grouped
  }, [])

  const findNationalityLabel = useCallback(
    (value: string | null) => {
      const option = nationalityOptions.find((item) => item.key === value)
      return option ? option.label[locale] : value || t.labels.empty
    },
    [locale, t.labels.empty],
  )

  const findGenderLabel = useCallback(
    (value: string | null) => {
      const option = genderOptions.find((item) => item.value === value)
      return option ? option.label[locale] : value || t.labels.empty
    },
    [locale, t.labels.empty],
  )

  const formatProfileText = useCallback(
    (value?: string | null) => {
      const normalized = normalizeText(value)
      return normalized ? normalized : t.labels.empty
    },
    [t.labels.empty],
  )

  const formatProfileNumber = useCallback(
    (value?: number | null) => (value === null || value === undefined ? t.labels.empty : String(value)),
    [t.labels.empty],
  )

  const formatProfileList = useCallback(
    (values?: string[] | null) => (values && values.length ? values.join(' / ') : t.labels.empty),
    [t.labels.empty],
  )

  const formatSalary = useCallback(
    (amount?: string | null, unit?: 'MONTH' | 'HOUR' | null, fallbackUnit?: 'MONTH' | 'HOUR' | null) => {
      const normalized = normalizeText(amount)
      if (!normalized) return t.labels.empty
      const resolvedUnit = unit ?? fallbackUnit
      if (!resolvedUnit) return normalized
      return `${normalized}/${resolvedUnit === 'MONTH' ? 'M' : 'H'}`
    },
    [t.labels.empty],
  )

  return {
    nationalityByRegion,
    findNationalityLabel,
    findGenderLabel,
    formatProfileText,
    formatProfileNumber,
    formatProfileList,
    formatSalary,
  }
}
