import 'server-only'

import type { Locale } from '@/lib/i18n'
import { monthOptions } from '@/lib/i18n/reportEditor'
import {
  additionalNarrativeSections,
  observationBlocks,
  weatherConditions,
  weatherPeriods,
  worksExecutedBlocks,
} from '@/lib/reportSchema'
import type { DailyReport } from '@/lib/reportState'

const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const narrativeFallback: Record<Locale, string> = {
  fr: 'RAS',
  zh: '无',
}

export interface RenderOptions {
  /**
   * Absolute base URL for static assets (e.g., https://dailywork-pearl.vercel.app).
   */
  baseUrl?: string
}

type Totals = {
  total?: string
  marche?: string
  panne?: string
  arret?: string
  present?: string
  absent?: string
}

const monthLabelMap = new Map(
  monthOptions.map((option) => [option.value, option.label]),
)

const weatherLabelMap = new Map(
  weatherConditions.map((condition) => [condition.id, condition.label]),
)

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatPlainText = (value: unknown) => {
  if (value === undefined || value === null) return ''
  return escapeHtml(String(value))
}

const formatNarrative = (value: unknown, locale: Locale) => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return narrativeFallback[locale]
  return escapeHtml(text).replace(/\r?\n/g, '<br/>')
}

const formatDate = (value: string) => {
  if (!value) return ''
  if (!DATE_KEY_REGEX.test(value)) return formatPlainText(value)
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const formatMonth = (value: string, locale: Locale) => {
  if (!value) return ''
  if (locale === 'fr') {
    const label = monthLabelMap.get(value)
    return label ? label.fr : value
  }
  return value
}

const formatWeatherCondition = (value: string, locale: Locale) => {
  if (!value) return ''
  const label = weatherLabelMap.get(value)
  return label ? label[locale] : value
}

const sumTotals = (entries: Array<Record<string, string>>, keys: Array<keyof Totals>) => {
  const totals: Totals = {}
  keys.forEach((key) => {
    const sum = entries.reduce((acc, entry) => acc + (Number(entry[key]) || 0), 0)
    totals[key] = sum ? String(sum) : ''
  })
  return totals
}

const buildNarrativeMap = (
  report: DailyReport,
) => ({
  observations: observationBlocks.reduce((acc, block) => {
    acc[block.id] = {
      fr: formatNarrative(report.observations?.[block.id]?.fr, 'fr'),
      zh: formatNarrative(report.observations?.[block.id]?.zh, 'zh'),
    }
    return acc
  }, {} as DailyReport['observations']),
  works: worksExecutedBlocks.reduce((acc, block) => {
    acc[block.id] = {
      fr: formatNarrative(report.works?.[block.id]?.fr, 'fr'),
      zh: formatNarrative(report.works?.[block.id]?.zh, 'zh'),
    }
    return acc
  }, {} as DailyReport['works']),
  additional: additionalNarrativeSections.reduce((acc, block) => {
    acc[block.id] = {
      fr: formatNarrative(report.additional?.[block.id]?.fr, 'fr'),
      zh: formatNarrative(report.additional?.[block.id]?.zh, 'zh'),
    }
    return acc
  }, {} as DailyReport['additional']),
})

export const buildDailyReportTemplateContext = (report: DailyReport, locale: Locale) => {
  const metadata = {
    ...report.metadata,
    year: formatPlainText(report.metadata?.year ?? ''),
    month: formatPlainText(formatMonth(report.metadata?.month ?? '', locale)),
    date: formatDate(report.metadata?.date ?? ''),
    horaires: formatPlainText(report.metadata?.horaires ?? ''),
    stoppageCause: formatPlainText(report.metadata?.stoppageCause ?? ''),
  }

  const weather = weatherPeriods.reduce((acc, period) => {
    const entry = report.weather?.[period]
    acc[period] = {
      condition: formatPlainText(formatWeatherCondition(entry?.condition ?? '', locale)),
      rainfall: formatPlainText(entry?.rainfall ?? ''),
    }
    return acc
  }, {} as DailyReport['weather'])

  const equipmentTotals = sumTotals(Object.values(report.equipment ?? {}), [
    'total',
    'marche',
    'panne',
    'arret',
  ])
  const personnelTotals = sumTotals(Object.values(report.personnel ?? {}), ['present', 'absent'])

  const equipment = Object.fromEntries(
    Object.entries(report.equipment ?? {}).map(([key, entry]) => [
      key,
      {
        total: formatPlainText(entry.total ?? ''),
        marche: formatPlainText(entry.marche ?? ''),
        panne: formatPlainText(entry.panne ?? ''),
        arret: formatPlainText(entry.arret ?? ''),
      },
    ]),
  )
  const materials = Object.fromEntries(
    Object.entries(report.materials ?? {}).map(([key, entry]) => [
      key,
      {
        previous: formatPlainText(entry.previous ?? ''),
        entry: formatPlainText(entry.entry ?? ''),
        exit: formatPlainText(entry.exit ?? ''),
        current: formatPlainText(entry.current ?? ''),
      },
    ]),
  )
  const personnel = Object.fromEntries(
    Object.entries(report.personnel ?? {}).map(([key, entry]) => [
      key,
      {
        present: formatPlainText(entry.present ?? ''),
        absent: formatPlainText(entry.absent ?? ''),
      },
    ]),
  )
  const expatriate = {
    present: formatPlainText(report.expatriate?.present ?? ''),
    absent: formatPlainText(report.expatriate?.absent ?? ''),
  }

  const narrative = buildNarrativeMap(report)

  return {
    metadata,
    weather,
    equipment,
    materials,
    personnel,
    expatriate,
    equipmentTotals,
    personnelTotals,
    observations: narrative.observations,
    works: narrative.works,
    additional: narrative.additional,
  }
}

export const renderDailyReportTemplate = (
  template: string,
  report: DailyReport,
  locale: Locale,
  options?: RenderOptions,
) => {
  const normalizedTemplate = normalizeAssets(template, options?.baseUrl)
  const context = buildDailyReportTemplateContext(report, locale)
  return normalizedTemplate.replace(PLACEHOLDER_REGEX, (_, rawKey: string) => {
    const key = rawKey.trim()
    if (!key) return ''
    const value = resolvePath(context, key)
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  })
}

const normalizeAssets = (template: string, baseUrl?: string): string => {
  const prefix = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const isAbsolute = (value: string) =>
    /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')
  const isSpecial = (value: string) =>
    value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:')
  const normalizePublicPath = (value: string) =>
    value
      .replace(/^(\.\.\/)+public\//, '/')
      .replace(/^\.?\/?public\//, '/')
  const toAbs = (value: string) => {
    if (!value || isSpecial(value) || value.includes('{{')) return value
    const normalized = normalizePublicPath(value)
    if (isAbsolute(normalized)) return normalized
    if (!prefix) return normalized.startsWith('/') ? normalized : `/${normalized}`
    return `${prefix}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
  }

  return template
    .replace(/href="([^"]+\.css[^"]*)"/gi, (_match, href) => `href="${toAbs(href)}"`)
    .replace(/src="([^"]+)"/gi, (_match, src) => `src="${toAbs(src)}"`)
}

const resolvePath = (source: unknown, path: string): unknown => {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) return undefined
  let current: any = source
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined
    current = current[segment]
  }
  return current
}
