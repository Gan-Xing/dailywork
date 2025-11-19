'use client'

import { Fragment } from 'react'

import type { Locale, UICopy } from '@/lib/i18n'
import { equipmentCatalog } from '@/lib/reportSchema'
import type { EquipmentStatus } from '@/lib/reportState'

interface EquipmentTableProps {
  data: Record<string, EquipmentStatus>
  onChange: (id: string, field: keyof EquipmentStatus, value: string) => void
  locale: Locale
  copy: UICopy['tables']['equipment']
}

const entryId = (categoryId: string, itemId: string) => `${categoryId}-${itemId}`

const numberFrom = (value: string) => (value ? Number(value) : 0)

export function EquipmentTable({ data, onChange, locale, copy }: EquipmentTableProps) {
  const totals = Object.values(data).reduce(
    (acc, item) => ({
      total: acc.total + numberFrom(item.total),
      marche: acc.marche + numberFrom(item.marche),
      panne: acc.panne + numberFrom(item.panne),
      arret: acc.arret + numberFrom(item.arret),
    }),
    { total: 0, marche: 0, panne: 0, arret: 0 },
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 w-64">{copy.designation}</th>
            <th className="px-3 py-2">{copy.total}</th>
            <th className="px-3 py-2">{copy.marche}</th>
            <th className="px-3 py-2">{copy.panne}</th>
            <th className="px-3 py-2">{copy.arret}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {equipmentCatalog.map((category) => (
            <Fragment key={category.id}>
              <tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <td className="px-3 py-2" colSpan={5}>
                  {category.name[locale]}
                </td>
              </tr>
              {category.items.map((item) => {
                const id = entryId(category.id, item.id)
                const entry = data[id]
                return (
                  <tr key={id}>
                    <td className="px-3 py-2 font-medium">{item.label[locale]}</td>
                    {(['total', 'marche', 'panne', 'arret'] as const).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          className="w-24 rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          value={entry?.[field] ?? ''}
                          onChange={(event) => onChange(id, field, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </Fragment>
          ))}
          <tr className="bg-slate-900/5 font-semibold">
            <td className="px-3 py-2">{copy.grandTotal}</td>
            <td className="px-3 py-2">{totals.total}</td>
            <td className="px-3 py-2">{totals.marche}</td>
            <td className="px-3 py-2">{totals.panne}</td>
            <td className="px-3 py-2">{totals.arret}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
