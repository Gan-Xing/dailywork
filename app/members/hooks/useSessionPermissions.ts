import { useEffect, useState } from 'react'

import type { SessionUser } from '@/lib/server/authSession'

export function useSessionPermissions() {
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

  const sessionPermissions = session?.permissions ?? []
  const hasSessionPermission = (permission: string) => sessionPermissions.includes(permission)

  const canViewMembers = hasSessionPermission('member:view')
  const canCreateMember =
    hasSessionPermission('member:create') || hasSessionPermission('member:manage')
  const canUpdateMember =
    hasSessionPermission('member:update') ||
    hasSessionPermission('member:edit') ||
    hasSessionPermission('member:manage')
  const canDeleteMember =
    hasSessionPermission('member:delete') || hasSessionPermission('member:manage')
  const canCreateRole = hasSessionPermission('role:create') || hasSessionPermission('role:manage')
  const canUpdateRole = hasSessionPermission('role:update') || hasSessionPermission('role:manage')
  const canDeleteRole = hasSessionPermission('role:delete') || hasSessionPermission('role:manage')
  const canViewRole =
    hasSessionPermission('role:view') || canCreateRole || canUpdateRole || canDeleteRole
  const canAssignRole = canUpdateRole
  const canViewPermissions = hasSessionPermission('permission:view')
  const canUpdatePermissions = hasSessionPermission('permission:update')
  const canViewPayroll =
    hasSessionPermission('payroll:view') || hasSessionPermission('payroll:manage')
  const canManagePayroll = hasSessionPermission('payroll:manage')
  const shouldShowAccessDenied = authLoaded && !canViewMembers

  return {
    authLoaded,
    canViewMembers,
    canCreateMember,
    canUpdateMember,
    canDeleteMember,
    canCreateRole,
    canUpdateRole,
    canDeleteRole,
    canViewRole,
    canAssignRole,
    canViewPermissions,
    canUpdatePermissions,
    canViewPayroll,
    canManagePayroll,
    shouldShowAccessDenied,
  }
}
