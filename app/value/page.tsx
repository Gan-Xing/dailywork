'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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
  const { locale } = usePreferredLocale('zh', locales)
  const copy = productionValueCopy[locale]
  const localeId = formatLocaleId(locale)
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
  const [priceGroups, setPriceGroups] = useState<PhasePricingGroup[]>([])
  const [phaseDefaultPrices, setPhaseDefaultPrices] = useState<PhasePriceMap>({})
  const [priceStatus, setPriceStatus] = useState<FetchStatus>('idle')
  const [priceError, setPriceError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setStatus('loading')
      setError(null)
      try {
        const response = await fetch('/api/progress/summary', {
          credentials: 'include'
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: AggregatedPhaseProgress[]; message?: string }

        if (!response.ok) {
        const message =
          response.status === 403 ? productionUnauthorized : payload.message ?? productionError
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
          credentials: 'include'
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { phases?: PhasePricingGroup[]; message?: string }

        if (!response.ok) {
          const message =
            response.status === 403
              ? priceUnauthorizedMessage
              : payload.message ?? priceLoadError
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
        completedValue
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

  return (
    <main className="min-h-screen bg-slate-950">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-slate-50 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-100 shadow-xl shadow-slate-950/40 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300">
            {copy.card.badge}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">{copy.page.title}</h1>
          <p className="mt-2 text-sm text-slate-200/80">{copy.page.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <p className="text-slate-300/80">单位：{copy.page.unitLabel}</p>
            <Link
              href="/value/prices"
              className="rounded-full border border-white/30 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:border-white/60"
            >
              {copy.page.managePricesCta}
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-200 backdrop-blur">
          {status === 'loading' && (
            <p className="text-xs text-slate-300">{copy.page.messages.loading}</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-amber-200">{error ?? copy.page.messages.error}</p>
          )}
          {status === 'success' && !enrichedRows.length && (
            <p className="text-xs text-slate-300">{copy.page.messages.empty}</p>
          )}
          {priceStatus === 'loading' && (
            <p className="text-xs text-slate-300">{priceLoading}</p>
          )}
          {priceStatus === 'error' && (
            <p className="text-xs text-amber-200">{priceError ?? priceLoadError}</p>
          )}
          {!!enrichedRows.length && status !== 'error' && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
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
                <tbody className="divide-y divide-white/5">
                  {enrichedRows.map((phase) => (
                    <tr key={phase.id} className="bg-white/1">
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-50">{phase.name}</td>
                      <td className="px-3 py-3 text-slate-400">{phase.spec ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {formatNumber(phase.designAmount, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {formatNumber(phase.unitPrice, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {formatNumber(phase.designValue, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {formatNumber(phase.completedAmount, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {formatNumber(phase.completedValue, localeId)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">
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
