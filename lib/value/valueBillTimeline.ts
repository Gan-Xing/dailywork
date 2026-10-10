export type ValueBillWorkStage =
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'NOT_STARTED'
  | 'SKIPPED'
  | 'UNKNOWN'

export type ValueBillTimelineRecord = {
  recordId: string
  status: string
  note?: string | null
  pkStart?: string | null
  pkEnd?: string | null
  source?: unknown
  data?: unknown
}

export type ValueBillAlignment = 'MAINLINE' | 'AMORCE'
export type ValueBillIssueConfirmation = 'CONFIRMED' | 'PENDING'
export type ValueBillMeasurementState = 'MEASURED' | 'UNMEASURED' | 'UNCLEAR'
export type ValueBillMeasurementPeriod = 'PREVIOUS' | 'ATTACHMENT_6' | 'BOTH' | 'UNCLEAR'
export type ValueBillReviewConclusion = 'NORMAL' | 'TO_MEASURE' | 'ISSUE' | 'PENDING'

export type ValueBillTimelineSpan = {
  start: number
  end: number
  startLabel: string
  endLabel: string
  isPoint: boolean
}

export type ValueBillTimelineCoverage = {
  merged: Array<{ start: number; end: number }>
  gaps: Array<{ start: number; end: number; length: number }>
  coveredLength: number
  coverageRatio: number
}

export type ValueBillViewport = {
  start: number
  end: number
}

export const asValueBillObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const readValueBillText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export const parseValueBillPk = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const normalized = value.trim().toUpperCase().replace(',', '.')
  if (!normalized) return null

  const pkMatch = normalized.match(/(?:PK\s*)?(\d+)\s*\+\s*(\d+(?:\.\d+)?)/)
  if (pkMatch) {
    const kilometres = Number(pkMatch[1])
    const metres = Number(pkMatch[2])
    if (Number.isFinite(kilometres) && Number.isFinite(metres)) {
      return kilometres * 1000 + metres
    }
  }

  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

export const formatValueBillPk = (value: number) => {
  const normalized = Math.max(0, value)
  const kilometres = Math.floor(normalized / 1000)
  const metres = normalized - kilometres * 1000
  const rounded = Math.round(metres * 100) / 100
  const [whole, decimal] = rounded.toFixed(2).split('.')
  const metreLabel = whole.padStart(3, '0')
  const decimalLabel = decimal === '00' ? '' : `.${decimal.replace(/0+$/, '')}`
  return `PK${kilometres}+${metreLabel}${decimalLabel}`
}

export const getValueBillAlignment = (
  record: ValueBillTimelineRecord,
): ValueBillAlignment => {
  const data = asValueBillObject(record.data)
  const source = asValueBillObject(record.source)
  const raw = asValueBillObject(source.raw)
  const cells = asValueBillObject(raw.cells)
  const typeCell = asValueBillObject(cells.D)
  const type = readValueBillText(
    data.type,
    data.recordType,
    data.rawType,
    typeCell.value,
  ) ?? ''
  return /amorce|平交/i.test(type) ? 'AMORCE' : 'MAINLINE'
}

export const clampValueBillViewport = (
  requested: ValueBillViewport,
  domain: ValueBillViewport,
  minimumLength = 20,
): ValueBillViewport => {
  const domainStart = Math.min(domain.start, domain.end)
  const domainEnd = Math.max(domain.start, domain.end)
  const domainLength = Math.max(1, domainEnd - domainStart)
  const requestedStart = Math.min(requested.start, requested.end)
  const requestedEnd = Math.max(requested.start, requested.end)
  const length = Math.min(
    domainLength,
    Math.max(Math.min(minimumLength, domainLength), requestedEnd - requestedStart),
  )
  const center = (requestedStart + requestedEnd) / 2
  let start = center - length / 2
  let end = center + length / 2

  if (start < domainStart) {
    start = domainStart
    end = domainStart + length
  }
  if (end > domainEnd) {
    end = domainEnd
    start = domainEnd - length
  }

  return { start, end }
}

