'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { ActionButton } from '@/components/ActionButton'
import { SingleSelect } from '@/components/SingleSelect'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'
import type { MachineDailyLog, MachineLogGroupBy } from '@/types/machineLogs'

import { ResourcesHeader } from '../../../../ResourcesHeader'
import { useResourcesSession } from '../../../../hooks/useResourcesSession'
import { MachineLogCard } from '../../components/MachineLogCard'
import { useMachineLogsGroupData } from '../../hooks/useMachineLogsGroupData'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

export function MachineLogsGroupPageClient() {
  const params = useParams<{ groupBy: string; groupKey: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)

  const {
    authLoaded,
    session,
    canViewMachineLogs,
    canCreateMachineLogs,
    canUpdateMachineLogs,
  } = useResourcesSession()

  const groupBy = (params?.groupBy ?? 'supervisor') as MachineLogGroupBy
  const groupKey = params?.groupKey ?? ''

  const [date, setDate] = useState(() => searchParams?.get('date')?.trim() || defaultDateKey())
  const [projectId, setProjectId] = useState(() => searchParams?.get('projectId')?.trim() || '')
  const showMineDefault = Boolean(session?.id)
  const [mineOnly, setMineOnly] = useState(() => searchParams?.get('mine') === '1')
  const resolvedMineOnly = Boolean(showMineDefault && mineOnly)

  const {
    data,
    loading,
    error,
    loadData,
  } = useMachineLogsGroupData({
    authLoaded,
    canViewMachineLogs,
    date,
    groupBy,
    groupKey,
    projectId,
    mineOnly: resolvedMineOnly,
    locale,
    loadErrorMessage: t.machineLogs.errors.loadFailed,
  })

  const canEditLogs = canCreateMachineLogs || canUpdateMachineLogs

  const groupByOptions = useMemo(
    () => [
      { value: 'supervisor', label: t.machineLogs.labels.groupBy.supervisor },
      { value: 'team', label: t.machineLogs.labels.groupBy.team },
      { value: 'category', label: t.machineLogs.labels.groupBy.category },
      { value: 'equipmentType', label: t.machineLogs.labels.groupBy.equipmentType },
      { value: 'none', label: t.machineLogs.labels.groupBy.none },
    ],
    [t.machineLogs.labels.groupBy],
  )

  const projectOptions = useMemo(() => {
    const projects = data?.options.projects ?? []
    const opts = projects.map((project) => ({
      value: String(project.id),
      label: project.code ? `${project.name} (${project.code})` : project.name,
    }))
    return [{ value: '', label: t.common.all }, ...opts]
  }, [data?.options.projects, t.common.all])

  const backHref = useMemo(() => {
    const nextParams = new URLSearchParams()
    nextParams.set('date', date)
    nextParams.set('groupBy', groupBy)
    if (projectId) nextParams.set('projectId', projectId)
    if (resolvedMineOnly) nextParams.set('mine', '1')
    return `/resources/machines/logs?${nextParams.toString()}`
  }, [date, groupBy, projectId, resolvedMineOnly])

  const syncQuery = useCallback(
    (next: { date?: string; projectId?: string; mine?: boolean } = {}) => {
      const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
      if (next.date) nextParams.set('date', next.date)
      if (next.projectId !== undefined) {
        const safe = next.projectId.trim()
        if (safe) nextParams.set('projectId', safe)
        else nextParams.delete('projectId')
      }
      if (typeof next.mine === 'boolean') {
        if (next.mine) nextParams.set('mine', '1')
        else nextParams.delete('mine')
      }
      router.replace(`?${nextParams.toString()}`)
    },
    [router, searchParams],
  )

  const onDateChange = (next: string) => {
    setDate(next)
    syncQuery({ date: next })
  }

  const onMineToggle = () => {
    setMineOnly((prev) => {
      const next = !prev
      syncQuery({ mine: next })
      return next
    })
  }

  const saveLog = useCallback(
    async (payload: any) => {
      const res = await fetch('/api/resources/machines/logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; log?: MachineDailyLog } | null
      if (!res.ok) {
        throw new Error(json?.error || t.machineLogs.errors.saveFailed)
      }
      const saved = json?.log
      if (!saved) {
        throw new Error(t.machineLogs.errors.saveFailed)
      }

      // Reload to reflect grouping moves (team/supervisor changes) and updated effective bindings.
      await loadData()
      return saved
    },
    [loadData, t.machineLogs.errors.saveFailed],
  )

  const logByMachineId = useMemo(() => {
    const map = new Map<number, MachineDailyLog>()
    data?.logs.forEach((log) => map.set(log.machineId, log))
    return map
  }, [data?.logs])

  if (authLoaded && !canViewMachineLogs) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['machine-log:view']}
        hint={t.machineLogs.errors.needMachineLogView}
      />
    )
  }

  const title = data?.groupLabel ? `${t.machineLogs.title} · ${data.groupLabel}` : t.machineLogs.title

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.breadcrumbs.machineLogs, href: '/resources/machines/logs' },
          { label: data?.groupLabel ?? groupKey },
        ]}
        title={title}
        subtitle={t.machineLogs.subtitle}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-8 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  {t.machineLogs.actions.backToGroups}
                </Link>

                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.machineLogs.labels.date}
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => onDateChange(event.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>

                <div className="w-72">
                  <SingleSelect
                    label={t.machineLogs.labels.project}
                    value={projectId}
                    options={projectOptions}
                    placeholder={t.common.all}
                    onChange={(value) => {
                      setProjectId(value)
                      syncQuery({ projectId: value })
                    }}
                  />
                </div>

                <div className="w-56">
                  <SingleSelect
                    label={t.machineLogs.actions.groupByLabel}
                    value={groupBy}
                    options={groupByOptions}
                    placeholder={t.machineLogs.labels.groupBy.none}
                    onChange={(value) => {
                      const nextParams = new URLSearchParams()
                      nextParams.set('date', date)
                      nextParams.set('groupBy', value)
                      if (projectId) nextParams.set('projectId', projectId)
                      if (resolvedMineOnly) nextParams.set('mine', '1')
                      router.push(`/resources/machines/logs?${nextParams.toString()}`)
                    }}
                  />
                </div>

                {showMineDefault ? (
                  <ActionButton onClick={onMineToggle}>
                    {resolvedMineOnly ? t.machineLogs.actions.hideMine : t.machineLogs.actions.showMine}
                  </ActionButton>
                ) : null}

                {data?.summary ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200">
                      {data.summary.machineCount} 台
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200">
                      {t.machineLogs.labels.filledLogs} {data.summary.filledCount}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200">
                      {t.machineLogs.labels.missingLogs} {data.summary.missingCount}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionButton onClick={() => void loadData()} disabled={loading}>
                  {t.machineLogs.actions.refresh}
                </ActionButton>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="mt-4 text-sm text-slate-600">{t.common.loading}</p>
            ) : null}
          </div>

          {data ? (
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {data.machines.map((machine) => {
                const log = logByMachineId.get(machine.id) ?? null
                const prevFuel = data.prevFuelByMachineId[String(machine.id)] ?? null
                const effective = data.effectiveByMachineId[String(machine.id)] ?? null
                return (
                  <MachineLogCard
                    key={machine.id}
                    locale={locale}
                    t={t}
                    date={data.date}
                    machine={machine}
                    log={log}
                    prevFuelRemainingEnd={prevFuel}
                    fuelSources={data.fuelSources}
                    teamSupervisors={data.options.teamSupervisors}
                    supervisors={data.options.supervisors}
                    operators={data.options.operators}
                    projects={data.options.projects}
                    suggested={effective}
                    readOnly={!canEditLogs}
                    onSave={saveLog}
                  />
                )
              })}

              {data.machines.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
                  <p className="text-sm text-slate-600">{t.common.empty}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {!canEditLogs ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              {t.machineLogs.errors.needMachineLogCreateOrUpdate}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
