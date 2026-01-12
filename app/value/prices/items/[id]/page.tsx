'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { useToast } from '@/components/ToastProvider'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { formatCopy, locales } from '@/lib/i18n'
import { priceManagerCopy, productionValueCopy } from '@/lib/i18n/value'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

type PhaseItemDetail = {
  id: number
  name: string
  phaseDefinitionId: number
  phaseDefinitionName: string
  measure: string
  unitString: string | null
  description: string | null
}

type FormulaDetail = {
  expression: string
  unitString: string | null
  inputSchema: unknown | null
}

type FormulaField = {
  id: string
  key: string
  label: string
  unit: string
  hint: string
}

type BoqItemOption = {
  id: number
  code: string
  designationZh: string
  designationFr: string
  projectId: number
  projectName: string
  projectCode: string | null
  unit: string | null
  unitPrice: number | string | null
  quantity: number | string | null
  contractItemId?: number | null
}

const createFieldId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const normalizeLabelText = (value: string) => value.replace(/\s+/g, ' ').trim()

const formatNumber = (value: unknown, digits = 2) => {
  if (value === null || value === undefined || value === '') return '—'
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, ''))
        : Number.NaN
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(parsed)
}

const parseInputSchema = (schema: unknown): FormulaField[] => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return []
  }
  const fields = (schema as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return []
  return fields
    .map((field) => {
      if (!field || typeof field !== 'object') return null
      const raw = field as {
        key?: unknown
        label?: unknown
        unit?: unknown
        hint?: unknown
      }
      const key = typeof raw.key === 'string' ? raw.key.trim() : ''
      if (!key) return null
      const label = typeof raw.label === 'string' ? raw.label.trim() : ''
      return {
        id: createFieldId(),
        key,
        label: label || key,
        unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
        hint: typeof raw.hint === 'string' ? raw.hint.trim() : '',
      }
    })
    .filter((item): item is FormulaField => Boolean(item))
}

