import type { FormEvent } from 'react'

import { memberCopy } from '@/lib/i18n/members'
import type { Permission } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type RoleFormState = { name: string; permissionIds: number[] }

type RoleModalProps = {
  t: MemberCopy
  open: boolean
  editingRoleId: number | null
  roleFormState: RoleFormState
  roleError: string | null
  roleSubmitting: boolean
  permissionsData: Permission[]
  activePermissions: Permission[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onNameChange: (value: string) => void
  onTogglePermission: (permissionId: number) => void
}

export function RoleModal({
  t,
  open,
  editingRoleId,
  roleFormState,
  roleError,
  roleSubmitting,
  permissionsData,
  activePermissions,
  onClose,
  onSubmit,
  onNameChange,
  onTogglePermission,
}: RoleModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {editingRoleId ? t.rolePanel.editTitle : t.rolePanel.title}
            </p>
            <p className="text-sm text-slate-500">{t.rolePanel.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            X
          </button>
        </div>

        <form className="mt-4 flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="space-y-4 overflow-y-auto pr-1">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.roleName}</span>
              <input
                value={roleFormState.name}
                onChange={(event) => onNameChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={t.rolePanel.namePlaceholder}
              />
            </label>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">{t.rolePanel.permissions}</p>
              {permissionsData.length === 0 ? (
                <p className="text-xs text-slate-500">{t.feedback.loading}</p>
              ) : activePermissions.length === 0 ? (
                <p className="text-xs text-slate-500">{t.filters.noOptions}</p>
              ) : (
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  {activePermissions.map((permission) => (
                    <label
                      key={permission.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                        roleFormState.permissionIds.includes(permission.id)
                          ? 'border-sky-300 bg-white text-sky-800 ring-1 ring-sky-100'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-sky-600"
                        checked={roleFormState.permissionIds.includes(permission.id)}
                        onChange={() => onTogglePermission(permission.id)}
                      />
                      <div className="flex flex-col">
                        <span>{permission.code}</span>
                        <span className="text-[10px] font-normal text-slate-500">{permission.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {roleError ? <p className="pt-3 text-sm text-rose-600">{roleError}</p> : null}

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={roleSubmitting}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
