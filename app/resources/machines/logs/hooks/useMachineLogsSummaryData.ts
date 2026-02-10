import { useCallback, useEffect, useState } from 'react'

import type { Locale } from '@/lib/i18n'
import type { MachineLogGroupBy, MachineLogsSummaryPageData } from '@/types/machineLogs'

export function useMachineLogsSummaryData({
  authLoaded,
  canViewMachineLogs,
  date,
  groupBy,
  projectId,
  mineOnly,
  locale,
  loadErrorMessage,
}: {
  authLoaded: boolean
  canViewMachineLogs: boolean
  date: string
  groupBy: MachineLogGroupBy
  projectId: string
  mineOnly: boolean
  locale: Locale
  loadErrorMessage: string
}) {
  const [data, setData] = useState<MachineLogsSummaryPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!authLoaded) return
    if (!canViewMachineLogs) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('date', date)
      params.set('groupBy', groupBy)
      if (projectId) params.set('projectId', projectId)
      params.set('locale', locale)
      if (mineOnly) params.set('mine', '1')

      const res = await fetch(`/api/resources/machines/logs/summary?${params.toString()}`, {
        credentials: 'include',
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | MachineLogsSummaryPageData | null
      if (!res.ok) {
        const message = (json && 'error' in json && typeof json.error === 'string') ? json.error : loadErrorMessage
        throw new Error(message)
      }
      setData(json as MachineLogsSummaryPageData)
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMachineLogs, date, groupBy, loadErrorMessage, locale, mineOnly, projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    data,
    setData,
    loading,
    error,
    loadData,
  }
}
