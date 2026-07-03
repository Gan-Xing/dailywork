'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import {
  getSiteVariationMeasurementReasonLabel,
  getSiteVariationMeasurementStatusLabel,
  getSiteVariationMeasurementTypeLabel,
  SITE_VARIATION_MEASUREMENT_FILE_CATEGORY,
  SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE,
  SITE_VARIATION_MEASUREMENT_FILE_PURPOSE_EVIDENCE,
  SITE_VARIATION_MEASUREMENT_REASONS,
  SITE_VARIATION_MEASUREMENT_STATUSES,
  SITE_VARIATION_MEASUREMENT_TYPES,
} from '@/lib/value/siteVariationMeasurements'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

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

type BoqItemOption = {
  id: number
  projectId: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: number | null
}

type Attachment = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

type VariationRow = {
  id: number
  projectId: number
  projectName: string
  projectCode: string | null
  roadSectionId: number | null
  roadSectionName: string | null
  mainRoadSectionId: number | null
  mainRoadSectionName: string | null
  boqItemId: number | null
  boqItem: {
    id: number
    code: string
    designationZh: string
    designationFr: string
    unit: string | null
    unitPrice: number | null
  } | null
  measurementDetailId: number | null
  measurementDetail: { id: number; period: string; quantity: number; manualAmount: number | null } | null
  status: string
  changeType: string
  reason: string | null
  structureName: string | null
  phaseName: string | null
  spec: string | null
  unit: string | null
  startPk: string | null
  endPk: string | null
  side: 'BOTH' | 'LEFT' | 'RIGHT' | null
  designDescription: string | null
  fieldDescription: string | null
  differenceDescription: string | null
  designQuantity: number | null
  actualQuantity: number | null
  deltaQuantity: number | null
  proposedQuantity: number | null
  unitPrice: number | null
  estimatedAmount: number | null
  occurredAt: string | null
  discoveredByText: string | null
  measurementPeriod: string | null
  measuredAt: string | null
  attachmentComplete: boolean
  remark: string | null
  attachments: Attachment[]
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

type SummaryGroup = {
  key: string
  label: string
  count: number
  measuredCount: number
  unmeasuredCount: number
  measuredAmount: number
  unmeasuredAmount: number
  missingAttachmentCount: number
}

type SummaryTotals = Omit<SummaryGroup, 'key' | 'label'>

type ResultPayload = {
  items: VariationRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: SummaryTotals & {
    byProject: SummaryGroup[]
    byRoad: SummaryGroup[]
    byPhase: SummaryGroup[]
    byStatus: SummaryGroup[]
  }
}

type FilterState = {
  search: string
  projectId: string
  roadSectionId: string
  status: string
  changeType: string
  attachmentState: 'all' | 'withFiles' | 'withoutFiles'
}

type SortState = {
  field: 'id' | 'occurredAt' | 'updatedAt' | 'status' | 'projectName' | 'estimatedAmount'
  dir: 'asc' | 'desc'
}

type FormState = {
  id: string
  projectId: string
  roadSectionId: string
  mainRoadSectionId: string
  boqItemId: string
  status: string
  changeType: string
  reason: string
  structureName: string
  phaseName: string
  spec: string
  unit: string
  startPk: string
  endPk: string
  side: string
  designDescription: string
  fieldDescription: string
  differenceDescription: string
  designQuantity: string
  actualQuantity: string
  deltaQuantity: string
  proposedQuantity: string
  unitPrice: string
  estimatedAmount: string
  occurredAt: string
  discoveredByText: string
  measurementPeriod: string
  measuredAt: string
  attachmentComplete: boolean
  remark: string
}

type Props = {
  initialResult: ResultPayload
  projects: ProjectOption[]
  roadSections: RoadOption[]
  boqItems: BoqItemOption[]
  canUpdate: boolean
  canUpload: boolean
}

const copyByLocale: Record<Locale, {
  title: string
  description: string
  newRecord: string
  editRecord: string
  openMeasurementLedger: string
  readOnly: {
    title: string
    description: string
    updateRequired: string
  }
  sections: {
    basic: string
    location: string
    quantities: string
    notes: string
  }
  hints: {
    provisionalBoq: string
    amountPreview: string
    formulaVisible: string
    measurementBlocked: string
  }
  filters: {
    keyword: string
    keywordPlaceholder: string
    project: string
    road: string
    status: string
    type: string
    attachment: string
    all: string
    apply: string
    reset: string
    withFiles: string
    withoutFiles: string
  }
  cards: {
    total: string
    unmeasuredAmount: string
    measuredAmount: string
    missingAttachment: string
  }
  table: {
    seq: string
    source: string
    location: string
    boq: string
    quantities: string
    amount: string
    status: string
    files: string
    updatedAt: string
    actions: string
    empty: string
  }
  form: Record<string, string>
  actions: Record<string, string>
  messages: Record<string, string>
}> = {
  zh: {
    title: '现场变更计量台账',
    description: '记录图纸与现场不一致的变更工程量，跟踪附件、状态，并关联正式计量明细。',
    newRecord: '新增变更',
    editRecord: '编辑变更',
    openMeasurementLedger: '正式计量台账',
    readOnly: {
      title: '当前为只读模式',
      description: '你可以查看、筛选和打开附件；新增、编辑、生成计量需要“产值更新”权限。',
      updateRequired: '缺少 value:update 权限',
    },
    sections: {
      basic: '基础信息',
      location: '位置与规格',
      quantities: '工程量与金额',
      notes: '说明、公式与附件状态',
    },
    hints: {
      provisionalBoq: '新分项/待确认单价',
      amountPreview: '按拟计量数量 × 单价预估',
      formulaVisible: '公式/备注已在列表中展示，编辑时可直接维护。',
      measurementBlocked: '生成计量前需补齐清单、路段、计量期次和数量。',
    },
    filters: {
      keyword: '关键词',
      keywordPlaceholder: '项目、路段、分项、规格、桩号、说明…',
      project: '项目',
      road: '路段',
      status: '状态',
      type: '类型',
      attachment: '附件',
      all: '全部',
      apply: '应用筛选',
      reset: '重置',
      withFiles: '有附件',
      withoutFiles: '缺附件',
    },
    cards: {
      total: '台账数',
      unmeasuredAmount: '未计量金额',
      measuredAmount: '已计量金额',
      missingAttachment: '缺附件',
    },
    table: {
      seq: '编号',
      source: '变更来源',
      location: '位置',
      boq: '清单',
      quantities: '数量',
      amount: '金额',
      status: '状态',
      files: '附件',
      updatedAt: '更新时间',
      actions: '操作',
      empty: '暂无现场变更计量记录',
    },
    form: {
      project: '项目',
      road: '路段',
      mainRoad: '主路段',
      boq: '清单条目',
      status: '状态',
      type: '变更类型',
      reason: '原因',
      structureName: '结构/位置',
      phaseName: '分项',
      spec: '规格',
      unit: '单位',
      side: '侧别',
      startPk: '起点桩号',
      endPk: '终点桩号',
      designQuantity: '图纸数量',
      actualQuantity: '现场数量',
      deltaQuantity: '差异数量',
      proposedQuantity: '拟计量数量',
      unitPrice: '单价',
      estimatedAmount: '预计金额',
      occurredAt: '发生/确认日期',
      measurementPeriod: '计量期次',
      measuredAt: '已计量日期',
      discoveredByText: '发现/记录人',
      attachmentComplete: '附件已齐',
      designDescription: '图纸描述',
      fieldDescription: '现场描述',
      differenceDescription: '差异说明',
      remark: '备注',
      cancel: '取消',
      save: '保存',
    },
    actions: {
      edit: '编辑',
      void: '作废',
      ready: '待计量',
      archive: '归档',
      generateMeasurement: '生成计量',
      upload: '上传附件',
      open: '查看',
      prev: '上一页',
      next: '下一页',
    },
    messages: {
      loadFailed: '加载现场变更计量台账失败',
      saveSuccess: '已保存现场变更计量记录',
      saveFailed: '保存失败',
      statusSuccess: '状态已更新',
      uploadSuccess: '附件已上传',
      uploadFailed: '附件上传失败',
      openFailed: '附件打开失败',
      measurementSuccess: '已生成正式计量明细',
      measurementFailed: '生成正式计量失败',
      confirmVoid: '确认作废这条现场变更计量记录？',
      noUpdatePermission: '当前账号没有产值更新权限，不能新增或编辑。',
    },
  },
  fr: {
    title: 'Registre des variations terrain',
    description:
      'Suivi des quantités modifiées entre plans et terrain, avec pièces jointes, statut et lien vers les métrés formels.',
    newRecord: 'Nouvelle variation',
    editRecord: 'Modifier la variation',
    openMeasurementLedger: 'Registre des métrés',
    readOnly: {
      title: 'Mode lecture seule',
      description:
        'Vous pouvez consulter, filtrer et ouvrir les pièces. La création, modification et génération de métré nécessitent le droit value:update.',
      updateRequired: 'Droit value:update requis',
    },
    sections: {
      basic: 'Informations',
      location: 'Localisation et spécification',
      quantities: 'Quantités et montant',
      notes: 'Descriptions, formule et pièces',
    },
    hints: {
      provisionalBoq: 'Nouveau poste / prix à confirmer',
      amountPreview: 'Estimation quantité à métrer × prix unitaire',
      formulaVisible: 'La formule/remarque est visible dans la liste et modifiable ici.',
      measurementBlocked: 'Compléter poste DQE, tronçon, période et quantité avant de créer le métré.',
    },
    filters: {
      keyword: 'Recherche',
      keywordPlaceholder: 'Projet, tronçon, poste, spécification, PK, description…',
      project: 'Projet',
      road: 'Tronçon',
      status: 'Statut',
      type: 'Type',
      attachment: 'Pièces',
      all: 'Tout',
      apply: 'Filtrer',
      reset: 'Réinitialiser',
      withFiles: 'Avec pièces',
      withoutFiles: 'Sans pièces',
    },
    cards: {
      total: 'Lignes',
      unmeasuredAmount: 'Montant non métré',
      measuredAmount: 'Montant métré',
      missingAttachment: 'Sans pièces',
    },
    table: {
      seq: 'N°',
      source: 'Variation',
      location: 'Localisation',
      boq: 'DQE',
      quantities: 'Quantités',
      amount: 'Montant',
      status: 'Statut',
      files: 'Pièces',
      updatedAt: 'Mise à jour',
      actions: 'Actions',
      empty: 'Aucune variation terrain',
    },
    form: {
      project: 'Projet',
      road: 'Tronçon',
      mainRoad: 'Tronçon principal',
      boq: 'Poste DQE',
      status: 'Statut',
      type: 'Type de variation',
      reason: 'Motif',
      structureName: 'Ouvrage / position',
      phaseName: 'Lot',
      spec: 'Spécification',
      unit: 'Unité',
      side: 'Côté',
      startPk: 'PK début',
      endPk: 'PK fin',
      designQuantity: 'Quantité plan',
      actualQuantity: 'Quantité terrain',
      deltaQuantity: 'Écart',
      proposedQuantity: 'Quantité à métrer',
      unitPrice: 'Prix unitaire',
      estimatedAmount: 'Montant estimé',
      occurredAt: 'Date constatée',
      measurementPeriod: 'Période de métré',
      measuredAt: 'Date métrée',
      discoveredByText: 'Constaté par',
      attachmentComplete: 'Pièces complètes',
      designDescription: 'Description plan',
      fieldDescription: 'Description terrain',
      differenceDescription: 'Justification de l’écart',
      remark: 'Remarque',
      cancel: 'Annuler',
      save: 'Enregistrer',
    },
    actions: {
      edit: 'Modifier',
      void: 'Annuler',
      ready: 'À métrer',
      archive: 'Archiver',
      generateMeasurement: 'Créer métré',
      upload: 'Joindre',
      open: 'Voir',
      prev: 'Précédent',
      next: 'Suivant',
    },
    messages: {
      loadFailed: 'Impossible de charger le registre',
      saveSuccess: 'Variation enregistrée',
      saveFailed: 'Échec de l’enregistrement',
      statusSuccess: 'Statut mis à jour',
      uploadSuccess: 'Pièce jointe téléversée',
      uploadFailed: 'Échec du téléversement',
      openFailed: 'Impossible d’ouvrir la pièce',
      measurementSuccess: 'Métré formel créé',
      measurementFailed: 'Échec de création du métré',
      confirmVoid: 'Annuler cette variation ?',
      noUpdatePermission: 'Le compte courant ne dispose pas du droit de mise à jour de la valeur.',
    },
  },
}

const emptyForm = (projectId = ''): FormState => ({
  id: '',
  projectId,
  roadSectionId: '',
  mainRoadSectionId: '',
  boqItemId: '',
  status: 'PENDING_CONFIRMATION',
  changeType: 'OTHER',
  reason: '',
  structureName: '',
  phaseName: '',
  spec: '',
  unit: '',
  startPk: '',
  endPk: '',
  side: '',
  designDescription: '',
  fieldDescription: '',
  differenceDescription: '',
  designQuantity: '',
  actualQuantity: '',
  deltaQuantity: '',
  proposedQuantity: '',
  unitPrice: '',
  estimatedAmount: '',
  occurredAt: '',
  discoveredByText: '',
  measurementPeriod: '',
  measuredAt: '',
  attachmentComplete: false,
  remark: '',
})

const dateInputValue = (value: string | null) => (value ? value.slice(0, 10) : '')
const monthInputValue = (value: string | null) => (value ? value.slice(0, 7) : '')
const numberInputValue = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

const rowToForm = (row: VariationRow): FormState => ({
  id: String(row.id),
  projectId: String(row.projectId),
  roadSectionId: row.roadSectionId ? String(row.roadSectionId) : '',
  mainRoadSectionId: row.mainRoadSectionId ? String(row.mainRoadSectionId) : '',
  boqItemId: row.boqItemId ? String(row.boqItemId) : '',
  status: row.status,
  changeType: row.changeType,
  reason: row.reason ?? '',
  structureName: row.structureName ?? '',
  phaseName: row.phaseName ?? '',
  spec: row.spec ?? '',
  unit: row.unit ?? row.boqItem?.unit ?? '',
  startPk: row.startPk ?? '',
  endPk: row.endPk ?? '',
  side: row.side ?? '',
  designDescription: row.designDescription ?? '',
  fieldDescription: row.fieldDescription ?? '',
  differenceDescription: row.differenceDescription ?? '',
  designQuantity: numberInputValue(row.designQuantity),
  actualQuantity: numberInputValue(row.actualQuantity),
  deltaQuantity: numberInputValue(row.deltaQuantity),
  proposedQuantity: numberInputValue(row.proposedQuantity),
  unitPrice: numberInputValue(row.unitPrice ?? row.boqItem?.unitPrice),
  estimatedAmount: numberInputValue(row.estimatedAmount),
  occurredAt: dateInputValue(row.occurredAt),
  discoveredByText: row.discoveredByText ?? '',
  measurementPeriod: monthInputValue(row.measurementPeriod),
  measuredAt: dateInputValue(row.measuredAt),
  attachmentComplete: row.attachmentComplete,
  remark: row.remark ?? '',
})

const formatMoney = (value: number | null | undefined, locale: Locale) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
        maximumFractionDigits: 0,
      }).format(value)

