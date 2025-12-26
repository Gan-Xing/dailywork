import { useCallback, useEffect, useState } from 'react'

import { type EmploymentStatus } from '@/lib/i18n/members'
import type { Member, Permission, Role } from '@/types/members'

type UseMembersDataParams = {
  authLoaded: boolean
  canViewMembers: boolean
  canViewPermissions: boolean
  canViewRole: boolean
  canAssignRole: boolean
  loadErrorMessage: string
}

export function useMembersData({
  authLoaded,
  canViewMembers,
  canViewPermissions,
  canViewRole,
  canAssignRole,
  loadErrorMessage,
}: UseMembersDataParams) {
  const [membersData, setMembersData] = useState<Member[]>([])
  const [rolesData, setRolesData] = useState<Role[]>([])
  const [permissionsData, setPermissionsData] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!authLoaded) return
    setLoading(true)
    setError(null)
    try {
      const tasks: Promise<void>[] = []
      const shouldLoadRoles = canViewRole || canAssignRole

      if (canViewMembers) {
        const memberTask = fetch('/api/members')
          .then((res) => {
            if (!res.ok) throw new Error(loadErrorMessage)
            return res.json() as Promise<{ members: Member[] }>
          })
          .then((membersJson) =>
            setMembersData(
              (membersJson.members ?? []).map((member) => ({
                ...member,
                employmentStatus: (member.employmentStatus ?? 'ACTIVE') as EmploymentStatus,
                phones: member.phones ?? [],
                tags: member.tags ?? [],
              })),
            ),
          )
        tasks.push(memberTask)
      } else {
        setMembersData([])
      }

      if (shouldLoadRoles) {
        const rolesTask = fetch('/api/roles')
          .then((res) => {
            if (!res.ok) throw new Error(loadErrorMessage)
            return res.json() as Promise<{ roles: Role[] }>
          })
          .then((rolesJson) =>
            setRolesData(
              (rolesJson.roles ?? []).map((role) => ({
                ...role,
                permissions: role.permissions.map((permission) => ({
                  ...permission,
                  status: permission.status ?? 'ACTIVE',
                })),
              })),
            ),
          )
        tasks.push(rolesTask)
      } else {
        setRolesData([])
      }

      if (canViewPermissions) {
        const permissionsTask = fetch('/api/auth/permissions')
          .then((res) => {
            if (!res.ok) throw new Error(loadErrorMessage)
            return res.json() as Promise<{ permissions: Permission[] }>
          })
          .then((permissionsJson) =>
            setPermissionsData(
              (permissionsJson.permissions ?? []).map((permission) => ({
                ...permission,
                status: permission.status ?? 'ACTIVE',
              })),
            ),
          )
        tasks.push(permissionsTask)
      } else {
        setPermissionsData([])
      }

      await Promise.all(tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setLoading(false)
    }
  }, [authLoaded, canViewMembers, canViewPermissions, canViewRole, canAssignRole, loadErrorMessage])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    membersData,
    rolesData,
    permissionsData,
    setPermissionsData,
    loading,
    error,
    loadData,
  }
}
