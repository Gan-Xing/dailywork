'use client'

import { useEffect, useMemo, useState } from 'react'
import { Libre_Bodoni, Public_Sans } from 'next/font/google'

import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import {
  getLogExtractorCopy,
  logExtractorBreadcrumbs,
  logExtractorDateLocales,
} from '@/lib/i18n/logExtractor'
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

type ExtractedOutput = {
  observations: {
    security: string
    environment: string
    general: string
    special: string
  }
  works: {
    preparation: string
    earthwork: string
    pavement: string
    drainage: string
    safety: string
    geotech: string
    otherWork: string
  }
  controls: {
    beTopo: string
    quarry: string
    subcontract: string
    other: string
  }
  survey: string
  quarry: string
  subcontract: string
  other: string
}

type ExtractedOutputPatch = Omit<Partial<ExtractedOutput>, 'observations' | 'works' | 'controls'> & {
  observations?: Partial<ExtractedOutput['observations']>
  works?: Partial<ExtractedOutput['works']>
  controls?: Partial<ExtractedOutput['controls']>
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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildEmptyOutput = (): ExtractedOutput => ({
  observations: {
    security: 'RAS',
    environment: '',
    general: '',
    special: '',
  },
  works: {
    preparation: '',
    earthwork: '',
    pavement: '',
    drainage: '',
    safety: '',
    geotech: '',
    otherWork: '',
  },
  controls: {
    beTopo: '',
    quarry: '',
    subcontract: '',
    other: '',
  },
  survey: '',
  quarry: '',
  subcontract: '',
  other: '',
})

const mergeOutput = (base: ExtractedOutput, patch: ExtractedOutputPatch): ExtractedOutput => ({
  ...base,
  ...patch,
  observations: {
    ...base.observations,
    ...patch.observations,
  },
  works: {
    ...base.works,
    ...patch.works,
  },
  controls: {
    ...base.controls,
    ...patch.controls,
  },
})

const fieldMatchers: Array<{ path: string; labels: string[] }> = [
  { path: 'observations.security', labels: ['安保', '安全', '巡查', '门禁', '巡逻'] },
  { path: 'observations.environment', labels: ['环境', '扬尘', '噪音', '水土保持'] },
  { path: 'observations.general', labels: ['总体观察', '现场观察', '总体'] },
  { path: 'observations.special', labels: ['特殊事件', '事故', '封路', '来访'] },
  { path: 'works.preparation', labels: ['前期准备'] },
  { path: 'works.earthwork', labels: ['土方工程', '土方'] },
  { path: 'works.pavement', labels: ['路面工程', '路面'] },
  { path: 'works.drainage', labels: ['排水与涵洞', '排水', '涵洞'] },
  { path: 'works.safety', labels: ['安保与交安', '交安'] },
  { path: 'works.geotech', labels: ['岩土/试验', '岩土', '试验'] },
  { path: 'controls.beTopo', labels: ['BE/Topo'] },
  { path: 'controls.other', labels: ['Observations / Divers'] },
  { path: 'survey', labels: ['技术/测量', '测量', '放样', '复测'] },
  { path: 'subcontract', labels: ['分包工程'] },
  { path: 'other', labels: ['其他事项'] },
]

const parseStructuredLines = (raw: string): ExtractedOutputPatch => {
  const result: Record<string, string[]> = {}
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    for (const matcher of fieldMatchers) {
      for (const label of matcher.labels) {
        const regex = new RegExp(`^${escapeRegex(label)}\\s*[:：]\\s*(.+)$`, 'i')
        const match = line.match(regex)
        if (!match) continue
        if (!result[matcher.path]) result[matcher.path] = []
        result[matcher.path].push(match[1].trim())
      }
    }
  }

  const patch: ExtractedOutputPatch = {}
  const observationsPatch: Partial<ExtractedOutput['observations']> = {}
  const worksPatch: Partial<ExtractedOutput['works']> = {}
  const controlsPatch: Partial<ExtractedOutput['controls']> = {}
  const topLevelPatch: Partial<Pick<ExtractedOutput, 'survey' | 'quarry' | 'subcontract' | 'other'>> = {}

  Object.entries(result).forEach(([path, values]) => {
    const merged = values.filter(Boolean).join('；')
    if (!merged) return
    if (path.startsWith('observations.')) {
      const key = path.replace('observations.', '') as keyof ExtractedOutput['observations']
      observationsPatch[key] = merged
      return
    }
    if (path.startsWith('works.')) {
      const key = path.replace('works.', '') as keyof ExtractedOutput['works']
      worksPatch[key] = merged
      return
    }
    if (path.startsWith('controls.')) {
      const key = path.replace('controls.', '') as keyof ExtractedOutput['controls']
      controlsPatch[key] = merged
      return
    }
    switch (path) {
      case 'survey':
      case 'quarry':
      case 'subcontract':
      case 'other':
        topLevelPatch[path] = merged
        break
      default:
        break
    }
  })

  if (Object.keys(observationsPatch).length) patch.observations = observationsPatch
  if (Object.keys(worksPatch).length) patch.works = worksPatch
  if (Object.keys(controlsPatch).length) patch.controls = controlsPatch
  Object.assign(patch, topLevelPatch)

  return patch
}

