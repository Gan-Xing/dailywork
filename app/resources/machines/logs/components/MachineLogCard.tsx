'use client'

import { useEffect, useMemo, useState } from 'react'

import { ActionButton } from '@/components/ActionButton'
import { SingleSelect, type SingleSelectOption } from '@/components/SingleSelect'
import type { ResourcesCopy } from '@/lib/i18n/resources'
import { computeMachineDailyDepreciation } from '@/lib/resources/machines/depreciation'
import { resolveMachineEquipmentTypeKey } from '@/lib/resources/machines/equipmentTypes'
import type { MachineAsset } from '@/types/machines'
import type {
  FuelSource,
  MachineDailyLog,
  MachineLogEffectiveBinding,
  TeamSupervisorOption,
  UserOption,
  ProjectOption,
} from '@/types/machineLogs'

const toInputString = (value: number | null) => (value == null ? '' : String(value))

const parseNumberInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const sumNumbers = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

const formatMachineTitle = (machine: MachineAsset) => {
  const alias = (machine.alias ?? '').trim()
  const name = (machine.assetName ?? '').trim()
  const primary = alias || name || machine.assetNumber
  const secondary = primary === machine.assetNumber ? '' : machine.assetNumber
  return { primary, secondary }
}

const buildUserOptions = (users: UserOption[], emptyLabel: string): SingleSelectOption[] => {
  return [{ value: '', label: emptyLabel }, ...users.map((user) => ({ value: String(user.id), label: user.label }))]
}

const buildProjectOptions = (projects: ProjectOption[], emptyLabel: string): SingleSelectOption[] => {
  return [
    { value: '', label: emptyLabel },
    ...projects.map((project) => ({
      value: String(project.id),
      label: project.code ? `${project.name} (${project.code})` : project.name,
    })),
  ]
}

const buildFuelSourceOptions = (fuelSources: FuelSource[], emptyLabel: string): SingleSelectOption[] => {
  const options = fuelSources.map((source) => {
    const typeLabel = source.type === 'TANK' ? '油罐' : '加油车'
    const plate = source.machine?.plateNumber?.trim() || ''
    const suffix = plate ? ` (${plate})` : ''
    return {
      value: String(source.id),
      label: `[${typeLabel}] ${source.name}${suffix}`,
    }
  })

  return [{ value: '', label: emptyLabel }, ...options]
}

type FuelEventDraft = {
  fuelSourceId: string
  amount: string
  note: string
}

const mapFuelDrafts = (log: MachineDailyLog | null): FuelEventDraft[] => {
  if (!log?.fuelEvents?.length) return []
  return log.fuelEvents.map((event) => ({
    fuelSourceId: String(event.fuelSourceId),
    amount: toInputString(event.amount),
    note: event.note ?? '',
  }))
}

