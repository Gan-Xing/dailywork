/* eslint-disable @next/next/no-img-element */
'use client'

import { useMemo, useState, useTransition } from 'react'

import type { IntervalSide, PhaseDTO, PhaseIntervalPayload, PhasePayload, RoadSectionDTO } from '@/lib/progressTypes'
import type { PhaseMeasure } from '@/lib/progressTypes'

interface Props {
  road: RoadSectionDTO
  initialPhases: PhaseDTO[]
  canManage: boolean
}

const sideOptions: { value: IntervalSide; label: string }[] = [
  { value: 'BOTH', label: '双侧' },
  { value: 'LEFT', label: '左侧' },
  { value: 'RIGHT', label: '右侧' },
]

type Status = '未施工' | '验收中' | '已验收' | '非设计'

interface Segment {
  start: number
  end: number
  status: Status
}

interface Side {
  label: '左侧' | '右侧'
  segments: Segment[]
}

interface LinearView {
  left: Side
  right: Side
  total: number
}

interface PointView {
  total: number
  points: { startPk: number; endPk: number; side: IntervalSide }
}

const statusTone: Record<Status, string> = {
  未施工: 'bg-gradient-to-r from-white via-slate-100 to-white text-slate-900 shadow-sm shadow-slate-900/10',
  验收中: 'bg-gradient-to-r from-amber-300 via-orange-200 to-amber-200 text-slate-900 shadow-md shadow-amber-400/30',
  已验收: 'bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-200 text-slate-900 shadow-md shadow-emerald-400/30',
  非设计: 'bg-slate-800 text-slate-100 shadow-inner shadow-slate-900/30',
}

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const computeDesign = (measure: PhaseMeasure, intervals: PhaseIntervalPayload[]) =>
  measure === 'POINT'
    ? intervals.length
    : intervals.reduce((sum, item) => {
        const start = Number(item.startPk)
        const end = Number(item.endPk)
        const safeStart = Number.isFinite(start) ? start : 0
        const safeEnd = Number.isFinite(end) ? end : safeStart
        const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
        const raw = orderedEnd - orderedStart
        const base = raw === 0 ? 1 : raw
        const factor = item.side === 'BOTH' ? 2 : 1
        return sum + base * factor
      }, 0)

const normalizeInterval = (interval: PhaseIntervalPayload) => {
  const start = Number(interval.startPk)
  const end = Number(interval.endPk)
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
  return {
    startPk: orderedStart,
    endPk: orderedEnd,
    side: interval.side,
  }
}

const fillNonDesignGaps = (segments: Segment[], start: number, end: number) => {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const result: Segment[] = []
  let cursor = start
  sorted.forEach((seg) => {
    if (seg.start > cursor) {
      result.push({ start: cursor, end: seg.start, status: '非设计' })
    }
    result.push(seg)
    cursor = Math.max(cursor, seg.end)
  })
  if (cursor < end) {
    result.push({ start: cursor, end, status: '非设计' })
  }
  return result
}

const buildLinearView = (phase: PhaseDTO, roadLength: number): LinearView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'LINEAR'))
  const left: Segment[] = []
  const right: Segment[] = []
  normalized.forEach((interval) => {
    const seg = { start: interval.startPk, end: interval.endPk, status: '未施工' as Status }
    if (interval.side === 'LEFT') left.push(seg)
    if (interval.side === 'RIGHT') right.push(seg)
    if (interval.side === 'BOTH') {
      left.push(seg)
      right.push(seg)
    }
  })

  const maxEnd = Math.max(
    roadLength,
    ...normalized.map((i) => i.endPk),
    ...normalized.map((i) => i.startPk),
    0,
  )
  const total = Math.max(maxEnd, roadLength || 0, 1)

  return {
    left: { label: '左侧', segments: fillNonDesignGaps(left, 0, total) },
    right: { label: '右侧', segments: fillNonDesignGaps(right, 0, total) },
    total,
  }
}

const buildPointView = (phase: PhaseDTO, roadLength: number): PointView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'POINT'))
  const maxEnd = Math.max(
    roadLength,
    ...normalized.map((i) => i.startPk),
    ...normalized.map((i) => i.endPk),
    0,
  )
  const total = Math.max(maxEnd, 1)
  return {
    total,
    points: normalized,
  }
}

const calcDesignBySide = (segments: Segment[]) =>
  segments.reduce((acc, seg) => (seg.status === '非设计' ? acc : acc + Math.max(0, seg.end - seg.start)), 0)

const calcCombinedPercent = (left: Segment[], right: Segment[]) => {
  const leftLen = calcDesignBySide(left)
  const rightLen = calcDesignBySide(right)
  const total = leftLen + rightLen || 1
  const completed = 0 // 未来接入验收状态，目前全部未施工
  return Math.round((completed / total) * 100)
}

