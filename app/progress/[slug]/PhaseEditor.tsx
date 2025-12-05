/* eslint-disable @next/next/no-img-element */
'use client'

import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

import { AlertDialog, type AlertTone } from '@/components/AlertDialog'
import type {
  IntervalSide,
  PhaseDTO,
  PhaseDefinitionDTO,
  PhaseIntervalPayload,
  PhaseMeasure,
  PhasePayload,
  RoadSectionDTO,
  InspectionStatus,
} from '@/lib/progressTypes'
import type { WorkflowBinding, WorkflowLayerTemplate } from '@/lib/progressWorkflow'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressList, localizeProgressTerm, localizeProgressText } from '@/lib/i18n/progressDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

interface Props {
  road: RoadSectionDTO
  initialPhases: PhaseDTO[]
  phaseDefinitions: PhaseDefinitionDTO[]
  workflows: WorkflowBinding[]
  canManage: boolean
  canInspect: boolean
  canViewInspection: boolean
}

type Status = 'pending' | 'inProgress' | 'approved' | 'nonDesign'

type InspectionSlice = {
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  status: InspectionStatus
  updatedAt: number
}

type LatestPointInspection = {
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  status: InspectionStatus
  layers: string[]
  checks?: string[]
  updatedAt: number
}

interface Segment {
  start: number
  end: number
  status: Status
  spec?: string | null
  billQuantity?: number | null
  workflow?: WorkflowBinding
  workflowLayers?: WorkflowLayerTemplate[]
  workflowTypeOptions?: string[]
}

interface Side {
  label: string
  segments: Segment[]
}

interface LinearSide {
  label: string
  segments: Segment[]
  designTotal: number
}

interface LinearView {
  left: LinearSide
  right: LinearSide
  total: number
}

interface PointView {
  min: number
  max: number
  points: { startPk: number; endPk: number; side: IntervalSide; spec?: string | null; billQuantity?: number | null }[]
}

interface SelectedSegment {
  phase: string
  phaseId: number
  measure: PhaseMeasure
  layers: string[]
  checks: string[]
  side: IntervalSide
  sideLabel: string
  start: number
  end: number
  spec?: string | null
  billQuantity?: number | null
  workflow?: WorkflowBinding
  workflowLayers?: WorkflowLayerTemplate[]
  workflowTypeOptions?: string[]
}

type AlertDialogState = {
  title: string
  description?: string
  tone?: AlertTone
  actionLabel?: string
  cancelLabel?: string
  onAction?: () => void
  onCancel?: () => void
}

type InspectionSubmitPayload = {
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  layers: string[]
  checks: string[]
  types: string[]
  remark: string
  appointmentDate: string
}

const statusTone: Record<Status, string> = {
  pending: 'bg-gradient-to-r from-white via-slate-100 to-white text-slate-900 shadow-sm shadow-slate-900/10',
  inProgress: 'bg-gradient-to-r from-amber-300 via-orange-200 to-amber-200 text-slate-900 shadow-md shadow-amber-400/30',
  approved: 'bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-200 text-slate-900 shadow-md shadow-emerald-400/30',
  nonDesign: 'bg-slate-800 text-slate-100 shadow-inner shadow-slate-900/30',
}

const normalizePhaseDTO = (phase: PhaseDTO): PhaseDTO => ({
  ...phase,
  pointHasSides: Boolean(phase.pointHasSides),
  resolvedLayers: Array.isArray(phase.resolvedLayers) ? [...phase.resolvedLayers] : [],
  resolvedChecks: Array.isArray(phase.resolvedChecks) ? [...phase.resolvedChecks] : [],
  definitionLayerIds: Array.isArray(phase.definitionLayerIds) ? [...phase.definitionLayerIds] : [],
  definitionCheckIds: Array.isArray(phase.definitionCheckIds) ? [...phase.definitionCheckIds] : [],
  layerIds: Array.isArray(phase.layerIds) ? [...phase.layerIds] : [],
  checkIds: Array.isArray(phase.checkIds) ? [...phase.checkIds] : [],
  intervals: phase.intervals.map((interval) => ({
    startPk: Number(interval.startPk) || 0,
    endPk: Number(interval.endPk) || 0,
    side: interval.side,
    spec: interval.spec ?? null,
    billQuantity: interval.billQuantity ?? null,
  })),
})

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const todayISODate = () => new Date().toISOString().slice(0, 10)

const buildPointKey = (phaseId: number, side: IntervalSide, startPk: number, endPk: number) =>
  `${phaseId}-${side}-${Math.round(Number(startPk || 0) * 1000)}-${Math.round(Number(endPk || 0) * 1000)}`

const normalizeRange = (start: number, end: number) => {
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
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

const normalizeInterval = (interval: PhaseIntervalPayload, measure: PhaseMeasure) => {
  const start = Number(interval.startPk)
  const end = Number(interval.endPk)
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
  return {
    startPk: orderedStart,
    endPk: orderedEnd,
    side: interval.side,
    spec: typeof interval.spec === 'string' && interval.spec.trim() ? interval.spec.trim() : null,
    billQuantity:
      interval.billQuantity === null || interval.billQuantity === undefined
        ? null
        : Number.isFinite(Number(interval.billQuantity))
          ? Number(interval.billQuantity)
          : null,
  }
}

const getPointCenter = (startPk: number, endPk: number) => (startPk + endPk) / 2
const normalizeLabel = (value: string) => value.trim().toLowerCase()


const fillNonDesignGaps = (segments: Segment[], start: number, end: number) => {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const result: Segment[] = []
  let cursor = start
  sorted.forEach((seg) => {
    if (seg.start > cursor) {
      result.push({ start: cursor, end: seg.start, status: 'nonDesign' })
    }
    result.push(seg)
    cursor = Math.max(cursor, seg.end)
  })
  if (cursor < end) {
    result.push({ start: cursor, end, status: 'nonDesign' })
  }
  return result
}

const statusPriority: Record<InspectionStatus, number> = {
  APPROVED: 5,
  IN_PROGRESS: 4,
  SUBMITTED: 3,
  SCHEDULED: 2,
  PENDING: 1,
}

const mapInspectionStatus = (status: InspectionStatus): Status => {
  if (status === 'APPROVED') return 'approved'
  if (status === 'IN_PROGRESS' || status === 'SUBMITTED') return 'inProgress'
  return 'pending'
}

const workflowSatisfiedStatuses: InspectionStatus[] = ['PENDING', 'SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED']

const mergeAdjacentSegments = (segments: Segment[]) => {
  const merged: Segment[] = []
  segments.forEach((seg) => {
    const last = merged[merged.length - 1]
    const sameSpec =
      (last?.spec ?? null) === (seg.spec ?? null) &&
      (last?.billQuantity ?? null) === (seg.billQuantity ?? null)
    if (last && last.status === seg.status && sameSpec && Math.abs(last.end - seg.start) < 1e-6) {
      merged[merged.length - 1] = { ...last, end: seg.end }
    } else {
      merged.push(seg)
    }
  })
  return merged
}

const applyInspectionStatuses = (segments: Segment[], inspections: InspectionSlice[]) => {
  if (!inspections.length) return segments
  const boundaries = new Set<number>()
  segments.forEach((seg) => {
    boundaries.add(seg.start)
    boundaries.add(seg.end)
  })
  inspections.forEach((insp) => {
    boundaries.add(insp.startPk)
    boundaries.add(insp.endPk)
  })
  const sorted = Array.from(boundaries).sort((a, b) => a - b)
  const result: Segment[] = []
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i]
    const end = sorted[i + 1]
    if (end <= start) continue
    const design = segments.find((seg) => start >= seg.start && end <= seg.end)
    if (!design) continue
    let status = design.status
    if (design.status !== 'nonDesign') {
      const overlaps = inspections.filter(
        (insp) => Math.max(start, insp.startPk) < Math.min(end, insp.endPk),
      )
      if (overlaps.length) {
        const best = overlaps.reduce<InspectionSlice | null>((prev, current) => {
          if (!prev) return current
          const prevPriority = statusPriority[prev.status] ?? 0
          const currentPriority = statusPriority[current.status] ?? 0
          if (currentPriority > prevPriority) return current
          if (currentPriority === prevPriority && current.updatedAt > prev.updatedAt) {
            return current
          }
          return prev
        }, null)
        if (best) {
          status = mapInspectionStatus(best.status)
        }
      }
    }
    result.push({
      start,
      end,
      status,
      spec: design.spec,
      billQuantity: design.billQuantity,
    })
  }
  return mergeAdjacentSegments(result)
}

const calcDesignBySide = (segments: Segment[]) =>
  segments.reduce((acc, seg) => (seg.status === 'nonDesign' ? acc : acc + Math.max(0, seg.end - seg.start)), 0)

const calcCompletedBySide = (segments: Segment[]) =>
  segments.reduce(
    (acc, seg) => (seg.status === 'approved' ? acc + Math.max(0, seg.end - seg.start) : acc),
    0,
  )

