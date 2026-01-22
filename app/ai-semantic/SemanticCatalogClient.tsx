"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AccessDenied } from "@/components/AccessDenied"
import { MultiSelectFilter, type MultiSelectOption } from "@/components/MultiSelectFilter"
import type { ApiCatalogEntry } from "@/lib/ai-chat/adapters/dailywork/apiCatalog"
import type { ApiSemanticCatalog, ApiSemanticEntry, SemanticStatus } from "@/lib/ai-chat/semanticTypes"
import { usePreferredLocale } from "@/lib/usePreferredLocale"

type SemanticCatalogClientProps = {
  sessionUser: { id: number; username: string } | null
  canView: boolean
  canEdit: boolean
}

type CatalogPayload = {
  catalog: ApiCatalogEntry[]
  semantic: ApiSemanticCatalog
}

type SemanticDraft = {
  summary: string
  intentsText: string
  examplesText: string
  inputNotesText: string
  outputNotesText: string
  returnType: string
  idField: string
  detailEndpointKey: string
  detailParam: string
  detailParamLocation: string
  evidenceFieldsText: string
  detailKeysText: string
  status: SemanticStatus
}

type StatusFilter = "empty" | "draft" | "verified"

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  PATCH: "bg-violet-100 text-violet-700",
  DELETE: "bg-rose-100 text-rose-700",
}

const STATUS_STYLES: Record<StatusFilter, string> = {
  empty: "bg-slate-200 text-slate-600",
  draft: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
}