export function PhaseEditor({ road, initialPhases, canManage }: Props) {
  const [phases, setPhases] = useState<PhaseDTO[]>(initialPhases)
  const [name, setName] = useState('')
  const [measure, setMeasure] = useState<PhaseMeasure>('LINEAR')
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([
    { startPk: 0, endPk: 0, side: 'BOTH' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<number | null>(null)

  const designLength = useMemo(() => computeDesign(measure, intervals), [measure, intervals])

  const roadLength = useMemo(() => {
    const start = Number(road.startPk)
    const end = Number(road.endPk)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.abs(end - start)
    }
    const maxPhaseEnd = Math.max(
      0,
      ...phases.flatMap((phase) =>
        phase.intervals.map((i) => Math.max(Number(i.startPk) || 0, Number(i.endPk) || 0)),
      ),
    )
    return maxPhaseEnd || 0
  }, [road.endPk, road.startPk, phases])

  const updateInterval = (index: number, patch: Partial<PhaseIntervalPayload>) => {
    setIntervals((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    )
  }

  const addInterval = () => {
    setIntervals((prev) => [...prev, { startPk: 0, endPk: 0, side: 'BOTH' }])
  }

  const removeInterval = (index: number) => {
    setIntervals((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resetForm = () => {
    setName('')
    setMeasure('LINEAR')
    setIntervals([{ startPk: 0, endPk: 0, side: 'BOTH' }])
    setEditingId(null)
    setError(null)
  }

  const startEdit = (phase: PhaseDTO) => {
    setName(phase.name)
    setMeasure(phase.measure)
    setIntervals(
      phase.intervals.map((i) => ({
        startPk: i.startPk,
        endPk: i.endPk,
        side: i.side,
      })),
    )
    setEditingId(phase.id)
    setError(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!canManage) return
    startTransition(async () => {
      const payload: PhasePayload = {
        name,
        measure,
        intervals: intervals.map((item) => {
          const startPk = Number(item.startPk)
          const endPk = measure === 'POINT' ? startPk : Number(item.endPk)
          return {
            startPk,
            endPk,
            side: item.side,
          }
        }),
      }

      const target = editingId
        ? `/api/progress/${road.slug}/phases/${editingId}`
        : `/api/progress/${road.slug}/phases`
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(target, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { phase?: PhaseDTO; message?: string }
      if (!res.ok || !data.phase) {
        setError(data.message ?? '保存失败')
        return
      }
      const phase = data.phase
      setPhases((prev) =>
        editingId ? prev.map((item) => (item.id === editingId ? phase : item)) : [...prev, phase],
      )
      resetForm()
    })
  }

  const linearViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'LINEAR')
      .map((phase) => ({
        phase,
        view: buildLinearView(phase, roadLength),
      }))
  }, [phases, roadLength])

  const pointViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'POINT')
      .map((phase) => ({
        phase,
        view: buildPointView(phase, roadLength),
      }))
  }, [phases, roadLength])

  const [selectedSegment, setSelectedSegment] = useState<{
    phase: string
    side: string
    start: number
    end: number
  } | null>(null)

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-50">分项工程</h2>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
            道路长度（估算）：{roadLength || '未填写'} m
          </span>
        </div>
        {canManage ? (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap items-center gap-3">
              {editingId ? (
                <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                  编辑分项 · ID {editingId}
                </span>
              ) : null}
              <button
                type="button"
                className="text-xs text-emerald-200 underline decoration-dotted"
                onClick={resetForm}
              >
                重置表单
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-slate-100">
                名称
                <input
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：土方"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-100">
                显示方式
                <select
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value as PhaseMeasure)}
                >
                  <option value="LINEAR">延米（按起终点展示进度）</option>
                  <option value="POINT">单体（按点位/条目展示）</option>
                </select>
              </label>
              <div className="flex flex-col justify-end text-sm text-slate-100">
                <span className="text-xs text-slate-300">
                  设计量自动计算：
                  {measure === 'POINT'
                    ? `${designLength} 个（按条目数）`
                    : `${designLength} m（双侧区间按左右叠加）`}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm text-slate-100">
                <p>起点-终点列表（起点=终点可表示一个点）</p>
                <button
                  type="button"
                  onClick={addInterval}
                  className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  添加区间
                </button>
              </div>

              <div className="space-y-3">
                {intervals.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 md:grid-cols-4 md:items-center"
                  >
                    <label className="flex flex-col gap-1">
                      起点
                      <input
                        type="number"
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={item.startPk}
                        onChange={(e) => updateInterval(index, { startPk: Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      终点
                      <input
                        type="number"
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={item.endPk}
                        onChange={(e) => updateInterval(index, { endPk: Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      侧别
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                        value={item.side}
                        onChange={(e) => updateInterval(index, { side: e.target.value as IntervalSide })}
                      >
                        {sideOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end justify-end">
                      {intervals.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
                          onClick={() => removeInterval(index)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                保存分项
              </button>
              {error ? <span className="text-sm text-amber-200">{error}</span> : null}
              {isPending ? <span className="text-xs text-slate-200/70">正在保存...</span> : null}
            </div>
            <p className="text-xs text-slate-300">
              说明：显示方式决定进度展示形态；设计量自动按区间或单体数量统计，延米类双侧会叠加左右长度。
            </p>
          </form>
        ) : null}
      </section>

      <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          已有分项（白色区段可点击预约报检）
          <span className="h-px w-12 bg-white/30" />
          灰=非设计 白=未施工
        </div>

        {phases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            暂无分项，添加后将显示在此处。
          </div>
        ) : (
          <div className="space-y-6">
            {phases.map((phase) => {
              const linear = phase.measure === 'LINEAR' ? linearViews.find((item) => item.phase.id === phase.id) : null
              const point = phase.measure === 'POINT' ? pointViews.find((item) => item.phase.id === phase.id) : null

              return (
                <div
                  key={phase.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-50">{phase.name}</h3>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
                        {phase.measure === 'POINT'
                          ? `单体 · 设计量 ${phase.designLength} 个`
                          : `延米 · 设计量 ${phase.designLength} m`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.measure === 'LINEAR' && linear ? (
                        <span className="text-sm font-semibold text-emerald-200">
                          已完成 {calcCombinedPercent(linear.view.left.segments, linear.view.right.segments)}%
                        </span>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                          onClick={() => startEdit(phase)}
                        >
                          编辑分项
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {phase.measure === 'LINEAR' && linear ? (
                    <div className="mt-4 space-y-4">
                      {[linear.view.left, linear.view.right].map((side) => (
                        <div key={side.label} className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-200/80">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                              {side.label}
                            </span>
                            <span className="text-slate-300">
                              {formatPK(0)} – {formatPK(linear.view.total)}
                            </span>
                          </div>
                          <div className="rounded-full bg-slate-900/70 p-1 shadow-inner shadow-slate-900/50">
                            <div className="flex h-8 overflow-hidden rounded-full bg-slate-800/60">
                              {side.segments.map((seg, idx) => {
                                const width = Math.max(0, seg.end - seg.start) / linear.view.total * 100
                                return (
                                  <button
                                    key={`${seg.start}-${seg.end}-${idx}`}
                                    type="button"
                                    className={`${statusTone[seg.status]} flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                                    style={{ width: `${width}%` }}
                                    title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${seg.status}`}
                                    onClick={() => {
                                      if (seg.status === '未施工') {
                                        setSelectedSegment({
                                          phase: phase.name,
                                          side: side.label,
                                          start: seg.start,
                                          end: seg.end,
                                        })
                                      }
                                    }}
                                  >
                                    <span className="px-1">
                                      {formatPK(seg.start)}–{formatPK(seg.end)}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {phase.measure === 'POINT' && point ? (
                    <div className="mt-4 space-y-3">
                      <div className="relative mt-2 h-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40">
                        <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
                        <div className="relative flex h-full items-center justify-between">
                          {point.view.points.map((item, idx) => {
                            const position = Math.min(
                              100,
                              Math.max(0, Math.round((item.startPk / point.view.total) * 100)),
                            )
                            return (
                              <div
                                key={`${item.startPk}-${idx}`}
                                className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-center"
                                style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
                              >
                                <div
                                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-lg shadow-emerald-400/25 ring-2 ring-white/20"
                                  title={`${formatPK(item.startPk)} · ${item.side === 'LEFT' ? '左侧' : item.side === 'RIGHT' ? '右侧' : '双侧'}`}
                                >
                                  {item.side === 'BOTH' ? '双侧' : item.side === 'LEFT' ? '左侧' : '右侧'}
                                </div>
                                <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                  {formatPK(item.startPk)}
                                </div>
                                <p className="text-[10px] text-slate-300">
                                  {item.side === 'BOTH' ? '双侧' : item.side === 'LEFT' ? '左侧' : '右侧'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedSegment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-slate-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">预约报检</p>
                <h2 className="text-xl font-semibold text-white">{selectedSegment.phase}</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/40"
                onClick={() => setSelectedSegment(null)}
              >
                关闭
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-100">
              <p>侧别：{selectedSegment.side}</p>
              <p>
                区间：{formatPK(selectedSegment.start)} ~ {formatPK(selectedSegment.end)}
              </p>
              <p className="text-xs text-slate-400">
                说明：此为示意弹窗，未来会接入真实报检表单（选择监理、备注、提交）。
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                onClick={() => setSelectedSegment(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
                onClick={() => setSelectedSegment(null)}
              >
                确认预约（占位）
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
