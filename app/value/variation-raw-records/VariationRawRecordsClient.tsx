'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import {
  getSiteVariationRawRecordStatusLabel,
  SITE_VARIATION_RAW_RECORD_STATUSES,
} from '@/lib/value/siteVariationRawRecords'
import { translateSiteVariationRawTextForDisplay } from '@/lib/value/siteVariationRawRecordDisplay'

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

type ProjectOption = {
  id: number
  name: string
  code: string | null
}

type RoadOption = {
  id: number
  name: string
  slug: string
  projectId: number | null
}

type UserOption = {
  id: number
  name: string
  username: string
}

type RawRecordRow = {
  id: number
  title: string
  rawContent: string
  recordDate: string | null
  projectId: number | null
  projectName: string | null
  projectCode: string | null
  roadSectionId: number | null
  roadSectionName: string | null
  roadSectionSlug: string | null
  status: string
  extractedJson: unknown
  reviewNote: string | null
  convertedVariationId: number | null
  convertedVariation: {
    id: number
    structureName: string | null
    phaseName: string | null
    status: string
  } | null
  creator: UserOption | null
  updater: UserOption | null
  createdAt: string
  updatedAt: string
}

type ResultPayload = {
  items: RawRecordRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: {
    count: number
    linkedCount: number
    byStatus: Array<{ key: string; count: number }>
  }
}

type Props = {
  initialResult: ResultPayload
  projects: ProjectOption[]
  roadSections: RoadOption[]
  canUpdate: boolean
}

type FilterState = {
  search: string
  projectId: string
  roadSectionId: string
  status: string
}

type SortState = {
  field: 'id' | 'recordDate' | 'updatedAt' | 'status' | 'projectName'
  dir: 'asc' | 'desc'
}

type FormState = {
  id: string
  title: string
  rawContent: string
  recordDate: string
  projectId: string
  roadSectionId: string
  status: string
  extractedJson: string
  reviewNote: string
  convertedVariationId: string
}

type BulkState = {
  projectId: string
  roadSectionId: string
  status: string
  bulkText: string
}

const copyByLocale: Record<
  Locale,
  {
    title: string
    description: string
    rawTab: string
    buttons: Record<string, string>
    filters: Record<string, string>
    fields: Record<string, string>
    cards: Record<string, string>
    table: Record<string, string>
    messages: Record<string, string>
    empty: string
    readOnly: string
    bulkHint: string
  }
> = {
  zh: {
    title: '现场变更原始记录',
    description: '先保存未核对的现场口径，再逐条确认并转入正式变更计量台账。',
    rawTab: '原始记录',
    buttons: {
      newRecord: '新增原始记录',
      bulkImport: '批量粘贴',
      search: '查询',
      reset: '重置',
      edit: '编辑',
      void: '作废',
      save: '保存',
      saving: '保存中...',
      close: '关闭',
      import: '导入原始记录',
      importing: '导入中...',
    },
    filters: {
      search: '搜索标题、内容、备注、项目或路段',
      project: '全部项目',
      road: '全部路段',
      status: '全部状态',
    },
    fields: {
      title: '标题',
      rawContent: '原始内容',
      recordDate: '记录日期',
      project: '项目',
      road: '路段',
      status: '状态',
      extractedJson: '提取字段 JSON',
      reviewNote: '核对说明',
      convertedVariationId: '正式变更 ID',
      createdBy: '创建人',
      updatedAt: '更新时间',
    },
    cards: {
      total: '原始记录',
      pending: '待核对',
      linked: '已关联正式变更',
      latest: '最新更新',
    },
    table: {
      sequence: '序号',
      record: '记录',
      scope: '项目/路段',
      content: '原始内容',
      state: '状态',
      action: '操作',
    },
    messages: {
      loadFailed: '加载现场变更原始记录失败',
      saveSuccess: '原始记录已保存',
      importSuccess: '原始记录已导入',
      noUpdatePermission: '当前账号没有产值更新权限',
      jsonInvalid: '提取字段 JSON 格式不正确',
      bulkEmpty: '请先粘贴原始记录',
      bulkTooMany: '单次最多导入 200 条',
      deleteSuccess: '原始记录已作废',
    },
    empty: '还没有符合条件的原始记录。',
    readOnly: '只读模式：需要“产值更新”权限才能新增或编辑。',
    bulkHint: '按空行分隔每条原始记录；系统会自动取第一行做标题，并识别 YYYY-MM-DD 日期。',
  },
  fr: {
    title: 'Notes brutes de variation',
    description: 'Conserver les notes terrain avant vérification puis conversion en variation formelle.',
    rawTab: 'Notes brutes',
    buttons: {
      newRecord: 'Nouvelle note',
      bulkImport: 'Coller en lot',
      search: 'Rechercher',
      reset: 'Réinitialiser',
      edit: 'Modifier',
      void: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      close: 'Fermer',
      import: 'Importer',
      importing: 'Import...',
    },
    filters: {
      search: 'Titre, contenu, note, projet ou voie',
      project: 'Tous les projets',
      road: 'Toutes les voies',
      status: 'Tous les statuts',
    },
    fields: {
      title: 'Titre',
      rawContent: 'Contenu brut',
      recordDate: 'Date',
      project: 'Projet',
      road: 'Voie',
      status: 'Statut',
      extractedJson: 'JSON extrait',
      reviewNote: 'Note de vérification',
      convertedVariationId: 'ID variation',
      createdBy: 'Créé par',
      updatedAt: 'Mis à jour',
    },
    cards: {
      total: 'Notes',
      pending: 'À vérifier',
      linked: 'Liées',
      latest: 'Dernière mise à jour',
    },
    table: {
      sequence: 'N°',
      record: 'Note',
      scope: 'Projet/voie',
      content: 'Contenu',
      state: 'Statut',
      action: 'Action',
    },
    messages: {
      loadFailed: 'Échec du chargement',
      saveSuccess: 'Note enregistrée',
      importSuccess: 'Notes importées',
      noUpdatePermission: 'Permission de mise à jour requise',
      jsonInvalid: 'JSON extrait invalide',
      bulkEmpty: 'Collez d’abord les notes',
      bulkTooMany: 'Maximum 200 notes par import',
      deleteSuccess: 'Note annulée',
    },
    empty: 'Aucune note pour ces critères.',
    readOnly: 'Lecture seule : permission de mise à jour requise.',
    bulkHint: 'Séparez les notes par une ligne vide ; la première ligne devient le titre.',
  },
}

