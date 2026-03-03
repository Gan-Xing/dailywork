'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import { formatCopy, locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type BoqProject = {
  id: number
  name: string
  code: string | null
  isActive: boolean
}

type BoqItemOption = {
  id: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: number | null
}

type RoadOption = {
  id: number
  name: string
  slug: string
  projectId: number | null
}

type DetailSide = 'BOTH' | 'LEFT' | 'RIGHT'

type DetailRow = {
  id: number
  projectId: number
  projectName: string
  projectCode: string | null
  period: string
  periodKey: string | null
  boqItemId: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: number | null
  roadId: number
  roadName: string
  roadSlug: string
  startPk: string | null
  endPk: string | null
  side: DetailSide | null
  quantity: number
  manualAmount: number | null
  amount: number | null
  note: string | null
  createdAt: string
  updatedAt: string
}

type Summary = {
  detailQuantity: number
  detailAmount: number
  measuredQuantity: number
  measuredAmount: number
  quantityDelta: number
  amountDelta: number
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

type LedgerCopy = {
  title: string
  description: string
  periodAll: string
  openMeasurement: string
  actions: {
    add: string
    edit: string
    remove: string
    save: string
    saving: string
    cancel: string
    deleting: string
    autoAmount: string
  }
  labels: {
    project: string
    period: string
    road: string
    search: string
    code: string
    designation: string
    unit: string
    unitPrice: string
    side: string
    startPk: string
    endPk: string
    quantity: string
    amount: string
    note: string
    summaryTitle: string
    summaryMeasuredQty: string
    summaryDetailQty: string
    summaryMeasuredAmount: string
    summaryDetailAmount: string
    summaryQtyDelta: string
    summaryAmountDelta: string
  }
  placeholders: {
    search: string
    selectProject: string
    selectPeriod: string
    selectRoad: string
    selectCode: string
    quantity: string
    amount: string
    side: string
    startPk: string
    endPk: string
    note: string
  }
  messages: {
    loadError: string
    loading: string
    projectLoading: string
    empty: string
    noMatches: string
    saveSuccess: string
    saveError: string
    required: string
    requiredProject: string
    requiredRoad: string
    requiredCode: string
    requiredPeriod: string
    pkPair: string
    invalidQuantity: string
    invalidAmount: string
    noBoqItems: string
    noRoads: string
    updateSuccess: string
    updateError: string
    deleteSuccess: string
    deleteError: string
    deleteConfirm: string
  }
  table: {
    code: string
    designation: string
    unit: string
    unitPrice: string
    project: string
    road: string
    side: string
    startPk: string
    endPk: string
    quantity: string
    amount: string
    note: string
    actions: string
  }
  modal: {
    title: string
    subtitle: string
    editTitle: string
    editSubtitle: string
    projectReadonly: string
  }
}

const ledgerCopy: Record<Locale, LedgerCopy> = {
  zh: {
    title: '计量明细',
    description: '按项目与期次记录计量明细行，追踪每一条计量对应的路段工程量。',
    periodAll: '全部期次',
    openMeasurement: '返回计量页面',
    actions: {
      add: '新增',
      edit: '编辑',
      remove: '删除',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      deleting: '删除中…',
      autoAmount: '恢复自动金额',
    },
    labels: {
      project: '项目',
      period: '期次',
      road: '路段',
      search: '检索',
      code: '编号',
      designation: '工程内容',
      unit: '单位',
      unitPrice: '单价（F CFA）',
      side: '侧别',
      startPk: '起点桩号',
      endPk: '终点桩号',
      quantity: '数量',
      amount: '计量金额',
      note: '备注',
      summaryTitle: '累计核对（明细 vs 计量）',
      summaryMeasuredQty: '计量总工程量',
      summaryDetailQty: '明细总工程量',
      summaryMeasuredAmount: '计量总金额',
      summaryDetailAmount: '明细总金额',
      summaryQtyDelta: '工程量差值',
      summaryAmountDelta: '金额差值',
    },
    placeholders: {
      search: '输入编号、工程内容或路段…',
      selectProject: '选择项目',
      selectPeriod: '选择期次',
      selectRoad: '选择路段',
      selectCode: '选择编号',
      side: '选择侧别（可选）',
      startPk: '如 PK0+000（可选）',
      endPk: '如 PK1+940（可选）',
      quantity: '输入数量',
      amount: '自动计算，可手改',
      note: '可选备注',
    },
    messages: {
      loadError: '加载计量明细失败，请稍后重试',
      loading: '正在加载计量明细…',
      projectLoading: '正在加载项目列表…',
      empty: '暂无计量明细记录',
      noMatches: '没有匹配的计量明细',
      saveSuccess: '计量明细已新增',
      saveError: '新增计量明细失败',
      required: '请补全必填项',
      requiredProject: '请选择项目',
      requiredRoad: '请选择路段',
      requiredCode: '请选择编号',
      requiredPeriod: '请选择期次',
      pkPair: '起点桩号和终点桩号需同时填写',
      invalidQuantity: '数量必须大于 0',
      invalidAmount: '计量金额必须是合法数字',
      noBoqItems: '当前项目没有可选编号（实际清单 ITEM）',
      noRoads: '当前项目没有可选路段',
      updateSuccess: '计量明细已更新',
      updateError: '更新计量明细失败',
      deleteSuccess: '计量明细已删除',
      deleteError: '删除计量明细失败',
      deleteConfirm: '确认删除该条明细（{code}）？',
    },
    table: {
      code: '编号',
      designation: '工程内容',
      unit: '单位',
      unitPrice: '单价（F CFA）',
      project: '项目',
      road: '路段',
      side: '侧别',
      startPk: '起点桩号',
      endPk: '终点桩号',
      quantity: '数量',
      amount: '计量金额',
      note: '备注',
      actions: '操作',
    },
    modal: {
      title: '新增计量明细',
      subtitle: '录入一条计量明细，编号信息来自实际工程量清单。',
      editTitle: '编辑计量明细',
      editSubtitle: '更新这条计量明细的区间、数量与金额。',
      projectReadonly: '项目（当前）',
    },
  },
  fr: {
    title: 'Détail métré',
    description: 'Enregistrer les lignes de détail de métré par projet et période, avec traçabilité par section.',
    periodAll: 'Toutes les périodes',
    openMeasurement: 'Retour aux métrés',
    actions: {
      add: 'Ajouter',
      edit: 'Modifier',
      remove: 'Supprimer',
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      cancel: 'Annuler',
      deleting: 'Suppression…',
      autoAmount: 'Revenir au montant auto',
    },
    labels: {
      project: 'Projet',
      period: 'Période',
      road: 'Section',
      search: 'Recherche',
      code: 'N° Prix',
      designation: 'Désignation',
      unit: 'Unité',
      unitPrice: 'Prix unitaire (F CFA)',
      side: 'Côté',
      startPk: 'PK début',
      endPk: 'PK fin',
      quantity: 'Quantité',
      amount: 'Montant métré',
      note: 'Note',
      summaryTitle: 'Contrôle cumulé (détail vs métré)',
      summaryMeasuredQty: 'Qté totale métré',
      summaryDetailQty: 'Qté totale détail',
      summaryMeasuredAmount: 'Montant total métré',
      summaryDetailAmount: 'Montant total détail',
      summaryQtyDelta: 'Écart quantité',
      summaryAmountDelta: 'Écart montant',
    },
    placeholders: {
      search: 'Code, désignation ou section…',
      selectProject: 'Sélectionner un projet',
      selectPeriod: 'Sélectionner une période',
      selectRoad: 'Sélectionner une section',
      selectCode: 'Sélectionner un code',
      side: 'Sélectionner un côté (optionnel)',
      startPk: 'Ex: PK0+000 (optionnel)',
      endPk: 'Ex: PK1+940 (optionnel)',
      quantity: 'Saisir la quantité',
      amount: 'Calculé automatiquement, modifiable',
      note: 'Note facultative',
    },
    messages: {
      loadError: 'Impossible de charger le détail métré',
      loading: 'Chargement du détail métré…',
      projectLoading: 'Chargement des projets…',
      empty: 'Aucune ligne de détail métré',
      noMatches: 'Aucun résultat',
      saveSuccess: 'Ligne de détail ajoutée',
      saveError: 'Échec de l’ajout',
      required: 'Veuillez remplir les champs requis',
      requiredProject: 'Sélectionnez un projet',
      requiredRoad: 'Sélectionnez une section',
      requiredCode: 'Sélectionnez un code',
      requiredPeriod: 'Sélectionnez une période',
      pkPair: 'PK début et PK fin doivent être saisis ensemble',
      invalidQuantity: 'La quantité doit être > 0',
      invalidAmount: 'Le montant est invalide',
      noBoqItems: 'Aucun code disponible pour ce projet',
      noRoads: 'Aucune section disponible pour ce projet',
      updateSuccess: 'Ligne de détail mise à jour',
      updateError: 'Échec de la mise à jour',
      deleteSuccess: 'Ligne de détail supprimée',
      deleteError: 'Échec de la suppression',
      deleteConfirm: 'Supprimer cette ligne ({code}) ?',
    },
    table: {
      code: 'N° Prix',
      designation: 'Désignation',
      unit: 'Unité',
      unitPrice: 'Prix unitaire (F CFA)',
      project: 'Projet',
      road: 'Section',
      side: 'Côté',
      startPk: 'PK début',
      endPk: 'PK fin',
      quantity: 'Quantité',
      amount: 'Montant métré',
      note: 'Note',
      actions: 'Actions',
    },
    modal: {
      title: 'Ajouter un détail métré',
      subtitle: 'Le code et ses informations proviennent du devis réel.',
      editTitle: 'Modifier le détail métré',
      editSubtitle: 'Mettre à jour la plage, la quantité et le montant de cette ligne.',
      projectReadonly: 'Projet (courant)',
    },
  },
}

const PERIOD_BASE_DATE = new Date(Date.UTC(2000, 0, 1))
const PERIOD_DAY_MS = 24 * 60 * 60 * 1000

const parsePeriodKey = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.startsWith('P') || trimmed.startsWith('p') ? trimmed.slice(1) : trimmed
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

const resolvePeriodKeyFromValue = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const diff = Math.round((parsed.getTime() - PERIOD_BASE_DATE.getTime()) / PERIOD_DAY_MS)
  if (!Number.isFinite(diff) || diff < 0) return null
  return String(diff)
}

const parseNumericValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const formatNumber = (value: number | null, localeId: string) => {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(value)
}

const normalizePeriodLabel = (template: string, periodKey: string) => {
  const index = parsePeriodKey(periodKey)
  return index === null ? periodKey : formatCopy(template, { value: index })
}

const sideLabels: Record<Locale, Record<DetailSide, string>> = {
  zh: {
    BOTH: '双侧',
    LEFT: '左侧',
    RIGHT: '右侧',
  },
  fr: {
    BOTH: 'Deux côtés',
    LEFT: 'Gauche',
    RIGHT: 'Droite',
  },
}

const frProjectNameByCode: Record<string, string> = {
  'project-bondoukou-city': 'Projet municipal de Bondoukou',
  'project-bondoukou-border': 'Projet frontalier de Bondoukou',
  'project-bondoukou-supply': "Projet d'approvisionnement de Bondoukou",
}

const frRoadNameBySlug: Record<string, string> = {
  'bondoukou-university': "Voie de l'Université",
  'level-crossing': 'Carrefour',
}

const containsCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const resolveProjectDisplayName = (project: { id: number; name: string; code: string | null }, locale: Locale) => {
  if (locale !== 'fr') return project.name
  if (project.code && frProjectNameByCode[project.code]) return frProjectNameByCode[project.code]
  if (!containsCjk(project.name)) return project.name
  if (project.code) return humanizeIdentifier(project.code)
  return `Projet #${project.id}`
}