const parseList = (value: string) => {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatList = (list?: string[]) => (list && list.length ? list.join("\n") : "")

const buildDraft = (entry?: ApiSemanticEntry): SemanticDraft => ({
  summary: entry?.summary ?? "",
  intentsText: formatList(entry?.intents),
  examplesText: formatList(entry?.examples),
  inputNotesText: formatList(entry?.inputNotes),
  outputNotesText: formatList(entry?.outputNotes),
  returnType: entry?.returnType ?? "",
  idField: entry?.idField ?? "",
  detailEndpointKey: entry?.detailEndpointKey ?? "",
  detailParam: entry?.detailParam ?? "",
  detailParamLocation: entry?.detailParamLocation ?? "",
  evidenceFieldsText: formatList(entry?.evidenceFields),
  detailKeysText: formatList(entry?.detailKeys),
  status: entry?.status ?? "draft",
})

const getStatus = (entry?: ApiSemanticEntry): StatusFilter => {
  if (!entry || !entry.summary) return "empty"
  if (entry.status === "verified") return "verified"
  return "draft"
}

const buildModuleName = (path: string) => {
  const parts = path.split("/").filter(Boolean)
  return parts[1] ?? "root"
}

export function SemanticCatalogClient({ sessionUser, canView, canEdit }: SemanticCatalogClientProps) {
  const { locale } = usePreferredLocale()
  const labels = useMemo(
    () => ({
      title: locale === "fr" ? "Catalogue sémantique API" : "API 语义维护",
      description:
        locale === "fr"
          ? "Ajoutez des descriptions courtes et des exemples pour aider l'IA à choisir la bonne API."
          : "为接口补充简短语义与示例，提高 AI 命中率。",
      search: locale === "fr" ? "Rechercher…" : "搜索接口/意图/描述…",
      statusAll: locale === "fr" ? "Tous" : "全部状态",
      statusEmpty: locale === "fr" ? "Vide" : "未填写",
      statusDraft: locale === "fr" ? "Brouillon" : "草稿",
      statusVerified: locale === "fr" ? "已验证" : "已验证",
      filterMethod: locale === "fr" ? "Méthode" : "方法",
      filterModule: locale === "fr" ? "模块" : "模块",
      filterStatus: locale === "fr" ? "状态" : "状态",
      filterAll: locale === "fr" ? "Tous" : "全部",
      filterSelected: locale === "fr" ? (count: number) => `${count} sélectionnés` : (count: number) => `已选 ${count} 项`,
      filterSelectAll: locale === "fr" ? "Tout sélectionner" : "全选",
      filterClear: locale === "fr" ? "清空" : "清空",
      filterSearch: locale === "fr" ? "Rechercher" : "搜索",
      filterNoOptions: locale === "fr" ? "Aucune option" : "暂无选项",
      methodAll: locale === "fr" ? "Toutes méthodes" : "全部方法",
      moduleAll: locale === "fr" ? "Tous modules" : "全部模块",
      aiDraft: locale === "fr" ? "AI 草拟" : "AI 草拟",
      save: locale === "fr" ? "Enregistrer" : "保存",
      verify: locale === "fr" ? "Marquer vérifié" : "标记已验证",
      helper: locale === "fr" ? "Sélectionnez une API pour éditer" : "选择一个接口开始维护",
      details: locale === "fr" ? "Détails API" : "API 详情",
      bulk: locale === "fr" ? "Brouillon en masse" : "批量草拟空白项",
      refresh: locale === "fr" ? "Actualiser" : "刷新",
      notAllowed:
        locale === "fr" ? "Vous n'avez pas accès à cette page." : "你没有权限访问该页面。",
    }),
    [locale],
  )

  const [catalog, setCatalog] = useState<ApiCatalogEntry[]>([])
  const [semantic, setSemantic] = useState<Record<string, ApiSemanticEntry>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<SemanticDraft>(buildDraft())
  const [statusSelected, setStatusSelected] = useState<StatusFilter[]>([])
  const [methodSelected, setMethodSelected] = useState<string[]>([])
  const [moduleSelected, setModuleSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null)
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/ai-chat/semantic-catalog")
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message ?? "Failed to load catalog")
      }
      const payload = (await response.json()) as CatalogPayload
      setCatalog(payload.catalog ?? [])
      setSemantic(payload.semantic?.entries ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canView) return
    loadData()
  }, [canView, loadData])

  useEffect(() => {
    if (!selectedKey) {
      setDraft(buildDraft())
      return
    }
    setDraft(buildDraft(semantic[selectedKey]))
  }, [selectedKey, semantic])

  const mergedRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return catalog
      .map((entry) => {
        const semanticEntry = semantic[entry.key]
        const status = getStatus(semanticEntry)
        return {
          ...entry,
          semantic: semanticEntry,
          status,
          moduleName: buildModuleName(entry.path),
        }
      })
      .filter((row) => {
        if (statusSelected.length > 0 && !statusSelected.includes(row.status)) return false
        if (methodSelected.length > 0 && !methodSelected.includes(row.method)) return false
        if (moduleSelected.length > 0 && !moduleSelected.includes(row.moduleName)) return false
        if (!query) return true
        const inSummary = row.semantic?.summary?.toLowerCase().includes(query)
        const inKey = row.key.toLowerCase().includes(query)
        const inPath = row.path.toLowerCase().includes(query)
        const inIntents = (row.semantic?.intents ?? []).some((intent) =>
          intent.toLowerCase().includes(query),
        )
        return Boolean(inSummary || inKey || inPath || inIntents)
      })
  }, [catalog, semantic, search, statusSelected, methodSelected, moduleSelected])

  const moduleFilterOptions = useMemo<MultiSelectOption[]>(() => {
    const modules = new Set<string>()
    catalog.forEach((entry) => modules.add(buildModuleName(entry.path)))
    return Array.from(modules)
      .sort()
      .map((module) => ({ value: module, label: module }))
  }, [catalog])

  const methodFilterOptions = useMemo<MultiSelectOption[]>(() => {
    const methods = new Set<string>()
    catalog.forEach((entry) => methods.add(entry.method))
    return Array.from(methods)
      .sort()
      .map((method) => ({ value: method, label: method }))
  }, [catalog])

  const statusFilterOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "empty", label: labels.statusEmpty },
      { value: "draft", label: labels.statusDraft },
      { value: "verified", label: labels.statusVerified },
    ],
    [labels.statusDraft, labels.statusEmpty, labels.statusVerified],
  )

  const filterControlProps = useMemo(
    () => ({
      allLabel: labels.filterAll,
      selectedLabel: labels.filterSelected,
      selectAllLabel: labels.filterSelectAll,
      clearLabel: labels.filterClear,
      noOptionsLabel: labels.filterNoOptions,
      searchPlaceholder: labels.filterSearch,
      className: "min-w-[180px] flex-1",
    }),
    [
      labels.filterAll,
      labels.filterClear,
      labels.filterNoOptions,
      labels.filterSearch,
      labels.filterSelectAll,
      labels.filterSelected,
    ],
  )

  const selectedEntry = useMemo(
    () => mergedRows.find((row) => row.key === selectedKey) ?? null,
    [mergedRows, selectedKey],
  )

  const stats = useMemo(() => {
    const total = catalog.length
    const empty = catalog.filter((entry) => getStatus(semantic[entry.key]) === "empty").length
    const verified = catalog.filter((entry) => semantic[entry.key]?.status === "verified").length
    const draftCount = total - empty - verified
    return { total, empty, verified, draft: draftCount }
  }, [catalog, semantic])

  const saveEntry = useCallback(
    async (key: string, payload: Partial<ApiSemanticEntry>) => {
      setSaving(true)
      try {
        const response = await fetch("/api/ai-chat/semantic-catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, entry: payload }),
        })
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => ({}))) as { message?: string }
          throw new Error(errorPayload.message ?? "Failed to save")
        }
        const result = (await response.json()) as { entry: ApiSemanticEntry }
        setSemantic((prev) => ({ ...prev, [key]: result.entry }))
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const requestAiSuggestion = useCallback(
    async (key: string) => {
      setAiLoadingKey(key)
      try {
        const response = await fetch("/api/ai-chat/semantic-catalog/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, locale }),
        })
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => ({}))) as { message?: string }
          throw new Error(errorPayload.message ?? "AI generation failed")
        }
        const result = (await response.json()) as { suggestion: ApiSemanticEntry }
        return result.suggestion
      } finally {
        setAiLoadingKey(null)
      }
    },
    [locale],
  )

  const handleSave = useCallback(async () => {
    if (!selectedKey) return
    if (!canEdit) return
    const payload: Partial<ApiSemanticEntry> = {
      summary: draft.summary.trim() || undefined,
      intents: parseList(draft.intentsText),
      examples: parseList(draft.examplesText),
      inputNotes: parseList(draft.inputNotesText),
      outputNotes: parseList(draft.outputNotesText),
      returnType: draft.returnType.trim() || undefined,
      idField: draft.idField.trim() || undefined,
      detailEndpointKey: draft.detailEndpointKey.trim() || undefined,
      detailParam: draft.detailParam.trim() || undefined,
      detailParamLocation: draft.detailParamLocation.trim() || undefined,
      evidenceFields: parseList(draft.evidenceFieldsText),
      detailKeys: parseList(draft.detailKeysText),
      status: draft.status,
    }
    await saveEntry(selectedKey, payload)
  }, [canEdit, draft, saveEntry, selectedKey])

  const handleAiFill = useCallback(
    async (key: string) => {
      if (!canEdit) return
      try {
        const suggestion = await requestAiSuggestion(key)
        if (!suggestion) return
        if (key === selectedKey) {
          setDraft(buildDraft(suggestion))
        }
        await saveEntry(key, suggestion)
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI generation failed")
      }
    },
    [canEdit, requestAiSuggestion, saveEntry, selectedKey],
  )

  const handleBulkDraft = useCallback(async () => {
    if (!canEdit) return
    const emptyKeys = catalog
      .filter((entry) => getStatus(semantic[entry.key]) === "empty")
      .map((entry) => entry.key)
    if (emptyKeys.length === 0) {
      setBulkStatus(locale === "fr" ? "Aucun endpoint vide." : "没有需要草拟的接口。")
      return
    }
    const confirmed = window.confirm(
      locale === "fr"
        ? `Générer des brouillons pour ${emptyKeys.length} endpoints ?`
        : `将为 ${emptyKeys.length} 个空白接口生成草稿，是否继续？`,
    )
    if (!confirmed) return
    for (const key of emptyKeys) {
      setBulkStatus(
        locale === "fr" ? `Génération: ${key}` : `生成中：${key}`,
      )
      try {
        const suggestion = await requestAiSuggestion(key)
        if (suggestion) {
          await saveEntry(key, suggestion)
        }
      } catch (err) {
        setBulkStatus(
          err instanceof Error ? err.message : locale === "fr" ? "Erreur AI" : "AI 生成失败",
        )
        break
      }
    }
    setBulkStatus(locale === "fr" ? "Terminé." : "批量草拟完成。")
  }, [canEdit, catalog, locale, requestAiSuggestion, saveEntry, semantic])

  if (!sessionUser || !canView) {
    return (
      <AccessDenied
        locale={locale}
        title={locale === "fr" ? "Accès refusé" : "无法访问"}
        description={labels.notAllowed}
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{labels.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{labels.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {labels.refresh}
              </button>
              <button
                type="button"
                onClick={handleBulkDraft}
                disabled={!canEdit}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {labels.bulk}
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Empty</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.empty}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Draft</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.draft}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verified</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.verified}</p>
            </div>
          </div>
          {bulkStatus ? (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              {bulkStatus}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={labels.search}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none md:w-64"
              />
              <MultiSelectFilter
                label={labels.filterMethod}
                options={methodFilterOptions}
                selected={methodSelected}
                onChange={setMethodSelected}
                {...filterControlProps}
              />
              <MultiSelectFilter
                label={labels.filterModule}
                options={moduleFilterOptions}
                selected={moduleSelected}
                onChange={setModuleSelected}
                {...filterControlProps}
              />
              <MultiSelectFilter
                label={labels.filterStatus}
                options={statusFilterOptions}
                selected={statusSelected}
                onChange={(values) =>
                  setStatusSelected(values.filter((value) =>
                    value === "empty" || value === "draft" || value === "verified",
                  ))
                }
                {...filterControlProps}
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">API</th>
                      <th className="px-4 py-3">Summary</th>
                      <th className="px-4 py-3">Intents</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="w-[220px] px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                          Loading...
                        </td>
                      </tr>
                    ) : mergedRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                          No data
                        </td>
                      </tr>
                    ) : (
                      mergedRows.map((row) => {
                        const status = row.status
                        return (
                          <tr
                            key={row.key}
                            onClick={() => setSelectedKey(row.key)}
                            className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 ${
                              row.key === selectedKey ? "bg-emerald-50/60" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  METHOD_STYLES[row.method] ?? "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {row.method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-700">
                              <div className="font-semibold text-slate-900">{row.path}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{row.key}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {row.semantic?.summary ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              <div className="flex flex-wrap gap-1">
                                {(row.semantic?.intents ?? []).slice(0, 3).map((intent) => (
                                  <span
                                    key={`${row.key}-${intent}`}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                                  >
                                    {intent}
                                  </span>
                                ))}
                                {(row.semantic?.intents ?? []).length > 3 ? (
                                  <span className="text-[11px] text-slate-400">+more</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  STATUS_STYLES[status]
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="w-[220px] px-4 py-3 text-right text-xs whitespace-nowrap">
                              <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleAiFill(row.key)
                                  }}
                                  disabled={aiLoadingKey === row.key || !canEdit}
                                  className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {labels.aiDraft}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedKey(row.key)
                                  }}
                                  className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selectedEntry ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                {labels.helper}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        METHOD_STYLES[selectedEntry.method] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {selectedEntry.method}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{selectedEntry.path}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{selectedEntry.key}</div>
                  <div className="text-[11px] text-slate-400">source: {selectedEntry.source}</div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Summary</label>
                  <input
                    value={draft.summary}
                    onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Résumé court" : "一句话用途"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Intents</label>
                  <textarea
                    rows={3}
                    value={draft.intentsText}
                    onChange={(event) => setDraft((prev) => ({ ...prev, intentsText: event.target.value }))}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Une intention par ligne" : "每行一个意图/同义词"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Examples</label>
                  <textarea
                    rows={3}
                    value={draft.examplesText}
                    onChange={(event) => setDraft((prev) => ({ ...prev, examplesText: event.target.value }))}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Exemples d'usage" : "示例问法"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Input Notes</label>
                  <textarea
                    rows={3}
                    value={draft.inputNotesText}
                    onChange={(event) => setDraft((prev) => ({ ...prev, inputNotesText: event.target.value }))}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Paramètres clés" : "关键参数说明"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Output Notes</label>
                  <textarea
                    rows={3}
                    value={draft.outputNotesText}
                    onChange={(event) => setDraft((prev) => ({ ...prev, outputNotesText: event.target.value }))}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Champs clés" : "关键字段解释"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Return Type
                  </label>
                  <select
                    value={draft.returnType}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, returnType: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="">{locale === "fr" ? "Non défini" : "未设置"}</option>
                    <option value="list">list</option>
                    <option value="detail">detail</option>
                    <option value="summary">summary</option>
                    <option value="action">action</option>
                    <option value="export">export</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Detail Endpoint Key
                  </label>
                  <input
                    value={draft.detailEndpointKey}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, detailEndpointKey: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder="get:/api/..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-600">ID Field</label>
                    <input
                      value={draft.idField}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, idField: event.target.value }))
                      }
                      disabled={!canEdit}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                      placeholder={locale === "fr" ? "ex: id/date" : "如 id/date"}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-600">Detail Param</label>
                    <input
                      value={draft.detailParam}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, detailParam: event.target.value }))
                      }
                      disabled={!canEdit}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                      placeholder={locale === "fr" ? "ex: date/id" : "如 date/id"}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Detail Param Location
                  </label>
                  <select
                    value={draft.detailParamLocation}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, detailParamLocation: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="">{locale === "fr" ? "Non défini" : "未设置"}</option>
                    <option value="query">query</option>
                    <option value="path">path</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Evidence Fields
                  </label>
                  <textarea
                    rows={3}
                    value={draft.evidenceFieldsText}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, evidenceFieldsText: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Une clé par ligne" : "每行一个字段名"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Detail Keys
                  </label>
                  <textarea
                    rows={2}
                    value={draft.detailKeysText}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, detailKeysText: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner focus:border-emerald-300 focus:outline-none"
                    placeholder={locale === "fr" ? "Identifiants pour détails" : "用于详情查询的标识字段"}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, status: event.target.value as SemanticStatus }))
                    }
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="draft">{labels.statusDraft}</option>
                    <option value="verified">{labels.statusVerified}</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectedEntry && handleAiFill(selectedEntry.key)}
                    disabled={aiLoadingKey === selectedEntry.key || !canEdit}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {labels.aiDraft}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !canEdit}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {labels.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, status: "verified" }))}
                    disabled={!canEdit}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {labels.verify}
                  </button>
                </div>

                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-semibold text-slate-700">
                    {labels.details}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Permissions</p>
                      <p>{selectedEntry.permissions?.join(", ") || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Query Params</p>
                      <pre className="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                        {JSON.stringify(selectedEntry.queryParams ?? [], null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Body Fields</p>
                      <pre className="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                        {JSON.stringify(selectedEntry.bodyFields ?? [], null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Response</p>
                      <pre className="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                        {JSON.stringify(selectedEntry.responseSchema ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </section>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  )
}
