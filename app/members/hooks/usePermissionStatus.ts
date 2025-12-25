import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

import { memberCopy } from '@/lib/i18n/members'
import type { Permission, PermissionStatus } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UsePermissionStatusParams = {
  t: MemberCopy
  canUpdatePermissions: boolean
  setPermissionsData: Dispatch<SetStateAction<Permission[]>>
}

export function usePermissionStatus({
  t,
  canUpdatePermissions,
  setPermissionsData,
}: UsePermissionStatusParams) {
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [editingPermissionId, setEditingPermissionId] = useState<number | null>(null)
  const [permissionStatusDraft, setPermissionStatusDraft] = useState<PermissionStatus>('ACTIVE')
  const [permissionUpdatingId, setPermissionUpdatingId] = useState<number | null>(null)

  const startEditPermission = useCallback(
    (permission: Permission) => {
      if (!canUpdatePermissions) {
        setPermissionError(t.errors.needPermissionUpdate)
        return
      }
      setPermissionError(null)
      setEditingPermissionId(permission.id)
      setPermissionStatusDraft(permission.status)
    },
    [canUpdatePermissions, t.errors.needPermissionUpdate],
  )

  const cancelEditPermission = useCallback(() => {
    setEditingPermissionId(null)
    setPermissionStatusDraft('ACTIVE')
  }, [])

  const savePermissionStatus = useCallback(async () => {
    if (!editingPermissionId) return
    if (!canUpdatePermissions) {
      setPermissionError(t.errors.needPermissionUpdate)
      return
    }
    setPermissionUpdatingId(editingPermissionId)
    setPermissionError(null)
    try {
      const res = await fetch(`/api/auth/permissions/${editingPermissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: permissionStatusDraft }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        permission?: Permission
        error?: string
      }
      if (!res.ok) {
        throw new Error(payload.error ?? t.errors.permissionUpdateFailed)
      }
      const updated = payload.permission
      setPermissionsData((prev) =>
        prev.map((permission) =>
          permission.id === editingPermissionId
            ? { ...permission, status: updated?.status ?? permissionStatusDraft }
            : permission,
        ),
      )
      setEditingPermissionId(null)
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : t.errors.permissionUpdateFailed)
    } finally {
      setPermissionUpdatingId(null)
    }
  }, [
    canUpdatePermissions,
    editingPermissionId,
    permissionStatusDraft,
    setPermissionsData,
    t.errors.needPermissionUpdate,
    t.errors.permissionUpdateFailed,
  ])

  return {
    permissionError,
    editingPermissionId,
    permissionStatusDraft,
    permissionUpdatingId,
    setPermissionStatusDraft,
    startEditPermission,
    cancelEditPermission,
    savePermissionStatus,
  }
}
