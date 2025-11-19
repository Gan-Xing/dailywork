'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export default function DashboardPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()))
  const [recentReports, setRecentReports] = useState<ReportSummary[]>([])
  const [monthReports, setMonthReports] = useState<ReportSummary[]>([])
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [isMonthLoading, setIsMonthLoading] = useState(true)
  const [isRecentLoading, setIsRecentLoading] = useState(true)
  const [monthError, setMonthError] = useState<string | null>(null)
  const [recentError, setRecentError] = useState<string | null>(null)

  const monthKey = useMemo(() => formatMonthKey(monthCursor), [monthCursor])

  const fetchMonthReports = useCallback(async (key: string) => {
    setIsMonthLoading(true)
    setMonthError(null)
    try {
      const response = await fetch(`/api/reports?month=${key}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load calendar data')
      }
      const data = (await response.json()) as { reports: ReportSummary[] }
      setMonthReports(data.reports)
    } catch (error) {
      setMonthError('加载历史记录失败。')
      setMonthReports([])
    } finally {
      setIsMonthLoading(false)
    }
  }, [])

  const fetchRecentReports = useCallback(async () => {
    setIsRecentLoading(true)
    setRecentError(null)
    try {
      const response = await fetch('/api/reports?limit=5', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load recent reports')
      }
      const data = (await response.json()) as { reports: ReportSummary[] }
      setRecentReports(data.reports)
    } catch (error) {
      setRecentError('加载最新日报失败。')
      setRecentReports([])
    } finally {
      setIsRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonthReports(monthKey)
  }, [fetchMonthReports, monthKey])

  useEffect(() => {
    fetchRecentReports()
  }, [fetchRecentReports])

  const reportDates = useMemo(
    () => new Set(monthReports.map((entry) => entry.date)),
    [monthReports],
  )

  const calendarDays = useMemo(() => buildCalendar(monthCursor), [monthCursor])

  const hasReportForSelectedDate = selectedDate ? reportDates.has(selectedDate) : false

  const handleCreate = () => {
    if (!selectedDate) return
    router.push(`/reports/${selectedDate}`)
  }

  const handleDayClick = (date: string) => {
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

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 lg:px-0">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">创建日报</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">选择日期，开始录入</h1>
            <p className="mt-1 text-sm text-slate-600">
              请选择尚未填报的日期，完成后内容会被保存并在首页高亮。
            </p>
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
                disabled={!selectedDate}
              >
                {hasReportForSelectedDate ? '查看该日报' : '创建并前往填报'}
              </button>
              <Link
                href="/prototype"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                查看原型图
              </Link>
            </div>
            {selectedDate ? (
              <p className="text-xs text-slate-500">
                {hasReportForSelectedDate
                  ? '该日期已经完成，可以查看或继续修改。'
                  : '该日期尚无日报，可直接创建。'}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">历史记录</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{monthLabel(monthCursor, 'zh-CN')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上个月"
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
              onClick={() => handleMonthChange(-1)}
            >
              {'<'}
            </button>
            <button
              type="button"
              aria-label="下个月"
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
              onClick={() => handleMonthChange(1)}
            >
              {'>'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {weekdayLabels.map((label) => (
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
                  day.inCurrentMonth ? 'border-slate-200 bg-white text-slate-900' : 'border-transparent bg-slate-50 text-slate-400'
                } ${hasReport ? 'ring-2 ring-blue-500' : ''}`}
              >
                <span className="text-base font-semibold">{day.date.getDate()}</span>
                <span className="text-[10px] uppercase tracking-wide">
                  {hasReport ? '已填' : '待填'}
                </span>
              </button>
            )
          })}
        </div>
        {monthError ? (
          <p className="mt-3 text-xs text-red-600">{monthError}</p>
        ) : isMonthLoading ? (
          <p className="mt-3 text-xs text-slate-500">日历加载中...</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">最近更新</p>
        {isRecentLoading ? (
          <p className="mt-4 text-sm text-slate-500">加载中...</p>
        ) : recentError ? (
          <p className="mt-4 text-sm text-red-600">{recentError}</p>
        ) : recentReports.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">还没有任何日报，先创建一条吧。</p>
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
                    最近更新：{new Intl.DateTimeFormat('zh-CN', {
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
                  查看
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
