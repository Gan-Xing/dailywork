'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Libre_Bodoni, Public_Sans } from 'next/font/google'

import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import {
  getLogExtractorCopy,
  logExtractorBreadcrumbs,
  logExtractorDateLocales,
} from '@/lib/i18n/logExtractor'
import {
  DEFAULT_LOG_EXTRACTION_PROMPT,
  createEmptyLogExtractionOutput,
  type LogExtractionOutput,
} from '@/lib/logExtraction'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import { ReportsHeader } from '../ReportsHeader'

const headingFont = Libre_Bodoni({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const bodyFont = Public_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type LeaderLogItem = {
  id: number
  date: string
  supervisorId: number
  supervisorName: string
  contentRaw: string
  photoCount: number
  createdAt: string
  updatedAt: string
}

const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

const formatDateLabel = (value: string, locale: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
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

const hasOutputContent = (output: LogExtractionOutput) => {
  const values = [
    output.observations.security,
    output.observations.environment,
    output.observations.general,
    output.observations.special,
    output.works.preparation,
    output.works.earthwork,
    output.works.pavement,
    output.works.drainage,
    output.works.safety,
    output.works.geotech,
    output.works.otherWork,
    output.controls.beTopo,
    output.controls.quarry,
    output.controls.subcontract,
    output.controls.other,
  ]
  return values.some((value) => {
    const trimmed = value.trim()
    if (!trimmed) return false
    if (trimmed.toUpperCase() === 'RAS') return false
    return true
  })
}

export default function LogExtractorPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getLogExtractorCopy(locale)
  const dateLocale = logExtractorDateLocales[locale]
  const { home: breadcrumbHome, reports: breadcrumbReports, extractor: breadcrumbExtractor } =
    logExtractorBreadcrumbs[locale]

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()))

  const [logs, setLogs] = useState<LeaderLogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set())
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  const [promptText, setPromptText] = useState(DEFAULT_LOG_EXTRACTION_PROMPT)
  const [promptLoaded, setPromptLoaded] = useState(false)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptSavedAt, setPromptSavedAt] = useState<string | null>(null)
  const [promptError, setPromptError] = useState<string | null>(null)
  const lastSavedRef = useRef('')

  const [output, setOutput] = useState<LogExtractionOutput>(() => createEmptyLogExtractionOutput())
  const [previewOutput, setPreviewOutput] = useState<LogExtractionOutput | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

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

  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch('/api/log-extractor/config', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('加载抽取规则失败')
      }
      const data = (await res.json()) as { promptText?: string; updatedAt?: string | null }
      const nextPrompt = data.promptText?.trim() || DEFAULT_LOG_EXTRACTION_PROMPT
      setPromptText(nextPrompt)
      lastSavedRef.current = nextPrompt
      setPromptSavedAt(data.updatedAt ?? null)
      setPromptError(null)
    } catch (error) {
      setPromptError((error as Error).message)
      setPromptText(DEFAULT_LOG_EXTRACTION_PROMPT)
    } finally {
      setPromptLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!authLoaded || !canView) return
    void fetchPrompt()
  }, [authLoaded, canView, fetchPrompt])

  useEffect(() => {
    if (!promptLoaded || !canEdit) return
    if (promptText.trim() === lastSavedRef.current.trim()) return

    const handler = setTimeout(async () => {
      setPromptSaving(true)
      setPromptError(null)
      try {
        const res = await fetch('/api/log-extractor/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ promptText }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { message?: string }
          throw new Error(data.message ?? '保存失败')
        }
        const data = (await res.json()) as { updatedAt?: string | null; promptText?: string }
        lastSavedRef.current = data.promptText ?? promptText
        setPromptSavedAt(data.updatedAt ?? null)
      } catch (error) {
        setPromptError((error as Error).message)
      } finally {
        setPromptSaving(false)
      }
    }, 800)

    return () => clearTimeout(handler)
  }, [promptLoaded, promptText, canEdit])

  const fetchLogs = useCallback(async () => {
    if (!selectedDate) return
    setLogsLoading(true)
    setLogsError(null)
    setActionError(null)
    try {
      const res = await fetch(`/api/leader-logs?date=${selectedDate}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? '加载日志失败')
      }
      const data = (await res.json()) as { logs?: LeaderLogItem[] }
      const items = data.logs ?? []
      setLogs(items)
      setSelectedLogIds(new Set(items.map((item) => item.id)))
      setExpandedLogs(new Set())
      setOutput(createEmptyLogExtractionOutput())
      setPreviewOutput(null)
      setActionSuccess(null)
    } catch (error) {
      setLogsError((error as Error).message)
      setLogs([])
      setSelectedLogIds(new Set())
    } finally {
      setLogsLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (!authLoaded || !canView) return
    void fetchLogs()
  }, [authLoaded, canView, fetchLogs])

  useEffect(() => {
    setPreviewOutput(null)
  }, [output])

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim()
    if (!term) return logs
    return logs.filter((log) =>
      `${log.supervisorName} ${log.contentRaw}`.toLowerCase().includes(term.toLowerCase()),
    )
  }, [logs, searchTerm])

  const selectedCount = selectedLogIds.size
  const allSelected = logs.length > 0 && selectedLogIds.size === logs.length
  const outputReady = hasOutputContent(output)

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLogIds(new Set())
      return
    }
    setSelectedLogIds(new Set(logs.map((log) => log.id)))
  }

  const toggleLogSelection = (id: number) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleExpand = (id: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExtract = async () => {
    if (!selectedLogIds.size) {
      setActionError(t.actions.selectLogWarning)
      return
    }
    setExtracting(true)
    setActionError(null)
    setActionSuccess(null)
    setPreviewOutput(null)
    try {
      const res = await fetch('/api/log-extractor/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate,
          logIds: Array.from(selectedLogIds),
          promptText,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? t.actions.extractFailed)
      }
      const data = (await res.json()) as { output?: LogExtractionOutput }
      setOutput(data.output ?? createEmptyLogExtractionOutput())
      setActionSuccess(t.actions.extractSuccess)
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  const handlePreview = async () => {
    if (!canEdit) {
      setActionError(t.actions.permissionDenied)
      return
    }
    if (!outputReady) {
      setActionError(t.actions.previewWarning)
      return
    }
    setPreviewing(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await fetch('/api/log-extractor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate,
          output,
          dryRun: true,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? t.actions.previewFailed)
      }
      const data = (await res.json()) as { mergedOutput?: LogExtractionOutput }
      setPreviewOutput(data.mergedOutput ?? null)
      setActionSuccess(t.actions.previewSuccess)
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      setPreviewing(false)
    }
  }

  const handleApply = async () => {
    if (!canEdit) {
      setActionError(t.actions.permissionDenied)
      return
    }
    if (!previewOutput) {
      setActionError(t.actions.applyWarning)
      return
    }
    setApplying(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await fetch('/api/log-extractor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate,
          output,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? t.actions.applyFailed)
      }
      setActionSuccess(t.actions.applySuccess)
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      setApplying(false)
    }
  }

  if (authLoaded && !canView) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['report:view', 'report:edit']}
        hint={t.accessHint}
      />
    )
  }

  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${bodyFont.className}`}>
      <ReportsHeader
        className="z-30 py-4"
        breadcrumbs={[
          { label: breadcrumbHome, href: '/' },
          { label: breadcrumbReports, href: '/reports' },
          { label: breadcrumbExtractor },
        ]}
        title={breadcrumbExtractor}
        locale={locale}
        onLocaleChange={setLocale}
      />

      <section className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-6 overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.3fr,1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {t.header.title}
              </p>
              <h1 className={`text-2xl font-semibold text-slate-900 sm:text-3xl ${headingFont.className}`}>
                {t.header.subtitle}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{t.header.description}</p>
            </div>
            <div className="grid gap-3 text-xs text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.rules.title}
              </p>
              <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                {t.rules.items.map((rule) => (
                  <p key={rule} className="text-xs text-slate-600">
                    {rule}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,1.2fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.panels.logs.title}
                  </p>
                  <h2 className={`text-lg font-semibold text-slate-900 ${headingFont.className}`}>
                    {t.panels.logs.description}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    {t.logs.selectedLabel} {selectedCount}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                    {formatDateLabel(selectedDate, dateLocale)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.logs.dateLabel}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    {allSelected ? t.logs.clearSelection : t.logs.selectAll}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{t.logs.totalLabel}</span>
                    <span className="font-semibold text-slate-700">{logs.length}</span>
                  </div>
                </div>

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.logs.searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />

                {logsLoading ? (
                  <p className="text-sm text-slate-500">{t.logs.loading}</p>
                ) : logsError ? (
                  <p className="text-sm text-rose-500">{logsError}</p>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.logs.empty}</p>
                ) : (
                  <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                    {filteredLogs.map((log) => {
                      const selected = selectedLogIds.has(log.id)
                      const expanded = expandedLogs.has(log.id)
                      const content = log.contentRaw?.trim() || ''
                      const hasContent = Boolean(content)
                      return (
                        <div
                          key={log.id}
                          className={`rounded-2xl border p-4 transition ${
                            selected
                              ? 'border-sky-200 bg-sky-50/70 shadow-sm'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleLogSelection(log.id)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {log.supervisorName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(log.updatedAt, dateLocale)} · {t.logs.photoLabel} {log.photoCount}
                                </p>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                            >
                              {expanded ? t.logs.collapse : t.logs.expand}
                            </button>
                          </div>
                          <div className="mt-3 text-sm text-slate-700">
                            {hasContent ? (
                              <p className={`${expanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>{content}</p>
                            ) : (
                              <p className="text-xs text-slate-400">{t.logs.noContent}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.panels.prompt.title}
                  </p>
                  <h2 className={`text-lg font-semibold text-slate-900 ${headingFont.className}`}>
                    {t.panels.prompt.description}
                  </h2>
                </div>
                <div className="text-xs text-slate-500">
                  {promptSaving ? t.prompt.saving : t.prompt.saved}
                  {promptSavedAt ? ` · ${formatDateTime(promptSavedAt, dateLocale)}` : ''}
                </div>
              </div>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                rows={6}
                placeholder={t.prompt.placeholder}
                disabled={!canEdit}
                className="mt-4 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              {promptError ? (
                <p className="mt-2 text-xs text-rose-500">{promptError}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{canEdit ? t.prompt.hint : t.prompt.readonlyHint}</p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.panels.output.title}
                  </p>
                  <h2 className={`text-lg font-semibold text-slate-900 ${headingFont.className}`}>
                    {t.panels.output.description}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={extracting || !selectedLogIds.size}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {extracting ? t.actions.extracting : t.actions.extract}
                  </button>
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing || !canEdit || !outputReady}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {previewing ? t.actions.previewing : t.actions.preview}
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={applying || !previewOutput || !canEdit}
                    className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {applying ? t.actions.applying : t.actions.apply}
                  </button>
                </div>
              </div>

              {actionError ? <p className="mt-3 text-xs text-rose-500">{actionError}</p> : null}
              {actionSuccess ? <p className="mt-3 text-xs text-emerald-600">{actionSuccess}</p> : null}

              <div className="mt-5 grid gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{t.output.observations}</p>
                  <div className="mt-3 grid gap-3">
                    <FieldTextarea
                      label={t.output.security}
                      value={output.observations.security}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          observations: { ...prev.observations, security: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.environment}
                      value={output.observations.environment}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          observations: { ...prev.observations, environment: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.general}
                      value={output.observations.general}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          observations: { ...prev.observations, general: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.special}
                      value={output.observations.special}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          observations: { ...prev.observations, special: value },
                        }))
                      }
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{t.output.works}</p>
                  <div className="mt-3 grid gap-3">
                    <FieldTextarea
                      label={t.output.preparation}
                      value={output.works.preparation}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, preparation: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.earthwork}
                      value={output.works.earthwork}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, earthwork: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.pavement}
                      value={output.works.pavement}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, pavement: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.drainage}
                      value={output.works.drainage}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, drainage: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.safety}
                      value={output.works.safety}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, safety: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.geotech}
                      value={output.works.geotech}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, geotech: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.otherWork}
                      value={output.works.otherWork}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          works: { ...prev.works, otherWork: value },
                        }))
                      }
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{t.output.controls}</p>
                  <div className="mt-3 grid gap-3">
                    <FieldTextarea
                      label={t.output.beTopo}
                      value={output.controls.beTopo}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, beTopo: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.quarry}
                      value={output.controls.quarry}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, quarry: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.subcontract}
                      value={output.controls.subcontract}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, subcontract: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.other}
                      value={output.controls.other}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, other: value },
                        }))
                      }
                    />
                  </div>
                </section>
              </div>
            </section>

            {previewOutput ? (
              <section className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-6 shadow-xl shadow-amber-200/30 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                      {t.panels.preview.title}
                    </p>
                    <h2 className={`text-lg font-semibold text-slate-900 ${headingFont.className}`}>
                      {t.panels.preview.description}
                    </h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <PreviewBlock title={t.output.observations}>
                    <PreviewItem label={t.output.security} value={previewOutput.observations.security} />
                    <PreviewItem label={t.output.environment} value={previewOutput.observations.environment} />
                    <PreviewItem label={t.output.general} value={previewOutput.observations.general} />
                    <PreviewItem label={t.output.special} value={previewOutput.observations.special} />
                  </PreviewBlock>
                  <PreviewBlock title={t.output.works}>
                    <PreviewItem label={t.output.preparation} value={previewOutput.works.preparation} />
                    <PreviewItem label={t.output.earthwork} value={previewOutput.works.earthwork} />
                    <PreviewItem label={t.output.pavement} value={previewOutput.works.pavement} />
                    <PreviewItem label={t.output.drainage} value={previewOutput.works.drainage} />
                    <PreviewItem label={t.output.safety} value={previewOutput.works.safety} />
                    <PreviewItem label={t.output.geotech} value={previewOutput.works.geotech} />
                    <PreviewItem label={t.output.otherWork} value={previewOutput.works.otherWork} />
                  </PreviewBlock>
                  <PreviewBlock title={t.output.controls}>
                    <PreviewItem label={t.output.beTopo} value={previewOutput.controls.beTopo} />
                    <PreviewItem label={t.output.quarry} value={previewOutput.controls.quarry} />
                    <PreviewItem label={t.output.subcontract} value={previewOutput.controls.subcontract} />
                    <PreviewItem label={t.output.other} value={previewOutput.controls.other} />
                  </PreviewBlock>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}

type FieldTextareaProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function FieldTextarea({ label, value, onChange }: FieldTextareaProps) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
    </label>
  )
}

type PreviewBlockProps = {
  title: string
  children: ReactNode
}

function PreviewBlock({ title, children }: PreviewBlockProps) {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-white/70 px-4 py-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-700">{children}</div>
    </div>
  )
}

type PreviewItemProps = {
  label: string
  value: string
}

function PreviewItem({ label, value }: PreviewItemProps) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="text-sm text-slate-800">{value || '—'}</span>
    </div>
  )
}
