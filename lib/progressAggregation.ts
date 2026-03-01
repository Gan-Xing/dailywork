import type { Locale } from '@/lib/i18n'
import type {
  AggregatedPhaseProgress,
  AggregatedPhaseRoadBreakdown,
  IntervalSide,
  PhaseMeasure,
  RoadPhaseProgressDTO,
  RoadSectionProgressDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'

const SPEC_SPLIT_PHASES = new Set(['边沟', '过道涵', '路缘石'])

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const normalizeSpecValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

type AggregationKeyMode = 'name-and-measure' | 'name-only'

const canonicalizePhaseName = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return value
  return canonicalizeProgressList('phase', [normalized]).at(0) ?? normalized
}

const ensureSide = (side?: IntervalSide): IntervalSide =>
  side === 'LEFT' || side === 'RIGHT' || side === 'BOTH' ? side : 'BOTH'

const normalizeRange = (startPk: number, endPk: number): [number, number] => {
  const start = Number.isFinite(startPk) ? startPk : 0
  const end = Number.isFinite(endPk) ? endPk : start
  return start <= end ? [start, end] : [end, start]
}

type Segment = {
  start: number
  end: number
  side: IntervalSide
  spec: string | null
}

const buildSegments = (phase: RoadPhaseProgressDTO): Segment[] => {
  if (!phase.intervals?.length) return []
  const segments: Segment[] = []
  phase.intervals.forEach((interval) => {
    const [start, end] = normalizeRange(interval.startPk, interval.endPk)
    const spec = normalizeSpecValue(interval.spec)
    const side = ensureSide(interval.side)
    const normalizedSides: IntervalSide[] =
      side === 'BOTH' ? (['LEFT', 'RIGHT'] as IntervalSide[]) : [side]
    normalizedSides.forEach((normalized) => {
      segments.push({ start, end, side: normalized, spec })
    })
  })
  return segments
}

const calculateSegmentLength = (
  measure: PhaseMeasure,
  start: number,
  end: number,
): number => {
  if (measure === 'POINT') {
    return 1
  }
  const delta = end - start
  const base = delta === 0 ? 1 : Math.max(delta, 0)
  return base
}

const sumSegmentLengths = (
  segments: Segment[],
  measure: PhaseMeasure,
): Map<string | null, number> => {
  const totals = new Map<string | null, number>()
  segments.forEach((segment) => {
    const length = calculateSegmentLength(measure, segment.start, segment.end)
    const current = totals.get(segment.spec) ?? 0
    totals.set(segment.spec, current + length)
  })
  return totals
}

const accumulateCompletedLengths = (
  segments: Segment[],
  measure: PhaseMeasure,
  inspections: { startPk: number; endPk: number; side: IntervalSide }[],
): Map<string | null, number> => {
  const totals = new Map<string | null, number>()
  if (!segments.length || !inspections.length) return totals
  inspections.forEach((inspection) => {
    const [start, end] = normalizeRange(inspection.startPk, inspection.endPk)
    const matchingSides =
      inspection.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [ensureSide(inspection.side)]
    segments.forEach((segment) => {
      if (!matchingSides.includes(segment.side)) {
        return
      }
      if (measure === 'POINT') {
        if (start <= segment.start && segment.start <= end) {
          const current = totals.get(segment.spec) ?? 0
          totals.set(segment.spec, current + 1)
        }
        return
      }
      const rawOverlap = Math.min(end, segment.end) - Math.max(start, segment.start)
      if (rawOverlap <= 0) {
        if (Math.abs(rawOverlap) < 1e-6) {
          const current = totals.get(segment.spec) ?? 0
          totals.set(segment.spec, current + 1)
        }
        return
      }
      const current = totals.get(segment.spec) ?? 0
      totals.set(segment.spec, current + rawOverlap)
    })
  })
  return totals
}

const scaleLengthMap = (source: Map<string | null, number>, targetTotal: number) => {
  const copy = new Map<string | null, number>(source)
  if (targetTotal <= 0) {
    return copy
  }
  const sum = Array.from(source.values()).reduce((acc, value) => acc + value, 0)
  if (sum <= 0) {
    return copy
  }
  const factor = targetTotal / sum
  return new Map(
    Array.from(source.entries()).map(([spec, value]) => [spec, value * factor]),
  )
}

