'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { measureLabels, priceManagerCopy, productionValueCopy } from '@/lib/i18n/value'
import type { PhasePricingGroup } from '@/lib/server/phasePricingStore'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

export default function PriceManagementPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = priceManagerCopy[locale]
  const tabCopy = productionValueCopy[locale]
  const { home: breadcrumbHome, value: breadcrumbValue, prices: breadcrumbPrices } = copy.breadcrumbs
  const localeId = formatLocaleId(locale)
  const measureLabel = measureLabels[locale]
  const loadErrorMessage = copy.messages.error
  const unauthorizedMessage = copy.messages.unauthorized

  const [groups, setGroups] = useState<PhasePricingGroup[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
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
  }, [loadErrorMessage, unauthorizedMessage])

  useEffect(() => {
    if (permissionDenied) return
    if (status !== 'error') return
    const message = error ?? copy.messages.error
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, copy.messages.error, error, permissionDenied, status])

  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => a.definitionName.localeCompare(b.definitionName, localeId)),
    [groups, localeId],
  )

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={copy.messages.unauthorized}
      />
    )
  }

  const tabs = [
    { key: 'production', label: tabCopy.tabs.production, href: '/value' },
    { key: 'completion', label: tabCopy.tabs.completion, href: '/value?tab=completion' },
    { key: 'boq', label: tabCopy.tabs.boq, href: '/value?tab=boq' },
    { key: 'manage', label: tabCopy.tabs.manage, href: '/value/prices' },
  ].map((tab) => ({
    ...tab,
    active: tab.key === 'manage',
  }))

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="z-30 py-4"
        breadcrumbs={[
          { label: breadcrumbHome, href: '/' },
          { label: breadcrumbValue, href: '/value' },
          { label: breadcrumbPrices },
        ]}
        title={copy.title}
        subtitle={copy.description || undefined}
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
      />

      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {status === 'loading' && <p className="text-xs text-slate-500">{copy.messages.loading}</p>}
            {status === 'error' && (
              <p className="text-xs text-rose-600">{error ?? copy.messages.error}</p>
            )}
            {status === 'success' && !sortedGroups.length && (
              <p className="text-xs text-slate-400">{copy.messages.empty}</p>
            )}
          </div>
          {status === 'success' && sortedGroups.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {sortedGroups.map((group) => {
                const formulaReady =
                  group.priceItems.length > 0 &&
                  group.priceItems.every((item) => item.formulaConfigured && item.boqBindingCount > 0)
                return (
                  <Link
                    key={group.phaseDefinitionId}
                    href={`/value/prices/${group.phaseDefinitionId}`}
                    className={`flex h-16 flex-col justify-center rounded-xl border px-3 text-left shadow-sm transition hover:-translate-y-0.5 ${
                      formulaReady
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/70'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}
                  >
                    <span className="line-clamp-1 text-sm font-semibold text-slate-900">
                      {group.definitionName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {measureLabel[group.measure] ?? group.measure}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