const resolveRoadDisplayName = (road: { id: number; name: string; slug: string }, locale: Locale) => {
  if (locale !== 'fr') return road.name
  if (frRoadNameBySlug[road.slug]) return frRoadNameBySlug[road.slug]
  if (!containsCjk(road.name)) return road.name
  return humanizeIdentifier(road.slug)
}

export default function MeasurementLedgerPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const copy = productionValueCopy[locale]
  const ledger = ledgerCopy[locale]
  const { addToast } = useToast()
  const searchParams = useSearchParams()
  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'

  const [permissionDenied, setPermissionDenied] = useState(false)
  const [projects, setProjects] = useState<BoqProject[]>([])
  const [projectsStatus, setProjectsStatus] = useState<FetchStatus>('idle')
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams?.get('period')?.trim() || 'all')
  const [selectedRoadId, setSelectedRoadId] = useState('all')
  const [search, setSearch] = useState('')

  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DetailRow[]>([])
  const [boqItems, setBoqItems] = useState<BoqItemOption[]>([])
  const [roads, setRoads] = useState<RoadOption[]>([])
  const [periodOptions, setPeriodOptions] = useState<string[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    period: 'all',
    boqItemId: '',
    roadId: '',
    side: '',
    startPk: '',
    endPk: '',
    quantity: '',
    amount: '',
    amountTouched: false,
    note: '',
  })

  const initializedProjectRef = useRef(false)
  const initialProjectId = searchParams?.get('projectId')?.trim() ?? ''

  const selectedProject = useMemo(
    () => projects.find((item) => String(item.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const selectedBoqItem = useMemo(
    () => boqItems.find((item) => String(item.id) === form.boqItemId) ?? null,
    [boqItems, form.boqItemId],
  )

  const autoAmount = useMemo(() => {
    if (!selectedBoqItem) return ''
    const quantity = parseNumericValue(form.quantity)
    const unitPrice = selectedBoqItem.unitPrice
    if (quantity === null || unitPrice === null) return ''
    return (quantity * unitPrice).toFixed(2)
  }, [form.quantity, selectedBoqItem])

  const resolveDesignation = (row: { designationZh: string; designationFr: string }) =>
    locale === 'fr' ? row.designationFr || row.designationZh : row.designationZh || row.designationFr

  const resolveSide = (side: DetailSide | null) => (side ? sideLabels[locale][side] : '—')
  const resolveProjectName = (project: BoqProject) => resolveProjectDisplayName(project, locale)
  const resolveRoadName = (road: RoadOption) => resolveRoadDisplayName(road, locale)
  const resolveRowProjectName = (row: DetailRow) =>
    resolveProjectDisplayName({ id: row.projectId, name: row.projectName, code: row.projectCode }, locale)
  const resolveRowRoadName = (row: DetailRow) =>
    resolveRoadDisplayName({ id: row.roadId, name: row.roadName, slug: row.roadSlug }, locale)

  useEffect(() => {
    let cancelled = false

    const loadProjects = async () => {
      setProjectsStatus('loading')
      setProjectsError(null)
      try {
        const response = await fetch('/api/value/boq-projects', {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { projects?: BoqProject[]; message?: string }
        if (!response.ok) {
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(payload.message ?? copy.messages.projectLoadError)
        }
        if (cancelled) return
        setProjects(payload.projects ?? [])
        setProjectsStatus('success')
      } catch (fetchError) {
        if (cancelled) return
        setProjectsStatus('error')
        setProjectsError((fetchError as Error).message)
      }
    }

    loadProjects()
    return () => {
      cancelled = true
    }
  }, [copy.messages.projectLoadError])

  useEffect(() => {
    if (!projects.length || initializedProjectRef.current) return
    const matched = initialProjectId
      ? projects.find((item) => String(item.id) === initialProjectId)
      : null
    const target = matched ?? projects[0]
    setSelectedProjectId(String(target.id))
    initializedProjectRef.current = true
  }, [initialProjectId, projects])

  useEffect(() => {
    if (!selectedProjectId) {
      setRows([])
      setBoqItems([])
      setRoads([])
      setPeriodOptions([])
      setSummary(null)
      return
    }

    let cancelled = false

    const loadDetails = async () => {
      setStatus('loading')
      setError(null)
      try {
        const query = new URLSearchParams({ projectId: selectedProjectId })
        if (selectedPeriod !== 'all') query.set('period', selectedPeriod)
        if (selectedRoadId !== 'all') query.set('roadId', selectedRoadId)
        if (search.trim()) query.set('search', search.trim())

        const response = await fetch(`/api/value/measurement-details?${query.toString()}`, {
          credentials: 'include',
        })
        const payload = (await response
          .json()
          .catch(() => ({}))) as {
          details?: DetailRow[]
          boqItems?: BoqItemOption[]
          roads?: RoadOption[]
          periodOptions?: string[]
          summary?: Summary
          message?: string
        }

        if (!response.ok) {
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(payload.message ?? ledger.messages.loadError)
        }

        if (cancelled) return

        const nextPeriods = payload.periodOptions ?? []
        setRows(payload.details ?? [])
        setBoqItems(payload.boqItems ?? [])
        setRoads(payload.roads ?? [])
        setPeriodOptions(nextPeriods)
        setSummary(payload.summary ?? null)
        setStatus('success')

        if (selectedRoadId !== 'all' && !(payload.roads ?? []).some((item) => String(item.id) === selectedRoadId)) {
          setSelectedRoadId('all')
        }

        if (selectedPeriod !== 'all' && !nextPeriods.includes(selectedPeriod)) {
          setSelectedPeriod('all')
        }
      } catch (fetchError) {
        if (cancelled) return
        setStatus('error')
        setError((fetchError as Error).message)
      }
    }

    loadDetails()
    return () => {
      cancelled = true
    }
  }, [ledger.messages.loadError, search, selectedPeriod, selectedProjectId, selectedRoadId])

  useEffect(() => {
    if (!showCreateModal) return
    if (form.amountTouched) return
    setForm((prev) => {
      if (prev.amountTouched) return prev
      if (prev.amount === autoAmount) return prev
      return { ...prev, amount: autoAmount }
    })
  }, [autoAmount, form.amountTouched, showCreateModal])

  const openCreateModal = () => {
    if (!selectedProjectId) {
      addToast(ledger.messages.requiredProject, { tone: 'warning' })
      return
    }
    if (!boqItems.length) {
      addToast(ledger.messages.noBoqItems, { tone: 'warning' })
      return
    }
    if (!roads.length) {
      addToast(ledger.messages.noRoads, { tone: 'warning' })
      return
    }

    const defaultPeriod =
      selectedPeriod !== 'all'
        ? selectedPeriod
        : periodOptions.length
          ? periodOptions[periodOptions.length - 1]
          : resolvePeriodKeyFromValue(new Date().toISOString()) ?? ''

    setEditingId(null)
    setForm({
      period: defaultPeriod,
      boqItemId: '',
      roadId:
        selectedRoadId !== 'all' && roads.some((item) => String(item.id) === selectedRoadId)
          ? selectedRoadId
          : String(roads[0]?.id ?? ''),
      side: '',
      startPk: '',
      endPk: '',
      quantity: '',
      amount: '',
      amountTouched: false,
      note: '',
    })
    setShowCreateModal(true)
  }

  const openEditModal = (row: DetailRow) => {
    setEditingId(row.id)
    setForm({
      period: row.periodKey ?? resolvePeriodKeyFromValue(row.period) ?? '',
      boqItemId: String(row.boqItemId),
      roadId: String(row.roadId),
      side: row.side ?? '',
      startPk: row.startPk ?? '',
      endPk: row.endPk ?? '',
      quantity: String(row.quantity),
      amount: row.manualAmount !== null ? String(row.manualAmount) : row.amount !== null ? String(row.amount) : '',
      amountTouched: row.manualAmount !== null,
      note: row.note ?? '',
    })
    setShowCreateModal(true)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingId(null)
  }

  const refreshDetails = async () => {
    if (!selectedProjectId) return
    const query = new URLSearchParams({ projectId: selectedProjectId })
    if (selectedPeriod !== 'all') query.set('period', selectedPeriod)
    if (selectedRoadId !== 'all') query.set('roadId', selectedRoadId)
    if (search.trim()) query.set('search', search.trim())
    const refresh = await fetch(`/api/value/measurement-details?${query.toString()}`, {
      credentials: 'include',
    })
    const refreshPayload = (await refresh
      .json()
      .catch(() => ({}))) as {
      details?: DetailRow[]
      boqItems?: BoqItemOption[]
      roads?: RoadOption[]
      periodOptions?: string[]
      summary?: Summary
    }
    if (refresh.ok) {
      setRows(refreshPayload.details ?? [])
      setBoqItems(refreshPayload.boqItems ?? [])
      setRoads(refreshPayload.roads ?? [])
      setPeriodOptions(refreshPayload.periodOptions ?? [])
      setSummary(refreshPayload.summary ?? null)
    }
  }

  const handleSave = async () => {
    if (!selectedProjectId) {
      addToast(ledger.messages.requiredProject, { tone: 'warning' })
      return
    }
    if (!form.period) {
      addToast(ledger.messages.requiredPeriod, { tone: 'warning' })
      return
    }
    if (!form.boqItemId) {
      addToast(ledger.messages.requiredCode, { tone: 'warning' })
      return
    }
    if (!form.roadId) {
      addToast(ledger.messages.requiredRoad, { tone: 'warning' })
      return
    }

    const startPk = form.startPk.trim()
    const endPk = form.endPk.trim()
    if ((startPk && !endPk) || (!startPk && endPk)) {
      addToast(ledger.messages.pkPair, { tone: 'warning' })
      return
    }

    const quantity = parseNumericValue(form.quantity)
    if (quantity === null || quantity <= 0) {
      addToast(ledger.messages.invalidQuantity, { tone: 'warning' })
      return
    }

    let manualAmount: string | null = null
    if (form.amountTouched) {
      if (form.amount.trim()) {
        const parsedAmount = parseNumericValue(form.amount)
        if (parsedAmount === null || parsedAmount < 0) {
          addToast(ledger.messages.invalidAmount, { tone: 'warning' })
          return
        }
        const autoAmountValue = parseNumericValue(autoAmount)
        if (autoAmountValue === null || Math.abs(parsedAmount - autoAmountValue) > 0.01) {
          manualAmount = String(parsedAmount)
        }
      }
    }

    setSaving(true)
    try {
      const isEditing = editingId !== null
      const response = await fetch('/api/value/measurement-details', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(isEditing ? { id: editingId } : {}),
          projectId: Number(selectedProjectId),
          period: form.period,
          boqItemId: Number(form.boqItemId),
          roadId: Number(form.roadId),
          side: form.side || null,
          startPk: startPk || null,
          endPk: endPk || null,
          quantity: String(quantity),
          amount: manualAmount,
          note: form.note.trim() || null,
        }),
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { message?: string }

      if (!response.ok) {
        if (response.status === 403) setPermissionDenied(true)
        throw new Error(
          payload.message ?? (isEditing ? ledger.messages.updateError : ledger.messages.saveError),
        )
      }

      closeModal()
      addToast(isEditing ? ledger.messages.updateSuccess : ledger.messages.saveSuccess, { tone: 'success' })
      await refreshDetails()
    } catch (saveError) {
      const fallback = editingId !== null ? ledger.messages.updateError : ledger.messages.saveError
      addToast((saveError as Error).message ?? fallback, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: DetailRow) => {
    const confirmed = window.confirm(formatCopy(ledger.messages.deleteConfirm, { code: row.code }))
    if (!confirmed) return
    setDeletingId(row.id)
    try {
      const response = await fetch('/api/value/measurement-details', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: row.id }),
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { message?: string }

      if (!response.ok) {
        if (response.status === 403) setPermissionDenied(true)
        throw new Error(payload.message ?? ledger.messages.deleteError)
      }

      if (editingId === row.id) {
        closeModal()
      }
      addToast(ledger.messages.deleteSuccess, { tone: 'success' })
      await refreshDetails()
    } catch (deleteError) {
      addToast((deleteError as Error).message ?? ledger.messages.deleteError, { tone: 'danger' })
    } finally {
      setDeletingId(null)
    }
  }

  const tabs = [
    {
      key: 'measurement',
      label: copy.tabs.measurement,
      href: '/value?tab=measurement',
      active: false,
    },
    {
      key: 'ledger',
      label: ledger.title,
      href: '/value/measurement-ledger',
      active: true,
    },
  ]

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
      <PageHeaderNav
        className="z-30 py-4"
        breadcrumbs={[{ label: copy.breadcrumbs.home, href: '/' }, { label: copy.breadcrumbs.value }]}
        title={ledger.title}
        subtitle={ledger.description}
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
        rightSlot={
          <Link
            href={selectedProjectId ? `/value?tab=measurement&projectId=${selectedProjectId}` : '/value?tab=measurement'}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
          >
            {ledger.openMeasurement}
          </Link>
        }
      />

      <section className="mx-auto w-full max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="p-6">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    <span className="mb-1 block">{ledger.labels.project}</span>
                    <select
                      className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      {!projects.length ? (
                        <option value="">{ledger.placeholders.selectProject}</option>
                      ) : null}
                      {projects.map((project) => (
                        <option key={project.id} value={String(project.id)}>
                          {resolveProjectName(project)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    <span className="mb-1 block">{ledger.labels.period}</span>
                    <select
                      className="w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={selectedPeriod}
                      onChange={(event) => setSelectedPeriod(event.target.value)}
                    >
                      <option value="all">{ledger.periodAll}</option>
                      {periodOptions.map((periodKey) => (
                        <option key={periodKey} value={periodKey}>
                          {normalizePeriodLabel(copy.measurement.periodLabel, periodKey)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    <span className="mb-1 block">{ledger.labels.road}</span>
                    <select
                      className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={selectedRoadId}
                      onChange={(event) => setSelectedRoadId(event.target.value)}
                    >
                      <option value="all">{ledger.placeholders.selectRoad}</option>
                      {roads.map((road) => (
                        <option key={road.id} value={String(road.id)}>
                          {resolveRoadName(road)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    <span className="mb-1 block">{ledger.labels.search}</span>
                    <input
                      type="search"
                      className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={ledger.placeholders.search}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
                >
                  {ledger.actions.add}
                </button>
              </div>

              <div className="space-y-1 text-xs text-slate-500">
                {projectsStatus === 'loading' && <p>{ledger.messages.projectLoading}</p>}
                {projectsStatus === 'error' && (
                  <p className="text-rose-600">{projectsError ?? copy.messages.projectLoadError}</p>
                )}
                {status === 'loading' && <p>{ledger.messages.loading}</p>}
                {status === 'error' && <p className="text-rose-600">{error ?? ledger.messages.loadError}</p>}
              </div>

              {summary ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {ledger.labels.summaryTitle}
                  </p>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryMeasuredQty}：</span>
                      <span className="tabular-nums text-slate-900">
                        {formatNumber(summary.measuredQuantity, localeId)}
                      </span>
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryDetailQty}：</span>
                      <span className="tabular-nums text-slate-900">
                        {formatNumber(summary.detailQuantity, localeId)}
                      </span>
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryQtyDelta}：</span>
                      <span
                        className={`tabular-nums ${
                          Math.abs(summary.quantityDelta) <= 0.01 ? 'text-slate-900' : 'text-rose-700'
                        }`}
                      >
                        {formatNumber(summary.quantityDelta, localeId)}
                      </span>
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryMeasuredAmount}：</span>
                      <span className="tabular-nums text-slate-900">
                        {formatNumber(summary.measuredAmount, localeId)}
                      </span>
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryDetailAmount}：</span>
                      <span className="tabular-nums text-slate-900">
                        {formatNumber(summary.detailAmount, localeId)}
                      </span>
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-slate-500">{ledger.labels.summaryAmountDelta}：</span>
                      <span
                        className={`tabular-nums ${
                          Math.abs(summary.amountDelta) <= 0.01 ? 'text-slate-900' : 'text-rose-700'
                        }`}
                      >
                        {formatNumber(summary.amountDelta, localeId)}
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}

              {rows.length ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-100/70">
                      <tr
                        className={`text-[11px] font-semibold text-slate-500 ${
                          locale === 'fr' ? 'uppercase tracking-[0.24em]' : 'tracking-[0.12em]'
                        }`}
                      >
                        <th className="w-[9%] px-3 py-3 text-left">{ledger.table.code}</th>
                        <th className="px-3 py-3 text-left">{ledger.table.designation}</th>
                        <th className="w-[8%] px-3 py-3 text-left">{ledger.table.unit}</th>
                        <th className="w-[12%] px-3 py-3 text-right">{ledger.table.unitPrice}</th>
                        <th className="w-[14%] px-3 py-3 text-left">{ledger.table.project}</th>
                        <th className="w-[14%] px-3 py-3 text-left">{ledger.table.road}</th>
                        <th className="w-[8%] px-3 py-3 text-left">{ledger.table.side}</th>
                        <th className="w-[10%] px-3 py-3 text-left">{ledger.table.startPk}</th>
                        <th className="w-[10%] px-3 py-3 text-left">{ledger.table.endPk}</th>
                        <th className="w-[10%] px-3 py-3 text-right">{ledger.table.quantity}</th>
                        <th className="w-[12%] px-3 py-3 text-right">{ledger.table.amount}</th>
                        <th className="w-[16%] px-3 py-3 text-left">{ledger.table.note}</th>
                        <th className="w-[10%] px-3 py-3 text-left">{ledger.table.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {rows.map((row) => (
                        <tr key={row.id} className="transition hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.18em] text-slate-700">
                            {row.code}
                          </td>
                          <td className="px-3 py-3 text-slate-700">{resolveDesignation(row)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {row.unit ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                            {formatNumber(row.unitPrice, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{resolveRowProjectName(row)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{resolveRowRoadName(row)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{resolveSide(row.side)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.startPk ?? '—'}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.endPk ?? '—'}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                            {formatNumber(row.quantity, localeId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                            {formatNumber(row.amount, localeId)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{row.note || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                                onClick={() => openEditModal(row)}
                                disabled={saving || deletingId === row.id}
                              >
                                {ledger.actions.edit}
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                                onClick={() => handleDelete(row)}
                                disabled={saving || deletingId === row.id}
                              >
                                {deletingId === row.id ? ledger.actions.deleting : ledger.actions.remove}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : search.trim() || selectedRoadId !== 'all' ? (
                <p className="text-sm text-slate-500">{ledger.messages.noMatches}</p>
              ) : status === 'success' ? (
                <p className="text-sm text-slate-500">{ledger.messages.empty}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-4 sm:items-center sm:py-6">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId === null ? ledger.modal.title : ledger.modal.editTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingId === null ? ledger.modal.subtitle : ledger.modal.editSubtitle}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                onClick={closeModal}
                disabled={saving}
              >
                {ledger.actions.cancel}
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.project}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  value={
                    selectedProject ? resolveProjectName(selectedProject) : ''
                  }
                  readOnly
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.period}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.period}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, period: event.target.value }))
                  }
                >
                  <option value="">{ledger.placeholders.selectPeriod}</option>
                  {periodOptions.map((periodKey) => (
                    <option key={periodKey} value={periodKey}>
                      {normalizePeriodLabel(copy.measurement.periodLabel, periodKey)}
                    </option>
                  ))}
                  {form.period && !periodOptions.includes(form.period) ? (
                    <option value={form.period}>{normalizePeriodLabel(copy.measurement.periodLabel, form.period)}</option>
                  ) : null}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.code}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.boqItemId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      boqItemId: event.target.value,
                      amountTouched: false,
                    }))
                  }
                >
                  <option value="">{ledger.placeholders.selectCode}</option>
                  {boqItems.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.code} · {resolveDesignation(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.road}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.roadId}
                  onChange={(event) => setForm((prev) => ({ ...prev, roadId: event.target.value }))}
                >
                  <option value="">{ledger.placeholders.selectRoad}</option>
                  {roads.map((road) => (
                    <option key={road.id} value={String(road.id)}>
                      {resolveRoadName(road)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.side}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.side}
                  onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value }))}
                >
                  <option value="">{ledger.placeholders.side}</option>
                  <option value="LEFT">{sideLabels[locale].LEFT}</option>
                  <option value="RIGHT">{sideLabels[locale].RIGHT}</option>
                  <option value="BOTH">{sideLabels[locale].BOTH}</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.startPk}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.startPk}
                  placeholder={ledger.placeholders.startPk}
                  onChange={(event) => setForm((prev) => ({ ...prev, startPk: event.target.value }))}
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.endPk}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.endPk}
                  placeholder={ledger.placeholders.endPk}
                  onChange={(event) => setForm((prev) => ({ ...prev, endPk: event.target.value }))}
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.designation}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  value={selectedBoqItem ? resolveDesignation(selectedBoqItem) : ''}
                  readOnly
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.unit}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  value={selectedBoqItem?.unit ?? ''}
                  readOnly
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.unitPrice}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  value={selectedBoqItem?.unitPrice !== null ? String(selectedBoqItem?.unitPrice ?? '') : ''}
                  readOnly
                />
              </label>

              <label className="text-xs font-semibold text-slate-500">
                {ledger.labels.quantity}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.quantity}
                  inputMode="decimal"
                  placeholder={ledger.placeholders.quantity}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </label>

              <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
                {ledger.labels.amount}
                <div className="mt-2 flex gap-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    value={form.amount}
                    inputMode="decimal"
                    placeholder={ledger.placeholders.amount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                        amountTouched: true,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        amountTouched: false,
                        amount: autoAmount,
                      }))
                    }
                  >
                    {ledger.actions.autoAmount}
                  </button>
                </div>
              </label>

              <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
                {ledger.labels.note}
                <textarea
                  className="mt-2 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={form.note}
                  placeholder={ledger.placeholders.note}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:bg-white"
                onClick={closeModal}
                disabled={saving}
              >
                {ledger.actions.cancel}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? ledger.actions.saving : ledger.actions.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