export default function PhaseItemDetailPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = priceManagerCopy[locale]
  const tabCopy = productionValueCopy[locale]
  const { home: breadcrumbHome, value: breadcrumbValue, prices: breadcrumbPrices } = copy.breadcrumbs
  const params = useParams()
  const itemId = Number(params?.id)

  const [item, setItem] = useState<PhaseItemDetail | null>(null)
  const [formula, setFormula] = useState<FormulaDetail | null>(null)
  const [formulaDraft, setFormulaDraft] = useState({ expression: '' })
  const [formulaFields, setFormulaFields] = useState<FormulaField[]>([])
  const [savingFormula, setSavingFormula] = useState(false)
  const [boqItems, setBoqItems] = useState<BoqItemOption[]>([])
  const [boqItemsStatus, setBoqItemsStatus] = useState<FetchStatus>('idle')
  const [boqItemsError, setBoqItemsError] = useState<string | null>(null)
  const [bindingSelection, setBindingSelection] = useState<string[]>([])
  const [bindingSaved, setBindingSaved] = useState<string[]>([])
  const [savingBinding, setSavingBinding] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const errorToastRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      if (!Number.isInteger(itemId) || itemId <= 0) {
        setStatus('error')
        setError('分项名称无效')
        return
      }
      setStatus('loading')
      setError(null)
      try {
        const response = await fetch(`/api/value/phase-items/${itemId}`, { credentials: 'include' })
        const payload = (await response.json().catch(() => ({}))) as {
          item?: PhaseItemDetail
          formula?: FormulaDetail | null
          boqItemIds?: number[]
          message?: string
        }

        if (!response.ok) {
          const message = response.status === 403 ? copy.messages.unauthorized : payload.message ?? copy.messages.error
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        setItem(payload.item ?? null)
        setNameDraft(payload.item?.name ?? '')
        setFormula(payload.formula ?? null)
        setFormulaDraft({
          expression: payload.formula?.expression ?? '',
        })
        const parsedFields = payload.formula?.inputSchema
          ? parseInputSchema(payload.formula.inputSchema)
          : []
        setFormulaFields(parsedFields.length ? parsedFields : [])
        const ids = (payload.boqItemIds ?? []).map((value) => String(value))
        setBindingSelection(ids)
        setBindingSaved(ids)
        setStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setStatus('error')
        setError((fetchError as Error).message)
      }
    }

    loadDetail()

    return () => {
      cancelled = true
    }
  }, [copy.messages.error, copy.messages.unauthorized, itemId])

  useEffect(() => {
    let cancelled = false

    const loadBoqItems = async () => {
      setBoqItemsStatus('loading')
      setBoqItemsError(null)
      try {
        const [contractRes, actualRes] = await Promise.all([
          fetch('/api/value/boq-items?scope=all&sheetType=CONTRACT&tone=ITEM', {
            credentials: 'include',
          }),
          fetch('/api/value/boq-items?scope=all&sheetType=ACTUAL&tone=ITEM', {
            credentials: 'include',
          }),
        ])
        const [contractPayload, actualPayload] = await Promise.all([
          contractRes.json().catch(() => ({})),
          actualRes.json().catch(() => ({})),
        ]) as Array<{ items?: BoqItemOption[]; message?: string }>

        if (!contractRes.ok || !actualRes.ok) {
          const message =
            contractRes.status === 403 || actualRes.status === 403
              ? copy.messages.unauthorized
              : contractPayload.message ?? actualPayload.message ?? '无法加载清单'
          if (contractRes.status === 403 || actualRes.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(message)
        }

        if (cancelled) return

        const contractItems = (contractPayload.items ?? []).filter(
          (entry) => entry.designationZh || entry.designationFr,
        )
        const actualCustomItems = (actualPayload.items ?? []).filter(
          (entry) =>
            (entry.designationZh || entry.designationFr) && entry.contractItemId === null,
        )
        const merged = [...contractItems, ...actualCustomItems]
        setBoqItems(merged)
        setBoqItemsStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setBoqItemsStatus('error')
        setBoqItemsError((fetchError as Error).message)
      }
    }

    loadBoqItems()

    return () => {
      cancelled = true
    }
  }, [copy.messages.unauthorized])

  useEffect(() => {
    if (permissionDenied) return
    if (status !== 'error') return
    const message = error ?? copy.messages.error
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, copy.messages.error, error, permissionDenied, status])

  const title = useMemo(
    () => item?.name ?? copy.tableHeaders.name,
    [item?.name, copy.tableHeaders.name],
  )
  const isFrenchLocale = locale === 'fr'

  const resolveBoqProjectLabel = useCallback((entry: BoqItemOption) => {
    const rawProjectName = normalizeLabelText(entry.projectName || '')
    const projectCode = entry.projectCode ?? ''
    const isBondoukou = projectCode === 'project-bondoukou-city' || rawProjectName.includes('邦杜库')
    const isDanda = projectCode === 'project-danda-city' || rawProjectName.includes('丹达')
    if (isBondoukou) return isFrenchLocale ? 'Voiries de Bondoukou' : '邦杜库市政'
    if (isDanda) return isFrenchLocale ? 'Voiries de Tanda' : '丹达市政'
    if (rawProjectName) return rawProjectName
    return isFrenchLocale ? 'Projet sans nom' : '未命名项目'
  }, [isFrenchLocale])

  const resolveBoqDesignation = useCallback((entry: BoqItemOption) => {
    const zh = normalizeLabelText(entry.designationZh ?? '')
    const fr = normalizeLabelText(entry.designationFr ?? '')
    if (isFrenchLocale) return fr || zh
    return zh || fr
  }, [isFrenchLocale])

  const boqItemById = useMemo(() => {
    const map = new Map<number, BoqItemOption>()
    boqItems.forEach((entry) => {
      map.set(entry.id, entry)
    })
    return map
  }, [boqItems])

  const selectedBoqItems = useMemo(
    () =>
      bindingSelection
        .map((value) => boqItemById.get(Number(value)))
        .filter((item): item is BoqItemOption => Boolean(item)),
    [bindingSelection, boqItemById],
  )

  const boqOptions = useMemo(
    () =>
      boqItems.map((entry) => {
        const projectLabel = resolveBoqProjectLabel(entry)
        const designation = resolveBoqDesignation(entry)
        const code = normalizeLabelText(entry.code || '')
        const label = designation
          ? `${projectLabel} · ${code} · ${designation}`
          : `${projectLabel} · ${code}`
        return { value: String(entry.id), label }
      }),
    [boqItems, resolveBoqDesignation, resolveBoqProjectLabel],
  )

  const normalizeBindingSelection = (values: string[]) => {
    const normalized = values.map((value) => value.trim()).filter(Boolean)
    const unique = new Set(normalized)
    const ordered = normalized.filter((value) => unique.delete(value))
    const projectMap = new Map<number, string>()
    ordered.forEach((value) => {
      const id = Number(value)
      const option = boqItemById.get(id)
      if (!option) return
      if (projectMap.has(option.projectId)) {
        projectMap.delete(option.projectId)
      }
      projectMap.set(option.projectId, value)
    })
    return Array.from(projectMap.values())
  }

  const handleBindingChange = (values: string[]) => {
    setBindingSelection(normalizeBindingSelection(values))
  }

  const nameDirty = useMemo(() => {
    if (!item) return false
    return nameDraft.trim() !== item.name
  }, [item, nameDraft])

  const handleSaveName = async () => {
    if (!item) return
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      addToast(copy.messages.nameRequired, { tone: 'warning' })
      return
    }
    if (!nameDirty) return
    setSavingName(true)
    try {
      const response = await fetch('/api/value/prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceItemId: item.id, name: trimmed }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        item?: PhaseItemDetail
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.updateError)
      }
      const updatedName = result.item?.name ?? trimmed
      setItem((prev) => (prev ? { ...prev, name: updatedName } : prev))
      setNameDraft(updatedName)
      addToast(copy.messages.saved, { tone: 'success' })
    } catch (saveError) {
      addToast((saveError as Error).message ?? copy.messages.updateError, { tone: 'danger' })
    } finally {
      setSavingName(false)
    }
  }

  const bindingDirty =
    bindingSelection.length !== bindingSaved.length ||
    bindingSelection.some((value) => !bindingSaved.includes(value))

  const handleSaveBinding = async () => {
    if (!item) return
    const ids = normalizeBindingSelection(bindingSelection)
    const boqItemIds = ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    setSavingBinding(true)
    try {
      const response = await fetch(`/api/value/phase-items/${item.id}/boq-bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ boqItemIds }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        boqItemIds?: number[]
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? '保存清单绑定失败')
      }
      const savedIds = (result.boqItemIds ?? boqItemIds).map((value) => String(value))
      setBindingSelection(savedIds)
      setBindingSaved(savedIds)
      addToast('清单绑定已保存', { tone: 'success' })
    } catch (saveError) {
      addToast((saveError as Error).message ?? '保存清单绑定失败', { tone: 'danger' })
    } finally {
      setSavingBinding(false)
    }
  }

  const addFormulaField = () => {
    setFormulaFields((prev) => [
      ...prev,
      { id: createFieldId(), key: '', label: '', unit: '', hint: '' },
    ])
  }

  const updateFormulaField = (id: string, key: keyof FormulaField, value: string) => {
    setFormulaFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, [key]: value } : field)),
    )
  }

  const removeFormulaField = (id: string) => {
    setFormulaFields((prev) => prev.filter((field) => field.id !== id))
  }

  const handleSaveFormula = async () => {
    if (!item) return
    const expression = formulaDraft.expression.trim()
    const fields = formulaFields
      .map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        unit: field.unit.trim(),
        hint: field.hint.trim(),
      }))
      .filter((field) => field.key.length > 0)
      .map((field) => ({
        key: field.key,
        label: field.label || field.key,
        unit: field.unit || null,
        hint: field.hint || null,
      }))

    const keys = fields.map((field) => field.key)
    const uniqueKeys = new Set(keys)
    if (keys.length !== uniqueKeys.size) {
      addToast('字段 Key 必须唯一', { tone: 'warning' })
      return
    }
    const fallbackFields: FormulaField[] = fields.map((field) => ({
      id: createFieldId(),
      key: field.key,
      label: field.label,
      unit: field.unit ?? '',
      hint: field.hint ?? '',
    }))

    setSavingFormula(true)
    try {
      const response = await fetch(`/api/value/phase-items/${item.id}/formula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expression, fields }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        formula?: FormulaDetail | null
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? '保存公式失败')
      }
      setFormula(result.formula ?? null)
      setFormulaDraft({
        expression: result.formula?.expression ?? '',
      })
      if (!result.formula) {
        setFormulaFields([])
      } else {
        const parsed = result.formula.inputSchema
          ? parseInputSchema(result.formula.inputSchema)
          : []
        setFormulaFields(parsed.length ? parsed : fallbackFields)
      }
      addToast('公式已保存', { tone: 'success' })
    } catch (saveError) {
      addToast((saveError as Error).message ?? '保存公式失败', { tone: 'danger' })
    } finally {
      setSavingFormula(false)
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
                { label: title },
              ]}
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
              <p className="text-sm text-slate-600">{status === 'loading' ? copy.messages.loading : ''}</p>
            </div>
          </div>
            <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              {[
                { key: 'production', label: tabCopy.tabs.production, href: '/value' },
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
              {status === 'error' ? error ?? copy.messages.error : null}
            </div>
            <Link
              href={item ? `/value/prices/${item.phaseDefinitionId}` : '/value/prices'}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              {copy.card.backToNames}
            </Link>
          </div>
          {status === 'success' && item ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {copy.itemConfig.nameTitle}
                      </h2>
                      <p className="text-xs text-slate-500">{copy.itemConfig.nameHint}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      {copy.itemConfig.nameLabel}
                      <input
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        placeholder={copy.itemConfig.namePlaceholder}
                      />
                    </label>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingName || !nameDirty}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingName ? `${copy.itemConfig.saveName}...` : copy.itemConfig.saveName}
                    </button>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {copy.itemConfig.formulaTitle}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {formula?.expression ? copy.itemConfig.formulaActive : copy.itemConfig.formulaEmpty}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      {copy.itemConfig.formulaExpressionLabel}
                      <input
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={formulaDraft.expression}
                        onChange={(event) =>
                          setFormulaDraft((prev) => ({ ...prev, expression: event.target.value }))
                        }
                        placeholder={copy.itemConfig.formulaExpressionPlaceholder}
                      />
                    </label>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="font-semibold">{copy.itemConfig.formulaFieldsLabel}</span>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 transition hover:-translate-y-0.5"
                        onClick={addFormulaField}
                      >
                        {copy.itemConfig.addField}
                      </button>
                    </div>
                    {formulaFields.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                        {copy.itemConfig.formulaFieldsEmpty}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formulaFields.map((field) => (
                          <div
                            key={field.id}
                            className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-5"
                          >
                            <input
                              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900"
                              placeholder={copy.itemConfig.formulaFieldKey}
                              value={field.key}
                              onChange={(event) =>
                                updateFormulaField(field.id, 'key', event.target.value)
                              }
                            />
                            <input
                              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900"
                              placeholder={copy.itemConfig.formulaFieldLabel}
                              value={field.label}
                              onChange={(event) =>
                                updateFormulaField(field.id, 'label', event.target.value)
                              }
                            />
                            <input
                              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900"
                              placeholder={copy.itemConfig.formulaFieldUnit}
                              value={field.unit}
                              onChange={(event) =>
                                updateFormulaField(field.id, 'unit', event.target.value)
                              }
                            />
                            <input
                              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900 md:col-span-2"
                              placeholder={copy.itemConfig.formulaFieldHint}
                              value={field.hint}
                              onChange={(event) =>
                                updateFormulaField(field.id, 'hint', event.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500 hover:text-rose-600 md:col-span-5"
                              onClick={() => removeFormulaField(field.id)}
                            >
                              {copy.itemConfig.removeField}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-slate-500">
                      {copy.itemConfig.formulaBuiltins}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveFormula}
                      disabled={savingFormula}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingFormula ? `${copy.itemConfig.saveFormula}...` : copy.itemConfig.saveFormula}
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-sm font-semibold text-slate-900">{copy.itemConfig.bindingTitle}</h2>
                <p className="mt-1 text-xs text-slate-500">{copy.itemConfig.bindingHint}</p>
                <div className="mt-4 space-y-3">
                  <MultiSelectFilter
                    label={copy.tableHeaders.boqItem}
                    variant="form"
                    options={boqOptions}
                    selected={bindingSelection}
                    onChange={handleBindingChange}
                    allLabel={copy.bindingDropdown.allLabel}
                    selectedLabel={(count) =>
                      formatCopy(copy.bindingDropdown.selectedLabel, { count })
                    }
                    selectAllLabel={copy.bindingDropdown.selectAll}
                    clearLabel={copy.bindingDropdown.clear}
                    searchPlaceholder={copy.bindingDropdown.searchPlaceholder}
                    noOptionsLabel={copy.bindingDropdown.noOptions}
                    disabled={boqItemsStatus === 'loading'}
                    multiple
                    zIndex={40}
                    className="w-full"
                  />
                  {boqItemsStatus === 'error' ? (
                    <p className="text-xs text-rose-600">{boqItemsError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSaveBinding}
                    disabled={savingBinding || !bindingDirty}
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingBinding ? `${copy.itemConfig.saveBinding}...` : copy.itemConfig.saveBinding}
                  </button>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">
                      {copy.itemConfig.bindingSummaryTitle}
                    </div>
                    {selectedBoqItems.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-500">
                        {copy.itemConfig.bindingSummaryEmpty}
                      </div>
                    ) : (
                      <div className="mt-3 max-h-72 overflow-auto">
                        <table className="min-w-[360px] w-full text-left text-xs text-slate-600">
                          <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                            <tr>
                              <th className="px-2 py-2 font-semibold">名称</th>
                              <th className="px-2 py-2 font-semibold">合同量</th>
                              <th className="px-2 py-2 font-semibold">单位</th>
                              <th className="px-2 py-2 font-semibold">单价</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedBoqItems.map((entry) => (
                              <tr key={entry.id} className="border-t border-slate-100">
                                <td className="px-2 py-2 text-slate-900">
                                  <span className="block max-w-[320px] truncate">
                                    {resolveBoqDesignation(entry) || normalizeLabelText(entry.code || '')}
                                  </span>
                                </td>
                                <td className="px-2 py-2">{formatNumber(entry.quantity, 3)}</td>
                                <td className="px-2 py-2">{entry.unit ?? '—'}</td>
                                <td className="px-2 py-2">{formatNumber(entry.unitPrice, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
