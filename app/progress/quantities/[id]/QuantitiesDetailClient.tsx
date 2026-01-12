'use client'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import type {
  PhaseItemDTO,
  PhaseItemInputDTO,
  RoadPhaseQuantityDetailDTO,
} from '@/lib/phaseItemTypes'
import { ProgressHeader } from '../../ProgressHeader'
import { ProgressSectionNav } from '../../ProgressSectionNav'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

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

const calcIntervalLength = (
  startPk: number,
  endPk: number,
  side: string,
  billQuantity?: number | null,
) => {
  const raw = Math.abs(endPk - startPk)
  const base = raw === 0 ? 1 : Math.max(raw, 0)
  const factor = side === 'BOTH' ? 2 : 1
  const computedLength = base * factor
  const hasBillQuantity = typeof billQuantity === 'number' && Number.isFinite(billQuantity)
  const length = hasBillQuantity ? billQuantity : computedLength
  const overridden = hasBillQuantity && Math.abs(billQuantity - computedLength) > 1e-6
  return { length, computedLength, overridden }
}

export default function QuantitiesDetailClient({ detail, canEdit }: Props) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const [phaseItems, setPhaseItems] = useState<PhaseItemDTO[]>(detail.phaseItems)
  const [inputs, setInputs] = useState<PhaseItemInputDTO[]>(detail.inputs)
  const [selectedPhaseItemId, setSelectedPhaseItemId] = useState<number | null>(
    detail.phaseItems[0]?.id ?? null,
  )
  const [drafts, setDrafts] = useState<Record<number, IntervalDraft>>({})
  const [savingIntervals, setSavingIntervals] = useState<number[]>([])

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
    const hasFormula = Boolean(selectedItem.formula?.expression)
    if (!hasFormula && draft.manualQuantity.trim() === '') {
      addToast('未配置公式时必须填写手动值', { tone: 'warning' })
      return
    }
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


  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressHeader
        title={detail.phase.name}
        subtitle={`路段：${detail.road.name} · 模板：${detail.phase.definitionName}`}
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '进度管理', href: '/progress' },
          { label: '分项列表', href: '/progress/quantities' },
          { label: '详情' },
        ]}
        right={<ProgressSectionNav />}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              显示方式：{detail.phase.measure === 'LINEAR' ? '延米' : '单体'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              项目：{detail.road.projectName ?? '未绑定项目'}
            </span>
          </div>
        </div>

        <section className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              当前分项名称
            </div>
            <select
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900"
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
          </div>
          <div className="space-y-4">
            {phaseItems.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
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
                const lengthResult = calcIntervalLength(
                  interval.startPk,
                  interval.endPk,
                  interval.side,
                  interval.billQuantity,
                )
                const hasFormula = Boolean(selectedItem?.formula?.expression)
                return (
                  <div
                    key={interval.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                      <div className="font-semibold text-slate-900">
                        PK {interval.startPk} - {interval.endPk} · {interval.side}
                        {interval.spec ? ` · ${interval.spec}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        计量长度：{formatNumber(lengthResult.length)}
                        {lengthResult.overridden ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            手动
                          </span>
                        ) : null}
                        {lengthResult.overridden ? (
                          <span className="ml-2 text-[10px] text-slate-400">
                            PK差 {formatNumber(lengthResult.computedLength)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {inputFields.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        未配置输入字段，公式可直接使用 length（优先手动延米）、rawLength（PK差）等内置变量。
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {inputFields.map((field) => (
                          <label key={field.key} className="flex flex-col gap-1 text-xs text-slate-600">
                            {field.label}
                            {field.unit ? (
                              <span className="text-[10px] text-slate-500">{field.unit}</span>
                            ) : null}
                            <input
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        计算值：{formatNumber(computed)}
                        {input?.computedError ? (
                          <div className="mt-1 text-xs text-amber-700">
                            {input.computedError}
                          </div>
                        ) : null}
                      </div>
                      <label className="flex flex-col gap-1 text-xs text-slate-600">
                        手动值
                        <input
                          className={`rounded-xl border px-3 py-2 text-sm text-slate-900 focus:outline-none ${
                            mismatch
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200 bg-white focus:border-emerald-300'
                          }`}
                          value={draft?.manualQuantity ?? ''}
                          onChange={(event) => handleManualChange(interval.id, event.target.value)}
                          placeholder={hasFormula ? '留空表示采用计算值' : '必填'}
                          disabled={!canEdit}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => saveInterval(interval.id)}
                          disabled={!canEdit || savingIntervals.includes(interval.id)}
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
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
        </section>
      </div>
    </main>
  )
}
