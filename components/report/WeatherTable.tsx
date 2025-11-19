'use client'

import type { Locale, UICopy } from '@/lib/i18n'
import { weatherConditions, weatherPeriods, type WeatherPeriod } from '@/lib/reportSchema'
import type { WeatherEntry } from '@/lib/reportState'

interface WeatherTableProps {
  data: Record<WeatherPeriod, WeatherEntry>
  onChange: (period: WeatherPeriod, field: keyof WeatherEntry, value: string) => void
  locale: Locale
  copy: UICopy['tables']['weather']
}

export function WeatherTable({ data, onChange, locale, copy }: WeatherTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{copy.period}</th>
            <th className="px-3 py-2">{copy.condition}</th>
            <th className="px-3 py-2">{copy.rainfall}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {weatherPeriods.map((period) => (
            <tr key={period}>
              <td className="px-3 py-2 font-medium">{period}</td>
              <td className="px-3 py-2">
                <select
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={data[period].condition}
                  onChange={(event) => onChange(period, 'condition', event.target.value)}
                >
                  <option value="">{copy.selectPlaceholder}</option>
                  {weatherConditions.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.label[locale]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-28 rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={data[period].rainfall}
                  onChange={(event) => onChange(period, 'rainfall', event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
