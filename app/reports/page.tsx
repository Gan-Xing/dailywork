'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AlertDialog, type AlertTone } from '@/components/AlertDialog'
import { AccessDenied } from '@/components/AccessDenied'
import { formatCopy, locales } from '@/lib/i18n'
import {
  getReportsLandingCopy,
  reportDateLocales,
  reportLandingBreadcrumbs,
} from '@/lib/i18n/reportsLanding'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { ReportsHeader } from './ReportsHeader'

export const dynamic = 'force-dynamic'

interface ReportSummary {
  date: string
  createdAt: string
  updatedAt: string
}

const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)

const buildCalendar = (anchor: Date) => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(firstOfMonth)
  const weekday = start.getDay()
  start.setDate(start.getDate() - weekday)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return {
      date: day,
      key: formatDateInput(day),
      inCurrentMonth: day.getMonth() === anchor.getMonth(),
    }
  })
}

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const buildExportFilename = (dates: string[]) => {
  if (dates.length === 1) return `daily-report-${dates[0]}.pdf`
  const sorted = [...dates].sort()
  return `daily-reports-${sorted[0]}-to-${sorted[sorted.length - 1]}.pdf`
}

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

export default function ReportsLandingPage() {
  const router = useRouter()
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getReportsLandingCopy(locale)
  const { home: breadcrumbHome, reports: breadcrumbReports } = reportLandingBreadcrumbs[locale]
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()))
  const [recentReports, setRecentReports] = useState<ReportSummary[]>([])
  const [monthReports, setMonthReports] = useState<ReportSummary[]>([])
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [isMonthLoading, setIsMonthLoading] = useState(true)
  const [isRecentLoading, setIsRecentLoading] = useState(true)
  const [hasMonthError, setHasMonthError] = useState(false)
  const [hasRecentError, setHasRecentError] = useState(false)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [alertDialog, setAlertDialog] = useState<{ title: string; description: string; tone?: AlertTone } | null>(
    null,
  )
  const [selectedExportDates, setSelectedExportDates] = useState<Set<string>>(() => new Set())
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const monthKey = useMemo(() => formatMonthKey(monthCursor), [monthCursor])
  const dateLocale = reportDateLocales[locale]

  const canView = session?.permissions.some((perm) => perm === 'report:view' || perm === 'report:edit') ?? false
  const canEdit = session?.permissions.includes('report:edit') ?? false

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

  const fetchMonthReports = useCallback(async (key: string) => {
    setIsMonthLoading(true)
    setHasMonthError(false)
    try {
      const response = await fetch(`/api/reports?month=${key}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load calendar data')
      }
      const data = (await response.json()) as { reports: ReportSummary[] }
      setMonthReports(data.reports)
    } catch (error) {
      setHasMonthError(true)
      setMonthReports([])
    } finally {
      setIsMonthLoading(false)
    }
  }, [])

  const fetchRecentReports = useCallback(async () => {
    setIsRecentLoading(true)
    setHasRecentError(false)
    try {
      const response = await fetch('/api/reports?limit=5', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load recent reports')
      }
      const data = (await response.json()) as { reports: ReportSummary[] }
      setRecentReports(data.reports)
    } catch (error) {
      setHasRecentError(true)
      setRecentReports([])
    } finally {
      setIsRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoaded) return
    if (!canView) {
      setIsMonthLoading(false)
      setHasMonthError(false)
      setMonthReports([])
      return
    }
    fetchMonthReports(monthKey)
  }, [authLoaded, canView, fetchMonthReports, monthKey])

  useEffect(() => {
    if (!authLoaded) return
    if (!canView) {
      setIsRecentLoading(false)
      setHasRecentError(false)
      setRecentReports([])
      return
    }
    fetchRecentReports()
  }, [authLoaded, canView, fetchRecentReports])

  useEffect(() => {
    setSelectedExportDates(new Set())
    setExportError(null)
  }, [monthKey])

  const reportDates = useMemo(
    () => new Set(monthReports.map((entry) => entry.date)),
    [monthReports],
  )
  const selectedExportList = useMemo(
    () => Array.from(selectedExportDates).sort(),
    [selectedExportDates],
  )
  const allExportSelected =
    monthReports.length > 0 && selectedExportDates.size === monthReports.length
  const someExportSelected = selectedExportDates.size > 0 && !allExportSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allExportSelected && someExportSelected
    }
  }, [allExportSelected, someExportSelected])

  const calendarDays = useMemo(() => buildCalendar(monthCursor), [monthCursor])

  const hasReportForSelectedDate = selectedDate ? reportDates.has(selectedDate) : false

  const openAlert = (message: string, tone: AlertTone = 'warning') => {
    setAlertDialog({
      title: t.alerts.title,
      description: message,
      tone,
    })
  }

  const handleCreate = () => {
    if (!selectedDate) return
    if (!canEdit) {
      openAlert(t.alerts.createDenied)
      return
    }
    router.push(`/reports/${selectedDate}`)
  }

  const handleDayClick = (date: string) => {
    if (!canView) {
      openAlert(t.alerts.viewDenied)
      return
    }
    router.push(`/reports/${date}`)
  }

  const handleMonthChange = (offset: number) => {
    setMonthCursor((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + offset)
      return next
    })
  }

  const handleDateChange = (value: string) => {
    setSelectedDate(value)
    if (value) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        setMonthCursor(parsed)
      }
    }
  }

  const toggleExportDate = (date: string) => {
    setSelectedExportDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
    setExportError(null)
  }

  const handleSelectAllExports = () => {
    if (monthReports.length === 0) return
    setSelectedExportDates(new Set(monthReports.map((entry) => entry.date)))
    setExportError(null)
  }

  const handleClearExports = () => {
    setSelectedExportDates(new Set())
    setExportError(null)
  }

  const handleExportPdf = async () => {
    if (selectedExportList.length === 0) {
      setExportError(t.exportSection.missingSelection)
      return
    }
    setExportPending(true)
    setExportError(null)
    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 60_000)
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ dates: selectedExportList, locale }),
      })
      window.clearTimeout(timeoutId)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data.message ?? t.exportSection.exportFailed)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const filename = buildExportFilename(selectedExportList)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (err) {
      const message =
        (err as Error).name === 'AbortError' ? t.exportSection.exportFailed : (err as Error).message
      setExportError(message)
    } finally {
      setExportPending(false)
    }
  }

  const alertNode = (
    <AlertDialog
      open={Boolean(alertDialog)}
      title={alertDialog?.title ?? ''}
      description={alertDialog?.description}
      tone={alertDialog?.tone ?? 'info'}
      actionLabel={t.alerts.close}
      onClose={() => setAlertDialog(null)}
    />
  )

  if (authLoaded && !canView) {
    return (
      <>
        {alertNode}
        <AccessDenied
          locale={locale}
          permissions={['report:view', 'report:edit']}
          hint={t.accessHint}
        />
      </>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {alertNode}
      <ReportsHeader
        className="z-30 py-4"
        breadcrumbs={[{ label: breadcrumbHome, href: '/' }, { label: breadcrumbReports }]}
        title={breadcrumbReports}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <section className="mx-auto w-full max-w-[1700px] space-y-8 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.create.badge}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{t.create.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{t.create.description}</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input
                type="date"
                className="w-full min-w-[160px] rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-auto"
                value={selectedDate}
                onChange={(event) => handleDateChange(event.target.value)}
              />
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={handleCreate}
                disabled={!selectedDate || !canEdit}
              >
                {hasReportForSelectedDate ? t.create.viewButton : t.create.createButton}
              </button>
              <Link
                href={`/prototype?date=${selectedDate || '2026-01-12'}&locale=${locale}`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                {t.create.prototype}
              </Link>
            </div>
            {selectedDate ? (
              <p className="text-xs text-slate-500 md:text-right">
                {hasReportForSelectedDate ? t.create.hintFilled : t.create.hintEmpty}
              </p>
            ) : null}
          </div>
        </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.calendar.badge}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {monthLabel(monthCursor, dateLocale)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t.calendar.prevLabel}
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
              onClick={() => handleMonthChange(-1)}
            >
              {'<'}
            </button>
            <button
              type="button"
              aria-label={t.calendar.nextLabel}
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
              onClick={() => handleMonthChange(1)}
            >
              {'>'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t.calendar.weekdays.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-sm">
          {calendarDays.map((day) => {
            const iso = day.key
            const hasReport = reportDates.has(iso)
            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(iso)}
                className={`flex h-20 flex-col items-center justify-center rounded-2xl border text-sm transition ${
                  day.inCurrentMonth
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-transparent bg-slate-50 text-slate-400'
                } ${hasReport ? 'ring-2 ring-blue-500' : ''}`}
              >
                <span className="text-base font-semibold">{day.date.getDate()}</span>
                <span className="text-[10px] uppercase tracking-wide">
                  {hasReport ? t.calendar.filledLabel : t.calendar.pendingLabel}
                </span>
              </button>
            )
          })}
        </div>
        {hasMonthError ? (
          <p className="mt-3 text-xs text-red-600">{t.calendar.error}</p>
        ) : isMonthLoading ? (
          <p className="mt-3 text-xs text-slate-500">{t.calendar.loading}</p>
        ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.exportSection.badge}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{t.exportSection.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{t.exportSection.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={handleSelectAllExports}
              disabled={isMonthLoading || hasMonthError || monthReports.length === 0}
            >
              {t.exportSection.selectAll}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={handleClearExports}
              disabled={selectedExportDates.size === 0}
            >
              {t.exportSection.clearSelection}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              onClick={handleExportPdf}
              disabled={selectedExportDates.size === 0 || exportPending}
            >
              {exportPending ? t.exportSection.exporting : t.exportSection.exportButton}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">
            {formatCopy(t.exportSection.selectedCount, { count: selectedExportDates.size })}
          </span>
          <span className="text-xs text-slate-500">{t.exportSection.hint}</span>
        </div>
        {isMonthLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t.exportSection.loading}</p>
        ) : hasMonthError ? (
          <p className="mt-4 text-sm text-red-600">{t.exportSection.error}</p>
        ) : monthReports.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.exportSection.empty}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      checked={allExportSelected}
                      onChange={() => {
                        if (allExportSelected) {
                          handleClearExports()
                        } else {
                          handleSelectAllExports()
                        }
                      }}
                      disabled={monthReports.length === 0}
                      aria-label={t.exportSection.selectAll}
                    />
                  </th>
                  <th className="px-3 py-2">{t.exportSection.dateLabel}</th>
                  <th className="px-3 py-2">{t.exportSection.updatedLabel}</th>
                  <th className="px-3 py-2 text-right">{t.exportSection.actionLabel}</th>
                </tr>
              </thead>
              <tbody>
                {monthReports.map((entry) => {
                  const isSelected = selectedExportDates.has(entry.date)
                  return (
                    <tr
                      key={entry.date}
                      className={`border-b border-slate-100 ${
                        isSelected ? 'bg-blue-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          checked={isSelected}
                          onChange={() => toggleExportDate(entry.date)}
                          aria-label={`${t.exportSection.dateLabel} ${entry.date}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                        {entry.date}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {new Intl.DateTimeFormat(dateLocale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(entry.updatedAt))}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/reports/${entry.date}`}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {t.exportSection.view}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {exportError ? (
          <p className="mt-3 text-xs text-amber-700">{exportError}</p>
        ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t.recent.badge}
        </p>
        {isRecentLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t.recent.loading}</p>
        ) : hasRecentError ? (
          <p className="mt-4 text-sm text-red-600">{t.recent.error}</p>
        ) : recentReports.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.recent.empty}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentReports.map((entry) => (
              <li
                key={entry.date}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{entry.date}</p>
                  <p className="text-xs text-slate-500">
                    {t.recent.updatedPrefix}
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(entry.updatedAt))}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                  onClick={() => handleDayClick(entry.date)}
                >
                  {t.recent.view}
                </button>
              </li>
            ))}
          </ul>
        )}
        </section>
      </section>
    </main>
  )
}
