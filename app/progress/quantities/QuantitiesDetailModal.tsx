'use client'

import { useEffect, useMemo, useState } from 'react'

import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ToastProvider'
import type { IntervalBoundPhaseItemDTO, RoadPhaseQuantityDetailDTO } from '@/lib/phaseItemTypes'

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
  const { addToast } = useToast()
  const [detail, setDetail] = useState<RoadPhaseQuantityDetailDTO | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boundItems, setBoundItems] = useState<IntervalBoundPhaseItemDTO[] | null>(null)
  const [boundLoading, setBoundLoading] = useState(false)
  const [boundError, setBoundError] = useState<string | null>(null)
  const [unbindIds, setUnbindIds] = useState<Set<number>>(() => new Set())

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
      setBoundItems(null)
      setBoundError(null)
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

  useEffect(() => {
    if (!open) return
    if (!intervalId) return
    const controller = new AbortController()
    setBoundLoading(true)
    setBoundError(null)

    fetch(`/api/progress/quantities/bound-items?intervalId=${intervalId}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          items?: IntervalBoundPhaseItemDTO[]
          message?: string
        }
        if (!response.ok) {
          throw new Error(payload.message ?? '加载绑定明细失败')
        }
        return payload.items ?? []
      })
      .then((items) => setBoundItems(items))
      .catch((err) => {
        if (controller.signal.aborted) return
        setBoundError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setBoundLoading(false)
      })

    return () => controller.abort()
  }, [intervalId, open])

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—'
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value)
  }

  const unbindInput = async (inputId: number) => {
    if (!canEdit) return
    if (unbindIds.has(inputId)) return
    setUnbindIds((prev) => {
      const next = new Set(prev)
      next.add(inputId)
      return next
    })
    try {
      const response = await fetch(`/api/progress/quantities/input?inputId=${inputId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? '解绑失败')
      }
      setBoundItems((prev) => (prev ? prev.filter((item) => item.inputId !== inputId) : prev))
      addToast('已解绑该分项内容', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message ?? '解绑失败', { tone: 'danger' })
    } finally {
      setUnbindIds((prev) => {
        const next = new Set(prev)
        next.delete(inputId)
        return next
      })
    }
  }

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
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                已绑定分项内容
              </div>
              <div className="text-xs text-slate-500">
                {boundItems ? `共 ${boundItems.length} 条` : ''}
              </div>
            </div>

            {boundLoading ? (
              <div className="mt-3 text-sm text-slate-500">正在加载…</div>
            ) : boundError ? (
              <div className="mt-3 text-sm text-rose-600">{boundError}</div>
            ) : !boundItems || boundItems.length === 0 ? (
              <div className="mt-3 text-sm text-slate-500">暂无绑定明细</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">分项内容</th>
                      <th className="px-3 py-2 text-right">工程量</th>
                      <th className="px-3 py-2 text-left">单位</th>
                      <th className="px-3 py-2 text-left">清单编号</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {boundItems.map((item) => {
                      const name = `${item.phaseItemName}${
                        item.phaseItemSpec ? `（${item.phaseItemSpec}）` : ''
                      }`
                      const intervalSpec = item.intervalSpec ? `【${item.intervalSpec}】` : ''
                      const hasManual = item.manualQuantity !== null
                      return (
                        <tr key={item.inputId} className="text-slate-700">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">
                              {intervalSpec} {name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              inputId {item.inputId}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-2">
                              <span>{formatNumber(item.effectiveQuantity)}</span>
                              {hasManual ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  手动
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{item.unit ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{item.boqCode ?? '—'}</td>
                          <td className="px-3 py-2 text-right">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => unbindInput(item.inputId)}
                                disabled={unbindIds.has(item.inputId)}
                                className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {unbindIds.has(item.inputId) ? '解绑中…' : '解绑'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">无权限</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <QuantitiesDetailClient detail={detail} canEdit={canEdit} variant="modal" />
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-500">无可显示的区间。</div>
      )}
    </Modal>
  )
}
