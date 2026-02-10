'use client'

import type { ResourcesCopy } from '@/lib/i18n/resources'
import { getMachineEquipmentTypeLabel, isMachineEquipmentTypeKey } from '@/lib/resources/machines/equipmentTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type {
  MachineColumnKey,
  MachineSortField,
  MachineSortOrder,
} from '@/lib/resources/machines/constants'
import type { MachineAsset, MachineBulkPatch } from '@/types/machines'

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const iso = value.includes('T') ? value.split('T')[0] ?? '' : value
  return iso || '—'
}

const toDateInput = (value: string | null) => {
  if (!value) return ''
  const iso = value.includes('T') ? value.split('T')[0] ?? '' : value
  return iso
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
  sortStack,
  onSortChange,
  bulkEditMode,
  bulkDrafts,
  bulkEditableColumns,
  bulkSaving,
  onBulkFieldChange,
  onViewMachine,
  onEditMachine,
  canEdit,
  rowOffset,
  serialLabel,
}: {
  t: ResourcesCopy
  machines: MachineAsset[]
  columns: MachineColumnKey[]
  sortStack: Array<{ field: MachineSortField; order: MachineSortOrder }>
  onSortChange: (field: MachineSortField) => void
  bulkEditMode: boolean
  bulkDrafts: Record<number, MachineBulkPatch>
  bulkEditableColumns: MachineColumnKey[]
  bulkSaving: boolean
  onBulkFieldChange: (
    machineId: number,
    key: keyof MachineBulkPatch,
    value: string | null | undefined,
  ) => void
  onViewMachine: (machine: MachineAsset) => void
  onEditMachine: (machine: MachineAsset) => void
  canEdit: boolean
  rowOffset: number
  serialLabel: string
}) {
  const { locale } = usePreferredLocale()

  const headerCellClass =
    'whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 align-middle'
  const bodyCellClass = 'px-4 py-3 text-sm text-slate-700 align-middle text-center'

  const isEditable = (key: MachineColumnKey) => bulkEditMode && bulkEditableColumns.includes(key)

  const resolveDraftValue = (machineId: number, key: keyof MachineBulkPatch) => {
    const draft = bulkDrafts[machineId]
    if (!draft) return undefined
    return draft[key]
  }

  const resolveInputValue = (draftValue: string | null | undefined, currentValue: string) => {
    if (draftValue === null) return ''
    if (draftValue === undefined) return currentValue
    return draftValue
  }

  const handleBulkChange = (
    machineId: number,
    key: keyof MachineBulkPatch,
    value: string,
    currentValue: string,
  ) => {
    const normalizedNext = value.trim()
    const normalizedCurrent = currentValue.trim()
    if (!normalizedNext || normalizedNext === normalizedCurrent) {
      onBulkFieldChange(machineId, key, undefined)
      return
    }
    onBulkFieldChange(machineId, key, value)
  }

  const renderBulkInput = ({
    machineId,
    field,
    currentValue,
    type = 'text',
    inputMode,
    placeholder,
    disabled,
  }: {
    machineId: number
    field: keyof MachineBulkPatch
    currentValue: string
    type?: 'text' | 'number' | 'date'
    inputMode?: 'text' | 'decimal' | 'numeric'
    placeholder?: string
    disabled?: boolean
  }) => {
    const draftValue = resolveDraftValue(machineId, field)
    const isCleared = draftValue === null
    const value = resolveInputValue(draftValue ?? undefined, currentValue)
    return (
      <div className="flex items-center justify-center gap-2">
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) =>
            handleBulkChange(machineId, field, event.target.value, currentValue)
          }
          placeholder={isCleared ? t.machines.hints.cleared : placeholder}
          disabled={disabled || bulkSaving}
          className={`w-full max-w-[220px] rounded-lg border px-2 py-1 text-center text-xs text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
            isCleared ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
          }`}
        />
        <button
          type="button"
          onClick={() => onBulkFieldChange(machineId, field, null)}
          disabled={disabled || bulkSaving}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.common.clear}
        </button>
      </div>
    )
  }

  const renderCell = (machine: MachineAsset, key: MachineColumnKey) => {
    switch (key) {
      case 'equipmentTypeKey': {
        const raw = (machine.equipmentTypeKey ?? '').trim()
        if (!raw) return '—'
        return isMachineEquipmentTypeKey(raw) ? getMachineEquipmentTypeLabel(locale, raw) : raw
      }
      case 'registrationDate':
        return isEditable('registrationDate')
          ? renderBulkInput({
              machineId: machine.id,
              field: 'registrationDate',
              currentValue: toDateInput(machine.registrationDate),
              type: 'date',
            })
          : formatDate(machine.registrationDate)
      case 'originalValue':
        return isEditable('originalValue')
          ? renderBulkInput({
              machineId: machine.id,
              field: 'originalValue',
              currentValue: machine.originalValue == null ? '' : String(machine.originalValue),
              type: 'number',
              inputMode: 'decimal',
              placeholder: t.machines.hints.optional,
            })
          : formatNumber(machine.originalValue)
      case 'currentValue':
        return formatNumber(machine.currentValue)
      case 'usedMonths':
        return isEditable('usedMonths')
          ? renderBulkInput({
              machineId: machine.id,
              field: 'usedMonths',
              currentValue: machine.usedMonths == null ? '' : String(machine.usedMonths),
              type: 'number',
              inputMode: 'numeric',
              placeholder: t.machines.hints.optional,
            })
          : machine.usedMonths ?? '—'
      case 'depreciatedMonths':
        return machine.depreciatedMonths ?? '—'
      case 'remainingMonths':
        return machine.remainingMonths ?? '—'
      case 'photoLinks':
        return String(machine.photoCount ?? 0)
      case 'createdAt':
        return formatDate(machine.createdAt)
      case 'updatedAt':
        return formatDate(machine.updatedAt)
      case 'actions':
        return (
          <div className="flex items-center justify-center gap-2 whitespace-nowrap">
            <button
              type="button"
              onClick={() => onViewMachine(machine)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {t.machines.actions.view}
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEditMachine(machine)}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100"
              >
                {t.machines.actions.edit}
              </button>
            ) : null}
          </div>
        )
      default: {
        if (isEditable(key)) {
          const current = (machine as Record<string, unknown>)[key]
          const currentValue = typeof current === 'string' ? current : current == null ? '' : String(current)
          const field = key as keyof MachineBulkPatch
          return renderBulkInput({
            machineId: machine.id,
            field,
            currentValue,
            placeholder: t.machines.hints.optional,
          })
        }
        const value = (machine as Record<string, unknown>)[key]
        const text = typeof value === 'string' ? value.trim() : ''
        return text || '—'
      }
    }
  }

  const sortIndicator = (key: MachineSortField) => {
    const idx = sortStack.findIndex((item) => item.field === key)
    if (idx === -1) return ''
    const arrow = sortStack[idx]?.order === 'asc' ? '↑' : '↓'
    return `${arrow}${idx + 1}`
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
