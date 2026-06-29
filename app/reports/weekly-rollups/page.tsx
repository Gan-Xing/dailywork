'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import { reportLandingBreadcrumbs } from '@/lib/i18n/reportsLanding'
import { getWeeklyRollupsCopy } from '@/lib/i18n/weeklyRollups'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { ReportsHeader } from '../ReportsHeader'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type WeeklyRollupSummary = {
  periodKey: string
  title: string
  reportPeriod: string
  weekLabel: string | null
  description: string | null
  projectNames: string[]
  fileId: number
  originalName: string
  size: number
  updatedAt: string
  createdAt: string
}

const formatBytes = (size: number, locale: string) => {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${units[unitIndex]}`
}

const formatDateTime = (value: string, locale: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function WeeklyRollupsPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const copy = getWeeklyRollupsCopy(locale)
  const breadcrumbsCopy = reportLandingBreadcrumbs[locale]
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'zh-CN'

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [items, setItems] = useState<WeeklyRollupSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canView = useMemo(
    () => session?.permissions.includes('report:view') || session?.permissions.includes('report:edit') || false,
    [session],
  )

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        const data = (await res.json()) as { user?: SessionUser | null }
        setSession(data.user ?? null)
      } catch {
        setSession(null)
      } finally {
        setAuthLoaded(true)
      }
    }

    void loadSession()
  }, [])

  useEffect(() => {
    if (!authLoaded || !canView) {
      if (authLoaded && !canView) {
        setIsLoading(false)
      }
      return
    }

    const loadItems = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/reports/weekly-rollups', { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as { items?: WeeklyRollupSummary[]; message?: string } | null
        if (!res.ok) {
          throw new Error(data?.message ?? copy.list.error)
        }
        setItems(data?.items ?? [])
      } catch (loadError) {
        setError((loadError as Error).message || copy.list.error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadItems()
  }, [authLoaded, canView, copy.list.error])

  if (authLoaded && !canView) {
    return <AccessDenied locale={locale} permissions={['report:view']} hint={copy.accessHint} />
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportsHeader
        breadcrumbs={[
          { label: breadcrumbsCopy.home, href: '/' },
          { label: breadcrumbsCopy.reports, href: '/reports' },
          { label: copy.list.title },
        ]}
        title={copy.list.title}
        subtitle={copy.list.subtitle}
        locale={locale}
        onLocaleChange={setLocale}
      />

      <section className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            {copy.list.loading}
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            {copy.list.empty}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.periodKey}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      {item.weekLabel || copy.list.reportPeriodLabel}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">
                      {item.title || copy.list.untitled}
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.periodKey}
                  </span>
                </div>

                <dl className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-medium text-slate-500">{copy.list.reportPeriodLabel}</dt>
                    <dd className="text-right text-slate-900">{item.reportPeriod}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-medium text-slate-500">{copy.list.updatedLabel}</dt>
                    <dd className="text-right text-slate-900">{formatDateTime(item.updatedAt, dateLocale)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-medium text-slate-500">{copy.list.sizeLabel}</dt>
                    <dd className="text-right text-slate-900">{formatBytes(item.size, dateLocale)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-medium text-slate-500">{copy.list.projectLabel}</dt>
                    <dd className="text-right text-slate-900">
                      {item.projectNames.length ? item.projectNames.join(' / ') : '-'}
                    </dd>
                  </div>
                </dl>

                {item.description ? <p className="mt-4 text-sm leading-6 text-slate-600">{item.description}</p> : null}

                <div className="mt-6">
                  <Link
                    href={`/reports/weekly-rollups/${encodeURIComponent(item.periodKey)}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {copy.list.open}
                    <span aria-hidden>↗</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
