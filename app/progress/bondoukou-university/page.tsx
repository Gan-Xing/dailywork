'use client'

import Link from 'next/link'
import { useState } from 'react'

type Status = '未施工' | '验收中' | '已验收' | '非设计'
type Measure = '延米' | '单体'
type SideSelection = '双侧' | '左侧' | '右侧'
type IntervalSide = '双侧' | '左侧' | '右侧'

interface Segment {
  start: number
  end: number
  status: Status
}

interface Side {
  label: string
  segments: Segment[]
}

interface PhaseLine {
  name: string
  designLength: number
  left: Side
  right: Side
}

interface StructureItem {
  name: string
  pk: number
  side: '左' | '右'
  status: Status
  completion: number
}

interface Phase {
  name: string
  measure: Measure
  designAmount: number
  sides?: ('左' | '右' | '双侧')[]
  linear?: PhaseLine
  points?: StructureItem[]
}

const statusTone: Record<Status, string> = {
  未施工: 'bg-gradient-to-r from-white via-slate-100 to-white text-slate-900 shadow-sm shadow-slate-900/10',
  验收中: 'bg-gradient-to-r from-amber-300 via-orange-200 to-amber-200 text-slate-900 shadow-md shadow-amber-400/30',
  已验收: 'bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-200 text-slate-900 shadow-md shadow-emerald-400/30',
  非设计: 'bg-slate-700 text-slate-100 shadow-inner shadow-slate-900/40',
}

const legend: { label: string; status: Status }[] = [
  { label: '未施工（可点报检）', status: '未施工' },
  { label: '验收中', status: '验收中' },
  { label: '已验收', status: '已验收' },
  { label: '非设计', status: '非设计' },
]

const DESIGN_LENGTH = 1940
const ROAD_START = 0
const ROAD_END = DESIGN_LENGTH

const initialPhases: Phase[] = [
  {
    name: '土方',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '土方',
      designLength: DESIGN_LENGTH,
      left: {
        label: '左侧',
        segments: [
          { start: 0, end: 1000, status: '已验收' },
          { start: 1000, end: 1200, status: '验收中' },
          { start: 1200, end: 1940, status: '已验收' },
        ],
      },
      right: {
        label: '右侧',
        segments: [
          { start: 0, end: 900, status: '已验收' },
          { start: 900, end: 1100, status: '验收中' },
          { start: 1100, end: 1500, status: '已验收' },
          { start: 1500, end: 1940, status: '未施工' },
        ],
      },
    },
  },
  {
    name: '垫层',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '垫层',
      designLength: DESIGN_LENGTH,
      left: {
        label: '左侧',
        segments: [
          { start: 0, end: 800, status: '已验收' },
          { start: 800, end: 1200, status: '验收中' },
          { start: 1200, end: DESIGN_LENGTH, status: '未施工' },
        ],
      },
      right: {
        label: '右侧',
        segments: [
          { start: 0, end: 750, status: '已验收' },
          { start: 750, end: 1100, status: '验收中' },
          { start: 1100, end: DESIGN_LENGTH, status: '未施工' },
        ],
      },
    },
  },
  {
    name: '底基层',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '底基层',
      designLength: DESIGN_LENGTH,
      left: {
        label: '左侧',
        segments: [
          { start: 0, end: 600, status: '验收中' },
          { start: 600, end: DESIGN_LENGTH, status: '未施工' },
        ],
      },
      right: {
        label: '右侧',
        segments: [
          { start: 0, end: 500, status: '验收中' },
          { start: 500, end: DESIGN_LENGTH, status: '未施工' },
        ],
      },
    },
  },
  {
    name: '基层',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '基层',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '透层',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '透层',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '粘层',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '粘层',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '面层路面',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '面层路面',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '面层路肩',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '面层路肩',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '边沟',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '边沟',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '路缘石',
    measure: '延米',
    designAmount: DESIGN_LENGTH,
    linear: {
      name: '路缘石',
      designLength: DESIGN_LENGTH,
      left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
      right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    },
  },
  {
    name: '圆管涵',
    measure: '单体',
    designAmount: 4,
    points: [
      { name: '圆管涵 1', pk: 14, side: '左', status: '验收中', completion: 50 },
      { name: '圆管涵 2', pk: 1450, side: '右', status: '未施工', completion: 0 },
    ],
  },
]

