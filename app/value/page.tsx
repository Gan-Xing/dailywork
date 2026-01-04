'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useToast } from '@/components/ToastProvider'
import type { AggregatedPhaseProgress } from '@/lib/progressTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import type { PhasePriceItem, PhasePricingGroup } from '@/lib/server/phasePricingStore'
import { getPhaseUnitPrice, type PhasePriceMap } from '@/lib/phasePricing'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatNumber = (value: number, localeId: string) =>
  new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(Math.max(0, value))

type ValueRow = AggregatedPhaseProgress & {
  designAmount: number
  completedAmount: number
  unitPrice: number
  designValue: number
  completedValue: number
}

export default function ProductionValuePage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = productionValueCopy[locale]
  const localeId = formatLocaleId(locale)
  const { home: breadcrumbHome, value: breadcrumbValue } = copy.breadcrumbs
  const {
    priceLoading,
    priceLoadError,
    unauthorized: productionUnauthorized,
    error: productionError,
  } = copy.page.messages
  const priceUnauthorizedMessage = productionUnauthorized

  const [rows, setRows] = useState<AggregatedPhaseProgress[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [priceGroups, setPriceGroups] = useState<PhasePricingGroup[]>([])
  const [phaseDefaultPrices, setPhaseDefaultPrices] = useState<PhasePriceMap>({})
  const [priceStatus, setPriceStatus] = useState<FetchStatus>('idle')
  const [priceError, setPriceError] = useState<string | null>(null)
  const errorToastRef = useRef<string | null>(null)
  const priceToastRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setStatus('loading')
      setError(null)
      try {
        const response = await fetch('/api/progress/summary', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: AggregatedPhaseProgress[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403 ? productionUnauthorized : payload.message ?? productionError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setRows(payload.phases ?? [])
        setStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setStatus('error')
        setError((fetchError as Error).message)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [locale, productionError, productionUnauthorized])

  useEffect(() => {
    let cancelled = false

    const loadPrices = async () => {
      setPriceStatus('loading')
      setPriceError(null)
      try {
        const response = await fetch('/api/value/prices', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: PhasePricingGroup[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403
              ? priceUnauthorizedMessage
              : payload.message ?? priceLoadError
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        const phases = payload.phases ?? []
        const defaults: PhasePriceMap = {}
        phases.forEach((phase) => {
          defaults[phase.phaseDefinitionId] = phase.defaultUnitPrice
        })
        setPhaseDefaultPrices(defaults)
        setPriceGroups(phases)
        setPriceStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setPriceStatus('error')
        setPriceError((fetchError as Error).message)
      }
    }

    loadPrices()

    return () => {
      cancelled = true
    }
  }, [locale, priceLoadError, priceUnauthorizedMessage])

  useEffect(() => {
    if (permissionDenied) return
    if (status !== 'error') return
    const message = error ?? productionError
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, error, permissionDenied, productionError, status])

  useEffect(() => {
    if (permissionDenied) return
    if (priceStatus !== 'error') return
    const message = priceError ?? priceLoadError
    if (!message || message === priceToastRef.current) return
    addToast(message, { tone: 'warning' })
    priceToastRef.current = message
  }, [addToast, permissionDenied, priceError, priceLoadError, priceStatus])

  const priceItemMap = useMemo(() => {
    const map = new Map<string, PhasePriceItem>()
    priceGroups.forEach((group) => {
      group.priceItems.forEach((item) => {
        const key = `${group.phaseDefinitionId}::${item.spec ?? ''}`
        map.set(key, item)
      })
    })
    return map
  }, [priceGroups])

  const enrichedRows = useMemo<ValueRow[]>(() => {
    const enriched = rows.map((phase) => {
      const designAmount = Math.max(0, phase.totalDesignLength)
      const completedAmount = Math.max(0, phase.totalCompletedLength)
      const specKey = phase.phaseDefinitionId
        ? `${phase.phaseDefinitionId}::${phase.spec ?? ''}`
        : ''
      const fallbackKey = phase.phaseDefinitionId ? `${phase.phaseDefinitionId}::` : ''
      const priceItem =
        priceItemMap.get(specKey) ??
        (fallbackKey ? priceItemMap.get(fallbackKey) : undefined)
      const unitPriceOverride = priceItem?.unitPrice
      const unitPrice =
        unitPriceOverride != null
          ? unitPriceOverride
          : getPhaseUnitPrice(phase.phaseDefinitionId, phase.measure, phaseDefaultPrices)
      const designValue = designAmount * unitPrice
      const completedValue = completedAmount * unitPrice
      return {
        ...phase,
        designAmount,
        completedAmount,
        unitPrice,
        designValue,
        completedValue,
      }
    })

    return enriched.sort((a, b) => {
      if (b.latestUpdatedAt !== a.latestUpdatedAt) {
        return b.latestUpdatedAt - a.latestUpdatedAt
      }
      return a.name.localeCompare(b.name, localeId)
    })
  }, [rows, localeId, priceItemMap, phaseDefaultPrices])

  const headers = copy.page.tableHeaders

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={copy.page.messages.unauthorized}
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
              items={[{ label: breadcrumbHome, href: '/' }, { label: breadcrumbValue }]}
            />
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                {copy.card.badge}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{copy.page.title}</h1>
                <p className="text-sm text-slate-600">{copy.page.description}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {copy.page.unitLabel}
            </span>
            <Link
              href="/value/prices"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40"
            >
              {copy.page.managePricesCta}
            </Link>
            <LocaleSwitcher locale={locale} onChange={setLocale} variant="light" />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <div className="space-y-2 text-sm text-slate-600">
            {status === 'loading' && <p className="text-xs text-slate-500">{copy.page.messages.loading}</p>}
            {status === 'error' && (
              <p className="text-xs text-rose-600">{error ?? copy.page.messages.error}</p>
            )}
            {status === 'success' && !enrichedRows.length && (
              <p className="text-xs text-slate-400">{copy.page.messages.empty}</p>
            )}
            {priceStatus === 'loading' && <p className="text-xs text-slate-500">{priceLoading}</p>}
            {priceStatus === 'error' && (
              <p className="text-xs text-amber-600">{priceError ?? priceLoadError}</p>
            )}
          </div>
          {!!enrichedRows.length && status !== 'error' && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.phase}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.spec}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.designAmount}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.unitPrice}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.designValue}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.completedAmount}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.completedValue}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{headers.percent}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {enrichedRows.map((phase) => (
                    <tr key={phase.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                        {phase.name}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{phase.spec ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(phase.designAmount, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(phase.unitPrice, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(phase.designValue, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(phase.completedAmount, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(phase.completedValue, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {phase.completedPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
