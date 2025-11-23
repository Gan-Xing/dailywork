/* eslint-disable @next/next/no-img-element */
'use client'

import { useMemo, useState, useTransition } from 'react'

import type { IntervalSide, PhaseDTO, PhaseIntervalPayload, PhasePayload, RoadSectionDTO } from '@/lib/progressTypes'

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

const computeDesign = (intervals: PhaseIntervalPayload[]) => {
  return intervals.reduce((sum, item) => {
    const raw = item.endPk - item.startPk
    const base = raw === 0 ? 1 : Math.max(raw, 0)
    const factor = item.side === 'BOTH' ? 2 : 1
    return sum + base * factor
  }, 0)
}

export function PhaseEditor({ road, initialPhases, canManage }: Props) {
  const [phases, setPhases] = useState<PhaseDTO[]>(initialPhases)
  const [name, setName] = useState('')
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([
    { startPk: 0, endPk: 0, side: 'BOTH' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const designLength = useMemo(() => computeDesign(intervals), [intervals])

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!canManage) {
      setError('暂无编辑进度的权限')
      return
    }
    startTransition(async () => {
      const payload: PhasePayload = {
        name,
        measure: 'LINEAR',
        intervals: intervals.map((item) => ({
          startPk: Number(item.startPk),
          endPk: Number(item.endPk),
          side: item.side,
        })),
      }

      const res = await fetch(`/api/progress/${road.slug}/phases`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { phase?: PhaseDTO; message?: string }
      if (!res.ok || !data.phase) {
        setError(data.message ?? '保存失败')
        return
      }
      setPhases((prev) => [...prev, data.phase])
      setName('')
      setIntervals([{ startPk: 0, endPk: 0, side: 'BOTH' }])
    })
  }

  const parsedLength = useMemo(() => {
    const start = Number(road.startPk)
    const end = Number(road.endPk)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.abs(end - start)
    }
    return null
  }, [road.startPk, road.endPk])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-50">分项工程</h2>
          {parsedLength !== null ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
              道路长度（估算）：{parsedLength} m
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
              道路长度：未填写
            </span>
          )}
          {!canManage ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100/80">
              只读 · 需要编辑进度权限
            </span>
          ) : null}
        </div>
        {canManage ? (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
                  value="LINEAR"
                  onChange={() => {}}
                >
                  <option value="LINEAR">延米（按起终点展示进度）</option>
                </select>
              </label>
              <div className="flex flex-col justify-end text-sm text-slate-100">
                <span className="text-xs text-slate-300">
                  设计量自动计算：{designLength} m（双侧区间按左右叠加）
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
        ) : (
          <p className="mt-3 text-sm text-slate-300">您没有编辑权限，如需维护分项工程请联系管理员。</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          已有分项
          <span className="h-px w-12 bg-white/30" />
          {phases.length === 0 ? '暂无' : `${phases.length} 条`}
        </div>

        {phases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            暂无分项，添加后将显示在此处。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-200/70">分项</p>
                    <h3 className="text-xl font-semibold text-slate-50">{phase.name}</h3>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
                    设计量 {phase.designLength} m
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-200/80">
                  {phase.intervals.map((interval, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span>
                        起点 {interval.startPk} · 终点 {interval.endPk}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100">
                        {interval.side === 'BOTH' ? '双侧' : interval.side === 'LEFT' ? '左侧' : '右侧'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
