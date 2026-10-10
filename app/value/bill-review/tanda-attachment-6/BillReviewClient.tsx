'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { ValueBillReviewDto, ValueBillReviewRecordDto } from '@/lib/server/valueBillReviewStore'
import { getValueBillStructureComponent } from '@/lib/value/valueBillStructure'
import {
  asValueBillObject,
  clampValueBillViewport,
  deriveValueBillWorkStage,
  formatValueBillPk,
  getValueBillAlignment,
  getValueBillIssueConfirmation,
  getValueBillMeasurementLabel,
  getValueBillMeasurementPeriod,
  getValueBillMeasurementState,
  getValueBillReviewConclusion,
  getValueBillStructureLabel,
  getValueBillTimelineCoverage,
  getValueBillTimelineSpan,
  parseValueBillPk,
  readValueBillText,
  type ValueBillTimelineCoverage,
  type ValueBillTimelineSpan,
  type ValueBillAlignment,
  type ValueBillViewport,
  type ValueBillWorkStage,
  zoomValueBillViewport,
} from '@/lib/value/valueBillTimeline'

type Props = {
  review: ValueBillReviewDto | null
}

type StructureIdentity = {
  key: string
  label: string
  shortLabel: string
  color: string
}

type CorridorItem = {
  record: ValueBillReviewRecordDto
  span: ValueBillTimelineSpan
  stage: ValueBillWorkStage
  alignment: ValueBillAlignment
  measurementLabel: string
  structure: StructureIdentity
}

type DesignIntervalItem = {
  id: number
  sideCode: string
  start: number
  end: number
  phaseName: string
  spec: string | null
  quantity: number | null
  structure: StructureIdentity
}

type ConstructionIntervalItem = {
  id: string
  sideCode: string
  start: number
  end: number
  phaseName: string
  spec: string | null
  workStatus: 'COMPLETED' | 'IN_PROGRESS'
  sourceStatus: string
  structure: StructureIdentity
}

type SegmentDetail = {
  key: string
  source: 'DESIGN' | 'CONSTRUCTION' | 'MEASUREMENT'
  sourceLabel: string
  title: string
  range: string
  sideLabel: string
  statusLabel: string
  color: string
  fields: Array<[string, string]>
  note?: string | null
  recordId?: string
}

type HoveredSegment = {
  detail: SegmentDetail
  x: number
  y: number
}

type SideCode = 'CG' | 'CD' | 'X'
type IssueSortKey =
  | 'status'
  | 'structure'
  | 'boq'
  | 'side'
  | 'pk'
  | 'quantity'
  | 'unitPrice'
  | 'amount'
  | 'formula'
  | 'note'
type SortDirection = 'asc' | 'desc'

const measurementStateLabels: Record<string, string> = {
  MEASURED: '已计量',
  UNMEASURED: '未计量',
  UNCLEAR: '未明确',
}

const measurementPeriodLabels: Record<string, string> = {
  PREVIOUS: '以前已计量',
  ATTACHMENT_6: '第六期计量',
  BOTH: '以前及第六期',
  UNCLEAR: '未明确',
}

const reviewConclusionLabels: Record<string, string> = {
  NORMAL: '正常',
  TO_MEASURE: '待计量',
  ISSUE: '有问题',
  PENDING: '待进一步确认',
}

const getConfirmationLabel = (record: ValueBillReviewRecordDto) =>
  getValueBillIssueConfirmation(record) === 'CONFIRMED' ? '已确认' : '待确认'

const getConfirmationBadgeClass = (record: ValueBillReviewRecordDto) =>
  getValueBillIssueConfirmation(record) === 'CONFIRMED'
    ? 'border-emerald-700/20 bg-emerald-100 text-emerald-900'
    : 'border-amber-700/20 bg-amber-100 text-amber-950'

const sideLabels: Record<string, string> = {
  CG: '左侧',
  CD: '右侧',
  X: '中间',
  'D/G': '左右侧',
  UNSPECIFIED: '侧别未明确',
}

const structureDefaults: Record<string, { component: string; spec: string; color: string }> = {
  '401J1': { component: '边沟', spec: '50×50', color: '#8dc7d7' },
  '401J4': { component: '边沟', spec: '60×60', color: '#e8c85d' },
  '401J7': { component: '边沟', spec: '80×60', color: '#72b59d' },
  '401J8': { component: '边沟', spec: '80×80', color: '#4c8fc4' },
  '401J10': { component: '边沟', spec: '100×100', color: '#d98946' },
  '403E3': { component: '过道涵', spec: '80×60', color: '#ec8e62' },
  '403E4': { component: '过道涵', spec: '80×80', color: '#c16c9b' },
  '403E5': { component: '过道涵', spec: '100×100', color: '#d45555' },
}

const fallbackPalette = ['#72b59d', '#9c8bc5', '#d49d55', '#699fc8', '#bd7a68', '#83a65c']

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value)
}

const formatFcfa = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`
}

const formatPercent = (value: number) => `${Math.round(value * 1000) / 10}%`

const uniqueOptions = (
  records: ValueBillReviewRecordDto[],
  read: (record: ValueBillReviewRecordDto) => string | null,
) => Array.from(new Set(records.map(read).filter((value): value is string => Boolean(value))))
  .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))

const getRecordSideCode = (record: ValueBillReviewRecordDto) => {
  const data = asValueBillObject(record.data)
  const side = asValueBillObject(data.side)
  return readValueBillText(record.sideCode, side.code, data.sideCode, data.side) ?? 'UNSPECIFIED'
}

const getRecordSideLabel = (record: ValueBillReviewRecordDto) => {
  const code = getRecordSideCode(record)
  return record.sideZh ?? sideLabels[code] ?? code
}

const getPkRange = (record: ValueBillReviewRecordDto) => {
  const span = getValueBillTimelineSpan(record)
  if (!span) return '桩号未明确'
  if (span.isPoint) return span.startLabel
  return `${span.startLabel} - ${span.endLabel}`
}

const normalizeSpec = (value: string) => value
  .replace(/[xX*]/g, '×')
  .replace(/\s+/g, '')

const hashText = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

const getStructureIdentity = (record: ValueBillReviewRecordDto): StructureIdentity => {
  const data = asValueBillObject(record.data)
  const code = record.boqCode ?? ''
  const fallback = structureDefaults[code]
  const component = readValueBillText(data.component, data.structureType, fallback?.component)
    ?? getValueBillStructureLabel(record)
  const rawSpec = readValueBillText(data.spec, fallback?.spec)
  const spec = rawSpec ? normalizeSpec(rawSpec) : null
  const key = [component, spec].filter(Boolean).join('-')
  const label = [component, spec].filter(Boolean).join(' ')
  const color = fallback?.color ?? fallbackPalette[hashText(key) % fallbackPalette.length]
  return {
    key,
    label: label || '结构物',
    shortLabel: spec ?? component,
    color,
  }
}

const getIssueStructureLabel = (record: ValueBillReviewRecordDto) => {
  const data = asValueBillObject(record.data)
  const component = readValueBillText(data.component, data.structure, data.structureType)
  const spec = readValueBillText(data.spec)
  return [component, spec].filter(Boolean).join(' ')
    || record.boqNameZh
    || record.boqNameFr
    || getValueBillStructureLabel(record)
}

const getIssueSourceRows = (record: ValueBillReviewRecordDto) => {
  const data = asValueBillObject(record.data)
  const rows = Array.isArray(data.rows)
    ? data.rows.filter((value): value is number => typeof value === 'number')
    : []
  if (rows.length) return `Excel 行 ${rows.join('、')}`
  return record.sourceExcelRow ? `Excel 行 ${record.sourceExcelRow}` : null
}

const getDesignStructureIdentity = (phaseName: string, rawSpec: string | null) => {
  const component = getValueBillStructureComponent(phaseName)
  const spec = rawSpec ? normalizeSpec(rawSpec) : null
  const matching = Object.values(structureDefaults).find((candidate) =>
    candidate.component === component && normalizeSpec(candidate.spec) === spec)
  const key = [component, spec].filter(Boolean).join('-')
  return {
    key,
    label: [phaseName, spec].filter(Boolean).join(' '),
    shortLabel: spec ?? phaseName,
    color: matching?.color ?? fallbackPalette[hashText(key) % fallbackPalette.length],
  }
}

const getMeasurementSegmentDetail = (item: CorridorItem): SegmentDetail => {
  const conclusion = getValueBillReviewConclusion(item.record)
  return {
    key: `measurement-${item.record.recordId}`,
    source: 'MEASUREMENT',
    sourceLabel: '第六期计量',
    title: item.structure.label,
    range: getPkRange(item.record),
    sideLabel: getRecordSideLabel(item.record),
    statusLabel: getConfirmationLabel(item.record),
    color: item.structure.color,
    recordId: item.record.recordId,
    fields: [
      ['记录类型', item.alignment === 'AMORCE' ? '平交路口（Amorce）' : '主线'],
      ['计量状态', item.measurementLabel],
      ['核对状态', getConfirmationLabel(item.record)],
      ['核对结论', reviewConclusionLabels[conclusion]],
      ['价号', item.record.boqCode ?? '未明确'],
      ['数量', `${formatNumber(item.record.quantity)} ${item.record.unit ?? ''}`.trim()],
      ['Excel 行', String(item.record.sourceExcelRow ?? '—')],
    ],
    note: item.record.note,
  }
}

const getDesignSegmentDetail = (
  item: DesignIntervalItem,
  sideCode: SideCode,
): SegmentDetail => ({
  key: `design-${sideCode}-${item.id}`,
  source: 'DESIGN',
  sourceLabel: '设计区间',
  title: item.structure.label,
  range: `${formatValueBillPk(item.start)} - ${formatValueBillPk(item.end)}`,
  sideLabel: `${sideLabels[sideCode]} ${sideCode}`,
  statusLabel: '设计范围',
  color: item.structure.color,
  fields: [
    ['记录类型', '主线'],
    ['结构物', item.structure.label],
    ['设计长度', `${formatNumber(item.end - item.start)} m`],
    ['设计计量值', item.quantity === null ? '未填写' : formatNumber(item.quantity)],
    ['数据来源', 'DailyWork 分项设计区间'],
  ],
})

const getConstructionSegmentDetail = (
  item: ConstructionIntervalItem,
  sideCode: SideCode,
): SegmentDetail => ({
  key: `construction-${sideCode}-${item.id}`,
  source: 'CONSTRUCTION',
  sourceLabel: '施工 / 验收',
  title: item.structure.label,
  range: `${formatValueBillPk(item.start)} - ${formatValueBillPk(item.end)}`,
  sideLabel: `${sideLabels[sideCode]} ${sideCode}`,
  statusLabel: item.workStatus === 'COMPLETED' ? '已完成验收' : '已施工待验收',
  color: item.workStatus === 'COMPLETED' ? '#62c694' : '#e7b64f',
  fields: [
    ['记录类型', '主线'],
    ['施工状态', item.workStatus === 'COMPLETED' ? '已完成验收' : '已施工待验收'],
    ['结构物', item.structure.label],
    ['施工长度', `${formatNumber(item.end - item.start)} m`],
    ['系统状态', item.sourceStatus],
    ['数据来源', 'DailyWork 报检与验收记录'],
  ],
})

const toCorridorItems = (records: ValueBillReviewRecordDto[]) => records.flatMap((record) => {
  const span = getValueBillTimelineSpan(record)
  if (!span) return []
  return [{
    record,
    span,
    stage: deriveValueBillWorkStage(record),
    alignment: getValueBillAlignment(record),
    measurementLabel: getValueBillMeasurementLabel(record),
    structure: getStructureIdentity(record),
  }]
})

const getIssueRecordDetail = (record: ValueBillReviewRecordDto): SegmentDetail => {
  const identity = getStructureIdentity(record)
  const confirmation = getValueBillIssueConfirmation(record)
  const measurementState = getValueBillMeasurementState(record)
  const conclusion = getValueBillReviewConclusion(record)
  return {
    key: `issue-${record.recordId}`,
    source: 'MEASUREMENT',
    sourceLabel: '计量核对清单',
    title: getIssueStructureLabel(record),
    range: getPkRange(record),
    sideLabel: getRecordSideLabel(record),
    statusLabel: confirmation === 'CONFIRMED' ? '已确认' : '待确认',
    color: identity.color,
    recordId: record.recordId,
    fields: [
      ['道路', record.roadZh ?? record.roadRaw ?? '未明确'],
      ['确认状态', confirmation === 'CONFIRMED' ? '已确认' : '待确认'],
      ['计量状态', measurementStateLabels[measurementState]],
      ['计量期次', getValueBillMeasurementLabel(record)],
      ['核对结论', reviewConclusionLabels[conclusion]],
      ['价号', record.boqCode ?? '未明确'],
      ['数量', `${formatNumber(record.quantity)} ${record.unit ?? ''}`.trim()],
      ['数据位置', getIssueSourceRows(record) ?? '未记录 Excel 行'],
    ],
    note: record.note,
  }
}

const groupCorridorItemsBySide = (items: CorridorItem[]) => {
  const grouped: Record<SideCode, CorridorItem[]> = { CG: [], CD: [], X: [] }
  items.forEach((item) => {
    const code = getRecordSideCode(item.record)
    if (code === 'D/G') {
      grouped.CG.push(item)
      grouped.CD.push(item)
    } else if (code === 'CG' || code === 'CD' || code === 'X') {
      grouped[code].push(item)
    }
  })
  return grouped
}

const isStructureCorridorRecord = (record: ValueBillReviewRecordDto) => {
  const code = record.boqCode ?? ''
  if (/^(401J|403E)/i.test(code)) return true
  const data = asValueBillObject(record.data)
  const component = readValueBillText(data.component, data.structureType) ?? ''
  return component.includes('边沟') || component.includes('过道涵')
}

const readSearchText = (record: ValueBillReviewRecordDto) => [
  record.recordId,
  record.status,
  record.issueId,
  record.boqCode,
  record.boqNameZh,
  record.boqNameFr,
  record.roadZh,
  record.roadRaw,
  getRecordSideCode(record),
  getRecordSideLabel(record),
  getPkRange(record),
  getValueBillAlignment(record) === 'AMORCE' ? '平交路口 Amorce' : '主线',
  getStructureIdentity(record).label,
  getValueBillMeasurementLabel(record),
  record.formula,
  record.note,
  record.sourceExcelRow,
].filter(Boolean).join(' ').toLowerCase()

const readIssueSearchText = (record: ValueBillReviewRecordDto) => [
  readSearchText(record),
  getIssueStructureLabel(record),
  getIssueSourceRows(record),
  getValueBillIssueConfirmation(record) === 'CONFIRMED' ? '已确认' : '待确认',
  measurementStateLabels[getValueBillMeasurementState(record)],
  measurementPeriodLabels[getValueBillMeasurementPeriod(record)],
  reviewConclusionLabels[getValueBillReviewConclusion(record)],
].filter(Boolean).join(' ').toLowerCase()

const packCorridorItems = (items: CorridorItem[]) => {
  const lanes: CorridorItem[][] = []
  const laneEnds: number[] = []
  const ordered = [...items].sort((left, right) =>
    left.span.start - right.span.start
    || left.span.end - right.span.end
    || left.record.recordId.localeCompare(right.record.recordId))

  ordered.forEach((item) => {
    const collisionEnd = item.span.isPoint ? item.span.end + 4 : item.span.end
    const laneIndex = laneEnds.findIndex((end) => end <= item.span.start)
    if (laneIndex === -1) {
      lanes.push([item])
      laneEnds.push(collisionEnd)
      return
    }
    lanes[laneIndex].push(item)
    laneEnds[laneIndex] = collisionEnd
  })

  return lanes.length ? lanes : [[]]
}

const filterControlClass =
  'h-11 w-full rounded-none border border-[#c9c2af] bg-[#faf8f1] px-3 text-sm font-semibold text-[#25302b] outline-none transition focus:border-[#1d6650] focus:ring-2 focus:ring-[#1d6650]/15'

const selectLabelClass =
  'flex min-w-0 flex-col gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#6e6a5e]'

const unmeasuredPattern: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(255,255,255,.38) 0, rgba(255,255,255,.38) 4px, transparent 4px, transparent 8px)',
}

const gapPattern: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(235,196,105,.16) 0, rgba(235,196,105,.16) 5px, transparent 5px, transparent 10px)',
}

const Metric = ({
  label,
  value,
  tone = 'text-white',
  helper,
}: {
  label: string
  value: string | number
  tone?: string
  helper?: string
}) => (
  <div className="border-l border-white/20 pl-4">
    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#adbbb5]">{label}</div>
    <div className={`mt-1 font-mono text-3xl font-black tracking-tight ${tone}`}>{value}</div>
    {helper ? <div className="mt-1 text-[10px] font-semibold text-[#80938a]">{helper}</div> : null}
  </div>
)

const SortableIssueHeader = ({
  label,
  sortKey,
  activeKey,
  direction,
  align = 'left',
  onSort,
}: {
  label: string
  sortKey: IssueSortKey
  activeKey: IssueSortKey
  direction: SortDirection
  align?: 'left' | 'right'
  onSort: (key: IssueSortKey) => void
}) => (
  <th
    aria-sort={activeKey === sortKey ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}
  >
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-[#9f3f2f] ${
        align === 'right' ? 'justify-end' : ''
      }`}
    >
      {label}
      <span aria-hidden="true" className={activeKey === sortKey ? 'text-[#9f3f2f]' : 'text-[#9e968b]'}>
        {activeKey === sortKey ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  </th>
)

