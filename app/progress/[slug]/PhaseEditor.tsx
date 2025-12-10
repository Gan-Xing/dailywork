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

import { PointProgressWave } from './PointProgressWave'
import { AlertDialog, type AlertTone } from '@/components/AlertDialog'
import { useToast } from '@/components/ToastProvider'
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

type Status = 'pending' | 'scheduled' | 'submitted' | 'inProgress' | 'approved' | 'nonDesign'

type InspectionSlice = {
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  status: InspectionStatus
  updatedAt: number
}

type LayerStatusByName = Record<string, { status: InspectionStatus; updatedAt: number }>

type LatestPointInspection = {
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  status: InspectionStatus
  layers: string[]
  checks?: string[]
  updatedAt: number
  layerStatus?: LayerStatusByName
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
  pointHasSides: boolean
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
  points: {
    startPk: number
    endPk: number
    side: IntervalSide
    spec?: string | null
    billQuantity?: number | null
    layers?: string[]
  }[]
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
  pointHasSides: boolean
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
  pending: 'bg-gradient-to-r from-white via-slate-100/70 to-white text-slate-900 shadow-sm shadow-slate-900/10',
  scheduled: 'bg-gradient-to-r from-sky-400 via-sky-300 to-sky-400 text-slate-900 shadow-md shadow-sky-500/30',
  submitted: 'bg-gradient-to-r from-fuchsia-400 via-purple-300 to-fuchsia-400 text-slate-900 shadow-md shadow-fuchsia-500/30',
  inProgress: 'bg-gradient-to-r from-amber-300 via-orange-200 to-amber-200 text-slate-900 shadow-md shadow-amber-400/30',
  approved: 'bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-200 text-slate-900 shadow-md shadow-emerald-400/30',
  nonDesign: 'bg-slate-800 text-slate-100 shadow-inner shadow-slate-900/30',
}

const workflowStatusTone: Record<InspectionStatus, string> = {
  PENDING: 'bg-slate-800 text-slate-100 ring-1 ring-white/10',
  SCHEDULED: 'bg-sky-900/60 text-sky-100 ring-1 ring-sky-300/40',
  SUBMITTED: 'bg-amber-700/40 text-amber-100 ring-1 ring-amber-200/40',
  IN_PROGRESS: 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-300/40',
  APPROVED: 'bg-emerald-400/20 text-emerald-950 ring-1 ring-emerald-300/50',
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
    layers: Array.isArray((interval as { layers?: string[] }).layers)
      ? ((interval as { layers?: string[] }).layers ?? []).filter(Boolean)
      : [],
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
    layers: Array.isArray((interval as { layers?: string[] }).layers)
      ? ((interval as { layers?: string[] }).layers ?? []).filter(Boolean)
      : [],
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
      result.push({ start: cursor, end: seg.start, status: 'nonDesign', pointHasSides: false })
    }
    result.push(seg)
    cursor = Math.max(cursor, seg.end)
  })
  if (cursor < end) {
    result.push({ start: cursor, end, status: 'nonDesign', pointHasSides: false })
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
  if (status === 'IN_PROGRESS') return 'inProgress'
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'SCHEDULED') return 'scheduled'
  return 'pending'
}

const workflowSatisfiedStatuses: InspectionStatus[] = ['SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED']
const isWorkflowSatisfied = (status?: InspectionStatus) =>
  (statusPriority[status ?? 'PENDING'] ?? 0) >= (statusPriority.SCHEDULED ?? 0)