const distributeByDesign = (
  designMap: Map<string | null, number>,
  target: number,
): Map<string | null, number> => {
  const fallback = new Map<string | null, number>()
  if (!designMap.size || target <= 0) {
    return fallback
  }
  const sum = Array.from(designMap.values()).reduce((acc, value) => acc + value, 0)
  if (sum <= 0) {
    const share = target / designMap.size
    designMap.forEach((_, spec) => fallback.set(spec, share))
    return fallback
  }
  designMap.forEach((value, spec) => {
    fallback.set(spec, (value / sum) * target)
  })
  return fallback
}

const createSpecEntries = (
  phase: RoadPhaseProgressDTO,
  splitBySpec: boolean,
): { spec: string | null; designLength: number; completedLength: number }[] => {
  const defaultEntry = {
    spec: null,
    designLength: phase.designLength,
    completedLength: phase.completedLength,
  }
  if (!splitBySpec || !SPEC_SPLIT_PHASES.has(phase.phaseName)) {
    return [defaultEntry]
  }
  const segments = buildSegments(phase)
  if (!segments.length) {
    return [defaultEntry]
  }

  const designBySpec = sumSegmentLengths(segments, phase.phaseMeasure)
  if (!designBySpec.size) {
    return [defaultEntry]
  }
  const scaledDesign = scaleLengthMap(designBySpec, phase.designLength)
  const rawCompleted = accumulateCompletedLengths(
    segments,
    phase.phaseMeasure,
    phase.inspections ?? [],
  )
  let scaledCompleted = rawCompleted.size
    ? scaleLengthMap(rawCompleted, phase.completedLength)
    : new Map<string | null, number>()

  if (!scaledCompleted.size && phase.completedLength > 0) {
    scaledCompleted = distributeByDesign(scaledDesign, phase.completedLength)
  }

  if (!scaledCompleted.size) {
    scaledDesign.forEach((_, spec) => {
      if (!scaledCompleted.has(spec)) {
        scaledCompleted.set(spec, 0)
      }
    })
  }

  const specKeys = new Set<string | null>([
    ...Array.from(scaledDesign.keys()),
    ...Array.from(scaledCompleted.keys()),
  ])
  if (!specKeys.size) {
    return [defaultEntry]
  }

  return Array.from(specKeys).map((spec) => ({
    spec,
    designLength: scaledDesign.get(spec) ?? 0,
    completedLength: scaledCompleted.get(spec) ?? 0,
  }))
}

interface AggregationRecord {
  id: string
  name: string
  measures: Set<PhaseMeasure>
  definitionIds: Set<number>
  spec?: string | null
  totalDesignLength: number
  totalCompletedLength: number
  latestUpdatedAt: number
  roadNames: Set<string>
  roadBreakdown: Map<
    number,
    {
      roadId: number
      roadSlug: string
      roadName: string
      roadLabels: RoadSectionProgressDTO['labels']
      designLength: number
      completedLength: number
      latestUpdatedAt: number
    }
  >
}

