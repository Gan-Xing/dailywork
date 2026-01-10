'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import {
  buildFormulaVariables,
  evaluateFormulaExpression,
} from '@/lib/phaseItemFormula'
import type {
  PhaseItemDTO,
  PhaseItemInputDTO,
  RoadPhaseQuantityDetailDTO,
} from '@/lib/phaseItemTypes'

type Props = {
  detail: RoadPhaseQuantityDetailDTO
  canEdit: boolean
}

type InputField = {
  key: string
  label: string
  unit: string | null
  hint: string | null
}

type IntervalDraft = {
  values: Record<string, string>
  manualQuantity: string
}

const parseInputSchema = (schema: unknown): InputField[] => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return []
  }
  const fields = (schema as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return []
  return fields
    .map((field) => {
      if (!field || typeof field !== 'object') return null
      const raw = field as {
        key?: unknown
        label?: unknown
        unit?: unknown
        hint?: unknown
      }
      const key = typeof raw.key === 'string' ? raw.key.trim() : ''
      if (!key) return null
      const label = typeof raw.label === 'string' ? raw.label.trim() : key
      return {
        key,
        label: label || key,
        unit: typeof raw.unit === 'string' ? raw.unit.trim() : null,
        hint: typeof raw.hint === 'string' ? raw.hint.trim() : null,
      }
    })
    .filter((item): item is InputField => Boolean(item))
}

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value)
}

const calcIntervalLength = (startPk: number, endPk: number, side: string) => {
  const raw = Math.abs(endPk - startPk)
  const base = raw === 0 ? 1 : Math.max(raw, 0)
  const factor = side === 'BOTH' ? 2 : 1
  return base * factor
}

