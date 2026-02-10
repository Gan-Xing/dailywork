'use client'

import { useEffect, useMemo, useState } from 'react'

import { Modal } from '@/components/Modal'
import type { ResourcesCopy } from '@/lib/i18n/resources'
import type { MachineAsset } from '@/types/machines'

export function MachineCreateModal({
  t,
  open,
  canManage,
  onClose,
  onCreated,
}: {
  t: ResourcesCopy
  open: boolean
  canManage: boolean
  onClose: () => void
  onCreated: (machine: MachineAsset) => void
}) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assetNumber, setAssetNumber] = useState('')
  const [usageStatus, setUsageStatus] = useState('')
  const [alias, setAlias] = useState('')
  const [plateNumber, setPlateNumber] = useState('')

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
    setCreating(false)
    setError(null)
    setAssetNumber('')
    setUsageStatus('')
    setAlias('')
    setPlateNumber('')
    setAssetCategoryName('')
    setManufacturer('')
    setAssetName('')
    setAssetStatusName('')
    setSpecModel('')
    setRegistrationDate('')
    setOriginalValue('')
    setUsedMonths('')
  }, [open])

  const title = `${t.machines.title} · ${t.machines.actions.create}`

  const canSubmit = canManage && assetNumber.trim().length > 0

  const handleCreate = async () => {
    if (!canSubmit) return
    setCreating(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        assetNumber: assetNumber.trim(),
        usageStatus,
        alias,
        plateNumber,
        assetCategoryName,
        manufacturer,
        assetName,
        assetStatusName,
        specModel,
        registrationDate: registrationDate || null,
        originalValue: originalValue === '' ? null : Number(originalValue),
        usedMonths: usedMonths === '' ? null : Number(usedMonths),
      }

      const res = await fetch('/api/resources/machines', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { machine?: MachineAsset; error?: string }
      if (!res.ok || !data.machine) {
        throw new Error(data.error ?? t.machines.errors.createFailed)
      }
      onCreated(data.machine)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.machines.errors.createFailed)
    } finally {
      setCreating(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500'
  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500'

  const createHint = useMemo(() => t.machines.hints.createAfterPhotos, [t])

  return (
    <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-5xl">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <div className={labelClass}>{t.machines.columns.assetNumber}</div>
            <input
              className={inputClass}
              value={assetNumber}
              onChange={(e) => setAssetNumber(e.target.value)}
              disabled={!canManage}
              placeholder={t.machines.hints.required}
            />
            <p className="mt-1 text-xs text-slate-500">{t.machines.hints.assetNumberLocked}</p>
          </div>

          <div>
            <div className={labelClass}>{t.machines.columns.usageStatus}</div>
            <input
              className={inputClass}
              value={usageStatus}
              onChange={(e) => setUsageStatus(e.target.value)}
              disabled={!canManage}
              placeholder={t.machines.hints.optional}
            />
          </div>

          <div>
            <div className={labelClass}>{t.machines.columns.alias}</div>
            <input
              className={inputClass}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              disabled={!canManage}
              placeholder={t.machines.hints.optional}
            />
          </div>

          <div>
            <div className={labelClass}>{t.machines.columns.plateNumber}</div>
            <input
              className={inputClass}
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              disabled={!canManage}
              placeholder={t.machines.hints.optional}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{t.machines.financeSection.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t.machines.financeSection.hint}</p>

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

          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {createHint}
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
            onClick={() => void handleCreate()}
            disabled={creating || !canSubmit}
            className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? t.machines.actions.creating : t.machines.actions.create}
          </button>
        </div>
      </div>
    </Modal>
  )
}

