'use client'

import { useCallback, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { ActionButton } from '@/components/ActionButton'
import { SingleSelect } from '@/components/SingleSelect'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'
import type { MachineDailyLog } from '@/types/machineLogs'

import { ResourcesHeader } from '../../ResourcesHeader'
import { useResourcesSession } from '../../hooks/useResourcesSession'
import { MachineLogCard } from './components/MachineLogCard'
import { useFuelSourceDailyData, getFuelSourceLabel } from './hooks/useFuelSourceDailyData'
import { useMachineLogsData } from './hooks/useMachineLogsData'

const defaultDateKey = () => new Date().toISOString().slice(0, 10)

type GroupBy = 'none' | 'category' | 'supervisor' | 'team'

const groupLabel = (groupBy: GroupBy, t: ReturnType<typeof getResourcesCopy>) => {
  const labels = t.machineLogs.labels.groupBy
  if (groupBy === 'category') return labels.category
  if (groupBy === 'supervisor') return labels.supervisor
  if (groupBy === 'team') return labels.team
  return labels.none
}

export function MachineLogsPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const {
    authLoaded,
    session,
    canViewMachineLogs,
    canCreateMachineLogs,
    canUpdateMachineLogs,
    canViewFuelSources,
    canUpdateFuelSources,
  } = useResourcesSession()

  const [date, setDate] = useState(defaultDateKey)
  const [groupBy, setGroupBy] = useState<GroupBy>('supervisor')

  const {
    data,
    setData,
    loading,
    error,
    loadData,
  } = useMachineLogsData({
    authLoaded,
    canViewMachineLogs,
    date,
    loadErrorMessage: t.machineLogs.errors.loadFailed,
  })

  const canViewInventory = canViewFuelSources || canViewMachineLogs

  const fuelSourceDaily = useFuelSourceDailyData({
    authLoaded,
    canView: canViewInventory,
    date,
    loadErrorMessage: t.machineLogs.errors.loadFailed,
  })
  const loadFuelSourceDaily = fuelSourceDaily.loadData

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

      setData((prev) => {
        if (!prev) return prev
        const nextLogs = prev.logs.filter((item) => item.machineId !== saved.machineId)
        nextLogs.push(saved)
        nextLogs.sort((a, b) => a.machineId - b.machineId)
        return { ...prev, logs: nextLogs }
      })

      return saved
    },
    [setData, t.machineLogs.errors.saveFailed],
  )

  const logsByMachineId = useMemo(() => {
    const map = new Map<number, MachineDailyLog>()
    data?.logs.forEach((log) => map.set(log.machineId, log))
    return map
  }, [data?.logs])

  const supervisorIdByMachineId = useMemo(() => {
    const map = new Map<number, number>()
    logsByMachineId.forEach((log, machineId) => {
      const id = log.chineseSupervisorId
      if (id) map.set(machineId, id)
    })
    return map
  }, [logsByMachineId])

  const groupKeys = useMemo(() => {
    const machines = data?.machines ?? []
    const groups = new Map<string, number[]>()

    const put = (key: string, machineId: number) => {
      const list = groups.get(key) ?? []
      list.push(machineId)
      groups.set(key, list)
    }

    machines.forEach((machine) => {
      const log = logsByMachineId.get(machine.id) ?? null

      let key = ''
      if (groupBy === 'category') {
        key = (machine.assetCategoryName ?? '').trim() || '未分类'
      } else if (groupBy === 'team') {
        key = (log?.team ?? '').trim() || '未填队伍'
      } else if (groupBy === 'supervisor') {
        key = (log?.chineseSupervisorName ?? '').trim() || '未填负责人'
      } else {
        key = '全部'
      }

      put(key, machine.id)
    })

    const entries = Array.from(groups.entries())
    entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
    return entries
  }, [data?.machines, groupBy, logsByMachineId])

  const groupByOptions = useMemo(
    () => [
      { value: 'none', label: t.machineLogs.labels.groupBy.none },
      { value: 'category', label: t.machineLogs.labels.groupBy.category },
      { value: 'supervisor', label: t.machineLogs.labels.groupBy.supervisor },
      { value: 'team', label: t.machineLogs.labels.groupBy.team },
    ],
    [t.machineLogs.labels.groupBy],
  )

  const showMineDefault = Boolean(session?.id)
  const [showMine, setShowMine] = useState(false)

  const filteredGroupKeys = useMemo(() => {
    if (!showMineDefault || !showMine || !session?.id) return groupKeys
    const mineId = session.id

    const machines = data?.machines ?? []
    const mineMachineIds = new Set<number>()
    machines.forEach((machine) => {
      const supervisorId = supervisorIdByMachineId.get(machine.id)
      if (supervisorId === mineId) {
        mineMachineIds.add(machine.id)
      }
    })

    const next: Array<[string, number[]]> = []
    groupKeys.forEach(([key, ids]) => {
      const filtered = ids.filter((id) => mineMachineIds.has(id))
      if (filtered.length > 0) next.push([key, filtered])
    })
    return next
  }, [data?.machines, groupKeys, session?.id, showMine, showMineDefault, supervisorIdByMachineId])

  const canEditLogs = canCreateMachineLogs || canUpdateMachineLogs

  const [truckMachineId, setTruckMachineId] = useState('')
  const [truckActionError, setTruckActionError] = useState<string | null>(null)
  const [truckSaving, setTruckSaving] = useState(false)

  const machineOptions = useMemo(() => {
    const machines = data?.machines ?? []
    const opts = machines.map((machine) => {
      const title = (machine.alias ?? '').trim() || (machine.assetName ?? '').trim() || machine.assetNumber
      const plate = (machine.plateNumber ?? '').trim()
      const suffix = plate ? `（${plate}）` : ''
      return { value: String(machine.id), label: `${title}${suffix}` }
    })
    return [{ value: '', label: t.common.noOptions }, ...opts]
  }, [data?.machines, t.common.noOptions])

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
        await loadFuelSourceDaily()
        await loadData()
      } catch (err) {
        setTruckActionError(err instanceof Error ? err.message : t.machineLogs.errors.saveFailed)
      } finally {
        setTruckSaving(false)
      }
    },
    [loadFuelSourceDaily, loadData, t.machineLogs.errors.saveFailed],
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
                    onChange={(event) => setDate(event.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                  />
                </label>

                <div className="w-56">
                  <SingleSelect
                    label={t.machineLogs.actions.groupByLabel}
                    value={groupBy}
                    options={groupByOptions}
                    placeholder={groupLabel(groupBy, t)}
                    onChange={(value) => setGroupBy(value as GroupBy)}
                  />
                </div>

                {showMineDefault ? (
                  <ActionButton onClick={() => setShowMine((prev) => !prev)}>
                    {showMine ? t.machineLogs.actions.hideMine : t.machineLogs.actions.showMine}
                  </ActionButton>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionButton onClick={() => void loadData()} disabled={loading}>
                  {t.machineLogs.actions.refresh}
                </ActionButton>
                <ActionButton onClick={() => void fuelSourceDaily.loadData()} disabled={fuelSourceDaily.loading}>
                  {t.machineLogs.labels.fuelInventory}{t.machineLogs.actions.refresh}
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

          {canViewInventory ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{t.machineLogs.labels.fuelInventory}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t.machineLogs.hints.consumptionFormula}</p>
                  </div>

                  {canUpdateFuelSources ? (
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

          {data ? (
            <div className="grid gap-6">
              {filteredGroupKeys.map(([key, ids]) => (
                <section key={key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">{key}</h2>
                    <p className="text-xs text-slate-500">{ids.length} 台</p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {ids.map((machineId) => {
                      const machine = data.machines.find((item) => item.id === machineId)
                      if (!machine) return null
                      const log = logsByMachineId.get(machineId) ?? null
                      const prevFuel = data.prevFuelByMachineId[String(machineId)] ?? null

                      return (
                        <MachineLogCard
                          key={machineId}
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
                          readOnly={!canEditLogs}
                          onSave={saveLog}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {!loading && !data ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
              <p className="text-sm text-slate-600">{t.common.empty}</p>
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
