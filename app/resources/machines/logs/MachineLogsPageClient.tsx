'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { ActionButton } from '@/components/ActionButton'
import { SingleSelect } from '@/components/SingleSelect'
import type { Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'
import type { MachineLogGroupBy } from '@/types/machineLogs'

import { ResourcesHeader } from '../../ResourcesHeader'
import { useResourcesSession } from '../../hooks/useResourcesSession'
import { useMachinesData } from '../hooks/useMachinesData'
import { MachineLogGroupCard } from './components/MachineLogGroupCard'
import { useFuelSourceDailyData, getFuelSourceLabel } from './hooks/useFuelSourceDailyData'
import { useMachineLogsSummaryData } from './hooks/useMachineLogsSummaryData'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

const isGroupBy = (value: string): value is MachineLogGroupBy => {
  return ['none', 'category', 'supervisor', 'team', 'equipmentType'].includes(value)
}

const groupLabel = (groupBy: MachineLogGroupBy, t: ReturnType<typeof getResourcesCopy>) => {
  const labels = t.machineLogs.labels.groupBy
  if (groupBy === 'category') return labels.category
  if (groupBy === 'supervisor') return labels.supervisor
  if (groupBy === 'team') return labels.team
  if (groupBy === 'equipmentType') return labels.equipmentType
  return labels.none
}

export function MachineLogsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const {
    authLoaded,
    session,
    canViewMachines,
    canViewMachineLogs,
    canViewFuelSources,
    canUpdateFuelSources,
  } = useResourcesSession()

  const [date, setDate] = useState(() => searchParams?.get('date')?.trim() || defaultDateKey())
  const [groupBy, setGroupBy] = useState<MachineLogGroupBy>(() => {
    const raw = searchParams?.get('groupBy')?.trim() || ''
    return isGroupBy(raw) ? raw : 'supervisor'
  })
  const [projectId, setProjectId] = useState(() => searchParams?.get('projectId')?.trim() || '')

  const showMineDefault = Boolean(session?.id)
  const [mineOnly, setMineOnly] = useState(() => searchParams?.get('mine') === '1')
  const resolvedMineOnly = Boolean(showMineDefault && mineOnly)

  const syncQuery = useCallback(
    (next: { date?: string; groupBy?: MachineLogGroupBy; projectId?: string; mine?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (next.date) params.set('date', next.date)
      if (next.groupBy) params.set('groupBy', next.groupBy)
      if (next.projectId !== undefined) {
        const safe = next.projectId.trim()
        if (safe) params.set('projectId', safe)
        else params.delete('projectId')
      }
      if (typeof next.mine === 'boolean') {
        if (next.mine) params.set('mine', '1')
        else params.delete('mine')
      }
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    loadData: loadSummary,
  } = useMachineLogsSummaryData({
    authLoaded,
    canViewMachineLogs,
    date,
    groupBy,
    projectId,
    mineOnly: resolvedMineOnly,
    locale: locale as Locale,
    loadErrorMessage: t.machineLogs.errors.loadFailed,
  })

  const canViewInventory = canViewFuelSources || canViewMachineLogs

  const fuelSourceDaily = useFuelSourceDailyData({
    authLoaded,
    canView: canViewInventory,
    date,
    loadErrorMessage: t.machineLogs.errors.loadFailed,
  })

  const machinesData = useMachinesData({
    authLoaded,
    canViewMachines: canUpdateFuelSources && canViewMachines,
    loadErrorMessage: t.common.loadFailed,
  })

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
    const projects = summary?.options.projects ?? []
    const opts = projects.map((project) => ({
      value: String(project.id),
      label: project.code ? `${project.name} (${project.code})` : project.name,
    }))
    return [{ value: '', label: t.common.all }, ...opts]
  }, [summary?.options.projects, t.common.all])

  const [truckMachineId, setTruckMachineId] = useState('')
  const [truckActionError, setTruckActionError] = useState<string | null>(null)
  const [truckSaving, setTruckSaving] = useState(false)

  const machineOptions = useMemo(() => {
    const machines = machinesData.machines ?? []
    const opts = machines.map((machine) => {
      const title = (machine.alias ?? '').trim() || (machine.assetName ?? '').trim() || machine.assetNumber
      const plate = (machine.plateNumber ?? '').trim()
      const suffix = plate ? `（${plate}）` : ''
      return { value: String(machine.id), label: `${title}${suffix}` }
    })
    return [{ value: '', label: t.common.noOptions }, ...opts]
  }, [machinesData.machines, t.common.noOptions])

  const updateTruck = useCallback(
    async ({ machineId, isActive }: { machineId: number; isActive: boolean }) => {
      if (!Number.isFinite(machineId) || machineId <= 0) return

      setTruckSaving(true)
      setTruckActionError(null)
      try {
        const res = await fetch('/api/resources/fuel-sources/trucks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ machineId, isActive }),
        })
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) throw new Error(json?.error || t.machineLogs.errors.saveFailed)
        await fuelSourceDaily.loadData()
      } catch (err) {
        setTruckActionError(err instanceof Error ? err.message : t.machineLogs.errors.saveFailed)
      } finally {
        setTruckSaving(false)
      }
    },
    [fuelSourceDaily, t.machineLogs.errors.saveFailed],
  )

  const addTruck = useCallback(async () => {
    const machineId = Number(truckMachineId)
    if (!Number.isFinite(machineId) || machineId <= 0) return
    setTruckMachineId('')
    await updateTruck({ machineId, isActive: true })
  }, [truckMachineId, updateTruck])

  if (authLoaded && !canViewMachineLogs) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['machine-log:view']}
        hint={t.machineLogs.errors.needMachineLogView}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.breadcrumbs.machineLogs },
        ]}
        title={t.machineLogs.title}
        subtitle={t.machineLogs.subtitle}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-8 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.machineLogs.labels.date}
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      const next = event.target.value
                      setDate(next)
                      syncQuery({ date: next })
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>

                <div className="w-56">
                  <SingleSelect
                    label={t.machineLogs.actions.groupByLabel}
                    value={groupBy}
                    options={groupByOptions}
                    placeholder={groupLabel(groupBy, t)}
                    onChange={(value) => {
                      const next = value as MachineLogGroupBy
                      setGroupBy(next)
                      syncQuery({ groupBy: next })
                    }}
                  />
                </div>

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

                {showMineDefault ? (
                  <ActionButton
                    onClick={() =>
                      setMineOnly((prev) => {
                        const next = !prev
                        syncQuery({ mine: next })
                        return next
                      })
                    }
                  >
                    {resolvedMineOnly ? t.machineLogs.actions.hideMine : t.machineLogs.actions.showMine}
                  </ActionButton>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionButton onClick={() => void loadSummary()} disabled={summaryLoading}>
                  {t.machineLogs.actions.refresh}
                </ActionButton>
                <ActionButton onClick={() => void fuelSourceDaily.loadData()} disabled={fuelSourceDaily.loading}>
                  {t.machineLogs.labels.fuelInventory}{t.machineLogs.actions.refresh}
                </ActionButton>
              </div>
            </div>

            {summaryError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {summaryError}
              </div>
            ) : null}

            {summaryLoading ? (
              <p className="mt-4 text-sm text-slate-600">{t.common.loading}</p>
            ) : null}
          </div>

          {canViewInventory ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{t.machineLogs.labels.fuelInventory}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t.machineLogs.hints.consumptionFormula}</p>
                  </div>

                  {canUpdateFuelSources && canViewMachines ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-72">
                        <SingleSelect
                          label={t.machineLogs.actions.addFuelTruck}
                          value={truckMachineId}
                          options={machineOptions}
                          placeholder={t.common.noOptions}
                          onChange={setTruckMachineId}
                        />
                      </div>
                      <ActionButton onClick={() => void addTruck()} disabled={truckSaving || !truckMachineId}>
                        {t.machineLogs.actions.addFuelTruck}
                      </ActionButton>
                    </div>
                  ) : null}
                </div>

                {truckActionError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {truckActionError}
                  </div>
                ) : null}

                {fuelSourceDaily.error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {fuelSourceDaily.error}
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">{t.machineLogs.labels.fuelSource}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.prevFuelRemainingEnd}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.received}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.dispensed}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.fuelRemainingEnd}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.expectedEnd}</th>
                        <th className="px-3 py-2 text-right">{t.machineLogs.labels.delta}</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {fuelSourceDaily.rowsWithDrafts.map(({ row, draft }) => {
                        const id = row.fuelSource.id
                        return (
                          <tr key={id} className="border-b border-slate-100">
                            <td className="px-3 py-3 font-semibold text-slate-800">{getFuelSourceLabel(row)}</td>
                            <td className="px-3 py-3 text-right text-slate-700">
                              {row.prevRemainingEnd == null ? '—' : row.prevRemainingEnd}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <input
                                value={draft.received}
                                onChange={(event) => fuelSourceDaily.updateDraft(id, { received: event.target.value })}
                                inputMode="decimal"
                                className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
                                placeholder={t.machineLogs.hints.emptyOptional}
                              />
                            </td>
                            <td className="px-3 py-3 text-right text-slate-700">{row.dispensed || 0}</td>
                            <td className="px-3 py-3 text-right">
                              <input
                                value={draft.remainingEnd}
                                onChange={(event) => fuelSourceDaily.updateDraft(id, { remainingEnd: event.target.value })}
                                inputMode="decimal"
                                className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
                                placeholder={t.machineLogs.hints.emptyOptional}
                              />
                            </td>
                            <td className="px-3 py-3 text-right text-slate-700">
                              {row.expectedEnd == null ? '—' : row.expectedEnd}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span
                                className={
                                  row.delta == null
                                    ? 'text-slate-400'
                                    : Math.abs(row.delta) < 0.0001
                                      ? 'text-emerald-700 font-semibold'
                                      : 'text-rose-700 font-semibold'
                                }
                              >
                                {row.delta == null ? '—' : row.delta}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {canUpdateFuelSources ? (
                                <div className="flex justify-end gap-2">
                                  <ActionButton
                                    onClick={() => void fuelSourceDaily.save(id)}
                                    disabled={fuelSourceDaily.saving[String(id)]}
                                  >
                                    {t.machineLogs.actions.save}
                                  </ActionButton>
                                  {row.fuelSource.type === 'TRUCK' && row.fuelSource.machineId ? (
                                    <ActionButton
                                      onClick={() =>
                                        void updateTruck({
                                          machineId: row.fuelSource.machineId ?? 0,
                                          isActive: false,
                                        })
                                      }
                                      disabled={truckSaving}
                                    >
                                      {t.machineLogs.actions.disableFuelTruck}
                                    </ActionButton>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}

                      {fuelSourceDaily.rowsWithDrafts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                            {t.common.empty}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {summary.groups.map((group) => (
                <MachineLogGroupCard
                  key={`${group.groupBy}:${group.groupKey}`}
                  t={t}
                  summary={group}
                  date={summary.date}
                  projectId={projectId}
                  mineOnly={resolvedMineOnly}
                />
              ))}
              {summary.groups.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
                  <p className="text-sm text-slate-600">{t.common.empty}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
