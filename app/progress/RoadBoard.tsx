'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from 'react'

import type {
  PhaseDTO,
  RoadPhaseProgressDTO,
  RoadSectionProgressDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  initialRoads: RoadSectionProgressDTO[]
  canManage: boolean
}

export interface RoadBoardHandle {
  openFormModal: () => void
}

interface FormState {
  slug: string
  name: string
  startPk: string
  endPk: string
}

const emptyForm: FormState = {
  slug: '',
  name: '',
  startPk: '',
  endPk: '',
}

const sortRoads = (roads: RoadSectionProgressDTO[], locale: Locale) =>
  [...roads].sort((a, b) =>
    resolveRoadName(a, locale).localeCompare(
      resolveRoadName(b, locale),
      locale === 'fr' ? 'fr-FR' : 'zh-CN',
    ),
  )

const RoadBoard = forwardRef<RoadBoardHandle, Props>(function RoadBoard(
  { initialRoads, canManage }: Props,
  ref,
) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const [roads, setRoads] = useState<RoadSectionProgressDTO[]>(sortRoads(initialRoads, locale))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)

  useEffect(() => {
    setRoads((prev) => sortRoads(prev, locale))
  }, [locale])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const openFormModal = useCallback(() => {
    if (!canManage) return
    setShowFormModal(true)
  }, [canManage])

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
    setError(null)
  }

  useImperativeHandle(ref, () => ({ openFormModal }), [openFormModal])

  useEffect(() => {
    if (!showFormModal) return
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [showFormModal])

  const upsertRoad = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!canManage) {
      setError(t.errors.noPermission)
      return
    }

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
        setError(data.message ?? t.errors.saveFailed)
        return
      }

      const data = (await response.json()) as { road?: RoadSectionProgressDTO }
      if (!data.road) {
        setError(t.errors.saveMissing)
        return
      }

      const road = data.road
      setRoads((prev) => {
        const existing = prev.find((item) => item.id === road.id)
        const next = editingId
          ? prev.map((item) => (item.id === road.id ? { ...road, phases: existing?.phases ?? [] } : item))
          : [...prev, { ...road, phases: [] }]
        return sortRoads(next, locale)
      })
      resetForm()
      setShowFormModal(false)
    })
  }

  const handleDelete = (id: number) => {
    if (!canManage) {
      setError(t.errors.noPermission)
      return
    }

    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/roads/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        setError(data.message ?? t.errors.deleteFailed)
        return
      }
      setRoads((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) {
        resetForm()
      }
    })
  }

  const startEdit = (road: RoadSectionProgressDTO) => {
    setForm({
      slug: road.slug,
      name: road.name,
      startPk: road.startPk,
      endPk: road.endPk,
    })
    setEditingId(road.id)
    setError(null)
    setShowFormModal(true)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          {t.list.overview}
          <span className="h-px w-12 bg-white/30" />
          {roads.length === 0
            ? t.list.none
            : formatProgressCopy(t.list.count, { count: roads.length })}
        </div>

        {roads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            {t.list.emptyHelp}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roads.map((road) => (
              <RoadCard
                key={road.id}
                road={road}
                onEdit={startEdit}
                onDelete={handleDelete}
                canManage={canManage}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {showFormModal && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur sm:items-center sm:py-10"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-emerald-500/20">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  {t.admin.badge}
                </p>
                <h2 className="text-xl font-semibold text-slate-50">{t.admin.title}</h2>
                <p className="text-sm text-slate-200/80">{t.admin.description}</p>
              </div>
              {editingId ? (
                <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                  {formatProgressCopy(t.admin.editMode, { id: editingId })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
              onClick={closeFormModal}
              aria-label="关闭"
            >
              ×
            </button>
            <form className="mt-5 space-y-4" onSubmit={upsertRoad}>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm text-slate-100">
                  {t.form.slugLabel}
                  <input
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    value={form.slug}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))
                    }
                    placeholder={t.form.slugPlaceholder}
                    pattern="[a-z0-9-]+"
                    title={t.form.slugTitle}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-100">
                  {t.form.nameLabel}
                  <input
                    ref={nameInputRef}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={t.form.namePlaceholder}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-100">
                  {t.form.startLabel}
                  <input
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                    value={form.startPk}
                    onChange={(event) => setForm((prev) => ({ ...prev, startPk: event.target.value }))}
                    placeholder={t.form.startPlaceholder}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-100">
                  {t.form.endLabel}
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={form.endPk}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, endPk: event.target.value }))
                      }
                      placeholder={t.form.endPlaceholder}
                      required
                    />
                    {editingId ? (
                      <button
                        type="button"
                        className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                        onClick={resetForm}
                      >
                        {t.form.exitEdit}
                      </button>
                    ) : null}
                  </div>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {editingId ? t.actions.save : t.actions.add}
                </button>
                {error ? <span className="text-sm text-amber-200">{error}</span> : null}
                {isPending ? <span className="text-xs text-slate-200/70">{t.admin.saving}</span> : null}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
})

