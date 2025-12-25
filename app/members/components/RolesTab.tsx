import { ActionButton } from '@/components/members/MemberButtons'
import { memberCopy } from '@/lib/i18n/members'
import type { Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type RolesTabProps = {
  t: MemberCopy
  rolesData: Role[]
  canViewRole: boolean
  canCreateRole: boolean
  canUpdateRole: boolean
  canDeleteRole: boolean
  onOpenCreateRoleModal: () => void
  onEditRole: (role: Role) => void
  onDeleteRole: (roleId: number) => void
}

export function RolesTab({
  t,
  rolesData,
  canViewRole,
  canCreateRole,
  canUpdateRole,
  canDeleteRole,
  onOpenCreateRoleModal,
  onEditRole,
  onDeleteRole,
}: RolesTabProps) {
  return (
    <div className="space-y-4 p-6">
      {!canViewRole ? (
        <div className="text-sm text-rose-600">
          {t.access.needRoleView}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t.rolePanel.title}
              </p>
              <p className="text-xs text-slate-500">
                {t.rolePanel.countPrefix} · {rolesData.length} {t.rolePanel.countUnit}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenCreateRoleModal}
                disabled={!canCreateRole}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.actions.createRole}
              </button>
              <ActionButton>{t.actions.import}</ActionButton>
              <ActionButton>{t.actions.export}</ActionButton>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rolesData.map((role) => (
              <div
                key={role.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-inner"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                    <p className="text-xs text-slate-600">
                      {t.rolePanel.permissions}：{role.permissions.length}
                    </p>
                  </div>
                  {canUpdateRole || canDeleteRole ? (
                    <div className="flex items-center gap-2">
                      {canUpdateRole ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={() => onEditRole(role)}
                        >
                          {t.actions.edit}
                        </button>
                      ) : null}
                      {canDeleteRole ? (
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          onClick={() => onDeleteRole(role.id)}
                        >
                          {t.actions.delete}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {role.permissions.map((permission) => (
                    <span
                      key={`${role.id}-${permission.code}`}
                      className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200"
                    >
                      {permission.code}
                    </span>
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
