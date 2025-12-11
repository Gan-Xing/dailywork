'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  WorkflowBinding,
  WorkflowCheckTemplate,
  WorkflowLayerTemplate,
  WorkflowTemplate,
} from '@/lib/progressWorkflow'
import { defaultWorkflowTypes } from '@/lib/progressWorkflow'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { useToast } from '@/components/ToastProvider'
import { locales } from '@/lib/i18n'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type WorkflowItem = WorkflowBinding

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

interface Props {
  initialWorkflows: WorkflowItem[]
}

export function WorkflowManager({ initialWorkflows }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const t = getProgressCopy(locale)
  const copy = t.workflow
  const listJoiner = locale === 'fr' ? ', ' : '、'
  const { addToast } = useToast()
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(() => initialWorkflows)
  const [selectedId, setSelectedId] = useState<string>(initialWorkflows[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layerNameDraft, setLayerNameDraft] = useState('')
  const [layerStageDraft, setLayerStageDraft] = useState<number | ''>(1)
  const [layerStageDrafts, setLayerStageDrafts] = useState<Record<string, string>>({})
  const [layerToDelete, setLayerToDelete] = useState('')
  const [checkDrafts, setCheckDrafts] = useState<Record<string, string>>({})
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateMeasure, setNewTemplateMeasure] = useState<WorkflowTemplate['measure']>('LINEAR')
  const [newTemplatePointHasSides, setNewTemplatePointHasSides] = useState(false)

  const selected = useMemo(
    () => workflows.find((item) => item.id === selectedId) ?? workflows[0],
    [selectedId, workflows],
  )

  const displayLayerName = useCallback(
    (name: string) => localizeProgressTerm('layer', name, locale, { phaseName: selected?.phaseName }),
    [locale, selected?.phaseName],
  )
  const displayCheckName = useCallback(
    (name: string) => localizeProgressTerm('check', name, locale),
    [locale],
  )
  const displayTypeName = useCallback(
    (name: string) => localizeProgressTerm('type', name, locale),
    [locale],
  )

  useEffect(() => {
    setWorkflows(initialWorkflows)
    setSelectedId(initialWorkflows[0]?.id ?? '')
  }, [initialWorkflows])

  useEffect(() => {
    if (!workflows.length) {
      setSelectedId('')
      return
    }
    if (selectedId && workflows.some((item) => item.id === selectedId)) {
      return
    }
    setSelectedId(workflows[0].id)
  }, [selectedId, workflows])

  const stageGroups = useMemo(() => {
    if (!selected) return []
    const map = new Map<number, WorkflowLayerTemplate[]>()
    selected.layers.forEach((layer) => {
      const bucket = map.get(layer.stage) ?? []
      bucket.push(layer)
      map.set(layer.stage, bucket)
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [selected])

  const sortedLayers = useMemo(() => {
    if (!selected) return []
    return selected.layers.slice().sort((a, b) => a.stage - b.stage)
  }, [selected])

  const nextStageSuggestion = useMemo(() => {
    if (!selected) return 1
    if (!sortedLayers.length) return 1
    return sortedLayers.reduce((acc, cur) => Math.max(acc, cur.stage), 0) + 1
  }, [selected, sortedLayers])

  useEffect(() => {
    if (!selected) {
      setLayerStageDraft(1)
      setLayerToDelete('')
      setLayerStageDrafts({})
      setCheckDrafts({})
      return
    }
    setLayerStageDraft(nextStageSuggestion)
    setLayerToDelete(selected.layers[0]?.id ?? '')
    setLayerStageDrafts({})
    setCheckDrafts((prev) => {
      const allowed = new Set(selected.layers.map((layer) => layer.id))
      return Object.fromEntries(Object.entries(prev).filter(([id]) => allowed.has(id)))
    })
  }, [nextStageSuggestion, selected])

  const handleManualSave = async () => {
    if (!selected) return
    const layerCount = selected.layers.length
    const checkCount = selected.layers.flatMap((layer) => layer.checks || []).filter((c) => c && c.name?.trim()).length
    if (!layerCount) {
      setError(copy.errors?.layerRequired || '模板至少需要 1 个层次')
      return
    }
    if (!checkCount) {
      setError(copy.errors?.checkRequired || '模板至少需要 1 个验收内容')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/progress/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseDefinitionId: selected.phaseDefinitionId,
          workflow: selected,
          name: selected?.phaseName ?? '',
          measure: selected?.measure,
          pointHasSides: selected?.pointHasSides,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data.message || copy.saveFailed)
      }
      const data = (await res.json()) as { workflow: WorkflowItem }
      setWorkflows((prev) =>
        prev.map((item) => (item.phaseDefinitionId === data.workflow.phaseDefinitionId ? data.workflow : item)),
      )
      addToast(copy.saved, { tone: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTemplate = async () => {
    const name = newTemplateName.trim()
    if (!name) {
      setError(copy.errors.templateNameRequired)
      return
    }
    if (!layerNameDraft.trim()) {
      setError(copy.errors?.layerRequired || '模板至少需要 1 个层次')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const initialLayer = {
        id: `layer-${Date.now().toString(36)}`,
        name: layerNameDraft.trim(),
        stage: 1,
        dependencies: [],
        lockStepWith: [],
        parallelWith: [],
        description: '',
        checks: [
          {
            id: `check-${Date.now().toString(36)}`,
            name: copy.checkPlaceholder || '验收内容',
            types: defaultWorkflowTypes,
          },
        ],
      }
      const res = await fetch('/api/progress/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          measure: newTemplateMeasure,
          pointHasSides: newTemplateMeasure === 'POINT' ? newTemplatePointHasSides : false,
          workflow: {
            id: `phase-${Date.now().toString(36)}`,
            phaseName: name,
            measure: newTemplateMeasure,
            defaultTypes: defaultWorkflowTypes,
            layers: [initialLayer],
          },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { workflow?: WorkflowItem; message?: string }
      if (!res.ok || !data.workflow) {
        throw new Error(data.message || copy.saveFailed)
      }
      setWorkflows((prev) => (data.workflow ? [...prev, data.workflow] : prev))
      setSelectedId(data.workflow.id)
      setNewTemplateName('')
      setNewTemplateMeasure('LINEAR')
      setNewTemplatePointHasSides(false)
      setLayerNameDraft('')
      addToast(copy.templateCreated, { tone: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/progress/workflows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseDefinitionId: selected.phaseDefinitionId }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(data.message || copy.deleteFailed)
      }
      setWorkflows((prev) => {
        const next = prev.filter((item) => item.phaseDefinitionId !== selected.phaseDefinitionId)
        setSelectedId((current) => {
          if (current !== selected.id) return current
          return next[0]?.id ?? ''
        })
        return next
      })
      addToast(copy.deleted, { tone: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/progress/workflows')
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data.message || copy.saveFailed)
      }
      const data = (await res.json()) as { workflows: WorkflowItem[] }
      setWorkflows(data.workflows)
      setSelectedId(data.workflows[0]?.id ?? '')
      addToast(copy.reset, { tone: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const updateSelectedWorkflow = (updater: (tpl: WorkflowItem) => WorkflowItem) => {
    setWorkflows((prev) =>
      prev.map((tpl) =>
        tpl.phaseDefinitionId === (selected?.phaseDefinitionId ?? 0)
          ? updater(JSON.parse(JSON.stringify(tpl)) as WorkflowItem)
          : tpl,
      ),
    )
  }

  const updateLayer = (
    layerId: string,
    updater: (layer: WorkflowLayerTemplate) => WorkflowLayerTemplate,
  ) => {
    if (!selected) return
    updateSelectedWorkflow((tpl) => ({
      ...tpl,
      layers: tpl.layers.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
    }))
  }

  const toggleLayerField = (
    layer: WorkflowLayerTemplate,
    targetId: string,
    field: 'dependencies' | 'lockStepWith' | 'parallelWith',
  ) => {
    const next = layer[field]?.includes(targetId)
      ? (layer[field] || []).filter((item) => item !== targetId)
      : [...(layer[field] || []), targetId]
    updateLayer(layer.id, (prev) => ({ ...prev, [field]: next }))
  }

  const updateCheck = (
    layerId: string,
    checkId: string,
    updater: (check: WorkflowCheckTemplate) => WorkflowCheckTemplate,
  ) => {
    updateLayer(layerId, (layer) => ({
      ...layer,
      checks: layer.checks.map((check) => (check.id === checkId ? updater(check) : check)),
    }))
  }

  const addLayer = (options?: { name?: string; stage?: number }) => {
    if (!selected) return
    const resolvedStage =
      typeof options?.stage === 'number' && Number.isFinite(options.stage)
        ? Math.max(1, Math.floor(options.stage))
        : nextStageSuggestion
    const previous = sortedLayers.filter((layer) => layer.stage < resolvedStage).slice(-1)[0]
    const defaultType = selected.defaultTypes?.[0] ?? defaultWorkflowTypes[0]
    const newLayer: WorkflowLayerTemplate = {
      id: uid('layer'),
      name: options?.name?.trim() || copy.newLayer,
      stage: resolvedStage,
      dependencies: previous ? [previous.id] : [],
      lockStepWith: [],
      parallelWith: [],
      description: '',
      checks: [
        {
          id: uid('check'),
          name: copy.newCheck,
          types: [defaultType],
        },
      ],
    }
    updateSelectedWorkflow((tpl) => ({ ...tpl, layers: [...tpl.layers, newLayer] }))
  }

  const removeLayer = (layerId: string) => {
    updateSelectedWorkflow((tpl) => ({
      ...tpl,
      layers: tpl.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) => ({
          ...layer,
          dependencies: layer.dependencies.filter((id) => id !== layerId),
          lockStepWith: (layer.lockStepWith ?? []).filter((id) => id !== layerId),
          parallelWith: (layer.parallelWith ?? []).filter((id) => id !== layerId),
        })),
    }))
    setLayerToDelete((prev) => (prev === layerId ? '' : prev))
    setLayerStageDrafts((prev) => {
      if (!(layerId in prev)) return prev
      const next = { ...prev }
      delete next[layerId]
      return next
    })
    setCheckDrafts((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
  }

  const addCheck = (layerId: string, name?: string) => {
    if (!selected) return
    const defaultType = selected?.defaultTypes?.[0] ?? defaultWorkflowTypes[0]
    updateLayer(layerId, (layer) => ({
      ...layer,
      checks: [
        ...layer.checks,
        { id: uid('check'), name: name?.trim() || copy.newCheck, types: [defaultType] },
      ],
    }))
    setCheckDrafts((prev) => ({ ...prev, [layerId]: '' }))
  }

  const removeCheck = (layerId: string, checkId: string) => {
    updateLayer(layerId, (layer) => ({
      ...layer,
      checks: layer.checks.filter((item) => item.id !== checkId),
    }))
  }

  const reorderCheck = (layerId: string, checkId: string, delta: number) => {
    updateLayer(layerId, (layer) => {
      const index = layer.checks.findIndex((item) => item.id === checkId)
      const nextIndex = index + delta
      if (index < 0 || nextIndex < 0 || nextIndex >= layer.checks.length) return layer
      const reordered = [...layer.checks]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(nextIndex, 0, moved)
      return { ...layer, checks: reordered }
    })
  }

  const toggleCheckType = (layerId: string, checkId: string, type: string) => {
    updateCheck(layerId, checkId, (check) => {
      const exists = check.types.includes(type)
      return {
        ...check,
        types: exists ? check.types.filter((item) => item !== type) : [...check.types, type],
      }
    })
  }

  const summaryRules = useMemo(() => {
    if (!selected) return []
    return selected.layers.map((layer) => {
      const deps =
        layer.dependencies.length > 0
          ? formatProgressCopy(copy.ruleDepends, {
              name: layer.name,
              deps: layer.dependencies
                .map((id) =>
                  displayLayerName(selected.layers.find((item) => item.id === id)?.name || id),
                )
                .join(listJoiner),
            })
          : ''
      const locks =
        (layer.lockStepWith?.length ?? 0) > 0
          ? formatProgressCopy(copy.ruleLock, {
              name: layer.name,
              peers: (layer.lockStepWith || [])
                .map((id) =>
                  displayLayerName(selected.layers.find((item) => item.id === id)?.name || id),
                )
                .join(listJoiner),
          })
          : ''
      return [deps, locks].filter(Boolean).join(' · ')
    })
  }, [copy.ruleDepends, copy.ruleLock, displayLayerName, listJoiner, selected])

  const checkCount = useMemo(
    () => (selected ? selected.layers.reduce((acc, layer) => acc + layer.checks.length, 0) : 0),
    [selected],
  )

  const breadcrumbItems = useMemo(
    () => [
      { label: t.nav.home, href: '/' },
      { label: t.nav.progress, href: '/progress' },
      { label: copy.badge },
    ],
    [copy.badge, t.nav.home, t.nav.progress],
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-12 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-400/20 via-blue-400/15 to-amber-300/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white">{copy.title}</h1>
              <p className="max-w-3xl text-sm text-slate-200/80">{copy.description}</p>
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleManualSave}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 transition ${
                  saving
                    ? 'bg-emerald-200/70 text-slate-800'
                    : 'bg-emerald-300 hover:-translate-y-0.5 hover:bg-emerald-400'
                }`}
              >
                {saving ? copy.saving : copy.actions.save}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
              >
                {copy.actions.reset}
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-amber-200">{error}</p> : null}
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-12 xl:gap-8">
          <section className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">
                    {copy.templateBadge}
                  </p>
                  <h2 className="text-lg font-semibold text-white">{copy.templateTitle}</h2>
                  <p className="text-xs text-slate-300">{copy.templateHint}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                  {selected?.phaseName || copy.templateEmpty}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-xs text-slate-200/80">
                <label className="flex w-full items-center gap-3 text-sm text-slate-200">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
                    {copy.templateBadge}
                  </span>
                  <select
                    value={selected?.id ?? ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="flex-1 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                  >
                    {!selected ? <option value="">{copy.empty}</option> : null}
                    {workflows.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.phaseName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-200">
                  {copy.templateNameLabel}
                  <input
                    type="text"
                    value={selected?.phaseName ?? ''}
                    onChange={(e) =>
                      selected &&
                      updateSelectedWorkflow((tpl) => ({
                        ...tpl,
                        phaseName: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    placeholder={copy.templateNamePlaceholder}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-slate-200">
                    {copy.measureLabel}
                    <select
                      value={selected?.measure ?? 'LINEAR'}
                      onChange={(e) =>
                        selected &&
                        updateSelectedWorkflow((tpl) => ({
                          ...tpl,
                          measure: e.target.value as WorkflowTemplate['measure'],
                          pointHasSides: e.target.value === 'POINT' ? tpl.pointHasSides ?? false : false,
                        }))
                      }
                      className="rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    >
                      <option value="LINEAR">{copy.measureLinear}</option>
                      <option value="POINT">{copy.measurePoint}</option>
                    </select>
                  </label>
                  {selected?.measure === 'POINT' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.pointHasSides)}
                        onChange={(e) =>
                          updateSelectedWorkflow((tpl) => ({
                            ...tpl,
                            pointHasSides: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-300 focus:ring-0"
                      />
                      <span>{copy.pointHasSidesLabel}</span>
                    </label>
                  ) : null}
                </div>
                {selected ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm text-slate-200">
                      {copy.templateDescriptionLabel}
                      <textarea
                        value={selected.description ?? ''}
                        onChange={(e) =>
                          updateSelectedWorkflow((tpl) => ({
                            ...tpl,
                            description: e.target.value,
                          }))
                        }
                        placeholder={copy.templateDescriptionPlaceholder}
                        className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        rows={3}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-slate-200">
                      {copy.templateSideRuleLabel}
                      <textarea
                        value={selected.sideRule ?? ''}
                        onChange={(e) =>
                          updateSelectedWorkflow((tpl) => ({
                            ...tpl,
                            sideRule: e.target.value,
                          }))
                        }
                        placeholder={copy.templateSideRulePlaceholder}
                        className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        rows={3}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatProgressCopy(copy.bindingLayers, { count: selected?.layers.length ?? 0 })}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatProgressCopy(copy.bindingChecks, { count: checkCount })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    disabled={!selected}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'border-rose-200/60 bg-rose-200/20 text-rose-50 hover:-translate-y-0.5 hover:bg-rose-200/30'
                        : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    {copy.actions.deleteTemplate}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100/10 bg-emerald-50/5 p-4 shadow-lg shadow-emerald-300/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{copy.newTemplateBadge}</p>
                  <h2 className="text-lg font-semibold text-white">{copy.newTemplateTitle}</h2>
                  <p className="text-xs text-slate-200/80">{copy.newTemplateHint}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={copy.newTemplatePlaceholder}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60 sm:w-1/2"
                />
                <select
                  value={newTemplateMeasure}
                  onChange={(e) => setNewTemplateMeasure(e.target.value as WorkflowTemplate['measure'])}
                  className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60 sm:w-auto"
                >
                  <option value="LINEAR">{copy.measureLinear}</option>
                  <option value="POINT">{copy.measurePoint}</option>
                </select>
                {newTemplateMeasure === 'POINT' ? (
                  <label className="flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={newTemplatePointHasSides}
                      onChange={(e) => setNewTemplatePointHasSides(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-300 focus:ring-0"
                    />
                    <span>{copy.pointHasSidesLabel}</span>
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={handleCreateTemplate}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-300/80 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-400"
                >
                  {copy.actions.createTemplate}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-blue-400/10">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-100">{copy.ruleBadge}</p>
                    <h2 className="text-lg font-semibold text-white">{copy.ruleTitle}</h2>
                    <p className="text-xs text-slate-200/80">{copy.ruleHint}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3 shadow-inner shadow-slate-900/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                        {copy.quick.layerTitle}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {copy.stageCountPrefix} {selected?.layers.length ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300">{copy.quick.layerHint}</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={layerNameDraft}
                        onChange={(e) => setLayerNameDraft(e.target.value)}
                        placeholder={copy.newLayer}
                        className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60"
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-200">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-100">
                          {copy.stageLabel}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={layerStageDraft}
                          onChange={(e) => {
                            const value = e.target.value
                            if (!value) {
                              setLayerStageDraft('')
                              return
                            }
                            const numeric = Number(value)
                            setLayerStageDraft(Number.isFinite(numeric) ? Math.max(1, numeric) : '')
                          }}
                          className="w-20 rounded border border-white/20 bg-slate-950/60 px-2 py-1 text-sm text-white outline-none transition focus:border-emerald-300/60"
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          addLayer({
                            name: layerNameDraft,
                            stage: typeof layerStageDraft === 'number' ? layerStageDraft : undefined,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/40 bg-emerald-300/80 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-400"
                      >
                        {copy.actions.addLayer}
                      </button>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <select
                          value={layerToDelete}
                          onChange={(e) => setLayerToDelete(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-200/60 sm:w-48"
                        >
                          <option value="">{copy.quick.deletePlaceholder}</option>
                          {sortedLayers.map((layer) => (
                            <option key={layer.id} value={layer.id}>
                              {layer.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => layerToDelete && removeLayer(layerToDelete)}
                          disabled={!layerToDelete}
                          className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition sm:w-auto ${
                            layerToDelete
                              ? 'border-amber-200/60 bg-amber-200/30 text-amber-900 hover:-translate-y-0.5 hover:bg-amber-300'
                              : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-400'
                          }`}
                        >
                          {copy.actions.deleteLayer}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {sortedLayers.map((layer) => {
                  const others = selected.layers.filter((item) => item.id !== layer.id)
                  return (
                    <div
                      key={layer.id}
                      className="rounded-xl border border-white/10 bg-slate-900/70 p-3 shadow-inner shadow-slate-900/30"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-1 flex-col gap-2">
                          <input
                            type="text"
                            value={layer.name}
                            onChange={(e) =>
                              updateLayer(layer.id, (prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60"
                          />
                          <textarea
                            value={layer.description ?? ''}
                            onChange={(e) =>
                              updateLayer(layer.id, (prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder={copy.layerNote}
                            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 outline-none transition focus:border-emerald-300/60"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs text-slate-200">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-100">
                              {copy.stageLabel}
                            </span>
                            <input
                              type="number"
                              value={layerStageDrafts[layer.id] ?? layer.stage}
                              min={1}
                              onChange={(e) => {
                                const value = e.target.value
                                if (value === '') {
                                  setLayerStageDrafts((prev) => ({ ...prev, [layer.id]: '' }))
                                  return
                                }
                                const numeric = Number(value)
                                if (!Number.isFinite(numeric)) return
                                const nextStage = Math.max(1, Math.floor(numeric))
                                setLayerStageDrafts((prev) => ({
                                  ...prev,
                                  [layer.id]: String(nextStage),
                                }))
                                updateLayer(layer.id, (prev) => ({
                                  ...prev,
                                  stage: nextStage,
                                }))
                              }}
                              onBlur={() =>
                                setLayerStageDrafts((prev) => {
                                  if (!(layer.id in prev)) return prev
                                  const next = { ...prev }
                                  delete next[layer.id]
                                  return next
                                })
                              }
                              className="w-16 rounded border border-white/20 bg-slate-950/60 px-2 py-1 text-sm text-white outline-none transition focus:border-emerald-300/60"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeLayer(layer.id)}
                            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-amber-200 transition hover:border-amber-200/60 hover:bg-amber-200/20 hover:text-amber-50"
                          >
                            {copy.actions.deleteLayer}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-100">{copy.dependsLabel}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {others.map((target) => (
                              <button
                                key={target.id}
                                type="button"
                                onClick={() => toggleLayerField(layer, target.id, 'dependencies')}
                                className={`rounded-full px-3 py-1 text-xs transition ${
                                  layer.dependencies.includes(target.id)
                                    ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/40'
                                    : 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
                                }`}
                              >
                                {target.name}
                              </button>
                            ))}
                            {others.length === 0 ? (
                              <span className="text-[11px] text-slate-400">{copy.noPeers}</span>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-100">{copy.lockLabel}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {others.map((target) => (
                              <button
                                key={target.id}
                                type="button"
                                onClick={() => toggleLayerField(layer, target.id, 'lockStepWith')}
                                className={`rounded-full px-3 py-1 text-xs transition ${
                                  (layer.lockStepWith || []).includes(target.id)
                                    ? 'bg-blue-300 text-slate-900 shadow shadow-blue-400/40'
                                    : 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
                                }`}
                              >
                                {target.name}
                              </button>
                            ))}
                            {others.length === 0 ? (
                              <span className="text-[11px] text-slate-400">{copy.noPeers}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-100">{copy.parallelLabel}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {others.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => toggleLayerField(layer, target.id, 'parallelWith')}
                              className={`rounded-full px-3 py-1 text-xs transition ${
                                (layer.parallelWith || []).includes(target.id)
                                  ? 'bg-amber-200 text-slate-900 shadow shadow-amber-300/40'
                                  : 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
                              }`}
                            >
                              {target.name}
                            </button>
                          ))}
                          {others.length === 0 ? (
                            <span className="text-[11px] text-slate-400">{copy.noPeers}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-semibold text-slate-100">{copy.checkTitle}</p>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={checkDrafts[layer.id] ?? ''}
                              onChange={(e) =>
                                setCheckDrafts((prev) => ({ ...prev, [layer.id]: e.target.value }))
                              }
                              placeholder={copy.quick.checkPlaceholder}
                              className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60 sm:w-56"
                            />
                            <button
                              type="button"
                              onClick={() => addCheck(layer.id, checkDrafts[layer.id])}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-emerald-200/60 hover:bg-emerald-300/80 hover:text-slate-900"
                            >
                              {copy.actions.addCheck}
                            </button>
                          </div>
                        </div>
                        <ol className="space-y-2">
                          {layer.checks.map((check, idx) => (
                            <li
                              key={check.id}
                              className="rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-1 items-center gap-2">
                                  <span className="rounded-full bg-emerald-300/20 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                                    {idx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={check.name}
                                    onChange={(e) =>
                                      updateCheck(layer.id, check.id, (prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/60"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => reorderCheck(layer.id, check.id, -1)}
                                    className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white transition hover:border-white/40 hover:bg-white/10"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => reorderCheck(layer.id, check.id, 1)}
                                    className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white transition hover:border-white/40 hover:bg-white/10"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeCheck(layer.id, check.id)}
                                    className="rounded-full border border-amber-200/60 bg-amber-300/80 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:-translate-y-0.5 hover:bg-amber-400"
                                    aria-label={copy.actions.deleteCheck}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {defaultWorkflowTypes.map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => toggleCheckType(layer.id, check.id, type)}
                                    className={`rounded-full px-3 py-1 text-[11px] transition ${
                                      check.types.includes(type)
                                        ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/40'
                                        : 'border border-white/10 bg-white/5 text-slate-100 hover:border-white/40 hover:bg-white/10'
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={check.notes ?? ''}
                                onChange={(e) =>
                                  updateCheck(layer.id, check.id, (prev) => ({
                                    ...prev,
                                    notes: e.target.value,
                                  }))
                                }
                                placeholder={copy.checkNote}
                                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 outline-none transition focus:border-emerald-300/60"
                                rows={2}
                              />
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-emerald-500/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">
                    {copy.timelineBadge}
                  </p>
                  <h2 className="text-xl font-semibold text-white">
                    {formatProgressCopy(copy.timelineTitle, {
                      phase: selected?.phaseName ?? copy.templateEmpty,
                    })}
                  </h2>
                  <p className="text-xs text-slate-200/80">{copy.timelineHint}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-100">
                  <span className="rounded-full bg-emerald-300/30 px-2 py-1 text-emerald-50">
                    {copy.legend.locked}
                  </span>
                  <span className="rounded-full bg-blue-300/20 px-2 py-1 text-blue-50">
                    {copy.legend.parallel}
                  </span>
                  <span className="rounded-full bg-amber-300/20 px-2 py-1 text-amber-50">
                    {copy.legend.types}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {stageGroups.map(([stage, layers]) => (
                  <div
                    key={stage}
                    className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-inner shadow-slate-900/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-300/30 px-2 py-1 text-[11px] font-semibold text-emerald-50">
                          {formatProgressCopy(copy.stageName, { value: stage })}
                        </span>
                        <span className="text-xs text-slate-300">{copy.stageHint}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {copy.stageCountPrefix} {layers.length}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {layers.map((layer) => (
                        <div
                          key={layer.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-3 shadow shadow-slate-900/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-white">
                                {displayLayerName(layer.name)}
                              </p>
                              <p className="text-[11px] text-slate-300">
                                {layer.dependencies.length
                                  ? formatProgressCopy(copy.timelineDepends, {
                                      deps: layer.dependencies
                                        .map(
                                          (id) =>
                                            displayLayerName(
                                              selected.layers.find((item) => item.id === id)?.name || id,
                                            ),
                                        )
                                        .join(listJoiner),
                                    })
                                  : copy.timelineFree}
                              </p>
                              {layer.description ? (
                                <p className="text-[11px] text-amber-100">{layer.description}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-end gap-1 text-[11px]">
                              {layer.lockStepWith && layer.lockStepWith.length ? (
                                <span className="rounded-full bg-emerald-300/30 px-2 py-1 text-emerald-50">
                                  {formatProgressCopy(copy.lockedWith, {
                                    peers: layer.lockStepWith
                                      .map(
                                        (id) =>
                                          displayLayerName(
                                            selected.layers.find((item) => item.id === id)?.name || id,
                                          ),
                                      )
                                      .join(listJoiner),
                                  })}
                                </span>
                              ) : null}
                              {layer.parallelWith && layer.parallelWith.length ? (
                                <span className="rounded-full bg-blue-300/20 px-2 py-1 text-blue-50">
                                  {formatProgressCopy(copy.parallelWith, {
                                    peers: layer.parallelWith
                                      .map(
                                        (id) =>
                                          displayLayerName(
                                            selected.layers.find((item) => item.id === id)?.name || id,
                                          ),
                                      )
                                      .join(listJoiner),
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ol className="mt-3 space-y-2">
                            {layer.checks.map((check, idx) => (
                              <li
                                key={check.id}
                                className="rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200">
                                      {idx + 1}
                                    </span>
                                    <span className="text-sm text-white">
                                      {displayCheckName(check.name)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {check.types.map((type) => (
                                      <span
                                        key={type}
                                        className="rounded-full bg-amber-300/20 px-2 py-1 text-[11px] text-amber-100"
                                      >
                                        {displayTypeName(type)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {check.notes ? (
                                  <p className="mt-1 text-[11px] text-amber-100">{check.notes}</p>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-slate-900/40">
              <h3 className="text-sm font-semibold text-white">{copy.summaryTitle}</h3>
              <p className="text-xs text-slate-300">{copy.summaryHint}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-100">
                {summaryRules.filter(Boolean).length ? (
                  summaryRules
                    .filter(Boolean)
                    .map((rule, idx) => (
                      <p key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        <span>{rule}</span>
                      </p>
                    ))
                ) : (
                  <p className="text-slate-400">{copy.summaryEmpty}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
