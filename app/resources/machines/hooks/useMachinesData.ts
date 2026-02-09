import { useCallback, useEffect, useState } from 'react'

import type { MachineAsset } from '@/types/machines'

export function useMachinesData({
  authLoaded,
  canViewMachines,
  loadErrorMessage,
}: {
  authLoaded: boolean
  canViewMachines: boolean
  loadErrorMessage: string
}) {
  const [machines, setMachines] = useState<MachineAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!authLoaded) return
    if (!canViewMachines) {
      setMachines([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/resources/machines', { credentials: 'include' })
      if (!res.ok) throw new Error(loadErrorMessage)
      const json = (await res.json()) as { machines: MachineAsset[] }
      setMachines(json.machines ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMachines, loadErrorMessage])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    machines,
    setMachines,
    loading,
    error,
    loadData,
  }
}

