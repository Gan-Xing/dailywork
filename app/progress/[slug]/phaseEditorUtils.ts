import type {
  InspectionStatus,
  IntervalSide,
  PhaseDTO,
  PhaseIntervalPayload,
  PhaseMeasure,
} from '@/lib/progressTypes'

import type {
  InspectionSlice,
  LatestPointInspection,
  LinearView,
  PointView,
  Segment,
  Status,
} from './phaseEditorTypes'

export const statusTone: Record<Status, string> = {
  pending: 'bg-slate-100 text-slate-900 ring-1 ring-slate-200',
  scheduled: 'bg-sky-400 text-slate-900 ring-1 ring-sky-500',
  submitted: 'bg-rose-200 text-rose-900 ring-1 ring-rose-300',
  inProgress: 'bg-amber-200 text-amber-950 ring-1 ring-amber-300',
  approved: 'bg-emerald-300 text-slate-900 ring-1 ring-emerald-400',
  nonDesign: 'bg-slate-800 text-slate-100 shadow-inner shadow-slate-900/30',
}

export const workflowStatusTone: Record<InspectionStatus, string> = {
  PENDING: 'bg-slate-800 text-slate-100 ring-1 ring-white/10',
  SCHEDULED: 'bg-sky-900/60 text-sky-100 ring-1 ring-sky-300/40',
  SUBMITTED: 'bg-amber-700/40 text-amber-100 ring-1 ring-amber-200/40',
  IN_PROGRESS: 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-300/40',
  APPROVED: 'bg-emerald-400/20 text-emerald-950 ring-1 ring-emerald-300/50',
}

export const normalizePhaseDTO = (phase: PhaseDTO): PhaseDTO => ({
  ...phase,
  pointHasSides: Boolean(phase.pointHasSides),
  resolvedLayers: Array.isArray(phase.resolvedLayers) ? [...phase.resolvedLayers] : [],
  resolvedChecks: Array.isArray(phase.resolvedChecks) ? [...phase.resolvedChecks] : [],
  allowedLayers: Array.isArray((phase as { allowedLayers?: { id: number; name: string }[] }).allowedLayers)
    ? ((phase as { allowedLayers?: { id: number; name: string }[] }).allowedLayers ?? [])
    : [],
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
    layerIds: Array.isArray((interval as { layerIds?: number[] }).layerIds)
      ? ((interval as { layerIds?: number[] }).layerIds ?? [])
      : [],
    billQuantity: interval.billQuantity ?? null,
  })),
})

export const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

export const todayISODate = () => new Date().toISOString().slice(0, 10)

export const buildPointKey = (phaseId: number, side: IntervalSide, startPk: number, endPk: number) =>
  `${phaseId}-${side}-${Math.round(Number(startPk || 0) * 1000)}-${Math.round(Number(endPk || 0) * 1000)}`

const normalizeEntityKey = (id?: string | number | null, name?: string | null) => {
  if (id !== null && id !== undefined && `${id}`.trim()) {
    return `id:${id}`
  }
  if (typeof name === 'string' && name.trim()) {
    return `name:${normalizeLabel(name)}`
  }
  return 'unknown'
}

export type CheckStatusKeyInput = {
  phaseId: number
  phaseName?: string | null
  layerId?: string | null | number
  layerName?: string | null
  checkId?: string | null | number
  checkName?: string | null
  startPk: number
  endPk: number
}

export const buildCheckStatusBaseKey = (input: CheckStatusKeyInput) => {
  const [start, end] = normalizeRange(input.startPk, input.endPk)
  return [
    normalizeEntityKey(input.phaseId, input.phaseName),
    normalizeEntityKey(input.layerId, input.layerName),
    normalizeEntityKey(input.checkId, input.checkName),
    `${start}-${end}`,
  ].join('|')
}

export const buildCheckStatusKey = (input: CheckStatusKeyInput & { side: IntervalSide }) =>
  `${buildCheckStatusBaseKey(input)}|${input.side}`

export const normalizeRange = (start: number, end: number) => {
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
}

export const computeDesign = (measure: PhaseMeasure, intervals: PhaseIntervalPayload[]) =>
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