export const zoomValueBillViewport = (
  viewport: ValueBillViewport,
  factor: number,
  anchor: number,
  domain: ValueBillViewport,
  minimumLength = 20,
) => {
  const length = Math.max(1, viewport.end - viewport.start)
  const anchorRatio = Math.max(0, Math.min(1, (anchor - viewport.start) / length))
  const nextLength = length * Math.max(0.01, factor)
  return clampValueBillViewport({
    start: anchor - nextLength * anchorRatio,
    end: anchor + nextLength * (1 - anchorRatio),
  }, domain, minimumLength)
}

export const getValueBillTimelineSpan = (
  record: ValueBillTimelineRecord,
): ValueBillTimelineSpan | null => {
  const data = asValueBillObject(record.data)
  const segment = asValueBillObject(data.segment)
  const source = asValueBillObject(record.source)
  const raw = asValueBillObject(source.raw)
  const cells = asValueBillObject(raw.cells)
  const pkCell = asValueBillObject(cells.E)

  const startRaw = readValueBillText(
    record.pkStart,
    data.pkStart,
    segment.pkStart,
    data.originalPkStart,
    data.correctedPkStart,
  )
  const endRaw = readValueBillText(
    record.pkEnd,
    data.pkEnd,
    segment.pkEnd,
    data.originalPkEnd,
    data.correctedPkEnd,
  )
  const pointRaw = readValueBillText(
    data.pk,
    data.chainage,
    getValueBillAlignment(record) === 'AMORCE' ? pkCell.value : null,
  )

  const parsedStart = parseValueBillPk(startRaw)
  const parsedEnd = parseValueBillPk(endRaw)
  const parsedPoint = parseValueBillPk(pointRaw)

  if (parsedStart !== null || parsedEnd !== null) {
    const first = parsedStart ?? parsedEnd
    const second = parsedEnd ?? parsedStart
    if (first === null || second === null) return null
    const start = Math.min(first, second)
    const end = Math.max(first, second)
    return {
      start,
      end,
      startLabel: startRaw ?? formatValueBillPk(start),
      endLabel: endRaw ?? formatValueBillPk(end),
      isPoint: start === end,
    }
  }

  if (parsedPoint !== null) {
    const pointLabel = pointRaw?.includes('+') ? pointRaw : formatValueBillPk(parsedPoint)
    return {
      start: parsedPoint,
      end: parsedPoint,
      startLabel: pointLabel,
      endLabel: pointLabel,
      isPoint: true,
    }
  }

  return null
}

const normalizeStage = (value: string | null) => value?.trim().toUpperCase().replace(/\s+/g, '_') ?? ''

export const deriveValueBillWorkStage = (
  record: ValueBillTimelineRecord,
): ValueBillWorkStage => {
  const data = asValueBillObject(record.data)
  const explicit = normalizeStage(readValueBillText(data.workStatus, data.constructionStatus))

  if (['COMPLETED', 'COMPLETE', '已完成'].includes(explicit)) return 'COMPLETED'
  if (['IN_PROGRESS', 'CONSTRUCTED', '已施工', '施工中'].includes(explicit)) return 'IN_PROGRESS'
  if (['NOT_STARTED', '未施工'].includes(explicit)) return 'NOT_STARTED'
  if (['SKIPPED', '跳过'].includes(explicit)) return 'SKIPPED'

  const measurementStatus = readValueBillText(data.measurementStatus) ?? ''
  const period = readValueBillText(data.period, data.measurementPeriodZh) ?? ''
  const type = readValueBillText(data.type, data.recordType) ?? ''

  if (
    measurementStatus.includes('未计量')
    || type.includes('未计量')
    || record.recordId.toUpperCase().includes('UNMEASURED')
  ) {
    return 'IN_PROGRESS'
  }

  if (
    measurementStatus.includes('已计量')
    || measurementStatus.includes('已确认')
    || period.includes('计量')
  ) {
    return 'COMPLETED'
  }

  if (record.status === 'CONFIRMED' && getValueBillTimelineSpan(record)) {
    return 'COMPLETED'
  }

  return 'UNKNOWN'
}

export const getValueBillMeasurementLabel = (record: ValueBillTimelineRecord) => {
  const data = asValueBillObject(record.data)
  const measurementStatus = readValueBillText(data.measurementStatus)
  const period = readValueBillText(data.period, data.measurementPeriodZh)

  if (measurementStatus?.includes('未计量')) return '未计量'
  if (period === '以前已计量') return '以前已计量'
  if (period === '本期计量') return '第六期计量'
  if (period === '以前+本期') return '以前及第六期'
  if (measurementStatus === '本期计量') return '第六期计量'
  if (measurementStatus === '已确认') return '已计量'
  if (measurementStatus) return measurementStatus
  if (period) return period
  return '计量期次未明确'
}

