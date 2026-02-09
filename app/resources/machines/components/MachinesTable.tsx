import type { ResourcesCopy } from '@/lib/i18n/resources'
import type {
  MachineColumnKey,
  MachineSortField,
  MachineSortOrder,
} from '@/lib/resources/machines/constants'
import type { MachineAsset } from '@/types/machines'

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const iso = value.includes('T') ? value.split('T')[0] ?? '' : value
  return iso || '—'
}

const formatNumber = (value: number | null) => {
  if (value === null || value === undefined) return '—'
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const isSortable = (key: MachineColumnKey): key is MachineSortField =>
  key !== 'actions' && key !== 'photoLinks'

export function MachinesTable({
  t,
  machines,
  columns,
  sort,
  onSortChange,
  onViewMachine,
  rowOffset,
  serialLabel,
}: {
  t: ResourcesCopy
  machines: MachineAsset[]
  columns: MachineColumnKey[]
  sort: { field: MachineSortField; order: MachineSortOrder }
  onSortChange: (field: MachineSortField) => void
  onViewMachine: (machine: MachineAsset) => void
  rowOffset: number
  serialLabel: string
}) {
  const headerCellClass =
    'whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500'
  const bodyCellClass = 'px-4 py-3 text-sm text-slate-700 align-top'

  const renderCell = (machine: MachineAsset, key: MachineColumnKey) => {
    switch (key) {
      case 'registrationDate':
        return formatDate(machine.registrationDate)
      case 'originalValue':
        return formatNumber(machine.originalValue)
      case 'currentValue':
        return formatNumber(machine.currentValue)
      case 'usedMonths':
        return machine.usedMonths ?? '—'
      case 'depreciatedMonths':
        return machine.depreciatedMonths ?? '—'
      case 'remainingMonths':
        return machine.remainingMonths ?? '—'
      case 'photoLinks':
        return machine.photoLinks?.length ? `${machine.photoLinks.length}` : '—'
      case 'createdAt':
        return formatDate(machine.createdAt)
      case 'updatedAt':
        return formatDate(machine.updatedAt)
      case 'actions':
        return (
          <button
            type="button"
            onClick={() => onViewMachine(machine)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t.machines.actions.view}
          </button>
        )
      default: {
        const value = (machine as Record<string, unknown>)[key]
        const text = typeof value === 'string' ? value.trim() : ''
        return text || '—'
      }
    }
  }

  const sortIndicator = (key: MachineSortField) => {
    if (sort.field !== key) return ''
    return sort.order === 'asc' ? '↑' : '↓'
  }

  return (
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50">
        <tr>
          <th scope="col" className={`${headerCellClass} w-16`}>
            <span className="px-2 py-1">{serialLabel}</span>
          </th>
          {columns.map((key) => (
            <th key={key} scope="col" className={headerCellClass}>
              {isSortable(key) ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100"
                  onClick={() => onSortChange(key)}
                >
                  <span>{t.machines.columns[key]}</span>
                  <span className="text-slate-400">{sortIndicator(key)}</span>
                </button>
              ) : (
                <span className="px-2 py-1">{t.machines.columns[key]}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {machines.map((machine, index) => (
          <tr key={machine.id} className="hover:bg-slate-50/60">
            <td className={bodyCellClass}>{rowOffset + index + 1}</td>
            {columns.map((key) => (
              <td key={key} className={bodyCellClass}>
                {renderCell(machine, key)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