const MultiSelectIssueFilter = ({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (values: string[]) => void
}) => (
  <div className={selectLabelClass}>
    {label}
    <details className="group relative">
      <summary className={`${filterControlClass} flex cursor-pointer list-none items-center justify-between`}>
        <span>{selected.length ? `已选 ${selected.length} 项` : `全部${label}`}</span>
        <span className="text-xs transition group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="absolute left-0 z-40 mt-1 max-h-72 min-w-full overflow-y-auto border border-[#b9b19d] bg-[#faf8f1] p-2 shadow-[4px_4px_0_#b9b19d]">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#ddd5c4] px-2 pb-2 text-[10px] font-bold normal-case tracking-normal text-[#777064]">
          <span>未选择表示全部</span>
          {selected.length ? (
            <button type="button" onClick={() => onChange([])} className="font-black text-[#8a3427]">
              清空
            </button>
          ) : null}
        </div>
        {options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 px-2 py-2 text-xs font-bold normal-case tracking-normal hover:bg-[#eee6d7]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(
                  checked
                    ? selected.filter((value) => value !== option.value)
                    : [...selected, option.value],
                )}
                className="h-4 w-4 accent-[#8a3427]"
              />
              <span className="whitespace-nowrap">{option.label}</span>
            </label>
          )
        })}
      </div>
    </details>
  </div>
)

