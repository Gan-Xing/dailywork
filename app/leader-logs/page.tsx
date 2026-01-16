'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AlertDialog, type AlertTone } from '@/components/AlertDialog'
import { AccessDenied } from '@/components/AccessDenied'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { locales, type Locale } from '@/lib/i18n'
import {
  getLeaderLogsCopy,
  leaderLogBreadcrumbs,
  leaderLogDateLocales,
} from '@/lib/i18n/leaderLogs'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
  roles: { id: number; name: string }[]
}

type LeaderOption = {
  id: number
  username: string
  name: string
  frenchName: string | null
  label: string
}

type LeaderLogItem = {
  id: number
  date: string
  supervisorId: number
  supervisorName: string
  contentRaw: string
  createdAt: string
  updatedAt: string
}

const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)

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

const isAdminUser = (user: SessionUser | null) =>
  user?.roles.some((role) => role.name === 'Admin') ?? false

export default function LeaderLogsPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getLeaderLogsCopy(locale)
  const { home: breadcrumbHome, logs: breadcrumbLogs } = leaderLogBreadcrumbs[locale]
  const dateLocale = leaderLogDateLocales[locale]

  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()))
  const [monthCursor, setMonthCursor] = useState(() => new Date())

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [alertDialog, setAlertDialog] = useState<{ title: string; description: string; tone?: AlertTone } | null>(
    null,
  )

  const [leaderOptions, setLeaderOptions] = useState<LeaderOption[]>([])
  const [leaderLoading, setLeaderLoading] = useState(true)
  const [leaderError, setLeaderError] = useState<string | null>(null)

  const [logs, setLogs] = useState<LeaderLogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)

  const [monthDates, setMonthDates] = useState<Set<string>>(new Set())
  const [monthLoading, setMonthLoading] = useState(true)
  const [monthError, setMonthError] = useState<string | null>(null)

  const [recentLogs, setRecentLogs] = useState<LeaderLogItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorLogId, setEditorLogId] = useState<number | null>(null)
  const [editorDate, setEditorDate] = useState(selectedDate)
  const [editorLeaderId, setEditorLeaderId] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorReadOnly, setEditorReadOnly] = useState(false)

  const monthKey = useMemo(() => formatMonthKey(monthCursor), [monthCursor])
  const calendarDays = useMemo(() => buildCalendar(monthCursor), [monthCursor])
  const selectedDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(selectedDate)),
    [dateLocale, selectedDate],
  )

  const canView = session?.permissions.some((perm) => perm === 'report:view' || perm === 'report:edit') ?? false
  const canEdit = session?.permissions.includes('report:edit') ?? false
  const isAdmin = isAdminUser(session)

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

  const fetchLeaders = useCallback(async () => {
    setLeaderLoading(true)
    setLeaderError(null)
    try {
      const response = await fetch('/api/leader-logs/leaders', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load leaders')
      }
      const data = (await response.json()) as { leaders: LeaderOption[] }
      setLeaderOptions(data.leaders ?? [])
    } catch (error) {
      setLeaderError(error instanceof Error ? error.message : '加载负责人失败')
      setLeaderOptions([])
    } finally {
      setLeaderLoading(false)
    }
  }, [])

  const fetchLogsForDate = useCallback(async (date: string) => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const response = await fetch(`/api/leader-logs?date=${date}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load logs')
      }
      const data = (await response.json()) as { logs: LeaderLogItem[] }
      setLogs(data.logs ?? [])
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : '加载日志失败')
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [])

  const fetchMonthDates = useCallback(async (key: string) => {
    setMonthLoading(true)
    setMonthError(null)
    try {
      const response = await fetch(`/api/leader-logs?month=${key}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load month data')
      }
      const data = (await response.json()) as { dates: string[] }
      setMonthDates(new Set(data.dates ?? []))
    } catch (error) {
      setMonthError(error instanceof Error ? error.message : '加载日历失败')
      setMonthDates(new Set())
    } finally {
      setMonthLoading(false)
    }
  }, [])

  const fetchRecentLogs = useCallback(async () => {
    setRecentLoading(true)
    setRecentError(null)
    try {
      const response = await fetch('/api/leader-logs?limit=5', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load recent logs')
      }
      const data = (await response.json()) as { logs: LeaderLogItem[] }
      setRecentLogs(data.logs ?? [])
    } catch (error) {
      setRecentError(error instanceof Error ? error.message : '加载最近日志失败')
      setRecentLogs([])
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoaded) return
    if (!canView) {
      setLeaderLoading(false)
      setLogsLoading(false)
      setMonthLoading(false)
      setRecentLoading(false)
      return
    }
    void fetchLeaders()
  }, [authLoaded, canView, fetchLeaders])

  useEffect(() => {
    if (!authLoaded || !canView) return
    void fetchLogsForDate(selectedDate)
  }, [authLoaded, canView, fetchLogsForDate, selectedDate])

  useEffect(() => {
    if (!authLoaded || !canView) return
    void fetchMonthDates(monthKey)
  }, [authLoaded, canView, fetchMonthDates, monthKey])

  useEffect(() => {
    if (!authLoaded || !canView) return
    void fetchRecentLogs()
  }, [authLoaded, canView, fetchRecentLogs])

  const logsByLeaderId = useMemo(() => {
    const map = new Map<number, LeaderLogItem>()
    logs.forEach((log) => {
      map.set(log.supervisorId, log)
    })
    return map
  }, [logs])

  const leaderIdSet = useMemo(() => new Set(leaderOptions.map((leader) => leader.id)), [leaderOptions])

  const orphanLogs = useMemo(
    () => logs.filter((log) => !leaderIdSet.has(log.supervisorId)),
    [logs, leaderIdSet],
  )

  const totalLeaders = leaderOptions.length
  const filledLeaders = leaderOptions.filter((leader) => logsByLeaderId.has(leader.id)).length
  const pendingLeaders = Math.max(totalLeaders - filledLeaders, 0)
  const fillPercent = totalLeaders ? Math.round((filledLeaders / totalLeaders) * 100) : 0

  const orderedLeaders = useMemo(() => {
    if (!session?.id) return leaderOptions
    const current = leaderOptions.find((leader) => leader.id === session.id)
    const rest = leaderOptions.filter((leader) => leader.id !== session.id)
    return current ? [current, ...rest] : leaderOptions
  }, [leaderOptions, session?.id])

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

  const openAlert = (message: string, tone: AlertTone = 'warning') => {
    setAlertDialog({
      title: t.alerts.title,
      description: message,
      tone,
    })
  }

  const openCreate = (leader: LeaderOption) => {
    if (!canEdit) {
      openAlert(t.alerts.createDenied)
      return
    }
    if (!isAdmin && leader.id !== session?.id) {
      openAlert(t.list.readOnly)
      return
    }
    setEditorMode('create')
    setEditorLogId(null)
    setEditorDate(selectedDate)
    setEditorLeaderId(String(leader.id))
    setEditorContent('')
    setEditorError(null)
    setEditorReadOnly(false)
    setEditorOpen(true)
  }

  const openEdit = (log: LeaderLogItem) => {
    const editable = canEdit && (isAdmin || log.supervisorId === session?.id)
    setEditorMode('edit')
    setEditorLogId(log.id)
    setEditorDate(log.date)
    setEditorLeaderId(String(log.supervisorId))
    setEditorContent(log.contentRaw)
    setEditorError(null)
    setEditorReadOnly(!editable)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditorError(null)
    setEditorSaving(false)
    setEditorReadOnly(false)
  }

  const submitEditor = async () => {
    if (!editorDate) {
      setEditorError(t.formErrors.dateRequired)
      return
    }
    if (isAdmin && !editorLeaderId) {
      setEditorError(t.formErrors.leaderRequired)
      return
    }
    if (!editorContent.trim()) {
      setEditorError(t.formErrors.contentRequired)
      return
    }

    setEditorSaving(true)
    setEditorError(null)
    try {
      const isCreate = editorMode === 'create'
      const url = isCreate ? '/api/leader-logs' : `/api/leader-logs/${editorLogId}`
      const method = isCreate ? 'POST' : 'PUT'
      const payload = isCreate
        ? {
            logDate: editorDate,
            supervisorId: isAdmin ? Number(editorLeaderId) : undefined,
            contentRaw: editorContent,
          }
        : { contentRaw: editorContent }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.message ?? 'Failed to save')
      }
      setEditorOpen(false)
      setEditorSaving(false)
      if (editorMode === 'create' && editorDate !== selectedDate) {
        handleDateChange(editorDate)
      } else {
        void fetchLogsForDate(editorDate)
      }
      void fetchMonthDates(formatMonthKey(new Date(editorDate)))
      void fetchRecentLogs()
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : '保存失败')
      setEditorSaving(false)
    }
  }

  const editorLeaderLabel = useMemo(() => {
    const leaderId = Number(editorLeaderId)
    const leader = leaderOptions.find((item) => item.id === leaderId)
    return leader?.label ?? logsByLeaderId.get(leaderId)?.supervisorName ?? ''
  }, [editorLeaderId, leaderOptions, logsByLeaderId])

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
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-8 overflow-hidden bg-slate-50 px-4 py-10 sm:px-6 lg:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -left-16 top-32 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl" />
      </div>
      {alertNode}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 transition hover:bg-white"
          >
            {breadcrumbHome}
          </Link>
          <span className="text-slate-400">/</span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-slate-700">
            {breadcrumbLogs}
          </span>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} onChange={setLocale} />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
        <div className="absolute -right-20 -top-28 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t.header.title}</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t.header.subtitle}</h1>
            <p className="text-sm text-slate-500">{t.header.description}</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {t.stats.leaders} · {totalLeaders}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                {t.stats.filled} · {filledLeaders}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                {t.stats.pending} · {pendingLeaders}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>{t.stats.filled}</span>
                <span className="font-semibold text-slate-700">{fillPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t.list.badge}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">{selectedDateLabel}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t.stats.filled} {filledLeaders} · {t.stats.pending} {pendingLeaders}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            {leaderLoading || logsLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.calendar.loading}</p>
            ) : leaderError || logsError ? (
              <p className="mt-4 text-sm text-rose-500">{leaderError ?? logsError}</p>
            ) : totalLeaders === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t.list.empty}</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {orderedLeaders.map((leader) => {
                  const log = logsByLeaderId.get(leader.id)
                  const isSelf = leader.id === session?.id
                  const editable = canEdit && (isAdmin || isSelf)
                  return (
                    <div
                      key={leader.id}
                      className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
                        isSelf
                          ? 'border-sky-200 bg-sky-50/60 shadow-sky-100/70'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {isSelf ? (
                        <div className="absolute left-0 top-4 h-[calc(100%-2rem)] w-1 rounded-full bg-gradient-to-b from-sky-400 via-blue-400 to-emerald-300" />
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{leader.label}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            log
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {log ? t.list.filled : t.list.pending}
                        </span>
                      </div>
                      {log ? (
                        <>
                          <p className="mt-3 max-h-16 overflow-hidden text-sm text-slate-600">
                            {log.contentRaw}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <span>
                              {t.list.updatedPrefix} {formatDateTime(log.updatedAt, dateLocale)}
                            </span>
                            {editable ? (
                              <button
                                type="button"
                                onClick={() => openEdit(log)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                {t.list.edit}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(log)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                {t.list.view}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{t.list.empty}</span>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => openCreate(leader)}
                              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              {t.list.create}
                            </button>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                              {t.list.readOnly}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {orphanLogs.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {t.list.otherLeaders}
                    </p>
                    <div className="mt-2 space-y-2 text-sm text-slate-600">
                      {orphanLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3">
                          <span>{log.supervisorName}</span>
                          {canEdit && (isAdmin || log.supervisorId === session?.id) ? (
                            <button
                              type="button"
                              onClick={() => openEdit(log)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              {t.list.edit}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEdit(log)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              {t.list.view}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t.calendar.badge}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {monthLabel(monthCursor, dateLocale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMonthChange(-1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.calendar.prevLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleMonthChange(1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.calendar.nextLabel}
                </button>
              </div>
            </div>

            {monthLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.calendar.loading}</p>
            ) : monthError ? (
              <p className="mt-4 text-sm text-rose-500">{monthError}</p>
            ) : (
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                {t.calendar.weekdays.map((day) => (
                  <span key={day} className="font-semibold text-slate-400">
                    {day}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const isSelected = selectedDate === day.key
                  const hasLog = monthDates.has(day.key)
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => handleDateChange(day.key)}
                      className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-300/60'
                          : hasLog
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white/80 text-slate-700'
                      } ${day.inCurrentMonth ? '' : 'opacity-40'}`}
                    >
                      <span>{day.date.getDate()}</span>
                      <span className="text-[10px] font-medium">
                        {hasLog ? t.calendar.filledLabel : t.calendar.pendingLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.recent.badge}
              </p>
              <span className="text-xs text-slate-400">{recentLogs.length}</span>
            </div>
            {recentLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.recent.loading}</p>
            ) : recentError ? (
              <p className="mt-4 text-sm text-rose-500">{recentError}</p>
            ) : recentLogs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t.recent.empty}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{log.supervisorName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleDateChange(log.date)
                          openEdit(log)
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {t.recent.view}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{log.contentRaw}</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {t.recent.updatedPrefix} {formatDateTime(log.updatedAt, dateLocale)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/40">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {editorMode === 'create' ? t.form.createTitle : t.form.editTitle}
                </p>
                <p className="text-sm text-slate-500">{editorLeaderLabel}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                X
              </button>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                  {t.form.dateLabel}
                  <input
                    type="date"
                    value={editorDate}
                    onChange={(event) => setEditorDate(event.target.value)}
                    disabled={editorMode === 'edit' || editorReadOnly}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                  {t.form.leaderLabel}
                  <select
                    value={editorLeaderId}
                    onChange={(event) => setEditorLeaderId(event.target.value)}
                    disabled={!isAdmin || editorMode === 'edit' || editorReadOnly}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  >
                    <option value="">{t.form.leaderLabel}</option>
                    {leaderOptions.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                {t.form.contentHint}
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                {t.form.contentLabel}
                <textarea
                  value={editorContent}
                  onChange={(event) => setEditorContent(event.target.value)}
                  rows={8}
                  disabled={editorReadOnly}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  placeholder={t.form.contentPlaceholder}
                />
              </label>
              {editorError ? <p className="text-sm text-rose-500">{editorError}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {t.form.cancel}
              </button>
              {editorReadOnly ? null : (
                <button
                  type="button"
                  onClick={submitEditor}
                  disabled={editorSaving}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editorSaving ? `${t.form.save}...` : t.form.save}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
