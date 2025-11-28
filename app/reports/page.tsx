'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

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

const dateLocales: Record<Locale, string> = {
  fr: 'fr-FR',
  zh: 'zh-CN',
}

type LandingCopy = {
  create: {
    badge: string
    title: string
    description: string
    createButton: string
    viewButton: string
    prototype: string
    hintFilled: string
    hintEmpty: string
  }
  calendar: {
    badge: string
    prevLabel: string
    nextLabel: string
    filledLabel: string
    pendingLabel: string
    loading: string
    error: string
    weekdays: string[]
  }
  recent: {
    badge: string
    loading: string
    error: string
    empty: string
    view: string
    updatedPrefix: string
  }
}

const landingCopy: Record<Locale, LandingCopy> = {
  zh: {
    create: {
      badge: '创建日报',
      title: '选择日期，开始录入',
      description: '请选择尚未填报的日期，完成后内容会被保存并在首页高亮。',
      createButton: '创建并前往填报',
      viewButton: '查看该日报',
      prototype: '查看原型图',
      hintFilled: '该日期已经完成，可以查看或继续修改。',
      hintEmpty: '该日期尚无日报，可直接创建。',
    },
    calendar: {
      badge: '历史记录',
      prevLabel: '上个月',
      nextLabel: '下个月',
      filledLabel: '已填',
      pendingLabel: '待填',
      loading: '日历加载中...',
      error: '加载历史记录失败。',
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    },
    recent: {
      badge: '最近更新',
      loading: '加载中...',
      error: '加载最新日报失败。',
      empty: '还没有任何日报，先创建一条吧。',
      view: '查看',
      updatedPrefix: '最近更新：',
    },
  },
  fr: {
    create: {
      badge: 'Créer un rapport',
      title: 'Choisissez la date et commencez la saisie',
      description:
        "Sélectionnez une journée non renseignée; une fois enregistrée, elle sera mise en avant sur l'accueil.",
      createButton: 'Créer et ouvrir',
      viewButton: 'Ouvrir ce rapport',
      prototype: 'Voir la maquette',
      hintFilled: 'Cette date est déjà renseignée; vous pouvez la consulter ou la modifier.',
      hintEmpty: 'Aucun rapport pour cette date, vous pouvez le créer.',
    },
    calendar: {
      badge: 'Historique',
      prevLabel: 'Mois précédent',
      nextLabel: 'Mois suivant',
      filledLabel: 'Déclaré',
      pendingLabel: 'À remplir',
      loading: 'Chargement du calendrier...',
      error: "Impossible de charger l'historique.",
      weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    },
    recent: {
      badge: 'Mises à jour récentes',
      loading: 'Chargement...',
      error: 'Échec du chargement des derniers rapports.',
      empty: 'Aucun rapport pour le moment, créez le premier.',
      view: 'Voir',
      updatedPrefix: 'Dernière mise à jour : ',
    },
  },
}

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

export default function ReportsLandingPage() {
  const router = useRouter()
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = landingCopy[locale]
  const breadcrumbHome = locale === 'fr' ? 'Accueil' : '首页'
  const breadcrumbReports = locale === 'fr' ? 'Rapports journaliers' : '日报管理'
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

  const monthKey = useMemo(() => formatMonthKey(monthCursor), [monthCursor])
  const dateLocale = dateLocales[locale]

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

  const reportDates = useMemo(
    () => new Set(monthReports.map((entry) => entry.date)),
    [monthReports],
  )

  const calendarDays = useMemo(() => buildCalendar(monthCursor), [monthCursor])

  const hasReportForSelectedDate = selectedDate ? reportDates.has(selectedDate) : false

  const handleCreate = () => {
    if (!selectedDate) return
    if (!canEdit) {
      window.alert('缺少 report:edit 权限，无法创建或修改日报。')
      return
    }
    router.push(`/reports/${selectedDate}`)
  }

  const handleDayClick = (date: string) => {
    if (!canView) {
      window.alert('缺少 report:view 权限，无法查看日报。')
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

  if (authLoaded && !canView) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['report:view', 'report:edit']}
        hint={locale === 'fr' ? "Contactez l'admin pour obtenir l'accès à la consultation/édition des rapports." : '需要拥有 report:view 或 report:edit 权限才能创建或查看日报。'}
      />
    )
  }

  return (
    <main className="relative mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 lg:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 transition hover:bg-white"
          >
            {breadcrumbHome}
          </Link>
          <span className="text-slate-400">/</span>
          <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-slate-800">
            {breadcrumbReports}
          </span>
        </nav>
        <LocaleSwitcher locale={locale} onChange={setLocale} variant="light" />
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.create.badge}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{t.create.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{t.create.description}</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 md:w-auto"
              value={selectedDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={handleCreate}
                disabled={!selectedDate || !canEdit}
              >
                {hasReportForSelectedDate ? t.create.viewButton : t.create.createButton}
              </button>
              <Link
                href="/prototype"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                {t.create.prototype}
              </Link>
            </div>
            {selectedDate ? (
              <p className="text-xs text-slate-500">
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
    </main>
  )
}
