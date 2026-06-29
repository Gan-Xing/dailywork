export const WEEKLY_ROLLUP_ENTITY_TYPE = 'weekly-rollup'
export const WEEKLY_ROLLUP_PURPOSE = 'owner-rollup-html'
export const WEEKLY_ROLLUP_CATEGORY = 'measurement'
export const WEEKLY_ROLLUP_MIME_TYPE = 'text/html'

const PERIOD_KEY_RE = /^(\d{8})-(\d{8})$/

const formatDateToken = (token: string) => `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`

export const buildReportPeriodFromKey = (periodKey: string) => {
  const match = PERIOD_KEY_RE.exec(periodKey)
  if (!match) return periodKey
  return `${formatDateToken(match[1])} 至 ${formatDateToken(match[2])}`
}
