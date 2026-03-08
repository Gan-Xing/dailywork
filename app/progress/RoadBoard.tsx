'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
} from 'react'

import type {
  PhaseMeasure,
  RoadPhaseProgressSummaryDTO,
  RoadSectionProgressSummaryDTO,
} from '@/lib/progressTypes'
import { LEVEL_CROSSING_ROAD_SLUG } from '@/lib/roadConstants'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { RoadFormState } from './types'

type ProjectOption = {
  id: number
  name: string
  code: string | null
}

type RoadGroupKind = 'project' | 'special' | 'ungrouped'

type RoadGroupPhaseSummary = {
  key: string
  phaseName: string
  phaseMeasure: PhaseMeasure
  designLength: number
  completedLength: number
  completedPercent: number
  updatedAt: string
}

type RoadBoardGroup = {
  key: string
  kind: RoadGroupKind
  title: string
  roads: RoadSectionProgressSummaryDTO[]
  roadCount: number
  phaseCount: number
  latestUpdatedAt: string
  phaseHighlights: RoadGroupPhaseSummary[]
}

const RoadFormModal = dynamic(() => import('./RoadFormModal'), { ssr: false })

interface Props {
  initialRoads: RoadSectionProgressSummaryDTO[]
  projects: ProjectOption[]
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
  projectId: '',
}

const chipTone =
  'rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-inner shadow-slate-200/60'

const sortRoads = (roads: RoadSectionProgressSummaryDTO[], locale: Locale) =>
  [...roads].sort((a, b) =>
    resolveRoadName(a, locale).localeCompare(
      resolveRoadName(b, locale),
      locale === 'fr' ? 'fr-FR' : 'zh-CN',
    ),
  )

const formatDesignLength = (
  phase: Pick<RoadPhaseProgressSummaryDTO, 'designLength' | 'phaseMeasure'>,
  locale: Locale,
) => {
  const copy = getProgressCopy(locale)
  const value = Number.isFinite(phase.designLength) ? phase.designLength : 0
  const rounded = Math.round(value * 100) / 100
  const unit = phase.phaseMeasure === 'POINT' ? copy.phase.units.point : copy.phase.units.linear
  return `${rounded} ${unit}`
}

const formatDateTime = (locale: Locale, value: string) =>
  new Date(value).toLocaleString(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    hour12: false,
  })

const getProgressTone = (progressWidth: number) => {
  if (progressWidth >= 80) return 'from-emerald-400 via-sky-400 to-cyan-400'
  if (progressWidth >= 50) return 'from-emerald-300 via-sky-300 to-cyan-300'
  if (progressWidth > 0) return 'from-emerald-200 via-sky-200 to-cyan-200'
  return 'from-slate-200 via-slate-300 to-slate-200'
}

