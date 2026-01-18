import { redirect } from 'next/navigation'

import { DATE_KEY_REGEX } from '@/lib/reportUtils'

const DEFAULT_DATE = '2026-01-12'

export default async function PrototypePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; locale?: string }>
}) {
  const query = searchParams ? await searchParams : {}
  const dateParam = typeof query?.date === 'string' ? query.date : DEFAULT_DATE
  const date = DATE_KEY_REGEX.test(dateParam) ? dateParam : DEFAULT_DATE
  const locale = query?.locale === 'fr' ? 'fr' : 'zh'
  redirect(`/reports/${date}/template-preview?locale=${locale}`)
}
