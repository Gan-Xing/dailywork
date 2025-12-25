import { useCallback, useState, type FormEvent } from 'react'

import { memberCopy } from '@/lib/i18n/members'
import type { Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type RoleFormState = { name: string; permissionIds: number[] }

type UseRoleManagementParams = {
  t: MemberCopy
  canCreateRole: boolean
  canUpdateRole: boolean
  canDeleteRole: boolean
  loadData: () => Promise<void>
}

export function useRoleManagement({
  t,
  canCreateRole,
  canUpdateRole,
  canDeleteRole,
  loadData,
}: UseRoleManagementParams) {
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleFormState, setRoleFormState] = useState<RoleFormState>({
    name: '',
    permissionIds: [],
  })
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)

  const resetRoleForm = useCallback(() => {
    setRoleFormState({ name: '', permissionIds: [] })
    setRoleError(null)
    setEditingRoleId(null)
  }, [])

  const openCreateRoleModal = useCallback(() => {
    if (!canCreateRole) {
      setRoleError(t.errors.needRoleCreate)
      return
    }
    resetRoleForm()
    setShowRoleModal(true)
  }, [canCreateRole, resetRoleForm, t.errors.needRoleCreate])

  const openEditRoleModal = useCallback((role: Role) => {
    setRoleError(null)
    setRoleFormState({
      name: role.name ?? '',
      permissionIds: role.permissions
        .filter((permission) => permission.status !== 'ARCHIVED')
        .map((permission) => permission.id),
    })
    setEditingRoleId(role.id)
    setShowRoleModal(true)
  }, [])

  const closeRoleModal = useCallback(() => {
    setShowRoleModal(false)
  }, [])

  const togglePermission = useCallback((permissionId: number) => {
    setRoleFormState((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }))
  }, [])

  const handleDeleteRole = useCallback(
    async (roleId: number) => {
      if (!canDeleteRole) {
        setRoleError(t.errors.needRoleDelete)
        return
      }
      if (!window.confirm(t.errors.roleDeleteConfirm)) return
      setRoleSubmitting(true)
      setRoleError(null)
      try {
        const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? t.feedback.submitError)
        }
        await loadData()
      } catch (err) {
        setRoleError(err instanceof Error ? err.message : t.feedback.submitError)
      } finally {
        setRoleSubmitting(false)
      }
    },
    [canDeleteRole, loadData, t.errors.needRoleDelete, t.errors.roleDeleteConfirm, t.feedback.submitError],
  )

  const handleCreateRole = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const isEditing = Boolean(editingRoleId)
      if (isEditing && !canUpdateRole) {
        setRoleError(t.errors.needRoleUpdate)
        return
      }
      if (!isEditing && !canCreateRole) {
        setRoleError(t.errors.needRoleCreate)
        return
      }
      setRoleSubmitting(true)
      setRoleError(null)
      try {
        if (!roleFormState.name.trim()) {
          throw new Error(t.errors.roleNameRequired)
        }
        const target = editingRoleId ? `/api/roles/${editingRoleId}` : '/api/roles'
        const method = editingRoleId ? 'PUT' : 'POST'
        const res = await fetch(target, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: roleFormState.name.trim(),
            permissionIds: roleFormState.permissionIds,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? t.feedback.submitError)
        }
        setShowRoleModal(false)
        await loadData()
      } catch (err) {
        setRoleError(err instanceof Error ? err.message : t.feedback.submitError)
      } finally {
        setRoleSubmitting(false)
      }
    },
    [
      canCreateRole,
      canUpdateRole,
      editingRoleId,
      loadData,
      roleFormState.name,
      roleFormState.permissionIds,
      t.errors.needRoleCreate,
      t.errors.needRoleUpdate,
      t.errors.roleNameRequired,
      t.feedback.submitError,
    ],
  )

  return {
    showRoleModal,
    roleSubmitting,
    roleError,
    roleFormState,
    editingRoleId,
    setRoleFormState,
    openCreateRoleModal,
    openEditRoleModal,
    closeRoleModal,
    togglePermission,
    handleCreateRole,
    handleDeleteRole,
  }
}
