'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { FormEvent } from 'react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
} from 'react'

import type {
  RoadPhaseProgressSummaryDTO,
  RoadSectionProgressSummaryDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { RoadFormState } from './types'

const RoadFormModal = dynamic(() => import('./RoadFormModal'), { ssr: false })

interface Props {
  initialRoads: RoadSectionProgressSummaryDTO[]
  canManage: boolean
}

export interface RoadBoardHandle {
  openFormModal: () => void
}

const emptyForm: RoadFormState = {
  slug: '',
  name: '',
  startPk: '',
  endPk: '',
}

const sortRoads = (roads: RoadSectionProgressSummaryDTO[], locale: Locale) =>
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
  const [roads, setRoads] = useState<RoadSectionProgressSummaryDTO[]>(sortRoads(initialRoads, locale))
  const [form, setForm] = useState<RoadFormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showFormModal, setShowFormModal] = useState(false)
  const sortedRoads = useMemo(() => sortRoads(roads, locale), [roads, locale])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError(null)
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

  const handleFormChange = (updates: Partial<RoadFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }))
    if (error) {
      setError(null)
    }
  }

  useImperativeHandle(ref, () => ({ openFormModal }), [openFormModal])

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

      const data = (await response.json()) as { road?: RoadSectionProgressSummaryDTO }
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

  const startEdit = (road: RoadSectionProgressSummaryDTO) => {
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
          {sortedRoads.length === 0
            ? t.list.none
            : formatProgressCopy(t.list.count, { count: sortedRoads.length })}
        </div>

        {sortedRoads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            {t.list.emptyHelp}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {sortedRoads.map((road) => (
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

      {showFormModal ? (
        <RoadFormModal
          open={showFormModal}
          form={form}
          editingId={editingId}
          error={error}
          isPending={isPending}
          copy={t}
          onClose={closeFormModal}
          onChange={handleFormChange}
          onReset={resetForm}
          onSubmit={upsertRoad}
        />
      ) : null}
    </div>
  )
})

RoadBoard.displayName = 'RoadBoard'

export { RoadBoard }

interface RoadCardProps {
  road: RoadSectionProgressSummaryDTO
  onEdit: (road: RoadSectionProgressSummaryDTO) => void
  onDelete: (id: number) => void
  canManage: boolean
  locale: Locale
}

const chipTone =
  'rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100 shadow-inner shadow-slate-900/30'

const RoadCard = ({ road, onEdit, onDelete, canManage, locale }: RoadCardProps) => {
  const copy = getProgressCopy(locale)
  const phases = road.phases ?? []
  const formatDesignLength = (phase: RoadPhaseProgressSummaryDTO) => {
    const value = Number.isFinite(phase.designLength) ? phase.designLength : 0
    const rounded = Math.round(value * 100) / 100
    const unit = phase.phaseMeasure === 'POINT' ? copy.phase.units.point : copy.phase.units.linear
    return `${rounded} ${unit}`
  }
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
                        <span className="truncate">
                          {localizeProgressTerm('phase', phase.phaseName, locale)}
                        </span>
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
            <p className="text-sm text-slate-300">{copy.phase.list.emptyHint}</p>
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