const buildLinearView = (
  phase: PhaseDTO,
  roadLength: number,
  sideLabels: { left: string; right: string },
  inspections: InspectionSlice[] = [],
): LinearView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'LINEAR'))
  const left: Segment[] = []
  const right: Segment[] = []
  normalized.forEach((interval) => {
    const baseSegment = {
      start: interval.startPk,
      end: interval.endPk,
      status: 'pending' as Status,
      spec: interval.spec,
      billQuantity: interval.billQuantity,
    }
    if (interval.side === 'LEFT') left.push(baseSegment)
    if (interval.side === 'RIGHT') right.push(baseSegment)
    if (interval.side === 'BOTH') {
      left.push({ ...baseSegment })
      right.push({ ...baseSegment })
    }
  })

  const maxEnd = Math.max(
    roadLength,
    ...normalized.map((i) => i.endPk),
    ...normalized.map((i) => i.startPk),
    0,
  )
  const total = Math.max(maxEnd, roadLength || 0, 1)
  const orderedInspections = inspections.map((insp) => {
    const start = Number(insp.startPk)
    const end = Number(insp.endPk)
    const [orderedStart, orderedEnd] = start <= end ? [start, end] : [end, start]
    return { ...insp, startPk: orderedStart, endPk: orderedEnd }
  })
  const leftInspections = orderedInspections.filter(
    (insp) => insp.side === 'LEFT' || insp.side === 'BOTH',
  )
  const rightInspections = orderedInspections.filter(
    (insp) => insp.side === 'RIGHT' || insp.side === 'BOTH',
  )

  const leftSegments = applyInspectionStatuses(fillNonDesignGaps(left, 0, total), leftInspections)
  const rightSegments = applyInspectionStatuses(fillNonDesignGaps(right, 0, total), rightInspections)
  return {
    left: {
      label: sideLabels.left,
      segments: leftSegments,
      designTotal: calcDesignBySide(leftSegments),
    },
    right: {
      label: sideLabels.right,
      segments: rightSegments,
      designTotal: calcDesignBySide(rightSegments),
    },
    total,
  }
}

const buildPointView = (phase: PhaseDTO, fallbackStart: number, fallbackEnd: number): PointView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'POINT'))
  const manualBoundaries = normalized.flatMap((item) => [item.startPk, item.endPk])
  const fallbackBoundaries = [fallbackStart, fallbackEnd].filter(Number.isFinite)
  const boundaries = manualBoundaries.length ? manualBoundaries : fallbackBoundaries
  const rawMin = boundaries.length ? Math.min(...boundaries) : fallbackStart
  const rawMax = boundaries.length ? Math.max(...boundaries) : fallbackEnd
  const safeMin = Number.isFinite(rawMin) ? rawMin : 0
  const safeMax = Number.isFinite(rawMax) ? rawMax : safeMin + 1
  return {
    min: safeMin,
    max: safeMax,
    points: normalized,
  }
}

const useElementWidth = (ref: RefObject<HTMLElement>) => {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) {
      setWidth(0)
      return
    }
    const updateWidth = () => {
      setWidth(node.clientWidth || 0)
    }
    updateWidth()

    if (typeof window === 'undefined') {
      return
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth())
      observer.observe(node)
      return () => observer.disconnect()
    }

    const handleResize = () => updateWidth()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [ref])

  return width
}

const calcCombinedPercent = (left: Segment[], right: Segment[]) => {
  const leftLen = calcDesignBySide(left)
  const rightLen = calcDesignBySide(right)
  const total = leftLen + rightLen
  if (total <= 0) return 0
  const completed = calcCompletedBySide(left) + calcCompletedBySide(right)
  return Math.round((completed / total) * 100)
}

interface PointLaneProps {
  phase: PhaseDTO
  points: PointView['points']
  containerClassName: string
  rangeLabel?: string
  label?: string
  showHeader?: boolean
  wrapperClassName?: string
  sideLabelMap: Record<IntervalSide, string>
  resolvePointBadge: (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => string
  onPointSelect: (segment: SelectedSegment) => void
}

function PointLane({
  phase,
  points,
  containerClassName,
  rangeLabel,
  label,
  showHeader = false,
  wrapperClassName = 'space-y-2',
  sideLabelMap,
  resolvePointBadge,
  onPointSelect,
}: PointLaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(containerRef)
  const columns = Math.max(1, Math.floor(containerWidth / 64))

  const rows = useMemo(() => {
    if (!points.length) return []
    const normalized = [...points]
      .map((point) => ({ point, centerPk: getPointCenter(point.startPk, point.endPk) }))
      .sort((a, b) => a.centerPk - b.centerPk)

    const rowCount = Math.max(1, Math.ceil(normalized.length / columns))
    const chunked: typeof normalized[] = []
    let cursor = 0
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const remaining = normalized.length - cursor
      const remainingRows = rowCount - rowIndex
      const take = Math.max(1, Math.ceil(remaining / remainingRows))
      chunked.push(normalized.slice(cursor, cursor + take))
      cursor += take
    }
    return chunked
  }, [points, columns])

  const handlePointClick = (item: PointView['points'][number]) => {
    const sideLabel = sideLabelMap[item.side]
    onPointSelect({
      phase: phase.name,
      phaseId: phase.id,
      measure: phase.measure,
      layers: phase.resolvedLayers,
      checks: phase.resolvedChecks,
      side: item.side,
      sideLabel,
      start: item.startPk,
      end: item.endPk,
      spec: item.spec ?? null,
      billQuantity: item.billQuantity ?? null,
    })
  }