const buildRoadGroups = (
  roads: RoadSectionProgressSummaryDTO[],
  projects: ProjectOption[],
  locale: Locale,
) => {
  const copy = getProgressCopy(locale)
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]))
  const projectOrderById = new Map(projects.map((project, index) => [project.id, index]))
  const groups = new Map<
    string,
    {
      kind: RoadGroupKind
      title: string
      order: number
      roads: RoadSectionProgressSummaryDTO[]
    }
  >()

  roads.forEach((road) => {
    let key = ''
    let kind: RoadGroupKind = 'project'
    let title = ''
    let order = Number.MAX_SAFE_INTEGER

    if (road.slug === LEVEL_CROSSING_ROAD_SLUG) {
      key = `special:${road.slug}`
      kind = 'special'
      title = resolveRoadName(road, locale)
      order = 90_000
    } else if (road.projectId) {
      key = `project:${road.projectId}`
      kind = 'project'
      title =
        projectNameById.get(road.projectId) ??
        formatProgressCopy(copy.group.projectFallback, { id: road.projectId })
      order = projectOrderById.get(road.projectId) ?? road.projectId
    } else {
      key = 'ungrouped'
      kind = 'ungrouped'
      title = copy.group.ungroupedTitle
      order = 99_000
    }

    const existing = groups.get(key)
    if (existing) {
      existing.roads.push(road)
      return
    }

    groups.set(key, {
      kind,
      title,
      order,
      roads: [road],
    })
  })

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const sortedGroupRoads = sortRoads(group.roads, locale)
      const phaseMap = new Map<
        string,
        {
          phaseName: string
          phaseMeasure: PhaseMeasure
          designLength: number
          completedLength: number
          latestUpdatedAt: number
        }
      >()

      let latestUpdatedAt = 0

      sortedGroupRoads.forEach((road) => {
        const roadUpdatedAt = new Date(road.updatedAt).getTime()
        if (Number.isFinite(roadUpdatedAt)) {
          latestUpdatedAt = Math.max(latestUpdatedAt, roadUpdatedAt)
        }
        road.phases.forEach((phase) => {
          const phaseUpdatedAt = new Date(phase.updatedAt).getTime()
          if (Number.isFinite(phaseUpdatedAt)) {
            latestUpdatedAt = Math.max(latestUpdatedAt, phaseUpdatedAt)
          }
          const phaseKey = `${phase.phaseName}::${phase.phaseMeasure}`
          const existing = phaseMap.get(phaseKey)
          if (existing) {
            existing.designLength += phase.designLength
            existing.completedLength += phase.completedLength
            existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, phaseUpdatedAt)
          } else {
            phaseMap.set(phaseKey, {
              phaseName: phase.phaseName,
              phaseMeasure: phase.phaseMeasure,
              designLength: phase.designLength,
              completedLength: phase.completedLength,
              latestUpdatedAt: phaseUpdatedAt,
            })
          }
        })
      })

      const phaseHighlights = Array.from(phaseMap.entries())
        .map(([phaseKey, phase]) => {
          const completedPercent =
            phase.designLength > 0
              ? Math.min(100, Math.round((phase.completedLength / phase.designLength) * 100))
              : 0
          return {
            key: phaseKey,
            phaseName: phase.phaseName,
            phaseMeasure: phase.phaseMeasure,
            designLength: phase.designLength,
            completedLength: phase.completedLength,
            completedPercent,
            updatedAt: new Date(phase.latestUpdatedAt).toISOString(),
          }
        })
        .sort((a, b) => {
          const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          if (updatedDiff !== 0) return updatedDiff
          return a.phaseName.localeCompare(
            b.phaseName,
            locale === 'fr' ? 'fr-FR' : 'zh-CN',
          )
        })
        .slice(0, 3)

      return {
        key,
        kind: group.kind,
        title: group.title,
        roads: sortedGroupRoads,
        roadCount: sortedGroupRoads.length,
        phaseCount: sortedGroupRoads.reduce((sum, road) => sum + road.phases.length, 0),
        latestUpdatedAt: new Date(latestUpdatedAt || Date.now()).toISOString(),
        phaseHighlights,
        order: group.order,
      }
    })
    .sort((a, b) => {
      const kindRank = { project: 0, special: 1, ungrouped: 2 }
      const kindDiff = kindRank[a.kind] - kindRank[b.kind]
      if (kindDiff !== 0) return kindDiff
      if (a.order !== b.order) return a.order - b.order
      return a.title.localeCompare(b.title, locale === 'fr' ? 'fr-FR' : 'zh-CN')
    })
    .map(({ order: _order, ...group }) => group)
}

