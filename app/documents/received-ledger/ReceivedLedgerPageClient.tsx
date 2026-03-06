'use client'

import { useCallback, useMemo, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import {
  RECEIVED_DOCUMENT_LEDGER_CATEGORIES,
  RECEIVED_DOCUMENT_LEDGER_FILE_CATEGORY,
  RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
  RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN,
  RECEIVED_DOCUMENT_LEDGER_STATUSES,
  getReceivedDocumentLedgerCategoryLabel,
  getReceivedDocumentLedgerStatusLabel,
  isReceivedDocumentLedgerCategory,
  isReceivedDocumentLedgerStatus,
} from '@/lib/documents/receivedLedger'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import type { ReceivedLedgerListResult, ReceivedLedgerRow } from './types'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

type ProjectOption = {
  id: number
  name: string
  code: string | null
}

type RoadOption = {
  id: number
  name: string
  projectId: number | null
}

type UserOption = {
  id: number
  name: string
  username: string
}

type FilterState = {
  search: string
  category: string
  projectId: string
  roadSectionId: string
  status: string
  attachmentState: 'all' | 'withMain' | 'withoutMain'
}

type SortField =
  | 'id'
  | 'documentName'
  | 'projectName'
  | 'category'
  | 'status'
  | 'receivedAt'
  | 'updatedAt'

type SortDir = 'asc' | 'desc'

type SortState = {
  field: SortField
  dir: SortDir
}

type FormState = {
  category: string
  projectId: string
  roadSectionId: string
  structureName: string
  sizeSpec: string
  versionTag: string
  documentName: string
  documentCode: string
  coverageScope: string
  sourceOrg: string
  receivedAt: string
  receivedById: string
  receivedByText: string
  status: string
  remark: string
}

const copyByLocale: Record<Locale, {
  title: string
  description: string
  newEntry: string
  editEntry: string
  filters: {
    keyword: string
    keywordPlaceholder: string
    category: string
    project: string
    roadSection: string
    status: string
    attachment: string
    apply: string
    reset: string
    all: string
  }
  table: {
    seq: string
    doc: string
    location: string
    receive: string
    pdf: string
    remark: string
    actions: string
    empty: string
  }
  form: {
    category: string
    project: string
    roadSection: string
    structureName: string
    sizeSpec: string
    versionTag: string
    documentName: string
    documentCode: string
    coverageScope: string
    sourceOrg: string
    receivedAt: string
    receivedById: string
    receivedByText: string
    status: string
    remark: string
    cancel: string
    save: string
  }
  actions: {
    upload: string
    open: string
    download: string
    edit: string
    delete: string
  }
  labels: {
    noRoad: string
    noReceiver: string
    noPdf: string
    noRemark: string
    attachmentCount: string
    hasMainPdf: string
    missingMainPdf: string
    missingMainPdfSummary: string
  }
  messages: {
    loadingFailed: string
    saveSuccess: string
    saveFailed: string
    deleteConfirm: string
    deleteSuccess: string
    deleteFailed: string
    uploadFailed: string
    uploadSuccess: string
    openFailed: string
    requiredCategory: string
    requiredProject: string
    requiredName: string
    requiredDate: string
    pdfOnly: string
  }
  pagination: {
    summary: string
    prev: string
    next: string
    pageSize: string
  }
}> = {
  zh: {
    title: '文件收件台账',
    description: '按分类/项目/路段记录已收到技术文件，并可逐行上传对应 PDF。',
    newEntry: '新增记录',
    editEntry: '编辑记录',
    filters: {
      keyword: '关键词',
      keywordPlaceholder: '项目/路段/图纸名称/图号/规格/版本/来源/备注…',
      category: '分类',
      project: '项目',
      roadSection: '路段',
      status: '状态',
      attachment: '附件',
      apply: '应用筛选',
      reset: '重置',
      all: '全部',
    },
    table: {
      seq: '编号',
      doc: '文件信息',
      location: '项目与结构',
      receive: '接收信息',
      pdf: 'PDF',
      remark: '备注',
      actions: '操作',
      empty: '暂无收件台账记录',
    },
    form: {
      category: '分类',
      project: '项目',
      roadSection: '路段',
      structureName: '结构',
      sizeSpec: '尺寸',
      versionTag: '版本',
      documentName: '图纸名称',
      documentCode: '图纸编号',
      coverageScope: '覆盖范围',
      sourceOrg: '来源单位',
      receivedAt: '接收日期',
      receivedById: '接收人',
      receivedByText: '接收人文本',
      status: '状态',
      remark: '备注',
      cancel: '取消',
      save: '保存',
    },
    actions: {
      upload: '上传PDF',
      open: '查看',
      download: '下载',
      edit: '编辑',
      delete: '删除',
    },
    labels: {
      noRoad: '未选择路段',
      noReceiver: '未填写接收人',
      noPdf: '未上传',
      noRemark: '—',
      attachmentCount: '附件数',
      hasMainPdf: '已上传',
      missingMainPdf: '缺附件',
      missingMainPdfSummary: '缺附件 {count} 条',
    },
    messages: {
      loadingFailed: '加载台账失败',
      saveSuccess: '保存成功',
      saveFailed: '保存失败',
      deleteConfirm: '确认删除该条台账？',
      deleteSuccess: '删除成功',
      deleteFailed: '删除失败',
      uploadFailed: '上传失败',
      uploadSuccess: '上传成功',
      openFailed: '打开文件失败',
      requiredCategory: '请选择分类',
      requiredProject: '请选择项目',
      requiredName: '请填写图纸名称',
      requiredDate: '请选择接收日期',
      pdfOnly: '仅支持 PDF 文件',
    },
    pagination: {
      summary: '共 {total} 条 · 第 {page}/{totalPages} 页',
      prev: '上一页',
      next: '下一页',
      pageSize: '每页',
    },
  },
  fr: {
    title: 'Registre de reception des documents',
    description:
      'Enregistrer les documents recus par categorie/projet/section et televerser le PDF ligne par ligne.',
    newEntry: 'Nouvelle ligne',
    editEntry: 'Modifier la ligne',
    filters: {
      keyword: 'Mot-cle',
      keywordPlaceholder: 'Projet/section/document/code/spec/version/source/remarque...',
      category: 'Categorie',
      project: 'Projet',
      roadSection: 'Section',
      status: 'Statut',
      attachment: 'Piece jointe',
      apply: 'Appliquer',
      reset: 'Reinitialiser',
      all: 'Tous',
    },
    table: {
      seq: 'No',
      doc: 'Document',
      location: 'Projet et structure',
      receive: 'Reception',
      pdf: 'PDF',
      remark: 'Remarque',
      actions: 'Actions',
      empty: 'Aucune ligne de registre',
    },
    form: {
      category: 'Categorie',
      project: 'Projet',
      roadSection: 'Section',
      structureName: 'Structure',
      sizeSpec: 'Dimension',
      versionTag: 'Version',
      documentName: 'Nom du document',
      documentCode: 'Code du document',
      coverageScope: 'Portee',
      sourceOrg: 'Source',
      receivedAt: 'Date de reception',
      receivedById: 'Receptionnaire',
      receivedByText: 'Receptionnaire (texte)',
      status: 'Statut',
      remark: 'Remarque',
      cancel: 'Annuler',
      save: 'Enregistrer',
    },
    actions: {
      upload: 'Televerser PDF',
      open: 'Ouvrir',
      download: 'Telecharger',
      edit: 'Modifier',
      delete: 'Supprimer',
    },
    labels: {
      noRoad: 'Sans section',
      noReceiver: 'Receptionnaire vide',
      noPdf: 'Aucun PDF',
      noRemark: '-',
      attachmentCount: 'Pieces',
      hasMainPdf: 'Avec PDF',
      missingMainPdf: 'Sans PDF',
      missingMainPdfSummary: '{count} lignes sans PDF',
    },
    messages: {
      loadingFailed: 'Chargement echoue',
      saveSuccess: 'Enregistre avec succes',
      saveFailed: 'Echec de la sauvegarde',
      deleteConfirm: 'Supprimer cette ligne ?',
      deleteSuccess: 'Supprime avec succes',
      deleteFailed: 'Echec de suppression',
      uploadFailed: 'Televersement echoue',
      uploadSuccess: 'Televersement reussi',
      openFailed: "Echec de l'ouverture",
      requiredCategory: 'Choisir une categorie',
      requiredProject: 'Choisir un projet',
      requiredName: 'Nom du document requis',
      requiredDate: 'Date de reception requise',
      pdfOnly: 'Seul le format PDF est autorise',
    },
    pagination: {
      summary: '{total} lignes · page {page}/{totalPages}',
      prev: 'Precedent',
      next: 'Suivant',
      pageSize: 'Par page',
    },
  },
}

const formatCopy = (template: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  )

const formatDate = (value: string | null | undefined) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

const formatBytes = (size: number) => {
  if (!Number.isFinite(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const frProjectNameByCode: Record<string, string> = {
  'project-bondoukou-city': 'Projet municipal de Bondoukou',
  'project-bondoukou-border': 'Projet frontalier de Bondoukou',
  'project-bondoukou-supply': "Projet d'approvisionnement de Bondoukou",
  'project-tanda-city': 'Projet municipal de Tanda',
  'project-anibilekrou-city': "Projet municipal d'Agnibilekrou",
}

const resolveProjectDisplayName = (
  project: { name: string; code: string | null },
  locale: Locale,
) => {
  if (locale !== 'fr') return project.name
  if (project.code && frProjectNameByCode[project.code]) return frProjectNameByCode[project.code]

  if (project.name.includes('邦杜库')) return 'Projet municipal de Bondoukou'
  if (project.name.includes('丹达')) return 'Projet municipal de Tanda'
  if (project.name.includes('阿尼比莱克鲁')) return "Projet municipal d'Agnibilekrou"
  return project.name
}

const buildEmptyDraft = (): FormState => ({
  category: RECEIVED_DOCUMENT_LEDGER_CATEGORIES[0],
  projectId: '',
  roadSectionId: '',
  structureName: '',
  sizeSpec: '',
  versionTag: '',
  documentName: '',
  documentCode: '',
  coverageScope: '',
  sourceOrg: '',
  receivedAt: '',
  receivedById: '',
  receivedByText: '',
  status: 'RECEIVED',
  remark: '',
})

const toDraft = (row: ReceivedLedgerRow): FormState => ({
  category: row.category,
  projectId: String(row.projectId),
  roadSectionId: row.roadSectionId ? String(row.roadSectionId) : '',
  structureName: row.structureName ?? '',
  sizeSpec: row.sizeSpec ?? '',
  versionTag: row.versionTag ?? '',
  documentName: row.documentName,
  documentCode: row.documentCode ?? '',
  coverageScope: row.coverageScope ?? '',
  sourceOrg: row.sourceOrg ?? '',
  receivedAt: formatDate(row.receivedAt),
  receivedById: row.receivedById ? String(row.receivedById) : '',
  receivedByText: row.receivedByText ?? '',
  status: row.status,
  remark: row.remark ?? '',
})

type Props = {
  initialResult: ReceivedLedgerListResult
  projects: ProjectOption[]
  roadSections: RoadOption[]
  users: UserOption[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export function ReceivedLedgerPageClient({
  initialResult,
  projects,
  roadSections,
  users,
  canCreate,
  canUpdate,
  canDelete,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = copyByLocale[locale]
  const { addToast } = useToast()

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    projectId: '',
    roadSectionId: '',
    status: '',
    attachmentState: 'all',
  })
  const [sortState, setSortState] = useState<SortState>({ field: 'receivedAt', dir: 'desc' })
  const [result, setResult] = useState<ReceivedLedgerListResult>(initialResult)
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<ReceivedLedgerRow | null>(null)
  const [draft, setDraft] = useState<FormState>(buildEmptyDraft())
  const [saving, setSaving] = useState(false)
  const [uploadingRowId, setUploadingRowId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )

  const getProjectLabel = useCallback(
    (project: ProjectOption) => resolveProjectDisplayName(project, locale),
    [locale],
  )

  const filteredRoads = useMemo(() => {
    const projectId = Number(filters.projectId)
    if (!projectId) return roadSections
    return roadSections.filter((road) => road.projectId === projectId)
  }, [filters.projectId, roadSections])

  const draftRoadOptions = useMemo(() => {
    const projectId = Number(draft.projectId)
    if (!projectId) return roadSections
    return roadSections.filter((road) => road.projectId === projectId)
  }, [draft.projectId, roadSections])

  const fetchRows = useCallback(
    async (
      page: number,
      pageSize: number,
      nextFilters: FilterState,
      nextSort: SortState,
      options?: { silent?: boolean },
    ) => {
      if (!options?.silent) {
        setLoading(true)
      }
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', String(pageSize))
        if (nextFilters.search.trim()) params.set('search', nextFilters.search.trim())
        if (nextFilters.category) params.set('category', nextFilters.category)
        if (nextFilters.projectId) params.set('projectId', nextFilters.projectId)
        if (nextFilters.roadSectionId) params.set('roadSectionId', nextFilters.roadSectionId)
        if (nextFilters.status) params.set('status', nextFilters.status)
        if (nextFilters.attachmentState && nextFilters.attachmentState !== 'all') {
          params.set('attachmentState', nextFilters.attachmentState)
        }
        params.set('sortBy', nextSort.field)
        params.set('sortDir', nextSort.dir)

        const response = await fetch(`/api/documents/received-ledger?${params.toString()}`, {
          credentials: 'include',
        })
        const payload = (await response.json().catch(() => ({}))) as
          | ReceivedLedgerListResult
          | { message?: string }
        if (!response.ok) {
          throw new Error((payload as { message?: string }).message ?? copy.messages.loadingFailed)
        }
        setResult(payload as ReceivedLedgerListResult)
      } catch (error) {
        addToast((error as Error).message, { tone: 'danger' })
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [addToast, copy.messages.loadingFailed],
  )

  const handleApplyFilters = () => {
    void fetchRows(1, result.pageSize, filters, sortState)
  }

  const handleResetFilters = () => {
    const empty = {
      search: '',
      category: '',
      projectId: '',
      roadSectionId: '',
      status: '',
      attachmentState: 'all' as const,
    }
    setFilters(empty)
    void fetchRows(1, result.pageSize, empty, sortState)
  }

  const sortIndicator = (field: SortField) => {
    if (sortState.field !== field) return '↕'
    return sortState.dir === 'asc' ? '↑' : '↓'
  }

  const sortAria = (field: SortField): 'none' | 'ascending' | 'descending' => {
    if (sortState.field !== field) return 'none'
    return sortState.dir === 'asc' ? 'ascending' : 'descending'
  }

  const handleSort = (field: SortField) => {
    const nextSort: SortState =
      sortState.field === field
        ? { field, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    setSortState(nextSort)
    void fetchRows(1, result.pageSize, filters, nextSort)
  }

  const openCreateDialog = () => {
    setEditingRow(null)
    setDraft(buildEmptyDraft())
    setDialogOpen(true)
  }

  const openEditDialog = (row: ReceivedLedgerRow) => {
    setEditingRow(row)
    setDraft(toDraft(row))
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (saving) return
    setDialogOpen(false)
  }

  const validateDraft = () => {
    if (!draft.category) {
      addToast(copy.messages.requiredCategory, { tone: 'warning' })
      return false
    }
    if (!draft.projectId) {
      addToast(copy.messages.requiredProject, { tone: 'warning' })
      return false
    }
    if (!draft.documentName.trim()) {
      addToast(copy.messages.requiredName, { tone: 'warning' })
      return false
    }
    if (!draft.receivedAt) {
      addToast(copy.messages.requiredDate, { tone: 'warning' })
      return false
    }
    return true
  }

  const submitDialog = async () => {
    if (!validateDraft()) return

    setSaving(true)
    try {
      const payload = {
        category: draft.category,
        projectId: Number(draft.projectId),
        roadSectionId: draft.roadSectionId ? Number(draft.roadSectionId) : null,
        structureName: draft.structureName.trim() || null,
        sizeSpec: draft.sizeSpec.trim() || null,
        versionTag: draft.versionTag.trim() || null,
        documentName: draft.documentName.trim(),
        documentCode: draft.documentCode.trim() || null,
        coverageScope: draft.coverageScope.trim() || null,
        sourceOrg: draft.sourceOrg.trim() || null,
        receivedAt: draft.receivedAt,
        receivedById: draft.receivedById ? Number(draft.receivedById) : null,
        receivedByText: draft.receivedByText.trim() || null,
        status: draft.status,
        remark: draft.remark.trim() || null,
      }

      const isEdit = Boolean(editingRow)
      const response = await fetch(
        isEdit ? `/api/documents/received-ledger/${editingRow?.id}` : '/api/documents/received-ledger',
        {
          method: isEdit ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(body.message ?? copy.messages.saveFailed)
      }

      addToast(copy.messages.saveSuccess, { tone: 'success' })
      setDialogOpen(false)
      void fetchRows(isEdit ? result.page : 1, result.pageSize, filters, sortState, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: ReceivedLedgerRow) => {
    if (!canDelete) return
    if (!window.confirm(copy.messages.deleteConfirm)) return

    setDeletingId(row.id)
    try {
      const response = await fetch(`/api/documents/received-ledger/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(body.message ?? copy.messages.deleteFailed)
      }
      addToast(copy.messages.deleteSuccess, { tone: 'success' })
      void fetchRows(result.page, result.pageSize, filters, sortState, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDeletingId(null)
    }
  }

  const openMainPdf = async (row: ReceivedLedgerRow) => {
    if (!row.mainPdf) {
      addToast(copy.labels.noPdf, { tone: 'warning' })
      return
    }
    try {
      const response = await fetch(`/api/files/${row.mainPdf.id}?includeUrl=1`, { credentials: 'include' })
      const body = (await response.json().catch(() => ({}))) as {
        file?: { url?: string | null; previewUrl?: string | null }
        message?: string
      }
      const target = body.file?.previewUrl || body.file?.url
      if (!response.ok || !target) {
        throw new Error(body.message ?? copy.messages.openFailed)
      }
      window.open(target, '_blank', 'noopener,noreferrer')
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  const downloadMainPdf = async (row: ReceivedLedgerRow) => {
    if (!row.mainPdf) {
      addToast(copy.labels.noPdf, { tone: 'warning' })
      return
    }
    try {
      const response = await fetch(`/api/files/${row.mainPdf.id}?includeUrl=1`, { credentials: 'include' })
      const body = (await response.json().catch(() => ({}))) as {
        file?: { url?: string | null; previewUrl?: string | null }
        message?: string
      }
      const target = body.file?.url || body.file?.previewUrl
      if (!response.ok || !target) {
        throw new Error(body.message ?? copy.messages.openFailed)
      }
      const link = document.createElement('a')
      link.href = target
      link.download = row.mainPdf.originalName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  const uploadMainPdf = async (row: ReceivedLedgerRow, file: File | null) => {
    if (!file) return
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.pdf') && file.type !== 'application/pdf') {
      addToast(copy.messages.pdfOnly, { tone: 'warning' })
      return
    }

    setUploadingRowId(row.id)
    try {
      const uploadUrlRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/pdf',
          size: file.size,
          category: RECEIVED_DOCUMENT_LEDGER_FILE_CATEGORY,
        }),
      })

      const uploadUrlBody = (await uploadUrlRes.json().catch(() => ({}))) as {
        uploadUrl?: string
        storageKey?: string
        requiredHeaders?: Record<string, string>
        error?: string
        message?: string
      }
      if (!uploadUrlRes.ok || !uploadUrlBody.uploadUrl || !uploadUrlBody.storageKey) {
        throw new Error(uploadUrlBody.error ?? uploadUrlBody.message ?? copy.messages.uploadFailed)
      }

      const putRes = await fetch(uploadUrlBody.uploadUrl, {
        method: 'PUT',
        headers: uploadUrlBody.requiredHeaders,
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(copy.messages.uploadFailed)
      }

      const registerRes = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: uploadUrlBody.storageKey,
          originalName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
          category: RECEIVED_DOCUMENT_LEDGER_FILE_CATEGORY,
          links: [
            {
              entityType: RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE,
              entityId: String(row.id),
              purpose: RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN,
              label: row.documentName,
            },
          ],
        }),
      })
      const registerBody = (await registerRes.json().catch(() => ({}))) as { message?: string }
      if (!registerRes.ok) {
        throw new Error(registerBody.message ?? copy.messages.uploadFailed)
      }

      addToast(copy.messages.uploadSuccess, { tone: 'success' })
      void fetchRows(result.page, result.pageSize, filters, sortState, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setUploadingRowId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{copy.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={openCreateDialog}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5"
            >
              {copy.newEntry}
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <label className="text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-2">
            {copy.filters.keyword}
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void fetchRows(1, result.pageSize, filters, sortState)
                }
              }}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
              placeholder={copy.filters.keywordPlaceholder}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.filters.category}
            <select
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
            >
              <option value="">{copy.filters.all}</option>
              {RECEIVED_DOCUMENT_LEDGER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {getReceivedDocumentLedgerCategoryLabel(locale, category)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.filters.project}
            <select
              value={filters.projectId}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  projectId: event.target.value,
                  roadSectionId: '',
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
            >
              <option value="">{copy.filters.all}</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.filters.roadSection}
            <select
              value={filters.roadSectionId}
              onChange={(event) => setFilters((prev) => ({ ...prev, roadSectionId: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
            >
              <option value="">{copy.filters.all}</option>
              {filteredRoads.map((road) => (
                <option key={road.id} value={String(road.id)}>
                  {road.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.filters.status}
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
            >
              <option value="">{copy.filters.all}</option>
              {RECEIVED_DOCUMENT_LEDGER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getReceivedDocumentLedgerStatusLabel(locale, status)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.filters.attachment}
            <select
              value={filters.attachmentState}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  attachmentState: event.target.value as FilterState['attachmentState'],
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
            >
              <option value="all">{copy.filters.all}</option>
              <option value="withMain">{copy.labels.hasMainPdf}</option>
              <option value="withoutMain">{copy.labels.missingMainPdf}</option>
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-7 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
            <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
              {formatCopy(copy.labels.missingMainPdfSummary, {
                count: result.summary.missingMainPdfCount,
              })}
            </span>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                disabled={loading}
              >
                {copy.filters.apply}
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                disabled={loading}
              >
                {copy.filters.reset}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100/80">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="w-14 px-3 py-3" aria-sort={sortAria('id')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => handleSort('id')}
                  >
                    <span>{copy.table.seq}</span>
                    <span>{sortIndicator('id')}</span>
                  </button>
                </th>
                <th className="px-3 py-3" aria-sort={sortAria('documentName')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => handleSort('documentName')}
                  >
                    <span>{copy.table.doc}</span>
                    <span>{sortIndicator('documentName')}</span>
                  </button>
                </th>
                <th className="px-3 py-3" aria-sort={sortAria('projectName')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => handleSort('projectName')}
                  >
                    <span>{copy.table.location}</span>
                    <span>{sortIndicator('projectName')}</span>
                  </button>
                </th>
                <th className="px-3 py-3" aria-sort={sortAria('receivedAt')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => handleSort('receivedAt')}
                  >
                    <span>{copy.table.receive}</span>
                    <span>{sortIndicator('receivedAt')}</span>
                  </button>
                </th>
                <th className="px-3 py-3">{copy.table.pdf}</th>
                <th className="px-3 py-3" aria-sort={sortAria('updatedAt')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <span>{copy.table.remark}</span>
                    <span>{sortIndicator('updatedAt')}</span>
                  </button>
                </th>
                <th className="w-40 px-3 py-3">{copy.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {result.items.length ? (
                result.items.map((row, index) => {
                  const seq = (result.page - 1) * result.pageSize + index + 1
                  const categoryLabel = isReceivedDocumentLedgerCategory(row.category)
                    ? getReceivedDocumentLedgerCategoryLabel(locale, row.category)
                    : row.category
                  const statusLabel = isReceivedDocumentLedgerStatus(row.status)
                    ? getReceivedDocumentLedgerStatusLabel(locale, row.status)
                    : row.status

                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-3 text-xs font-semibold text-slate-700">{seq}</td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">{row.documentName}</div>
                          <div>{row.documentCode || '-'}</div>
                          <div className="text-[11px] text-slate-500">
                            {categoryLabel}
                            {row.versionTag ? ` · ${row.versionTag}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                          <div className="space-y-1">
                          <div className="font-semibold">
                            {(() => {
                              const project = projectsById.get(row.projectId)
                              if (project) return getProjectLabel(project)
                              return row.projectName
                            })()}
                          </div>
                          <div>{row.roadSectionName || copy.labels.noRoad}</div>
                          <div>
                            {[row.structureName, row.sizeSpec].filter(Boolean).join(' / ') || '-'}
                          </div>
                          {row.coverageScope ? <div>{row.coverageScope}</div> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <div className="space-y-1">
                          <div>{formatDate(row.receivedAt) || '-'}</div>
                          <div>{row.receivedByName || row.receivedByText || copy.labels.noReceiver}</div>
                          <div className="font-semibold text-slate-900">{statusLabel}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <div className="space-y-2">
                          <div
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.mainPdf
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {row.mainPdf ? copy.labels.hasMainPdf : copy.labels.missingMainPdf}
                          </div>
                          <div className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]">
                            {row.mainPdf ? (
                              <>
                                <div className="truncate font-semibold">{row.mainPdf.originalName}</div>
                                <div className="text-slate-500">{formatBytes(row.mainPdf.size)}</div>
                              </>
                            ) : (
                              <div className="text-slate-400">{copy.labels.noPdf}</div>
                            )}
                          </div>
                          {row.mainPdf ? (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => void openMainPdf(row)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-200"
                              >
                                {copy.actions.open}
                              </button>
                              <button
                                type="button"
                                onClick={() => void downloadMainPdf(row)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-200"
                              >
                                {copy.actions.download}
                              </button>
                            </div>
                          ) : null}
                          <div className="text-[11px] text-slate-500">
                            {copy.labels.attachmentCount}: {row.attachmentCount}
                          </div>
                          {canUpdate ? (
                            <label className="inline-flex cursor-pointer rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                              {uploadingRowId === row.id ? '...' : copy.actions.upload}
                              <input
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                disabled={uploadingRowId === row.id}
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null
                                  void uploadMainPdf(row, file)
                                  event.target.value = ''
                                }}
                              />
                            </label>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.remark || copy.labels.noRemark}</td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex flex-wrap gap-2">
                          {canUpdate ? (
                            <button
                              type="button"
                              onClick={() => openEditDialog(row)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              {copy.actions.edit}
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={deletingId === row.id}
                              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 disabled:opacity-60"
                            >
                              {copy.actions.delete}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    {copy.table.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            {formatCopy(copy.pagination.summary, {
              total: result.total,
              page: result.page,
              totalPages: result.totalPages,
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              {copy.pagination.pageSize}
              <select
                value={String(result.pageSize)}
                onChange={(event) => {
                  const nextSize = Number(event.target.value)
                  void fetchRows(1, nextSize, filters, sortState)
                }}
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                void fetchRows(Math.max(1, result.page - 1), result.pageSize, filters, sortState)
              }
              disabled={result.page <= 1 || loading}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-40"
            >
              {copy.pagination.prev}
            </button>
            <button
              type="button"
              onClick={() =>
                void fetchRows(
                  Math.min(result.totalPages, result.page + 1),
                  result.pageSize,
                  filters,
                  sortState,
                )
              }
              disabled={result.page >= result.totalPages || loading}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-40"
            >
              {copy.pagination.next}
            </button>
          </div>
        </div>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingRow ? copy.editEntry : copy.newEntry}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="close"
              >
                ×
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.category}
                  <select
                    value={draft.category}
                    onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {RECEIVED_DOCUMENT_LEDGER_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {getReceivedDocumentLedgerCategoryLabel(locale, category)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.status}
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {RECEIVED_DOCUMENT_LEDGER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getReceivedDocumentLedgerStatusLabel(locale, status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.project}
                  <select
                    value={draft.projectId}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        projectId: event.target.value,
                        roadSectionId: '',
                      }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    <option value="">{copy.filters.all}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {getProjectLabel(project)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.roadSection}
                  <select
                    value={draft.roadSectionId}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, roadSectionId: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    <option value="">{copy.filters.all}</option>
                    {draftRoadOptions.map((road) => (
                      <option key={road.id} value={String(road.id)}>
                        {road.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  {copy.form.documentName}
                  <input
                    value={draft.documentName}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, documentName: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.documentCode}
                  <input
                    value={draft.documentCode}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, documentCode: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.versionTag}
                  <input
                    value={draft.versionTag}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, versionTag: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.structureName}
                  <input
                    value={draft.structureName}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, structureName: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.sizeSpec}
                  <input
                    value={draft.sizeSpec}
                    onChange={(event) => setDraft((prev) => ({ ...prev, sizeSpec: event.target.value }))}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.receivedAt}
                  <input
                    type="date"
                    value={draft.receivedAt}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, receivedAt: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  {copy.form.receivedById}
                  <select
                    value={draft.receivedById}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, receivedById: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    <option value="">{copy.filters.all}</option>
                    {users.map((user) => (
                      <option key={user.id} value={String(user.id)}>
                        {user.name || user.username}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  {copy.form.receivedByText}
                  <input
                    value={draft.receivedByText}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, receivedByText: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  {copy.form.coverageScope}
                  <input
                    value={draft.coverageScope}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, coverageScope: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  {copy.form.sourceOrg}
                  <input
                    value={draft.sourceOrg}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, sourceOrg: event.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  {copy.form.remark}
                  <textarea
                    value={draft.remark}
                    onChange={(event) => setDraft((prev) => ({ ...prev, remark: event.target.value }))}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
                disabled={saving}
              >
                {copy.form.cancel}
              </button>
              <button
                type="button"
                onClick={() => void submitDialog()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? '...' : copy.form.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
