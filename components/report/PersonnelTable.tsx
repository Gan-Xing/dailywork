'use client'

import { Fragment } from 'react'

import type { Locale, UICopy } from '@/lib/i18n'
import { personnelGroups, personnelRoles } from '@/lib/reportSchema'
import type { PersonnelCount } from '@/lib/reportState'

interface PersonnelTableProps {
  data: Record<string, PersonnelCount>
  expatriate: PersonnelCount
  onChange: (id: string, field: keyof PersonnelCount, value: string) => void
  onExpatChange: (field: keyof PersonnelCount, value: string) => void
  locale: Locale
  copy: UICopy['tables']['personnel']
}

const parse = (value: string) => (value ? Number(value) : 0)

const resolveRoleId = (groupId: string, roleId: string) => `${groupId}-${roleId}`
const roleIndex = new Map(personnelRoles.map((role) => [role.id, role]))

export function PersonnelTable({
  data,
  expatriate,
  onChange,
  onExpatChange,
  locale,
  copy,
}: PersonnelTableProps) {
  const totals = Object.values(data).reduce(
    (acc, entry) => ({
      present: acc.present + parse(entry.present),
      absent: acc.absent + parse(entry.absent),
    }),
    { present: 0, absent: 0 },
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 w-72">{copy.role}</th>
            <th className="px-3 py-2">{copy.present}</th>
            <th className="px-3 py-2">{copy.absent}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {personnelGroups.map((group) => (
            <Fragment key={group.id}>
              <tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <td className="px-3 py-2" colSpan={3}>
                  {group.title[locale]}
                </td>
              </tr>
              {group.roles.map((role) => {
                const recordId = resolveRoleId(group.id, role.id)
                const record = roleIndex.get(recordId)
                if (!record) return null
                return (
                  <tr key={record.id}>
                    <td className="px-3 py-2 font-medium">{role.label[locale]}</td>
                    {(['present', 'absent'] as const).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          className="w-24 rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          value={data[recordId]?.[field] ?? ''}
                          onChange={(event) => onChange(recordId, field, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </Fragment>
          ))}
          <tr className="bg-slate-900/5 font-semibold">
            <td className="px-3 py-2">{copy.total}</td>
            <td className="px-3 py-2">{totals.present}</td>
            <td className="px-3 py-2">{totals.absent}</td>
          </tr>
          <tr className="bg-white font-medium">
            <td className="px-3 py-2">{copy.expatriate}</td>
            {(['present', 'absent'] as const).map((field) => (
              <td key={field} className="px-3 py-2">
                <input
                  type="number"
                  min="0"
                  className="w-24 rounded border border-amber-200 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  value={expatriate[field]}
                  onChange={(event) => onExpatChange(field, event.target.value)}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