export const isValueBillUnmeasured = (record: ValueBillTimelineRecord) =>
  getValueBillMeasurementLabel(record) === '未计量'

export const getValueBillMeasurementState = (
  record: ValueBillTimelineRecord,
): ValueBillMeasurementState => {
  const label = getValueBillMeasurementLabel(record)
  if (label === '未计量') return 'UNMEASURED'
  if (label.includes('计量') && !label.includes('未明确')) return 'MEASURED'
  return 'UNCLEAR'
}

export const getValueBillMeasurementPeriod = (
  record: ValueBillTimelineRecord,
): ValueBillMeasurementPeriod => {
  const label = getValueBillMeasurementLabel(record)
  if (label === '以前及第六期') return 'BOTH'
  if (label === '以前已计量') return 'PREVIOUS'
  if (label === '第六期计量') return 'ATTACHMENT_6'
  return 'UNCLEAR'
}

export const getValueBillIssueConfirmation = (
  record: ValueBillTimelineRecord,
): ValueBillIssueConfirmation => {
  if (record.status === 'CONFIRMED') return 'CONFIRMED'

  const data = asValueBillObject(record.data)
  if (data.userConfirmed === false) return 'PENDING'

  const confirmationText = [
    data.issueStatusFromIndex,
    data.issueDetail,
    data.userJudgement,
    data.confirmationNote,
    'note' in record ? record.note : null,
  ].filter((value): value is string => typeof value === 'string').join(' ')

  if (
    data.userConfirmed === true
    || Boolean(readValueBillText(data.confirmedAt))
    || confirmationText.toUpperCase().includes('CONFIRMED')
    || /用户(?:最终)?确认|用户更正|用户要求/.test(confirmationText)
  ) {
    return 'CONFIRMED'
  }

  return 'PENDING'
}

export const getValueBillReviewConclusion = (
  record: ValueBillTimelineRecord,
): ValueBillReviewConclusion => {
  if (getValueBillIssueConfirmation(record) === 'PENDING') return 'PENDING'
  if (getValueBillMeasurementState(record) === 'UNMEASURED') return 'TO_MEASURE'
  return record.status === 'CONFIRMED' ? 'NORMAL' : 'ISSUE'
}

export const getValueBillStructureLabel = (record: ValueBillTimelineRecord) => {
  const data = asValueBillObject(record.data)
  const structure = readValueBillText(
    data.component,
    data.structureType,
    data.type,
    data.recordType,
  )
  const spec = readValueBillText(data.spec)
  return [structure, spec].filter(Boolean).join(' · ') || '计量记录'
}

export const getValueBillTimelineCoverage = (
  spans: ValueBillTimelineSpan[],
  domainStart: number,
  domainEnd: number,
): ValueBillTimelineCoverage => {
  const start = Math.min(domainStart, domainEnd)
  const end = Math.max(domainStart, domainEnd)
  const domainLength = Math.max(0, end - start)
  const intervals = spans
    .filter((span) => !span.isPoint && span.end > start && span.start < end)
    .map((span) => ({
      start: Math.max(start, span.start),
      end: Math.min(end, span.end),
    }))
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start || left.end - right.end)

  const merged: Array<{ start: number; end: number }> = []
  intervals.forEach((interval) => {
    const previous = merged.at(-1)
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      return
    }
    previous.end = Math.max(previous.end, interval.end)
  })

  const gaps: Array<{ start: number; end: number; length: number }> = []
  let cursor = start
  merged.forEach((interval) => {
    if (interval.start > cursor) {
      gaps.push({
        start: cursor,
        end: interval.start,
        length: interval.start - cursor,
      })
    }
    cursor = Math.max(cursor, interval.end)
  })
  if (cursor < end) {
    gaps.push({
      start: cursor,
      end,
      length: end - cursor,
    })
  }

  const coveredLength = merged.reduce(
    (total, interval) => total + interval.end - interval.start,
    0,
  )

  return {
    merged,
    gaps,
    coveredLength,
    coverageRatio: domainLength > 0 ? coveredLength / domainLength : 0,
  }
}
