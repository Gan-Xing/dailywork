import { memberCopy } from '@/lib/i18n/members'

import type { Role } from '../types'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type RoleSelectorProps = {
  t: MemberCopy
  rolesData: Role[]
  roleIds: number[]
  onToggleRole: (roleId: number) => void
  canAssignRole: boolean
}

export function RoleSelector({
  t,
  rolesData,
  roleIds,
  onToggleRole,
  canAssignRole,
}: RoleSelectorProps) {
  if (!canAssignRole) return null

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">{t.form.roles}</p>
      <div className="flex flex-wrap gap-2">
        {rolesData.map((role) => (
          <label
            key={role.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              roleIds.includes(role.id)
                ? 'border-sky-300 bg-sky-50 text-sky-800'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            <input
              type="checkbox"
              className="accent-sky-600"
              checked={roleIds.includes(role.id)}
              onChange={() => onToggleRole(role.id)}
            />
            {role.name}
          </label>
        ))}
      </div>
    </div>
  )
}
