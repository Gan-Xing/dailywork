'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import { reportLandingBreadcrumbs } from '@/lib/i18n/reportsLanding'
import { getWeeklyRollupsCopy } from '@/lib/i18n/weeklyRollups'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { ReportsHeader } from '../../ReportsHeader'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type WeeklyRollupDetail = {
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
  html: string
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

export default function WeeklyRollupDetailPage() {
  const params = useParams<{ period?: string }>()
  const period = typeof params?.period === 'string' ? decodeURIComponent(params.period) : ''
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const copy = getWeeklyRollupsCopy(locale)
  const breadcrumbsCopy = reportLandingBreadcrumbs[locale]
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'zh-CN'

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [item, setItem] = useState<WeeklyRollupDetail | null>(null)
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
    if (!authLoaded || !canView || !period) {
      if (authLoaded && (!canView || !period)) {
        setIsLoading(false)
      }
      return
    }

    const loadItem = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/reports/weekly-rollups/${encodeURIComponent(period)}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as { item?: WeeklyRollupDetail; message?: string } | null
        if (res.status === 404) {
          setItem(null)
          setError(copy.detail.notFound)
          return
        }
        if (!res.ok || !data?.item) {
          throw new Error(data?.message ?? copy.detail.error)
        }
        setItem(data.item)
      } catch (loadError) {
        setError((loadError as Error).message || copy.detail.error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadItem()
  }, [authLoaded, canView, copy.detail.error, copy.detail.notFound, period])

  if (authLoaded && !canView) {
    return <AccessDenied locale={locale} permissions={['report:view']} hint={copy.accessHint} />
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportsHeader
        breadcrumbs={[
          { label: breadcrumbsCopy.home, href: '/' },
          { label: breadcrumbsCopy.reports, href: '/reports' },
          { label: copy.list.title, href: '/reports/weekly-rollups' },
          { label: item?.reportPeriod || period || copy.detail.title },
        ]}
        title={item?.title || copy.detail.title}
        subtitle={item?.reportPeriod || copy.detail.subtitle}
        locale={locale}
        onLocaleChange={setLocale}
        rightSlot={
          <Link
            href="/reports/weekly-rollups"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span aria-hidden>↩</span>
            {copy.detail.back}
          </Link>
        }
      />

      <section className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            {copy.detail.loading}
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {!isLoading && item ? (
          <>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.detail.reportPeriodLabel}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.reportPeriod}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.detail.updatedLabel}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(item.updatedAt, dateLocale)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.detail.sizeLabel}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatBytes(item.size, dateLocale)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.detail.projectLabel}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {item.projectNames.length ? item.projectNames.join(' / ') : '-'}
                </p>
              </div>
            </div>

            {item.weekLabel || item.description ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                {item.weekLabel ? (
                  <p className="text-sm font-semibold text-slate-800">
                    {copy.detail.weekLabel}：{item.weekLabel}
                  </p>
                ) : null}
                {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-200 shadow-xl">
              <iframe
                title={copy.detail.htmlTitle}
                className="h-[82vh] w-full bg-white"
                sandbox="allow-scripts"
                srcDoc={item.html}
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