const StructureLegend = ({ structures }: { structures: StructureIdentity[] }) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
    {structures.map((structure) => (
      <span key={structure.key} className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
        <span className="h-3 w-8" style={{ backgroundColor: structure.color }} />
        {structure.label}
      </span>
    ))}
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border border-[#f7cb68] bg-[#34413c]" style={unmeasuredPattern} />
      已施工未计量
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border-2 border-[#ff655b]" />
      审核有问题
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border-2 border-dashed border-[#76c7e8]" />
      账单原始待核对
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border border-white/70 bg-[#72b59d]" />
      设计区间
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 bg-[#62c694]" />
      已完成验收
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border border-[#e7b64f] bg-[#34413c]" style={unmeasuredPattern} />
      已施工待验收
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 border border-[#f0a85d] bg-[#3a2a1d]" />
      平交路口 Amorce 独立轨道
    </span>
    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d9e2de]">
      <span className="h-3 w-8 bg-[#3b4742]" style={gapPattern} />
      无设计区间
    </span>
  </div>
)

type SegmentInteractionProps = {
  activeKey: string | null
  onOpen: (detail: SegmentDetail) => void
  onHover: (detail: SegmentDetail, event: ReactMouseEvent<HTMLElement>) => void
  onLeave: () => void
}

const BaselineSegment = ({
  start,
  end,
  domain,
  detail,
  color,
  pattern,
  label,
  activeKey,
  onOpen,
  onHover,
  onLeave,
}: {
  start: number
  end: number
  domain: { start: number; end: number; length: number }
  detail: SegmentDetail
  color: string
  pattern?: CSSProperties
  label: string
} & SegmentInteractionProps) => {
  const left = ((start - domain.start) / domain.length) * 100
  const width = ((end - start) / domain.length) * 100
  return (
    <button
      type="button"
      onClick={() => onOpen(detail)}
      onMouseEnter={(event) => onHover(detail, event)}
      onMouseMove={(event) => onHover(detail, event)}
      onMouseLeave={onLeave}
      aria-label={`查看${detail.sourceLabel} ${detail.title} ${detail.range}`}
      data-segment-source={detail.source}
      className={`absolute inset-y-1 z-10 overflow-hidden whitespace-nowrap border border-white/35 px-1 text-left font-mono text-[9px] font-black text-[#14211b] hover:z-30 hover:brightness-110 ${
        activeKey === detail.key ? 'ring-2 ring-white ring-offset-1 ring-offset-[#17241e]' : ''
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: '4px',
        backgroundColor: color,
        ...pattern,
      }}
    >
      {width > 5 ? label : ''}
    </button>
  )
}

type CorridorSegmentProps = {
  item: CorridorItem
  domain: { start: number; end: number; length: number }
  selected: boolean
  compact?: boolean
} & SegmentInteractionProps

const CorridorSegment = ({
  item,
  domain,
  selected,
  onOpen,
  onHover,
  onLeave,
  compact = false,
}: CorridorSegmentProps) => {
  const left = ((item.span.start - domain.start) / domain.length) * 100
  const width = ((item.span.end - item.span.start) / domain.length) * 100
  const isUnmeasured = item.measurementLabel === '未计量' || item.stage === 'IN_PROGRESS'
  const conclusion = getValueBillReviewConclusion(item.record)
  const hasProblem = conclusion === 'ISSUE'
  const isPending = conclusion === 'PENDING'
  const detail = getMeasurementSegmentDetail(item)
  const style: CSSProperties = item.span.isPoint
    ? {
        left: `${left}%`,
        width: compact ? '7px' : '10px',
        transform: 'translateX(-50%)',
        backgroundColor: item.structure.color,
        ...(isUnmeasured ? unmeasuredPattern : {}),
      }
    : {
        left: `${left}%`,
        width: `${width}%`,
        minWidth: '4px',
        backgroundColor: item.structure.color,
        ...(isUnmeasured ? unmeasuredPattern : {}),
      }

  return (
    <button
      type="button"
      onClick={() => onOpen(detail)}
      onMouseEnter={(event) => onHover(detail, event)}
      onMouseMove={(event) => onHover(detail, event)}
      onMouseLeave={onLeave}
      aria-label={`查看 ${item.record.recordId}`}
      data-segment-source="MEASUREMENT"
      data-segment-alignment={item.alignment}
      className={`absolute inset-y-0 z-10 overflow-hidden whitespace-nowrap border-y border-black/20 px-1 text-left font-mono text-[9px] font-black text-[#16211c] transition hover:z-30 hover:brightness-110 ${
        hasProblem ? 'ring-2 ring-inset ring-[#ff655b]' : ''
      } ${
        isPending ? 'ring-2 ring-inset ring-[#76c7e8]' : ''
      } ${
        selected ? 'z-40 ring-2 ring-white ring-offset-2 ring-offset-[#1b2923]' : ''
      }`}
      style={style}
    >
      {!item.span.isPoint && width > 4 ? item.structure.shortLabel : ''}
      {hasProblem ? <span className="absolute right-0 top-0 h-1.5 w-1.5 bg-[#ff2f25]" /> : null}
      {isPending ? <span className="absolute right-0 top-0 h-1.5 w-1.5 bg-[#37a9d7]" /> : null}
    </button>
  )
}

type SideCorridorProps = {
  side: 'left' | 'right'
  mainlineLanes: CorridorItem[][]
  amorceLanes: CorridorItem[][]
  designItems: DesignIntervalItem[]
  constructionItems: ConstructionIntervalItem[]
  coverage: ValueBillTimelineCoverage
  fullCoverage: ValueBillTimelineCoverage
  domain: { start: number; end: number; length: number }
  ticks: Array<{ label: string; left: string }>
  selectedRecordId: string | null
} & SegmentInteractionProps

const SideCorridor = ({
  side,
  mainlineLanes,
  amorceLanes,
  designItems,
  constructionItems,
  coverage,
  fullCoverage,
  domain,
  ticks,
  selectedRecordId,
  activeKey,
  onOpen,
  onHover,
  onLeave,
}: SideCorridorProps) => {
  const isLeft = side === 'left'
  const orderLanes = (lanes: CorridorItem[][]) => {
    const entries = lanes.map((lane, index) => ({ lane, index }))
    return isLeft ? [...entries].reverse() : entries
  }
  const mainlineEntries = orderLanes(mainlineLanes)
  const amorceEntries = orderLanes(amorceLanes)
  const overlapCount = mainlineLanes.slice(1).reduce((total, lane) => total + lane.length, 0)
    + amorceLanes.slice(1).reduce((total, lane) => total + lane.length, 0)
  const renderMeasurementLanes = (
    entries: Array<{ lane: CorridorItem[]; index: number }>,
    alignment: ValueBillAlignment,
  ) => entries.map(({ lane, index }) => {
    const isBaseLane = index === 0
    return (
      <div
        key={`${side}-${alignment}-lane-${index}`}
        className={`relative mx-0 h-8 overflow-hidden ${
          isBaseLane ? 'bg-[#26362f]' : 'border-y border-dashed border-white/10 bg-[#1d2c25]'
        }`}
      >
        {ticks.map((tick) => (
          <span
            key={tick.label}
            className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/10"
            style={{ left: tick.left }}
          />
        ))}
        {lane.map((item) => (
          <CorridorSegment
            key={`${side}-${alignment}-${index}-${item.record.recordId}`}
            item={item}
            domain={domain}
            selected={selectedRecordId === item.record.recordId}
            activeKey={activeKey}
            onOpen={onOpen}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))}
      </div>
    )
  })

  return (
    <div className="grid grid-cols-[120px_1fr] border-b border-white/10 last:border-b-0 sm:grid-cols-[190px_1fr]">
      <div className="flex flex-col justify-center border-r border-white/10 bg-[#13211b] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 ${isLeft ? 'bg-[#e3c75c]' : 'bg-[#79b5d3]'}`} />
          <span className="text-sm font-black text-white">{isLeft ? '左侧 CG' : '右侧 CD'}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] font-bold text-[#8fa198]">
          全路覆盖 {formatPercent(fullCoverage.coverageRatio)}
        </div>
        <div className="mt-1 text-[10px] font-semibold text-[#687b72]">
          设计缺口 {fullCoverage.gaps.length} 个 · 计量重合 {overlapCount} 个
        </div>
        <div className="mt-3 grid gap-1 text-[9px] font-black text-[#98aaa2]">
          <span><i className="mr-1 inline-block h-2 w-2 bg-[#72b59d]" />01 设计连续线</span>
          <span><i className="mr-1 inline-block h-2 w-2 bg-[#62c694]" />02 施工 / 验收</span>
          <span><i className="mr-1 inline-block h-2 w-2 bg-[#76c7e8]" />03 主线计量</span>
          <span><i className="mr-1 inline-block h-2 w-2 bg-[#f0a85d]" />04 Amorce 计量</span>
        </div>
      </div>

      <div className="bg-[#192720] py-2">
        <div className="relative h-9 overflow-hidden border-y border-white/10 bg-[#35413c]" style={gapPattern}>
          {ticks.map((tick) => (
            <span
              key={`design-tick-${tick.label}`}
              className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/10"
              style={{ left: tick.left }}
            />
          ))}
          {coverage.gaps.map((gap) => {
            const left = ((gap.start - domain.start) / domain.length) * 100
            const width = (gap.length / domain.length) * 100
            if (width < 8) return null
            return (
              <span
                key={`design-gap-${gap.start}-${gap.end}`}
                className="pointer-events-none absolute inset-y-0 flex items-center justify-center overflow-hidden whitespace-nowrap px-2 font-mono text-[9px] font-black text-[#d6c58d]"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                无设计 {Math.round(gap.length * 10) / 10}m
              </span>
            )
          })}
          {designItems.map((item) => (
            <BaselineSegment
              key={`design-${item.id}`}
              start={item.start}
              end={item.end}
              domain={domain}
              detail={getDesignSegmentDetail(item, isLeft ? 'CG' : 'CD')}
              color={item.structure.color}
              label={item.structure.shortLabel}
              activeKey={activeKey}
              onOpen={onOpen}
              onHover={onHover}
              onLeave={onLeave}
            />
          ))}
        </div>

        <div className="relative h-7 overflow-hidden border-b border-white/10 bg-[#202f28]">
          {ticks.map((tick) => (
            <span
              key={`construction-tick-${tick.label}`}
              className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/10"
              style={{ left: tick.left }}
            />
          ))}
          {constructionItems.map((item) => (
            <BaselineSegment
              key={`construction-${item.id}`}
              start={item.start}
              end={item.end}
              domain={domain}
              detail={getConstructionSegmentDetail(item, isLeft ? 'CG' : 'CD')}
              color={item.workStatus === 'COMPLETED' ? '#62c694' : '#e7b64f'}
              pattern={item.workStatus === 'IN_PROGRESS' ? unmeasuredPattern : undefined}
              label={item.workStatus === 'COMPLETED' ? '完成' : '待验收'}
              activeKey={activeKey}
              onOpen={onOpen}
              onHover={onHover}
              onLeave={onLeave}
            />
          ))}
        </div>

        <div className="border-y border-white/10 bg-[#1b3027] px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#8dc7e8]">
          主线计量
        </div>
        {renderMeasurementLanes(mainlineEntries, 'MAINLINE')}
        <div className="border-y border-[#f0a85d]/35 bg-[#3a2a1d] px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#ffc27d]">
          平交路口 Amorce
        </div>
        {renderMeasurementLanes(amorceEntries, 'AMORCE')}
      </div>
    </div>
  )
}

type RoadCenterProps = {
  mainlineItems: CorridorItem[]
  amorceItems: CorridorItem[]
  domain: { start: number; end: number; length: number }
  ticks: Array<{ label: string; left: string }>
  selectedRecordId: string | null
} & SegmentInteractionProps

const RoadCenter = ({
  mainlineItems,
  amorceItems,
  domain,
  ticks,
  selectedRecordId,
  activeKey,
  onOpen,
  onHover,
  onLeave,
}: RoadCenterProps) => (
  <div className="grid grid-cols-[120px_1fr] border-y-4 border-[#d5b94e] sm:grid-cols-[190px_1fr]">
    <div className="flex flex-col justify-center border-r border-white/10 bg-[#0d1713] px-5 py-4">
      <div className="text-sm font-black text-white">道路中间 X</div>
      <div className="mt-1 text-[10px] font-semibold text-[#7f9189]">主线道路基准轴</div>
      {amorceItems.length ? (
        <div className="mt-1 text-[9px] font-black text-[#f0a85d]">
          Amorce 独立记录 {amorceItems.length} 条
        </div>
      ) : null}
    </div>
    <div className="relative h-20 overflow-hidden bg-[#242a27]">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
          backgroundSize: '24px 100%',
        }}
      />
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-[#f0cf54]/80" />
      {ticks.map((tick) => (
        <span
          key={tick.label}
          className="pointer-events-none absolute inset-y-0 border-l border-white/10"
          style={{ left: tick.left }}
        >
          <span className="absolute left-2 top-2 whitespace-nowrap font-mono text-[9px] font-black text-[#bdc8c3]">
            {tick.label}
          </span>
        </span>
      ))}
      <span className="absolute bottom-2 left-3 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/30">
        road axis / {formatValueBillPk(domain.start)} - {formatValueBillPk(domain.end)}
      </span>
      {mainlineItems.map((item, index) => (
        <div
          key={`center-wrap-${item.record.recordId}`}
          className="absolute left-0 right-0 h-3"
          style={{ top: `${index % 2 === 0 ? 8 : 58}px` }}
        >
          <CorridorSegment
            item={item}
            domain={domain}
            selected={selectedRecordId === item.record.recordId}
            activeKey={activeKey}
            onOpen={onOpen}
            onHover={onHover}
            onLeave={onLeave}
            compact
          />
        </div>
      ))}
      {amorceItems.length ? (
        <div className="absolute bottom-1 left-0 right-0 h-2 border-y border-[#f0a85d]/40 bg-[#3a2a1d]">
          {amorceItems.map((item) => (
            <CorridorSegment
              key={`center-amorce-${item.record.recordId}`}
              item={item}
              domain={domain}
              selected={selectedRecordId === item.record.recordId}
              activeKey={activeKey}
              onOpen={onOpen}
              onHover={onHover}
              onLeave={onLeave}
              compact
            />
          ))}
        </div>
      ) : null}
    </div>
  </div>
)

type ProblemCluster = {
  start: number
  end: number
  sideCode: SideCode
  recordIds: string[]
}

const OverviewMap = ({
  domain,
  viewport,
  mainlineItemsBySide,
  amorceItemsBySide,
  designBySide,
  constructionBySide,
  problemClusters,
  onCenter,
  onProblem,
}: {
  domain: { start: number; end: number; length: number }
  viewport: ValueBillViewport
  mainlineItemsBySide: Record<SideCode, CorridorItem[]>
  amorceItemsBySide: Record<SideCode, CorridorItem[]>
  designBySide: Record<SideCode, DesignIntervalItem[]>
  constructionBySide: Record<SideCode, ConstructionIntervalItem[]>
  problemClusters: ProblemCluster[]
  onCenter: (value: number) => void
  onProblem: (cluster: ProblemCluster) => void
}) => {
  const position = (value: number) => `${((value - domain.start) / domain.length) * 100}%`
  const width = (start: number, end: number) => `${((end - start) / domain.length) * 100}%`
  const trackTops: Record<SideCode, number> = { CG: 10, X: 48, CD: 86 }

  return (
    <div className="grid grid-cols-[88px_1fr] border-b border-white/10 bg-[#111e19]">
      <div className="grid h-[116px] grid-rows-3 border-r border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#91a49b]">
        <span className="flex items-center">左侧 CG</span>
        <span className="flex items-center text-[#d5b94e]">道路 X</span>
        <span className="flex items-center">右侧 CD</span>
      </div>
      <div
        className="relative h-[116px] cursor-crosshair overflow-hidden"
        title="点击概览图定位，红色数字表示聚集的问题段"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
          onCenter(domain.start + ratio * domain.length)
        }}
      >
        {(['CG', 'X', 'CD'] as SideCode[]).map((sideCode) => (
          <div
            key={`overview-track-${sideCode}`}
            className={`absolute left-0 right-0 h-5 overflow-hidden ${
              sideCode === 'X'
                ? 'border-y border-[#d5b94e]/60 bg-[#282e2b]'
                : 'bg-[#34413c]'
            }`}
            style={{ top: `${trackTops[sideCode]}px` }}
          >
            {sideCode !== 'X' ? designBySide[sideCode].map((item) => (
              <span
                key={`overview-design-${item.id}`}
                className="absolute inset-y-0 opacity-45"
                style={{
                  left: position(item.start),
                  width: width(item.start, item.end),
                  minWidth: '2px',
                  backgroundColor: item.structure.color,
                }}
              />
            )) : null}
            {sideCode !== 'X' ? constructionBySide[sideCode].map((item) => (
              <span
                key={`overview-construction-${item.id}`}
                className="absolute bottom-0 z-[2] h-1"
                style={{
                  left: position(item.start),
                  width: width(item.start, item.end),
                  minWidth: '2px',
                  backgroundColor: item.workStatus === 'COMPLETED' ? '#62c694' : '#e7b64f',
                }}
              />
            )) : null}
            {mainlineItemsBySide[sideCode].map((item) => (
              <span
                key={`overview-record-${sideCode}-${item.record.recordId}`}
                className={`absolute inset-y-0 ${
                  getValueBillReviewConclusion(item.record) === 'ISSUE'
                    ? 'border-y-2 border-[#ff655b]'
                    : getValueBillReviewConclusion(item.record) === 'PENDING'
                      ? 'border-y-2 border-[#76c7e8]'
                      : ''
                }`}
                style={{
                  left: position(item.span.start),
                  width: item.span.isPoint ? '3px' : width(item.span.start, item.span.end),
                  minWidth: '2px',
                  backgroundColor: item.structure.color,
                }}
              />
            ))}
            {sideCode === 'X' ? (
              <span className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[#e8cd61]" />
            ) : null}
          </div>
        ))}

        {(['CG', 'CD'] as SideCode[]).map((sideCode) => (
          <div
            key={`overview-amorce-track-${sideCode}`}
            className="absolute left-0 right-0 h-1 bg-[#f0a85d]/15"
            style={{ top: `${trackTops[sideCode] + 22}px` }}
          >
            {amorceItemsBySide[sideCode].map((item) => (
              <span
                key={`overview-amorce-${sideCode}-${item.record.recordId}`}
                className="absolute inset-y-[-2px] w-1 -translate-x-1/2 bg-[#f0a85d]"
                style={{ left: position(item.span.start) }}
              />
            ))}
          </div>
        ))}

        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={`overview-tick-${index}`}
            className="pointer-events-none absolute inset-y-0 border-l border-white/10"
            style={{ left: `${(index / 6) * 100}%` }}
          />
        ))}

        <span
          className="pointer-events-none absolute inset-y-1 z-20 border-2 border-[#f2d15e] bg-[#f2d15e]/10 shadow-[0_0_0_9999px_rgba(0,0,0,.18)]"
          style={{
            left: position(viewport.start),
            width: width(viewport.start, viewport.end),
            minWidth: '8px',
          }}
        />

        {problemClusters.map((cluster) => {
          const center = (cluster.start + cluster.end) / 2
          const top = cluster.sideCode === 'CG' ? 2 : cluster.sideCode === 'CD' ? 78 : 40
          return (
            <button
              key={`${cluster.sideCode}-${cluster.start}-${cluster.end}`}
              type="button"
              onClick={() => onProblem(cluster)}
              title={`${sideLabels[cluster.sideCode]} ${formatValueBillPk(cluster.start)} - ${formatValueBillPk(cluster.end)}，${cluster.recordIds.length} 条问题`}
              className="absolute z-30 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#e9473e] px-1 font-mono text-[9px] font-black text-white shadow"
              style={{ left: position(center), top }}
            >
              {cluster.recordIds.length}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SegmentHoverCard = ({ hovered }: { hovered: HoveredSegment }) => (
  <div
    data-segment-hover
    className="pointer-events-none fixed z-[100] w-[310px] border border-white/20 bg-[#101c17]/95 p-3 text-white shadow-[0_14px_40px_rgba(0,0,0,.35)] backdrop-blur"
    style={{ left: hovered.x, top: hovered.y }}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8eddb8]">
        {hovered.detail.sourceLabel}
      </span>
      <span className="border border-white/15 px-2 py-0.5 text-[9px] font-black text-[#dfe9e4]">
        {hovered.detail.statusLabel}
      </span>
    </div>
    <div className="mt-2 flex items-center gap-2">
      <span className="h-3 w-5 shrink-0" style={{ backgroundColor: hovered.detail.color }} />
      <strong className="truncate text-sm">{hovered.detail.title}</strong>
    </div>
    <div className="mt-2 font-mono text-xs font-black text-[#f1d46a]">{hovered.detail.range}</div>
    <div className="mt-1 text-[10px] font-semibold text-[#9eafa7]">{hovered.detail.sideLabel}</div>
    <div className="mt-3 border-t border-white/10 pt-2 text-[10px] font-bold text-[#d1ddd7]">
      点击固定并查看完整数据
    </div>
  </div>
)

const SegmentDetailModal = ({
  detail,
  record,
  onClose,
}: {
  detail: SegmentDetail
  record: ValueBillReviewRecordDto | null
  onClose: () => void
}) => (
  <div
    data-segment-modal
    className="fixed inset-0 z-[110] flex items-end justify-center bg-[#07100c]/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-label={`${detail.title}详细信息`}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}
  >
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border-2 border-[#173e31] bg-[#f7f3e8] text-[#17221d] shadow-[10px_10px_0_rgba(23,62,49,.75)]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#c8c0ae] bg-[#173e31] px-5 py-4 text-white">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8fe0ba]">
            {detail.sourceLabel}
          </div>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">{detail.title}</h2>
          <div className="mt-1 font-mono text-xs font-black text-[#f0d163]">{detail.range}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="border border-white/25 px-3 py-1.5 text-xs font-black hover:bg-white/10"
        >
          关闭
        </button>
      </header>

      <div className="p-5 sm:p-6">
        <div className="grid gap-px border border-[#c9c2b1] bg-[#c9c2b1] sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['数据层', detail.sourceLabel],
            ['侧别', detail.sideLabel],
            ['状态', detail.statusLabel],
            ...detail.fields,
          ].map(([label, value]) => (
            <div key={`${label}-${value}`} className="min-w-0 bg-[#f7f3e8] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#7a786e]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold">{value}</div>
            </div>
          ))}
        </div>

        {record ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="border-l-4 border-[#2c7358] bg-[#e4eee8] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#47705f]">
                计算公式
              </div>
              <div className="mt-2 font-mono text-sm font-bold leading-6">
                {record.formula ?? '未记录公式'}
              </div>
            </div>
            <div className={`border-l-4 p-4 ${
              getValueBillReviewConclusion(record) === 'ISSUE'
                ? 'border-[#d9564c] bg-[#fff0eb]'
                : getValueBillReviewConclusion(record) === 'PENDING'
                  ? 'border-[#5ba9cb] bg-[#eaf6fb]'
                  : getValueBillReviewConclusion(record) === 'TO_MEASURE'
                    ? 'border-[#4a91b2] bg-[#e8f5fa]'
                  : 'border-[#5aa680] bg-[#edf4ef]'
            }`}>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#755e55]">
                审核备注
              </div>
              <div className="mt-2 text-sm font-semibold leading-6">
                {record.note ?? '用户已确认，暂无问题备注。'}
              </div>
            </div>
          </div>
        ) : detail.note ? (
          <div className="mt-5 border-l-4 border-[#d0a63f] bg-[#fff4d6] p-4 text-sm font-semibold">
            {detail.note}
          </div>
        ) : null}
      </div>
    </section>
  </div>
)

export default function BillReviewClient({ review }: Props) {
  const records = useMemo(() => review?.records ?? [], [review])
  const initialRoad = records.some((record) => record.roadZh === '丹达穿城路')
    ? '丹达穿城路'
    : records.find((record) => record.roadZh)?.roadZh ?? ''

  const [road, setRoad] = useState(initialRoad)
  const [boqCode, setBoqCode] = useState('all')
  const [structureKey, setStructureKey] = useState('all')
  const [measurementPeriod, setMeasurementPeriod] = useState('all')
  const [reviewStatus, setReviewStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'corridor' | 'records' | 'checklist'>('corridor')
  const [issueSearch, setIssueSearch] = useState('')
  const [issueConfirmationFilters, setIssueConfirmationFilters] = useState<string[]>([])
  const [issueMeasurementFilters, setIssueMeasurementFilters] = useState<string[]>([])
  const [issuePeriodFilters, setIssuePeriodFilters] = useState<string[]>([])
  const [issueConclusionFilters, setIssueConclusionFilters] = useState<string[]>([])
  const [issueAlignmentFilters, setIssueAlignmentFilters] = useState<string[]>([])
  const [issueRoadFilters, setIssueRoadFilters] = useState<string[]>([])
  const [issueBoqFilters, setIssueBoqFilters] = useState<string[]>([])
  const [issueSideFilters, setIssueSideFilters] = useState<string[]>([])
  const [issueSortKey, setIssueSortKey] = useState<IssueSortKey>('status')
  const [issueSortDirection, setIssueSortDirection] = useState<SortDirection>('asc')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [activeSegment, setActiveSegment] = useState<SegmentDetail | null>(null)
  const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(null)
  const [viewport, setViewport] = useState<ValueBillViewport>({
    start: 0,
    end: Number.MAX_SAFE_INTEGER,
  })
  const [rangeError, setRangeError] = useState('')
  const [isPanning, setIsPanning] = useState(false)
  const [isWheelZoomLocked, setIsWheelZoomLocked] = useState(true)
  const rangeStartRef = useRef<HTMLInputElement>(null)
  const rangeEndRef = useRef<HTMLInputElement>(null)
  const corridorViewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    viewport: ValueBillViewport
  } | null>(null)

  const roadOptions = useMemo(
    () => uniqueOptions(records, (record) => record.roadZh ?? record.roadRaw),
    [records],
  )
  const selectedRoadRecords = useMemo(
    () => records.filter((record) => (record.roadZh ?? record.roadRaw) === road),
    [records, road],
  )
  const structureRecords = useMemo(
    () => selectedRoadRecords.filter(isStructureCorridorRecord),
    [selectedRoadRecords],
  )
  const selectedDesignIntervals = useMemo(
    () => review?.designIntervals.filter((interval) => interval.roadName === road) ?? [],
    [review?.designIntervals, road],
  )
  const designItems = useMemo(() => selectedDesignIntervals
    .filter((interval) =>
      Number.isFinite(interval.startPk)
      && Number.isFinite(interval.endPk)
      && interval.startPk !== interval.endPk)
    .map((interval) => {
      const start = Math.min(interval.startPk, interval.endPk)
      const end = Math.max(interval.startPk, interval.endPk)
      return {
        id: interval.id,
        sideCode: interval.sideCode,
        start,
        end,
        phaseName: interval.phaseName,
        spec: interval.spec,
        quantity: interval.quantity,
        structure: getDesignStructureIdentity(interval.phaseName, interval.spec),
      }
    }), [selectedDesignIntervals])
  const selectedConstructionIntervals = useMemo(
    () => review?.constructionIntervals.filter((interval) => interval.roadName === road) ?? [],
    [review?.constructionIntervals, road],
  )
  const constructionItems = useMemo(() => selectedConstructionIntervals.flatMap((interval) => {
    const intervalStart = Math.min(interval.startPk, interval.endPk)
    const intervalEnd = Math.max(interval.startPk, interval.endPk)
    if (intervalStart === intervalEnd) return []
    const matchingDesign = designItems.filter((design) => {
      const sideMatches =
        design.sideCode === interval.sideCode
        || design.sideCode === 'D/G'
        || interval.sideCode === 'D/G'
      return sideMatches
        && design.phaseName === interval.phaseName
        && design.end > intervalStart
        && design.start < intervalEnd
    })
    if (!matchingDesign.length) {
      return [{
        id: interval.id,
        sideCode: interval.sideCode,
        start: intervalStart,
        end: intervalEnd,
        phaseName: interval.phaseName,
        spec: null,
        workStatus: interval.workStatus,
        sourceStatus: interval.sourceStatus,
        structure: getDesignStructureIdentity(interval.phaseName, null),
      }]
    }
    return matchingDesign.map((design) => ({
      id: `${interval.id}-${design.id}`,
      sideCode: interval.sideCode,
      start: Math.max(intervalStart, design.start),
      end: Math.min(intervalEnd, design.end),
      phaseName: interval.phaseName,
      spec: design.spec,
      workStatus: interval.workStatus,
      sourceStatus: interval.sourceStatus,
      structure: design.structure,
    }))
  }), [designItems, selectedConstructionIntervals])
  const structureOptions = useMemo(() => {
    const byKey = new Map<string, StructureIdentity>()
    structureRecords.forEach((record) => {
      const identity = getStructureIdentity(record)
      byKey.set(identity.key, identity)
    })
    return Array.from(byKey.values()).sort((left, right) =>
      left.label.localeCompare(right.label, 'zh-CN', { numeric: true }))
  }, [structureRecords])
  const boqOptions = useMemo(
    () => uniqueOptions(structureRecords, (record) => record.boqCode),
    [structureRecords],
  )
  const measurementOptions = useMemo(
    () => uniqueOptions(structureRecords, getValueBillMeasurementLabel),
    [structureRecords],
  )

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return structureRecords.filter((record) => {
      if (boqCode !== 'all' && record.boqCode !== boqCode) return false
      if (structureKey !== 'all' && getStructureIdentity(record).key !== structureKey) return false
      if (
        measurementPeriod !== 'all'
        && getValueBillMeasurementLabel(record) !== measurementPeriod
      ) {
        return false
      }
      const confirmation = getValueBillIssueConfirmation(record)
      const conclusion = getValueBillReviewConclusion(record)
      if (reviewStatus === 'CONFIRMED' && confirmation !== 'CONFIRMED') return false
      if (reviewStatus === 'PENDING' && confirmation !== 'PENDING') return false
      if (reviewStatus === 'ISSUE' && conclusion !== 'ISSUE') return false
      if (keyword && !readSearchText(record).includes(keyword)) return false
      return true
    })
  }, [
    boqCode,
    measurementPeriod,
    reviewStatus,
    search,
    structureKey,
    structureRecords,
  ])

  const priceByCode = useMemo(
    () => new Map((review?.boqPrices ?? []).map((price) => [price.code.toUpperCase(), price])),
    [review?.boqPrices],
  )
  const issueRecords = useMemo(
    () => records,
    [records],
  )
  const issueRoadOptions = useMemo(
    () => uniqueOptions(issueRecords, (record) => record.roadZh ?? record.roadRaw),
    [issueRecords],
  )
  const issueBoqOptions = useMemo(
    () => uniqueOptions(issueRecords, (record) => record.boqCode),
    [issueRecords],
  )
  const issueSideOptions = useMemo(
    () => uniqueOptions(issueRecords, getRecordSideLabel),
    [issueRecords],
  )
  const filteredIssueRecords = useMemo(() => {
    const keyword = issueSearch.trim().toLowerCase()
    return issueRecords.filter((record) => {
      const confirmation = getValueBillIssueConfirmation(record)
      if (issueConfirmationFilters.length && !issueConfirmationFilters.includes(confirmation)) {
        return false
      }
      if (
        issueMeasurementFilters.length
        && !issueMeasurementFilters.includes(getValueBillMeasurementState(record))
      ) {
        return false
      }
      if (
        issuePeriodFilters.length
        && !issuePeriodFilters.includes(getValueBillMeasurementPeriod(record))
      ) {
        return false
      }
      if (
        issueConclusionFilters.length
        && !issueConclusionFilters.includes(getValueBillReviewConclusion(record))
      ) {
        return false
      }
      if (
        issueAlignmentFilters.length
        && !issueAlignmentFilters.includes(getValueBillAlignment(record))
      ) {
        return false
      }
      if (
        issueRoadFilters.length
        && !issueRoadFilters.includes(record.roadZh ?? record.roadRaw ?? '')
      ) {
        return false
      }
      if (issueBoqFilters.length && !issueBoqFilters.includes(record.boqCode ?? '')) return false
      if (issueSideFilters.length && !issueSideFilters.includes(getRecordSideLabel(record))) return false
      if (keyword && !readIssueSearchText(record).includes(keyword)) return false
      return true
    })
  }, [
    issueAlignmentFilters,
    issueBoqFilters,
    issueConfirmationFilters,
    issueConclusionFilters,
    issueMeasurementFilters,
    issuePeriodFilters,
    issueRecords,
    issueRoadFilters,
    issueSearch,
    issueSideFilters,
  ])
  const sortedIssueRecords = useMemo(() => {
    const readSortValue = (record: ValueBillReviewRecordDto): string | number | null => {
      const price = priceByCode.get(record.boqCode?.toUpperCase() ?? '')?.unitPrice ?? null
      switch (issueSortKey) {
        case 'status':
          return getValueBillIssueConfirmation(record) === 'PENDING' ? 0 : 1
        case 'structure':
          return getIssueStructureLabel(record)
        case 'boq':
          return record.boqCode
        case 'side':
          return getRecordSideLabel(record)
        case 'pk':
          return getValueBillTimelineSpan(record)?.start ?? null
        case 'quantity':
          return record.quantity
        case 'unitPrice':
          return price
        case 'amount':
          return price !== null && record.quantity !== null ? price * record.quantity : null
        case 'formula':
          return record.formula
        case 'note':
          return record.note
      }
    }
    return [...filteredIssueRecords].sort((left, right) => {
      const leftValue = readSortValue(left)
      const rightValue = readSortValue(right)
      if (leftValue === null && rightValue === null) return left.recordId.localeCompare(right.recordId)
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'zh-CN', { numeric: true })
      return issueSortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredIssueRecords, issueSortDirection, issueSortKey, priceByCode])
  const confirmedIssueCount = issueRecords.filter(
    (record) => getValueBillIssueConfirmation(record) === 'CONFIRMED',
  ).length
  const pendingIssueCount = issueRecords.length - confirmedIssueCount

  const domain = useMemo(() => {
    const configured = review?.roadRanges.find((range) => range.name === road)
    const configuredStart = parseValueBillPk(configured?.startPk)
    const configuredEnd = parseValueBillPk(configured?.endPk)
    const observed = structureRecords
      .map(getValueBillTimelineSpan)
      .filter((span): span is ValueBillTimelineSpan => Boolean(span))
    const observedStarts = [
      ...observed.map((span) => span.start),
      ...designItems.map((item) => item.start),
    ]
    const observedEnds = [
      ...observed.map((span) => span.end),
      ...designItems.map((item) => item.end),
    ]
    const observedStart = observedStarts.length ? Math.min(...observedStarts) : 0
    const observedEnd = observedEnds.length ? Math.max(...observedEnds) : 1000
    const start = configuredStart ?? Math.min(observedStart, 0)
    const end = configuredEnd ?? Math.max(observedEnd, start + 1)
    return { start, end, length: Math.max(1, end - start) }
  }, [designItems, review?.roadRanges, road, structureRecords])

  const allCorridorItems = useMemo(() => toCorridorItems(structureRecords), [structureRecords])
  const corridorItems = useMemo(() => toCorridorItems(filteredRecords), [filteredRecords])

  const itemsBySide = useMemo(() => groupCorridorItemsBySide(corridorItems), [corridorItems])
  const allItemsBySide = useMemo(
    () => groupCorridorItemsBySide(allCorridorItems),
    [allCorridorItems],
  )
  const mainlineItemsBySide = useMemo(() => ({
    CG: itemsBySide.CG.filter((item) => item.alignment === 'MAINLINE'),
    CD: itemsBySide.CD.filter((item) => item.alignment === 'MAINLINE'),
    X: itemsBySide.X.filter((item) => item.alignment === 'MAINLINE'),
  }), [itemsBySide])
  const amorceItemsBySide = useMemo(() => ({
    CG: itemsBySide.CG.filter((item) => item.alignment === 'AMORCE'),
    CD: itemsBySide.CD.filter((item) => item.alignment === 'AMORCE'),
    X: itemsBySide.X.filter((item) => item.alignment === 'AMORCE'),
  }), [itemsBySide])
  const allMainlineItemsBySide = useMemo(() => ({
    CG: allItemsBySide.CG.filter((item) => item.alignment === 'MAINLINE'),
    CD: allItemsBySide.CD.filter((item) => item.alignment === 'MAINLINE'),
    X: allItemsBySide.X.filter((item) => item.alignment === 'MAINLINE'),
  }), [allItemsBySide])
  const allAmorceItemsBySide = useMemo(() => ({
    CG: allItemsBySide.CG.filter((item) => item.alignment === 'AMORCE'),
    CD: allItemsBySide.CD.filter((item) => item.alignment === 'AMORCE'),
    X: allItemsBySide.X.filter((item) => item.alignment === 'AMORCE'),
  }), [allItemsBySide])
  const designBySide = useMemo(() => {
    const grouped: Record<SideCode, DesignIntervalItem[]> = { CG: [], CD: [], X: [] }
    designItems.forEach((item) => {
      if (item.sideCode === 'D/G') {
        grouped.CG.push(item)
        grouped.CD.push(item)
      } else if (item.sideCode === 'CG' || item.sideCode === 'CD' || item.sideCode === 'X') {
        grouped[item.sideCode].push(item)
      }
    })
    return grouped
  }, [designItems])
  const constructionBySide = useMemo(() => {
    const grouped: Record<SideCode, ConstructionIntervalItem[]> = { CG: [], CD: [], X: [] }
    constructionItems.forEach((item) => {
      if (item.sideCode === 'D/G') {
        grouped.CG.push(item)
        grouped.CD.push(item)
      } else if (item.sideCode === 'CG' || item.sideCode === 'CD' || item.sideCode === 'X') {
        grouped[item.sideCode].push(item)
      }
    })
    return grouped
  }, [constructionItems])

  const leftMainlineLanes = useMemo(
    () => packCorridorItems(mainlineItemsBySide.CG),
    [mainlineItemsBySide.CG],
  )
  const leftAmorceLanes = useMemo(
    () => packCorridorItems(amorceItemsBySide.CG),
    [amorceItemsBySide.CG],
  )
  const rightMainlineLanes = useMemo(
    () => packCorridorItems(mainlineItemsBySide.CD),
    [mainlineItemsBySide.CD],
  )
  const rightAmorceLanes = useMemo(
    () => packCorridorItems(amorceItemsBySide.CD),
    [amorceItemsBySide.CD],
  )
  const coverageSpans = useMemo(() => {
    const toSpan = (item: DesignIntervalItem): ValueBillTimelineSpan => ({
      start: item.start,
      end: item.end,
      startLabel: formatValueBillPk(item.start),
      endLabel: formatValueBillPk(item.end),
      isPoint: false,
    })
    return {
      CG: designBySide.CG.map(toSpan),
      CD: designBySide.CD.map(toSpan),
    }
  }, [designBySide.CD, designBySide.CG])
  const leftCoverage = useMemo(
    () => getValueBillTimelineCoverage(coverageSpans.CG, domain.start, domain.end),
    [coverageSpans.CG, domain.end, domain.start],
  )
  const rightCoverage = useMemo(
    () => getValueBillTimelineCoverage(coverageSpans.CD, domain.start, domain.end),
    [coverageSpans.CD, domain.end, domain.start],
  )

  const viewportDomain = useMemo(() => {
    const next = clampValueBillViewport(viewport, domain)
    return { ...next, length: Math.max(1, next.end - next.start) }
  }, [domain, viewport])
  const viewportLeftCoverage = useMemo(
    () => getValueBillTimelineCoverage(
      coverageSpans.CG,
      viewportDomain.start,
      viewportDomain.end,
    ),
    [coverageSpans.CG, viewportDomain.end, viewportDomain.start],
  )
  const viewportRightCoverage = useMemo(
    () => getValueBillTimelineCoverage(
      coverageSpans.CD,
      viewportDomain.start,
      viewportDomain.end,
    ),
    [coverageSpans.CD, viewportDomain.end, viewportDomain.start],
  )
  const ticks = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const value = viewportDomain.start + (viewportDomain.length * index) / 6
    return {
      label: formatValueBillPk(value),
      left: `${(index / 6) * 100}%`,
    }
  }), [viewportDomain])

  const visibleStructures = useMemo(() => {
    const byKey = new Map<string, StructureIdentity>()
    structureOptions.forEach((identity) => byKey.set(identity.key, identity))
    designItems.forEach((item) => byKey.set(item.structure.key, item.structure))
    return Array.from(byKey.values())
  }, [designItems, structureOptions])

  const gaps = useMemo(() => [
    ...leftCoverage.gaps.map((gap) => ({ ...gap, sideCode: 'CG', sideLabel: '左侧' })),
    ...rightCoverage.gaps.map((gap) => ({ ...gap, sideCode: 'CD', sideLabel: '右侧' })),
  ].sort((left, right) =>
    left.start - right.start || left.sideCode.localeCompare(right.sideCode)), [
    leftCoverage.gaps,
    rightCoverage.gaps,
  ])

  const overlapCount = useMemo(
    () => leftMainlineLanes.slice(1).reduce((sum, lane) => sum + lane.length, 0)
      + leftAmorceLanes.slice(1).reduce((sum, lane) => sum + lane.length, 0)
      + rightMainlineLanes.slice(1).reduce((sum, lane) => sum + lane.length, 0)
      + rightAmorceLanes.slice(1).reduce((sum, lane) => sum + lane.length, 0),
    [leftAmorceLanes, leftMainlineLanes, rightAmorceLanes, rightMainlineLanes],
  )
  const unlocatedCount = filteredRecords.length - corridorItems.length
  const selectedRecord = useMemo(
    () => records.find((record) => record.recordId === selectedRecordId) ?? null,
    [records, selectedRecordId],
  )
  const problemItems = useMemo(
    () => allCorridorItems
      .filter((item) => getValueBillReviewConclusion(item.record) === 'ISSUE')
      .sort((left, right) =>
        left.span.start - right.span.start
        || left.span.end - right.span.end
        || left.record.recordId.localeCompare(right.record.recordId)),
    [allCorridorItems],
  )
  const problemClusters = useMemo(() => {
    const threshold = Math.max(12, domain.length * 0.006)
    const clusters: ProblemCluster[] = []
    ;(['CG', 'X', 'CD'] as SideCode[]).forEach((sideCode) => {
      const sideItems = allItemsBySide[sideCode]
        .filter((item) => getValueBillReviewConclusion(item.record) === 'ISSUE')
        .sort((left, right) => left.span.start - right.span.start)
      sideItems.forEach((item) => {
        const previous = clusters.at(-1)
        if (
          previous
          && previous.sideCode === sideCode
          && item.span.start - previous.end <= threshold
        ) {
          previous.end = Math.max(previous.end, item.span.end)
          previous.recordIds.push(item.record.recordId)
          return
        }
        clusters.push({
          start: item.span.start,
          end: item.span.end,
          sideCode,
          recordIds: [item.record.recordId],
        })
      })
    })
    return clusters
  }, [allItemsBySide, domain.length])

  useEffect(() => {
    if (rangeStartRef.current) {
      rangeStartRef.current.value = formatValueBillPk(viewportDomain.start)
    }
    if (rangeEndRef.current) {
      rangeEndRef.current.value = formatValueBillPk(viewportDomain.end)
    }
  }, [viewportDomain.end, viewportDomain.start])

  useEffect(() => {
    if (!activeSegment) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveSegment(null)
        setSelectedRecordId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSegment])

  const openSegment = useCallback((detail: SegmentDetail) => {
    setActiveSegment(detail)
    setHoveredSegment(null)
    setSelectedRecordId(detail.recordId ?? null)
  }, [])

  const showSegmentHover = useCallback((
    detail: SegmentDetail,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    const cardWidth = 310
    const cardHeight = 170
    const x = event.clientX + cardWidth + 28 > window.innerWidth
      ? Math.max(8, event.clientX - cardWidth - 14)
      : event.clientX + 14
    const y = Math.min(
      Math.max(8, event.clientY + 14),
      Math.max(8, window.innerHeight - cardHeight - 8),
    )
    setHoveredSegment({ detail, x, y })
  }, [])

  const hideSegmentHover = useCallback(() => {
    setHoveredSegment(null)
  }, [])

  const openRecordById = useCallback((recordId: string) => {
    const item = allCorridorItems.find((candidate) => candidate.record.recordId === recordId)
    if (item) {
      openSegment(getMeasurementSegmentDetail(item))
      return
    }
    const record = records.find((candidate) => candidate.recordId === recordId)
    if (record) openSegment(getIssueRecordDetail(record))
  }, [allCorridorItems, openSegment, records])

  const setViewportRange = useCallback((next: ValueBillViewport) => {
    setViewport(clampValueBillViewport(next, domain))
    setRangeError('')
  }, [domain])

  const focusRange = useCallback((start: number, end: number) => {
    const spanLength = Math.max(1, end - start)
    const padding = Math.max(20, Math.min(80, spanLength * 0.5))
    setViewportRange({ start: start - padding, end: end + padding })
  }, [setViewportRange])

  const zoomAt = useCallback((factor: number, anchor: number) => {
    setViewport((current) => zoomValueBillViewport(
      clampValueBillViewport(current, domain),
      factor,
      anchor,
      domain,
    ))
  }, [domain])

  const centerViewport = useCallback((center: number) => {
    const halfLength = viewportDomain.length / 2
    setViewportRange({ start: center - halfLength, end: center + halfLength })
  }, [setViewportRange, viewportDomain.length])

  const setViewportLength = useCallback((length: number) => {
    const center = (viewportDomain.start + viewportDomain.end) / 2
    setViewportRange({ start: center - length / 2, end: center + length / 2 })
  }, [setViewportRange, viewportDomain.end, viewportDomain.start])

  useEffect(() => {
    const element = corridorViewportRef.current
    if (!element || isWheelZoomLocked) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const labelWidth = Math.min(190, rect.width * 0.3)
      const plotWidth = Math.max(1, rect.width - labelWidth)
      const ratio = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left - labelWidth) / plotWidth),
      )
      const anchor = viewportDomain.start + ratio * viewportDomain.length
      zoomAt(event.deltaY > 0 ? 1.25 : 0.8, anchor)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [isWheelZoomLocked, viewportDomain, zoomAt])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, a')) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      viewport: {
        start: viewportDomain.start,
        end: viewportDomain.end,
      },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPanning(true)
  }, [viewportDomain.end, viewportDomain.start])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const plotWidth = Math.max(1, rect.width - Math.min(190, rect.width * 0.3))
    const length = drag.viewport.end - drag.viewport.start
    const offset = ((drag.startX - event.clientX) / plotWidth) * length
    setViewport(clampValueBillViewport({
      start: drag.viewport.start + offset,
      end: drag.viewport.end + offset,
    }, domain))
  }, [domain])

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const focusProblemCluster = useCallback((cluster: ProblemCluster) => {
    const item = allCorridorItems.find(
      (candidate) => candidate.record.recordId === cluster.recordIds[0],
    )
    if (item) openSegment(getMeasurementSegmentDetail(item))
    focusRange(cluster.start, cluster.end)
  }, [allCorridorItems, focusRange, openSegment])

  const jumpProblem = useCallback((direction: -1 | 1) => {
    if (!problemItems.length) return
    const selectedIndex = problemItems.findIndex(
      (item) => item.record.recordId === selectedRecordId,
    )
    const fallback = direction === 1 ? 0 : problemItems.length - 1
    const nextIndex = selectedIndex === -1
      ? fallback
      : (selectedIndex + direction + problemItems.length) % problemItems.length
    const next = problemItems[nextIndex]
    openSegment(getMeasurementSegmentDetail(next))
    focusRange(next.span.start, next.span.end)
  }, [focusRange, openSegment, problemItems, selectedRecordId])

  const applyManualRange = () => {
    const start = parseValueBillPk(rangeStartRef.current?.value)
    const end = parseValueBillPk(rangeEndRef.current?.value)
    if (start === null || end === null || start >= end) {
      setRangeError('请输入有效的起止桩号')
      return
    }
    setViewportRange({ start, end })
  }

  const clearFilters = () => {
    setBoqCode('all')
    setStructureKey('all')
    setMeasurementPeriod('all')
    setReviewStatus('all')
    setSearch('')
  }

  const clearIssueFilters = () => {
    setIssueSearch('')
    setIssueConfirmationFilters([])
    setIssueMeasurementFilters([])
    setIssuePeriodFilters([])
    setIssueConclusionFilters([])
    setIssueAlignmentFilters([])
    setIssueRoadFilters([])
    setIssueBoqFilters([])
    setIssueSideFilters([])
  }

  const sortIssues = (key: IssueSortKey) => {
    if (key === issueSortKey) {
      setIssueSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
      return
    }
    setIssueSortKey(key)
    setIssueSortDirection('asc')
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-[#f2efe6] text-[#17221d]">
        <PageHeaderNav
          breadcrumbs={[
            { label: '首页', href: '/' },
            { label: '产值', href: '/value' },
            { label: '第六期审核' },
          ]}
          title="丹达第六期最终计量"
        />
        <main className="mx-auto max-w-5xl px-6 py-14">
          <section className="border-2 border-[#ce6e42] bg-[#fff3dc] p-8">
            <h2 className="text-2xl font-black">数据库里还没有第六期审核数据</h2>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#f2efe6] text-[#17221d]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(29,58,47,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(29,58,47,.035) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <PageHeaderNav
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '产值', href: '/value' },
          { label: '第六期最终计量' },
        ]}
        title="丹达第六期最终计量"
        subtitle="整条道路结构物覆盖与缺口检查"
        tabs={[
          { key: 'value', label: '产值首页', href: '/value' },
          { key: 'measurement', label: '正式计量台账', href: '/value/measurement-ledger' },
          { key: 'bill-review', label: '第六期审核', active: true },
        ]}
        rightSlot={
          <span className="border border-[#1e5d49] bg-[#173e31] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#a8f0d1]">
            Admin only
          </span>
        }
      />

      <main className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-7 xl:px-10">
        <section className="relative overflow-hidden border border-[#253f35] bg-[#13231d] text-white shadow-[0_20px_60px_rgba(18,36,29,.18)]">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent 49.7%, rgba(157,235,199,.3) 50%, transparent 50.3%)',
              backgroundSize: '80px 100%',
            }}
          />
          <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[1.15fr_1.85fr] lg:items-end lg:px-8">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#7ddaae]">
                Full road corridor / attachment 06
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                整条道路结构物图
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#b8c6c0]">
                每侧按设计、施工验收、第六期计量三层对齐。先看设计是否连续，再核对已完成范围和账单是否覆盖；悬停立即预览，点击固定详情。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
              <Metric
                label="左侧设计"
                value={formatPercent(leftCoverage.coverageRatio)}
                tone="text-[#e8c85d]"
                helper={`${Math.round(leftCoverage.coveredLength)}m 设计区间`}
              />
              <Metric
                label="右侧设计"
                value={formatPercent(rightCoverage.coverageRatio)}
                tone="text-[#79b5d3]"
                helper={`${Math.round(rightCoverage.coveredLength)}m 设计区间`}
              />
              <Metric label="结构物记录" value={filteredRecords.length} tone="text-[#9cebc7]" />
              <Metric label="设计缺口" value={gaps.length} tone="text-[#f1bd61]" />
              <Metric label="重合分轨" value={overlapCount} tone="text-[#ff8b83]" />
            </div>
          </div>
        </section>

        {view !== 'checklist' ? (
          <section className="border border-[#c7c0ad] bg-[#e7e1d2] p-4 shadow-[4px_4px_0_#c7c0ad]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className={`${selectLabelClass} xl:col-span-2`}>
              搜索
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="结构物、价号、桩号、备注、Excel 行"
                className={filterControlClass}
              />
            </label>
            <label className={selectLabelClass}>
              道路
              <select
                value={road}
                onChange={(event) => {
                  setRoad(event.target.value)
                  setViewport({ start: 0, end: Number.MAX_SAFE_INTEGER })
                  clearFilters()
                  setSelectedRecordId(null)
                  setActiveSegment(null)
                  setHoveredSegment(null)
                }}
                className={filterControlClass}
              >
                {roadOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={selectLabelClass}>
              结构物
              <select
                value={structureKey}
                onChange={(event) => setStructureKey(event.target.value)}
                className={filterControlClass}
              >
                <option value="all">全部结构物</option>
                {structureOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={selectLabelClass}>
              价号
              <select value={boqCode} onChange={(event) => setBoqCode(event.target.value)} className={filterControlClass}>
                <option value="all">全部价号</option>
                {boqOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={selectLabelClass}>
              计量状态
              <select
                value={measurementPeriod}
                onChange={(event) => setMeasurementPeriod(event.target.value)}
                className={filterControlClass}
              >
                <option value="all">全部计量状态</option>
                {measurementOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#c7c0ad] pt-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#625f54]">
              <label className="inline-flex items-center gap-2">
                <span className="font-black uppercase tracking-[0.12em]">审核</span>
                <select
                  value={reviewStatus}
                  onChange={(event) => setReviewStatus(event.target.value)}
                  className="border border-[#b9b19d] bg-[#faf8f1] px-2 py-1 font-bold"
                >
                  <option value="all">全部</option>
                  <option value="CONFIRMED">已确认</option>
                  <option value="PENDING">待确认</option>
                  <option value="ISSUE">有问题</option>
                </select>
              </label>
              <span>整路范围 {formatValueBillPk(domain.start)} - {formatValueBillPk(domain.end)}</span>
              <span>第 {review.attachmentNumber} 期</span>
              <span>{unlocatedCount} 条结构物记录暂无完整桩号</span>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="border-b border-[#244d3e] text-xs font-black uppercase tracking-[0.12em] text-[#244d3e]"
            >
              清除筛选
            </button>
          </div>
          </section>
        ) : null}

        <section className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap border border-[#bdb5a2] bg-[#ddd6c6] p-1">
            <button
              type="button"
              onClick={() => setView('corridor')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                view === 'corridor' ? 'bg-[#173e31] text-white' : 'text-[#565b55]'
              }`}
            >
              整路走廊
            </button>
            <button
              type="button"
              onClick={() => setView('records')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                view === 'records' ? 'bg-[#173e31] text-white' : 'text-[#565b55]'
              }`}
            >
              结构物明细
            </button>
            <button
              type="button"
              onClick={() => setView('checklist')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                view === 'checklist' ? 'bg-[#a73f2d] text-white' : 'text-[#565b55]'
              }`}
            >
              核对清单 {issueRecords.length}
            </button>
          </div>
          <div className="hidden text-xs font-bold text-[#555b56] lg:block">
            {view === 'checklist' ? '点击表头排序；筛选只影响核对清单' : '价号用于筛选与追溯，不再决定主图分轨'}
          </div>
        </section>

        {view === 'corridor' ? (
          <>
            <section className="overflow-hidden border border-[#243b32] bg-[#16241e] text-white shadow-[0_18px_50px_rgba(20,38,31,.16)]">
              <div className="border-b border-white/10 bg-[#101c17] px-5 py-4">
                <StructureLegend structures={visibleStructures} />
              </div>
              <div className="flex flex-col gap-3 border-b border-white/10 bg-[#17261f] px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#87d8b3]">
                    当前视窗 · {formatValueBillPk(viewportDomain.start)} - {formatValueBillPk(viewportDomain.end)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#8da198]">
                    缩放 {Math.round((domain.length / viewportDomain.length) * 10) / 10}× · {
                      isWheelZoomLocked
                        ? '比例已锁定，滚轮正常滚动页面'
                        : '滚轮缩放，拖动空白处平移'
                    }
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8da198]">
                    起点
                    <input
                      ref={rangeStartRef}
                      defaultValue={formatValueBillPk(viewportDomain.start)}
                      className="h-9 w-28 border border-white/20 bg-[#0f1b16] px-2 font-mono text-xs font-bold text-white outline-none focus:border-[#87d8b3]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8da198]">
                    终点
                    <input
                      ref={rangeEndRef}
                      defaultValue={formatValueBillPk(viewportDomain.end)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') applyManualRange()
                      }}
                      className="h-9 w-28 border border-white/20 bg-[#0f1b16] px-2 font-mono text-xs font-bold text-white outline-none focus:border-[#87d8b3]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyManualRange}
                    className="h-9 border border-[#87d8b3] px-3 text-xs font-black text-[#9cebc7] hover:bg-[#244c3d]"
                  >
                    定位
                  </button>
                  <button
                    type="button"
                    aria-pressed={isWheelZoomLocked}
                    data-zoom-lock
                    onClick={() => setIsWheelZoomLocked((locked) => !locked)}
                    className={`h-9 border px-3 text-xs font-black ${
                      isWheelZoomLocked
                        ? 'border-[#f0cf54] bg-[#3b3318] text-[#ffe582]'
                        : 'border-[#87d8b3] bg-[#173d30] text-[#9cebc7]'
                    }`}
                  >
                    {isWheelZoomLocked ? '缩放已锁定' : '滚轮缩放开启'}
                  </button>
                  {[250, 500, 1000].map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => setViewportLength(length)}
                      className="h-9 border border-white/15 px-3 font-mono text-xs font-black text-[#c4d0ca] hover:bg-white/10"
                    >
                      {length >= 1000 ? '1km' : `${length}m`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setViewportRange({ start: domain.start, end: domain.end })}
                    className="h-9 border border-white/15 px-3 text-xs font-black text-[#c4d0ca] hover:bg-white/10"
                  >
                    全路
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomAt(1.6, (viewportDomain.start + viewportDomain.end) / 2)}
                    aria-label="缩小"
                    className="h-9 w-9 border border-white/15 text-lg font-black hover:bg-white/10"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomAt(0.625, (viewportDomain.start + viewportDomain.end) / 2)}
                    aria-label="放大"
                    className="h-9 w-9 border border-white/15 text-lg font-black hover:bg-white/10"
                  >
                    +
                  </button>
                </div>
                {rangeError ? (
                  <div className="text-xs font-black text-[#ff8b83] xl:absolute xl:right-5 xl:translate-y-5">
                    {rangeError}
                  </div>
                ) : null}
              </div>

              <OverviewMap
                domain={domain}
                viewport={viewportDomain}
                mainlineItemsBySide={allMainlineItemsBySide}
                amorceItemsBySide={allAmorceItemsBySide}
                designBySide={designBySide}
                constructionBySide={constructionBySide}
                problemClusters={problemClusters}
                onCenter={centerViewport}
                onProblem={focusProblemCluster}
              />

              <div
                ref={corridorViewportRef}
                className={`select-none overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ touchAction: isWheelZoomLocked ? 'pan-y' : 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <div className="grid grid-cols-[120px_1fr] border-b border-white/10 bg-[#1a2b24] sm:grid-cols-[190px_1fr]">
                  <div className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#8ea49b] sm:px-5">
                    结构物覆盖
                  </div>
                  <div className="relative h-14 overflow-hidden border-l border-white/10">
                    {ticks.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute inset-y-0 border-l border-white/15"
                        style={{ left: tick.left }}
                      >
                        <span className="absolute left-2 top-4 whitespace-nowrap font-mono text-[10px] font-black text-[#b7c4be]">
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <SideCorridor
                  side="left"
                  mainlineLanes={leftMainlineLanes}
                  amorceLanes={leftAmorceLanes}
                  designItems={designBySide.CG}
                  constructionItems={constructionBySide.CG}
                  coverage={viewportLeftCoverage}
                  fullCoverage={leftCoverage}
                  domain={viewportDomain}
                  ticks={ticks}
                  selectedRecordId={selectedRecordId}
                  activeKey={activeSegment?.key ?? null}
                  onOpen={openSegment}
                  onHover={showSegmentHover}
                  onLeave={hideSegmentHover}
                />
                <RoadCenter
                  mainlineItems={mainlineItemsBySide.X}
                  amorceItems={amorceItemsBySide.X}
                  domain={viewportDomain}
                  ticks={ticks}
                  selectedRecordId={selectedRecordId}
                  activeKey={activeSegment?.key ?? null}
                  onOpen={openSegment}
                  onHover={showSegmentHover}
                  onLeave={hideSegmentHover}
                />
                <SideCorridor
                  side="right"
                  mainlineLanes={rightMainlineLanes}
                  amorceLanes={rightAmorceLanes}
                  designItems={designBySide.CD}
                  constructionItems={constructionBySide.CD}
                  coverage={viewportRightCoverage}
                  fullCoverage={rightCoverage}
                  domain={viewportDomain}
                  ticks={ticks}
                  selectedRecordId={selectedRecordId}
                  activeKey={activeSegment?.key ?? null}
                  onOpen={openSegment}
                  onHover={showSegmentHover}
                  onLeave={hideSegmentHover}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#101c17] px-4 py-3">
                <span className="text-[10px] font-semibold text-[#83968d]">
                  概览框始终表示当前放大范围；红色数字可直接跳到问题密集区。
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-black text-[#ff8b83]">
                    {problemItems.length} 条问题
                  </span>
                  <button
                    type="button"
                    onClick={() => jumpProblem(-1)}
                    disabled={!problemItems.length}
                    className="border border-white/15 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-30"
                  >
                    上一问题
                  </button>
                  <button
                    type="button"
                    onClick={() => jumpProblem(1)}
                    disabled={!problemItems.length}
                    className="border border-[#ff655b] px-3 py-1.5 text-[10px] font-black text-[#ff8b83] disabled:opacity-30"
                  >
                    下一问题
                  </button>
                </div>
              </div>
            </section>

            <section className="border border-[#c5bdab] bg-[#faf8f1]">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d7d0c0] px-5 py-4">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6b27]">
                    Coverage gaps
                  </p>
                  <h2 className="mt-1 text-lg font-black">设计连续线缺口</h2>
                </div>
                <p className="max-w-2xl text-xs font-semibold leading-5 text-[#70716a]">
                  这里只检查设计区间是否连续。缺口表示当前分项设计中没有边沟或过道涵，需确认属于无设计还是设计数据尚未录入。
                </p>
              </div>
              <div className="grid gap-px bg-[#d7d0c0] sm:grid-cols-2 xl:grid-cols-4">
                {gaps.map((gap) => (
                  <div key={`${gap.sideCode}-${gap.start}-${gap.end}`} className="bg-[#faf8f1] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`px-2 py-1 text-[10px] font-black ${
                        gap.sideCode === 'CG' ? 'bg-[#f3e6a9] text-[#674f0f]' : 'bg-[#d9edf6] text-[#23516a]'
                      }`}>
                        {gap.sideLabel} {gap.sideCode}
                      </span>
                      <span className="font-mono text-xs font-black text-[#aa4e35]">
                        {Math.round(gap.length * 10) / 10}m
                      </span>
                    </div>
                    <div className="mt-3 font-mono text-sm font-black">
                      {formatValueBillPk(gap.start)} - {formatValueBillPk(gap.end)}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#77756c]">无设计区间 / 待确认</div>
                  </div>
                ))}
                {!gaps.length ? (
                  <div className="col-span-full bg-[#edf5ef] p-8 text-center text-sm font-black text-[#2d7156]">
                    左右两侧设计区间均已连续覆盖整条道路。
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : view === 'records' ? (
          <section className="overflow-hidden border border-[#bbb3a0] bg-[#faf8f1]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
                <thead className="border-b-2 border-[#21392f] bg-[#ded8c9] text-[10px] font-black uppercase tracking-[0.13em] text-[#555d57]">
                  <tr>
                    <th className="px-4 py-3">审核</th>
                    <th className="px-4 py-3">结构物</th>
                    <th className="px-4 py-3">价号</th>
                    <th className="px-4 py-3">侧别</th>
                    <th className="px-4 py-3">记录类型</th>
                    <th className="px-4 py-3">桩号</th>
                    <th className="px-4 py-3">计量状态</th>
                    <th className="px-4 py-3 text-right">数量</th>
                    <th className="px-4 py-3">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ddd7c9]">
                  {filteredRecords.map((record) => {
                    const identity = getStructureIdentity(record)
                    return (
                      <tr
                        key={record.recordId}
                        onClick={() => openRecordById(record.recordId)}
                        className={`cursor-pointer align-top transition hover:bg-[#edf4ef] ${
                          selectedRecordId === record.recordId ? 'bg-[#e1efe7]' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex border px-2 py-1 text-[10px] font-black ${
                            getConfirmationBadgeClass(record)
                          }`}>
                            {getConfirmationLabel(record)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 font-black">
                            <span className="h-3 w-5" style={{ backgroundColor: identity.color }} />
                            {identity.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-black">{record.boqCode ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold">{getRecordSideLabel(record)}</td>
                        <td className="px-4 py-3 text-xs font-black">
                          {getValueBillAlignment(record) === 'AMORCE'
                            ? '平交路口 Amorce'
                            : '主线'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-black">{getPkRange(record)}</td>
                        <td className="px-4 py-3 text-xs font-semibold">{getValueBillMeasurementLabel(record)}</td>
                        <td className="px-4 py-3 text-right font-mono font-black">
                          {formatNumber(record.quantity)} {record.unit ?? ''}
                        </td>
                        <td className="max-w-[420px] px-4 py-3 text-xs leading-5 text-[#5f655f]">
                          {record.note ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!filteredRecords.length ? (
              <div className="p-12 text-center text-sm font-semibold text-[#6d716d]">
                当前道路还没有符合条件的结构物记录。
              </div>
            ) : null}
          </section>
        ) : (
          <section className="overflow-hidden border border-[#9f3f2f] bg-[#faf8f1] shadow-[5px_5px_0_#d8c3b9]">
            <div className="grid gap-5 border-b border-[#d8c3b9] bg-[#f2ddd4] px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#9f3f2f]">
                  Bill review checklist
                </p>
                <h2 className="mt-1 text-2xl font-black">计量核对清单</h2>
                <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-[#665c57]">
                  包含第六期全部已计量、未计量及问题记录。核对状态、计量状态和核对结论相互独立；设计缺口仍不会自动加入。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#bd887a] sm:grid-cols-4">
                <div className="bg-[#faf8f1] py-3 pr-4">
                  <Metric label="核对记录" value={issueRecords.length} tone="text-[#8c2f22]" />
                </div>
                <div className="bg-[#faf8f1] py-3 pr-4">
                  <Metric label="已确认" value={confirmedIssueCount} tone="text-[#23624b]" />
                </div>
                <div className="bg-[#faf8f1] py-3 pr-4">
                  <Metric label="待确认" value={pendingIssueCount} tone="text-[#a04a27]" />
                </div>
                <div className="bg-[#faf8f1] py-3 pr-4">
                  <Metric label="当前显示" value={sortedIssueRecords.length} tone="text-[#8c2f22]" />
                </div>
              </div>
            </div>
            <div className="border-b border-[#cdbdb2] bg-[#e8ded2] p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className={`${selectLabelClass} xl:col-span-2`}>
                  搜索
                  <input
                    value={issueSearch}
                    onChange={(event) => setIssueSearch(event.target.value)}
                    placeholder="道路、结构物、价号、桩号、备注、Excel 行"
                    className={filterControlClass}
                  />
                </label>
                <MultiSelectIssueFilter
                  label="核对状态"
                  options={[
                    { value: 'CONFIRMED', label: '已确认' },
                    { value: 'PENDING', label: '待确认' },
                  ]}
                  selected={issueConfirmationFilters}
                  onChange={setIssueConfirmationFilters}
                />
                <MultiSelectIssueFilter
                  label="计量状态"
                  options={[
                    { value: 'MEASURED', label: '已计量' },
                    { value: 'UNMEASURED', label: '未计量' },
                    { value: 'UNCLEAR', label: '未明确' },
                  ]}
                  selected={issueMeasurementFilters}
                  onChange={setIssueMeasurementFilters}
                />
                <MultiSelectIssueFilter
                  label="计量期次"
                  options={[
                    { value: 'PREVIOUS', label: '以前已计量' },
                    { value: 'ATTACHMENT_6', label: '第六期计量' },
                    { value: 'BOTH', label: '以前及第六期' },
                    { value: 'UNCLEAR', label: '未明确' },
                  ]}
                  selected={issuePeriodFilters}
                  onChange={setIssuePeriodFilters}
                />
                <MultiSelectIssueFilter
                  label="核对结论"
                  options={[
                    { value: 'NORMAL', label: '正常' },
                    { value: 'TO_MEASURE', label: '待计量' },
                    { value: 'ISSUE', label: '有问题' },
                    { value: 'PENDING', label: '待进一步确认' },
                  ]}
                  selected={issueConclusionFilters}
                  onChange={setIssueConclusionFilters}
                />
                <MultiSelectIssueFilter
                  label="记录类型"
                  options={[
                    { value: 'MAINLINE', label: '主线' },
                    { value: 'AMORCE', label: '平交路口（Amorce/RACC）' },
                  ]}
                  selected={issueAlignmentFilters}
                  onChange={setIssueAlignmentFilters}
                />
                <MultiSelectIssueFilter
                  label="道路"
                  options={issueRoadOptions.map((option) => ({ value: option, label: option }))}
                  selected={issueRoadFilters}
                  onChange={setIssueRoadFilters}
                />
                <MultiSelectIssueFilter
                  label="价号"
                  options={issueBoqOptions.map((option) => ({ value: option, label: option }))}
                  selected={issueBoqFilters}
                  onChange={setIssueBoqFilters}
                />
                <MultiSelectIssueFilter
                  label="侧别"
                  options={issueSideOptions.map((option) => ({ value: option, label: option }))}
                  selected={issueSideFilters}
                  onChange={setIssueSideFilters}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#cdbdb2] pt-3 text-xs font-semibold text-[#625f54]">
                <span>显示 {sortedIssueRecords.length} / {issueRecords.length} 条，点击表头可升序或降序排列</span>
                <button
                  type="button"
                  onClick={clearIssueFilters}
                  className="border-b border-[#7d3226] font-black uppercase tracking-[0.12em] text-[#7d3226]"
                >
                  清除清单筛选
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1640px] border-collapse text-left text-sm">
                <thead className="border-b-2 border-[#9f3f2f] bg-[#e8ded2] text-[10px] font-black uppercase tracking-[0.13em] text-[#5e554f]">
                  <tr>
                    <SortableIssueHeader label="核对 / 计量 / 结论" sortKey="status" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="结构物" sortKey="structure" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="价号" sortKey="boq" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="侧别" sortKey="side" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="桩号" sortKey="pk" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="工程量" sortKey="quantity" activeKey={issueSortKey} direction={issueSortDirection} align="right" onSort={sortIssues} />
                    <SortableIssueHeader label="合同单价" sortKey="unitPrice" activeKey={issueSortKey} direction={issueSortDirection} align="right" onSort={sortIssues} />
                    <SortableIssueHeader label="预计金额" sortKey="amount" activeKey={issueSortKey} direction={issueSortDirection} align="right" onSort={sortIssues} />
                    <SortableIssueHeader label="计算公式" sortKey="formula" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                    <SortableIssueHeader label="依据 / 备注" sortKey="note" activeKey={issueSortKey} direction={issueSortDirection} onSort={sortIssues} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfd3c8]">
                  {sortedIssueRecords.map((record) => {
                    const identity = getStructureIdentity(record)
                    const confirmation = getValueBillIssueConfirmation(record)
                    const measurementState = getValueBillMeasurementState(record)
                    const conclusion = getValueBillReviewConclusion(record)
                    const price = priceByCode.get(record.boqCode?.toUpperCase() ?? '')
                    const amount = price?.unitPrice !== null
                      && price?.unitPrice !== undefined
                      && record.quantity !== null
                      ? price.unitPrice * record.quantity
                      : null
                    return (
                      <tr
                        key={record.recordId}
                        onClick={() => openRecordById(record.recordId)}
                        className={`cursor-pointer align-top transition hover:bg-[#f7e8df] ${
                          selectedRecordId === record.recordId ? 'bg-[#f4dfd5]' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-24 flex-col items-start gap-1">
                            <span className={`inline-flex border px-2 py-1 text-[10px] font-black ${
                              confirmation === 'CONFIRMED'
                                ? 'border-emerald-700/20 bg-emerald-100 text-emerald-900'
                                : 'border-amber-700/20 bg-amber-100 text-amber-950'
                            }`}>
                              {confirmation === 'CONFIRMED' ? '已确认' : '待确认'}
                            </span>
                            <span className={`inline-flex border px-2 py-1 text-[10px] font-black ${
                              measurementState === 'UNMEASURED'
                                ? 'border-sky-700/20 bg-sky-100 text-sky-950'
                                : measurementState === 'MEASURED'
                                  ? 'border-[#37584a]/20 bg-[#e5ece7] text-[#29483b]'
                                  : 'border-stone-500/20 bg-stone-100 text-stone-700'
                            }`}>
                              {measurementStateLabels[measurementState]}
                            </span>
                            <span className={`inline-flex border px-2 py-1 text-[10px] font-black ${
                              conclusion === 'NORMAL'
                                ? 'border-emerald-700/20 bg-emerald-50 text-emerald-900'
                                : conclusion === 'TO_MEASURE'
                                  ? 'border-sky-700/20 bg-sky-100 text-sky-950'
                                : conclusion === 'ISSUE'
                                  ? 'border-red-700/20 bg-red-100 text-red-900'
                                  : 'border-amber-700/20 bg-amber-50 text-amber-950'
                            }`}>
                              {reviewConclusionLabels[conclusion]}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[320px] px-4 py-3">
                          <span className="inline-flex items-center gap-2 font-black">
                            <span className="h-3 w-5" style={{ backgroundColor: identity.color }} />
                            {getIssueStructureLabel(record)}
                          </span>
                          <div className="mt-1 text-[10px] font-semibold text-[#777069]">
                            {record.roadZh ?? record.roadRaw ?? '道路未明确'} · {getValueBillMeasurementLabel(record)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-black">{record.boqCode ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold">{getRecordSideLabel(record)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-black">
                          {getPkRange(record)}
                          {getIssueSourceRows(record) ? (
                            <div className="mt-1 font-sans text-[10px] font-semibold text-[#8b8178]">
                              {getIssueSourceRows(record)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black">
                          {formatNumber(record.quantity)} {record.unit ?? price?.unit ?? ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black">
                          {formatFcfa(price?.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-[#8c2f22]">
                          {formatFcfa(amount)}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 font-mono text-xs font-bold">
                          {record.formula ?? '—'}
                        </td>
                        <td className="max-w-[440px] px-4 py-3 text-xs leading-5 text-[#5f5a55]">
                          <div>{record.note ?? '—'}</div>
                          {record.issueId ? (
                            <div className="mt-2 font-mono text-[9px] font-bold text-[#958a81]">
                              {record.issueId}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!sortedIssueRecords.length ? (
              <div className="p-12 text-center text-sm font-semibold text-[#6d716d]">
                当前筛选条件下没有问题或待计量记录。
              </div>
            ) : null}
          </section>
        )}

        <section className="border border-dashed border-[#989486] bg-[#ebe6d9]/80 px-5 py-4 text-center text-xs font-bold text-[#696b64]">
          {view === 'checklist'
            ? '点击任意记录，弹框查看原始审核数据；状态、工程量、单价和金额均可排序。'
            : '悬停色段立即查看状态；点击设计、施工或计量色段，弹框查看该段完整数据。'}
        </section>

        <footer className="flex flex-col justify-between gap-3 border-t-2 border-[#1d3d31] py-4 text-xs font-semibold text-[#5c625d] sm:flex-row sm:items-center">
          <span>
            数据只读 · {review.projectName} · {review.attachmentLabel} · 数据库记录 {review.recordCount} 条 · 导入 {formatDateTime(review.importedAt)}
          </span>
          <Link href="/value" className="font-black text-[#1d5d48] hover:underline">返回产值首页</Link>
        </footer>
      </main>
      {hoveredSegment && !activeSegment ? <SegmentHoverCard hovered={hoveredSegment} /> : null}
      {activeSegment ? (
        <SegmentDetailModal
          detail={activeSegment}
          record={selectedRecord}
          onClose={() => {
            setActiveSegment(null)
            setSelectedRecordId(null)
          }}
        />
      ) : null}
    </div>
  )
}
