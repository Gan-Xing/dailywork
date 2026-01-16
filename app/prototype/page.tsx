import { redirect } from 'next/navigation'

import { DATE_KEY_REGEX } from '@/lib/reportUtils'

const DEFAULT_DATE = '2026-01-12'

export default function PrototypePage({
  searchParams,
}: {
  searchParams?: { date?: string; locale?: string }
}) {
  const dateParam = typeof searchParams?.date === 'string' ? searchParams.date : DEFAULT_DATE
  const date = DATE_KEY_REGEX.test(dateParam) ? dateParam : DEFAULT_DATE
  const locale = searchParams?.locale === 'fr' ? 'fr' : 'zh'
  redirect(`/reports/${date}/template-preview?locale=${locale}`)
}