  return (
    <div className={wrapperClassName}>
      {showHeader ? (
        <div className="flex items-center justify-between text-xs text-slate-200/80">
          {label ? (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
              {label}
            </span>
          ) : null}
          {rangeLabel ? <span className="text-slate-300">{rangeLabel}</span> : null}
        </div>
      ) : null}
      <div className="space-y-3" ref={containerRef}>
        {rows.map((row, rowIndex) => (
          <div
            key={`${phase.id}-${rowIndex}`}
            className={containerClassName}
          >
            <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
            <div
              className="relative grid items-center gap-4"
              style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
            >
              {row.map((entry, idx) => {
                const item = entry.point
                const rangeText = `${formatPK(item.startPk)} – ${formatPK(item.endPk)}`
                const sideLabelText =
                  item.side === 'LEFT'
                    ? sideLabelMap.LEFT
                    : item.side === 'RIGHT'
                      ? sideLabelMap.RIGHT
                      : sideLabelMap.BOTH
                return (
                  <button
                    key={`${item.startPk}-${item.endPk}-${idx}`}
                    type="button"
                    className="flex flex-col items-center gap-1 text-center transition hover:scale-105"
                    onClick={() => handlePointClick(item)}
                    title={`${rangeText} · ${sideLabelText}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-lg shadow-emerald-400/25 ring-2 ring-white/20">
                      {resolvePointBadge(phase.id, item.side, item.startPk, item.endPk)}
                    </div>
                    <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                      {formatPK(entry.centerPk)}
                    </div>
                    <p className="text-[10px] text-slate-300">{sideLabelText}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


export function PhaseEditor({
  road,
  initialPhases,
  phaseDefinitions,
  workflows,
  canManage,
  canInspect,
  canViewInspection,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const progressCopy = getProgressCopy(locale)
  const t = progressCopy.phase
  const workflowCopy = progressCopy.workflow
  const sideOptions: { value: IntervalSide; label: string }[] = useMemo(
    () => [
      { value: 'BOTH', label: t.form.sideBoth },
      { value: 'LEFT', label: t.form.sideLeft },
      { value: 'RIGHT', label: t.form.sideRight },
    ],
    [t.form.sideBoth, t.form.sideLeft, t.form.sideRight],
  )
  const sideLabelMap = useMemo(
    () => ({
      BOTH: t.form.sideBoth,
      LEFT: t.form.sideLeft,
      RIGHT: t.form.sideRight,
    }),
    [t.form.sideBoth, t.form.sideLeft, t.form.sideRight],
  )
  const defaultInspectionTypes = t.inspection.types
  const statusLabel = (status: Status) => {
    switch (status) {
      case 'pending':
        return t.status.pending
      case 'inProgress':
        return t.status.inProgress
      case 'approved':
        return t.status.approved
      default:
        return t.status.nonDesign
    }
  }

  const roadStart = useMemo(() => {
    const start = Number(road.startPk)
    return Number.isFinite(start) ? start : 0
  }, [road.startPk])

  const roadEnd = useMemo(() => {
    const end = Number(road.endPk)
    return Number.isFinite(end) ? end : roadStart
  }, [road.endPk, roadStart])

  const defaultInterval = useMemo<PhaseIntervalPayload>(
    () => ({ startPk: roadStart, endPk: roadEnd, side: 'BOTH', spec: '', billQuantity: null }),
    [roadStart, roadEnd],
  )

  const [phases, setPhases] = useState<PhaseDTO[]>(() => initialPhases.map(normalizePhaseDTO))
  const [definitions, setDefinitions] = useState<PhaseDefinitionDTO[]>(phaseDefinitions)
  const workflowMap = useMemo(() => {
    const map = new Map<number, WorkflowBinding>()
    workflows.forEach((item) => map.set(item.phaseDefinitionId, item))
    return map
  }, [workflows])
  const [inspectionSlices, setInspectionSlices] = useState<InspectionSlice[]>([])
  const [name, setName] = useState(() => phaseDefinitions[0]?.name ?? '')
  const [measure, setMeasure] = useState<PhaseMeasure>(() => phaseDefinitions[0]?.measure ?? 'LINEAR')
  const [pointHasSides, setPointHasSides] = useState(() => Boolean(phaseDefinitions[0]?.pointHasSides))
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([defaultInterval])
  const [definitionId, setDefinitionId] = useState<number | null>(() => phaseDefinitions[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PhaseDTO | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

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
    setIntervals((prev) => [...prev, { ...defaultInterval }])
  }

  const removeInterval = (index: number) => {
    setIntervals((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resetForm = () => {
    const defaultDefinition = definitions[0]
    setDefinitionId(defaultDefinition?.id ?? null)
    setName(defaultDefinition?.name ?? '')
    setMeasure(defaultDefinition?.measure ?? 'LINEAR')
    setPointHasSides(Boolean(defaultDefinition?.pointHasSides))
    setIntervals([defaultInterval])
    setEditingId(null)
    setError(null)
  }

  const resetDeleteState = () => {
    setDeleteTarget(null)
    setDeleteError(null)
    setDeletingId(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
  }

  const closeFormModal = () => {
    resetForm()
    setShowFormModal(false)
  }

  const startEdit = (phase: PhaseDTO) => {
    const normalized = normalizePhaseDTO(phase)
    setName(normalized.name)
    setMeasure(normalized.measure)
    setDefinitionId(normalized.definitionId)
    setIntervals(
      normalized.intervals.map((i) => ({
        startPk: i.startPk,
        endPk: i.endPk,
        side: i.side,
        spec: i.spec ?? '',
        billQuantity: i.billQuantity ?? null,
      })),
    )
    setPointHasSides(Boolean(normalized.pointHasSides))
    setEditingId(normalized.id)
    setError(null)
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    setShowFormModal(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    if (!canManage) return
    startTransition(async () => {
      const intervalInvalid = intervals.some((item) => {
        const start = Number(item.startPk)
        const end = Number(item.endPk)
        return !Number.isFinite(start) || !Number.isFinite(end)
      })
      if (intervalInvalid) {
        setError(t.errors.invalidRange)
        return
      }
      if (!definitionId) {
        setError(t.errors.definitionMissing)
        return
      }
      const payload: PhasePayload = {
        phaseDefinitionId: definitionId,
        name,
        measure,
        pointHasSides: measure === 'POINT' ? pointHasSides : false,
        intervals: intervals.map((item) => {
          const startPk = Number(item.startPk)
          const endPk = Number(item.endPk)
          const spec = typeof item.spec === 'string' ? item.spec.trim() : ''
          const billQuantityInput = item.billQuantity
          const numericBillQuantity =
            billQuantityInput === null || billQuantityInput === undefined
              ? null
              : Number(billQuantityInput)
          return {
            startPk,
            endPk,
            side: item.side,
            spec: spec || undefined,
            billQuantity:
              numericBillQuantity === null || !Number.isFinite(numericBillQuantity)
                ? undefined
                : numericBillQuantity,
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
        setError(data.message ?? t.errors.saveFailed)
        return
      }
      const phase = normalizePhaseDTO(data.phase)
      setDefinitions((prev) => {
        const existing = prev.find((d) => d.id === phase.definitionId)
        if (!existing) {
          return [
            ...prev,
            {
              id: phase.definitionId,
              name: phase.definitionName,
              measure: phase.measure,
              pointHasSides: phase.pointHasSides,
              defaultLayers: phase.resolvedLayers,
              defaultChecks: phase.resolvedChecks,
              isActive: true,
              unitPrice: null,
              createdAt: phase.createdAt,
              updatedAt: phase.updatedAt,
            },
          ]
        }
        return prev.map((item) =>
          item.id === phase.definitionId
            ? {
                ...item,
                measure: phase.measure,
                pointHasSides: phase.pointHasSides,
                defaultLayers: phase.resolvedLayers,
                defaultChecks: phase.resolvedChecks,
                updatedAt: phase.updatedAt,
              }
            : item,
        )
      })
      setPhases((prev) =>
        editingId ? prev.map((item) => (item.id === editingId ? phase : item)) : [...prev, phase],
      )
      const localizedName = localizeProgressTerm('phase', phase.name, locale)
      setSuccessMessage(
        editingId
          ? formatProgressCopy(t.success.updated, { name: localizedName })
          : formatProgressCopy(t.success.created, { name: localizedName }),
      )
      setShowFormModal(false)
      resetForm()
    })
  }

  const handleDelete = (phase: PhaseDTO) => {
    if (!canManage) return
    setDeleteError(null)
    setDeleteTarget(phase)
  }

  const confirmDelete = async () => {
    if (!canManage || !deleteTarget) return
    setDeleteError(null)
    setDeletingId(deleteTarget.id)
    try {
      const res = await fetch(`/api/progress/${road.slug}/phases/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setDeleteError(data.message ?? t.errors.deleteFailed)
        return
      }
      setPhases((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) {
        resetForm()
      }
      if (selectedSegment?.phaseId === deleteTarget.id) {
        setSelectedSegment(null)
        resetInspectionForm()
      }
      resetDeleteState()
    } catch {
      setDeleteError(t.errors.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const linearViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'LINEAR')
      .map((phase) => ({
        phase,
        view: buildLinearView(
          phase,
          roadLength,
          { left: sideLabelMap.LEFT, right: sideLabelMap.RIGHT },
          inspectionSlices.filter((insp) => insp.phaseId === phase.id),
        ),
      }))
  }, [phases, roadLength, sideLabelMap.LEFT, sideLabelMap.RIGHT, inspectionSlices])

  const pointViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'POINT')
      .map((phase) => ({
        phase,
        view: buildPointView(phase, roadStart, roadEnd),
      }))
  }, [phases, roadStart, roadEnd])

  const resolveWorkflowSelection = (phase: PhaseDTO) => {
    const binding = workflowMap.get(phase.definitionId)
    if (!binding) return null
    const sortedLayers = [...binding.layers].sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage
      return a.name.localeCompare(b.name, 'zh-Hans')
    })
    const layerNames = sortedLayers.map((layer) => layer.name)
    const checkNames = sortedLayers.flatMap((layer) => layer.checks.map((check) => check.name))
    const typeOptions =
      binding.defaultTypes && binding.defaultTypes.length ? binding.defaultTypes : defaultInspectionTypes
    return { binding, sortedLayers, layerNames, checkNames, typeOptions }
  }

  const openInspectionModal = (phase: PhaseDTO, segment: SelectedSegment) => {
    const workflowSelection = resolveWorkflowSelection(phase)
    const layers = workflowSelection?.layerNames.length ? workflowSelection.layerNames : segment.layers
    const checks = workflowSelection?.checkNames.length ? workflowSelection.checkNames : segment.checks
    const typeOptions = workflowSelection?.typeOptions ?? defaultInspectionTypes
    setSelectedSegment({
      ...segment,
      phase: localizeProgressTerm('phase', phase.name, locale),
      layers: localizeProgressList('layer', layers, locale, { phaseName: phase.name }),
      checks: localizeProgressList('check', checks, locale),
      workflow: workflowSelection?.binding,
      workflowLayers: workflowSelection?.sortedLayers,
      workflowTypeOptions: typeOptions,
    })
  }

  const handlePointSelect = (segment: SelectedSegment) => {
    if (!canInspect) {
      alert(t.alerts.noInspectPermission)
      return
    }
    const phase = phases.find((item) => item.id === segment.phaseId)
    if (!phase) return
    openInspectionModal(phase, segment)
  }

  const toggleToken = (value: string, list: string[], setter: (next: string[]) => void) => {
    const exists = list.includes(value)
    setter(exists ? list.filter((item) => item !== value) : [...list, value])
  }

  const toggleCheck = (value: string) => {
    const exists = selectedChecks.includes(value)
    if (exists) {
      setSelectedChecks((prev) => prev.filter((item) => item !== value))
      setManualCheckExclusions((prev) => (prev.includes(value) ? prev : [...prev, value]))
    } else {
      setSelectedChecks((prev) => [...prev, value])
      setManualCheckExclusions((prev) => prev.filter((item) => item !== value))
    }
  }

  const resetInspectionForm = () => {
    setSelectedLayers([])
    setSelectedChecks([])
    setSelectedTypes([])
    setRemark('')
    setSubmitError(null)
    setAppointmentDateInput('')
    setAlertDialog(null)
  }

  const raiseSubmitError = (message: string, tone: AlertTone = 'warning') => {
    setSubmitError(message)
    setAlertDialog({
      title: t.inspection.dialogTitle,
      description: message,
      tone,
    })
  }

  const performSubmit = async (payload: InspectionSubmitPayload) => {
    setSubmitPending(true)
    setSubmitError(null)
    const res = await fetch(`/api/progress/${road.slug}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    setSubmitPending(false)
    if (!res.ok) {
      raiseSubmitError(data.message ?? t.errors.submitFailed)
      return
    }
    setSuccessMessage(t.inspection.submitSuccess)
    await fetchLatestInspections()
    setSelectedSegment(null)
    resetInspectionForm()
  }

  const submitInspection = async () => {
    if (!selectedSegment) return
    // 拉取最新报检数据，确保前置校验使用最新状态
    await fetchLatestInspections({ phaseId: selectedSegment.phaseId })
    const hasStart = startPkInput.trim() !== ''
    const hasEnd = endPkInput.trim() !== ''
    const startPk = Number(startPkInput)
    const endPk = Number(endPkInput)
    if (!hasStart || !hasEnd || !Number.isFinite(startPk) || !Number.isFinite(endPk)) {
      raiseSubmitError(t.errors.submitRangeInvalid)
      return
    }
    if (!selectedLayers.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return
    }
    if (!selectedChecks.length) {
      raiseSubmitError(t.errors.submitCheckMissing)
      return
    }
    const allowedTypes = activeInspectionTypes
    const normalizedTypes = selectedTypes.filter((type) => allowedTypes.includes(type))
    if (!normalizedTypes.length) {
      raiseSubmitError(t.errors.submitTypeMissing)
      return
    }
    if (!appointmentDateInput) {
      raiseSubmitError(t.errors.submitAppointmentMissing)
      return
    }
    const payload: InspectionSubmitPayload = {
      phaseId: selectedSegment.phaseId,
      side: selectedSide,
      startPk,
      endPk,
      layers: selectedLayers,
      checks: selectedChecks,
      types: normalizedTypes,
      remark,
      appointmentDate: appointmentDateInput,
    }
    if (selectedSegment?.workflowLayers?.length && workflowLayerByName) {
      const completedWorkflowLayerIds = computeCompletedWorkflowLayerIds()
      const completedWorkflowChecksByLayer = computeCompletedWorkflowChecksByLayer()
      const satisfied = new Set<string>()
      if (completedWorkflowLayerIds) {
        completedWorkflowLayerIds.forEach((id) => satisfied.add(id))
      }
      const selectedLayerIds = new Set<string>()
      selectedLayers.forEach((layer) => {
        const meta = workflowLayerByName.get(normalizeLabel(layer))
        if (meta) {
          selectedLayerIds.add(meta.id)
        }
      })
      const missingDeps = new Set<string>()
      selectedLayers.forEach((layer) => {
        const meta = workflowLayerByName.get(normalizeLabel(layer))
        if (!meta || !meta.dependencies?.length) return
        meta.dependencies.forEach((dep) => {
          if (satisfied.has(dep) || selectedLayerIds.has(dep)) return
          const name = workflowLayerNameMap?.get(dep) ?? workflowLayerById?.get(dep)?.name ?? dep
          missingDeps.add(name)
        })
      })
      if (missingDeps.size) {
        raiseSubmitError(formatProgressCopy(t.inspection.missingDeps, { deps: Array.from(missingDeps).join(' / ') }))
        return
      }

      // 校验同层验收内容的顺序：需满足前置检查已完成或本次一同提交
      if (workflowCheckOrderByLayerId && workflowCheckMetaByName) {
        const selectedChecksNormalized = new Set(selectedChecks.map((item) => normalizeLabel(item)))
        const missingChecks = new Set<string>()
        selectedChecks.forEach((check) => {
          const meta = workflowCheckMetaByName.get(normalizeLabel(check))
          if (!meta) return
          const orderedChecks = workflowCheckOrderByLayerId.get(meta.layerId) ?? []
          for (let idx = 0; idx < meta.order; idx += 1) {
            const requiredName = orderedChecks[idx]
            const requiredNormalized = normalizeLabel(requiredName)
            const satisfiedSelected = selectedChecksNormalized.has(requiredNormalized)
            const satisfiedCompleted = completedWorkflowChecksByLayer
              ?.get(meta.layerId)
              ?.has(requiredNormalized)
            if (!satisfiedSelected && !satisfiedCompleted) {
              missingChecks.add(requiredName)
            }
          }
        })
        if (missingChecks.size) {
          raiseSubmitError(formatProgressCopy(t.inspection.missingChecks, { checks: Array.from(missingChecks).join(' / ') }))
          return
        }
      }
    }
    await performSubmit(payload)
  }

  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null)
  const [selectedSide, setSelectedSide] = useState<IntervalSide>('BOTH')
  const [startPkInput, setStartPkInput] = useState<string>('')
  const [endPkInput, setEndPkInput] = useState<string>('')
  const [appointmentDateInput, setAppointmentDateInput] = useState<string>('')
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null)
  const [submitPending, setSubmitPending] = useState(false)
  const [manualCheckExclusions, setManualCheckExclusions] = useState<string[]>([])
  const latestPointInspectionsRef = useRef<Map<string, LatestPointInspection>>(new Map())
  const [latestPointInspections, setLatestPointInspections] = useState<Map<string, LatestPointInspection>>(
    () => latestPointInspectionsRef.current,
  )
  const listJoiner = locale === 'fr' ? ', ' : ' / '
  const sentenceJoiner = locale === 'fr' ? '; ' : '；'
  const displayPhaseName = (name?: string) => (name ? localizeProgressTerm('phase', name, locale) : '')
  const displayLayerName = (name: string) =>
    localizeProgressTerm('layer', name, locale, {
      phaseName: selectedSegment?.workflow?.phaseName ?? selectedSegment?.phase,
    })
  const displayCheckName = (name: string) => localizeProgressTerm('check', name, locale)
  const displayTypeName = (name: string) => localizeProgressTerm('type', name, locale)
  const latestInspectionByPhase = useMemo(() => {
    const map = new Map<number, number>()
    inspectionSlices.forEach((item) => {
      const existing = map.get(item.phaseId) ?? 0
      if (item.updatedAt > existing) {
        map.set(item.phaseId, item.updatedAt)
      }
    })
    return map
  }, [inspectionSlices])

  const workflowPhaseNameForContext = useMemo(
    () => selectedSegment?.workflow?.phaseName ?? selectedSegment?.phase ?? '',
    [selectedSegment?.phase, selectedSegment?.workflow?.phaseName],
  )

  const splitLayerTokens = (value: string) =>
    value
      .split(/[\\/，,;]/)
      .map((item) => item.trim())
      .filter(Boolean)

  const sortedPhases = useMemo(() => {
    if (!phases.length) return phases
    const order = new Map(phases.map((phase, index) => [phase.id, index]))
    return [...phases].sort((a, b) => {
      const aInspection = latestInspectionByPhase.get(a.id) ?? 0
      const bInspection = latestInspectionByPhase.get(b.id) ?? 0
      if (aInspection !== bInspection) return bInspection - aInspection
      const aUpdatedRaw = new Date(a.updatedAt).getTime()
      const bUpdatedRaw = new Date(b.updatedAt).getTime()
      const aUpdated = Number.isFinite(aUpdatedRaw) ? aUpdatedRaw : 0
      const bUpdated = Number.isFinite(bUpdatedRaw) ? bUpdatedRaw : 0
      if (aUpdated !== bUpdated) return bUpdated - aUpdated
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
  }, [phases, latestInspectionByPhase])

  const resolvePointBadge = (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => {
    const latest = latestPointInspections.get(buildPointKey(phaseId, side, startPk, endPk))
    if (latest && latest.layers?.length) {
      const phaseName = phases.find((item) => item.id === phaseId)?.name
      const localized = localizeProgressList('layer', latest.layers, locale, { phaseName })
      const joined = localized.slice(0, 2).join(' / ')
      return joined || t.pointBadge.none
    }
    return t.pointBadge.none
  }

  const workflowLayerById = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    return new Map(selectedSegment.workflowLayers.map((layer) => [layer.id, layer]))
  }, [selectedSegment?.workflowLayers])

  const workflowLayerNameMap = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    return new Map(
      selectedSegment.workflowLayers.map((layer) => [
        layer.id,
        localizeProgressTerm('layer', layer.name, locale, { phaseName: workflowPhaseNameForContext }),
      ]),
    )
  }, [locale, selectedSegment?.workflowLayers, workflowPhaseNameForContext])

  const workflowChecksByLayerName = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, string[]>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const localizedName = localizeProgressTerm('layer', layer.name, locale, {
        phaseName: workflowPhaseNameForContext,
      })
      const localizedChecks = layer.checks.map((check) => localizeProgressTerm('check', check.name, locale))
      const mergedChecks = Array.from(new Set<string>([...layer.checks.map((check) => check.name), ...localizedChecks]))
      const names = [layer.name, localizedName]
      names.forEach((name) => {
        map.set(
          normalizeLabel(name),
          mergedChecks,
        )
      })
    })
    return map
  }, [locale, selectedSegment?.workflowLayers, workflowPhaseNameForContext])

  const workflowLayerByName = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, WorkflowLayerTemplate>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const names = [
        layer.name,
        localizeProgressTerm('layer', layer.name, locale, { phaseName: workflowPhaseNameForContext }),
        localizeProgressTerm('layer', layer.name, 'zh', { phaseName: workflowPhaseNameForContext }),
        localizeProgressTerm('layer', layer.name, 'fr', { phaseName: workflowPhaseNameForContext }),
      ]
      names
        .filter(Boolean)
        .forEach((name) => map.set(normalizeLabel(name), layer))
    })
    return map
  }, [locale, selectedSegment?.workflowLayers, workflowPhaseNameForContext])

  const workflowTypesByLayerName = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, Set<string>>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const localizedName = localizeProgressTerm('layer', layer.name, locale, {
        phaseName: workflowPhaseNameForContext,
      })
      const names = [layer.name, localizedName]
      const typeSet = new Set<string>()
      layer.checks.forEach((check) =>
        check.types.forEach((type) => {
          typeSet.add(type)
          typeSet.add(localizeProgressTerm('type', type, locale))
        }),
      )
      names.forEach((name) => map.set(normalizeLabel(name), typeSet))
    })
    return map
  }, [locale, selectedSegment?.workflowLayers, workflowPhaseNameForContext])

  const localizedWorkflowPhaseName = useMemo(() => {
    if (!selectedSegment?.workflow?.phaseName) return null
    return localizeProgressTerm('phase', selectedSegment.workflow.phaseName, locale)
  }, [locale, selectedSegment?.workflow?.phaseName])

  const localizedWorkflowSideRule = useMemo(() => {
    if (!selectedSegment?.workflow?.sideRule) return null
    return localizeProgressText(selectedSegment.workflow.sideRule, locale)
  }, [locale, selectedSegment?.workflow?.sideRule])

  const workflowCheckOrderByLayerId = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, string[]>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const localizedNames = layer.checks.map((check) => localizeProgressTerm('check', check.name, locale))
      map.set(layer.id, localizedNames)
    })
    return map
  }, [locale, selectedSegment?.workflowLayers])

  const workflowCheckTypesByName = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, Set<string>>()
    selectedSegment.workflowLayers.forEach((layer) => {
      layer.checks.forEach((check) => {
        const names = [check.name, localizeProgressTerm('check', check.name, locale)]
        const typeSet = new Set<string>()
        check.types.forEach((type) => {
          typeSet.add(type)
          typeSet.add(localizeProgressTerm('type', type, locale))
        })
        names.forEach((name) => map.set(normalizeLabel(name), typeSet))
      })
    })
    return map
  }, [locale, selectedSegment?.workflowLayers])

  const workflowCheckMetaByName = useMemo(() => {
    if (!selectedSegment?.workflowLayers?.length) return null
    const map = new Map<string, { layerId: string; order: number; types: Set<string> }>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const localizedNames = layer.checks.map((check) => localizeProgressTerm('check', check.name, locale))
      layer.checks.forEach((check, idx) => {
        const meta = { layerId: layer.id, order: idx, types: new Set(check.types) }
        const names = [check.name, localizedNames[idx]]
        names.forEach((name) => map.set(normalizeLabel(name), meta))
      })
    })
    return map
  }, [locale, selectedSegment?.workflowLayers])

  const computeCompletedWorkflowChecksByLayer = () => {
    if (!workflowCheckOrderByLayerId || !workflowCheckMetaByName || !workflowLayerByName || !selectedSegment) return null
    if (!startPkInput.trim() || !endPkInput.trim()) return null
    const startInput = Number(startPkInput)
    const endInput = Number(endPkInput)
    if (!Number.isFinite(startInput) || !Number.isFinite(endInput)) return null
    const [targetStart, targetEnd] = normalizeRange(startInput, endInput)
    const map = new Map<string, Set<string>>()

    const markLayerCompleted = (layerId: string) => {
      const checks = workflowCheckOrderByLayerId.get(layerId)
      if (!checks || !checks.length) return
      const set = map.get(layerId) ?? new Set<string>()
      checks.forEach((name) => set.add(normalizeLabel(name)))
      map.set(layerId, set)
    }

    latestPointInspectionsRef.current.forEach((latest) => {
      if (latest.phaseId !== selectedSegment.phaseId) return
      const sideMatches =
        selectedSide === 'BOTH'
          ? true
          : latest.side === 'BOTH' || latest.side === selectedSide
      if (!sideMatches) return
      if (!workflowSatisfiedStatuses.includes(latest.status ?? 'PENDING')) return
      const [existingStart, existingEnd] = normalizeRange(latest.startPk, latest.endPk)
      if (existingStart > targetStart || existingEnd < targetEnd) return

      // Mark completed layers -> all checks in该层视为完成
      latest.layers.forEach((layerName) => {
        splitLayerTokens(layerName).forEach((token) => {
          const normalizedLayerName = normalizeLabel(
            localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
          )
          const meta = workflowLayerByName.get(normalizedLayerName)
          if (meta) markLayerCompleted(meta.id)
        })
      })

      // Mark explicit completed checks (若后端返回)
      latest.checks?.forEach((checkName) => {
        const meta = workflowCheckMetaByName.get(normalizeLabel(checkName))
        if (!meta) return
        const set = map.get(meta.layerId) ?? new Set<string>()
        set.add(normalizeLabel(checkName))
        set.add(normalizeLabel(localizeProgressTerm('check', checkName, locale)))
        map.set(meta.layerId, set)
      })
    })
    // 兜底：同分项任意区间的完成记录也视为满足（防止区间匹配误差）
    if (!map.size) {
      latestPointInspectionsRef.current.forEach((latest) => {
        if (latest.phaseId !== selectedSegment.phaseId) return
        if (!workflowSatisfiedStatuses.includes(latest.status ?? 'PENDING')) return
        latest.layers.forEach((layerName) => {
          splitLayerTokens(layerName).forEach((token) => {
            const normalizedLayerName = normalizeLabel(
              localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
            )
            const meta = workflowLayerByName.get(normalizedLayerName)
            if (meta) markLayerCompleted(meta.id)
          })
        })
        latest.checks?.forEach((checkName) => {
          const meta = workflowCheckMetaByName.get(normalizeLabel(checkName))
          if (!meta) return
          const set = map.get(meta.layerId) ?? new Set<string>()
          set.add(normalizeLabel(checkName))
          set.add(normalizeLabel(localizeProgressTerm('check', checkName, locale)))
          map.set(meta.layerId, set)
        })
      })
    }
    return map
  }

  const allowedCheckSet = useMemo(() => {
    if (!workflowChecksByLayerName) return null
    const aggregated = new Set<string>()
    selectedLayers.forEach((layer) => {
      const checks = workflowChecksByLayerName.get(normalizeLabel(layer))
      checks?.forEach((check) => aggregated.add(check))
    })
    return aggregated
  }, [selectedLayers, workflowChecksByLayerName])

  const activeInspectionTypes = useMemo(() => {
    const base =
      selectedSegment?.workflowTypeOptions && selectedSegment.workflowTypeOptions.length
        ? selectedSegment.workflowTypeOptions
        : defaultInspectionTypes
    const baseSet = new Set(base)
    if (!workflowTypesByLayerName || !selectedLayers.length) return base
    const scoped = new Set<string>()
    selectedLayers.forEach((layer) => {
      const types = workflowTypesByLayerName.get(normalizeLabel(layer))
      types?.forEach((type) => {
        if (baseSet.has(type)) {
          scoped.add(type)
        }
      })
    })
    if (!scoped.size) return base
    return base.filter((type) => scoped.has(type))
  }, [defaultInspectionTypes, selectedLayers, selectedSegment?.workflowTypeOptions, workflowTypesByLayerName])

  const computeCompletedWorkflowLayerIds = () => {
    if (!workflowLayerByName || !selectedSegment) return null
    if (!startPkInput.trim() || !endPkInput.trim()) return null
    const startInput = Number(startPkInput)
    const endInput = Number(endPkInput)
    if (!Number.isFinite(startInput) || !Number.isFinite(endInput)) return null
    const [targetStart, targetEnd] = normalizeRange(startInput, endInput)
    const set = new Set<string>()
    latestPointInspectionsRef.current.forEach((latest) => {
      if (latest.phaseId !== selectedSegment.phaseId) return
      const sideMatches =
        selectedSide === 'BOTH'
          ? true // 任意侧别的既往报检都可视为满足
          : latest.side === 'BOTH' || latest.side === selectedSide
      if (!sideMatches) return
      if (!workflowSatisfiedStatuses.includes(latest.status ?? 'PENDING')) return
      const [existingStart, existingEnd] = normalizeRange(latest.startPk, latest.endPk)
      if (existingStart > targetStart || existingEnd < targetEnd) return
      latest.layers.forEach((layerName) => {
        splitLayerTokens(layerName).forEach((token) => {
          const normalizedLayerName = normalizeLabel(
            localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
          )
          const meta = workflowLayerByName.get(normalizedLayerName)
          if (meta) set.add(meta.id)
        })
      })
    })
    // 兜底：同分项任意区间的完成记录也视为满足（防止区间匹配误差）
    if (!set.size) {
      latestPointInspectionsRef.current.forEach((latest) => {
        if (latest.phaseId !== selectedSegment.phaseId) return
        if (!workflowSatisfiedStatuses.includes(latest.status ?? 'PENDING')) return
        latest.layers.forEach((layerName) => {
          splitLayerTokens(layerName).forEach((token) => {
            const normalizedLayerName = normalizeLabel(
              localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
            )
            const meta = workflowLayerByName.get(normalizedLayerName)
            if (meta) set.add(meta.id)
          })
        })
      })
    }
    return set.size ? set : null
  }

  const allowedWorkflowStages = useMemo(() => {
    if (!workflowLayerByName || !selectedLayers.length) return null
    let minStage = Infinity
    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName.get(normalizeLabel(layer))
      if (meta && Number.isFinite(meta.stage)) {
        minStage = Math.min(minStage, meta.stage)
      }
    })
    if (!Number.isFinite(minStage)) return null
    return new Set<number>([minStage, minStage + 1])
  }, [selectedLayers, workflowLayerByName])

  const isLayerDisabled = (layerName: string) => {
    if (!workflowLayerByName) return false
    const meta = workflowLayerByName.get(normalizeLabel(layerName))
    if (!meta) return false
    if (!allowedWorkflowStages || allowedWorkflowStages.has(meta.stage)) return false
    if (!selectedLayers.length) return false
    const targetId = meta.id
    for (const selected of selectedLayers) {
      const selectedMeta = workflowLayerByName.get(normalizeLabel(selected))
      if (!selectedMeta) continue
      if (
        selectedMeta.parallelWith?.includes(targetId) ||
        meta.parallelWith?.includes(selectedMeta.id) ||
        selectedMeta.lockStepWith?.includes(targetId) ||
        meta.lockStepWith?.includes(selectedMeta.id)
      ) {
        return false
      }
    }
    return true
  }

  const uniqueLayerOptions = useMemo(
    () => Array.from(new Set(selectedSegment?.layers ?? [])),
    [selectedSegment?.layers],
  )

  const uniqueCheckOptions = useMemo(() => Array.from(new Set(selectedSegment?.checks ?? [])), [selectedSegment?.checks])

  const findLayerOptionLabel = (layerName: string) => {
    const normalized = normalizeLabel(layerName)
    return uniqueLayerOptions.find((item) => normalizeLabel(item) === normalized) ?? layerName
  }

  const findCheckOptionLabel = (checkName: string) => {
    const normalized = normalizeLabel(checkName)
    return uniqueCheckOptions.find((item) => normalizeLabel(item) === normalized) ?? checkName
  }

  const toggleLayerSelection = (layerName: string) => {
    if (isLayerDisabled(layerName)) return
    const normalized = normalizeLabel(layerName)
    const meta = workflowLayerByName?.get(normalized)
    const group = new Set<string>([findLayerOptionLabel(layerName)])
    if (meta?.lockStepWith?.length && workflowLayerById) {
      meta.lockStepWith.forEach((id) => {
        const targetName = workflowLayerNameMap?.get(id) ?? workflowLayerById.get(id)?.name
        if (targetName) {
          group.add(findLayerOptionLabel(targetName))
        }
      })
    }
    const allSelected = Array.from(group).every((name) => selectedLayers.includes(name))
    if (allSelected) {
      setSelectedLayers((prev) => prev.filter((item) => !group.has(item)))
    } else {
      setSelectedLayers((prev) => {
        const next = prev.filter((item) => !group.has(item))
        group.forEach((item) => {
          if (!next.includes(item)) next.push(item)
        })
        return next
      })
    }
  }

  useEffect(() => {
    if (selectedSegment) {
      setSelectedLayers([])
      setSelectedChecks(
        selectedSegment.checks.length === 1 ? [selectedSegment.checks[0]] : [],
      )
      setSelectedTypes([])
      setRemark('')
      setSubmitError(null)
      setSelectedSide(selectedSegment.side)
      setStartPkInput(String(selectedSegment.start ?? ''))
      setEndPkInput(String(selectedSegment.end ?? ''))
      setAppointmentDateInput(todayISODate())
      setManualCheckExclusions([])
    }
  }, [selectedSegment])

  useEffect(() => {
    if (!workflowChecksByLayerName) return
    if (!allowedCheckSet || !allowedCheckSet.size) {
      if (selectedChecks.length) {
        setSelectedChecks([])
      }
      if (manualCheckExclusions.length) {
        setManualCheckExclusions([])
      }
      return
    }
    const manualSet = new Set(manualCheckExclusions)
    const nextChecks = Array.from(allowedCheckSet).filter((item) => !manualSet.has(item))
    const cleanedManual = manualCheckExclusions.filter((item) => allowedCheckSet.has(item))
    if (cleanedManual.length !== manualCheckExclusions.length) {
      setManualCheckExclusions(cleanedManual)
    }
    const prevSet = new Set(selectedChecks)
    const changed =
      nextChecks.length !== selectedChecks.length ||
      nextChecks.some((item) => !prevSet.has(item))
    if (changed) {
      setSelectedChecks(nextChecks)
    }
  }, [allowedCheckSet, manualCheckExclusions, selectedChecks, selectedLayers, workflowChecksByLayerName])

  useEffect(() => {
    const allowed = activeInspectionTypes
    if (!allowed.length) return
    const allowedSet = new Set(allowed)
    const union = new Set<string>()
    selectedChecks.forEach((check) => {
      const types = workflowCheckTypesByName?.get(normalizeLabel(check))
      types?.forEach((type) => {
        if (allowedSet.has(type)) {
          union.add(type)
        }
      })
    })
    const next = union.size ? allowed.filter((type) => union.has(type)) : allowed
    const changed =
      next.length !== selectedTypes.length || next.some((type, idx) => type !== selectedTypes[idx])
    if (changed) {
      setSelectedTypes(next)
    }
  }, [activeInspectionTypes, selectedChecks, selectedTypes, workflowCheckTypesByName])

  const fetchLatestInspections = useCallback(
    async (options?: { phaseId?: number; signalCancelled?: () => boolean }) => {
      if (!canViewInspection) {
        latestPointInspectionsRef.current = new Map()
        setInspectionSlices([])
        setLatestPointInspections(new Map())
        return
      }
      const isCancelled = options?.signalCancelled ?? (() => false)
      const search = new URLSearchParams({
        roadSlug: road.slug,
        sortField: 'updatedAt',
        sortOrder: 'desc',
        pageSize: '500',
      })
      if (options?.phaseId) {
        search.set('phaseId', String(options.phaseId))
      }
      const url = `/api/progress/${road.slug}/inspections?${search.toString()}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          if (!isCancelled()) {
            latestPointInspectionsRef.current = new Map()
            setInspectionSlices([])
            setLatestPointInspections(new Map())
          }
          return
        }
        const data = (await res.json()) as {
          items?: Array<{
            phaseId: number
            startPk: number
            endPk: number
            side: IntervalSide
            status: InspectionStatus
            layers: string[]
            checks?: string[]
            updatedAt: string
          }>
        }
        if (!data.items || isCancelled()) return
        const map = new Map<string, LatestPointInspection>()
        const slices: InspectionSlice[] = []
        data.items.forEach((item) => {
          const ts = new Date(item.updatedAt).getTime()
          const start = Number(item.startPk)
          const end = Number(item.endPk)
          const safeStart = Number.isFinite(start) ? start : 0
          const safeEnd = Number.isFinite(end) ? end : safeStart
          const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
          const side = item.side ?? 'BOTH'
          const key = buildPointKey(item.phaseId, side, orderedStart, orderedEnd)
          const existing = map.get(key)
          const snapshot: LatestPointInspection = {
            phaseId: Number(item.phaseId),
            side,
            startPk: orderedStart,
            endPk: orderedEnd,
            layers: item.layers || [],
            checks: item.checks || [],
            updatedAt: ts || 0,
            status: item.status ?? 'PENDING',
          }
          if (!existing) {
            map.set(key, snapshot)
          } else {
            const mergedLayers = Array.from(new Set([...(existing.layers || []), ...(snapshot.layers || [])]))
            const mergedChecks = Array.from(new Set([...(existing.checks || []), ...(snapshot.checks || [])]))
            const merged: LatestPointInspection = {
              ...snapshot,
              layers: mergedLayers,
              checks: mergedChecks,
              updatedAt: Math.max(existing.updatedAt ?? 0, snapshot.updatedAt ?? 0),
              status: existing.updatedAt >= snapshot.updatedAt ? existing.status : snapshot.status,
            }
            map.set(key, merged)
          }
          slices.push({
            phaseId: Number(item.phaseId),
            side: item.side ?? 'BOTH',
            startPk: orderedStart,
            endPk: orderedEnd,
            status: item.status ?? 'PENDING',
            updatedAt: ts || 0,
          })
        })
        if (!isCancelled()) {
          latestPointInspectionsRef.current = map
          setLatestPointInspections(map)
          setInspectionSlices(slices)
        }
      } catch (err) {
        if (!isCancelled()) {
          latestPointInspectionsRef.current = new Map()
          setInspectionSlices([])
          setLatestPointInspections(new Map())
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(t.alerts.fetchInspectionFailed, err)
        }
      }
    },
    [canViewInspection, road.slug, t.alerts.fetchInspectionFailed],
  )

