import { memberCopy } from '@/lib/i18n/members'
import { PERMISSION_STATUS_OPTIONS } from '@/lib/members/constants'
import type { Permission, PermissionStatus } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type PermissionGroup = {
  key: string
  items: Array<Permission & { roles: string[] }>
}

type PermissionsTabProps = {
  t: MemberCopy
  permissions: Array<Permission & { roles: string[] }>
  permissionGroups: PermissionGroup[]
  permissionError: string | null
  canViewPermissions: boolean
  canUpdatePermissions: boolean
  editingPermissionId: number | null
  permissionStatusDraft: PermissionStatus
  permissionUpdatingId: number | null
  onStartEdit: (permission: Permission) => void
  onCancelEdit: () => void
  onSave: () => void
  onChangeDraft: (next: PermissionStatus) => void
}

export function PermissionsTab({
  t,
  permissions,
  permissionGroups,
  permissionError,
  canViewPermissions,
  canUpdatePermissions,
  editingPermissionId,
  permissionStatusDraft,
  permissionUpdatingId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onChangeDraft,
}: PermissionsTabProps) {
  return (
    <div className="space-y-4 p-6">
      {!canViewPermissions ? (
        <div className="text-sm text-rose-600">
          {t.access.needPermissionView}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                {t.permissionPanel.title}
              </p>
              <p className="text-xs text-slate-500">
                {t.helpers.permissionFormat}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
              {permissions.length} items
            </span>
          </div>
          {permissionError ? (
            <div className="text-sm text-rose-600">{permissionError}</div>
          ) : null}
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm">
            {permissionGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      {group.key}
                    </span>
                    <span className="text-xs text-slate-500">
                      {group.items.length} {t.permissionPanel.title.toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((permission) => (
                    <div
                      key={permission.code}
                      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-inner"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{permission.code}</p>
                          <p className="text-xs text-slate-600">{permission.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-[11px]">
                          <span
                            className={`rounded-full px-2 py-1 font-semibold uppercase ring-1 ${
                              permission.status === 'ARCHIVED'
                                ? 'bg-amber-100 text-amber-700 ring-amber-200'
                                : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {t.permissionPanel.status}: {t.permissionPanel.statusLabels[permission.status] ?? permission.status}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold uppercase text-slate-700 ring-1 ring-slate-200">
                            {t.permissionPanel.code}: {permission.code}
                          </span>
                          {canUpdatePermissions ? (
                            editingPermissionId === permission.id ? (
                              <div className="flex flex-col items-end gap-2">
                                <select
                                  value={permissionStatusDraft}
                                  onChange={(event) => onChangeDraft(event.target.value as PermissionStatus)}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-sky-400 focus:outline-none"
                                >
                                  {PERMISSION_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {t.permissionPanel.statusLabels[status]}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={onSave}
                                    disabled={permissionUpdatingId === permission.id}
                                    className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t.actions.save}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={onCancelEdit}
                                    disabled={permissionUpdatingId === permission.id}
                                    className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t.actions.cancel}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onStartEdit(permission)}
                                className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t.permissionPanel.edit}
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-700">
                        <span className="rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
                          {t.permissionPanel.roles}: {permission.roles.length}
                        </span>
                        {permission.roles.map((role) => (
                          <span
                            key={`${permission.code}-${role}`}
                            className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-800 ring-1 ring-sky-200"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
