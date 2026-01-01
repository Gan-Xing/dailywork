import { useCallback, useEffect, useMemo, useState } from 'react'

export type ProjectItem = {
  id: number
  name: string
  code: string | null
  isActive: boolean
}

export type ProjectOption = {
  value: string
  label: string
  isActive: boolean
}

type UseProjectsOptions = {
  enabled?: boolean
}

const formatProjectLabel = (project: ProjectItem) =>
  project.code ? `${project.name} (${project.code})` : project.name

export function useProjects({ enabled = true }: UseProjectsOptions = {}) {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '加载项目失败')
      }
      const data = (await res.json()) as { projects?: ProjectItem[] }
      setProjects(Array.isArray(data.projects) ? data.projects : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const projectOptions = useMemo<ProjectOption[]>(
    () =>
      projects.map((project) => ({
        value: String(project.id),
        label: formatProjectLabel(project),
        isActive: project.isActive,
      })),
    [projects],
  )

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )

  return {
    projects,
    projectOptions,
    projectMap,
    loading,
    error,
    refresh,
  }
}
