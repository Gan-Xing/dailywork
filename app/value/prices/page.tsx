'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { PhaseMeasure } from '@/lib/progressTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { measureLabels, priceManagerCopy } from '@/lib/i18n/value'
import type { PhasePriceItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'
type RowFeedback = {
  type: 'success' | 'error'
  text: string
}

type EditableFields = {
  name?: string
  spec?: string
  unitString?: string
  description?: string
  unitPrice?: string
}

type CreateFields = {
  name: string
  spec: string
  unitString: string
  description: string
  unitPrice: string
}

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatNumber = (value: number, localeId: string) =>
  new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(Math.max(0, value))

export default function PriceManagementPage() {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = priceManagerCopy[locale]
  const localeId = formatLocaleId(locale)
  const measureLabel = measureLabels[locale]
  const loadErrorMessage = copy.messages.error
  const unauthorizedMessage = copy.messages.unauthorized

  const [groups, setGroups] = useState<PhasePricingGroup[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [editedRows, setEditedRows] = useState<Record<number, EditableFields>>({})
  const [savingIds, setSavingIds] = useState<number[]>([])
  const [deletingIds, setDeletingIds] = useState<number[]>([])
  const [rowFeedback, setRowFeedback] = useState<Record<number, RowFeedback>>({})
  const [createValues, setCreateValues] = useState<Record<number, CreateFields>>({})
  const [creatingIds, setCreatingIds] = useState<number[]>([])
  const [createFeedback, setCreateFeedback] = useState<Record<number, RowFeedback>>({})

  useEffect(() => {
    let cancelled = false

    const loadPrices = async () => {
      setStatus('loading')
      setError(null)
      try {
        const response = await fetch('/api/value/prices', { credentials: 'include' })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: PhasePricingGroup[]; message?: string }

        if (!response.ok) {
          const message = response.status === 403 ? unauthorizedMessage : payload.message ?? loadErrorMessage
          throw new Error(message)
        }

        if (cancelled) return

        const phaseGroups = payload.phases ?? []
        setGroups(phaseGroups)
        setStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setStatus('error')
        setError((fetchError as Error).message)
      }
    }

    loadPrices()

    return () => {
      cancelled = true
    }
  }, [locale, loadErrorMessage, unauthorizedMessage])

  const handleRowChange = (itemId: number, field: keyof EditableFields, value: string) => {
    setEditedRows((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
    setRowFeedback((prev) => {
      if (!prev[itemId]) {
        return prev
      }
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const handleSave = async (groupId: number, item: PhasePriceItem) => {
    const editing = editedRows[item.id] ?? {}
    const payload = {
      priceItemId: item.id,
      name: editing.name?.trim() ?? item.priceableName,
      spec: editing.spec?.trim() ?? item.spec ?? undefined,
      unitString: editing.unitString?.trim() ?? item.unitString ?? undefined,
      description: editing.description?.trim() ?? item.description ?? undefined,
      unitPrice:
        editing.unitPrice !== undefined
          ? editing.unitPrice.trim() || null
          : item.unitPrice !== null && item.unitPrice !== undefined
          ? String(item.unitPrice)
          : null
    }

    setRowFeedback((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    setSavingIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))

    try {
      const response = await fetch('/api/value/prices', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = (await response.json().catch(() => ({}))) as { item?: PhasePriceItem; message?: string }

      if (!response.ok) {
        const message =
          response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
        throw new Error(message)
      }

      const updated = result.item
      if (updated) {
        setGroups((prev) =>
          prev.map((group) =>
            group.phaseDefinitionId === groupId
              ? {
                  ...group,
                  priceItems: group.priceItems.map((entry) =>
                    entry.id === updated.id ? updated : entry
                  )
                }
              : group
          )
        )
      }

      setEditedRows((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      setRowFeedback((prev) => ({
        ...prev,
        [item.id]: { type: 'success', text: copy.messages.saved }
      }))
    } catch (saveError) {
      setRowFeedback((prev) => ({
        ...prev,
        [item.id]: {
          type: 'error',
          text: (saveError as Error).message ?? copy.messages.updateError
        }
      }))
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const handleDelete = async (groupId: number, item: PhasePriceItem) => {
    if (typeof window !== 'undefined' && !window.confirm(copy.messages.deleteConfirm)) {
      return
    }

    setRowFeedback((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    setDeletingIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))

    try {
      const response = await fetch('/api/value/prices', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceItemId: item.id })
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhasePriceItem
        message?: string
      }

      if (!response.ok) {
        const message =
          response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
        throw new Error(message)
      }

      setGroups((prev) =>
        prev.map((group) =>
          group.phaseDefinitionId === groupId
            ? {
                ...group,
                priceItems: group.priceItems.filter((entry) => entry.id !== item.id)
              }
            : group
        )
      )
      setRowFeedback((prev) => ({
        ...prev,
        [item.id]: { type: 'success', text: copy.messages.deleted }
      }))
    } catch (deleteError) {
      setRowFeedback((prev) => ({
        ...prev,
        [item.id]: {
          type: 'error',
          text: (deleteError as Error).message ?? copy.messages.updateError
        }
      }))
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const handleCreateChange = (
    groupId: number,
    field: keyof CreateFields,
    value: string,
  ) => {
    setCreateValues((prev) => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [field]: value
      }
    }))
    setCreateFeedback((prev) => {
      if (!prev[groupId]) {
        return prev
      }
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  const handleCreate = async (group: PhasePricingGroup) => {
    const values = createValues[group.phaseDefinitionId] ?? {
      name: '',
      spec: '',
      description: '',
      unitString: '',
      unitPrice: ''
    }

    const trimmedName = (values.name ?? '').trim()
    if (!trimmedName) {
      setCreateFeedback((prev) => ({
        ...prev,
        [group.phaseDefinitionId]: {
          type: 'error',
          text: copy.messages.nameRequired
        }
      }))
      return
    }

    const specValue = (values.spec ?? '').trim()
    const payload = {
      phaseDefinitionId: group.phaseDefinitionId,
      name: trimmedName,
      measure: group.measure,
      spec: specValue,
      unitString: (values.unitString ?? '').trim() || undefined,
      description: (values.description ?? '').trim() || undefined,
      unitPrice: (values.unitPrice ?? '').trim() || null
    }

    setCreateFeedback((prev) => {
      const next = { ...prev }
      delete next[group.phaseDefinitionId]
      return next
    })
    setCreatingIds((prev) => (prev.includes(group.phaseDefinitionId) ? prev : [...prev, group.phaseDefinitionId]))

    try {
      const response = await fetch('/api/value/prices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhasePriceItem
        message?: string
      }

      if (!response.ok) {
        const message =
          response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
        throw new Error(message)
      }

      const created = result.item
      if (created) {
        setGroups((prev) =>
          prev.map((entry) =>
            entry.phaseDefinitionId === group.phaseDefinitionId
              ? {
                  ...entry,
                  priceItems: [...entry.priceItems, created].sort((a, b) =>
                    a.priceableName.localeCompare(b.priceableName, localeId),
                  )
                }
              : entry
          )
        )
      }

      setCreateValues((prev) => {
        const next = { ...prev }
        delete next[group.phaseDefinitionId]
        return next
      })
      setCreateFeedback((prev) => ({
        ...prev,
        [group.phaseDefinitionId]: { type: 'success', text: copy.messages.saved }
      }))
    } catch (createError) {
      setCreateFeedback((prev) => ({
        ...prev,
        [group.phaseDefinitionId]: {
          type: 'error',
          text: (createError as Error).message ?? copy.messages.updateError
        }
      }))
    } finally {
      setCreatingIds((prev) => prev.filter((id) => id !== group.phaseDefinitionId))
    }
  }

  const createFormDefaults = useMemo(() => {
    const defaults: Record<number, CreateFields> = {}
    groups.forEach((group) => {
      defaults[group.phaseDefinitionId] = {
        name: '',
        spec: '',
        description: '',
        unitString: '',
        unitPrice: ''
      }
    })
    return defaults
  }, [groups])

  return (
    <main className="min-h-screen bg-slate-950">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-slate-50 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-100 shadow-xl shadow-slate-950/40 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300">
            {copy.title}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-200/80">{copy.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <p className="text-slate-300/80">{copy.note}</p>
            <Link
              href="/value"
              className="rounded-full border border-white/30 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:border-white/60"
            >
              {copy.backCta}
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200 backdrop-blur">
          {status === 'loading' && <p className="text-xs text-slate-300">{copy.messages.loading}</p>}
          {status === 'error' && <p className="text-xs text-amber-200">{error ?? copy.messages.error}</p>}
          {status === 'success' && !groups.length && (
            <p className="text-xs text-slate-300">{copy.messages.empty}</p>
          )}
          {!!groups.length && status !== 'error' && (
            <div className="space-y-10">
              {groups.map((group) => {
                const formValues = createValues[group.phaseDefinitionId] ?? createFormDefaults[group.phaseDefinitionId]
                const creating = creatingIds.includes(group.phaseDefinitionId)
                const groupFeedback = createFeedback[group.phaseDefinitionId]
                return (
                  <div key={group.phaseDefinitionId} className="space-y-4 rounded-2xl border border-white/5 bg-slate-950/70 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-50">{group.definitionName}</p>
                        <p className="text-[11px] text-slate-400">
                          {measureLabel[group.measure] ?? group.measure} · {copy.group.defaultPriceLabel}：
                          {group.defaultUnitPrice != null ? (
                            <span className="text-slate-200">
                              {' '}
                              {formatNumber(group.defaultUnitPrice, localeId)}
                            </span>
                          ) : (
                            <span className="text-amber-200">—</span>
                          )}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {group.priceItems.length} {copy.tableHeaders.name}
                      </p>
                    </div>
                    {group.priceItems.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left">
                          <thead>
                            <tr className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                {copy.tableHeaders.name}
                              </th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                {copy.tableHeaders.spec}
                              </th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                {copy.tableHeaders.description}
                              </th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                {copy.tableHeaders.unitPrice}
                              </th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                {copy.tableHeaders.action}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {group.priceItems.map((item) => {
                              const editing = editedRows[item.id] ?? {}
                              const nameValue = editing.name ?? item.priceableName
                              const specValue = editing.spec ?? item.spec ?? ''
                              const descriptionValue = editing.description ?? item.description ?? ''
                              const unitStringValue = editing.unitString ?? item.unitString ?? ''
                              const priceValue =
                                editing.unitPrice ??
                                (item.unitPrice !== null && item.unitPrice !== undefined
                                  ? String(item.unitPrice)
                                  : '')
                              const specChoices = Array.from(
                                new Set([
                                  ...group.specOptions,
                                  ...(item.spec ? [item.spec] : []),
                                  ...(editing.spec ? [editing.spec] : []),
                                ].filter(Boolean)),
                              )
                              const isSaving = savingIds.includes(item.id)
                              const feedback = rowFeedback[item.id]
                              return (
                                <tr key={item.id} className="bg-white/1">
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      value={nameValue}
                                      onChange={(event) => handleRowChange(item.id, 'name', event.target.value)}
                                      className="w-full rounded border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                                    />
                                    {unitStringValue && (
                                      <p className="text-[10px] text-slate-400">{unitStringValue}</p>
                                    )}
                                  </td>
                          <td className="px-3 py-3">
                            <select
                              value={specValue}
                              onChange={(event) => handleRowChange(item.id, 'spec', event.target.value)}
                              className="w-full rounded border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                            >
                              <option value="">{copy.group.defaultPriceLabel}</option>
                              {specChoices.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      value={descriptionValue}
                                      onChange={(event) =>
                                        handleRowChange(item.id, 'description', event.target.value)
                                      }
                                      className="w-full rounded border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={priceValue}
                                      onChange={(event) => handleRowChange(item.id, 'unitPrice', event.target.value)}
                                      className="w-full rounded border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                                    />
                                    {item.unitPrice !== null && (
                                      <p className="text-[10px] text-slate-400">
                                        {formatNumber(item.unitPrice, localeId)}
                                      </p>
                                    )}
                                  </td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:border-white/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
                                      onClick={() => handleSave(group.phaseDefinitionId, item)}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? `${copy.actions.save}…` : copy.actions.save}
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-full border border-red-500/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-red-200 transition hover:border-red-300 focus:outline-none disabled:cursor-not-allowed disabled:border-red-600/40 disabled:text-red-500"
                                      onClick={() => handleDelete(group.phaseDefinitionId, item)}
                                      disabled={deletingIds.includes(item.id)}
                                    >
                                      {deletingIds.includes(item.id) ? `${copy.actions.delete}…` : copy.actions.delete}
                                    </button>
                                  </div>
                                  {feedback && (
                                    <p
                                      className={`mt-1 text-[11px] ${
                                        feedback.type === 'success' ? 'text-emerald-300' : 'text-amber-300'
                                      }`}
                                    >
                                      {feedback.text}
                                    </p>
                                  )}
                                </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">{copy.messages.empty}</p>
                    )}
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
                        {copy.group.newItemTitle}
                      </p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          type="text"
                          value={formValues?.name ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'name', event.target.value)
                          }
                          placeholder={copy.group.newItemNamePlaceholder}
                          className="w-full rounded border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                        />
                        <select
                          value={formValues?.spec ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'spec', event.target.value)
                          }
                          className="w-full rounded border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                        >
                          <option value="">{copy.group.defaultPriceLabel}</option>
                          {group.specOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={formValues?.description ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'description', event.target.value)
                          }
                          placeholder={copy.group.newItemDescriptionPlaceholder}
                          className="w-full rounded border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={formValues?.unitString ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'unitString', event.target.value)
                          }
                          placeholder={copy.group.newItemUnitPlaceholder}
                          className="w-full rounded border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formValues?.unitPrice ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'unitPrice', event.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-black/50 focus:border-white focus:outline-none"
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:border-white/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
                          onClick={() => handleCreate(group)}
                          disabled={creating}
                        >
                          {creating ? `${copy.actions.save}…` : copy.actions.save}
                        </button>
                      </div>
                      {groupFeedback && (
                        <p
                          className={`text-[11px] ${
                            groupFeedback.type === 'success' ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {groupFeedback.text}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
