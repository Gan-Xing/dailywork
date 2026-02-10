import { useEffect, useState } from 'react'

import type { SessionUser } from '@/lib/server/authSession'

export function useResourcesSession() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        const data = (await res.json()) as { user?: SessionUser | null }
        setSession(data.user ?? null)
      } catch {
        setSession(null)
      } finally {
        setAuthLoaded(true)
      }
    }
    void fetchSession()
  }, [])

  const permissions = session?.permissions ?? []
  const has = (code: string) => permissions.includes(code)

  const canViewMachines = has('machine:view')
  const canCreateMachines = has('machine:create')
  const canUpdateMachines = has('machine:update')
  const canDeleteMachines = has('machine:delete')
  const canManageMachines = has('machine:manage')

  const canViewMachineLogs = has('machine-log:view')
  const canCreateMachineLogs = has('machine-log:create')
  const canUpdateMachineLogs = has('machine-log:update')
  const canDeleteMachineLogs = has('machine-log:delete')

  const canViewFuelSources = has('fuel-source:view')
  const canCreateFuelSources = has('fuel-source:create')
  const canUpdateFuelSources = has('fuel-source:update')
  const canDeleteFuelSources = has('fuel-source:delete')

  const canViewMaterials = has('material:view')
  const canCreateMaterials = has('material:create')
  const canUpdateMaterials = has('material:update')
  const canDeleteMaterials = has('material:delete')

  const canViewAny = canViewMachines || canViewMachineLogs || canViewMaterials

  const shouldShowAccessDenied = authLoaded && !canViewAny

  return {
    authLoaded,
    session,
    permissions,
    canViewAny,
    canViewMachines,
    canCreateMachines,
    canUpdateMachines,
    canDeleteMachines,
    canManageMachines,
    canViewMachineLogs,
    canCreateMachineLogs,
    canUpdateMachineLogs,
    canDeleteMachineLogs,
    canViewFuelSources,
    canCreateFuelSources,
    canUpdateFuelSources,
    canDeleteFuelSources,
    canViewMaterials,
    canCreateMaterials,
    canUpdateMaterials,
    canDeleteMaterials,
    shouldShowAccessDenied,
  }
}
