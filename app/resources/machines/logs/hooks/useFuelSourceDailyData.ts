import { useCallback, useEffect, useMemo, useState } from 'react'

import type { FuelSourceDailyPageData, FuelSourceDailyRow } from '@/types/machineLogs'

type Draft = {
  received: string
  remainingEnd: string
}

const toInputString = (value: number | null) => (value == null ? '' : String(value))

export function useFuelSourceDailyData({
  authLoaded,
  canView,
  date,
  loadErrorMessage,
}: {
  authLoaded: boolean
  canView: boolean
  date: string
  loadErrorMessage: string
}) {
  const [data, setData] = useState<FuelSourceDailyPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const loadData = useCallback(async () => {
    if (!authLoaded) return
    if (!canView) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/resources/fuel-sources/daily?date=${encodeURIComponent(date)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(loadErrorMessage)
      const json = (await res.json()) as FuelSourceDailyPageData
      setData(json)
      const nextDrafts: Record<string, Draft> = {}
      json.rows.forEach((row) => {
        nextDrafts[String(row.fuelSource.id)] = {
          received: toInputString(row.received),
          remainingEnd: toInputString(row.remainingEnd),
        }
      })
      setDrafts(nextDrafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canView, date, loadErrorMessage])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rowsWithDrafts = useMemo(() => {
    const rows = data?.rows ?? []
    return rows.map((row) => {
      const draft = drafts[String(row.fuelSource.id)] ?? { received: '', remainingEnd: '' }
      return { row, draft }
    })
  }, [drafts, data?.rows])

  const updateDraft = useCallback((fuelSourceId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const key = String(fuelSourceId)
      const next = { ...prev }
      next[key] = { ...(prev[key] ?? { received: '', remainingEnd: '' }), ...patch }
      return next
    })
  }, [])

  const save = useCallback(
    async (fuelSourceId: number) => {
      const key = String(fuelSourceId)
      const draft = drafts[key]
      if (!draft) return

      const parseValue = (value: string) => {
        const trimmed = value.trim()
        if (!trimmed) return null
        const parsed = Number(trimmed)
        return Number.isFinite(parsed) ? parsed : null
      }

      const payload = {
        date,
        fuelSourceId,
        received: parseValue(draft.received),
        remainingEnd: parseValue(draft.remainingEnd),
      }

      setSaving((prev) => ({ ...prev, [key]: true }))
      try {
        const res = await fetch('/api/resources/fuel-sources/daily', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || '保存失败')
        }
        await loadData()
      } finally {
        setSaving((prev) => ({ ...prev, [key]: false }))
      }
    },
    [date, drafts, loadData],
  )

  return {
    data,
    rowsWithDrafts,
    loading,
    error,
    saving,
    loadData,
    updateDraft,
    save,
  }
}

export const getFuelSourceLabel = (row: FuelSourceDailyRow) => {
  const source = row.fuelSource
  if (source.type === 'TANK') return source.name
  const plate = source.machine?.plateNumber?.trim() || ''
  const suffix = plate ? `（${plate}）` : ''
  return `${source.name}${suffix}`
}