const formatQuantity = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)

const formatDate = (value: string | null | undefined, locale: Locale) =>
  value
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value))
    : '—'

const sideLabel = (side: string | null | undefined, locale: Locale) => {
  if (!side) return '—'
  if (locale === 'fr') {
    return side === 'LEFT' ? 'Gauche' : side === 'RIGHT' ? 'Droite' : 'Deux côtés'
  }
  return side === 'LEFT' ? '左侧' : side === 'RIGHT' ? '右侧' : '双侧'
}

const parseFormNumber = (value: string) => {
  const normalized = value.trim().replace(/,/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'READY_TO_MEASURE':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'MEASURED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'ARCHIVED':
      return 'border-slate-200 bg-slate-100 text-slate-700'
    case 'VOID':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

const hasPositiveQuantity = (row: VariationRow) =>
  (row.proposedQuantity ?? row.actualQuantity ?? row.deltaQuantity ?? 0) > 0

export default function VariationMeasurementsClient({
  initialResult,
  projects,
  roadSections,
  boqItems,
  canUpdate,
  canUpload,
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
    changeType: '',
    attachmentState: 'all',
  })
  const [sort, setSort] = useState<SortState>({ field: 'occurredAt', dir: 'desc' })
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(projects[0] ? String(projects[0].id) : ''))
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)

  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  const computedAmountPreview = useMemo(() => {
    const explicit = parseFormNumber(form.estimatedAmount)
    if (explicit !== null) return explicit
    const quantity = parseFormNumber(form.proposedQuantity)
    const unitPrice = parseFormNumber(form.unitPrice)
    return quantity !== null && unitPrice !== null ? quantity * unitPrice : null
  }, [form.estimatedAmount, form.proposedQuantity, form.unitPrice])

  const tabs = [
    { key: 'completion', label: valueCopy.tabs.completion, href: '/value' },
    { key: 'comparison', label: valueCopy.tabs.comparison, href: '/value?tab=comparison' },
    { key: 'boq', label: valueCopy.tabs.boq, href: '/value?tab=boq' },
    { key: 'measurement', label: valueCopy.tabs.measurement, href: '/value?tab=measurement' },
    { key: 'variation', label: valueCopy.tabs.variation, href: '/value/variation-measurements' },
    { key: 'manage', label: valueCopy.tabs.manage, href: '/value/prices' },
  ].map((tab) => ({ ...tab, active: tab.key === 'variation' }))

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, localeId) || a.id - b.id),
    [localeId, projects],
  )

  const filteredRoads = useMemo(() => {
    const projectId = Number(form.projectId)
    return roadSections.filter((road) => !projectId || !road.projectId || road.projectId === projectId)
  }, [form.projectId, roadSections])

  const filteredBoqItems = useMemo(() => {
    const projectId = Number(form.projectId)
    return boqItems.filter((item) => !projectId || item.projectId === projectId)
  }, [boqItems, form.projectId])

  const filterRoadOptions = useMemo(() => {
    const projectId = Number(filters.projectId)
    return roadSections.filter((road) => !projectId || !road.projectId || road.projectId === projectId)
  }, [filters.projectId, roadSections])

  const fetchRows = useCallback(
    async (
      page = result.page,
      pageSize = result.pageSize,
      nextFilters = filters,
      nextSort = sort,
      options?: { silent?: boolean },
    ) => {
      if (!options?.silent) setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sortBy', nextSort.field)
      params.set('sortDir', nextSort.dir)
      if (nextFilters.search.trim()) params.set('search', nextFilters.search.trim())
      if (nextFilters.projectId) params.set('projectId', nextFilters.projectId)
      if (nextFilters.roadSectionId) params.set('roadSectionId', nextFilters.roadSectionId)
      if (nextFilters.status) params.set('status', nextFilters.status)
      if (nextFilters.changeType) params.set('changeType', nextFilters.changeType)
      if (nextFilters.attachmentState !== 'all') params.set('attachmentState', nextFilters.attachmentState)

      try {
        const response = await fetch(`/api/value/variation-measurements?${params.toString()}`, {
          credentials: 'include',
        })
        const payload = (await response.json().catch(() => ({}))) as ResultPayload & { message?: string }
        if (!response.ok) throw new Error(payload.message ?? copy.messages.loadFailed)
        setResult(payload)
      } catch (error) {
        addToast((error as Error).message, { tone: 'danger' })
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [addToast, copy.messages.loadFailed, filters, result.page, result.pageSize, sort],
  )

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
    const projectId = filters.projectId || (projects[0] ? String(projects[0].id) : '')
    setEditingId(null)
    setForm(emptyForm(projectId))
    setModalOpen(true)
  }

  const openEditModal = (row: VariationRow) => {
    if (!canUpdate) {
      addToast(copy.messages.noUpdatePermission, { tone: 'danger' })
      return
    }
    setEditingId(row.id)
    setForm(rowToForm(row))
    setModalOpen(true)
  }

  const updateForm = (key: keyof FormState, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'projectId') {
        next.roadSectionId = ''
        next.mainRoadSectionId = ''
        next.boqItemId = ''
        next.unit = ''
        next.unitPrice = ''
      }
      return next
    })
  }

  const handleBoqChange = (value: string) => {
    const selected = boqItems.find((item) => String(item.id) === value)
    setForm((current) => ({
      ...current,
      boqItemId: value,
      unit: selected?.unit ?? current.unit,
      unitPrice: selected?.unitPrice === null || selected?.unitPrice === undefined ? current.unitPrice : String(selected.unitPrice),
    }))
  }

  const submitForm = async () => {
    if (!canUpdate) {
      addToast(copy.messages.noUpdatePermission, { tone: 'danger' })
      return
    }
    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch('/api/value/variation-measurements', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: editingId ?? undefined,
          attachmentComplete: form.attachmentComplete,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? copy.messages.saveFailed)
      addToast(copy.messages.saveSuccess, { tone: 'success' })
      setModalOpen(false)
      await fetchRows(result.page, result.pageSize, filters, sort, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (row: VariationRow, status: string) => {
    if (!canUpdate) return
    if (status === 'VOID' && !window.confirm(copy.messages.confirmVoid)) return
    setActionId(row.id)
    try {
      const response = await fetch('/api/value/variation-measurements', {
        method: status === 'VOID' ? 'DELETE' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status === 'VOID' ? { id: row.id } : { id: row.id, action: 'status', status }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? copy.messages.saveFailed)
      addToast(copy.messages.statusSuccess, { tone: 'success' })
      await fetchRows(result.page, result.pageSize, filters, sort, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setActionId(null)
    }
  }

  const getMeasurementBlockReason = useCallback(
    (row: VariationRow) => {
      if (row.measurementDetailId || row.status === 'MEASURED' || row.status === 'VOID') return ''
      if (!row.boqItemId || !(row.roadSectionId || row.mainRoadSectionId) || !row.measurementPeriod || !hasPositiveQuantity(row)) {
        return copy.hints.measurementBlocked
      }
      return ''
    },
    [copy.hints.measurementBlocked],
  )

  const createMeasurementDetail = async (row: VariationRow) => {
    if (!canUpdate) return
    const blockedReason = getMeasurementBlockReason(row)
    if (blockedReason) {
      addToast(blockedReason, { tone: 'danger' })
      return
    }
    setActionId(row.id)
    try {
      const response = await fetch('/api/value/variation-measurements', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action: 'createMeasurementDetail' }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? copy.messages.measurementFailed)
      addToast(copy.messages.measurementSuccess, { tone: 'success' })
      await fetchRows(result.page, result.pageSize, filters, sort, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setActionId(null)
    }
  }

  const uploadAttachment = async (row: VariationRow, file: File | null) => {
    if (!file || !canUpload) return
    setUploadingId(row.id)
    try {
      const uploadUrlRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          category: SITE_VARIATION_MEASUREMENT_FILE_CATEGORY,
        }),
      })
      const uploadUrlBody = (await uploadUrlRes.json().catch(() => ({}))) as {
        uploadUrl?: string
        storageKey?: string
        requiredHeaders?: Record<string, string>
        message?: string
        error?: string
      }
      if (!uploadUrlRes.ok || !uploadUrlBody.uploadUrl || !uploadUrlBody.storageKey) {
        throw new Error(uploadUrlBody.error ?? uploadUrlBody.message ?? copy.messages.uploadFailed)
      }
      const putRes = await fetch(uploadUrlBody.uploadUrl, {
        method: 'PUT',
        headers: uploadUrlBody.requiredHeaders,
        body: file,
      })
      if (!putRes.ok) throw new Error(copy.messages.uploadFailed)

      const registerRes = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: uploadUrlBody.storageKey,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          category: SITE_VARIATION_MEASUREMENT_FILE_CATEGORY,
          links: [
            {
              entityType: SITE_VARIATION_MEASUREMENT_FILE_ENTITY_TYPE,
              entityId: String(row.id),
              purpose: SITE_VARIATION_MEASUREMENT_FILE_PURPOSE_EVIDENCE,
              label: row.structureName || row.phaseName || `variation-${row.id}`,
            },
          ],
        }),
      })
      const registerBody = (await registerRes.json().catch(() => ({}))) as { message?: string }
      if (!registerRes.ok) throw new Error(registerBody.message ?? copy.messages.uploadFailed)
      addToast(copy.messages.uploadSuccess, { tone: 'success' })
      await fetchRows(result.page, result.pageSize, filters, sort, { silent: true })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setUploadingId(null)
    }
  }

  const openAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/files/${attachment.id}?includeUrl=1`, { credentials: 'include' })
      const body = (await response.json().catch(() => ({}))) as {
        file?: { url?: string | null; previewUrl?: string | null }
        message?: string
      }
      const target = body.file?.url || body.file?.previewUrl
      if (!response.ok || !target) throw new Error(body.message ?? copy.messages.openFailed)
      window.open(target, '_blank', 'noopener,noreferrer')
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
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

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
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
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/value/measurement-ledger"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              {copy.openMeasurementLedger}
            </Link>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canUpdate}
              title={canUpdate ? copy.newRecord : copy.readOnly.updateRequired}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
            >
              {copy.newRecord}
            </button>
          </div>
        }
      />

      <section className="mx-auto w-full max-w-[1760px] px-5 pb-14 pt-6 sm:px-8 xl:px-12">
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">
              {canUpdate ? copy.hints.formulaVisible : copy.readOnly.title}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {canUpdate ? copy.hints.amountPreview : copy.readOnly.description}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canUpdate}
            title={canUpdate ? copy.newRecord : copy.readOnly.updateRequired}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {copy.newRecord}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: copy.cards.total, value: result.summary.count },
            { label: copy.cards.unmeasuredAmount, value: formatMoney(result.summary.unmeasuredAmount, locale) },
            { label: copy.cards.measuredAmount, value: formatMoney(result.summary.measuredAmount, locale) },
            { label: copy.cards.missingAttachment, value: result.summary.missingAttachmentCount },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
              <p className="mt-3 text-2xl font-black text-slate-950">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(140px,1fr))_auto]">
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.keyword}</span>
              <input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder={copy.filters.keywordPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.project}</span>
              <select
                value={filters.projectId}
                onChange={(event) => updateFilter('projectId', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">{copy.filters.all}</option>
                {sortedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.road}</span>
              <select
                value={filters.roadSectionId}
                onChange={(event) => updateFilter('roadSectionId', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">{copy.filters.all}</option>
                {filterRoadOptions.map((road) => (
                  <option key={road.id} value={road.id}>
                    {road.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.status}</span>
              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">{copy.filters.all}</option>
                {SITE_VARIATION_MEASUREMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getSiteVariationMeasurementStatusLabel(status, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.type}</span>
              <select
                value={filters.changeType}
                onChange={(event) => updateFilter('changeType', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">{copy.filters.all}</option>
                {SITE_VARIATION_MEASUREMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getSiteVariationMeasurementTypeLabel(type, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="mb-1 block">{copy.filters.attachment}</span>
              <select
                value={filters.attachmentState}
                onChange={(event) => updateFilter('attachmentState', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="all">{copy.filters.all}</option>
                <option value="withFiles">{copy.filters.withFiles}</option>
                <option value="withoutFiles">{copy.filters.withoutFiles}</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fetchRows(1)}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={loading}
              >
                {copy.filters.apply}
              </button>
              <button
                type="button"
                onClick={() => {
                  const reset: FilterState = {
                    search: '',
                    projectId: '',
                    roadSectionId: '',
                    status: '',
                    changeType: '',
                    attachmentState: 'all',
                  }
                  setFilters(reset)
                  void fetchRows(1, result.pageSize, reset, sort)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {copy.filters.reset}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-[0.14em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">{headerButton(copy.table.seq, 'id')}</th>
                    <th className="px-4 py-3">{copy.table.source}</th>
                    <th className="px-4 py-3">{copy.table.location}</th>
                    <th className="px-4 py-3">{copy.table.boq}</th>
                    <th className="px-4 py-3">{copy.table.quantities}</th>
                    <th className="px-4 py-3">{headerButton(copy.table.amount, 'estimatedAmount')}</th>
                    <th className="px-4 py-3">{headerButton(copy.table.status, 'status')}</th>
                    <th className="px-4 py-3">{copy.table.files}</th>
                    <th className="px-4 py-3">{headerButton(copy.table.updatedAt, 'updatedAt')}</th>
                    <th className="px-4 py-3">{copy.table.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((row, index) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-500">
                        #{(result.page - 1) * result.pageSize + index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-950">{row.structureName || row.phaseName || '—'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getSiteVariationMeasurementTypeLabel(row.changeType, locale)}
                          {row.reason ? ` · ${getSiteVariationMeasurementReasonLabel(row.reason, locale)}` : ''}
                        </div>
                        {row.spec ? <div className="mt-1 text-xs text-slate-500">{row.spec}</div> : null}
                        {row.remark ? (
                          <div className="mt-2 max-w-[360px] rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            {row.remark}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">
                          {row.projectName}
                          {row.roadSectionName ? ` · ${row.roadSectionName}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.startPk && row.endPk ? `PK ${row.startPk} → ${row.endPk}` : 'PK —'} ·{' '}
                          {sideLabel(row.side, locale)}
                        </div>
                        {row.mainRoadSectionName ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {copy.form.mainRoad}: {row.mainRoadSectionName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {row.boqItem ? (
                          <>
                            <div className="font-semibold text-slate-800">{row.boqItem.code}</div>
                            <div className="mt-1 max-w-[260px] text-xs text-slate-500">
                              {locale === 'fr' ? row.boqItem.designationFr : row.boqItem.designationZh}
                            </div>
                          </>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            {copy.hints.provisionalBoq}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600">
                        <div>Plan: {formatQuantity(row.designQuantity)}</div>
                        <div>Site: {formatQuantity(row.actualQuantity)}</div>
                        <div>Delta: {formatQuantity(row.deltaQuantity)}</div>
                        <div className="font-semibold text-slate-900">
                          Mesure: {formatQuantity(row.proposedQuantity)} {row.unit ?? ''}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {formatMoney(row.estimatedAmount, locale)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                          {getSiteVariationMeasurementStatusLabel(row.status, locale)}
                        </span>
                        {row.measurementDetailId ? (
                          <div className="mt-2 text-xs text-slate-500">MD #{row.measurementDetailId}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-500">{row.attachmentCount}</span>
                          {row.attachments.slice(0, 2).map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              onClick={() => openAttachment(attachment)}
                              className="max-w-[140px] truncate text-left text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                            >
                              {attachment.originalName}
                            </button>
                          ))}
                          {canUpload ? (
                            <label className="mt-1 inline-flex cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                              {uploadingId === row.id ? '...' : copy.actions.upload}
                              <input
                                type="file"
                                className="hidden"
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                  void uploadAttachment(row, event.target.files?.[0] ?? null)
                                  event.currentTarget.value = ''
                                }}
                              />
                            </label>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDate(row.updatedAt, locale)}</td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[172px] flex-col items-stretch gap-2 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            disabled={!canUpdate}
                            title={canUpdate ? copy.actions.edit : copy.readOnly.updateRequired}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {copy.actions.edit}
                          </button>
                          {row.status !== 'MEASURED' && row.status !== 'VOID' ? (
                            <button
                              type="button"
                              disabled={!canUpdate || actionId === row.id || Boolean(getMeasurementBlockReason(row))}
                              onClick={() => createMeasurementDetail(row)}
                              title={getMeasurementBlockReason(row) || copy.actions.generateMeasurement}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                            >
                              {copy.actions.generateMeasurement}
                            </button>
                          ) : null}
                          {canUpdate && row.status === 'PENDING_CONFIRMATION' ? (
                            <button type="button" onClick={() => updateStatus(row, 'READY_TO_MEASURE')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
                              {copy.actions.ready}
                            </button>
                          ) : null}
                          {canUpdate && row.status === 'MEASURED' ? (
                            <button type="button" onClick={() => updateStatus(row, 'ARCHIVED')} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                              {copy.actions.archive}
                            </button>
                          ) : null}
                          {canUpdate && row.status !== 'VOID' ? (
                            <button type="button" onClick={() => updateStatus(row, 'VOID')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600">
                              {copy.actions.void}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!result.items.length ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                        {copy.table.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
              <span>
                {result.total} · {result.page}/{result.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={result.pageSize}
                  onChange={(event) => fetchRows(1, Number(event.target.value))}
                  className="rounded-lg border border-slate-200 px-2 py-1"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={result.page <= 1 || loading}
                  onClick={() => fetchRows(result.page - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  {copy.actions.prev}
                </button>
                <button
                  type="button"
                  disabled={result.page >= result.totalPages || loading}
                  onClick={() => fetchRows(result.page + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  {copy.actions.next}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { title: copy.filters.project, rows: result.summary.byProject },
              { title: copy.filters.road, rows: result.summary.byRoad },
              { title: copy.form.phaseName, rows: result.summary.byPhase },
              { title: copy.filters.status, rows: result.summary.byStatus.map((row) => ({ ...row, label: getSiteVariationMeasurementStatusLabel(row.key, locale) })) },
            ].map((block) => (
              <div key={block.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{block.title}</h2>
                <div className="mt-4 space-y-3">
                  {block.rows.slice(0, 8).map((row) => (
                    <div key={`${block.title}-${row.key}`} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                        <span className="text-xs text-slate-500">{row.count}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>{copy.cards.unmeasuredAmount}</span>
                        <span className="text-right font-semibold text-slate-900">
                          {formatMoney(row.unmeasuredAmount, locale)}
                        </span>
                        <span>{copy.cards.measuredAmount}</span>
                        <span className="text-right font-semibold text-slate-900">
                          {formatMoney(row.measuredAmount, locale)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!block.rows.length ? <p className="text-sm text-slate-500">—</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
          <button
            type="button"
            aria-label={copy.form.cancel}
            onClick={() => setModalOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-emerald-700">
                    {editingId ? `#${editingId}` : copy.newRecord}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {editingId ? copy.editRecord : copy.newRecord}
                  </h2>
                  {form.projectId ? (
                    <p className="mt-1 text-sm text-slate-500">{projectNameById.get(Number(form.projectId))}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-lg leading-none text-slate-500 hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <FormSection title={copy.sections.basic}>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label={copy.form.project}>
                        <select value={form.projectId} onChange={(event) => updateForm('projectId', event.target.value)} className="input">
                          <option value="">—</option>
                          {sortedProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.road}>
                        <select value={form.roadSectionId} onChange={(event) => updateForm('roadSectionId', event.target.value)} className="input">
                          <option value="">—</option>
                          {filteredRoads.map((road) => (
                            <option key={road.id} value={road.id}>
                              {road.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.mainRoad}>
                        <select value={form.mainRoadSectionId} onChange={(event) => updateForm('mainRoadSectionId', event.target.value)} className="input">
                          <option value="">—</option>
                          {filteredRoads.map((road) => (
                            <option key={road.id} value={road.id}>
                              {road.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.boq} className="md:col-span-3">
                        <select value={form.boqItemId} onChange={(event) => handleBoqChange(event.target.value)} className="input">
                          <option value="">— {copy.hints.provisionalBoq}</option>
                          {filteredBoqItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} · {locale === 'fr' ? item.designationFr : item.designationZh}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.status}>
                        <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="input">
                          {SITE_VARIATION_MEASUREMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {getSiteVariationMeasurementStatusLabel(status, locale)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.type}>
                        <select value={form.changeType} onChange={(event) => updateForm('changeType', event.target.value)} className="input">
                          {SITE_VARIATION_MEASUREMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {getSiteVariationMeasurementTypeLabel(type, locale)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={copy.form.reason}>
                        <select value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} className="input">
                          <option value="">—</option>
                          {SITE_VARIATION_MEASUREMENT_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {getSiteVariationMeasurementReasonLabel(reason, locale)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection title={copy.sections.location}>
                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        ['structureName', copy.form.structureName],
                        ['phaseName', copy.form.phaseName],
                        ['spec', copy.form.spec],
                        ['startPk', copy.form.startPk],
                        ['endPk', copy.form.endPk],
                      ].map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input value={form[key as keyof FormState] as string} onChange={(event) => updateForm(key as keyof FormState, event.target.value)} className="input" />
                        </Field>
                      ))}
                      <Field label={copy.form.side}>
                        <select value={form.side} onChange={(event) => updateForm('side', event.target.value)} className="input">
                          <option value="">—</option>
                          <option value="LEFT">{sideLabel('LEFT', locale)}</option>
                          <option value="RIGHT">{sideLabel('RIGHT', locale)}</option>
                          <option value="BOTH">{sideLabel('BOTH', locale)}</option>
                        </select>
                      </Field>
                      <Field label={copy.form.occurredAt}>
                        <input type="date" value={form.occurredAt} onChange={(event) => updateForm('occurredAt', event.target.value)} className="input" />
                      </Field>
                      <Field label={copy.form.discoveredByText} className="md:col-span-2">
                        <input value={form.discoveredByText} onChange={(event) => updateForm('discoveredByText', event.target.value)} className="input" />
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection title={copy.sections.quantities}>
                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        ['designQuantity', copy.form.designQuantity],
                        ['actualQuantity', copy.form.actualQuantity],
                        ['deltaQuantity', copy.form.deltaQuantity],
                        ['proposedQuantity', copy.form.proposedQuantity],
                        ['unit', copy.form.unit],
                        ['unitPrice', copy.form.unitPrice],
                        ['estimatedAmount', copy.form.estimatedAmount],
                      ].map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            type={key === 'unit' ? 'text' : 'number'}
                            step={key === 'unit' ? undefined : '0.01'}
                            value={form[key as keyof FormState] as string}
                            onChange={(event) => updateForm(key as keyof FormState, event.target.value)}
                            className="input"
                          />
                        </Field>
                      ))}
                    </div>
                  </FormSection>

                  <FormSection title={copy.sections.notes}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={copy.form.measurementPeriod}>
                        <input type="month" value={form.measurementPeriod} onChange={(event) => updateForm('measurementPeriod', event.target.value)} className="input" />
                      </Field>
                      <Field label={copy.form.measuredAt}>
                        <input type="date" value={form.measuredAt} onChange={(event) => updateForm('measuredAt', event.target.value)} className="input" />
                      </Field>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.attachmentComplete}
                          onChange={(event) => updateForm('attachmentComplete', event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        {copy.form.attachmentComplete}
                      </label>
                      {[
                        ['designDescription', copy.form.designDescription],
                        ['fieldDescription', copy.form.fieldDescription],
                        ['differenceDescription', copy.form.differenceDescription],
                        ['remark', copy.form.remark],
                      ].map(([key, label]) => (
                        <Field key={key} label={label} className="md:col-span-2">
                          <textarea
                            value={form[key as keyof FormState] as string}
                            onChange={(event) => updateForm(key as keyof FormState, event.target.value)}
                            className="input min-h-[96px]"
                          />
                        </Field>
                      ))}
                    </div>
                  </FormSection>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{copy.form.estimatedAmount}</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {formatMoney(computedAmountPreview, locale)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{copy.hints.amountPreview}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{copy.form.status}</p>
                    <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(form.status)}`}>
                      {getSiteVariationMeasurementStatusLabel(form.status, locale)}
                    </span>
                    {!form.boqItemId ? (
                      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        {copy.hints.provisionalBoq}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                    {copy.hints.formulaVisible}
                  </div>
                </aside>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {copy.form.cancel}
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={saving || !canUpdate}
                title={canUpdate ? copy.form.save : copy.readOnly.updateRequired}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving ? '...' : copy.form.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
        }
        .input:focus {
          outline: none;
          border-color: rgb(52 211 153);
          box-shadow: 0 0 0 2px rgb(209 250 229);
        }
      `}</style>
    </main>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`text-sm font-semibold text-slate-700 ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-black text-slate-950">{title}</h3>
      {children}
    </section>
  )
}