const RoadBoard = forwardRef<RoadBoardHandle, Props>(function RoadBoard(
  { initialRoads, projects, canManage }: Props,
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
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)
  const sortedRoads = useMemo(() => sortRoads(roads, locale), [roads, locale])
  const roadGroups = useMemo(
    () => buildRoadGroups(sortedRoads, projects, locale),
    [sortedRoads, projects, locale],
  )
  const effectiveExpandedGroupKey = roadGroups.some((group) => group.key === expandedGroupKey)
    ? expandedGroupKey
    : null

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

  const toggleGroup = (groupKey: string) => {
    setExpandedGroupKey((current) => (current === groupKey ? null : groupKey))
  }

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
      projectId: road.projectId ? String(road.projectId) : '',
    })
    setEditingId(road.id)
    setError(null)
    setShowFormModal(true)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          <span>{t.list.overview}</span>
          <span className="h-px w-12 bg-slate-200" />
          {sortedRoads.length === 0 ? (
            <span>{t.list.none}</span>
          ) : (
            <>
              <span>{formatProgressCopy(t.list.groupCount, { count: roadGroups.length })}</span>
              <span className="text-slate-300">/</span>
              <span>{formatProgressCopy(t.list.count, { count: sortedRoads.length })}</span>
            </>
          )}
        </div>

        {sortedRoads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            {t.list.emptyHelp}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {roadGroups.map((group) => (
              <RoadGroupCard
                key={group.key}
                group={group}
                expanded={effectiveExpandedGroupKey === group.key}
                onToggle={toggleGroup}
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
          projects={projects}
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

interface RoadGroupCardProps {
  group: RoadBoardGroup
  expanded: boolean
  onToggle: (groupKey: string) => void
  onEdit: (road: RoadSectionProgressSummaryDTO) => void
  onDelete: (id: number) => void
  canManage: boolean
  locale: Locale
}

const RoadGroupCard = ({
  group,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  canManage,
  locale,
}: RoadGroupCardProps) => {
  const copy = getProgressCopy(locale)
  const previewRoads = group.roads.slice(0, 4)
  const hiddenRoadCount = Math.max(group.roadCount - previewRoads.length, 0)
  const groupLabel =
    group.kind === 'special'
      ? copy.group.specialLabel
      : group.kind === 'ungrouped'
        ? copy.group.ungroupedLabel
        : copy.group.projectLabel

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-500">{groupLabel}</p>
            <h3 className="text-xl font-semibold text-slate-900">{group.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={chipTone}>{formatProgressCopy(copy.group.roadCount, { count: group.roadCount })}</span>
            <span className={chipTone}>{formatProgressCopy(copy.group.phaseCount, { count: group.phaseCount })}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(group.key)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {expanded ? copy.group.collapse : copy.group.expand}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {previewRoads.map((road) => (
          <span key={road.id} className={chipTone}>
            {resolveRoadName(road, locale)}
          </span>
        ))}
        {hiddenRoadCount ? (
          <span className={chipTone}>{formatProgressCopy(copy.group.moreRoads, { count: hiddenRoadCount })}</span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {group.phaseHighlights.length ? (
          group.phaseHighlights.map((phase) => (
            <PhaseSummaryBar
              key={phase.key}
              phase={phase}
              locale={locale}
            />
          ))
        ) : (
          <p className="text-sm text-slate-600">{copy.phase.list.emptyHint}</p>
        )}
        <p className="text-xs text-slate-500">
          {copy.group.updated}
          {formatDateTime(locale, group.latestUpdatedAt)}
        </p>
      </div>

      {expanded ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {group.roads.map((road) => (
              <RoadListItem
                key={road.id}
                road={road}
                onEdit={onEdit}
                onDelete={onDelete}
                canManage={canManage}
                locale={locale}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type PhaseSummaryBarProps = {
  phase: {
    phaseName: string
    phaseMeasure: PhaseMeasure
    designLength: number
    completedPercent: number
  }
  locale: Locale
}

const PhaseSummaryBar = ({ phase, locale }: PhaseSummaryBarProps) => {
  const progressWidth = Math.max(0, Math.min(100, phase.completedPercent))
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner shadow-slate-100">
      <div className="relative flex-1 overflow-hidden rounded-xl bg-slate-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-xl bg-gradient-to-r ${getProgressTone(progressWidth)} transition-all`}
          style={{ width: `${progressWidth}%` }}
        />
        <div className="relative flex items-center justify-between px-3 py-2 text-[13px] font-semibold text-slate-900">
          <span className="truncate">{localizeProgressTerm('phase', phase.phaseName, locale)}</span>
          <span className="text-xs font-bold">{progressWidth}%</span>
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
        {formatDesignLength(phase, locale)}
      </span>
    </div>
  )
}

interface RoadListItemProps {
  road: RoadSectionProgressSummaryDTO
  onEdit: (road: RoadSectionProgressSummaryDTO) => void
  onDelete: (id: number) => void
  canManage: boolean
  locale: Locale
}

const RoadListItem = ({ road, onEdit, onDelete, canManage, locale }: RoadListItemProps) => {
  const copy = getProgressCopy(locale)
  const topRecent = [...(road.phases ?? [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 2)

  const handleAction = (
    event: ReactMouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault()
    action()
  }

  return (
    <Link
      href={`/progress/${road.slug}`}
      className="group block rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{resolveRoadName(road, locale)}</h4>
          <p className="mt-1 text-xs text-slate-600">
            {copy.card.start} <span className={chipTone}>{road.startPk}</span> · {copy.card.end}{' '}
            <span className={chipTone}>{road.endPk}</span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-700">
            {copy.card.slug}：{road.slug}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(event) => handleAction(event, () => onEdit(road))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.card.edit}
            </button>
            <button
              type="button"
              onClick={(event) => handleAction(event, () => onDelete(road.id))}
              className="rounded-xl border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
            >
              {copy.card.delete}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {topRecent.length ? (
          topRecent.map((phase) => (
            <PhaseSummaryBar
              key={phase.phaseId}
              phase={phase}
              locale={locale}
            />
          ))
        ) : (
          <p className="text-sm text-slate-600">{copy.phase.list.emptyHint}</p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {copy.card.updated}
        {formatDateTime(locale, road.updatedAt)}
      </p>
    </Link>
  )
}