export default function QuantitiesDetailClient({ detail, canEdit }: Props) {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'intervals' | 'config'>('intervals')
  const [phaseItems, setPhaseItems] = useState<PhaseItemDTO[]>(detail.phaseItems)
  const [inputs, setInputs] = useState<PhaseItemInputDTO[]>(detail.inputs)
  const [selectedPhaseItemId, setSelectedPhaseItemId] = useState<number | null>(
    detail.phaseItems[0]?.id ?? null,
  )
  const [drafts, setDrafts] = useState<Record<number, IntervalDraft>>({})
  const [savingIntervals, setSavingIntervals] = useState<number[]>([])
  const [savingFormula, setSavingFormula] = useState(false)
  const [savingBoq, setSavingBoq] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState({
    expression: '',
    inputSchema: '',
    unitString: '',
  })
  const [boqSelection, setBoqSelection] = useState('')

  const selectedItem = useMemo(
    () => phaseItems.find((item) => item.id === selectedPhaseItemId) ?? null,
    [phaseItems, selectedPhaseItemId],
  )

  const inputFields = useMemo(
    () => (selectedItem?.formula?.inputSchema ? parseInputSchema(selectedItem.formula.inputSchema) : []),
    [selectedItem],
  )

  const intervalMap = useMemo(
    () => new Map(detail.intervals.map((interval) => [interval.id, interval])),
    [detail.intervals],
  )

  const inputMap = useMemo(() => {
    const map = new Map<number, PhaseItemInputDTO>()
    inputs
      .filter((item) => item.phaseItemId === selectedPhaseItemId)
      .forEach((item) => {
        map.set(item.intervalId, item)
      })
    return map
  }, [inputs, selectedPhaseItemId])

  useEffect(() => {
    if (!selectedItem) return
    const nextDrafts: Record<number, IntervalDraft> = {}
    detail.intervals.forEach((interval) => {
      const existing = inputMap.get(interval.id)
      const values: Record<string, string> = {}
      inputFields.forEach((field) => {
        const value = existing?.values?.[field.key]
        values[field.key] = value === undefined || value === null ? '' : String(value)
      })
      nextDrafts[interval.id] = {
        values,
        manualQuantity:
          existing?.manualQuantity === null || existing?.manualQuantity === undefined
            ? ''
            : String(existing.manualQuantity),
      }
    })
    setDrafts(nextDrafts)
  }, [detail.intervals, inputFields, inputMap, selectedItem])

  useEffect(() => {
    if (!selectedItem) return
    setFormulaDraft({
      expression: selectedItem.formula?.expression ?? '',
      unitString: selectedItem.formula?.unitString ?? '',
      inputSchema: selectedItem.formula?.inputSchema
        ? JSON.stringify(selectedItem.formula.inputSchema, null, 2)
        : '',
    })
    setBoqSelection(
      selectedItem.boqBinding ? String(selectedItem.boqBinding.boqItemId) : '',
    )
  }, [selectedItem])

  const handleFieldChange = (intervalId: number, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [intervalId]: {
        ...prev[intervalId],
        values: {
          ...prev[intervalId]?.values,
          [key]: value,
        },
      },
    }))
  }

  const handleManualChange = (intervalId: number, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [intervalId]: {
        ...prev[intervalId],
        manualQuantity: value,
      },
    }))
  }

  const saveInterval = async (intervalId: number) => {
    if (!selectedItem) return
    const draft = drafts[intervalId]
    if (!draft) return
    setSavingIntervals((prev) => (prev.includes(intervalId) ? prev : [...prev, intervalId]))

    try {
      const response = await fetch('/api/progress/quantities/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phaseItemId: selectedItem.id,
          intervalId,
          values: draft.values,
          manualQuantity: draft.manualQuantity,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        input?: PhaseItemInputDTO
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? '保存失败')
      }
      if (result.input) {
        const nextInput = result.input
        setInputs((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === nextInput.id)
          if (existingIndex >= 0) {
            const next = [...prev]
            next[existingIndex] = nextInput
            return next
          }
          return [...prev, nextInput]
        })
      }
      addToast('已保存区间计量', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? '保存失败', { tone: 'danger' })
    } finally {
      setSavingIntervals((prev) => prev.filter((item) => item !== intervalId))
    }
  }

  const saveFormula = async () => {
    if (!selectedItem) return
    let inputSchema: unknown = null
    const trimmedSchema = formulaDraft.inputSchema.trim()
    if (trimmedSchema) {
      try {
        inputSchema = JSON.parse(trimmedSchema)
      } catch {
        addToast('输入字段 JSON 格式无效', { tone: 'danger' })
        return
      }
    }

    setSavingFormula(true)
    try {
      const response = await fetch('/api/progress/quantities/formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phaseItemId: selectedItem.id,
          expression: formulaDraft.expression,
          inputSchema,
          unitString: formulaDraft.unitString,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        formula?: PhaseItemDTO['formula'] | null
        updatedCount?: number
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? '保存公式失败')
      }
      setPhaseItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, formula: result.formula ?? null } : item,
        ),
      )
      const expression = result.formula?.expression ?? ''
      setInputs((prev) =>
        prev.map((input) => {
          if (input.phaseItemId !== selectedItem.id) return input
          const interval = intervalMap.get(input.intervalId)
          if (!interval || !expression) {
            return { ...input, computedQuantity: null, computedError: null }
          }
          const variables = buildFormulaVariables({
            startPk: interval.startPk,
            endPk: interval.endPk,
            side: interval.side,
            values: input.values,
          })
          const evaluated = evaluateFormulaExpression(expression, variables)
          return {
            ...input,
            computedQuantity: evaluated.value,
            computedError: evaluated.error ?? null,
          }
        }),
      )
      addToast('公式已保存', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? '保存公式失败', { tone: 'danger' })
    } finally {
      setSavingFormula(false)
    }
  }

  const saveBoqBinding = async () => {
    if (!selectedItem || !detail.road.projectId) return
    setSavingBoq(true)
    try {
      const response = await fetch('/api/progress/quantities/boq-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phaseItemId: selectedItem.id,
          projectId: detail.road.projectId,
          boqItemId: boqSelection || null,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        boqItem?: PhaseItemDTO['boqBinding']
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? '保存清单绑定失败')
      }
      setPhaseItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, boqBinding: result.boqItem ?? null } : item,
        ),
      )
      addToast('清单绑定已保存', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? '保存清单绑定失败', { tone: 'danger' })
    } finally {
      setSavingBoq(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            分项工程详情
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">
            {detail.phase.name}
          </h1>
          <p className="max-w-2xl text-sm text-slate-200/80">
            路段：{detail.road.name} · 模板：{detail.phase.definitionName}
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              首页
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              进度管理
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress/quantities"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              分项工程管理
            </Link>
            <span className="text-slate-500">/</span>
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
              详情
            </span>
          </nav>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-200/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              显示方式：{detail.phase.measure === 'LINEAR' ? '延米' : '单体'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              项目：{detail.road.projectName ?? '未绑定项目'}
            </span>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('intervals')}
            className={`rounded-full border px-4 py-1 transition ${
              activeTab === 'intervals'
                ? 'border-transparent bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/30'
                : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            区间计量
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`rounded-full border px-4 py-1 transition ${
              activeTab === 'config'
                ? 'border-transparent bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/30'
                : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            公式与清单绑定
          </button>
        </div>

        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              当前分项名称
            </div>
            <select
              className="rounded-full border border-white/20 bg-slate-900/60 px-4 py-2 text-sm text-slate-100"
              value={selectedPhaseItemId ?? ''}
              onChange={(event) => setSelectedPhaseItemId(Number(event.target.value) || null)}
            >
              {phaseItems.length === 0 ? (
                <option value="">暂无分项名称</option>
              ) : (
                phaseItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.spec ? `（${item.spec}）` : ''}
                  </option>
                ))
              )}
            </select>
            {selectedItem?.formula?.expression ? (
              <span className="rounded-full border border-emerald-200/50 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                公式：{selectedItem.formula.expression}
              </span>
            ) : (
              <span className="rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs text-amber-100">
                尚未配置公式
              </span>
            )}
          </div>

          {activeTab === 'intervals' ? (
            <div className="space-y-4">
              {phaseItems.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80">
                  当前分项模板暂无分项名称，无法录入计量。
                </div>
              ) : (
                detail.intervals.map((interval) => {
                  const input = inputMap.get(interval.id)
                  const draft = drafts[interval.id]
                  const computed = input?.computedQuantity ?? null
                  const manual = input?.manualQuantity ?? null
                  const mismatch =
                    computed !== null &&
                    manual !== null &&
                    Number.isFinite(computed) &&
                    Number.isFinite(manual) &&
                    computed !== manual
                  const length = calcIntervalLength(
                    interval.startPk,
                    interval.endPk,
                    interval.side,
                  )
                  return (
                    <div
                      key={interval.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200/80">
                        <div className="font-semibold text-slate-50">
                          PK {interval.startPk} - {interval.endPk} · {interval.side}
                          {interval.spec ? ` · ${interval.spec}` : ''}
                        </div>
                        <div className="text-xs text-slate-400">
                          计量长度：{formatNumber(length)}
                        </div>
                      </div>
                      {inputFields.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-400">
                          未配置输入字段，公式可直接使用 length、rawLength 等内置变量。
                        </p>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {inputFields.map((field) => (
                            <label key={field.key} className="flex flex-col gap-1 text-xs text-slate-300">
                              {field.label}
                              {field.unit ? (
                                <span className="text-[10px] text-slate-500">{field.unit}</span>
                              ) : null}
                              <input
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                                value={draft?.values?.[field.key] ?? ''}
                                onChange={(event) =>
                                  handleFieldChange(interval.id, field.key, event.target.value)
                                }
                                placeholder={field.hint ?? '请输入数值'}
                                disabled={!canEdit}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200/80">
                          计算值：{formatNumber(computed)}
                          {input?.computedError ? (
                            <div className="mt-1 text-xs text-amber-200">
                              {input.computedError}
                            </div>
                          ) : null}
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-slate-300">
                          手动值
                          <input
                            className={`rounded-xl border px-3 py-2 text-sm text-slate-50 focus:outline-none ${
                              mismatch
                                ? 'border-amber-300 bg-amber-200/10'
                                : 'border-white/15 bg-white/10 focus:border-emerald-300'
                            }`}
                            value={draft?.manualQuantity ?? ''}
                            onChange={(event) => handleManualChange(interval.id, event.target.value)}
                            placeholder="留空表示采用计算值"
                            disabled={!canEdit}
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => saveInterval(interval.id)}
                            disabled={!canEdit || savingIntervals.includes(interval.id)}
                            className="inline-flex items-center rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:border-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingIntervals.includes(interval.id) ? '保存中...' : '保存区间'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-sm font-semibold text-slate-50">公式配置</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-200/80">
                  <label className="flex flex-col gap-2 text-xs text-slate-300">
                    公式表达式
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={formulaDraft.expression}
                      onChange={(event) =>
                        setFormulaDraft((prev) => ({ ...prev, expression: event.target.value }))
                      }
                      placeholder="例如：length * width * thickness"
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs text-slate-300">
                    输出单位
                    <input
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={formulaDraft.unitString}
                      onChange={(event) =>
                        setFormulaDraft((prev) => ({ ...prev, unitString: event.target.value }))
                      }
                      placeholder="例如：m³"
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs text-slate-300">
                    输入字段 JSON
                    <textarea
                      className="min-h-[180px] rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={formulaDraft.inputSchema}
                      onChange={(event) =>
                        setFormulaDraft((prev) => ({ ...prev, inputSchema: event.target.value }))
                      }
                      placeholder='{"fields":[{"key":"width","label":"宽度","unit":"m"}]}'
                      disabled={!canEdit}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveFormula}
                    disabled={!canEdit || savingFormula}
                    className="inline-flex items-center rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:border-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingFormula ? '保存中...' : '保存公式'}
                  </button>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-sm font-semibold text-slate-50">清单绑定</h2>
                {detail.road.projectId ? (
                  <div className="mt-4 space-y-4 text-sm text-slate-200/80">
                    <label className="flex flex-col gap-2 text-xs text-slate-300">
                      当前项目清单条目
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={boqSelection}
                        onChange={(event) => setBoqSelection(event.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="">未绑定</option>
                        {detail.boqItems.map((item) => (
                          <option key={item.boqItemId} value={String(item.boqItemId)}>
                            {item.code} · {item.designationZh}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedItem?.boqBinding ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                        已绑定：{selectedItem.boqBinding.code} ·{' '}
                        {selectedItem.boqBinding.designationZh}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200/40 bg-amber-200/10 p-3 text-xs text-amber-100">
                        当前分项尚未绑定本项目清单条目
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={saveBoqBinding}
                      disabled={!canEdit || savingBoq}
                      className="inline-flex items-center rounded-full border border-emerald-200/60 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:border-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingBoq ? '保存中...' : '保存绑定'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-amber-200/40 bg-amber-200/10 p-3 text-xs text-amber-100">
                    路段尚未绑定项目，无法筛选清单条目。
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
