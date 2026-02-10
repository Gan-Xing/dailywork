import { useCallback, useEffect, useState } from 'react'

import type { Locale } from '@/lib/i18n'
import type { MachineLogGroupBy, MachineLogsGroupPageData } from '@/types/machineLogs'

export function useMachineLogsGroupData({
  authLoaded,
  canViewMachineLogs,
  date,
  groupBy,
  groupKey,
  projectId,
  mineOnly,
  locale,
  loadErrorMessage,
}: {
  authLoaded: boolean
  canViewMachineLogs: boolean
  date: string
  groupBy: MachineLogGroupBy
  groupKey: string
  projectId: string
  mineOnly: boolean
  locale: Locale
  loadErrorMessage: string
}) {
  const [data, setData] = useState<MachineLogsGroupPageData | null>(null)
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
    if (!groupKey) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('date', date)
      params.set('groupBy', groupBy)
      params.set('groupKey', groupKey)
      if (projectId) params.set('projectId', projectId)
      params.set('locale', locale)
      if (mineOnly) params.set('mine', '1')

      const res = await fetch(`/api/resources/machines/logs/group?${params.toString()}`, {
        credentials: 'include',
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | MachineLogsGroupPageData | null
      if (!res.ok) {
        const message = (json && 'error' in json && typeof json.error === 'string') ? json.error : loadErrorMessage
        throw new Error(message)
      }
      setData(json as MachineLogsGroupPageData)
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMachineLogs, date, groupBy, groupKey, loadErrorMessage, locale, mineOnly, projectId])

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