export function MachineLogCard({
  t,
  date,
  machine,
  log,
  suggested,
  prevFuelRemainingEnd,
  fuelSources,
  teamSupervisors,
  supervisors,
  operators,
  projects,
  readOnly = false,
  onSave,
}: {
  t: ResourcesCopy
  date: string
  machine: MachineAsset
  log: MachineDailyLog | null
  suggested?: MachineLogEffectiveBinding | null
  prevFuelRemainingEnd: number | null
  fuelSources: FuelSource[]
  teamSupervisors: TeamSupervisorOption[]
  supervisors: UserOption[]
  operators: UserOption[]
  projects: ProjectOption[]
  readOnly?: boolean
  onSave: (payload: {
    date: string
    machineId: number
    team: string | null
    chineseSupervisorId: number | null
    projectId: number | null
    operatorId: number | null
    workContent: string | null
    fuelRemainingEnd: number | null
    fuelEvents: Array<{ fuelSourceId: number; amount: number; note?: string | null }>
  }) => Promise<MachineDailyLog>
}) {
  const { primary, secondary } = formatMachineTitle(machine)

  const shouldTrackFuel = useMemo(() => {
    const resolved = resolveMachineEquipmentTypeKey(machine)
    return resolved.key !== 'survey' && resolved.key !== 'lab'
  }, [machine])

  const teamOptions: SingleSelectOption[] = useMemo(() => {
    const entries = teamSupervisors.map((binding) => ({
      value: binding.teamKey,
      label: binding.teamZh ? `${binding.teamZh}（${binding.team}）` : binding.team,
      searchText: `${binding.team} ${binding.teamZh ?? ''}`.trim(),
    }))
    return [{ value: '', label: t.common.clear }, ...entries]
  }, [t.common.clear, teamSupervisors])

  const supervisorOptions = useMemo(
    () => buildUserOptions(supervisors, t.common.clear),
    [supervisors, t.common.clear],
  )
  const operatorOptions = useMemo(
    () => buildUserOptions(operators, t.common.clear),
    [operators, t.common.clear],
  )
  const projectOptions = useMemo(
    () => buildProjectOptions(projects, t.common.clear),
    [projects, t.common.clear],
  )
  const fuelSourceOptions = useMemo(
    () => buildFuelSourceOptions(fuelSources, t.common.clear),
    [fuelSources, t.common.clear],
  )

  const [teamKey, setTeamKey] = useState(log?.teamKey ?? suggested?.teamKey ?? '')
  const [team, setTeam] = useState(log?.team ?? suggested?.team ?? '')
  const [supervisorId, setSupervisorId] = useState(
    log?.chineseSupervisorId
      ? String(log.chineseSupervisorId)
      : suggested?.chineseSupervisorId
        ? String(suggested.chineseSupervisorId)
        : '',
  )
  const [projectId, setProjectId] = useState(
    log?.projectId ? String(log.projectId) : suggested?.projectId ? String(suggested.projectId) : '',
  )
  const [operatorId, setOperatorId] = useState(
    log?.operatorId ? String(log.operatorId) : suggested?.operatorId ? String(suggested.operatorId) : '',
  )
  const [fuelRemainingEnd, setFuelRemainingEnd] = useState(toInputString(log?.fuelRemainingEnd ?? null))
  const [workContent, setWorkContent] = useState(log?.workContent ?? '')
  const [fuelEvents, setFuelEvents] = useState<FuelEventDraft[]>(() => mapFuelDrafts(log))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const logSnapshot = useMemo(
    () => ({
      teamKey: log?.teamKey ?? suggested?.teamKey ?? '',
      team: log?.team ?? suggested?.team ?? '',
      supervisorId: log?.chineseSupervisorId
        ? String(log.chineseSupervisorId)
        : suggested?.chineseSupervisorId
          ? String(suggested.chineseSupervisorId)
          : '',
      projectId: log?.projectId
        ? String(log.projectId)
        : suggested?.projectId
          ? String(suggested.projectId)
          : '',
      operatorId: log?.operatorId
        ? String(log.operatorId)
        : suggested?.operatorId
          ? String(suggested.operatorId)
          : '',
      fuelRemainingEnd: toInputString(log?.fuelRemainingEnd ?? null),
      workContent: log?.workContent ?? '',
      fuelEvents: mapFuelDrafts(log),
      updatedAt: log?.updatedAt ?? '',
      id: log?.id ?? null,
      suggestedSourceDate: suggested?.sourceDate ?? null,
    }),
    [log, suggested],
  )

  useEffect(() => {
    setTeamKey(logSnapshot.teamKey)
    setTeam(logSnapshot.team)
    setSupervisorId(logSnapshot.supervisorId)
    setProjectId(logSnapshot.projectId)
    setOperatorId(logSnapshot.operatorId)
    setFuelRemainingEnd(logSnapshot.fuelRemainingEnd)
    setWorkContent(logSnapshot.workContent)
    setFuelEvents(logSnapshot.fuelEvents)
    setError(null)
    setSavedAt(null)
  }, [logSnapshot])

  const resolvedFuelRemainingEnd = useMemo(() => parseNumberInput(fuelRemainingEnd), [fuelRemainingEnd])
  const resolvedDailyDepreciation = useMemo(() => {
    return computeMachineDailyDepreciation({
      dateKey: date,
      registrationDate: machine.registrationDate ?? null,
      originalValue: machine.originalValue ?? null,
      usedMonths: machine.usedMonths ?? null,
    })
  }, [date, machine.originalValue, machine.registrationDate, machine.usedMonths])

  const resolvedDailyDepreciationText = useMemo(() => {
    if (resolvedDailyDepreciation == null) return '—'
    return String(resolvedDailyDepreciation)
  }, [resolvedDailyDepreciation])

  const fuelAddedTotal = useMemo(() => {
    const amounts = fuelEvents
      .map((event) => parseNumberInput(event.amount) ?? 0)
      .filter((value) => Number.isFinite(value) && value > 0)
    return sumNumbers(amounts)
  }, [fuelEvents])

  const dailyFuelConsumed = useMemo(() => {
    if (prevFuelRemainingEnd == null || resolvedFuelRemainingEnd == null) return null
    return prevFuelRemainingEnd + fuelAddedTotal - resolvedFuelRemainingEnd
  }, [fuelAddedTotal, prevFuelRemainingEnd, resolvedFuelRemainingEnd])

  const onTeamChange = (nextKey: string) => {
    setTeamKey(nextKey)
    const binding = teamSupervisors.find((item) => item.teamKey === nextKey) ?? null
    const nextTeam = binding?.team ?? ''
    setTeam(nextTeam)
    if (binding) {
      setSupervisorId(String(binding.supervisorId))
      if (binding.project) {
        setProjectId(String(binding.project.id))
      }
    }
  }

  const onAddFuelEvent = () => {
    const defaultSource = fuelSources[0]?.id
    setFuelEvents((prev) => [
      ...prev,
      {
        fuelSourceId: defaultSource ? String(defaultSource) : '',
        amount: '',
        note: '',
      },
    ])
  }

  const onSaveClick = async () => {
    if (readOnly) return
    setSaving(true)
    setError(null)
    try {
      const nextEvents: Array<{ fuelSourceId: number; amount: number; note?: string | null }> = []
      for (let i = 0; i < fuelEvents.length; i += 1) {
        const draft = fuelEvents[i]
        if (!draft) continue

        const sourceId = draft.fuelSourceId ? Number(draft.fuelSourceId) : null
        const amount = parseNumberInput(draft.amount)
        const note = draft.note.trim() ? draft.note.trim() : null

        const hasAny = Boolean(sourceId || amount != null || note)
        if (!hasAny) continue

        if (!sourceId) {
          throw new Error(`第 ${i + 1} 条加油记录缺少来源`)
        }
        if (amount == null || amount <= 0) {
          throw new Error(`第 ${i + 1} 条加油记录缺少加油量`)
        }
        nextEvents.push({ fuelSourceId: sourceId, amount, note })
      }

      const payload = {
        date,
        machineId: machine.id,
        team: team.trim() ? team.trim() : null,
        chineseSupervisorId: supervisorId ? Number(supervisorId) : null,
        projectId: projectId ? Number(projectId) : null,
        operatorId: operatorId ? Number(operatorId) : null,
        workContent: workContent.trim() ? workContent.trim() : null,
        fuelRemainingEnd: resolvedFuelRemainingEnd,
        fuelEvents: nextEvents,
      }

      const saved = await onSave(payload)
      setSavedAt(saved.updatedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.machineLogs.errors.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">{primary}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {secondary ? `${secondary} · ` : ''}
              {machine.assetCategoryName ?? t.machineLogs.labels.groupBy.none}
              {machine.plateNumber ? ` · ${machine.plateNumber}` : ''}
            </p>
            {!log && suggested?.sourceDate ? (
              <p className="mt-2 text-xs text-amber-700">
                {t.machineLogs.hints.prefilledFrom(suggested.sourceDate)}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <ActionButton onClick={onSaveClick} disabled={saving || readOnly}>
              {saving ? t.machineLogs.actions.saving : t.machineLogs.actions.save}
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SingleSelect
            label={t.machineLogs.labels.team}
            value={teamKey}
            options={teamOptions}
            placeholder={t.machineLogs.hints.emptyOptional}
            onChange={onTeamChange}
            disabled={readOnly}
          />
          <SingleSelect
            label={t.machineLogs.labels.supervisor}
            value={supervisorId}
            options={supervisorOptions}
            placeholder={t.machineLogs.hints.emptyOptional}
            onChange={setSupervisorId}
            disabled={readOnly}
          />
          <SingleSelect
            label={t.machineLogs.labels.project}
            value={projectId}
            options={projectOptions}
            placeholder={t.machineLogs.hints.emptyOptional}
            onChange={setProjectId}
            disabled={readOnly}
          />
          <SingleSelect
            label={t.machineLogs.labels.operator}
            value={operatorId}
            options={operatorOptions}
            placeholder={t.machineLogs.hints.emptyOptional}
            onChange={setOperatorId}
            disabled={readOnly}
          />
        </div>

        {shouldTrackFuel ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{t.machineLogs.labels.prevFuelRemainingEnd}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {prevFuelRemainingEnd == null ? '—' : prevFuelRemainingEnd}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{t.machineLogs.labels.fuelAddedTotal}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{fuelAddedTotal || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{t.machineLogs.labels.dailyFuelConsumed}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {dailyFuelConsumed == null ? '—' : Math.round(dailyFuelConsumed * 100) / 100}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {t.machineLogs.hints.fuelNotRequired}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {shouldTrackFuel ? (
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t.machineLogs.labels.fuelRemainingEnd}
              </span>
              <input
                value={fuelRemainingEnd}
                onChange={(event) => setFuelRemainingEnd(event.target.value)}
                inputMode="decimal"
                disabled={readOnly}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                placeholder={t.machineLogs.hints.emptyOptional}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t.machineLogs.labels.dailyDepreciation}
            </span>
            <span className="text-[11px] leading-4 text-slate-400">{t.machineLogs.hints.dailyDepreciationFormula}</span>
            <input
              value={resolvedDailyDepreciationText}
              inputMode="decimal"
              disabled
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
              placeholder="—"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t.machineLogs.labels.workContent}
          </span>
          <textarea
            value={workContent}
            onChange={(event) => setWorkContent(event.target.value)}
            disabled={readOnly}
            className="min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
            placeholder={t.machineLogs.hints.emptyOptional}
          />
        </label>

        {shouldTrackFuel ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.machineLogs.labels.fuelEvents}</p>
                <p className="mt-1 text-xs text-slate-500">{t.machineLogs.hints.consumptionFormula}</p>
              </div>
              <ActionButton onClick={onAddFuelEvent} disabled={readOnly} className="shrink-0 whitespace-nowrap">
                {t.machineLogs.actions.addFuelEvent}
              </ActionButton>
            </div>

            <div className="mt-4 space-y-3">
              {fuelEvents.map((event, idx) => (
                <div
                  key={`${idx}-${event.fuelSourceId}`}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-12"
                >
                  <div className="md:col-span-5">
                    <SingleSelect
                      label={t.machineLogs.labels.fuelSource}
                      value={event.fuelSourceId}
                      options={fuelSourceOptions}
                      placeholder={t.machineLogs.hints.emptyOptional}
                      onChange={(value) => {
                        setFuelEvents((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], fuelSourceId: value }
                          return next
                        })
                      }}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {t.machineLogs.labels.fuelAmount}
                      </span>
                      <input
                        value={event.amount}
                        onChange={(e) => {
                          const value = e.target.value
                          setFuelEvents((prev) => {
                            const next = [...prev]
                            next[idx] = { ...next[idx], amount: value }
                            return next
                          })
                        }}
                        inputMode="decimal"
                        disabled={readOnly}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                        placeholder={t.machineLogs.hints.emptyOptional}
                      />
                    </label>
                  </div>
                  <div className="md:col-span-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {t.machineLogs.labels.fuelNote}
                      </span>
                      <input
                        value={event.note}
                        onChange={(e) => {
                          const value = e.target.value
                          setFuelEvents((prev) => {
                            const next = [...prev]
                            next[idx] = { ...next[idx], note: value }
                            return next
                          })
                        }}
                        disabled={readOnly}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none"
                        placeholder={t.machineLogs.hints.emptyOptional}
                      />
                    </label>
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setFuelEvents((prev) => prev.filter((_, i) => i !== idx))
                      }}
                      disabled={readOnly}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      {t.machineLogs.actions.removeFuelEvent}
                    </button>
                  </div>
                </div>
              ))}

              {fuelEvents.length === 0 ? (
                <p className="text-xs text-slate-500">{t.machineLogs.hints.emptyOptional}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {savedAt ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            已保存 · {savedAt.slice(0, 19).replace('T', ' ')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
