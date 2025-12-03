import type { Locale } from './index'

export type ReportPreviewCopy = {
  loading: string
  error: string
  invalidDate: string
}

export const reportPreviewCopy: Record<Locale, ReportPreviewCopy> = {
  zh: {
    loading: '加载中...',
    error: '无法加载日报',
    invalidDate: '无效日期'
  },
  fr: {
    loading: 'Chargement…',
    error: 'Impossible de charger le rapport',
    invalidDate: 'Date invalide'
  }
}

export const getReportPreviewCopy = (locale: Locale): ReportPreviewCopy => reportPreviewCopy[locale]