RoadBoard.displayName = 'RoadBoard'

export { RoadBoard }

interface RoadCardProps {
  road: RoadSectionProgressDTO
  onEdit: (road: RoadSectionProgressDTO) => void
  onDelete: (id: number) => void
  canManage: boolean
  locale: Locale
}

const chipTone = 'rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100 shadow-inner shadow-slate-900/30'
const formatDesignLength = (phase: RoadPhaseProgressDTO) => {
  const value = Number.isFinite(phase.designLength) ? phase.designLength : 0
  const rounded = Math.round(value * 100) / 100
  return phase.phaseMeasure === 'POINT' ? `${rounded} 个` : `${rounded} m`
}
const calcPhaseProgress = (_phase: PhaseDTO) => {
  return 0
}

const RoadCard = ({ road, onEdit, onDelete, canManage, locale }: RoadCardProps) => {
  const copy = getProgressCopy(locale)
  const phases = road.phases ?? []
  const sortedByRecent = [...phases].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const topRecent = sortedByRecent.slice(0, 4)
  return (
    <Link
      href={`/progress/${road.slug}`}
      className="group block"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30 transition duration-150 group-hover:-translate-y-0.5 group-hover:border-white/25">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-blue-300 to-cyan-200" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-200/70">{copy.card.label}</p>
            <h3 className="text-xl font-semibold text-slate-50">{resolveRoadName(road, locale)}</h3>
            <p className="mt-1 text-xs text-slate-200/70">
              {copy.card.start} <span className={chipTone}>{road.startPk}</span> · {copy.card.end}{' '}
              <span className={chipTone}>{road.endPk}</span>
            </p>
            <p className="mt-1 text-[11px] text-emerald-100/80">
              {copy.card.slug}：{road.slug}
            </p>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  onEdit(road)
                }}
                className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
              >
                {copy.card.edit}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  onDelete(road.id)
                }}
                className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
              >
                {copy.card.delete}
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          {topRecent.length ? (
            <div className="space-y-2">
              {topRecent.map((phase) => {
                const progressWidth = Math.max(0, Math.min(100, phase.completedPercent))
                const tone =
                  progressWidth >= 80
                    ? 'from-cyan-500 via-sky-500 to-indigo-500'
                    : progressWidth >= 50
                      ? 'from-sky-500 via-blue-500 to-violet-500'
                      : progressWidth > 0
                        ? 'from-sky-400 via-cyan-400 to-blue-500'
                        : 'from-slate-500 via-slate-600 to-slate-500'
                return (
                  <div key={phase.phaseId} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-3 shadow-inner shadow-slate-900/30">
                    <div className="relative flex-1 overflow-hidden rounded-xl bg-white/5">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-xl bg-gradient-to-r ${tone} transition-all`}
                        style={{ width: `${progressWidth}%` }}
                      />
                      <div className="relative flex items-center justify-between px-3 py-2 text-[13px] font-semibold text-slate-50">
                        <span className="truncate">{phase.phaseName}</span>
                        <span className="text-xs font-bold">{progressWidth}%</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200">
                      {formatDesignLength(phase)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-300">尚未添加分项工程，点击进入详情新增。</p>
          )}
          <p className="text-xs text-slate-400">
            {copy.card.updated}
            {new Date(road.updatedAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
              hour12: false,
            })}
          </p>
        </div>
      </div>
    </Link>
  )
}
