import { useCallback, useEffect, useState } from 'react'

import type { MachineLogsPageData } from '@/types/machineLogs'

export function useMachineLogsData({
  authLoaded,
  canViewMachineLogs,
  date,
  loadErrorMessage,
}: {
  authLoaded: boolean
  canViewMachineLogs: boolean
  date: string
  loadErrorMessage: string
}) {
  const [data, setData] = useState<MachineLogsPageData | null>(null)
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
      const res = await fetch(`/api/resources/machines/logs?date=${encodeURIComponent(date)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(loadErrorMessage)
      const json = (await res.json()) as MachineLogsPageData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMachineLogs, date, loadErrorMessage])

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
