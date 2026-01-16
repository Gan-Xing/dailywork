'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { getReportPreviewCopy } from '@/lib/i18n/reportPreview'
import { DATE_KEY_REGEX } from '@/lib/reportUtils'
import type { DailyReport } from '@/lib/reportState'

const STORAGE_PREFIX = 'report-preview-'

export default function ReportTemplatePreviewPage() {
  const params = useParams<{ date?: string }>()
  const searchParams = useSearchParams()
  const localeParam = searchParams?.get('locale') === 'fr' ? 'fr' : 'zh'
  const copy = getReportPreviewCopy(localeParam)
  const dateKey = typeof params?.date === 'string' ? params.date : ''
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <p className="text-center text-sm text-slate-500">{copy.loading}</p>
      </main>
    )
  }

  if (error || !html) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error || copy.error}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen w-full items-start justify-center bg-slate-200 p-4">
      <iframe
        title="Daily report template preview"
        className="h-[90vh] w-full max-w-[1400px] rounded-3xl border border-slate-200 bg-white shadow-xl"
        srcDoc={html}
      />
    </main>
  )
}