export function aggregatePhaseProgress(
  roads: RoadSectionProgressDTO[],
  options: { locale?: Locale; splitBySpec?: boolean; keyMode?: AggregationKeyMode } = {},
): AggregatedPhaseProgress[] {
  const locale = options.locale ?? 'zh'
  const splitBySpec = options.splitBySpec ?? true
  const keyMode = options.keyMode ?? 'name-and-measure'
  const map = new Map<string, AggregationRecord>()

  roads.forEach((road) => {
    road.phases.forEach((phase) => {
      const canonicalPhaseName = canonicalizePhaseName(phase.phaseName)
      const specEntries = createSpecEntries(phase, splitBySpec)
      const updatedAtRaw = new Date(phase.updatedAt).getTime()
      const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : 0

      specEntries.forEach((entry) => {
        const specKey = splitBySpec ? entry.spec ?? '' : ''
        const measureKey = keyMode === 'name-only' ? 'ALL' : phase.phaseMeasure
        const key = `${canonicalPhaseName}::${measureKey}::${specKey}`
        const existing = map.get(key)
        if (existing) {
          existing.totalDesignLength += entry.designLength
          existing.totalCompletedLength += entry.completedLength
          existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, updatedAt)
          existing.roadNames.add(road.name)
          existing.measures.add(phase.phaseMeasure)
          const roadEntry = existing.roadBreakdown.get(road.id)
          if (roadEntry) {
            roadEntry.designLength += entry.designLength
            roadEntry.completedLength += entry.completedLength
            roadEntry.latestUpdatedAt = Math.max(roadEntry.latestUpdatedAt, updatedAt)
          } else {
            existing.roadBreakdown.set(road.id, {
              roadId: road.id,
              roadSlug: road.slug,
              roadName: road.name,
              roadLabels: road.labels,
              designLength: entry.designLength,
              completedLength: entry.completedLength,
              latestUpdatedAt: updatedAt,
            })
          }
          if (Number.isInteger(phase.phaseDefinitionId) && phase.phaseDefinitionId > 0) {
            existing.definitionIds.add(phase.phaseDefinitionId)
          }
          return
        }
        map.set(key, {
          id: key,
          name: canonicalPhaseName,
          measures: new Set([phase.phaseMeasure]),
          definitionIds:
            Number.isInteger(phase.phaseDefinitionId) && phase.phaseDefinitionId > 0
              ? new Set([phase.phaseDefinitionId])
              : new Set<number>(),
          spec: splitBySpec ? entry.spec ?? null : null,
          totalDesignLength: entry.designLength,
          totalCompletedLength: entry.completedLength,
          latestUpdatedAt: updatedAt,
          roadNames: new Set([road.name]),
          roadBreakdown: new Map([
            [
              road.id,
              {
                roadId: road.id,
                roadSlug: road.slug,
                roadName: road.name,
                roadLabels: road.labels,
                designLength: entry.designLength,
                completedLength: entry.completedLength,
                latestUpdatedAt: updatedAt,
              },
            ],
          ]),
        })
      })
    })
  })

  const sorted = Array.from(map.values())
    .map((item) => {
      const designTotal = Math.max(0, item.totalDesignLength)
      const completedTotal = Math.max(0, item.totalCompletedLength)
      const cappedCompleted =
        designTotal <= 0 ? completedTotal : Math.min(designTotal, completedTotal)
      const percent =
        designTotal <= 0
          ? 0
          : Math.min(100, Math.round((cappedCompleted / designTotal) * 100))
      const measure =
        item.measures.size === 1
          ? Array.from(item.measures)[0]
          : item.measures.has('LINEAR')
            ? 'LINEAR'
            : 'POINT'
      const roadBreakdown: AggregatedPhaseRoadBreakdown[] = Array.from(item.roadBreakdown.values())
        .map((road) => {
          const roadDesign = Math.max(0, road.designLength)
          const roadCompletedRaw = Math.max(0, road.completedLength)
          const roadCompleted = roadDesign <= 0 ? roadCompletedRaw : Math.min(roadDesign, roadCompletedRaw)
          const roadRemaining = Math.max(roadDesign - roadCompleted, 0)
          const roadPercent =
            roadDesign <= 0
              ? 0
              : Math.min(100, Math.round((roadCompleted / roadDesign) * 100))
          return {
            roadId: road.roadId,
            roadSlug: road.roadSlug,
            roadName: road.roadName,
            roadLabels: road.roadLabels,
            designLength: Math.round(roadDesign * 100) / 100,
            completedLength: Math.round(roadCompleted * 100) / 100,
            remainingLength: Math.round(roadRemaining * 100) / 100,
            completedPercent: roadPercent,
            latestUpdatedAt: road.latestUpdatedAt,
          }
        })
        .sort((left, right) =>
          resolveRoadName(
            {
              slug: left.roadSlug,
              name: left.roadName,
              labels: left.roadLabels,
            },
            locale,
          ).localeCompare(
            resolveRoadName(
              {
                slug: right.roadSlug,
                name: right.roadName,
                labels: right.roadLabels,
              },
              locale,
            ),
            formatLocaleId(locale),
          ),
        )
      const definitionId =
        item.definitionIds.size === 1 ? Array.from(item.definitionIds)[0] : undefined
      return {
        id: item.id,
        name: item.name,
        measure,
        totalDesignLength: Math.round(designTotal * 100) / 100,
        totalCompletedLength: Math.round(cappedCompleted * 100) / 100,
        completedPercent: percent,
        latestUpdatedAt: item.latestUpdatedAt,
        roadNames: roadBreakdown.map((road) => road.roadName),
        roadBreakdown,
        spec: item.spec ?? null,
        phaseDefinitionId: definitionId,
      } satisfies AggregatedPhaseProgress
    })
    .sort((a, b) => {
      if (b.latestUpdatedAt !== a.latestUpdatedAt) {
        return b.latestUpdatedAt - a.latestUpdatedAt
      }
      const nameComparison = a.name.localeCompare(b.name, formatLocaleId(locale))
      if (nameComparison !== 0) {
        return nameComparison
      }
      const specA = a.spec ?? ''
      const specB = b.spec ?? ''
      return specA.localeCompare(specB, formatLocaleId(locale))
    })

  return sorted
}
