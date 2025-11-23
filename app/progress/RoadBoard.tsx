'use client'

import type { FormEvent } from 'react'
import { useState, useTransition } from 'react'

import type { RoadSectionDTO } from '@/lib/progressTypes'

interface Props {
  initialRoads: RoadSectionDTO[]
}

interface FormState {
  name: string
  startPk: string
  endPk: string
}

const emptyForm: FormState = {
  name: '',
  startPk: '',
  endPk: '',
}

const sortRoads = (roads: RoadSectionDTO[]) =>
  [...roads].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

export function RoadBoard({ initialRoads }: Props) {
  const [roads, setRoads] = useState<RoadSectionDTO[]>(sortRoads(initialRoads))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const upsertRoad = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const target = editingId ? `/api/roads/${editingId}` : '/api/roads'
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(target, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        setError(data.message ?? '保存失败，请重试')
        return
      }

      const data = (await response.json()) as { road?: RoadSectionDTO }
      if (!data.road) {
        setError('保存成功，但未收到返回数据')
        return
      }

      setRoads((prev) => {
        const next = editingId
          ? prev.map((item) => (item.id === data.road?.id ? data.road : item))
          : [...prev, data.road]
        return sortRoads(next)
      })
      resetForm()
    })
  }

  const handleDelete = (id: number) => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/roads/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        setError(data.message ?? '删除失败，请重试')
        return
      }
      setRoads((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) {
        resetForm()
      }
    })
  }

  const startEdit = (road: RoadSectionDTO) => {
    setForm({
      name: road.name,
      startPk: road.startPk,
      endPk: road.endPk,
    })
    setEditingId(road.id)
    setError(null)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Admin</p>
            <h2 className="text-xl font-semibold text-slate-50">路段管理</h2>
            <p className="text-sm text-slate-200/80">仅管理员可维护路段清单，分项工程稍后在详情内补充。</p>
          </div>
          {editingId ? (
            <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
              编辑模式 · ID {editingId}
            </span>
          ) : null}
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={upsertRoad}>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            名称
            <input
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="如：大学城路"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            起点
            <input
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
              value={form.startPk}
              onChange={(event) => setForm((prev) => ({ ...prev, startPk: event.target.value }))}
              placeholder="例：PK0+000 / 交叉口 A"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            终点
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={form.endPk}
                onChange={(event) => setForm((prev) => ({ ...prev, endPk: event.target.value }))}
                placeholder="例：PK1+940 / 桥头"
                required
              />
              {editingId ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={resetForm}
                >
                  退出编辑
                </button>
              ) : null}
            </div>
          </label>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {editingId ? '保存修改' : '添加路段'}
            </button>
            {error ? <span className="text-sm text-amber-200">{error}</span> : null}
            {isPending ? <span className="text-xs text-slate-200/70">正在保存...</span> : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          路段总览
          <span className="h-px w-12 bg-white/30" />
          {roads.length === 0 ? '尚未添加' : `共 ${roads.length} 条`}
        </div>

        {roads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            暂无路段，先在上方填写“名称 + 起点 + 终点”添加第一条。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roads.map((road) => (
              <RoadCard key={road.id} road={road} onEdit={startEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface RoadCardProps {
  road: RoadSectionDTO
  onEdit: (road: RoadSectionDTO) => void
  onDelete: (id: number) => void
}

const chipTone = 'rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100 shadow-inner shadow-slate-900/30'

const RoadCard = ({ road, onEdit, onDelete }: RoadCardProps) => (
  <div
    className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30 transition duration-150 hover:-translate-y-0.5 hover:border-white/25"
  >
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-blue-300 to-cyan-200" />
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-slate-200/70">路段</p>
        <h3 className="text-xl font-semibold text-slate-50">{road.name}</h3>
        <p className="mt-1 text-xs text-slate-200/70">
          起点 <span className={chipTone}>{road.startPk}</span> · 终点 <span className={chipTone}>{road.endPk}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(road)}
          className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => onDelete(road.id)}
          className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
        >
          删除
        </button>
      </div>
    </div>
    <div className="mt-4 space-y-2 text-sm text-slate-200/90">
      <p>
        分项工程：待进入路段详情后配置。当前仅管理员维护路段范围，后续验收数据会自动驱动进度色带。
      </p>
      <p className="text-xs text-slate-400">
        最近更新：{new Date(road.updatedAt).toLocaleString('zh-CN', { hour12: false })}
      </p>
    </div>
  </div>
)