export const normalizeInterval = (interval: PhaseIntervalPayload, measure: PhaseMeasure) => {
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

export const getPointCenter = (startPk: number, endPk: number) => (startPk + endPk) / 2

export const normalizeLabel = (value: string) => value.trim().toLowerCase()

export const fillNonDesignGaps = (segments: Segment[], start: number, end: number) => {
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

export const statusPriority: Record<InspectionStatus, number> = {
  APPROVED: 5,
  IN_PROGRESS: 4,
  SUBMITTED: 3,
  SCHEDULED: 2,
  PENDING: 1,
}

export const mapInspectionStatus = (status: InspectionStatus): Status => {
  if (status === 'APPROVED') return 'approved'
  if (status === 'IN_PROGRESS') return 'inProgress'
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'SCHEDULED') return 'scheduled'
  return 'pending'
}

export const workflowSatisfiedStatuses: InspectionStatus[] = ['SCHEDULED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED']

export const isWorkflowSatisfied = (status?: InspectionStatus) =>
  (statusPriority[status ?? 'PENDING'] ?? 0) >= (statusPriority.SCHEDULED ?? 0)

export const snapshotMatches =
  (phaseId: number, targetSide: IntervalSide, targetStart: number, targetEnd: number) =>
  (snapshot: LatestPointInspection) => {
    if (snapshot.phaseId !== phaseId) return false
    const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
    const [targetStartOrdered, targetEndOrdered] = normalizeRange(targetStart, targetEnd)
    if (snapshotEnd < targetStartOrdered || snapshotStart > targetEndOrdered) return false
    if (targetSide === 'BOTH') {
      return snapshot.side === 'BOTH'
    }
    return snapshot.side === 'BOTH' || snapshot.side === targetSide
  }

export const mergeAdjacentSegments = (segments: Segment[]) => {
  const merged: Segment[] = []
  segments.forEach((seg) => {
    const last = merged[merged.length - 1]
    const sameSpec = (last?.spec ?? null) === (seg.spec ?? null) && (last?.billQuantity ?? null) === (seg.billQuantity ?? null)
    if (last && last.status === seg.status && sameSpec && Math.abs(last.end - seg.start) < 1e-6) {
      merged[merged.length - 1] = { ...last, end: seg.end }
    } else {
      merged.push(seg)
    }
  })
  return merged
}

export const applyInspectionStatuses = (segments: Segment[], inspections: InspectionSlice[]) => {
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
      const overlaps = inspections.filter((insp) => Math.max(start, insp.startPk) < Math.min(end, insp.endPk))
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

export const calcDesignBySide = (segments: Segment[]) =>
  segments.reduce((acc, seg) => (seg.status === 'nonDesign' ? acc : acc + Math.max(0, seg.end - seg.start)), 0)

export const calcCompletedBySide = (segments: Segment[]) =>
  segments.reduce((acc, seg) => (seg.status === 'approved' ? acc + Math.max(0, seg.end - seg.start) : acc), 0)

export const buildLinearView = (
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

  const maxEnd = Math.max(roadLength, ...normalized.map((i) => i.endPk), ...normalized.map((i) => i.startPk), 0)
  const total = Math.max(maxEnd, roadLength || 0, 1)
  const orderedInspections = inspections.map((insp) => {
    const start = Number(insp.startPk)
    const end = Number(insp.endPk)
    const [orderedStart, orderedEnd] = start <= end ? [start, end] : [end, start]
    return { ...insp, startPk: orderedStart, endPk: orderedEnd }
  })
  const leftInspections = orderedInspections.filter((insp) => insp.side === 'LEFT' || insp.side === 'BOTH')
  const rightInspections = orderedInspections.filter((insp) => insp.side === 'RIGHT' || insp.side === 'BOTH')

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

export const buildPointView = (phase: PhaseDTO, fallbackStart: number, fallbackEnd: number): PointView => {
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

export const calcCombinedPercent = (left: Segment[], right: Segment[]) => {
  const leftLen = calcDesignBySide(left)
  const rightLen = calcDesignBySide(right)
  const total = leftLen + rightLen
  if (total <= 0) return 0
  const completed = calcCompletedBySide(left) + calcCompletedBySide(right)
  return Math.round((completed / total) * 100)
}
