'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { getCopy } from '@/lib/i18n'
import { reportLandingBreadcrumbs } from '@/lib/i18n/reportsLanding'
import { getReportPreviewCopy } from '@/lib/i18n/reportPreview'
import { DATE_KEY_REGEX } from '@/lib/reportUtils'
import type { DailyReport } from '@/lib/reportState'
import { ReportsHeader } from '../../ReportsHeader'

const STORAGE_PREFIX = 'report-preview-'

export default function ReportTemplatePreviewPage() {
  const params = useParams<{ date?: string }>()
  const searchParams = useSearchParams()
  const localeParam = searchParams?.get('locale') === 'fr' ? 'fr' : 'zh'
  const copy = getReportPreviewCopy(localeParam)
  const uiCopy = getCopy(localeParam)
  const breadcrumbsCopy = reportLandingBreadcrumbs[localeParam]
  const dateKey = typeof params?.date === 'string' ? params.date : ''
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const breadcrumbDate = dateKey || '--'

  const header = (
    <ReportsHeader
      className="z-30 py-4"
      breadcrumbs={[
        { label: breadcrumbsCopy.home, href: '/' },
        { label: breadcrumbsCopy.reports, href: '/reports' },
        { label: breadcrumbDate },
      ]}
      title={uiCopy.common.previewTitle}
      subtitle={breadcrumbDate}
      locale={localeParam}
    />
  )

  useEffect(() => {
    let isMounted = true
    if (!dateKey || !DATE_KEY_REGEX.test(dateKey)) {
      setError(copy.invalidDate)
      setIsLoading(false)
      return
    }

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)
      let report: DailyReport | null = null

      if (typeof window !== 'undefined') {
        const storageKey = `${STORAGE_PREFIX}${dateKey}`
        const stored = window.sessionStorage.getItem(storageKey)
        if (stored) {
          try {
            report = JSON.parse(stored) as DailyReport
          } catch {
            report = null
          }
          window.sessionStorage.removeItem(storageKey)
        }
      }

      try {
        const response = await fetch('/api/reports/template-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateKey, locale: localeParam, report }),
        })
        const data = (await response.json().catch(() => null)) as { html?: string; message?: string } | null
        if (!response.ok || !data?.html) {
          throw new Error(data?.message ?? copy.error)
        }
        if (isMounted) {
          setHtml(data.html)
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message || copy.error)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      isMounted = false
    }
  }, [copy.error, copy.invalidDate, dateKey, localeParam])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        {header}
        <section className="mx-auto w-full max-w-[1700px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <p className="text-center text-sm text-slate-500">{copy.loading}</p>
        </section>
      </main>
    )
  }

  if (error || !html) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        {header}
        <section className="mx-auto w-full max-w-[1700px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {error || copy.error}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {header}
      <section className="flex w-full items-start justify-center bg-slate-200 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <iframe
          title="Daily report template preview"
          className="h-[90vh] w-full max-w-[1400px] rounded-3xl border border-slate-200 bg-white shadow-xl"
          srcDoc={html}
        />
      </section>
    </main>
  )
}
