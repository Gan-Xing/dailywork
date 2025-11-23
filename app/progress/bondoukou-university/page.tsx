'use client'

import Link from 'next/link'
import { useState } from 'react'

type Status = '未施工' | '验收中' | '已验收' | '非设计'

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

interface Structure {
  name: string
  pk: number
  side: '左' | '右'
  status: Status
  completion: number
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

const phases: PhaseLine[] = [
  {
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
  {
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
  {
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
  {
    name: '基层',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '透层',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '粘层',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '面层路面',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '面层路肩',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '边沟',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '路缘石',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
  {
    name: '圆管涵',
    designLength: DESIGN_LENGTH,
    left: { label: '左侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
    right: { label: '右侧', segments: [{ start: 0, end: DESIGN_LENGTH, status: '未施工' }] },
  },
]

const upcomingInspections = [
  { title: '垫层 PK0+800~1200', status: '验收中 · 现场会签待完成' },
  { title: '涵洞 PK0+014 · 底板浇筑', status: '验收中 · 等待试件结果' },
  { title: '土方 PK0+900~1100', status: '验收中 · 试验室抽检' },
]

const structures: Structure[] = [
  { name: '涵洞 1', pk: 14, side: '左', status: '验收中', completion: 50 },
  { name: '涵洞 2', pk: 1450, side: '右', status: '未施工', completion: 0 },
]

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
                title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${seg.status}（点击白色区域预约报检）`}
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

export default function BondoukouUniversityRoad() {
  const [selectedSegment, setSelectedSegment] = useState<{
    phase: string
    side: string
    start: number
    end: number
  } | null>(null)

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
            {phases.map((phase) => {
              const combined = calcCombinedPercent(phase.left, phase.right, phase.designLength)
              return (
                <div
                  key={phase.name}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-slate-50">{phase.name}</p>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-100">
                        设计 {phase.designLength} ml
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-200">
                      已验收 {combined.donePct}%
                    </span>
                  </div>

                  <div className="mt-3 space-y-4">
                    <SegmentBar
                      designLength={phase.designLength}
                      side={phase.left}
                      phaseName={phase.name}
                      onSelect={setSelectedSegment}
                    />
                    <SegmentBar
                      designLength={phase.designLength}
                      side={phase.right}
                      phaseName={phase.name}
                      onSelect={setSelectedSegment}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            结构物（Dalot / Traversée）
            <span className="h-px w-10 bg-white/30" />
            位置 + 环形进度
          </div>
          <div className="relative mt-6 h-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40">
            <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
            <div className="relative flex h-full items-center justify-between">
              {structures.map((item) => {
                const position = Math.min(100, Math.max(0, Math.round((item.pk / DESIGN_LENGTH) * 100)))
                const ring = {
                  background: `conic-gradient(#34d399 ${item.completion}%, rgba(255,255,255,0.08) ${item.completion}% 100%)`,
                }
                return (
                  <div
                    key={item.name}
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
        </section>

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