const upcomingInspections = [
  { title: '垫层 PK0+800~1200', status: '验收中 · 现场会签待完成' },
  { title: '涵洞 PK0+014 · 底板浇筑', status: '验收中 · 等待试件结果' },
  { title: '土方 PK0+900~1100', status: '验收中 · 试验室抽检' },
]

const hasOverlap = (segments: Segment[], candidate: Segment, ignoreIndex?: number) => {
  return segments.some((seg, index) => {
    if (index === ignoreIndex) return false
    return !(candidate.end <= seg.start || candidate.start >= seg.end)
  })
}

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = value % 1000
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const calcCombinedPercent = (left: Side, right: Side, designLength: number) => {
  const total = designLength * 2
  const completed =
    left.segments.reduce(
      (acc, seg) => (seg.status === '已验收' ? acc + (seg.end - seg.start) : acc),
      0,
    ) +
    right.segments.reduce(
      (acc, seg) => (seg.status === '已验收' ? acc + (seg.end - seg.start) : acc),
      0,
    )
  const donePct = Math.round((completed / total) * 100)
  return { donePct }
}

const calcDesignAmount = (phase: Phase) => {
  if (phase.measure === '单体') {
    return phase.points?.length ?? 0
  }
  if (phase.linear) {
    const left = phase.linear.left.segments.reduce((acc, seg) => {
      const len = Math.max(0, seg.end - seg.start)
      return seg.status === '非设计' ? acc : acc + len
    }, 0)
    const right = phase.linear.right.segments.reduce((acc, seg) => {
      const len = Math.max(0, seg.end - seg.start)
      return seg.status === '非设计' ? acc : acc + len
    }, 0)
    return left + right
  }
  return phase.designAmount
}

const fillNonDesignGaps = (segments: Segment[], start = ROAD_START, end = ROAD_END): Segment[] => {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const filled: Segment[] = []
  let cursor = start
  sorted.forEach((seg) => {
    if (seg.start > cursor) {
      filled.push({ start: cursor, end: seg.start, status: '非设计' })
    }
    filled.push(seg)
    cursor = Math.max(cursor, seg.end)
  })
  if (cursor < end) {
    filled.push({ start: cursor, end, status: '非设计' })
  }
  return filled
}