  useEffect(() => {
    const controller = { cancelled: false }
    fetchLatestInspections({ signalCancelled: () => controller.cancelled })
    return () => {
      controller.cancelled = true
    }
  }, [fetchLatestInspections])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3200)
    return () => clearTimeout(timer)
  }, [successMessage])

  return (
    <div className="space-y-8">
      <AlertDialog
        open={Boolean(alertDialog)}
        title={alertDialog?.title ?? ''}
        description={alertDialog?.description}
        tone={alertDialog?.tone ?? 'info'}
        actionLabel={alertDialog?.actionLabel ?? t.inspection.dialogClose}
        cancelLabel={alertDialog?.cancelLabel}
        onAction={alertDialog?.onAction}
        onCancel={alertDialog?.onCancel}
        onClose={() => setAlertDialog(null)}
      />
      {successMessage ? (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-2xl border border-emerald-200/60 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xl shadow-emerald-400/30">
          {successMessage}
        </div>
      ) : null}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-50">{t.title}</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
              {formatProgressCopy(t.roadLengthLabel, {
                length: roadLength || t.roadLengthUnknown,
              })}
            </span>
          </div>
          {canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
              onClick={openCreateModal}
            >
              {t.addButton}
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-slate-200/80">
          {canManage ? t.manageTip : t.viewOnlyTip}
        </p>
      </section>

      {showFormModal && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-6 sm:items-center sm:py-10"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeFormModal()
            }
          }}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-emerald-500/20 backdrop-blur"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20 sm:right-4 sm:top-4"
              onClick={closeFormModal}
              aria-label={t.delete.close}
            >
              ×
            </button>
            <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                {editingId ? (
                  <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                    {formatProgressCopy(t.form.editingBadge, { id: editingId })}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                    {t.form.creatingBadge}
                  </span>
                )}
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={resetForm}
                >
                  {editingId ? t.form.resetEdit : t.form.resetNew}
                </button>
                <span className="text-xs text-slate-300">
                  {formatProgressCopy(t.form.designSummary, {
                    length: roadLength || t.roadLengthUnknown,
                    design:
                      measure === 'POINT'
                        ? formatProgressCopy(t.form.designHintPoint, { design: designLength })
                        : formatProgressCopy(t.form.designHintLinear, { design: designLength }),
                  })}
                </span>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-4">
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    {t.form.templateLabel}
                    <select
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                  value={definitionId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) return
                    const found = definitions.find((item) => item.id === Number(value))
                    if (found) {
                      setDefinitionId(found.id)
                      setName(found.name)
                      setMeasure(found.measure)
                      setPointHasSides(Boolean(found.pointHasSides))
                      if (found.measure !== 'POINT') {
                        setPointHasSides(false)
                      }
                    }
                  }}
                >
                  {definitions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.measure === 'POINT' ? t.form.measureOptionPoint : t.form.measureOptionLinear}
                    </option>
                  ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    {t.form.nameLabel}
                    <input
                      ref={nameInputRef}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.form.namePlaceholder}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    {t.form.measureLabel}
                    <select
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={measure}
                      onChange={(e) => {
                        const nextMeasure = e.target.value as PhaseMeasure
                        setMeasure(nextMeasure)
                        if (nextMeasure === 'LINEAR') {
                          setPointHasSides(false)
                        }
                      }}
                    >
                      <option value="LINEAR">{t.form.measureOptionLinear}</option>
                      <option value="POINT">{t.form.measureOptionPoint}</option>
                    </select>
                  </label>
                  <div className="flex flex-col justify-end text-sm text-slate-100">
                    <span className="text-xs text-slate-300">
                      {t.form.designHintPrefix}
                      {measure === 'POINT'
                        ? formatProgressCopy(t.form.designHintPoint, { design: designLength })
                        : formatProgressCopy(t.form.designHintLinear, { design: designLength })}
                    </span>
                    {measure === 'POINT' ? (
                      <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-300"
                          checked={pointHasSides}
                          onChange={(e) => setPointHasSides(e.target.checked)}
                        />
                        <span className="font-semibold">{t.form.pointSidesLabel}</span>
                        <span className="text-[11px] text-slate-400">{t.form.pointSidesHint}</span>
                      </label>
                    ) : null}
                  </div>
                </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-100">
                      <p>{t.form.intervalTitle}</p>
                      <button
                      type="button"
                      onClick={addInterval}
                      className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      {t.form.intervalAdd}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {intervals.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 md:grid-cols-6 md:items-center"
                      >
                        <label className="flex flex-col items-center gap-1 text-center">
                          {t.form.intervalStart}
                          <input
                            type="number"
                            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={Number.isFinite(item.startPk) ? item.startPk : ''}
                            onChange={(e) =>
                              updateInterval(index, {
                                startPk: e.target.value === '' ? Number.NaN : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="flex flex-col items-center gap-1 text-center">
                          {t.form.intervalEnd}
                          <input
                            type="number"
                            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={Number.isFinite(item.endPk) ? item.endPk : ''}
                            onChange={(e) =>
                              updateInterval(index, { endPk: e.target.value === '' ? Number.NaN : Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="flex flex-col items-center gap-1 text-center">
                          {t.form.intervalSide}
                          <select
                            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
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
                        <label className="flex flex-col items-center gap-1 text-center">
                          {t.form.intervalSpec}
                          <input
                            type="text"
                            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={item.spec ?? ''}
                            onChange={(e) => updateInterval(index, { spec: e.target.value })}
                            placeholder={t.form.intervalSpec}
                          />
                        </label>
                        <label className="flex flex-col items-center gap-1 text-center">
                          {t.form.intervalBillQuantity}
                          <input
                            type="number"
                            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={
                              Number.isFinite(item.billQuantity ?? Number.NaN) ? item.billQuantity ?? '' : ''
                            }
                            onChange={(e) =>
                              updateInterval(index, {
                                billQuantity: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div className="flex items-center justify-center">
                          {intervals.length > 1 ? (
                            <button
                              type="button"
                              className="rounded-xl border border-rose-200/60 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
                              onClick={() => removeInterval(index)}
                            >
                              {t.form.intervalDelete}
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
                    {t.form.save}
                  </button>
                  {error ? <span className="text-sm text-amber-200">{error}</span> : null}
                  {isPending ? <span className="text-xs text-slate-200/70">{t.form.saving}</span> : null}
                </div>
                <p className="text-xs text-slate-300">
                  {t.note.measure}
                </p>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              resetDeleteState()
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-50">{t.delete.title}</p>
                <p className="text-sm font-semibold text-slate-100">
                  {formatProgressCopy(t.delete.confirmPrompt, { name: deleteTarget.name })}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                onClick={() => {
                  if (deletingId) return
                  resetDeleteState()
                }}
                aria-label={t.delete.close}
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              <p>{t.delete.impactTitle}</p>
              <ul className="space-y-1">
                {t.delete.impactList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {deleteError ? <p className="mt-3 text-sm text-amber-200">{deleteError}</p> : null}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  if (deletingId) return
                  resetDeleteState()
                }}
                disabled={Boolean(deletingId)}
              >
                {t.delete.cancel}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-red-300/80 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-100 shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-red-500/20 hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={confirmDelete}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? t.delete.confirming : t.delete.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          {t.list.legend}
          <span className="h-px w-12 bg-white/30" />
          {t.list.legendNote}
        </div>

        {phases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            {t.list.empty}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedPhases.map((phase) => {
              const linear = phase.measure === 'LINEAR' ? linearViews.find((item) => item.phase.id === phase.id) : null
              const point = phase.measure === 'POINT' ? pointViews.find((item) => item.phase.id === phase.id) : null
              const pointRangeLabel = point ? `${formatPK(point.view.min)} – ${formatPK(point.view.max)}` : ''
              const localizedPhaseName = localizeProgressTerm('phase', phase.name, locale)

              return (
                <div
                  key={phase.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-50">{localizedPhaseName}</h3>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
                        {phase.measure === 'POINT'
                          ? formatProgressCopy(t.card.measurePoint, { value: phase.designLength })
                          : formatProgressCopy(t.card.measureLinear, { value: phase.designLength })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.measure === 'LINEAR' && linear ? (
                        <span className="text-sm font-semibold text-emerald-200">
                          {formatProgressCopy(t.card.completed, {
                            percent: calcCombinedPercent(linear.view.left.segments, linear.view.right.segments),
                          })}
                        </span>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                            onClick={() => startEdit(phase)}
                          >
                            {t.card.edit}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-200/60 px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200 hover:bg-rose-200/10"
                            onClick={() => handleDelete(phase)}
                            disabled={deletingId === phase.id}
                          >
                            {deletingId === phase.id ? t.card.deleting : t.card.delete}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                    {phase.measure === 'LINEAR' && linear ? (
                      <div className="mt-4 space-y-4">
                        {[linear.view.left, linear.view.right]
                          .filter((side) => side.designTotal > 0)
                          .map((side) => (
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
                                  {side.segments
                                    .filter((seg) => seg.status !== 'nonDesign')
                                    .map((seg, idx) => {
                                      const base = Math.max(side.designTotal, 1)
                                      const width = (Math.max(0, seg.end - seg.start) / base) * 100
                                      return (
                                        <button
                                          key={`${seg.start}-${seg.end}-${idx}`}
                                          type="button"
                                          className={`${statusTone[seg.status]} group flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                                          style={{ width: `${width}%` }}
                                          title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${statusLabel(seg.status)}`}
                                          onClick={() => {
                                            if (seg.status === 'pending') {
                                              if (!canInspect) {
                                                alert(t.alerts.noInspectPermission)
                                                return
                                              }
                                              const sideLabel = side.label
                                              const sideValue = sideLabel === sideLabelMap.LEFT ? 'LEFT' : 'RIGHT'
                                              openInspectionModal(phase, {
                                                phase: phase.name,
                                                phaseId: phase.id,
                                                measure: phase.measure,
                                                layers: phase.resolvedLayers,
                                                checks: phase.resolvedChecks,
                                                side: sideValue,
                                                sideLabel,
                                                start: seg.start,
                                                end: seg.end,
                                                spec: seg.spec ?? null,
                                                billQuantity: seg.billQuantity ?? null,
                                              })
                                            }
                                          }}
                                        >
                                          <span className="px-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
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
                      {phase.pointHasSides ? (
                        <div className="space-y-3">
                          {[
                            { side: 'LEFT' as const, label: sideLabelMap.LEFT },
                            { side: 'RIGHT' as const, label: sideLabelMap.RIGHT },
                          ].map((row) => {
                            const rowPoints = point.view.points.filter(
                              (p) => p.side === row.side || p.side === 'BOTH',
                            )
                            return (
                              <PointLane
                                key={row.side}
                                phase={phase}
                                points={rowPoints}
                                label={row.label}
                                showHeader
                                rangeLabel={pointRangeLabel}
                                containerClassName="relative h-24 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40"
                                sideLabelMap={sideLabelMap}
                                resolvePointBadge={resolvePointBadge}
                                onPointSelect={handlePointSelect}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <PointLane
                          phase={phase}
                          points={point.view.points}
                          rangeLabel={pointRangeLabel}
                          containerClassName="relative mt-2 h-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40"
                          sideLabelMap={sideLabelMap}
                          resolvePointBadge={resolvePointBadge}
                          onPointSelect={handlePointSelect}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedSegment ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur sm:items-center sm:py-10">
          <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-slate-900/70 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400" />
              <div className="relative flex flex-wrap items-center gap-3 px-6 pt-5 pr-12 sm:pr-16">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                  <span className="inline-flex items-center rounded-full bg-emerald-300/15 px-3 py-1.5 text-base font-semibold uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-emerald-300/40">
                    {t.inspection.title}
                  </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {displayPhaseName(selectedSegment.phase)}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {selectedSegment.sideLabel}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {formatPK(selectedSegment.start)} → {formatPK(selectedSegment.end)}
                </span>
                {selectedSegment.spec ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                    {t.form.intervalSpec}：{selectedSegment.spec}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/20"
                onClick={() => setSelectedSegment(null)}
                aria-label={t.delete.close}
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <div className="grid gap-4 border-t border-white/5 bg-white/2 px-6 py-6 text-sm text-slate-100 lg:grid-cols-5">
                <div className="lg:col-span-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-200">
                      <span className="font-semibold">{t.inspection.sideLabel}</span>
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        value={selectedSide}
                        onChange={(e) => setSelectedSide(e.target.value as IntervalSide)}
                      >
                        <option value="LEFT">{t.inspection.sideLeft}</option>
                        <option value="RIGHT">{t.inspection.sideRight}</option>
                        <option value="BOTH">{t.inspection.sideBoth}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-200">
                      <span className="font-semibold">{t.inspection.startLabel}</span>
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                      value={startPkInput}
                      onChange={(e) => setStartPkInput(e.target.value)}
                      placeholder={t.inspection.startPlaceholder}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-200">
                    <span className="font-semibold">{t.inspection.endLabel}</span>
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                      value={endPkInput}
                      onChange={(e) => setEndPkInput(e.target.value)}
                      placeholder={t.inspection.endPlaceholder}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-200">
                    <span className="font-semibold">{t.inspection.appointmentLabel}</span>
                    <input
                      type="date"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                      value={appointmentDateInput}
                      onChange={(e) => setAppointmentDateInput(e.target.value)}
                      placeholder={t.inspection.appointmentPlaceholder}
                    />
                  </label>
                  </div>

                  {selectedSegment.workflow && selectedSegment.workflowLayers?.length ? (
                    <div className="space-y-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/5 p-4 shadow-inner shadow-emerald-400/20">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                        <span className="rounded-full bg-emerald-300/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50">
                          {workflowCopy.badge}
                        </span>
                        <span className="font-semibold text-emerald-50">
                          {localizedWorkflowPhaseName ?? selectedSegment.workflow.phaseName}
                        </span>
                        <span className="text-emerald-100/80">{workflowCopy.ruleTitle}</span>
                        {localizedWorkflowSideRule ? (
                          <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] text-emerald-50">
                            {localizedWorkflowSideRule}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedSegment.workflowLayers.map((layer) => {
                          const dependsNames = (layer.dependencies ?? []).map(
                            (id) => workflowLayerNameMap?.get(id) ?? id,
                          )
                          const lockNames = (layer.lockStepWith ?? []).map((id) => workflowLayerNameMap?.get(id) ?? id)
                          const parallelNames = (layer.parallelWith ?? []).map(
                            (id) => workflowLayerNameMap?.get(id) ?? id,
                          )
                          const localizedLayerName = localizeProgressTerm('layer', layer.name, locale, {
                            phaseName: workflowPhaseNameForContext,
                          })
                          const checkSummary = layer.checks
                            .map((check) => {
                              const checkName = localizeProgressTerm('check', check.name, locale)
                              const typeText = localizeProgressList('type', check.types, locale).join(' / ')
                              return `${checkName} (${typeText})`
                            })
                            .join('; ')
                          const localizedDescription = layer.description
                            ? localizeProgressText(layer.description, locale)
                            : null
                          return (
                            <div
                              key={layer.id}
                              className="rounded-2xl border border-emerald-200/30 bg-white/5 p-3 text-[11px] text-emerald-50 shadow-inner shadow-emerald-500/10"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{localizedLayerName}</span>
                                <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">
                                  {formatProgressCopy(workflowCopy.stageName, { value: layer.stage })}
                                </span>
                              </div>
                              <p className="mt-1 text-emerald-100/80">
                                {dependsNames.length
                                  ? formatProgressCopy(workflowCopy.timelineDepends, {
                                      deps: dependsNames.join(listJoiner),
                                    })
                                  : workflowCopy.timelineFree}
                              </p>
                              {lockNames.length ? (
                                <p className="text-emerald-100/80">
                                  {formatProgressCopy(workflowCopy.lockedWith, {
                                    peers: lockNames.join(listJoiner),
                                  })}
                                </p>
                              ) : null}
                              {parallelNames.length ? (
                                <p className="text-emerald-100/80">
                                  {formatProgressCopy(workflowCopy.parallelWith, {
                                    peers: parallelNames.join(listJoiner),
                                  })}
                                </p>
                              ) : null}
                              {localizedDescription ? (
                                <p className="text-emerald-100/80">{localizedDescription}</p>
                              ) : null}
                              {checkSummary ? (
                                <p className="mt-1 text-emerald-50">{checkSummary}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.layersLabel}</p>
                    {uniqueLayerOptions.length === 0 ? (
                      <p className="text-[11px] text-amber-200">{t.inspection.layersEmpty}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {uniqueLayerOptions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedLayers.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : isLayerDisabled(item)
                                  ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                  : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => {
                              toggleLayerSelection(item)
                            }}
                          >
                            {displayLayerName(item)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.checksLabel}</p>
                    {uniqueCheckOptions.length === 0 ? (
                      <p className="text-[11px] text-amber-200">{t.inspection.checksEmpty}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {uniqueCheckOptions.map((item) => (
                          // 非工作流限定的验收内容置灰不可选
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedChecks.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : allowedCheckSet && !allowedCheckSet.has(item)
                                  ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                  : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => {
                              if (allowedCheckSet && !allowedCheckSet.has(item)) return
                              toggleCheck(item)
                            }}
                          >
                            {displayCheckName(item)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.typesLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {activeInspectionTypes.map((item) => (
                        <button
                          key={item}
                          type="button"
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                          selectedTypes.includes(item)
                            ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                            : 'bg-white/10 text-slate-100 hover:bg-white/15'
                        }`}
                        onClick={() => toggleToken(item, selectedTypes, setSelectedTypes)}
                      >
                        {localizeProgressTerm('type', item, locale)}
                      </button>
                    ))}
                  </div>
                </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.remarkLabel}</p>
                    <textarea
                      className="h-20 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder={t.inspection.remarkPlaceholder}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-900/60 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className={`text-sm ${
                    submitError ? 'font-semibold text-amber-200' : 'text-slate-200'
                  }`}
                >
                  {submitError ? submitError : t.inspection.typesHint}
                </p>
                <div className="grid w-full gap-3 sm:w-auto sm:min-w-[320px] sm:grid-cols-2">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                    onClick={() => {
                      setSelectedSegment(null)
                      resetInspectionForm()
                    }}
                  >
                    {t.inspection.cancel}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitPending}
                    onClick={submitInspection}
                  >
                    {submitPending ? t.inspection.submitting : t.inspection.submit}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