const emptyForm = (projectId = ''): FormState => ({
  id: '',
  title: '',
  rawContent: '',
  recordDate: '',
  projectId,
  roadSectionId: '',
  status: 'PENDING_REVIEW',
  extractedJson: '',
  reviewNote: '',
  convertedVariationId: '',
})

const emptyBulk = (projectId = ''): BulkState => ({
  projectId,
  roadSectionId: '',
  status: 'PENDING_REVIEW',
  bulkText: '',
})

const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '')

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'CONVERTED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'CONFIRMED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'IN_REVIEW':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'DUPLICATE':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case 'VOID':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

const formatDate = (value: string | null, locale: Locale) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const formatDateTime = (value: string, locale: Locale) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const buildFormPayload = (form: FormState) => {
  let extractedJson: unknown = null
  if (form.extractedJson.trim()) {
    extractedJson = JSON.parse(form.extractedJson)
  }
  return {
    id: form.id || undefined,
    title: form.title,
    rawContent: form.rawContent,
    recordDate: form.recordDate || null,
    projectId: form.projectId || null,
    roadSectionId: form.roadSectionId || null,
    status: form.status,
    extractedJson,
    reviewNote: form.reviewNote || null,
    convertedVariationId: form.convertedVariationId || null,
  }
}

const parseBulkBlocks = (bulk: BulkState) =>
  bulk.bulkText
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      const date = block.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
      const title =
        lines[0]?.replace(/^[-*•\d.、\s]+/, '').trim().slice(0, 220) ||
        `原始记录 ${index + 1}`
      return {
        title,
        rawContent: block,
        recordDate: date,
        projectId: bulk.projectId || null,
        roadSectionId: bulk.roadSectionId || null,
        status: bulk.status,
        extractedJson: null,
        reviewNote: null,
        convertedVariationId: null,
      }
    })

