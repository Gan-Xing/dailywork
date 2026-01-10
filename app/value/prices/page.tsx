'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { AlertDialog } from '@/components/AlertDialog'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useToast } from '@/components/ToastProvider'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { measureLabels, priceManagerCopy } from '@/lib/i18n/value'
import type { PhaseItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

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
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = priceManagerCopy[locale]
  const { home: breadcrumbHome, value: breadcrumbValue, prices: breadcrumbPrices } = copy.breadcrumbs
  const localeId = formatLocaleId(locale)
  const measureLabel = measureLabels[locale]
  const loadErrorMessage = copy.messages.error
  const unauthorizedMessage = copy.messages.unauthorized

  const [groups, setGroups] = useState<PhasePricingGroup[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [editedRows, setEditedRows] = useState<Record<number, EditableFields>>({})
  const [savingIds, setSavingIds] = useState<number[]>([])
  const [deletingIds, setDeletingIds] = useState<number[]>([])
  const [createValues, setCreateValues] = useState<Record<number, CreateFields>>({})
  const [creatingIds, setCreatingIds] = useState<number[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{ groupId: number; item: PhaseItem } | null>(
    null,
  )
  const errorToastRef = useRef<string | null>(null)

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
          if (response.status === 403) {
            setPermissionDenied(true)
          }
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

  useEffect(() => {
    if (permissionDenied) return
    if (status !== 'error') return
    const message = error ?? copy.messages.error
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, copy.messages.error, error, permissionDenied, status])

  const handleRowChange = (itemId: number, field: keyof EditableFields, value: string) => {
    setEditedRows((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  const handleSave = async (groupId: number, item: PhaseItem) => {
    const editing = editedRows[item.id] ?? {}
    const payload = {
      priceItemId: item.id,
      name: editing.name?.trim() ?? item.name,
      spec: editing.spec?.trim() ?? item.spec ?? undefined,
      unitString: editing.unitString?.trim() ?? item.unitString ?? undefined,
      description: editing.description?.trim() ?? item.description ?? undefined,
      unitPrice:
        editing.unitPrice !== undefined
          ? editing.unitPrice.trim() || null
          : item.unitPrice !== null && item.unitPrice !== undefined
            ? String(item.unitPrice)
            : null,
    }

    setSavingIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))

    try {
      const response = await fetch('/api/value/prices', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => ({}))) as { item?: PhaseItem; message?: string }

      if (!response.ok) {
        const message = response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
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
                    entry.id === updated.id ? updated : entry,
                  ),
                }
              : group,
          ),
        )
      }

      setEditedRows((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      addToast(copy.messages.saved, { tone: 'success' })
    } catch (saveError) {
      addToast((saveError as Error).message ?? copy.messages.updateError, { tone: 'danger' })
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const handleDelete = async (groupId: number, item: PhaseItem) => {
    setDeletingIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))

    try {
      const response = await fetch('/api/value/prices', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceItemId: item.id }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhaseItem
        message?: string
      }

      if (!response.ok) {
        const message = response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
        throw new Error(message)
      }

      setGroups((prev) =>
        prev.map((group) =>
          group.phaseDefinitionId === groupId
            ? {
                ...group,
                priceItems: group.priceItems.filter((entry) => entry.id !== item.id),
              }
            : group,
        ),
      )
      addToast(copy.messages.deleted, { tone: 'success' })
    } catch (deleteError) {
      addToast((deleteError as Error).message ?? copy.messages.updateError, { tone: 'danger' })
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const handleCreateChange = (groupId: number, field: keyof CreateFields, value: string) => {
    setCreateValues((prev) => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [field]: value,
      },
    }))
  }

  const handleCreate = async (group: PhasePricingGroup) => {
    const values = createValues[group.phaseDefinitionId] ?? {
      name: '',
      spec: '',
      description: '',
      unitString: '',
      unitPrice: '',
    }

    const trimmedName = (values.name ?? '').trim()
    if (!trimmedName) {
      addToast(copy.messages.nameRequired, { tone: 'warning' })
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
      unitPrice: (values.unitPrice ?? '').trim() || null,
    }

    setCreatingIds((prev) =>
      prev.includes(group.phaseDefinitionId) ? prev : [...prev, group.phaseDefinitionId],
    )

    try {
      const response = await fetch('/api/value/prices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhaseItem
        message?: string
      }

      if (!response.ok) {
        const message = response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
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
                    a.name.localeCompare(b.name, localeId),
                  ),
                }
              : entry,
          ),
        )
      }

      setCreateValues((prev) => {
        const next = { ...prev }
        delete next[group.phaseDefinitionId]
        return next
      })
      addToast(copy.messages.saved, { tone: 'success' })
    } catch (createError) {
      addToast((createError as Error).message ?? copy.messages.updateError, { tone: 'danger' })
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
        unitPrice: '',
      }
    })
    return defaults
  }, [groups])

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={copy.messages.unauthorized}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Breadcrumbs
              variant="light"
              items={[
                { label: breadcrumbHome, href: '/' },
                { label: breadcrumbValue, href: '/value' },
                { label: breadcrumbPrices },
              ]}
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{copy.title}</h1>
              <p className="text-sm text-slate-600">{copy.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/value"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.backCta}
            </Link>
            <LocaleSwitcher locale={locale} onChange={setLocale} variant="light" />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <p className="text-xs font-semibold text-slate-500">{copy.note}</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {status === 'loading' && <p className="text-xs text-slate-500">{copy.messages.loading}</p>}
            {status === 'error' && (
              <p className="text-xs text-rose-600">{error ?? copy.messages.error}</p>
            )}
            {status === 'success' && !groups.length && (
              <p className="text-xs text-slate-400">{copy.messages.empty}</p>
            )}
          </div>
          {!!groups.length && status !== 'error' && (
            <div className="mt-6 space-y-10">
              {groups.map((group) => {
                const formValues =
                  createValues[group.phaseDefinitionId] ?? createFormDefaults[group.phaseDefinitionId]
                const creating = creatingIds.includes(group.phaseDefinitionId)
                return (
                  <div
                    key={group.phaseDefinitionId}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{group.definitionName}</p>
                        <p className="text-[11px] text-slate-500">
                          {measureLabel[group.measure] ?? group.measure} · {copy.group.defaultPriceLabel}：
                          {group.defaultUnitPrice != null ? (
                            <span className="text-slate-700">
                              {' '}
                              {formatNumber(group.defaultUnitPrice, localeId)}
                            </span>
                          ) : (
                            <span className="text-rose-500">—</span>
                          )}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                        {group.priceItems.length} {copy.tableHeaders.name}
                      </span>
                    </div>
                    {group.priceItems.length ? (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead className="bg-slate-100">
                            <tr className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
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
                          <tbody className="divide-y divide-slate-200">
                            {group.priceItems.map((item) => {
                              const editing = editedRows[item.id] ?? {}
                              const nameValue = editing.name ?? item.name
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
                              return (
                                <tr key={item.id} className="transition hover:bg-slate-50">
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      value={nameValue}
                                      onChange={(event) => handleRowChange(item.id, 'name', event.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                    />
                                    {unitStringValue && (
                                      <p className="text-[10px] text-slate-500">{unitStringValue}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <select
                                      value={specValue}
                                      onChange={(event) =>
                                        handleRowChange(item.id, 'spec', event.target.value)
                                      }
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={priceValue}
                                      onChange={(event) =>
                                        handleRowChange(item.id, 'unitPrice', event.target.value)
                                      }
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                    />
                                    {item.unitPrice !== null && (
                                      <p className="text-[10px] text-slate-500">
                                        {formatNumber(item.unitPrice, localeId)}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => handleSave(group.phaseDefinitionId, item)}
                                        disabled={isSaving}
                                      >
                                        {isSaving ? `${copy.actions.save}…` : copy.actions.save}
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-rose-600 transition hover:-translate-y-0.5 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() =>
                                          setDeleteTarget({ groupId: group.phaseDefinitionId, item })
                                        }
                                        disabled={deletingIds.includes(item.id)}
                                      >
                                        {deletingIds.includes(item.id)
                                          ? `${copy.actions.delete}…`
                                          : copy.actions.delete}
                                      </button>
                                    </div>
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
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                        <select
                          value={formValues?.spec ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'spec', event.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                        <input
                          type="text"
                          value={formValues?.unitString ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'unitString', event.target.value)
                          }
                          placeholder={copy.group.newItemUnitPlaceholder}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formValues?.unitPrice ?? ''}
                          onChange={(event) =>
                            handleCreateChange(group.phaseDefinitionId, 'unitPrice', event.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleCreate(group)}
                          disabled={creating}
                        >
                          {creating ? `${copy.actions.save}…` : copy.actions.save}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <AlertDialog
        open={!!deleteTarget}
        title={copy.actions.delete}
        description={copy.messages.deleteConfirm}
        tone="danger"
        actionLabel={copy.actions.delete}
        cancelLabel={copy.actions.cancel}
        onClose={() => setDeleteTarget(null)}
        onAction={() => {
          if (!deleteTarget) return
          handleDelete(deleteTarget.groupId, deleteTarget.item)
        }}
      />
    </main>
  )
}
