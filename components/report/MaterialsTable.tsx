'use client'

import type { Locale, UICopy } from '@/lib/i18n'
import { materialItems } from '@/lib/reportSchema'
import type { MaterialStock } from '@/lib/reportState'

interface MaterialsTableProps {
  data: Record<string, MaterialStock>
  onChange: (id: string, field: keyof MaterialStock, value: string) => void
  locale: Locale
  copy: UICopy['tables']['materials']
}

const columnOrder: Array<keyof MaterialStock> = ['previous', 'entry', 'exit', 'current']

export function MaterialsTable({ data, onChange, locale, copy }: MaterialsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{copy.designation}</th>
            {columnOrder.map((column) => (
              <th key={column} className="px-3 py-2">
                {copy.columns[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {materialItems.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2">
                <div className="font-medium">{item.label[locale]}</div>
                <p className="text-xs text-slate-500 uppercase">
                  {copy.unitPrefix}: {item.unit}
                </p>
              </td>
              {columnOrder.map((column) => {
                const isComputed = column === 'current'
                return (
                  <td key={column} className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      className={`w-28 rounded border px-3 py-2 text-sm outline-none transition ${
                        isComputed
                          ? 'border-slate-100 bg-slate-50 text-slate-500'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                      value={data[item.id]?.[column] ?? ''}
                      onChange={(event) => {
                        if (isComputed) return
                        onChange(item.id, column, event.target.value)
                      }}
                      readOnly={isComputed}
                      disabled={isComputed}
                      aria-label={`${item.label[locale]} - ${copy.columns[column]}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
