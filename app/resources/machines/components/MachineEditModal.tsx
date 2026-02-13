'use client'

import { useEffect, useMemo, useState } from 'react'

import { Modal } from '@/components/Modal'
import { SingleSelect } from '@/components/SingleSelect'
import type { ResourcesCopy } from '@/lib/i18n/resources'
import { getMachineEquipmentTypeLabel, machineEquipmentTypes } from '@/lib/resources/machines/equipmentTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { MachineAsset } from '@/types/machines'

import { MachinePhotosPanel } from './MachinePhotosPanel'

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

export function MachineEditModal({
  t,
  machine,
  open,
  usageStatusOptions,
  canEditOperational,
  canManage,
  onClose,
  onSaved,
}: {
  t: ResourcesCopy
  machine: MachineAsset | null
  open: boolean
  usageStatusOptions: Array<{ value: string; label: string }>
  canEditOperational: boolean
  canManage: boolean
  onClose: () => void
  onSaved: (machine: MachineAsset) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { locale } = usePreferredLocale()

  const [usageStatus, setUsageStatus] = useState('')
  const [alias, setAlias] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [equipmentTypeKey, setEquipmentTypeKey] = useState('')

  const [assetCategoryName, setAssetCategoryName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetStatusName, setAssetStatusName] = useState('')
  const [specModel, setSpecModel] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [originalValue, setOriginalValue] = useState('')
  const [usedMonths, setUsedMonths] = useState('')

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    setUsageStatus(machine?.usageStatus ?? '')
    setAlias(machine?.alias ?? '')
    setPlateNumber(machine?.plateNumber ?? '')
    setEquipmentTypeKey(machine?.equipmentTypeKey ?? '')

    setAssetCategoryName(machine?.assetCategoryName ?? '')
    setManufacturer(machine?.manufacturer ?? '')
    setAssetName(machine?.assetName ?? '')
    setAssetStatusName(machine?.assetStatusName ?? '')
    setSpecModel(machine?.specModel ?? '')
    setRegistrationDate(toDateInput(machine?.registrationDate ?? null))
    setOriginalValue(machine?.originalValue == null ? '' : String(machine.originalValue))
    setUsedMonths(machine?.usedMonths == null ? '' : String(machine.usedMonths))
  }, [machine, open])

  const title = machine?.assetNumber
    ? `${t.machines.title} · ${t.machines.actions.edit} · ${machine.assetNumber}`
    : `${t.machines.title} · ${t.machines.actions.edit}`
  const subtitle = machine?.assetName ?? undefined

  const computed = useMemo(() => {
    return {
      currentValue: formatNumber(machine?.currentValue ?? null),
      depreciatedMonths: machine?.depreciatedMonths ?? '—',
      remainingMonths: machine?.remainingMonths ?? '—',
    }
  }, [machine])

  const handleSave = async () => {
    if (!machine) return
    if (!canEditOperational && !canManage) return

    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}

      if (canEditOperational || canManage) {
        payload.usageStatus = usageStatus
        payload.alias = alias
        payload.plateNumber = plateNumber
        payload.equipmentTypeKey = equipmentTypeKey.trim() ? equipmentTypeKey.trim() : null
      }

      if (canManage) {
        payload.assetCategoryName = assetCategoryName
        payload.manufacturer = manufacturer
        payload.assetName = assetName
        payload.assetStatusName = assetStatusName
        payload.specModel = specModel
        payload.registrationDate = registrationDate || null
        payload.originalValue = originalValue === '' ? null : Number(originalValue)
        payload.usedMonths = usedMonths === '' ? null : Number(usedMonths)
      }

      const res = await fetch(`/api/resources/machines/${machine.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { machine?: MachineAsset; error?: string }
      if (!res.ok || !data.machine) {
        throw new Error(data.error ?? t.machines.errors.saveFailed)
      }
      onSaved(data.machine)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.machines.errors.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500'
  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500'

  const equipmentTypeOptions = useMemo(() => {
    const opts = machineEquipmentTypes.map((def) => ({
      value: def.key,
      label: getMachineEquipmentTypeLabel(locale, def.key),
    }))
    return [{ value: '', label: t.common.clear }, ...opts]
  }, [locale, t.common.clear])

  const resolvedUsageStatusOptions = useMemo(() => {
    const emptyLabel = locale === 'fr' ? 'Non renseigné' : '未填写'
    const map = new Map<string, string>()
    usageStatusOptions.forEach((option) => {
      const key = option.value.trim()
      if (!key) return
      if (!map.has(key)) map.set(key, option.label)
    })
    const current = usageStatus.trim()
    if (current && !map.has(current)) {
      map.set(current, current)
    }
    return [
      { value: '', label: emptyLabel },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ]
  }, [locale, usageStatus, usageStatusOptions])

  if (!machine) return null

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} widthClassName="max-w-5xl">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <div className={labelClass}>{t.machines.columns.assetNumber}</div>
            <input className={inputClass} value={machine.assetNumber} disabled />
            <p className="mt-1 text-xs text-slate-500">{t.machines.hints.assetNumberLocked}</p>
          </div>

          <div>
            <SingleSelect
              label={t.machines.columns.usageStatus}
              value={usageStatus}
              options={resolvedUsageStatusOptions}
              placeholder={t.machines.hints.optional}
              searchPlaceholder={locale === 'fr' ? 'Rechercher un statut…' : '搜索使用状态…'}
              emptyLabel={locale === 'fr' ? 'Aucun statut' : '暂无状态'}
              onChange={setUsageStatus}
              disabled={!canEditOperational && !canManage}
              className="mt-[2px]"
            />
          </div>

          <div>
            <div className={labelClass}>{t.machines.columns.alias}</div>
            <input
              className={inputClass}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              disabled={!canEditOperational && !canManage}
              placeholder={t.machines.hints.optional}
            />
          </div>

          <div>
            <div className={labelClass}>{t.machines.columns.plateNumber}</div>
            <input
              className={inputClass}
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              disabled={!canEditOperational && !canManage}
              placeholder={t.machines.hints.optional}
            />
          </div>

          <div className="sm:col-span-2">
            <SingleSelect
              label={t.machines.columns.equipmentTypeKey}
              value={equipmentTypeKey}
              options={equipmentTypeOptions}
              placeholder={t.machines.hints.optional}
              onChange={setEquipmentTypeKey}
              disabled={!canEditOperational && !canManage}
            />
          </div>
        </div>

        <MachinePhotosPanel t={t} machineId={machine.id} canEdit={canEditOperational || canManage} />

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t.machines.financeSection.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{t.machines.financeSection.hint}</p>
            </div>
            <div className="text-xs text-slate-500">{canManage ? t.machines.financeSection.manage : t.machines.financeSection.readOnly}</div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className={labelClass}>{t.machines.columns.assetCategoryName}</div>
              <input
                className={inputClass}
                value={assetCategoryName}
                onChange={(e) => setAssetCategoryName(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.manufacturer}</div>
              <input
                className={inputClass}
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.assetName}</div>
              <input
                className={inputClass}
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.assetStatusName}</div>
              <input
                className={inputClass}
                value={assetStatusName}
                onChange={(e) => setAssetStatusName(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.specModel}</div>
              <input
                className={inputClass}
                value={specModel}
                onChange={(e) => setSpecModel(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.registrationDate}</div>
              <input
                type="date"
                className={inputClass}
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.originalValue}</div>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={originalValue}
                onChange={(e) => setOriginalValue(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
            <div>
              <div className={labelClass}>{t.machines.columns.usedMonths}</div>
              <input
                type="number"
                step="1"
                className={inputClass}
                value={usedMonths}
                onChange={(e) => setUsedMonths(e.target.value)}
                disabled={!canManage}
                placeholder={t.machines.hints.optional}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className={labelClass}>{t.machines.columns.depreciatedMonths}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                {computed.depreciatedMonths}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className={labelClass}>{t.machines.columns.remainingMonths}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                {computed.remainingMonths}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className={labelClass}>{t.machines.columns.currentValue}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                {computed.currentValue}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{t.machines.financeSection.computedHint}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t.machines.actions.cancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || (!canEditOperational && !canManage)}
            className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t.machines.actions.saving : t.machines.actions.save}
          </button>
        </div>
      </div>
    </Modal>
  )
}
