/* eslint-disable @next/next/no-img-element */
'use client'

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

import dynamic from 'next/dynamic'

import type { PointView, SelectedSegment } from './phaseEditorTypes'
import { formatPK, getPointCenter } from './phaseEditorUtils'
import type { PointProgressWaveProps } from './PointProgressWave'
import type { IntervalSide, PhaseDTO } from '@/lib/progressTypes'

const PointProgressWave = dynamic<PointProgressWaveProps>(
  () => import('./PointProgressWave').then((mod) => mod.PointProgressWave),
  {
    ssr: false,
    loading: () => <div className="h-12 w-12 animate-pulse rounded-full bg-slate-800" />,
  },
)

const useElementWidth = (ref: RefObject<HTMLElement>) => {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || typeof window === 'undefined') return

    let rafId: number | null = null
    const updateWidth = () => {
      rafId = null
      setWidth(node.clientWidth || 0)
    }
    const scheduleUpdate = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(updateWidth)
    }
    scheduleUpdate()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => scheduleUpdate())
      observer.observe(node)
      return () => {
        observer.disconnect()
        if (rafId !== null) window.cancelAnimationFrame(rafId)
      }
    }

    const handleResize = () => scheduleUpdate()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [ref])

  return width
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
  resolvePointProgress: (
    phaseId: number,
    side: IntervalSide,
    startPk: number,
    endPk: number,
  ) => {
    percent: number
    completedLayers: number
    totalLayers: number
  }
  onPointSelect: (segment: SelectedSegment) => void
}

export function PointLane({
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
          <div key={`${phase.id}-${rowIndex}`} className={containerClassName}>
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
                      <PointProgressWave percent={progress.percent} size={52} className="h-12 w-12" />
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