const filterNoise = (raw: string, noiseWords: string[]) => {
  if (!noiseWords.length) return raw
  const normalizedWords = noiseWords.map((word) => word.trim()).filter(Boolean)
  if (!normalizedWords.length) return raw
  return raw
    .split(/\r?\n/)
    .filter((line) => !normalizedWords.some((word) => line.includes(word)))
    .join('\n')
}

const renderOutputText = (output: ExtractedOutput) => {
  const security = output.observations.security.trim() || 'RAS'
  return [
    '安全与环境观察',
    `- 安保：${security}`,
    `- 环境：${output.observations.environment}`,
    `- 总体观察：${output.observations.general}`,
    `- 特殊事件：${output.observations.special}`,
    '',
    '施工内容',
    `- 前期准备：${output.works.preparation}`,
    `- 土方工程：${output.works.earthwork}`,
    `- 路面工程：${output.works.pavement}`,
    `- 排水与涵洞：${output.works.drainage}`,
    `- 安保与交安：${output.works.safety}`,
    `- 岩土/试验：${output.works.geotech}`,
    `- 其他：${output.works.otherWork}`,
    '',
    'Contrôles',
    `- BE/Topo：${output.controls.beTopo}`,
    `- 采石场：${output.controls.quarry}`,
    `- 分包：${output.controls.subcontract}`,
    `- Observations / Divers：${output.controls.other}`,
    '',
    `技术/测量：${output.survey}`,
    `采石场：${output.quarry}`,
    `分包工程：${output.subcontract}`,
    `其他事项：${output.other}`,
  ].join('\n')
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
  const [dateMode, setDateMode] = useState<'preset' | 'custom'>('preset')
  const [customDate, setCustomDate] = useState(selectedDate)

  const [rawLogs, setRawLogs] = useState('')
  const [leaderPattern, setLeaderPattern] = useState('')
  const [noiseInput, setNoiseInput] = useState('')
  const [noiseWords, setNoiseWords] = useState<string[]>([])

  const [output, setOutput] = useState<ExtractedOutput>(() => buildEmptyOutput())
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const canView = session?.permissions.some((perm) => perm === 'report:view' || perm === 'report:edit') ?? false

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
    if (!statusMessage) return
    const timer = setTimeout(() => setStatusMessage(null), 2200)
    return () => clearTimeout(timer)
  }, [statusMessage])

  const presetDates = useMemo(() => {
    const today = new Date()
    const items = Array.from({ length: 21 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - index)
      const value = formatDateInput(date)
      return {
        value,
        label: formatDateLabel(value, dateLocale),
      }
    })

    if (!items.find((item) => item.value === selectedDate)) {
      items.unshift({
        value: selectedDate,
        label: formatDateLabel(selectedDate, dateLocale),
      })
    }

    return items
  }, [dateLocale, selectedDate])

  const detectedDates = useMemo(() => {
    const isoMatches = rawLogs.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []
    const slashMatches = rawLogs.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? []
    return Array.from(new Set([...isoMatches, ...slashMatches]))
  }, [rawLogs])

  const otherDates = useMemo(
    () => detectedDates.filter((value) => value !== selectedDate),
    [detectedDates, selectedDate],
  )

  const promptText = useMemo(() => {
    const noiseLine = noiseWords.length ? `噪声过滤词：${noiseWords.join('、')}` : '噪声过滤词：无'
    const leaderLine = leaderPattern.trim() ? `负责人习惯：${leaderPattern.trim()}` : ''
    return [
      `请从原始日志中抽取信息，填入日期 ${selectedDate} 的日报。`,
      '抽取信息只能填写到对应日期的日报，其他日期一律忽略。',
      '字段仅限以下范围，禁止新增字段或输出无关内容：',
      '安全与环境观察：安保、环境、总体观察、特殊事件。',
      '施工内容：前期准备、土方工程、路面工程、排水与涵洞、安保与交安、岩土/试验、其他。',
      'Contrôles：BE/Topo、采石场、分包、Observations / Divers。',
      '技术/测量、采石场、分包工程、其他事项。',
      '规则：',
      '1) 安保缺失必须填 “RAS”，其余字段缺失保持空白。',
      '2) 施工内容空白表示无作业，不要强行填充。',
      '3) 输出仅中文，不需要法语。',
      leaderLine,
      noiseLine,
      '',
      '输出模板如下（保持字段顺序与名称）：',
      '安全与环境观察',
      '- 安保：',
      '- 环境：',
      '- 总体观察：',
      '- 特殊事件：',
      '',
      '施工内容',
      '- 前期准备：',
      '- 土方工程：',
      '- 路面工程：',
      '- 排水与涵洞：',
      '- 安保与交安：',
      '- 岩土/试验：',
      '- 其他：',
      '',
      'Contrôles',
      '- BE/Topo：',
      '- 采石场：',
      '- 分包：',
      '- Observations / Divers：',
      '',
      '技术/测量：',
      '采石场：',
      '分包工程：',
      '其他事项：',
      '',
      '原始日志：',
      rawLogs.trim() ? rawLogs.trim() : '（无）',
    ]
      .filter(Boolean)
      .join('\n')
  }, [leaderPattern, noiseWords, rawLogs, selectedDate])

  const outputText = useMemo(() => renderOutputText(output), [output])

  const handleExtract = () => {
    const filteredRaw = filterNoise(rawLogs, noiseWords)
    const parsed = parseStructuredLines(filteredRaw)
    const emptyOutput = buildEmptyOutput()
    setOutput(mergeOutput(emptyOutput, parsed))
  }

  const handleClear = () => {
    setRawLogs('')
    setLeaderPattern('')
    setNoiseWords([])
    setNoiseInput('')
    setOutput(buildEmptyOutput())
    setStatusMessage(null)
  }

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setStatusMessage(message)
    } catch {
      setStatusMessage('复制失败')
    }
  }

  const addNoiseWord = () => {
    const trimmed = noiseInput.trim()
    if (!trimmed) return
    if (noiseWords.includes(trimmed)) {
      setNoiseInput('')
      return
    }
    setNoiseWords((prev) => [...prev, trimmed])
    setNoiseInput('')
  }

  if (authLoaded && !canView) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['report:view', 'report:edit']}
        hint="需要拥有 report:view 或 report:edit 权限才能抽取日志。"
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

        <div className="grid gap-6 xl:grid-cols-[1.08fr,1fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.panels.inputs.title}
                  </p>
                  <h2 className={`text-lg font-semibold text-slate-900 ${headingFont.className}`}>
                    {t.panels.inputs.description}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{t.form.lockLabel}</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                    {formatDateLabel(selectedDate, dateLocale)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.form.dateLabel}
                </label>
                <div className="grid gap-3 md:grid-cols-[1fr,1fr]">
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] text-slate-500">{t.form.presetLabel}</span>
                    <select
                      value={dateMode === 'custom' ? 'custom' : selectedDate}
                      onChange={(event) => {
                        const value = event.target.value
                        if (value === 'custom') {
                          setDateMode('custom')
                          return
                        }
                        setDateMode('preset')
                        setSelectedDate(value)
                        setCustomDate(value)
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      {presetDates.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value="custom">{t.form.customLabel}</option>
                    </select>
                  </div>
                  {dateMode === 'custom' ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] text-slate-500">{t.form.customLabel}</span>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(event) => {
                          setCustomDate(event.target.value)
                          setSelectedDate(event.target.value)
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">{t.form.dateHint}</p>

                <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t.form.leaderLabel}
                    </label>
                    <textarea
                      value={leaderPattern}
                      onChange={(event) => setLeaderPattern(event.target.value)}
                      rows={3}
                      placeholder={t.form.leaderPlaceholder}
                      className="min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t.form.noiseLabel}
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={noiseInput}
                        onChange={(event) => setNoiseInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addNoiseWord()
                          }
                        }}
                        placeholder={t.form.noisePlaceholder}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      />
                      <button
                        type="button"
                        onClick={addNoiseWord}
                        className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        {t.form.noiseAdd}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {noiseWords.map((word) => (
                        <button
                          type="button"
                          key={word}
                          onClick={() => setNoiseWords((prev) => prev.filter((item) => item !== word))}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          {word}
                        </button>
                      ))}
                      {noiseWords.length === 0 ? (
                        <span className="text-[11px] text-slate-400">{t.hints.noiseEmpty}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.form.rawLabel}
                  </label>
                  <textarea
                    value={rawLogs}
                    onChange={(event) => setRawLogs(event.target.value)}
                    rows={10}
                    placeholder={t.form.rawPlaceholder}
                    className="min-h-[220px] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{t.form.rawHint}</span>
                    {rawLogs.trim() ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px]">
                        {t.form.lockHint}
                      </span>
                    ) : null}
                  </div>
                  {rawLogs.trim() && otherDates.length > 0 ? (
                    <p className="text-xs text-amber-600">
                      {t.warnings.dateMismatch.replace('{dates}', otherDates.join('，'))}
                    </p>
                  ) : null}
                  {rawLogs.trim() && detectedDates.length === 0 ? (
                    <p className="text-xs text-slate-400">{t.warnings.dateNone}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleExtract}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    {t.actions.extract}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300"
                  >
                    {t.actions.clear}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(promptText, t.status.promptCopied)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300"
                  >
                    {t.actions.copyPrompt}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(outputText, t.status.outputCopied)}
                    className="rounded-full border border-amber-200 bg-amber-50 px-5 py-2 text-sm font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:border-amber-300"
                  >
                    {t.actions.copyOutput}
                  </button>
                  {statusMessage ? (
                    <span className="flex items-center text-xs text-slate-500">{statusMessage}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.panels.prompt.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.panels.prompt.description}</p>
              <textarea
                readOnly
                value={promptText}
                rows={14}
                className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.panels.output.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.panels.output.description}</p>

              <div className="mt-5 grid gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{t.output.observations}</p>
                  <p className="text-[11px] text-slate-400">{t.hints.securityRequired}</p>
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
                  <p className="text-[11px] text-slate-400">{t.hints.emptyAllowed}</p>
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
                      label={t.output.quarryControl}
                      value={output.controls.quarry}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, quarry: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.subcontractControl}
                      value={output.controls.subcontract}
                      onChange={(value) =>
                        setOutput((prev) => ({
                          ...prev,
                          controls: { ...prev.controls, subcontract: value },
                        }))
                      }
                    />
                    <FieldTextarea
                      label={t.output.controlOther}
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

                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{t.panels.extra.title}</p>
                  <p className="text-[11px] text-slate-400">{t.panels.extra.description}</p>
                  <div className="mt-3 grid gap-3">
                    <FieldTextarea
                      label={t.output.survey}
                      value={output.survey}
                      onChange={(value) => setOutput((prev) => ({ ...prev, survey: value }))}
                    />
                    <FieldTextarea
                      label={t.output.quarry}
                      value={output.quarry}
                      onChange={(value) => setOutput((prev) => ({ ...prev, quarry: value }))}
                    />
                    <FieldTextarea
                      label={t.output.subcontract}
                      value={output.subcontract}
                      onChange={(value) => setOutput((prev) => ({ ...prev, subcontract: value }))}
                    />
                    <FieldTextarea
                      label={t.output.other}
                      value={output.other}
                      onChange={(value) => setOutput((prev) => ({ ...prev, other: value }))}
                    />
                  </div>
                </section>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.panels.combined.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.panels.combined.description}</p>
              <textarea
                readOnly
                value={outputText}
                rows={12}
                className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm"
              />
            </div>
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
