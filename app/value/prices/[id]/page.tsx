'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useToast } from '@/components/ToastProvider'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { measureLabels, priceManagerCopy, productionValueCopy } from '@/lib/i18n/value'
import type { PhaseItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

export default function PhaseDefinitionDetailPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = priceManagerCopy[locale]
  const tabCopy = productionValueCopy[locale]
  const { home: breadcrumbHome, value: breadcrumbValue, prices: breadcrumbPrices } = copy.breadcrumbs
  const localeId = formatLocaleId(locale)
  const measureLabel = measureLabels[locale]
  const loadErrorMessage = copy.messages.error
  const unauthorizedMessage = copy.messages.unauthorized
  const params = useParams()
  const definitionId = Number(params?.id)

  const [group, setGroup] = useState<PhasePricingGroup | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const errorToastRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPrices = async () => {
      if (!Number.isInteger(definitionId) || definitionId <= 0) {
        setStatus('error')
        setError('分项定义无效')
        return
      }
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
        const matched = phaseGroups.find((item) => item.phaseDefinitionId === definitionId) ?? null
        setGroup(matched)
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
  }, [definitionId, loadErrorMessage, unauthorizedMessage])

  useEffect(() => {
    if (permissionDenied) return
    if (status !== 'error') return
    const message = error ?? copy.messages.error
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, copy.messages.error, error, permissionDenied, status])

  const sortedItems = useMemo(() => {
    if (!group) return []
    return [...group.priceItems].sort((a, b) => a.name.localeCompare(b.name, localeId))
  }, [group, localeId])

  const handleCreate = async () => {
    if (!group) return
    const trimmedName = createName.trim()
    if (!trimmedName) {
      addToast(copy.messages.nameRequired, { tone: 'warning' })
      return
    }
    setCreating(true)
    try {
      const response = await fetch('/api/value/prices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseDefinitionId: group.phaseDefinitionId,
          name: trimmedName,
          measure: group.measure,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhaseItem
        message?: string
      }
      if (!response.ok) {
        const message = response.status === 403 ? unauthorizedMessage : result.message ?? copy.messages.updateError
        throw new Error(message)
      }
      const createdItem = result.item
      if (createdItem) {
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                priceItems: [...prev.priceItems, createdItem].sort((a, b) =>
                  a.name.localeCompare(b.name, localeId),
                ),
              }
            : prev,
        )
      }
      setCreateName('')
      setShowCreateModal(false)
      addToast(copy.messages.saved, { tone: 'success' })
    } catch (createError) {
      addToast((createError as Error).message ?? copy.messages.updateError, { tone: 'danger' })
    } finally {
      setCreating(false)
    }
  }

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
                { label: breadcrumbPrices, href: '/value/prices' },
                { label: group?.definitionName ?? '' },
              ]}
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                {group?.definitionName ?? copy.title}
              </h1>
              {group ? (
                <p className="text-sm text-slate-600">
                  {measureLabel[group.measure] ?? group.measure}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              {[
                { key: 'production', label: tabCopy.tabs.production, href: '/value' },
                { key: 'completion', label: tabCopy.tabs.completion, href: '/value?tab=completion' },
                { key: 'boq', label: tabCopy.tabs.boq, href: '/value?tab=boq' },
                { key: 'manage', label: tabCopy.tabs.manage, href: '/value/prices' },
              ].map((tab) => {
                const isActive = tab.key === 'manage'
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
            <LocaleSwitcher locale={locale} onChange={setLocale} variant="light" />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {status === 'loading' ? copy.messages.loading : null}
              {status === 'error' ? error ?? copy.messages.error : null}
              {status === 'success' && group && !sortedItems.length ? copy.messages.empty : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5"
                onClick={() => setShowCreateModal(true)}
              >
                {copy.group.newItemTitle}
              </button>
              <Link
                href="/value/prices"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                {copy.card.backToList}
              </Link>
            </div>
          </div>
          {status === 'success' && group ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {sortedItems.map((item) => {
                const formulaReady = item.formulaConfigured && item.boqBindingCount > 0
                return (
                  <Link
                    key={item.id}
                    href={`/value/prices/items/${item.id}`}
                    className={`flex h-16 items-center justify-center rounded-xl border px-3 text-center text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                      formulaReady
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/70'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}
                  >
                    <span className="line-clamp-2">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{copy.group.newItemTitle}</h2>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                onClick={() => setShowCreateModal(false)}
              >
                {copy.actions.cancel}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-[11px] font-semibold text-slate-500">
                {copy.tableHeaders.name}
              </label>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={copy.group.newItemNamePlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:bg-white"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {copy.actions.cancel}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? `${copy.actions.save}…` : copy.actions.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
