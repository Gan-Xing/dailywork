import { useCallback, useEffect, useMemo, useState } from 'react'

import { normalizeTeamKey } from '@/lib/members/utils'

export type TeamSupervisorItem = {
  id: number
  team: string
  teamKey: string
  supervisorId: number
  supervisorLabel: string
  project: {
    id: number
    name: string
    code: string | null
    isActive: boolean
  } | null
}

type UseTeamSupervisorsOptions = {
  enabled?: boolean
}

export function useTeamSupervisors({ enabled = true }: UseTeamSupervisorsOptions = {}) {
  const [teamSupervisors, setTeamSupervisors] = useState<TeamSupervisorItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/team-supervisors')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '加载班组负责人失败')
      }
      const data = (await res.json()) as { teamSupervisors?: TeamSupervisorItem[] }
      setTeamSupervisors(Array.isArray(data.teamSupervisors) ? data.teamSupervisors : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载班组负责人失败')
      setTeamSupervisors([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const teamSupervisorMap = useMemo(() => {
    const map = new Map<string, TeamSupervisorItem>()
    teamSupervisors.forEach((item) => {
      const key = normalizeTeamKey(item.teamKey || item.team)
      if (!key) return
      map.set(key, item)
    })
    return map
  }, [teamSupervisors])

  return {
    teamSupervisors,
    teamSupervisorMap,
    loading,
    error,
    refresh,
  }
}