const SegmentBar = ({
  designLength,
  side,
  phaseName,
  onSelect,
}: {
  designLength: number
  side: Side
  phaseName: string
  onSelect?: (payload: { phase: string; side: string; start: number; end: number }) => void
}) => {
  const total = Math.max(designLength, ...side.segments.map((seg) => seg.end))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-200/80">
        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">{side.label}</span>
        <span className="text-slate-300">
          {formatPK(0)} – {formatPK(total)}
        </span>
      </div>
      <div className="rounded-full bg-slate-900/70 p-1 shadow-inner shadow-slate-900/50">
        <div className="flex h-8 overflow-hidden rounded-full bg-slate-800/60">
          {side.segments.map((seg, index) => {
            const width = ((seg.end - seg.start) / total) * 100
            return (
              <button
                key={`${seg.start}-${seg.end}-${index}`}
                type="button"
                className={`${statusTone[seg.status]} flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                style={{ width: `${width}%` }}
                title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${seg.status} ${
                  seg.type ? `· ${seg.type}` : ''
                }（点击白色区域预约报检）`}
                onClick={() => {
                  if (seg.status === '未施工' && onSelect) {
                    onSelect({ phase: phaseName, side: side.label, start: seg.start, end: seg.end })
                  }
                }}
              >
                <span className="px-1">
                  {formatPK(seg.start)}–{formatPK(seg.end)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const SegmentEditor = ({
  segments,
  designLength,
  onChange,
}: {
  segments: Segment[]
  designLength: number
  onChange: (segments: Segment[]) => void
}) => {
  const [start, setStart] = useState<number>(0)
  const [end, setEnd] = useState<number>(0)
  const [status, setStatus] = useState<Status>('未施工')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string>('')

  const resetForm = () => {
    setStart(0)
    setEnd(0)
    setStatus('未施工')
    setEditingIndex(null)
    setError('')
  }

  const handleSubmit = () => {
    const candidate: Segment = { start, end, status }
    if (candidate.start < 0 || candidate.end <= candidate.start || candidate.end > designLength) {
      setError(`起点终点需在 0-${designLength} 且起点小于终点`)
      return
    }
    if (hasOverlap(segments, candidate, editingIndex ?? undefined)) {
      setError('与已有分段重叠，请调整区间')
      return
    }
    const next = [...segments]
    if (editingIndex !== null) {
      next[editingIndex] = candidate
    } else {
      next.push(candidate)
    }
    next.sort((a, b) => a.start - b.start)
    onChange(next)
    resetForm()
  }

  const handleEdit = (index: number) => {
    const seg = segments[index]
    setStart(seg.start)
    setEnd(seg.end)
    setStatus(seg.status)
    setEditingIndex(index)
    setError('')
  }

  const handleDelete = (index: number) => {
    const next = segments.filter((_, i) => i !== index)
    onChange(next)
    if (editingIndex === index) resetForm()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-100">编辑分段（起止单位：米）</p>
        {editingIndex !== null ? (
          <button
            type="button"
            className="text-xs text-emerald-200 underline decoration-dotted"
            onClick={resetForm}
          >
            取消编辑
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs text-slate-200/80">
          起点
          <input
            type="number"
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={start}
            min={0}
            max={designLength}
            onChange={(e) => setStart(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-slate-200/80">
          终点
          <input
            type="number"
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={end}
            min={0}
            max={designLength}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-slate-200/80">
          状态
          <select
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="未施工">未施工</option>
            <option value="验收中">验收中</option>
            <option value="已验收">已验收</option>
            <option value="非设计">非设计</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-emerald-400/30 transition hover:-translate-y-0.5"
          onClick={handleSubmit}
        >
          {editingIndex !== null ? '保存修改' : '新增分段'}
        </button>
        <p className="text-xs text-slate-300">
          已有分段：{segments.length} 个，范围 0–{designLength} 米；避免重叠。
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs text-slate-100">
        {segments.length === 0 ? (
          <p className="text-slate-300">暂无分段，先新增一条。</p>
        ) : (
          segments.map((seg, index) => (
            <div
              key={`${seg.start}-${seg.end}-${index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {formatPK(seg.start)}–{formatPK(seg.end)}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {seg.status}
                </span>
                {seg.type ? (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                    {seg.type}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-emerald-200 hover:text-emerald-100"
                  onClick={() => handleEdit(index)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-rose-200 hover:text-rose-100"
                  onClick={() => handleDelete(index)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const PointEditor = ({
  items,
  onChange,
}: {
  items: StructureItem[]
  onChange: (items: StructureItem[]) => void
}) => {
  const [name, setName] = useState('')
  const [pk, setPk] = useState<number>(0)
  const [side, setSide] = useState<'左' | '右'>('左')
  const [status, setStatus] = useState<Status>('未施工')
  const [completion, setCompletion] = useState<number>(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const resetForm = () => {
    setName('')
    setPk(0)
    setSide('左')
    setStatus('未施工')
    setCompletion(0)
    setEditingIndex(null)
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    const value = Math.max(0, completion)
    const candidate: StructureItem = {
      name: name.trim(),
      pk,
      side,
      status,
      completion: Math.min(100, value),
    }
    const next = [...items]
    if (editingIndex !== null) {
      next[editingIndex] = candidate
    } else {
      next.push(candidate)
    }
    next.sort((a, b) => a.pk - b.pk)
    onChange(next)
    resetForm()
  }

  const handleEdit = (index: number) => {
    const item = items[index]
    setName(item.name)
    setPk(item.pk)
    setSide(item.side)
    setStatus(item.status)
    setCompletion(item.completion)
    setEditingIndex(index)
  }

  const handleDelete = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    onChange(next)
    if (editingIndex === index) resetForm()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-100">单体条目</p>
        {editingIndex !== null ? (
          <button
            type="button"
            className="text-xs text-emerald-200 underline decoration-dotted"
            onClick={resetForm}
          >
            取消编辑
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="text-xs text-slate-200/80 sm:col-span-2">
          名称
          <input
            type="text"
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-200/80">
          PK 位置
          <input
            type="number"
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={pk}
            min={0}
            max={DESIGN_LENGTH}
            onChange={(e) => setPk(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-slate-200/80">
          侧别
          <select
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={side}
            onChange={(e) => setSide(e.target.value as '左' | '右')}
          >
            <option value="左">左</option>
            <option value="右">右</option>
          </select>
        </label>
        <label className="text-xs text-slate-200/80">
          状态
          <select
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="未施工">未施工</option>
            <option value="验收中">验收中</option>
            <option value="已验收">已验收</option>
            <option value="非设计">非设计</option>
          </select>
        </label>
        <label className="text-xs text-slate-200/80">
          完成度 %
          <input
            type="number"
            className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
            value={completion}
            min={0}
            max={100}
            onChange={(e) => setCompletion(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-emerald-400/30 transition hover:-translate-y-0.5"
          onClick={handleSubmit}
        >
          {editingIndex !== null ? '保存修改' : '新增条目'}
        </button>
        <p className="text-xs text-slate-300">支持按 PK 排序的单体/点状工作。</p>
      </div>
      <div className="space-y-2 rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs text-slate-100">
        {items.length === 0 ? (
          <p className="text-slate-300">暂无条目，先新增一条。</p>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.name}-${item.pk}-${index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {item.name}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {formatPK(item.pk)}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {item.side}侧
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {item.status}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                  {item.completion}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-emerald-200 hover:text-emerald-100"
                  onClick={() => handleEdit(index)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-rose-200 hover:text-rose-100"
                  onClick={() => handleDelete(index)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function BondoukouUniversityRoad() {
  const [phaseLines, setPhaseLines] = useState<Phase[]>(initialPhases)
  const [selectedSegment, setSelectedSegment] = useState<{
    phase: string
    side: string
    start: number
    end: number
  } | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newMeasure, setNewMeasure] = useState<Measure>('延米')
  const [newSegments, setNewSegments] = useState<{ start: number; end: number; side: IntervalSide }[]>([
    { start: ROAD_START, end: ROAD_END, side: '双侧' },
  ])
  const [newPhaseError, setNewPhaseError] = useState('')
  const canEdit = true

  const handleAddSegmentRow = () => {
    setNewSegments((prev) => [...prev, { start: ROAD_START, end: ROAD_END, side: '双侧' }])
  }

  const handleSegmentChange = (index: number, field: 'start' | 'end', value: number) => {
    setNewSegments((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    )
  }

  const handleSegmentSideChange = (index: number, side: IntervalSide) => {
    setNewSegments((prev) => prev.map((item, idx) => (idx === index ? { ...item, side } : item)))
  }

  const handleSegmentDelete = (index: number) => {
    setNewSegments((prev) => prev.filter((_, idx) => idx !== index))
  }

  const computeDesignAmount = () => {
    if (newMeasure === '单体') return newSegments.length
    const lengthSum = newSegments.reduce((acc, seg) => acc + Math.max(0, seg.end - seg.start), 0)
    const leftSum = newSegments
      .filter((seg) => seg.side === '左侧' || seg.side === '双侧')
      .reduce((acc, seg) => acc + Math.max(0, seg.end - seg.start), 0)
    const rightSum = newSegments
      .filter((seg) => seg.side === '右侧' || seg.side === '双侧')
      .reduce((acc, seg) => acc + Math.max(0, seg.end - seg.start), 0)
    return newMeasure === '延米' ? leftSum + rightSum : lengthSum
  }

  const handleCreatePhase = () => {
    if (!newPhaseName.trim()) {
      setNewPhaseError('请填写名称')
      return
    }
    if (newSegments.length === 0) {
      setNewPhaseError('请至少添加一段或一个点')
      return
    }
    if (newMeasure === '延米' && newSegments.every((seg) => seg.end <= seg.start)) {
      setNewPhaseError('延米分项至少需要一个终点大于起点的区间')
      return
    }

    const baseSegments = newSegments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      status: '未施工' as Status,
      side: seg.side,
    }))
    const designAmount = computeDesignAmount()
    const maxEnd = Math.max(...newSegments.map((seg) => seg.end), ROAD_END)

    const newPhase: Phase =
      newMeasure === '单体'
        ? {
            name: newPhaseName.trim(),
            measure: '单体',
            designAmount,
            points: newSegments.map((seg, idx) => ({
              name: `${newPhaseName.trim()} ${idx + 1}`,
              pk: seg.end,
              side: seg.side === '右侧' ? '右' : '左',
              status: '未施工',
              completion: 0,
            })),
          }
        : {
            name: newPhaseName.trim(),
            measure: '延米',
            designAmount,
            linear: {
              name: newPhaseName.trim(),
              designLength: maxEnd,
              left: {
                label: '左侧',
                segments: fillNonDesignGaps(
                  baseSegments
                    .filter((seg) => seg.side === '左侧' || seg.side === '双侧')
                    .map((seg) => ({ start: seg.start, end: seg.end, status: seg.status })),
                  ROAD_START,
                  ROAD_END,
                ),
              },
              right: {
                label: '右侧',
                segments: fillNonDesignGaps(
                  baseSegments
                    .filter((seg) => seg.side === '右侧' || seg.side === '双侧')
                    .map((seg) => ({ start: seg.start, end: seg.end, status: seg.status })),
                  ROAD_START,
                  ROAD_END,
                ),
              },
            },
          }

    setPhaseLines((prev) => [...prev, newPhase])
    setNewPhaseName('')
    setNewMeasure('延米')
    setNewSegments([{ start: ROAD_START, end: ROAD_END, side: '双侧' }])
    setNewPhaseError('')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-8 -z-10 h-52 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />

        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Bondoukou / 邦杜库
            <span className="h-px w-10 bg-white/30" />
            大学城路
          </div>
          <h1 className="text-4xl font-semibold leading-tight">大学城路 · 线性工程总览</h1>
          <p className="max-w-3xl text-sm text-slate-200/80">
            Mock 版现场进度：全长 {formatPK(0)} ~ {formatPK(DESIGN_LENGTH)}，颜色区分未施工、验收中、已验收、非设计段。白色区段可点击预约报检弹窗（占位）。
          </p>
          <div className="flex gap-3">
            <Link
              href="/progress"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
            >
              返回看板
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
            >
              去日报提交报检
            </Link>
            {canEdit ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-300/80 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
                onClick={() => setEditMode((prev) => !prev)}
              >
                {editMode ? '退出编辑模式' : '开启编辑模式'}
              </button>
            ) : null}
          </div>
        </header>

        <section className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            线性工程（白色区段可点击预约报检）
            <span className="h-px w-10 bg-white/30" />
            灰=非设计 白=未施工 橙=验收中 绿=已验收
          </div>
          <div className="flex flex-wrap gap-3">
            {legend.map((item) => (
              <span
                key={item.label}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[item.status]}`}
              >
                {item.label}
              </span>
            ))}
          </div>

          <div className="space-y-6">
            {phaseLines.map((phase, index) => {
              const isLinear = phase.measure === '延米' && phase.linear
              const combined = isLinear
                ? calcCombinedPercent(
                    phase.linear.left,
                    phase.linear.right,
                    phase.linear.designLength,
                  )
                : { donePct: 0 }

              return (
                <div
                  key={`${phase.name}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-slate-50">{phase.name}</p>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-100">
                        {phase.measure === '延米'
                          ? `延米 · 设计量（自动） ${calcDesignAmount(phase)} m`
                          : `单体 · 设计量（自动） ${calcDesignAmount(phase)} 个`}
                      </span>
                    </div>
                    {isLinear ? (
                      <span className="text-sm font-semibold text-emerald-200">
                        已完成 {combined.donePct}%
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-4">
                    {isLinear && phase.linear ? (
                      <>
                        <SegmentBar
                          designLength={phase.linear.designLength}
                          side={phase.linear.left}
                          phaseName={phase.name}
                          onSelect={setSelectedSegment}
                        />
                        {editMode ? (
                          <SegmentEditor
                            segments={phase.linear.left.segments}
                            designLength={phase.linear.designLength}
                            onChange={(segments) =>
                              setPhaseLines((prev) =>
                                prev.map((item) =>
                                  item.name === phase.name && item.linear
                                    ? { ...item, linear: { ...item.linear, left: { ...item.linear.left, segments } } }
                                    : item,
                                ),
                              )
                            }
                          />
                        ) : null}
                        <SegmentBar
                          designLength={phase.linear.designLength}
                          side={phase.linear.right}
                          phaseName={phase.name}
                          onSelect={setSelectedSegment}
                        />
                        {editMode ? (
                          <SegmentEditor
                            segments={phase.linear.right.segments}
                            designLength={phase.linear.designLength}
                            onChange={(segments) =>
                              setPhaseLines((prev) =>
                                prev.map((item) =>
                                  item.name === phase.name && item.linear
                                    ? { ...item, linear: { ...item.linear, right: { ...item.linear.right, segments } } }
                                    : item,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="relative mt-2 h-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40">
                          <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
                          <div className="relative flex h-full items-center justify-between">
                            {(phase.points ?? []).map((item) => {
                              const position = Math.min(
                                100,
                                Math.max(0, Math.round((item.pk / DESIGN_LENGTH) * 100)),
                              )
                              const ring = {
                                background: `conic-gradient(#34d399 ${item.completion}%, rgba(255,255,255,0.08) ${item.completion}% 100%)`,
                              }
                              return (
                                <div
                                  key={`${item.name}-${item.pk}`}
                                  className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-center"
                                  style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
                                >
                                  <div
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-lg shadow-emerald-400/25 ring-2 ring-white/20"
                                    style={ring}
                                    title={`${item.name} · ${item.side}侧 · ${item.completion}%`}
                                  >
                                    {item.completion}%
                                  </div>
                                  <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                    {item.name} · {item.side}侧
                                  </div>
                                  <p className="text-[10px] text-slate-300">{formatPK(item.pk)}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        {editMode ? (
                          <PointEditor
                            items={phase.points ?? []}
                            onChange={(items) =>
                              setPhaseLines((prev) =>
                                prev.map((item) =>
                                  item.name === phase.name ? { ...item, points: items } : item,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {editMode ? (
          <div className="space-y-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-100">
                添加分项（名称、显示方式、起终点列表，设计量自动计算）
              </p>
              {newPhaseError ? <span className="text-xs text-amber-300">{newPhaseError}</span> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs text-slate-200/80 sm:col-span-2">
                名称
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-200/80">
                显示方式
                <select
                  className="mt-1 w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-1 ring-white/10 focus:ring-emerald-300/50"
                  value={newMeasure}
                  onChange={(e) => setNewMeasure(e.target.value as Measure)}
                >
                  <option value="延米">延米（按起终点展示进度）</option>
                  <option value="单体">单体（按条目/点展示）</option>
                </select>
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-100">
              <div className="flex items-center justify-between">
                <p className="font-semibold">起点-终点列表（可多个；起点=终点可表示一个点）</p>
                <button
                  type="button"
                  className="rounded-full bg-emerald-300 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-md shadow-emerald-400/30 transition hover:-translate-y-0.5"
                  onClick={handleAddSegmentRow}
                >
                  添加区间
                </button>
              </div>
              <div className="space-y-2">
                {newSegments.map((seg, idx) => (
                  <div
                    key={`seg-${idx}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                  >
                    <label className="flex items-center gap-1 text-[11px] text-slate-200/80">
                      起点
                      <input
                        type="number"
                        className="w-24 rounded bg-slate-900/60 px-2 py-1 text-[11px] text-slate-50 ring-1 ring-white/10 focus:ring-emerald-300/50"
                        value={seg.start}
                        min={0}
                        max={DESIGN_LENGTH}
                        onChange={(e) => handleSegmentChange(idx, 'start', Number(e.target.value))}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-200/80">
                      终点
                      <input
                        type="number"
                        className="w-24 rounded bg-slate-900/60 px-2 py-1 text-[11px] text-slate-50 ring-1 ring-white/10 focus:ring-emerald-300/50"
                        value={seg.end}
                        min={0}
                        max={ROAD_END * 2}
                        onChange={(e) => handleSegmentChange(idx, 'end', Number(e.target.value))}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-200/80">
                      侧别
                      <select
                        className="w-20 rounded bg-slate-900/60 px-2 py-1 text-[11px] text-slate-50 ring-1 ring-white/10 focus:ring-emerald-300/50"
                        value={seg.side}
                        onChange={(e) => handleSegmentSideChange(idx, e.target.value as IntervalSide)}
                        disabled={newMeasure === '单体'}
                      >
                        <option value="双侧">双侧</option>
                        <option value="左侧">左侧</option>
                        <option value="右侧">右侧</option>
                      </select>
                    </label>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-100">
                      {seg.start === seg.end
                        ? '点位'
                        : `${Math.max(0, seg.end - seg.start)} m`}
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-rose-200 hover:text-rose-100"
                      onClick={() => handleSegmentDelete(idx)}
                      disabled={newSegments.length === 1}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-200">
                设计量自动计算：
                {newMeasure === '单体'
                  ? `${computeDesignAmount()} 个（单体条目数）`
                  : `${computeDesignAmount()} m（按左右侧区间叠加，仅含非“非设计”长度）`}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={() => {
                    setNewPhaseName('')
                    setNewMeasure('延米')
                    setNewSide('双侧')
                    setNewSegments([{ start: 0, end: 0 }])
                    setNewPhaseError('')
                  }}
                >
                  重置
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
                  onClick={handleCreatePhase}
                >
                  保存分项
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              说明：显示方式决定进度展示形态；设计量自动按区间或单体数量统计，延米类双侧会叠加左右长度。
            </p>
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            第二天待报检
            <span className="h-px w-10 bg-white/30" />
            白色区段点击即弹出预约报检
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-100">
            {upcomingInspections.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/10 p-3 shadow-inner shadow-slate-900/20"
              >
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-slate-200/80">{item.status}</p>
              </li>
            ))}
          </ul>
        </section>

        {selectedSegment ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-slate-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">预约报检</p>
                  <h2 className="text-xl font-semibold text-white">{selectedSegment.phase}</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/40"
                  onClick={() => setSelectedSegment(null)}
                >
                  关闭
                </button>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-100">
                <p>侧别：{selectedSegment.side}</p>
                <p>
                  区间：{formatPK(selectedSegment.start)} ~ {formatPK(selectedSegment.end)}
                </p>
                <p className="text-xs text-slate-400">
                  说明：此为示意弹窗，未来会接入真实报检表单（选择监理、备注、提交）。
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                  onClick={() => setSelectedSegment(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
                  onClick={() => setSelectedSegment(null)}
                >
                  确认预约（占位）
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