const snapshotMatches =
  (phaseId: number, targetSide: IntervalSide, targetStart: number, targetEnd: number) =>
    (snapshot: LatestPointInspection) => {
      if (snapshot.phaseId !== phaseId) return false
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      const [targetStartOrdered, targetEndOrdered] = normalizeRange(targetStart, targetEnd)
      // 只要与目标区间有重叠即可视为覆盖，支持分段预约累计满足前置
      if (snapshotEnd < targetStartOrdered || snapshotStart > targetEndOrdered) return false
      if (targetSide === 'BOTH') {
        // BOTH 仅由 BOTH 快照满足；左右分别匹配在后续单侧汇总里处理
        return snapshot.side === 'BOTH'
      }
      return snapshot.side === 'BOTH' || snapshot.side === targetSide
    }

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
      pointHasSides: design.pointHasSides,
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
      pointHasSides: Boolean(phase.pointHasSides),
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
  resolvePointProgress: (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => {
    percent: number
    completedLayers: number
    totalLayers: number
  }
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
  resolvePointProgress,
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
      layers: item.layers && item.layers.length ? item.layers : phase.resolvedLayers,
      checks: phase.resolvedChecks,
      side: item.side,
      sideLabel,
      start: item.startPk,
      end: item.endPk,
      spec: item.spec ?? null,
      billQuantity: item.billQuantity ?? null,
      pointHasSides: phase.pointHasSides,
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
                const progress = resolvePointProgress(phase.id, item.side, item.startPk, item.endPk)
                return (
                  <button
                    key={`${item.startPk}-${item.endPk}-${idx}`}
                    type="button"
                    className="flex flex-col items-center gap-1 text-center transition hover:scale-105"
                    onClick={() => handlePointClick(item)}
                    title={`${rangeText} · ${sideLabelText}`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/80 p-1 shadow-lg shadow-emerald-400/25 ring-2 ring-white/20">
                      <PointProgressWave
                        percent={progress.percent}
                        size={52}
                        className="h-12 w-12"
                      />
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
  const inspectionStatusCopy = progressCopy.inspectionBoard.status as Record<InspectionStatus, string>
  const resolveWorkflowStatusLabel = (status?: InspectionStatus) =>
    status ? inspectionStatusCopy[status] ?? status : t.pointBadge.none
  const resolveWorkflowStatusTone = (status?: InspectionStatus) =>
    status ? workflowStatusTone[status] ?? workflowStatusTone.PENDING : workflowStatusTone.PENDING
  const sideStatusPriority = (status?: InspectionStatus) => statusPriority[status ?? 'PENDING'] ?? 0
  const statusLabel = (status: Status) => {
    switch (status) {
      case 'pending':
        return t.status.pending
      case 'scheduled':
        return t.status.scheduled ?? t.status.pending
      case 'submitted':
        return t.status.submitted ?? t.status.inProgress
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

  const [phases, setPhases] = useState<PhaseDTO[]>(() => initialPhases.map(normalizePhaseDTO))
  const [definitions, setDefinitions] = useState<PhaseDefinitionDTO[]>(phaseDefinitions)
  const [definitionId, setDefinitionId] = useState<number | null>(() => phaseDefinitions[0]?.id ?? null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const workflowMap = useMemo(() => {
    const map = new Map<number, WorkflowBinding>()
    workflows.forEach((item) => map.set(item.phaseDefinitionId, item))
    return map
  }, [workflows])
  const workflowLayersByPhaseId = useMemo(() => {
    const map = new Map<number, { layers: WorkflowLayerTemplate[]; phaseName: string }>()
    phases.forEach((phase) => {
      const binding = workflowMap.get(phase.definitionId)
      if (binding?.layers?.length) {
        map.set(phase.id, { layers: binding.layers, phaseName: binding.phaseName ?? phase.name })
      } else if (phase.resolvedLayers?.length) {
        const fallbackLayers: WorkflowLayerTemplate[] = phase.resolvedLayers.map((name, idx) => ({
          id: `${phase.id}-layer-${idx + 1}`,
          name,
          stage: idx + 1,
          dependencies: [],
          checks: [],
        }))
        map.set(phase.id, { layers: fallbackLayers, phaseName: phase.name })
      }
    })
    return map
  }, [phases, workflowMap])
  const [inspectionSlices, setInspectionSlices] = useState<InspectionSlice[]>([])
  const latestPointInspectionsRef = useRef<Map<string, LatestPointInspection>>(new Map())
  const [latestPointInspections, setLatestPointInspections] = useState<Map<string, LatestPointInspection>>(
    () => latestPointInspectionsRef.current,
  )
  const [name, setName] = useState(() => phaseDefinitions[0]?.name ?? '')
  const [measure, setMeasure] = useState<PhaseMeasure>(() => phaseDefinitions[0]?.measure ?? 'LINEAR')
  const [pointHasSides, setPointHasSides] = useState(() => Boolean(phaseDefinitions[0]?.pointHasSides))
  const currentPhaseForForm = useMemo(
    () => (editingId ? phases.find((item) => item.id === editingId) ?? null : null),
    [editingId, phases],
  )
  const workflowLayersForForm = useMemo(() => {
    if (currentPhaseForForm) {
      return workflowLayersByPhaseId.get(currentPhaseForForm.id)?.layers?.map((layer) => layer.name) ?? []
    }
    const defId = definitionId ?? null
    if (defId) {
      const binding = workflows.find((wf) => wf.phaseDefinitionId === defId)
      if (binding?.layers?.length) {
        return binding.layers.map((layer) => layer.name)
      }
    }
    return []
  }, [currentPhaseForForm, definitionId, workflowLayersByPhaseId, workflows])

  const defaultLayers = useMemo(() => {
    const def = definitions.find((item) => item.id === definitionId) ?? definitions[0]
    const definitionLayers = def?.defaultLayers ?? []
    if (definitionLayers.length) return definitionLayers
    if (currentPhaseForForm?.resolvedLayers?.length) return currentPhaseForForm.resolvedLayers
    if (workflowLayersForForm.length) return workflowLayersForForm
    return []
  }, [currentPhaseForForm?.resolvedLayers, definitionId, definitions, workflowLayersForForm])
  const defaultInterval = useMemo<PhaseIntervalPayload>(
    () => ({ startPk: roadStart, endPk: roadEnd, side: 'BOTH', spec: '', layers: defaultLayers, billQuantity: null }),
    [defaultLayers, roadEnd, roadStart],
  )
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([defaultInterval])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PhaseDTO | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const { addToast } = useToast()

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

  const layerOptions = useMemo(() => {
    const set = new Set<string>(defaultLayers)
    workflowLayersForForm.forEach((layer) => set.add(layer))
    intervals.forEach((interval) => {
      interval.layers?.forEach((layer) => set.add(layer))
    })
    return Array.from(set)
  }, [defaultLayers, intervals, workflowLayersForForm])

  const toggleIntervalLayer = (index: number, layerName: string) => {
    setIntervals((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        const layers = Array.isArray(item.layers) ? [...item.layers] : []
        const exists = layers.some((layer) => normalizeLabel(layer) === normalizeLabel(layerName))
        const nextLayers = exists
          ? layers.filter((layer) => normalizeLabel(layer) !== normalizeLabel(layerName))
          : [...layers, layerName]
        return { ...item, layers: nextLayers }
      }),
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
        layers: Array.isArray(i.layers) ? i.layers : [],
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
          const layers =
            measure === 'POINT'
              ? Array.from(
                new Set(
                  (item.layers?.length
                    ? item.layers
                    : layerOptions.length
                      ? layerOptions
                      : defaultLayers
                  ).filter(Boolean),
                ),
              )
              : []
          return {
            startPk,
            endPk,
            side: item.side,
            spec: spec || undefined,
            layers,
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
      addToast(
        editingId
          ? formatProgressCopy(t.success.updated, { name: localizedName })
          : formatProgressCopy(t.success.created, { name: localizedName }),
        { tone: 'success' },
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

  const linearDependencyMap = useMemo(() => {
    const map = new Map<string, string>()
    map.set(normalizeLabel('土方'), normalizeLabel('垫层'))
    return map
  }, [])

  const linearParallelNames = useMemo(() => new Set([normalizeLabel('土方')]), [])

  const [linearSnapshotsByPhase, setLinearSnapshotsByPhase] = useState<
    Map<number, LatestPointInspection[]>
  >(new Map())

  const findPhaseByNormalizedName = useCallback(
    (target: string) =>
      phases.find(
        (item) =>
          normalizeLabel(item.name) === target || normalizeLabel(item.definitionName) === target,
      ) ?? null,
    [phases],
  )

  const resolveFinalLayer = useCallback(
    (phaseId: number) => {
      const layers = workflowLayersByPhaseId.get(phaseId)?.layers ?? []
      if (!layers.length) return null
      return layers.reduce((acc, layer) => (layer.stage > acc.stage ? layer : acc), layers[0])
    },
    [workflowLayersByPhaseId],
  )

  const resolveLinearInspectionSlices = useCallback(
    (phase: PhaseDTO): InspectionSlice[] => {
      if (phase.measure !== 'LINEAR') {
        return inspectionSlices.filter((insp) => insp.phaseId === phase.id)
      }
      const normalizedName = normalizeLabel(phase.name)
      const dependsOnName = linearDependencyMap.get(normalizedName)
      if (dependsOnName) {
        const dependencyPhase = findPhaseByNormalizedName(dependsOnName)
        if (!dependencyPhase) return []
        return inspectionSlices
          .filter(
            (slice) =>
              slice.phaseId === dependencyPhase.id &&
              (statusPriority[slice.status] ?? 0) >= (statusPriority.SCHEDULED ?? 0),
          )
          .map((slice) => ({
            ...slice,
            phaseId: phase.id,
            status: 'APPROVED' as InspectionStatus,
          }))
      }

      const workflowLayers = workflowLayersByPhaseId.get(phase.id)?.layers ?? []
      const hasMultipleLayers = workflowLayers.length > 1
      const allowParallel = linearParallelNames.has(normalizedName)
      if (hasMultipleLayers && !allowParallel) {
        const finalLayer = resolveFinalLayer(phase.id)
        if (!finalLayer) return []
        const phaseNameForContext = workflowLayersByPhaseId.get(phase.id)?.phaseName ?? phase.name
        const normalizedFinalNames = new Set(
          [finalLayer.name, localizeProgressTerm('layer', finalLayer.name, 'zh', { phaseName: phaseNameForContext }), localizeProgressTerm('layer', finalLayer.name, 'fr', { phaseName: phaseNameForContext })]
            .filter(Boolean)
            .map((item) => normalizeLabel(item as string)),
        )
        const matchesFinalLayer = (snapshot: LatestPointInspection) => {
          if (!snapshot.layers?.length) return false
          return snapshot.layers.some((layerName) => {
            const candidates = `${layerName}`
              .split(/[\\/，,;]/)
              .map((token) => token.trim())
              .filter(Boolean)
              .flatMap((token) => [
                token,
                localizeProgressTerm('layer', token, 'zh', { phaseName: phaseNameForContext }),
                localizeProgressTerm('layer', token, 'fr', { phaseName: phaseNameForContext }),
              ])
              .filter(Boolean)
              .map((token) => normalizeLabel(token))
            return candidates.some((token) => normalizedFinalNames.has(token))
          })
        }
        const snapshots = linearSnapshotsByPhase.get(phase.id) ?? []
        const finalSnapshots = snapshots.filter(
          (snapshot) =>
            matchesFinalLayer(snapshot) &&
            (statusPriority[snapshot.status] ?? 0) >= (statusPriority.SCHEDULED ?? 0),
        )
        if (!finalSnapshots.length) return []
        return finalSnapshots.map((snapshot) => ({
          phaseId: phase.id,
          side: snapshot.side,
          startPk: snapshot.startPk,
          endPk: snapshot.endPk,
          status: snapshot.status,
          updatedAt: snapshot.updatedAt,
        }))
      }

      return inspectionSlices.filter((insp) => insp.phaseId === phase.id)
    },
    [
      findPhaseByNormalizedName,
      inspectionSlices,
      linearSnapshotsByPhase,
      linearDependencyMap,
      linearParallelNames,
      resolveFinalLayer,
      workflowLayersByPhaseId,
    ],
  )

  const linearViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'LINEAR')
      .map((phase) => {
        const slices = resolveLinearInspectionSlices(phase)
        const isDependencyDriven = linearDependencyMap.has(normalizeLabel(phase.name))
        return {
          phase,
          isDependencyDriven,
          view: buildLinearView(
            phase,
            roadLength,
            { left: sideLabelMap.LEFT, right: sideLabelMap.RIGHT },
            slices,
          ),
        }
      })
  }, [
    linearDependencyMap,
    phases,
    resolveLinearInspectionSlices,
    roadLength,
    sideLabelMap.LEFT,
    sideLabelMap.RIGHT,
  ])

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
    let workflowLayers = workflowSelection?.sortedLayers
    let layers = workflowSelection?.layerNames.length ? workflowSelection.layerNames : segment.layers
    if (workflowSelection?.sortedLayers?.length && segment.layers.length) {
      const targetTokens = new Set(
        segment.layers.flatMap((name) => normalizeLayerTokens(name, phase.name)),
      )
      const filtered = workflowSelection.sortedLayers.filter((layer) =>
        normalizeLayerTokens(layer.name, phase.name).some((token) => targetTokens.has(token)),
      )
      if (filtered.length) {
        workflowLayers = filtered
        layers = filtered.map((layer) => layer.name)
      }
    }
    const checks = workflowSelection?.checkNames.length ? workflowSelection.checkNames : segment.checks
    const typeOptions = workflowSelection?.typeOptions ?? defaultInspectionTypes
    setSelectedSegment({
      ...segment,
      phase: localizeProgressTerm('phase', phase.name, locale),
      layers: localizeProgressList('layer', layers, locale, { phaseName: phase.name }),
      checks: localizeProgressList('check', checks, locale),
      workflow: workflowSelection?.binding,
      workflowLayers,
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

  const isLayerSelected = (name: string) =>
    selectedLayers.some((item) => normalizeLabel(item) === normalizeLabel(name))

  const isCheckSelected = (name: string) =>
    selectedChecks.some((item) => normalizeLabel(item) === normalizeLabel(name))

  const isStatusLocked = (status?: InspectionStatus) => {
    if (!status) return false
    return (statusPriority[status] ?? 0) >= (statusPriority.SCHEDULED ?? 0)
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

  const performSubmit = async (payload: InspectionSubmitPayload, options?: { skipReset?: boolean }) => {
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
      return false
    }
    addToast(t.inspection.submitSuccess, { tone: 'success' })
    await fetchLatestInspections()
    if (!options?.skipReset) {
      setSelectedSegment(null)
      resetInspectionForm()
    }
    return true
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
    const targetSide = enforcedSide ?? selectedSide
    const payloadBase: Omit<InspectionSubmitPayload, 'side' | 'layers' | 'checks'> = {
      phaseId: selectedSegment.phaseId,
      startPk,
      endPk,
      types: normalizedTypes,
      remark,
      appointmentDate: appointmentDateInput,
    }
    if (selectedSegment?.workflowLayers?.length && workflowLayerByName) {
      const matchesLeft = snapshotMatches(selectedSegment.phaseId, 'LEFT', startPk, endPk)
      const matchesRight = snapshotMatches(selectedSegment.phaseId, 'RIGHT', startPk, endPk)
      const matchesBoth = snapshotMatches(selectedSegment.phaseId, 'BOTH', startPk, endPk)

      const buildCoverage = (side: IntervalSide) => {
        const map = new Map<string, Array<{ start: number; end: number }>>()
        latestPointInspectionsRef.current.forEach((snapshot) => {
          const match =
            side === 'BOTH'
              ? matchesBoth(snapshot)
              : side === 'LEFT'
                ? matchesLeft(snapshot)
                : matchesRight(snapshot)
          if (!match) return
          const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
          const clippedStart = Math.max(snapshotStart, startPk)
          const clippedEnd = Math.min(snapshotEnd, endPk)
          if (clippedEnd < clippedStart) return
          snapshot.layers?.forEach((layerName) => {
            splitLayerTokens(layerName).forEach((token) => {
              const normalizedLayerName = normalizeLabel(
                localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
              )
              const meta = workflowLayerByName.get(normalizedLayerName)
              const statusForLayer = resolveSnapshotLayerStatus(snapshot, new Set([normalizedLayerName]))
              if (!isWorkflowSatisfied(statusForLayer)) return
              if (!meta) return
              const list = map.get(meta.id) ?? []
              list.push({ start: clippedStart, end: clippedEnd })
              map.set(meta.id, list)
            })
          })
        })
        return map
      }

      const mergeRanges = (ranges: Array<{ start: number; end: number }>) => {
        if (!ranges.length) return []
        const sorted = [...ranges].sort((a, b) => a.start - b.start)
        const merged: Array<{ start: number; end: number }> = []
        sorted.forEach((range) => {
          const last = merged[merged.length - 1]
          if (last && range.start <= last.end + 1e-6) {
            merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) }
          } else {
            merged.push({ ...range })
          }
        })
        return merged
      }

      const isCovered = (layerId: string, side: IntervalSide, coverage: Map<string, Array<{ start: number; end: number }>>) => {
        const ranges = coverage.get(layerId)
        if (!ranges || !ranges.length) return false
        const merged = mergeRanges(ranges)
        const targetStartOrdered = Math.min(startPk, endPk)
        const targetEndOrdered = Math.max(startPk, endPk)
        let cursor = targetStartOrdered
        for (const range of merged) {
          if (range.end < cursor - 1e-6) continue
          if (range.start > cursor + 1e-6) {
            return false
          }
          cursor = Math.max(cursor, range.end)
          if (cursor >= targetEndOrdered - 1e-6) {
            return true
          }
        }
        return cursor >= targetEndOrdered - 1e-6
      }

      const coverageLeft = buildCoverage('LEFT')
      const coverageRight = buildCoverage('RIGHT')
      const coverageBoth = buildCoverage('BOTH')

      const completedWorkflowChecksByLayer = computeCompletedWorkflowChecksByLayer()
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
          const coveredCurrent =
            targetSide === 'BOTH'
              ? isCovered(dep, 'LEFT', coverageLeft) && isCovered(dep, 'RIGHT', coverageRight)
              : targetSide === 'LEFT'
                ? isCovered(dep, 'LEFT', coverageLeft) || isCovered(dep, 'BOTH', coverageBoth)
                : isCovered(dep, 'RIGHT', coverageRight) || isCovered(dep, 'BOTH', coverageBoth)
          if (coveredCurrent || selectedLayerIds.has(dep)) return
          if (targetSide === 'BOTH') {
            const leftMissing = !isCovered(dep, 'LEFT', coverageLeft) && !isCovered(dep, 'BOTH', coverageBoth)
            const rightMissing = !isCovered(dep, 'RIGHT', coverageRight) && !isCovered(dep, 'BOTH', coverageBoth)
            const name = workflowLayerNameMap?.get(dep) ?? workflowLayerById?.get(dep)?.name ?? dep
            if (leftMissing && rightMissing) {
              missingDeps.add(`${t.inspection.sideBoth}：${name}`)
            } else if (leftMissing) {
              missingDeps.add(`${t.inspection.sideLeft}：${name}`)
            } else if (rightMissing) {
              missingDeps.add(`${t.inspection.sideRight}：${name}`)
            }
          } else {
            const name = workflowLayerNameMap?.get(dep) ?? workflowLayerById?.get(dep)?.name ?? dep
            missingDeps.add(name)
          }
        })
      })
      if (missingDeps.size) {
        const depsText = Array.from(missingDeps).join(' / ')
        raiseSubmitError(formatProgressCopy(t.inspection.missingDeps, { deps: depsText }))
        return
      }

      // 校验同层验收内容的顺序：需满足前置检查已完成或本次一同提交
      if (workflowCheckOrderByLayerId && workflowCheckMetaByName) {
        const selectedChecksNormalized = new Set(selectedChecks.map((item) => normalizeLabel(item)))
        const missingChecks = new Set<string>()
        const resolveCheckMeta = (check: string) => {
          const normalizedCheck = normalizeLabel(check)
          for (const layerName of selectedLayers) {
            const layerMeta = workflowLayerByName?.get(normalizeLabel(layerName))
            if (!layerMeta) continue
            const idx = layerMeta.checks.findIndex((item) => {
              const names = [
                item.name,
                localizeProgressTerm('check', item.name, locale),
                localizeProgressTerm('check', item.name, 'zh'),
                localizeProgressTerm('check', item.name, 'fr'),
              ]
              return names.some((name) => normalizeLabel(name) === normalizedCheck)
            })
            if (idx >= 0) {
              return { layerId: layerMeta.id, order: idx }
            }
          }
          return workflowCheckMetaByName.get(normalizedCheck) ?? null
        }
        selectedChecks.forEach((check) => {
          const meta = resolveCheckMeta(check)
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
    const splitLayerSideMap = new Map<string, IntervalSide>()
    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (!meta) return
      const target = shouldSplitLayerBySide(meta) ? resolveSplitTargetSide(meta) : null
      if (target) {
        splitLayerSideMap.set(meta.id, target)
      }
    })

    const singleLeft = { layers: [] as string[], checks: [] as string[] }
    const singleRight = { layers: [] as string[], checks: [] as string[] }
    const bothGroup = { layers: [] as string[], checks: [] as string[] }
    let hasMissingCheckMeta = false

    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta && splitLayerSideMap.has(meta.id)) {
        const target = splitLayerSideMap.get(meta.id)
        if (target === 'LEFT') singleLeft.layers.push(layer)
        else if (target === 'RIGHT') singleRight.layers.push(layer)
      } else {
        bothGroup.layers.push(layer)
      }
    })

    const layerGroupById = new Map<string, IntervalSide | 'BOTH'>()
    singleLeft.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'LEFT')
    })
    singleRight.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'RIGHT')
    })
    bothGroup.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'BOTH')
    })

    selectedChecks.forEach((check) => {
      const normalizedCheck = normalizeLabel(check)
      let meta = workflowCheckMetaByName?.get(normalizedCheck) ?? null
      let target: IntervalSide | 'BOTH' | undefined = meta
        ? splitLayerSideMap.get(meta.layerId) ?? layerGroupById.get(meta.layerId)
        : undefined
      let layerId = meta?.layerId ?? null

      if (!target || !layerId) {
        for (const layer of selectedLayers) {
          const checks = workflowChecksByLayerName?.get(normalizeLabel(layer))
          if (checks?.has(normalizedCheck)) {
            const layerMeta = workflowLayerByName?.get(normalizeLabel(layer))
            if (layerMeta) {
              meta = meta ?? { layerId: layerMeta.id, order: 0, types: new Set<string>() }
              layerId = layerMeta.id
              target = splitLayerSideMap.get(layerMeta.id) ?? layerGroupById.get(layerMeta.id)
              break
            }
          }
        }
      }

      if (!meta) {
        hasMissingCheckMeta = true
        bothGroup.checks.push(check)
        return
      }

      const finalTarget = target ?? targetSide
      if (finalTarget === 'LEFT') {
        singleLeft.checks.push(check)
      } else if (finalTarget === 'RIGHT') {
        singleRight.checks.push(check)
      } else {
        bothGroup.checks.push(check)
      }
    })

    // 如有无法识别的验收内容，避免误拆分，直接按当前侧别整体提交
    const payloads: InspectionSubmitPayload[] = []
    if (hasMissingCheckMeta) {
      payloads.push({
        ...payloadBase,
        side: targetSide,
        layers: selectedLayers,
        checks: selectedChecks,
      })
    } else {
      if (singleLeft.layers.length) {
        payloads.push({
          ...payloadBase,
          side: 'LEFT',
          layers: singleLeft.layers,
          checks: singleLeft.checks,
        })
      }
      if (singleRight.layers.length) {
        payloads.push({
          ...payloadBase,
          side: 'RIGHT',
          layers: singleRight.layers,
          checks: singleRight.checks,
        })
      }
      if (bothGroup.layers.length) {
        payloads.push({
          ...payloadBase,
          side: targetSide,
          layers: bothGroup.layers,
          checks: bothGroup.checks,
        })
      }
    }
    if (!payloads.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return
    }

    for (let idx = 0; idx < payloads.length; idx += 1) {
      const isLast = idx === payloads.length - 1
      const ok = await performSubmit(payloads[idx], { skipReset: !isLast })
      if (!ok) break
    }
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
  const enforcedSide = useMemo<IntervalSide | null>(
    () =>
      selectedSegment && selectedSegment.measure === 'POINT' && selectedSegment.pointHasSides
        ? selectedSegment.side
        : null,
    [selectedSegment],
  )
  const intervalRange = useMemo(() => {
    const start = Number(startPkInput || selectedSegment?.start || 0)
    const end = Number(endPkInput || selectedSegment?.end || 0)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    return normalizeRange(start, end)
  }, [endPkInput, selectedSegment?.end, selectedSegment?.start, startPkInput])

  const sideBooking = useMemo(() => {
    if (!selectedSegment || !intervalRange) {
      return { left: false, right: false, both: false, lockedSide: null as IntervalSide | null }
    }
    if (selectedSegment.measure === 'LINEAR') {
      return { left: false, right: false, both: false, lockedSide: null as IntervalSide | null }
    }
    const [rangeStart, rangeEnd] = intervalRange
    const matchLeft = snapshotMatches(selectedSegment.phaseId, 'LEFT', rangeStart, rangeEnd)
    const matchRight = snapshotMatches(selectedSegment.phaseId, 'RIGHT', rangeStart, rangeEnd)
    const matchBoth = snapshotMatches(selectedSegment.phaseId, 'BOTH', rangeStart, rangeEnd)
    let left = false
    let right = false
    let both = false
    latestPointInspections.forEach((snapshot) => {
      const statusLevel = sideStatusPriority(snapshot.status)
      if (statusLevel < sideStatusPriority('SCHEDULED')) return
      if (matchBoth(snapshot)) {
        both = true
      }
      if (matchLeft(snapshot)) {
        left = true
      }
      if (matchRight(snapshot)) {
        right = true
      }
    })
    let lockedSide: IntervalSide | null = null
    if (enforcedSide) {
      lockedSide = enforcedSide
    } else if (!both) {
      if (left && !right) lockedSide = 'RIGHT'
      if (right && !left) lockedSide = 'LEFT'
    }
    return { left, right, both, lockedSide }
  }, [enforcedSide, intervalRange, latestPointInspections, selectedSegment])

  useEffect(() => {
    if (!sideBooking.lockedSide) return
    if (selectedSide !== sideBooking.lockedSide) {
      setSelectedSide(sideBooking.lockedSide)
    }
  }, [selectedSide, sideBooking.lockedSide])
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

  const normalizeLayerTokens = useCallback(
    (value: string, phaseName: string) => {
      const tokens = splitLayerTokens(value)
      const candidates = tokens.flatMap((token) => [
        token,
        localizeProgressTerm('layer', token, 'zh', { phaseName }),
        localizeProgressTerm('layer', token, 'fr', { phaseName }),
      ])
      return candidates
        .filter(Boolean)
        .map((item) => normalizeLabel(item))
    },
    [],
  )

  const normalizeCheckTokens = useCallback((value: string) => {
    const candidates = [
      value,
      localizeProgressTerm('check', value, 'zh'),
      localizeProgressTerm('check', value, 'fr'),
    ]
    return candidates
      .filter(Boolean)
      .map((item) => normalizeLabel(item))
  }, [])

  const resolveSnapshotLayerStatus = useCallback(
    (snapshot: LatestPointInspection, normalizedLayerNames: Set<string>): InspectionStatus =>
      Array.from(normalizedLayerNames).reduce<InspectionStatus | null>((result, name) => {
        if (result) return result
        const entry = snapshot.layerStatus?.[name]
        return entry?.status ?? null
      }, null) ?? snapshot.status ?? 'PENDING',
    [],
  )

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

  const resolvePointSnapshots = useCallback(
    (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => {
      const [normalizedStart, normalizedEnd] = normalizeRange(startPk, endPk)
      const snapshots: LatestPointInspection[] = []
      const exact = latestPointInspections.get(
        buildPointKey(phaseId, side, normalizedStart, normalizedEnd),
      )
      if (exact) snapshots.push(exact)
      if (side !== 'BOTH') {
        const bothSide = latestPointInspections.get(
          buildPointKey(phaseId, 'BOTH', normalizedStart, normalizedEnd),
        )
        if (bothSide) snapshots.push(bothSide)
      }
      return snapshots
    },
    [latestPointInspections],
  )

  const findIntervalLayers = useCallback(
    (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => {
      const phase = phases.find((item) => item.id === phaseId)
      if (!phase) return null
      const match = phase.intervals.find(
        (interval) =>
          interval.startPk === startPk &&
          interval.endPk === endPk &&
          (interval.side === side || interval.side === 'BOTH'),
      )
      return Array.isArray(match?.layers) ? match?.layers ?? null : null
    },
    [phases],
  )

  const resolvePointProgress = useCallback(
    (phaseId: number, side: IntervalSide, startPk: number, endPk: number) => {
      const workflowLayers = workflowLayersByPhaseId.get(phaseId)
      const phaseNameFallback = phases.find((item) => item.id === phaseId)?.name ?? ''
      const phaseNameForContext = workflowLayers?.phaseName ?? phaseNameFallback
      const overrideLayers = findIntervalLayers(phaseId, side, startPk, endPk)
      const baseLayers = workflowLayers?.layers ?? []
      const layerMapByName = new Map<string, WorkflowLayerTemplate>()
      baseLayers.forEach((layer) => {
        normalizeLayerTokens(layer.name, phaseNameForContext).forEach((token) => {
          if (!layerMapByName.has(token)) {
            layerMapByName.set(token, layer)
          }
        })
      })
      const targetLayerNames =
        overrideLayers && overrideLayers.length ? overrideLayers : baseLayers.map((layer) => layer.name)
      const effectiveLayers =
        targetLayerNames.length > 0
          ? targetLayerNames.map((name, idx) => {
            const tokens = normalizeLayerTokens(name, phaseNameForContext)
            const matched = tokens.map((token) => layerMapByName.get(token)).find(Boolean)
            if (matched) return matched
            return {
              id: `custom-${phaseId}-${idx}-${normalizeLabel(name)}`,
              name,
              stage: idx + 1,
              dependencies: [],
              checks: [],
            } as WorkflowLayerTemplate
          })
          : baseLayers
      const totalLayers = effectiveLayers.length
      if (!totalLayers) {
        return { percent: 0, completedLayers: 0, totalLayers: 0 }
      }

      const snapshots = resolvePointSnapshots(phaseId, side, startPk, endPk)
      if (!snapshots.length) {
        return { percent: 0, completedLayers: 0, totalLayers }
      }
      let completedLayers = 0

      effectiveLayers.forEach((layer) => {
        const normalizedLayerNames = new Set(normalizeLayerTokens(layer.name, phaseNameForContext))
        if (!normalizedLayerNames.size) return
        const layerSnapshots = snapshots.filter((snapshot) => {
          const statusForLayer = resolveSnapshotLayerStatus(snapshot, normalizedLayerNames)
          if (statusForLayer !== 'APPROVED') return false
          return (snapshot.layers ?? []).some((layerName) => {
            const normalizedSnapshotLayer = normalizeLayerTokens(layerName, phaseNameForContext)
            return normalizedSnapshotLayer.some((token) => normalizedLayerNames.has(token))
          })
        })
        const requiredChecks = new Set(
          (layer.checks ?? []).flatMap((check) => normalizeCheckTokens(check.name)),
        )
        if (!layerSnapshots.length && !requiredChecks.size) return

        const completedChecks = new Set<string>()
        layerSnapshots.forEach((snapshot) => {
          snapshot.checks?.forEach((checkName) => {
            normalizeCheckTokens(checkName).forEach((token) => completedChecks.add(token))
          })
        })
        if (!requiredChecks.size && layerSnapshots.length) {
          completedLayers += 1
          return
        }
        const allChecksDone =
          requiredChecks.size > 0 &&
          Array.from(requiredChecks).every((token) => completedChecks.has(token))
        if (allChecksDone) {
          completedLayers += 1
        }
      })

      const percent = totalLayers > 0 ? (completedLayers / totalLayers) * 100 : 0
      return { percent, completedLayers, totalLayers }
    },
    [
      findIntervalLayers,
      normalizeCheckTokens,
      normalizeLayerTokens,
      phases,
      resolvePointSnapshots,
      resolveSnapshotLayerStatus,
      workflowLayersByPhaseId,
    ],
  )

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
    const map = new Map<string, Set<string>>()
    selectedSegment.workflowLayers.forEach((layer) => {
      const localizedName = localizeProgressTerm('layer', layer.name, locale, {
        phaseName: workflowPhaseNameForContext,
      })
      const localizedChecks = layer.checks.map((check) => localizeProgressTerm('check', check.name, locale))
      const mergedChecks = new Set<string>([
        ...layer.checks.map((check) => check.name),
        ...localizedChecks,
      ])
      const names = [layer.name, localizedName]
      names.forEach((name) => {
        map.set(normalizeLabel(name), mergedChecks)
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
        const baseNames = [
          check.name,
          localizedNames[idx],
          localizeProgressTerm('check', check.name, 'zh'),
          localizeProgressTerm('check', check.name, 'fr'),
        ]
        baseNames
          .filter(Boolean)
          .forEach((name) => map.set(normalizeLabel(name), meta))
      })
    })
    return map
  }, [locale, selectedSegment?.workflowLayers])

  const workflowStatusMaps = useMemo(() => {
    const layerStatus = new Map<string, InspectionStatus>()
    const checkStatus = new Map<string, InspectionStatus>()
    const layerStatusBySide = new Map<string, { LEFT?: InspectionStatus; RIGHT?: InspectionStatus }>()
    const checkStatusBySide = new Map<string, { LEFT?: InspectionStatus; RIGHT?: InspectionStatus }>()
    if (!selectedSegment?.workflowLayers?.length) {
      return { layerStatus, checkStatus, layerStatusBySide, checkStatusBySide }
    }
    const startValue = Number(startPkInput)
    const endValue = Number(endPkInput)
    const hasStartInput = startPkInput.trim() !== '' && Number.isFinite(startValue)
    const hasEndInput = endPkInput.trim() !== '' && Number.isFinite(endValue)
    const [targetStart, targetEnd] = hasStartInput && hasEndInput
      ? normalizeRange(startValue, endValue)
      : normalizeRange(selectedSegment.start ?? 0, selectedSegment.end ?? 0)
    const targetSide = selectedSide ?? selectedSegment.side ?? 'BOTH'

    const snapshotMatchesTarget = (snapshot: LatestPointInspection) => {
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      const sideMatches =
        targetSide === 'BOTH' ? snapshot.side === 'BOTH' : snapshot.side === 'BOTH' || snapshot.side === targetSide
      if (!sideMatches) return false
      // 严格要求 start/end 都落在目标区间内
      if (snapshotStart < targetStart || snapshotEnd > targetEnd) return false
      return true
    }

    const snapshotMatchesSide = (snapshot: LatestPointInspection, side: 'LEFT' | 'RIGHT') => {
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      if (snapshotStart < targetStart || snapshotEnd > targetEnd) return false
      if (side === 'LEFT') return snapshot.side === 'LEFT' || snapshot.side === 'BOTH'
      return snapshot.side === 'RIGHT' || snapshot.side === 'BOTH'
    }

    const pushLayerStatus = (key: string, status: InspectionStatus) => {
      const prev = layerStatus.get(key)
      if (!prev || (statusPriority[status] ?? 0) > (statusPriority[prev] ?? 0)) {
        layerStatus.set(key, status)
      }
    }

    const pushCheckStatus = (key: string, status: InspectionStatus) => {
      const prev = checkStatus.get(key)
      if (!prev || (statusPriority[status] ?? 0) > (statusPriority[prev] ?? 0)) {
        checkStatus.set(key, status)
      }
    }

    const pushLayerSideStatus = (key: string, side: 'LEFT' | 'RIGHT', status: InspectionStatus) => {
      const prev = layerStatusBySide.get(key) ?? {}
      const current = prev[side]
      if (!current || (statusPriority[status] ?? 0) > (statusPriority[current] ?? 0)) {
        layerStatusBySide.set(key, { ...prev, [side]: status })
      }
    }

    const pushCheckSideStatus = (key: string, side: 'LEFT' | 'RIGHT', status: InspectionStatus) => {
      const prev = checkStatusBySide.get(key) ?? {}
      const current = prev[side]
      if (!current || (statusPriority[status] ?? 0) > (statusPriority[current] ?? 0)) {
        checkStatusBySide.set(key, { ...prev, [side]: status })
      }
    }

    latestPointInspections.forEach((snapshot) => {
      if (snapshot.phaseId !== selectedSegment.phaseId) return
      const matchLeft = snapshotMatchesSide(snapshot, 'LEFT')
      const matchRight = snapshotMatchesSide(snapshot, 'RIGHT')
      const matchCurrentSide = snapshotMatchesTarget(snapshot)
      if (!matchLeft && !matchRight && !matchCurrentSide) return
      const baseStatus = snapshot.status ?? 'PENDING'
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      const snapshotLayerIds = new Set<string>()
      const snapshotLayerStatuses = new Map<string, InspectionStatus>()
      snapshot.layers?.forEach((layerName) => {
        splitLayerTokens(layerName).forEach((token) => {
          const normalizedLayerName = normalizeLabel(
            localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
          )
          const layerMeta = workflowLayerByName?.get(normalizedLayerName)
          const layerKey = layerMeta?.id ?? normalizedLayerName
          const statusForLayer = resolveSnapshotLayerStatus(snapshot, new Set([normalizedLayerName]))
          if (layerMeta?.id) {
            snapshotLayerStatuses.set(layerMeta.id, statusForLayer)
          }
          if (matchCurrentSide) {
            pushLayerStatus(layerKey, statusForLayer)
          }
          if (layerMeta?.id) {
            if (matchLeft) pushLayerSideStatus(layerMeta.id, 'LEFT', statusForLayer)
            if (matchRight) pushLayerSideStatus(layerMeta.id, 'RIGHT', statusForLayer)
          }
          if (layerMeta?.id) {
            snapshotLayerIds.add(layerMeta.id)
          }
        })
      })

      snapshot.checks?.forEach((checkName) => {
        const checkNames = [
          checkName,
          localizeProgressTerm('check', checkName, 'zh'),
          localizeProgressTerm('check', checkName, 'fr'),
        ]
        const normalizedCandidates = checkNames.map((name) => normalizeLabel(name))
        const meta = normalizedCandidates.map((key) => workflowCheckMetaByName?.get(key)).find(Boolean) ?? null
        const layerKey = meta?.layerId ?? ''
        const statusForCheck = layerKey
          ? snapshotLayerStatuses.get(layerKey) ?? baseStatus
          : baseStatus
        if (matchCurrentSide) {
          if (layerKey && snapshotLayerIds.size && !snapshotLayerIds.has(layerKey)) {
            return
          }
          normalizedCandidates.forEach((candidate) => {
            const checkKey = layerKey ? `${layerKey}|${candidate}` : candidate
            pushCheckStatus(checkKey, statusForCheck)
            if (layerKey) {
              if (matchLeft) pushCheckSideStatus(checkKey, 'LEFT', statusForCheck)
              if (matchRight) pushCheckSideStatus(checkKey, 'RIGHT', statusForCheck)
            }
          })
        } else if (layerKey) {
          // 仅当该检查对应的层也在快照里时，才记录侧别状态，避免跨层串色
          if (snapshotLayerIds.has(layerKey)) {
            normalizedCandidates.forEach((candidate) => {
              const checkKey = `${layerKey}|${candidate}`
              if (matchLeft) pushCheckSideStatus(checkKey, 'LEFT', statusForCheck)
              if (matchRight) pushCheckSideStatus(checkKey, 'RIGHT', statusForCheck)
            })
          }
        }
      })
    })

    return { layerStatus, checkStatus, layerStatusBySide, checkStatusBySide }
  }, [
    endPkInput,
    latestPointInspections,
    selectedSegment,
    selectedSide,
    startPkInput,
    resolveSnapshotLayerStatus,
    workflowCheckMetaByName,
    workflowLayerByName,
    workflowPhaseNameForContext,
  ])

  const computeCompletedWorkflowChecksByLayer = () => {
    if (!workflowCheckOrderByLayerId || !workflowCheckMetaByName || !workflowLayerByName || !selectedSegment) return null
    if (!startPkInput.trim() || !endPkInput.trim()) return null
    const startInput = Number(startPkInput)
    const endInput = Number(endPkInput)
    if (!Number.isFinite(startInput) || !Number.isFinite(endInput)) return null
    const [targetStart, targetEnd] = normalizeRange(startInput, endInput)

    const matchForSide = (side: IntervalSide) => snapshotMatches(selectedSegment.phaseId, side, targetStart, targetEnd)

    const leftMap = new Map<string, Set<string>>()
    const rightMap = new Map<string, Set<string>>()
    const bothMap = new Map<string, Set<string>>()

    const markLayerCompleted = (layerId: string) => {
      const checks = workflowCheckOrderByLayerId.get(layerId)
      if (!checks || !checks.length) return
      const set = bothMap.get(layerId) ?? new Set<string>()
      checks.forEach((name) => set.add(normalizeLabel(name)))
      bothMap.set(layerId, set)
    }

    const markLayerCompletedBySide = (layerId: string, side: IntervalSide) => {
      const checks = workflowCheckOrderByLayerId.get(layerId)
      if (!checks || !checks.length) return
      const map = side === 'LEFT' ? leftMap : rightMap
      const set = map.get(layerId) ?? new Set<string>()
      checks.forEach((name) => set.add(normalizeLabel(name)))
      map.set(layerId, set)
    }

    latestPointInspectionsRef.current.forEach((latest) => {
      if (latest.phaseId !== selectedSegment.phaseId) return
      const matchLeft = matchForSide('LEFT')(latest)
      const matchRight = matchForSide('RIGHT')(latest)
      const matchBoth = matchForSide('BOTH')(latest)
      if (!(matchLeft || matchRight || matchBoth)) return

      // Mark completed layers -> all checks in该层视为完成
      latest.layers.forEach((layerName) => {
        splitLayerTokens(layerName).forEach((token) => {
          const normalizedLayerName = normalizeLabel(
            localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
          )
          const meta = workflowLayerByName.get(normalizedLayerName)
          const statusForLayer = resolveSnapshotLayerStatus(latest, new Set([normalizedLayerName]))
          if (!isWorkflowSatisfied(statusForLayer)) return
          if (!meta) return
          if (matchBoth) {
            markLayerCompleted(meta.id)
          }
          if (matchLeft) {
            markLayerCompletedBySide(meta.id, 'LEFT')
          }
          if (matchRight) {
            markLayerCompletedBySide(meta.id, 'RIGHT')
          }
        })
      })

      // Mark explicit completed checks (若后端返回)
      latest.checks?.forEach((checkName) => {
        const meta = workflowCheckMetaByName.get(normalizeLabel(checkName))
        if (!meta) return
        const layerNameForStatus = workflowLayerById?.get(meta.layerId)?.name ?? ''
        const normalizedLayerName = layerNameForStatus
          ? normalizeLabel(
            localizeProgressTerm('layer', layerNameForStatus, 'zh', {
              phaseName: workflowPhaseNameForContext,
            }),
          )
          : null
        const statusForCheck =
          normalizedLayerName && normalizedLayerName.trim()
            ? resolveSnapshotLayerStatus(latest, new Set([normalizedLayerName]))
            : resolveSnapshotLayerStatus(latest, new Set())
        if (!isWorkflowSatisfied(statusForCheck)) return
        const normalized = normalizeLabel(checkName)
        const localized = normalizeLabel(localizeProgressTerm('check', checkName, locale))
        if (matchBoth) {
          const set = bothMap.get(meta.layerId) ?? new Set<string>()
          set.add(normalized)
          set.add(localized)
          bothMap.set(meta.layerId, set)
        }
        if (matchLeft) {
          const set = leftMap.get(meta.layerId) ?? new Set<string>()
          set.add(normalized)
          set.add(localized)
          leftMap.set(meta.layerId, set)
        }
        if (matchRight) {
          const set = rightMap.get(meta.layerId) ?? new Set<string>()
          set.add(normalized)
          set.add(localized)
          rightMap.set(meta.layerId, set)
        }
      })
    })
    if (selectedSide === 'BOTH') {
      const result = new Map<string, Set<string>>()
      const layerIds = new Set<string>([
        ...Array.from(leftMap.keys()),
        ...Array.from(rightMap.keys()),
        ...Array.from(bothMap.keys()),
      ])
      layerIds.forEach((id) => {
        const leftSet = leftMap.get(id)
        const rightSet = rightMap.get(id)
        const bothSet = bothMap.get(id)
        if (bothSet?.size) {
          result.set(id, new Set(bothSet))
          return
        }
        if (leftSet && rightSet) {
          const intersection = new Set<string>()
          leftSet.forEach((val) => {
            if (rightSet.has(val)) intersection.add(val)
          })
          if (intersection.size) {
            result.set(id, intersection)
          }
        }
      })
      return result
    }
    return selectedSide === 'LEFT' ? leftMap : rightMap
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
    const matchesSnapshot = snapshotMatches(selectedSegment.phaseId, selectedSide, targetStart, targetEnd)
    const matchesLeft = snapshotMatches(selectedSegment.phaseId, 'LEFT', targetStart, targetEnd)
    const matchesRight = snapshotMatches(selectedSegment.phaseId, 'RIGHT', targetStart, targetEnd)
    const set = new Set<string>()
    if (selectedSide === 'BOTH') {
      const leftSet = new Set<string>()
      const rightSet = new Set<string>()
      latestPointInspectionsRef.current.forEach((latest) => {
        if (matchesLeft(latest)) {
          latest.layers.forEach((layerName) => {
            splitLayerTokens(layerName).forEach((token) => {
              const normalizedLayerName = normalizeLabel(
                localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
              )
              const meta = workflowLayerByName.get(normalizedLayerName)
              const statusForLayer = resolveSnapshotLayerStatus(latest, new Set([normalizedLayerName]))
              if (!isWorkflowSatisfied(statusForLayer)) return
              if (meta) leftSet.add(meta.id)
            })
          })
        }
        if (matchesRight(latest)) {
          latest.layers.forEach((layerName) => {
            splitLayerTokens(layerName).forEach((token) => {
              const normalizedLayerName = normalizeLabel(
                localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
              )
              const meta = workflowLayerByName.get(normalizedLayerName)
              const statusForLayer = resolveSnapshotLayerStatus(latest, new Set([normalizedLayerName]))
              if (!isWorkflowSatisfied(statusForLayer)) return
              if (meta) rightSet.add(meta.id)
            })
          })
        }
      })
      leftSet.forEach((id) => {
        if (rightSet.has(id)) {
          set.add(id)
        }
      })
    } else {
      latestPointInspectionsRef.current.forEach((latest) => {
        if (!matchesSnapshot(latest)) return
        latest.layers.forEach((layerName) => {
          splitLayerTokens(layerName).forEach((token) => {
            const normalizedLayerName = normalizeLabel(
              localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
            )
            const meta = workflowLayerByName.get(normalizedLayerName)
            const statusForLayer = resolveSnapshotLayerStatus(latest, new Set([normalizedLayerName]))
            if (!isWorkflowSatisfied(statusForLayer)) return
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
    const targetId = meta.id
    const isCompatibleWith = (selectedMeta: WorkflowLayerTemplate) => {
      if (selectedMeta.id === targetId) return true
      const lockPair =
        selectedMeta.lockStepWith?.includes(targetId) || meta.lockStepWith?.includes(selectedMeta.id)
      const parallelPair =
        selectedMeta.parallelWith?.includes(targetId) || meta.parallelWith?.includes(selectedMeta.id)
      return lockPair || parallelPair
    }
    const hasSelection = selectedLayers.length > 0
    if (hasSelection && allowedWorkflowStages && !allowedWorkflowStages.has(meta.stage)) {
      const compatible = selectedLayers.some((selected) => {
        const selectedMeta = workflowLayerByName.get(normalizeLabel(selected))
        if (!selectedMeta) return false
        return isCompatibleWith(selectedMeta)
      })
      return !compatible
    }
    if (!hasSelection) return false
    for (const selected of selectedLayers) {
      const selectedMeta = workflowLayerByName.get(normalizeLabel(selected))
      if (!selectedMeta) continue
      if (!isCompatibleWith(selectedMeta)) {
        return true
      }
    }
    return false
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
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setAppointmentDateInput(tomorrow.toISOString().slice(0, 10))
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

  // 切换侧别时，避免沿用上一侧的已选层次/验收内容
  const prevSideRef = useRef<IntervalSide>(selectedSide)
  useEffect(() => {
    if (prevSideRef.current !== selectedSide) {
      setSelectedLayers([])
      setSelectedChecks([])
      setSelectedTypes([])
      setManualCheckExclusions([])
      prevSideRef.current = selectedSide
    }
  }, [selectedSide])

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
        setLinearSnapshotsByPhase(new Map())
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
      const buildLayerStatusMap = (
        layers: string[] | undefined,
        status: InspectionStatus,
        updatedAt: number,
        phaseName?: string,
      ): LayerStatusByName => {
        const map: LayerStatusByName = {}
        if (!layers?.length) return map
        layers.forEach((layerName) => {
          splitLayerTokens(layerName).forEach((token) => {
            const normalized = normalizeLabel(
              localizeProgressTerm('layer', token, 'zh', { phaseName }),
            )
            if (!normalized) return
            const existing = map[normalized]
            if (!existing) {
              map[normalized] = { status, updatedAt }
              return
            }
            const existingPriority = statusPriority[existing.status] ?? 0
            const incomingPriority = statusPriority[status] ?? 0
            if (
              incomingPriority > existingPriority ||
              (incomingPriority === existingPriority && updatedAt >= existing.updatedAt)
            ) {
              map[normalized] = { status, updatedAt }
            }
          })
        })
        return map
      }

      const mergeLayerStatusMap = (
        target: LayerStatusByName | undefined,
        incoming: LayerStatusByName | undefined,
      ): LayerStatusByName => {
        const result: LayerStatusByName = target ? { ...target } : {}
        Object.entries(incoming ?? {}).forEach(([name, entry]) => {
          const existing = result[name]
          if (!existing) {
            result[name] = entry
            return
          }
          const existingPriority = statusPriority[existing.status] ?? 0
          const incomingPriority = statusPriority[entry.status] ?? 0
          if (
            incomingPriority > existingPriority ||
            (incomingPriority === existingPriority && entry.updatedAt >= existing.updatedAt)
          ) {
            result[name] = entry
          }
        })
        return result
      }

      const url = `/api/progress/${road.slug}/inspections?${search.toString()}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          if (!isCancelled()) {
            latestPointInspectionsRef.current = new Map()
            setInspectionSlices([])
            setLatestPointInspections(new Map())
            setLinearSnapshotsByPhase(new Map())
          }
          return
        }
        const data = (await res.json()) as {
          items?: Array<{
            phaseId: number
            phaseName?: string
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
          const layerStatus = buildLayerStatusMap(
            item.layers,
            item.status ?? 'PENDING',
            ts || 0,
            item.phaseName,
          )
          const snapshot: LatestPointInspection = {
            phaseId: Number(item.phaseId),
            side,
            startPk: orderedStart,
            endPk: orderedEnd,
            layers: item.layers || [],
            checks: item.checks || [],
            updatedAt: ts || 0,
            status: item.status ?? 'PENDING',
            layerStatus,
          }
          if (!existing) {
            map.set(key, snapshot)
          } else {
            const existingPriority = statusPriority[existing.status] ?? 0
            const currentPriority = statusPriority[snapshot.status] ?? 0
            const isCurrentHigher = currentPriority > existingPriority
            const isExistingHigher = currentPriority < existingPriority
            const isCurrentNewer = (snapshot.updatedAt ?? 0) >= (existing.updatedAt ?? 0)
            const mergedStatus = isCurrentHigher
              ? snapshot.status
              : isExistingHigher
                ? existing.status
                : isCurrentNewer
                  ? snapshot.status
                  : existing.status

            const mergedLayers = Array.from(
              new Set([...(existing.layers || []), ...(snapshot.layers || [])]),
            )
            const mergedChecks = Array.from(
              new Set([...(existing.checks || []), ...(snapshot.checks || [])]),
            )

            const mergedUpdatedAt = Math.max(existing.updatedAt ?? 0, snapshot.updatedAt ?? 0)
            const mergedLayerStatus = mergeLayerStatusMap(existing.layerStatus, snapshot.layerStatus)
            const merged: LatestPointInspection = {
              ...snapshot,
              layers: mergedLayers,
              checks: mergedChecks,
              updatedAt: mergedUpdatedAt,
              status: mergedStatus,
              layerStatus: mergedLayerStatus,
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
          const linearRaw = new Map<number, LatestPointInspection[]>()
          data.items.forEach((item) => {
            const ts = new Date(item.updatedAt).getTime() || 0
            const snapshot: LatestPointInspection = {
              phaseId: Number(item.phaseId),
              side: item.side ?? 'BOTH',
              startPk: Number(item.startPk),
              endPk: Number(item.endPk),
              layers: item.layers || [],
              checks: item.checks || [],
              updatedAt: ts,
              status: item.status ?? 'PENDING',
              layerStatus: buildLayerStatusMap(
                item.layers,
                item.status ?? 'PENDING',
                ts,
                item.phaseName,
              ),
            }
            const list = linearRaw.get(snapshot.phaseId) ?? []
            list.push(snapshot)
            linearRaw.set(snapshot.phaseId, list)
          })
          if (process.env.NODE_ENV !== 'production') {
            const debug = Array.from(map.values()).map((snap) => ({
              phaseId: snap.phaseId,
              side: snap.side,
              range: `${snap.startPk}-${snap.endPk}`,
              status: snap.status,
              layers: snap.layers,
              layerStatus: snap.layerStatus,
            }))
            console.log('[progress debug] latestPointInspections', debug)
          }
          latestPointInspectionsRef.current = map
          setLatestPointInspections(map)
          setInspectionSlices(slices)
          setLinearSnapshotsByPhase(linearRaw)
        }
      } catch (err) {
        if (!isCancelled()) {
          latestPointInspectionsRef.current = new Map()
          setInspectionSlices([])
          setLatestPointInspections(new Map())
          setLinearSnapshotsByPhase(new Map())
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

  const shouldSplitLayerBySide = useCallback(
    (layer: WorkflowLayerTemplate) => {
      if (!selectedSegment || !intervalRange) return false
      if (selectedSide !== 'BOTH') return false
      const [rangeStart, rangeEnd] = intervalRange
    const coversRange = (snapshot: LatestPointInspection) => {
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      return snapshot.phaseId === selectedSegment.phaseId && snapshotStart <= rangeStart && snapshotEnd >= rangeEnd
    }
    let hasBoth = false
    let hasSingle = false
    latestPointInspections.forEach((snapshot) => {
      if (!coversRange(snapshot)) return
      let includesLayer = false
      snapshot.layers?.forEach((layerName) => {
        splitLayerTokens(layerName).forEach((token) => {
          const normalizedLayerName = normalizeLabel(
            localizeProgressTerm('layer', token, 'zh', { phaseName: workflowPhaseNameForContext }),
          )
          const meta = workflowLayerByName?.get(normalizedLayerName)
          if (meta?.id === layer.id) {
            const statusForLayer = resolveSnapshotLayerStatus(
              snapshot,
              new Set([normalizedLayerName]),
            )
            if (!isWorkflowSatisfied(statusForLayer)) return
            includesLayer = true
          }
        })
      })
      if (!includesLayer) return
        if (snapshot.side === 'BOTH') {
          hasBoth = true
        } else {
          hasSingle = true
        }
      })
      return hasSingle && !hasBoth
    },
    [intervalRange, latestPointInspections, selectedSegment, selectedSide, workflowLayerByName, workflowPhaseNameForContext],
  )

  const resolveSplitTargetSide = useCallback(
    (layer: WorkflowLayerTemplate): IntervalSide | null => {
      const layerSideStatus = workflowStatusMaps.layerStatusBySide?.get(layer.id)
      const leftBooked = (statusPriority[layerSideStatus?.LEFT ?? 'PENDING'] ?? 0) >= (statusPriority.SCHEDULED ?? 0)
      const rightBooked = (statusPriority[layerSideStatus?.RIGHT ?? 'PENDING'] ?? 0) >= (statusPriority.SCHEDULED ?? 0)
      if (leftBooked && !rightBooked) return 'RIGHT'
      if (rightBooked && !leftBooked) return 'LEFT'
      return null
    },
    [workflowStatusMaps.layerStatusBySide],
  )

  const showLegacySelection = !(
    selectedSegment?.workflow &&
    selectedSegment.workflowLayers?.length &&
    selectedSegment.measure === 'POINT'
  )

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
                        {measure === 'POINT' && layerOptions.length ? (
                          <div className="md:col-span-6">
                            <div className="flex flex-wrap gap-2">
                              {(layerOptions.length ? layerOptions : defaultLayers).map((layer) => {
                                const selected =
                                  (item.layers?.length ? item.layers : defaultLayers).some(
                                    (name) => normalizeLabel(name) === normalizeLabel(layer),
                                  )
                                return (
                                  <button
                                    key={`${index}-${layer}`}
                                    type="button"
                                    onClick={() => toggleIntervalLayer(index, layer)}
                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                      selected
                                        ? 'bg-emerald-300 text-slate-900 shadow-lg shadow-emerald-400/30'
                                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                    }`}
                                  >
                                    {layer}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                        {intervals.length > 1 ? (
                          <div className="md:col-span-6 flex justify-end">
                            <button
                              type="button"
                              className="rounded-xl border border-rose-200/60 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
                              onClick={() => removeInterval(index)}
                            >
                              {t.form.intervalDelete}
                            </button>
                          </div>
                        ) : null}
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
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          {t.list.legend}
          <span className="h-px w-12 bg-white/30" />
          <div className="flex flex-wrap items-center gap-3">
            {[
              { key: 'pending' as Status, tone: statusTone.pending, label: t.status.pending },
              { key: 'scheduled' as Status, tone: statusTone.scheduled ?? t.status.pending, label: t.status.scheduled ?? t.status.pending },
              { key: 'submitted' as Status, tone: statusTone.submitted, label: t.status.submitted ?? t.status.inProgress },
              { key: 'inProgress' as Status, tone: statusTone.inProgress, label: t.status.inProgress },
              { key: 'approved' as Status, tone: statusTone.approved, label: t.status.approved },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-1">
                <span className={`inline-block h-4 w-4 rounded-sm ring-1 ring-white/20 ${item.tone}`} aria-label={item.label} />
                <span className="text-[11px] font-semibold text-slate-100">{item.label}</span>
              </div>
            ))}
          </div>
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
                                    const isApprovedLock = seg.status === 'approved' && !(linear?.isDependencyDriven ?? false)
                                    return (
                                      <button
                                        key={`${seg.start}-${seg.end}-${idx}`}
                                        type="button"
                                        className={`${statusTone[seg.status]} group flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                                        style={{ width: `${width}%` }}
                                        title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${statusLabel(seg.status)}`}
                                        onClick={() => {
                                          if (isApprovedLock) return
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
                                            pointHasSides: phase.pointHasSides,
                                          })
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
                                resolvePointProgress={resolvePointProgress}
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
                          resolvePointProgress={resolvePointProgress}
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
                      {(() => {
                        const sideOptionsForSelect = enforcedSide
                          ? [
                              {
                                value: enforcedSide,
                                label:
                                  enforcedSide === 'LEFT'
                                    ? t.inspection.sideLeft
                                    : enforcedSide === 'RIGHT'
                                      ? t.inspection.sideRight
                                      : t.inspection.sideBoth,
                              },
                            ]
                          : [
                              { value: 'LEFT' as const, label: t.inspection.sideLeft },
                              { value: 'RIGHT' as const, label: t.inspection.sideRight },
                              { value: 'BOTH' as const, label: t.inspection.sideBoth },
                            ]
                        return (
                          <select
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                            value={selectedSide}
                            onChange={(e) => setSelectedSide(e.target.value as IntervalSide)}
                            disabled={Boolean(enforcedSide)}
                          >
                            {sideOptionsForSelect.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                                disabled={
                                  !enforcedSide &&
                                  Boolean(
                                    sideBooking.lockedSide &&
                                      ((option.value === 'LEFT' && sideBooking.lockedSide !== 'LEFT') ||
                                        (option.value === 'RIGHT' && sideBooking.lockedSide !== 'RIGHT') ||
                                        (option.value === 'BOTH' && sideBooking.lockedSide)),
                                  )
                                }
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )
                      })()}
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
                    selectedSegment.measure === 'POINT' ? (
                      <div className="space-y-4 rounded-3xl border border-emerald-300/30 bg-slate-900/70 p-4 shadow-inner shadow-emerald-400/15">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                          <span className="rounded-full bg-emerald-300/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950">
                            {workflowCopy.timelineBadge}
                          </span>
                          <span className="font-semibold text-emerald-50">
                            {localizedWorkflowPhaseName ?? selectedSegment.workflow.phaseName}
                          </span>
                          {localizedWorkflowSideRule ? (
                            <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] text-emerald-50">
                              {localizedWorkflowSideRule}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative space-y-3 border-l border-dashed border-emerald-300/30 pl-4">
                          {selectedSegment.workflowLayers.flatMap((layer) => {
                            let sideSequence: IntervalSide[]
                            if (enforcedSide) {
                              sideSequence = [enforcedSide]
                            } else if (shouldSplitLayerBySide(layer)) {
                              sideSequence = ['LEFT', 'RIGHT']
                            } else if (sideBooking.lockedSide) {
                              sideSequence = [sideBooking.lockedSide === 'LEFT' ? 'RIGHT' : 'LEFT', sideBooking.lockedSide]
                            } else {
                              sideSequence = [selectedSide]
                            }
                          const isSplitView = sideSequence.length > 1
                          return sideSequence.map((sideKey) => {
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
                              const localizedDescription = layer.description
                                ? localizeProgressText(layer.description, locale)
                                : null
                            const layerStatus = workflowStatusMaps.layerStatus.get(layer.id)
                            const layerSideStatus = workflowStatusMaps.layerStatusBySide?.get(layer.id)
                            const baseLayerStatus = isSplitView ? 'PENDING' : layerStatus
                            const currentLayerStatus =
                              sideKey === 'LEFT'
                                ? layerSideStatus?.LEFT ?? baseLayerStatus
                                : sideKey === 'RIGHT'
                                  ? layerSideStatus?.RIGHT ?? baseLayerStatus
                                  : layerStatus
                            const effectiveLayerStatus = currentLayerStatus ?? 'PENDING'
                            if (process.env.NODE_ENV !== 'production') {
                              console.log('[render debug] layer', {
                                phase: selectedSegment.workflow?.phaseName ?? selectedSegment.phase,
                                layerId: layer.id,
                                layerName: localizedLayerName,
                                side: sideKey,
                                isSplitView,
                                layerStatus,
                                layerSideStatus,
                                baseLayerStatus,
                                currentLayerStatus,
                                effectiveLayerStatus,
                              })
                            }
                            const splitLayerStatus =
                              sideBooking.lockedSide !== null &&
                              layerSideStatus?.LEFT &&
                              layerSideStatus?.RIGHT &&
                              layerSideStatus.LEFT !== layerSideStatus.RIGHT
                              const isReadOnly =
                                sideBooking.lockedSide !== null &&
                                sideKey !== sideBooking.lockedSide &&
                                sideBooking.lockedSide !== null
                              const layerLocked = isStatusLocked(effectiveLayerStatus) || isReadOnly
                              const layerTone = resolveWorkflowStatusTone(effectiveLayerStatus)
                              const sideLabelInline =
                                sideKey === 'LEFT' ? t.inspection.sideLeft : sideKey === 'RIGHT' ? t.inspection.sideRight : ''
                              return (
                                <div
                                  key={`${layer.id}-${sideKey}`}
                                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-slate-900/30"
                                >
                                  <div className="absolute -left-[9px] top-5 h-4 w-4 rounded-full border border-emerald-200/70 bg-emerald-400/80 shadow-md shadow-emerald-400/50" />
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">
                                          {formatProgressCopy(workflowCopy.stageName, { value: layer.stage })}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (layerLocked) return
                                            toggleLayerSelection(localizedLayerName)
                                          }}
                                          className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${layerLocked
                                              ? `${layerTone} cursor-not-allowed opacity-90`
                                              : isLayerSelected(localizedLayerName)
                                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/30'
                                                : isLayerDisabled(localizedLayerName)
                                                  ? 'cursor-not-allowed bg-white/5 text-slate-400'
                                                  : 'bg-white/10 text-slate-50 hover:bg-white/20'
                                            }`}
                                        >
                                          {localizedLayerName}
                                        </button>
                                        {splitLayerStatus ? (
                                          <div className="flex items-center gap-1">
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(layerSideStatus?.LEFT)}`}
                                            >
                                              {t.inspection.sideLeft}·{resolveWorkflowStatusLabel(layerSideStatus?.LEFT)}
                                            </span>
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(layerSideStatus?.RIGHT)}`}
                                            >
                                              {t.inspection.sideRight}·{resolveWorkflowStatusLabel(layerSideStatus?.RIGHT)}
                                            </span>
                                          </div>
                                        ) : (
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(currentLayerStatus)}`}
                                          >
                                            {sideLabelInline ? `${sideLabelInline}·` : ''}
                                            {resolveWorkflowStatusLabel(currentLayerStatus)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                                        {dependsNames.length ? (
                                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                                            {formatProgressCopy(workflowCopy.timelineDepends, {
                                              deps: dependsNames.join(listJoiner),
                                            })}
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                                            {workflowCopy.timelineFree}
                                          </span>
                                        )}
                                        {lockNames.length ? (
                                          <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] text-amber-100">
                                            {formatProgressCopy(workflowCopy.lockedWith, {
                                              peers: lockNames.join(listJoiner),
                                            })}
                                          </span>
                                        ) : null}
                                        {parallelNames.length ? (
                                          <span className="rounded-full bg-blue-300/20 px-2 py-0.5 text-[10px] text-blue-50">
                                            {formatProgressCopy(workflowCopy.parallelWith, {
                                              peers: parallelNames.join(listJoiner),
                                            })}
                                          </span>
                                        ) : null}
                                      </div>
                                      {localizedDescription ? (
                                        <p className="text-[11px] text-slate-200">{localizedDescription}</p>
                                      ) : null}
                                    </div>
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                      {formatProgressCopy(workflowCopy.bindingChecks, {
                                        count: layer.checks.length,
                                      })}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    {layer.checks.map((check, idx) => {
                                    const normalizedCheckName = normalizeLabel(
                                      localizeProgressTerm('check', check.name, 'zh'),
                                    )
                                    const checkKey = `${layer.id}|${normalizedCheckName}`
                                    const checkStatus = workflowStatusMaps.checkStatus.get(checkKey) ?? layerStatus
                                    const checkSideStatus = workflowStatusMaps.checkStatusBySide?.get(checkKey)
                                    const splitCheckStatus =
                                      sideBooking.lockedSide !== null &&
                                      checkSideStatus?.LEFT &&
                                      checkSideStatus?.RIGHT &&
                                      checkSideStatus.LEFT !== checkSideStatus.RIGHT
                                    const sideLayerStatus = sideKey === 'LEFT' ? layerSideStatus?.LEFT : layerSideStatus?.RIGHT
                                    const baseCheckStatus = isSplitView ? sideLayerStatus ?? checkStatus : checkStatus
                                    const currentCheckStatus =
                                      sideKey === 'LEFT'
                                        ? checkSideStatus?.LEFT ?? baseCheckStatus
                                        : sideKey === 'RIGHT'
                                          ? checkSideStatus?.RIGHT ?? baseCheckStatus
                                          : checkStatus
                                    const effectiveCheckStatus = currentCheckStatus ?? effectiveLayerStatus
                                    const tone = resolveWorkflowStatusTone(effectiveCheckStatus)
                                    const typeLabels = check.types.map((type) => localizeProgressTerm('type', type, locale))
                                    const checkLocked = layerLocked || isStatusLocked(effectiveCheckStatus)
                                    const localizedCheck = localizeProgressTerm('check', check.name, locale)
                                    const layerSelected = isLayerSelected(localizedLayerName)
                                    const checkSelected = isCheckSelected(localizedCheck) && layerSelected
                                    if (process.env.NODE_ENV !== 'production') {
                                      console.log('[render debug] check', {
                                        phase: selectedSegment.workflow?.phaseName ?? selectedSegment.phase,
                                        layerId: layer.id,
                                        layerName: localizedLayerName,
                                        side: sideKey,
                                        checkName: localizedCheck,
                                        checkKey,
                                        checkStatus,
                                        checkSideStatus,
                                        baseCheckStatus,
                                        currentCheckStatus,
                                        effectiveCheckStatus,
                                        layerLocked,
                                        checkLocked,
                                      })
                                    }
                                      return (
                                        <div
                                          key={`${layer.id}-${idx}-${check.name}`}
                                          className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner shadow-slate-900/20"
                                        >
                                          <div className="flex flex-wrap items-center gap-2">
                                            {splitCheckStatus ? (
                                              <>
                                                <span
                                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(checkSideStatus?.LEFT)}`}
                                                >
                                                  {t.inspection.sideLeft}·{resolveWorkflowStatusLabel(checkSideStatus?.LEFT)}
                                                </span>
                                                <span
                                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(checkSideStatus?.RIGHT)}`}
                                                >
                                                  {t.inspection.sideRight}·{resolveWorkflowStatusLabel(checkSideStatus?.RIGHT)}
                                                </span>
                                              </>
                                            ) : (
                                              <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                                              >
                                                {sideLabelInline ? `${sideLabelInline}·` : ''}
                                                {resolveWorkflowStatusLabel(currentCheckStatus)}
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (checkLocked) return
                                                if (!layerSelected) return
                                                if (allowedCheckSet && !allowedCheckSet.has(localizedCheck)) return
                                                toggleCheck(localizedCheck)
                                              }}
                                              className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${checkLocked
                                                  ? `${tone} cursor-not-allowed opacity-90`
                                                  : !layerSelected
                                                    ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                                    : checkSelected
                                                      ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/30'
                                                      : allowedCheckSet &&
                                                        !allowedCheckSet.has(localizeProgressTerm('check', check.name, locale))
                                                        ? 'cursor-not-allowed bg-white/5 text-slate-400'
                                                        : 'bg-white/10 text-slate-50 hover:bg-white/20'
                                                }`}
                                            >
                                              {localizeProgressTerm('check', check.name, locale)}
                                            </button>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {typeLabels.map((typeLabel) => (
                                              <span
                                                key={`${check.name}-${typeLabel}`}
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                                              >
                                                {typeLabel}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })
                          })}
                        </div>
                      </div>
                    ) : (
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
                    )
                  ) : null}

                  {showLegacySelection ? (
                    <>
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
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${selectedLayers.includes(item)
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
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${selectedChecks.includes(item)
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
                    </>
                  ) : null}

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.typesLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {activeInspectionTypes.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${selectedTypes.includes(item)
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
                  className={`text-sm ${submitError ? 'font-semibold text-amber-200' : 'text-slate-200'
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
