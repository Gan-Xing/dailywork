'use client'

import { Modal } from '@/components/Modal'
import type { ResourcesCopy } from '@/lib/i18n/resources'
import { getMachineEquipmentTypeLabel, isMachineEquipmentTypeKey } from '@/lib/resources/machines/equipmentTypes'
import { machineColumnOrder, type MachineColumnKey } from '@/lib/resources/machines/constants'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { MachineAsset } from '@/types/machines'

import { MachinePhotosPanel } from './MachinePhotosPanel'

const formatDate = (value: string | null) => {
  if (!value) return null
  const iso = value.includes('T') ? value.split('T')[0] ?? '' : value
  return iso || null
}

const formatNumber = (value: number | null) => {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const renderValue = (machine: MachineAsset, key: MachineColumnKey, locale: 'fr' | 'zh') => {
  switch (key) {
    case 'equipmentTypeKey': {
      const raw = (machine.equipmentTypeKey ?? '').trim()
      if (!raw) return null
      return isMachineEquipmentTypeKey(raw) ? getMachineEquipmentTypeLabel(locale, raw) : raw
    }
    case 'registrationDate':
      return formatDate(machine.registrationDate)
    case 'originalValue':
      return formatNumber(machine.originalValue)
    case 'currentValue':
      return formatNumber(machine.currentValue)
    case 'usedMonths':
      return machine.usedMonths == null ? null : String(machine.usedMonths)
    case 'depreciatedMonths':
      return machine.depreciatedMonths == null ? null : String(machine.depreciatedMonths)
    case 'remainingMonths':
      return machine.remainingMonths == null ? null : String(machine.remainingMonths)
    case 'photoLinks':
      return (() => {
        const uploaded = machine.uploadedPhotoCount ?? 0
        const links = machine.photoLinks ?? []
        const lines: string[] = []
        if (locale === 'fr') {
          lines.push(`Téléversées: ${uploaded}`)
          lines.push(`Liens: ${links.length}`)
        } else {
          lines.push(`系统上传: ${uploaded}`)
          lines.push(`链接: ${links.length}`)
        }
        if (links.length) {
          lines.push('')
          lines.push(...links)
        }
        return lines.join('\n')
      })()
    case 'createdAt':
      return formatDate(machine.createdAt)
    case 'updatedAt':
      return formatDate(machine.updatedAt)
    case 'actions':
      return null
    default: {
      const value = (machine as Record<string, unknown>)[key]
      if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? trimmed : null
      }
      return value == null ? null : String(value)
    }
  }
}

export function MachineDetailModal({
  t,
  machine,
  open,
  onClose,
}: {
  t: ResourcesCopy
  machine: MachineAsset | null
  open: boolean
  onClose: () => void
}) {
  const { locale } = usePreferredLocale()
  const title = machine?.assetNumber ? `${t.machines.title} · ${machine.assetNumber}` : t.machines.title
  const subtitle = machine?.assetName ?? undefined

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} widthClassName="max-w-4xl">
      {machine ? (
        <div className="space-y-6">
          <MachinePhotosPanel t={t} machineId={machine.id} canEdit={false} />

          <div className="grid gap-3 sm:grid-cols-2">
            {machineColumnOrder.filter((key) => key !== 'actions').map((key) => {
              const value = renderValue(machine, key, locale)
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t.machines.columns[key]}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                    {value ?? '—'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