export default function VariationRawRecordsClient({
  initialResult,
  projects,
  roadSections,
  canUpdate,
}: Props) {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = copyByLocale[locale]
  const valueCopy = productionValueCopy[locale]
  const [result, setResult] = useState<ResultPayload>(initialResult)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    projectId: '',
    roadSectionId: '',
    status: '',
  })
  const [sort, setSort] = useState<SortState>({ field: 'id', dir: 'asc' })
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [bulk, setBulk] = useState<BulkState>(() => emptyBulk())
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)

  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, localeId) || a.id - b.id),
    [localeId, projects],
  )

  const filterRoadOptions = useMemo(() => {
    const projectId = Number(filters.projectId)
    return roadSections.filter((road) => !projectId || !road.projectId || road.projectId === projectId)
  }, [filters.projectId, roadSections])

  const formRoadOptions = useMemo(() => {
    const projectId = Number(form.projectId)
    return roadSections.filter((road) => !projectId || !road.projectId || road.projectId === projectId)
  }, [form.projectId, roadSections])

  const bulkRoadOptions = useMemo(() => {
    const projectId = Number(bulk.projectId)
    return roadSections.filter((road) => !projectId || !road.projectId || road.projectId === projectId)
  }, [bulk.projectId, roadSections])

  const pendingCount = result.summary.byStatus.find((item) => item.key === 'PENDING_REVIEW')?.count ?? 0
  const linkedCount = result.summary.linkedCount
  const latestUpdate = result.items[0]?.updatedAt ?? null
  const bulkRecords = useMemo(() => parseBulkBlocks(bulk), [bulk])

  const tabs = [
    { key: 'completion', label: valueCopy.tabs.completion, href: '/value' },
    { key: 'comparison', label: valueCopy.tabs.comparison, href: '/value?tab=comparison' },
    { key: 'boq', label: valueCopy.tabs.boq, href: '/value?tab=boq' },
    { key: 'measurement', label: valueCopy.tabs.measurement, href: '/value?tab=measurement' },
    { key: 'variation', label: valueCopy.tabs.variation, href: '/value/variation-measurements' },
    { key: 'raw', label: copy.rawTab, href: '/value/variation-raw-records' },
    { key: 'manage', label: valueCopy.tabs.manage, href: '/value/prices' },
  ].map((tab) => ({ ...tab, active: tab.key === 'raw' }))

  const fetchRows = async (
    page = result.page,
    pageSize = result.pageSize,
    nextFilters = filters,
    nextSort = sort,
  ) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('sortBy', nextSort.field)
    params.set('sortDir', nextSort.dir)
    if (nextFilters.search.trim()) params.set('search', nextFilters.search.trim())
    if (nextFilters.projectId) params.set('projectId', nextFilters.projectId)
    if (nextFilters.roadSectionId) params.set('roadSectionId', nextFilters.roadSectionId)
    if (nextFilters.status) params.set('status', nextFilters.status)

    try {
      const response = await fetch(`/api/value/variation-raw-records?${params.toString()}`, {
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => ({}))) as ResultPayload & { message?: string }
      if (!response.ok) throw new Error(payload.message ?? copy.messages.loadFailed)
      setResult(payload)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'projectId' ? { roadSectionId: '' } : {}),
    }))
  }

  const openCreateModal = () => {
    if (!canUpdate) {
      addToast(copy.messages.noUpdatePermission, { tone: 'danger' })
      return
    }
    setEditingId(null)
    setForm(emptyForm(filters.projectId))
    setModalOpen(true)
  }

  const openEditModal = (row: RawRecordRow) => {
    if (!canUpdate) {
      addToast(copy.messages.noUpdatePermission, { tone: 'danger' })
      return
    }
    setEditingId(row.id)
    setForm({
      id: String(row.id),
      title: row.title,
      rawContent: row.rawContent,
      recordDate: toDateInput(row.recordDate),
      projectId: row.projectId ? String(row.projectId) : '',
      roadSectionId: row.roadSectionId ? String(row.roadSectionId) : '',
      status: row.status,
      extractedJson: row.extractedJson ? JSON.stringify(row.extractedJson, null, 2) : '',
      reviewNote: row.reviewNote ?? '',
      convertedVariationId: row.convertedVariationId ? String(row.convertedVariationId) : '',
    })
    setModalOpen(true)
  }

  const openBulkModal = () => {
    if (!canUpdate) {
      addToast(copy.messages.noUpdatePermission, { tone: 'danger' })
      return
    }
    setBulk(emptyBulk(filters.projectId))
    setBulkOpen(true)
  }

  const handleSave = async () => {
    if (!canUpdate) return
    setSaving(true)
    try {
      let payload: ReturnType<typeof buildFormPayload>
      try {
        payload = buildFormPayload(form)
      } catch {
        throw new Error(copy.messages.jsonInvalid)
      }
      const response = await fetch('/api/value/variation-raw-records', {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? copy.messages.loadFailed)
      setModalOpen(false)
      addToast(copy.messages.saveSuccess, { tone: 'success' })
      await fetchRows(editingId ? result.page : 1)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleBulkImport = async () => {
    if (!canUpdate) return
    if (!bulkRecords.length) {
      addToast(copy.messages.bulkEmpty, { tone: 'warning' })
      return
    }
    if (bulkRecords.length > 200) {
      addToast(copy.messages.bulkTooMany, { tone: 'danger' })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/value/variation-raw-records', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: bulkRecords }),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? copy.messages.loadFailed)
      setBulkOpen(false)
      addToast(`${copy.messages.importSuccess}：${bulkRecords.length}`, { tone: 'success' })
      await fetchRows(1)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleVoid = async (row: RawRecordRow) => {
    if (!canUpdate) return
    setActionId(row.id)
    try {
      const response = await fetch('/api/value/variation-raw-records', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? copy.messages.loadFailed)
      addToast(copy.messages.deleteSuccess, { tone: 'success' })
      await fetchRows(result.page)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setActionId(null)
    }
  }

  const setSortField = (field: SortState['field']) => {
    const next: SortState = {
      field,
      dir: sort.field === field && sort.dir === 'desc' ? 'asc' : 'desc',
    }
    setSort(next)
    void fetchRows(1, result.pageSize, filters, next)
  }

  const headerButton = (label: string, field: SortState['field']) => (
    <button type="button" onClick={() => setSortField(field)} className="inline-flex items-center gap-1">
      {label}
      <span className="text-[10px] text-slate-400">
        {sort.field === field ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  )

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="z-30 py-4"
        breadcrumbs={[
          { label: valueCopy.breadcrumbs.home, href: '/' },
          { label: valueCopy.breadcrumbs.value, href: '/value' },
          { label: copy.title },
        ]}
        title={copy.title}
        subtitle={copy.description}
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
        tabsScrollable
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/value/variation-measurements"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              {valueCopy.tabs.variation}
            </Link>
            <button
              type="button"
              onClick={openBulkModal}
              disabled={!canUpdate}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {copy.buttons.bulkImport}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canUpdate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {copy.buttons.newRecord}
            </button>
          </div>
        }
      />

      <section className="mx-auto w-full max-w-[1760px] px-5 pb-14 pt-6 sm:px-8 xl:px-12">
        {!canUpdate ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {copy.readOnly}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: copy.cards.total, value: result.summary.count },
            { label: copy.cards.pending, value: pendingCount },
            { label: copy.cards.linked, value: linkedCount },
            { label: copy.cards.latest, value: latestUpdate ? formatDateTime(latestUpdate, locale) : '—' },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_minmax(160px,0.7fr)_auto]">
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder={copy.filters.search}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <select
              value={filters.projectId}
              onChange={(event) => updateFilter('projectId', event.target.value)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
            >
              <option value="">{copy.filters.project}</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={filters.roadSectionId}
              onChange={(event) => updateFilter('roadSectionId', event.target.value)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
            >
              <option value="">{copy.filters.road}</option>
              {filterRoadOptions.map((road) => (
                <option key={road.id} value={road.id}>
                  {road.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
            >
              <option value="">{copy.filters.status}</option>
              {SITE_VARIATION_RAW_RECORD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getSiteVariationRawRecordStatusLabel(status, locale)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void fetchRows(1)}
                className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                {copy.buttons.search}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { search: '', projectId: '', roadSectionId: '', status: '' }
                  setFilters(next)
                  void fetchRows(1, result.pageSize, next)
                }}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                {copy.buttons.reset}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>
              {result.total} / {result.pageSize}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={result.pageSize}
                onChange={(event) => void fetchRows(1, Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void fetchRows(Math.max(1, result.page - 1))}
                disabled={result.page <= 1 || loading}
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <span className="min-w-16 text-center font-semibold text-slate-700">
                {result.page}/{result.totalPages}
              </span>
              <button
                type="button"
                onClick={() => void fetchRows(Math.min(result.totalPages, result.page + 1))}
                disabled={result.page >= result.totalPages || loading}
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{headerButton(copy.table.sequence, 'id')}</th>
                  <th className="px-4 py-3">{headerButton(copy.table.record, 'recordDate')}</th>
                  <th className="px-4 py-3">{headerButton(copy.table.scope, 'projectName')}</th>
                  <th className="px-4 py-3">{copy.table.content}</th>
                  <th className="px-4 py-3">{headerButton(copy.table.state, 'status')}</th>
                  <th className="px-4 py-3">{headerButton(copy.fields.updatedAt, 'updatedAt')}</th>
                  <th className="px-4 py-3 text-right">{copy.table.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((row) => (
                  <tr key={row.id} className="align-top transition hover:bg-slate-50">
                    <td className="w-24 px-4 py-4">
                      <span className="inline-flex min-w-12 justify-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-black text-slate-900">
                        #{row.id}
                      </span>
                    </td>
                    <td className="w-64 px-4 py-4">
                      <p className="font-bold text-slate-950">{translateSiteVariationRawTextForDisplay(row.title)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(row.recordDate, locale)}</p>
                      {row.creator ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {copy.fields.createdBy}：{row.creator.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="w-60 px-4 py-4">
                      <p className="font-semibold text-slate-800">{row.projectName ?? '—'}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.roadSectionName ?? row.roadSectionSlug ?? '—'}</p>
                      {row.convertedVariationId ? (
                        <p className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {copy.fields.convertedVariationId}: {row.convertedVariationId}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-xl px-4 py-4">
                      <p className="line-clamp-4 whitespace-pre-wrap text-slate-700">
                        {translateSiteVariationRawTextForDisplay(row.rawContent)}
                      </p>
                      {row.reviewNote ? (
                        <p className="mt-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {row.reviewNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="w-44 px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(row.status)}`}>
                        {getSiteVariationRawRecordStatusLabel(row.status, locale)}
                      </span>
                    </td>
                    <td className="w-40 px-4 py-4 text-xs text-slate-500">
                      {formatDateTime(row.updatedAt, locale)}
                    </td>
                    <td className="w-44 px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          disabled={!canUpdate}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copy.buttons.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleVoid(row)}
                          disabled={!canUpdate || row.status === 'VOID' || actionId === row.id}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copy.buttons.void}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!result.items.length ? (
            <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
              {loading ? 'Loading...' : copy.empty}
            </div>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-black text-slate-950">
                {editingId ? `${copy.buttons.edit} #${editingId}` : copy.buttons.newRecord}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                {copy.buttons.close}
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.title}</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.recordDate}</span>
                  <input
                    type="date"
                    value={form.recordDate}
                    onChange={(event) => setForm((current) => ({ ...current, recordDate: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.status}</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    {SITE_VARIATION_RAW_RECORD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getSiteVariationRawRecordStatusLabel(status, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.project}</span>
                  <select
                    value={form.projectId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, projectId: event.target.value, roadSectionId: '' }))
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">{copy.filters.project}</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.road}</span>
                  <select
                    value={form.roadSectionId}
                    onChange={(event) => setForm((current) => ({ ...current, roadSectionId: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">{copy.filters.road}</option>
                    {formRoadOptions.map((road) => (
                      <option key={road.id} value={road.id}>
                        {road.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.convertedVariationId}</span>
                  <input
                    type="number"
                    min="1"
                    value={form.convertedVariationId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, convertedVariationId: event.target.value }))
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <div className="md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.rawContent}</span>
                  <div className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
                    {translateSiteVariationRawTextForDisplay(form.rawContent)}
                  </div>
                  <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold text-slate-700">查看/编辑原文</summary>
                    <textarea
                      value={form.rawContent}
                      onChange={(event) => setForm((current) => ({ ...current, rawContent: event.target.value }))}
                      rows={8}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </details>
                </div>
                <label className="md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.extractedJson}</span>
                  <textarea
                    value={form.extractedJson}
                    onChange={(event) => setForm((current) => ({ ...current, extractedJson: event.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.reviewNote}</span>
                  <textarea
                    value={form.reviewNote}
                    onChange={(event) => setForm((current) => ({ ...current, reviewNote: event.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {copy.buttons.close}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? copy.buttons.saving : copy.buttons.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">{copy.buttons.bulkImport}</h2>
                <p className="mt-1 text-sm text-slate-500">{copy.bulkHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                {copy.buttons.close}
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.project}</span>
                  <select
                    value={bulk.projectId}
                    onChange={(event) =>
                      setBulk((current) => ({ ...current, projectId: event.target.value, roadSectionId: '' }))
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">{copy.filters.project}</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.road}</span>
                  <select
                    value={bulk.roadSectionId}
                    onChange={(event) => setBulk((current) => ({ ...current, roadSectionId: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="">{copy.filters.road}</option>
                    {bulkRoadOptions.map((road) => (
                      <option key={road.id} value={road.id}>
                        {road.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-slate-700">{copy.fields.status}</span>
                  <select
                    value={bulk.status}
                    onChange={(event) => setBulk((current) => ({ ...current, status: event.target.value }))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    {SITE_VARIATION_RAW_RECORD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getSiteVariationRawRecordStatusLabel(status, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {copy.fields.rawContent} ({bulkRecords.length})
                  </span>
                  <textarea
                    value={bulk.bulkText}
                    onChange={(event) => setBulk((current) => ({ ...current, bulkText: event.target.value }))}
                    rows={14}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {copy.buttons.close}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkImport()}
                disabled={saving || !bulkRecords.length}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? copy.buttons.importing : copy.buttons.import}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
