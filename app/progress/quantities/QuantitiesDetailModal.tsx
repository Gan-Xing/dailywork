'use client'

import { useEffect, useMemo, useState } from 'react'

import { Modal } from '@/components/Modal'
import type { RoadPhaseQuantityDetailDTO } from '@/lib/phaseItemTypes'

import QuantitiesDetailClient from './[id]/QuantitiesDetailClient'

type Props = {
  phaseId: number | null
  intervalId: number | null
  open: boolean
  onClose: () => void
}

type ApiResponse = {
  detail?: RoadPhaseQuantityDetailDTO
  canEdit?: boolean
  message?: string
}

export function QuantitiesDetailModal({ phaseId, intervalId, open, onClose }: Props) {
  const [detail, setDetail] = useState<RoadPhaseQuantityDetailDTO | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtitle = useMemo(() => {
    if (!detail) return ''
    const interval = detail.intervals[0]
    const side = interval.side === 'LEFT' ? '左' : interval.side === 'RIGHT' ? '右' : '双侧'
    return `${detail.road.name} · ${detail.phase.definitionName} · PK ${interval.startPk} - ${interval.endPk} · ${side}`
  }, [detail])

  useEffect(() => {
    if (!open) return
    if (!phaseId || !intervalId) return
    const controller = new AbortController()
    Promise.resolve().then(() => {
      setLoading(true)
      setError(null)
      setDetail(null)
    })

    fetch(`/api/progress/quantities/detail?phaseId=${phaseId}&intervalId=${intervalId}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ApiResponse
        if (!response.ok) {
          throw new Error(payload.message ?? '加载详情失败')
        }
        return payload
      })
      .then((payload) => {
        if (payload.detail) {
          setDetail(payload.detail)
          setCanEdit(Boolean(payload.canEdit))
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [intervalId, open, phaseId])

  return (
    <Modal
      open={open}
      title="分项区间详情"
      subtitle={subtitle}
      onClose={onClose}
      widthClassName="max-w-[1200px]"
    >
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">正在加载区间详情…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : detail ? (
        <QuantitiesDetailClient detail={detail} canEdit={canEdit} variant="modal" />
      ) : (
        <div className="py-10 text-center text-sm text-slate-500">无可显示的区间。</div>
      )}
    </Modal>
  )
}
