'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useToast } from '@/components/ToastProvider'
import { locales, type Locale } from '@/lib/i18n'
import { productionValueCopy } from '@/lib/i18n/value'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

type BoqItemTone = 'SECTION' | 'SUBSECTION' | 'ITEM' | 'TOTAL'

type BoqProject = { id: number; name: string; code: string | null; isActive: boolean }

type BoqItemRecord = {
  id: number
  projectId: number
  sheetType: 'CONTRACT' | 'ACTUAL'
  code: string
  designationZh: string
  designationFr: string
  designation?: string
  unit: string | null
  unitPrice: string | null
  quantity: string | null
  totalPrice: string | null
  tone: BoqItemTone
  sortOrder: number
  contractItemId: number | null
  isActive: boolean
}

type LetterRecord = {
  id: number
  documentId: number
  documentCode: string
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED'
  projectId: number
  boqItemId: number | null
  boqItemCode: string | null
  boqItemDesignationZh: string | null
  boqItemDesignationFr: string | null
  letterNumber: number
  subject: string
  senderOrg: string | null
  recipientOrg: string | null
  issuedAt: string | null
  receivedAt: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
  attachmentCount: number
}

type BoqFormState = {
  projectId: string
  code: string
  designationZh: string
  designationFr: string
  unit: string
  unitPrice: string
  quantity: string
  tone: BoqItemTone
}

type LetterFormState = {
  subject: string
  senderOrg: string
  recipientOrg: string
  issuedAt: string
  receivedAt: string
  remark: string
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED'
  boqItemId: string
}

const boqManageCopy: Record<Locale, any> = {
  zh: {
    title: '实际工程量清单',
    description: '维护实际工程量清单，支持新增分项与调整数量。',
    breadcrumbs: {
      home: '首页',
      value: '产值计量',
      boq: '工程量清单',
    },
    actions: {
      newItem: '新增分项',
      back: '返回清单',
      searchLabel: '检索',
      searchPlaceholder: '输入编号或名称…',
      viewLabel: '视图',
      viewAll: '全部',
      viewSummary: '仅汇总',
      sortHint: '仅在全量视图且未检索时支持拖拽排序',
      sortToggle: '拖拽排序',
    },
    tableHeaders: {
      code: '编号',
      designation: '工程内容',
      unit: '单位',
      unitPrice: '单价（F CFA）',
      quantity: '数量',
      totalPrice: '合价（F CFA）',
    },
    status: {
      draft: '草稿',
      final: '已签收',
      archived: '已归档',
    },
    tone: {
      SECTION: '章节',
      SUBSECTION: '小节',
      ITEM: '分项',
      TOTAL: '汇总',
    },
    form: {
      createTitle: '新增分项',
      editTitle: '分项详情',
      project: '项目',
      code: '编号',
      designationZh: '中文名称',
      designationFr: '法文名称',
      unit: '单位',
      unitPrice: '单价',
      quantity: '数量',
      totalPrice: '合价',
      tone: '行类型',
      sortOrder: '排序',
      save: '保存',
      cancel: '取消',
    },
    letters: {
      title: '函件记录',
      new: '新增函件',
      edit: '编辑函件',
      subject: '主题',
      senderOrg: '发函单位',
      recipientOrg: '收函单位',
      issuedAt: '发函日期',
      receivedAt: '签收日期',
      remark: '备注',
      status: '状态',
      code: '函件编号',
      number: '序号',
      binding: '关联分项（可选）',
      unbound: '不关联',
      attachments: '签收件',
      upload: '上传签收件',
      archive: '归档',
      actions: '操作',
      save: '保存',
      cancel: '取消',
      empty: '暂无函件记录',
    },
    messages: {
      loading: '正在加载…',
      empty: '暂无实际清单记录',
      loadError: '加载失败，请稍后重试',
      requiredProject: '请选择项目',
      requiredCode: '编号不能为空',
      requiredName: '请填写中法双语名称',
      confirmArchiveLetter: '确认归档该函件？',
      saving: '正在保存…',
      sortSaved: '排序已保存',
    },
  },
  fr: {
    title: 'Devis quantitatif réel',
    description: 'Gérer le devis réel, ajouter des postes et ajuster les quantités.',
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs',
      boq: 'Devis quantitatif',
    },
    actions: {
      newItem: 'Nouveau poste',
      back: 'Retour au devis',
      searchLabel: 'Recherche',
      searchPlaceholder: 'Rechercher par code ou désignation…',
      viewLabel: 'Vue',
      viewAll: 'Tout',
      viewSummary: 'Synthèse',
      sortHint: 'Glisser-déposer uniquement en vue complète sans recherche',
      sortToggle: 'Tri par glisser',
    },
    tableHeaders: {
      code: 'N° Prix',
      designation: 'Désignation',
      unit: 'Unité',
      unitPrice: 'Prix unitaire (F CFA)',
      quantity: 'Quantité',
      totalPrice: 'Prix total (F CFA)',
    },
    status: {
      draft: 'Brouillon',
      final: 'Réceptionné',
      archived: 'Archivé',
    },
    tone: {
      SECTION: 'Section',
      SUBSECTION: 'Sous-section',
      ITEM: 'Poste',
      TOTAL: 'Total',
    },
    form: {
      createTitle: 'Nouveau poste',
      editTitle: 'Détail du poste',
      project: 'Projet',
      code: 'Code',
      designationZh: 'Désignation (zh)',
      designationFr: 'Désignation (fr)',
      unit: 'Unité',
      unitPrice: 'Prix unitaire',
      quantity: 'Quantité',
      totalPrice: 'Prix total',
      tone: 'Type',
      sortOrder: 'Ordre',
      save: 'Enregistrer',
      cancel: 'Annuler',
    },
    letters: {
      title: 'Courriers',
      new: 'Nouveau courrier',
      edit: 'Modifier',
      subject: 'Objet',
      senderOrg: 'Émetteur',
      recipientOrg: 'Destinataire',
      issuedAt: 'Date émission',
      receivedAt: 'Date réception',
      remark: 'Remarque',
      status: 'Statut',
      code: 'Code',
      number: 'N°',
      binding: 'Poste lié (optionnel)',
      unbound: 'Sans liaison',
      attachments: 'Pièces',
      upload: 'Téléverser',
      archive: 'Archiver',
      actions: 'Actions',
      save: 'Enregistrer',
      cancel: 'Annuler',
      empty: 'Aucun courrier',
    },
    messages: {
      loading: 'Chargement…',
      empty: 'Aucun devis réel',
      loadError: 'Chargement impossible',
      requiredProject: 'Sélectionner un projet',
      requiredCode: 'Code requis',
      requiredName: 'Nom zh/fr requis',
      confirmArchiveLetter: 'Archiver ce courrier ?',
      saving: 'Enregistrement…',
      sortSaved: 'Ordre enregistré',
    },
  },
}

const formatLocaleId = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'zh-CN')

const formatBoqCell = (value?: string | number | null, localeId?: string) => {
  if (value === undefined || value === null) return '—'
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return '—'
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return trimmed
  return new Intl.NumberFormat(localeId ?? 'fr-FR', { maximumFractionDigits: 2 }).format(parsed)
}

const formatDateInput = (value: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

const normalizeSearchTokens = (value: string) =>
  value.trim().toLowerCase().split(/\s+/).filter(Boolean)

const boqRowToneStyles: Record<BoqItemTone, string> = {
  SECTION: 'bg-slate-100/70 text-slate-900 font-semibold',
  SUBSECTION: 'bg-slate-50/70 text-slate-700 font-medium',
  ITEM: 'text-slate-700',
  TOTAL: 'bg-emerald-50 text-emerald-800 font-semibold',
}

const parseDecimalValue = (value?: string | null) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const computeTotalPrice = (quantity?: string | null, unitPrice?: string | null) => {
  const quantityValue = parseDecimalValue(quantity)
  const unitValue = parseDecimalValue(unitPrice)
  if (quantityValue === null || unitValue === null) return null
  return (quantityValue * unitValue).toFixed(2)
}

const normalizeBoqCode = (value?: string | null) => (value ?? '').trim().toUpperCase()

const isVatCode = (code: string) => code === 'TVA'
const isTotalHtvaCode = (code: string) => code.startsWith('TOTAL HTVA')
const isTotalWithTaxCode = (code: string) => code.startsWith('TOTAL TTC')

const extractCodeNumber = (code: string) => {
  const match = code.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

const isMajorSubsectionCode = (code: string) => {
  const normalized = normalizeBoqCode(code)
  if (!/^\d{3}$/.test(normalized)) return false
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed % 100 === 0
}

const resolveSectionKey = (code: string) => {
  if (!code) return Number.MAX_SAFE_INTEGER
  if (isVatCode(code) || isTotalWithTaxCode(code)) return Number.MAX_SAFE_INTEGER - 1
  const totalMatch = code.match(/^T(\d+)$/)
  if (totalMatch) {
    return Number(totalMatch[1]) * 100
  }
  const number = extractCodeNumber(code)
  if (number === null) return Number.MAX_SAFE_INTEGER - 2
  if (number < 100) return 0
  return Math.floor(number / 100) * 100
}

const hasStructuralMismatch = (actualItems: BoqItemRecord[], contractItems: BoqItemRecord[]) => {
  if (!contractItems.length) return false
  const contractMap = new Map<number, BoqItemRecord>()
  contractItems.forEach((item) => contractMap.set(item.id, item))
  const actualByContract = new Map<number, BoqItemRecord[]>()
  actualItems.forEach((item) => {
    if (!item.contractItemId) return
    const list = actualByContract.get(item.contractItemId) ?? []
    list.push(item)
    actualByContract.set(item.contractItemId, list)
  })
  if (actualByContract.size !== contractItems.length) return true
  const contractSorted = [...contractItems].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  )
  const actualOrder = actualItems
    .filter((item) => item.contractItemId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => item.contractItemId)
  if (actualOrder.length !== contractSorted.length) return true
  for (let i = 0; i < contractSorted.length; i += 1) {
    if (actualOrder[i] !== contractSorted[i].id) return true
  }
  return contractSorted.some((contract) => {
    const matches = actualByContract.get(contract.id)
    if (!matches || matches.length !== 1) return true
    const actual = matches[0]
    return (
      contract.code !== actual.code ||
      contract.tone !== actual.tone ||
      contract.designationZh !== actual.designationZh ||
      contract.designationFr !== actual.designationFr ||
      contract.unit !== actual.unit ||
      contract.unitPrice !== actual.unitPrice
    )
  })
}

export default function BoqManageClient() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const copy = boqManageCopy[locale]
  const tabCopy = productionValueCopy[locale]
  const unauthorizedMessage = tabCopy.page.messages.unauthorized
  const localeId = formatLocaleId(locale)

  const [boqProjects, setBoqProjects] = useState<BoqProject[]>([])
  const [boqProjectsStatus, setBoqProjectsStatus] = useState<FetchStatus>('idle')
  const [boqProjectsError, setBoqProjectsError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [boqItems, setBoqItems] = useState<BoqItemRecord[]>([])
  const [boqItemsStatus, setBoqItemsStatus] = useState<FetchStatus>('idle')
  const [boqItemsError, setBoqItemsError] = useState<string | null>(null)
  const [boqSearch, setBoqSearch] = useState('')
  const [boqViewMode, setBoqViewMode] = useState<'full' | 'summary'>('full')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [seededProjects, setSeededProjects] = useState<Record<string, boolean>>({})
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [savingSort, setSavingSort] = useState(false)
  const [sortEnabled, setSortEnabled] = useState(false)

  const [showFormModal, setShowFormModal] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingItem, setEditingItem] = useState<BoqItemRecord | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [updatingQuantityId, setUpdatingQuantityId] = useState<number | null>(null)
  const [formState, setFormState] = useState<BoqFormState>({
    projectId: '',
    code: '',
    designationZh: '',
    designationFr: '',
    unit: '',
    unitPrice: '',
    quantity: '',
    tone: 'ITEM',
  })

  const [showLetterModal, setShowLetterModal] = useState(false)
  const [letterItem, setLetterItem] = useState<BoqItemRecord | null>(null)
  const [letterScope, setLetterScope] = useState<'boq' | 'project'>('boq')
  const [letterProjectId, setLetterProjectId] = useState('')
  const [letters, setLetters] = useState<LetterRecord[]>([])
  const [lettersStatus, setLettersStatus] = useState<FetchStatus>('idle')
  const [lettersError, setLettersError] = useState<string | null>(null)
  const [letterMode, setLetterMode] = useState<'create' | 'edit'>('create')
  const [editingLetterId, setEditingLetterId] = useState<number | null>(null)
  const [letterDraft, setLetterDraft] = useState<LetterFormState>({
    subject: '',
    senderOrg: '',
    recipientOrg: '',
    issuedAt: '',
    receivedAt: '',
    remark: '',
    status: 'DRAFT',
    boqItemId: '',
  })
  const [savingLetter, setSavingLetter] = useState(false)
  const [uploadingLetterId, setUploadingLetterId] = useState<number | null>(null)

  const errorToastRef = useRef<string | null>(null)
  const boqErrorToastRef = useRef<string | null>(null)
  const lettersToastRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadProjects = async () => {
      setBoqProjectsStatus('loading')
      setBoqProjectsError(null)
      try {
        const response = await fetch('/api/value/boq-projects', { credentials: 'include' })
        const payload = (await response
          .json()
          .catch(() => ({}))) as { projects?: BoqProject[]; message?: string }
        if (!response.ok) {
          if (response.status === 403) {
            setPermissionDenied(true)
          }
          throw new Error(payload.message ?? copy.messages.loadError)
        }
        if (cancelled) return
        setBoqProjects(payload.projects ?? [])
        setBoqProjectsStatus('success')
      } catch (error) {
        if (cancelled) return
        setBoqProjectsStatus('error')
        setBoqProjectsError((error as Error).message)
      }
    }

    loadProjects()

    return () => {
      cancelled = true
    }
  }, [copy.messages.loadError])

  useEffect(() => {
    if (!boqProjects.length || selectedProjectId) return
    setSelectedProjectId(String(boqProjects[0].id))
  }, [boqProjects, selectedProjectId])

  const selectedProject = useMemo(
    () => boqProjects.find((project) => String(project.id) === selectedProjectId) ?? null,
    [boqProjects, selectedProjectId],
  )

  const loadBoqItems = useCallback(async (projectId: string) => {
    if (!projectId) return
    setBoqItemsStatus('loading')
    setBoqItemsError(null)
    try {
      const response = await fetch(
        `/api/value/boq-items?projectId=${projectId}&sheetType=ACTUAL`,
        { credentials: 'include' },
      )
      const payload = (await response
        .json()
        .catch(() => ({}))) as { items?: BoqItemRecord[]; message?: string }
      if (!response.ok) {
        if (response.status === 403) {
          addToast(payload.message ?? copy.messages.loadError, { tone: 'warning' })
          setBoqItems([])
          setBoqItemsStatus('success')
          return
        }
        throw new Error(payload.message ?? copy.messages.loadError)
      }
      const items = payload.items ?? []

      setBoqItems(items)
      setBoqItemsStatus('success')
    } catch (error) {
      setBoqItemsStatus('error')
      setBoqItemsError((error as Error).message)
    }
  }, [addToast, copy.messages.loadError])

  const seedActualItems = useCallback(async (projectId: string) => {
    setBoqItemsStatus('loading')
    setBoqItemsError(null)
    try {
      const response = await fetch('/api/value/boq-items/seed', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: Number(projectId) }),
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { items?: BoqItemRecord[]; message?: string }
      if (!response.ok) {
        if (response.status === 403) {
          setPermissionDenied(true)
        }
        throw new Error(payload.message ?? copy.messages.loadError)
      }
      setBoqItems(payload.items ?? [])
      setBoqItemsStatus('success')
    } catch (error) {
      setBoqItemsStatus('error')
      setBoqItemsError((error as Error).message)
    }
  }, [copy.messages.loadError])

  useEffect(() => {
    if (!selectedProjectId) return
    loadBoqItems(selectedProjectId)
  }, [loadBoqItems, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) return
    if (boqItemsStatus !== 'success') return
    if (boqItems.length) return
    if (seededProjects[selectedProjectId]) return
    setSeededProjects((prev) => ({ ...prev, [selectedProjectId]: true }))
    seedActualItems(selectedProjectId)
  }, [boqItems.length, boqItemsStatus, seededProjects, seedActualItems, selectedProjectId])

  useEffect(() => {
    if (boqProjectsStatus !== 'error') return
    const message = boqProjectsError
    if (!message || message === errorToastRef.current) return
    addToast(message, { tone: 'danger' })
    errorToastRef.current = message
  }, [addToast, boqProjectsError, boqProjectsStatus])

  useEffect(() => {
    if (boqItemsStatus !== 'error') return
    const message = boqItemsError
    if (!message || message === boqErrorToastRef.current) return
    addToast(message, { tone: 'danger' })
    boqErrorToastRef.current = message
  }, [addToast, boqItemsError, boqItemsStatus])

  useEffect(() => {
    if (lettersStatus !== 'error') return
    const message = lettersError
    if (!message || message === lettersToastRef.current) return
    addToast(message, { tone: 'danger' })
    lettersToastRef.current = message
  }, [addToast, lettersError, lettersStatus])

  const resetForm = (projectId?: string) => {
    setFormState({
      projectId: projectId ?? selectedProjectId,
      code: '',
      designationZh: '',
      designationFr: '',
      unit: '',
      unitPrice: '',
      quantity: '',
      tone: 'ITEM',
    })
  }

  const openCreateModal = () => {
    setFormMode('create')
    setEditingItem(null)
    resetForm(selectedProjectId)
    setShowFormModal(true)
  }

  const openEditModal = (item: BoqItemRecord) => {
    setFormMode('edit')
    setEditingItem(item)
    setFormState({
      projectId: String(item.projectId),
      code: item.code ?? '',
      designationZh: item.designationZh ?? '',
      designationFr: item.designationFr ?? '',
      unit: item.unit ?? '',
      unitPrice: item.unitPrice ?? '',
      quantity: item.quantity ?? '',
      tone: item.tone ?? 'ITEM',
    })
    setShowFormModal(true)
  }

  const handleSaveItem = async () => {
    const projectId = formState.projectId || selectedProjectId
    if (!projectId) {
      addToast(copy.messages.requiredProject, { tone: 'warning' })
      return
    }
    if (!formState.code.trim()) {
      addToast(copy.messages.requiredCode, { tone: 'warning' })
      return
    }
    if (!formState.designationZh.trim() || !formState.designationFr.trim()) {
      addToast(copy.messages.requiredName, { tone: 'warning' })
      return
    }

    setSavingItem(true)
    try {
      if (formMode === 'edit' && !editingItem) {
        throw new Error(copy.messages.loadError)
      }
      const payload = {
        projectId: Number(projectId),
        sheetType: 'ACTUAL',
        code: formState.code.trim(),
        designationZh: formState.designationZh.trim(),
        designationFr: formState.designationFr.trim(),
        unit: formState.unit.trim() || null,
        unitPrice: formState.unitPrice.trim() || null,
        quantity: formState.quantity.trim() || null,
        tone: formState.tone,
      }

      const response = await fetch('/api/value/boq-items', {
        method: formMode === 'create' ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          formMode === 'create'
            ? payload
            : {
                boqItemId: editingItem?.id,
                ...payload,
              },
        ),
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as { item?: BoqItemRecord; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.loadError)
      }
      setShowFormModal(false)
      resetForm(projectId)
      await loadBoqItems(projectId)
      addToast(copy.form.save, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSavingItem(false)
    }
  }

  const handleQuantityChange = (id: number, value: string) => {
    setBoqItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const nextTotal =
          item.tone === 'ITEM' ? computeTotalPrice(value, item.unitPrice) : item.totalPrice
        return {
          ...item,
          quantity: value,
          totalPrice: nextTotal,
        }
      }),
    )
  }

  const handleQuantityBlur = async (id: number) => {
    const target = boqItems.find((item) => item.id === id)
    if (!target || target.tone !== 'ITEM') return
    if (updatingQuantityId === id) return
    setUpdatingQuantityId(id)
    try {
      const response = await fetch('/api/value/boq-items', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boqItemId: target.id,
          quantity: target.quantity?.trim() || null,
          totalPrice: target.totalPrice?.trim() || null,
        }),
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as { item?: BoqItemRecord; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.loadError)
      }
      if (result.item) {
        const nextItem = result.item
        setBoqItems((prev) => prev.map((item) => (item.id === nextItem.id ? nextItem : item)))
      }
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setUpdatingQuantityId(null)
    }
  }

  const loadLetters = async (query: string) => {
    setLetters([])
    setLettersStatus('loading')
    setLettersError(null)
    try {
      const response = await fetch(`/api/value/boq-letters?${query}`, {
        credentials: 'include',
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { letters?: LetterRecord[]; message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? copy.messages.loadError)
      }
      setLetters(payload.letters ?? [])
      setLettersStatus('success')
    } catch (error) {
      setLettersStatus('error')
      setLettersError((error as Error).message)
    }
  }

  const openLetterModal = async (item: BoqItemRecord) => {
    setLetterScope('boq')
    setLetterItem(item)
    setLetterProjectId(String(item.projectId))
    setShowLetterModal(true)
    setLetterMode('create')
    setEditingLetterId(null)
    setLetterDraft({
      subject: '',
      senderOrg: '',
      recipientOrg: '',
      issuedAt: '',
      receivedAt: '',
      remark: '',
      status: 'DRAFT',
      boqItemId: String(item.id),
    })
    await loadLetters(`boqItemId=${item.id}`)
  }

  const handleLetterSave = async () => {
    if (!letterDraft.subject.trim()) {
      addToast(copy.letters.subject, { tone: 'warning' })
      return
    }
    if (letterMode === 'edit' && !editingLetterId) {
      addToast(copy.messages.loadError, { tone: 'danger' })
      return
    }
    if (letterScope === 'boq' && !letterItem) {
      addToast(copy.messages.loadError, { tone: 'danger' })
      return
    }
    const resolvedProjectId =
      letterScope === 'boq' ? letterItem?.projectId : Number(letterProjectId)
    if (!resolvedProjectId) {
      addToast(copy.messages.requiredProject, { tone: 'warning' })
      return
    }
    const resolvedBoqItemId =
      letterScope === 'boq'
        ? letterItem?.id ?? null
        : letterDraft.boqItemId
          ? Number(letterDraft.boqItemId)
          : null
    setSavingLetter(true)
    try {
      const payload = {
        projectId: resolvedProjectId,
        boqItemId: resolvedBoqItemId,
        subject: letterDraft.subject.trim(),
        senderOrg: letterDraft.senderOrg.trim() || null,
        recipientOrg: letterDraft.recipientOrg.trim() || null,
        issuedAt: letterDraft.issuedAt || null,
        receivedAt: letterDraft.receivedAt || null,
        remark: letterDraft.remark.trim() || null,
        status: letterDraft.status,
      }
      const response = await fetch(
        letterMode === 'create'
          ? '/api/value/boq-letters'
          : `/api/value/boq-letters/${editingLetterId}`,
        {
          method: letterMode === 'create' ? 'POST' : 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const result = (await response
        .json()
        .catch(() => ({}))) as { letter?: LetterRecord; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.loadError)
      }
      await loadLetters(
        letterScope === 'boq'
          ? `boqItemId=${letterItem?.id}`
          : `projectId=${resolvedProjectId}`,
      )
      await loadBoqItems(String(resolvedProjectId))
      addToast(copy.letters.save, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSavingLetter(false)
    }
  }

  const handleEditLetter = (letter: LetterRecord) => {
    setLetterMode('edit')
    setEditingLetterId(letter.id)
    setLetterDraft({
      subject: letter.subject ?? '',
      senderOrg: letter.senderOrg ?? '',
      recipientOrg: letter.recipientOrg ?? '',
      issuedAt: formatDateInput(letter.issuedAt),
      receivedAt: formatDateInput(letter.receivedAt),
      remark: letter.remark ?? '',
      status: letter.status ?? 'DRAFT',
      boqItemId: letter.boqItemId ? String(letter.boqItemId) : '',
    })
  }

  const handleArchiveLetter = async (letter: LetterRecord) => {
    if (!window.confirm(copy.messages.confirmArchiveLetter)) return
    try {
      const response = await fetch(`/api/value/boq-letters/${letter.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as { letter?: LetterRecord; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.loadError)
      }
      if (letterScope === 'boq' && letterItem) {
        await loadLetters(`boqItemId=${letterItem.id}`)
        await loadBoqItems(String(letterItem.projectId))
      } else if (letterProjectId) {
        await loadLetters(`projectId=${letterProjectId}`)
        await loadBoqItems(letterProjectId)
      }
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  const handleUploadLetterFile = async (letter: LetterRecord, file: File) => {
    if (!file) return
    setUploadingLetterId(letter.id)
    try {
      const uploadRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          category: 'letter-receipt',
        }),
      })
      const uploadPayload = (await uploadRes.json().catch(() => ({}))) as {
        uploadUrl?: string
        storageKey?: string
        requiredHeaders?: Record<string, string>
        error?: string
        message?: string
      }
      if (!uploadRes.ok || !uploadPayload.uploadUrl || !uploadPayload.storageKey) {
        throw new Error(uploadPayload.error ?? uploadPayload.message ?? copy.messages.loadError)
      }

      const putRes = await fetch(uploadPayload.uploadUrl, {
        method: 'PUT',
        headers: uploadPayload.requiredHeaders,
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(copy.messages.loadError)
      }

      const registerRes = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: uploadPayload.storageKey,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          category: 'letter-receipt',
          links: [
            {
              entityType: 'document',
              entityId: String(letter.documentId),
              purpose: 'letter-receipt',
              label: `函件${letter.letterNumber}`,
            },
          ],
        }),
      })
      const registerPayload = (await registerRes
        .json()
        .catch(() => ({}))) as { message?: string }
      if (!registerRes.ok) {
        throw new Error(registerPayload.message ?? copy.messages.loadError)
      }

      if (letterScope === 'boq' && letterItem) {
        await loadLetters(`boqItemId=${letterItem.id}`)
      } else if (letterProjectId) {
        await loadLetters(`projectId=${letterProjectId}`)
      }
      addToast(copy.letters.upload, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setUploadingLetterId(null)
    }
  }

  const boqRows = useMemo(() => {
    const sorted = [...boqItems].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    )
    return sorted.map((item) => {
      const designation = locale === 'fr' ? item.designationFr : item.designationZh
      const searchable = [item.code, item.designationZh, item.designationFr]
        .join(' ')
        .toLowerCase()
      return {
        ...item,
        designation,
        searchable,
      }
    })
  }, [boqItems, locale])

  const boqRowData = useMemo(
    () =>
      boqRows.map((row, index) => ({
        ...row,
        index,
        searchable: row.searchable ?? `${row.code} ${row.designation}`.toLowerCase(),
      })),
    [boqRows],
  )

  const totalsBySection = useMemo(() => {
    const map = new Map<number, number>()
    let grandTotal = 0
    boqRows.forEach((row) => {
      if (row.tone !== 'ITEM') return
      const computed = computeTotalPrice(row.quantity, row.unitPrice)
      const value = parseDecimalValue(computed ?? row.totalPrice)
      if (value === null) return
      grandTotal += value
      const sectionKey = resolveSectionKey(normalizeBoqCode(row.code))
      map.set(sectionKey, (map.get(sectionKey) ?? 0) + value)
    })
    return { map, grandTotal }
  }, [boqRows])

  const resolveRowTotalPrice = (row: BoqItemRecord) => {
    if (row.tone === 'ITEM') {
      return computeTotalPrice(row.quantity, row.unitPrice) ?? row.totalPrice
    }
    if (row.tone === 'SUBSECTION') {
      const sectionKey = resolveSectionKey(normalizeBoqCode(row.code))
      const sectionTotal = totalsBySection.map.get(sectionKey)
      return sectionTotal !== undefined ? sectionTotal.toFixed(2) : row.totalPrice
    }
    if (row.tone !== 'TOTAL') {
      return row.totalPrice
    }
    const code = normalizeBoqCode(row.code)
    if (isTotalHtvaCode(code)) {
      return Math.round(totalsBySection.grandTotal).toString()
    }
    if (isVatCode(code)) {
      return Math.round(totalsBySection.grandTotal * 0.18).toString()
    }
    if (isTotalWithTaxCode(code)) {
      return Math.round(totalsBySection.grandTotal * 1.18).toString()
    }
    const sectionKey = resolveSectionKey(code)
    const sectionTotal = totalsBySection.map.get(sectionKey)
    return sectionTotal !== undefined ? sectionTotal.toFixed(2) : row.totalPrice
  }

  const letterBoqOptions = useMemo(
    () => boqItems.filter((item) => item.tone === 'ITEM' && item.isActive),
    [boqItems],
  )

  const displayRows = useMemo(() => {
    if (!boqRowData.length) return []
    const tokens = normalizeSearchTokens(boqSearch)
    const summaryCodes = new Set([
      '0',
      '000',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      'TOTAL HTVA',
      'TVA',
      'TOTAL TTC',
    ])
    const baseRows =
      boqViewMode === 'summary'
        ? boqRowData.filter(
            (row) =>
              summaryCodes.has(row.code) && (row.tone === 'SUBSECTION' || row.tone === 'TOTAL'),
          )
        : boqRowData

    const visibleIndices = new Set<number>()
    if (tokens.length) {
      baseRows.forEach((row) => {
        const isMatch = tokens.every((token) => row.searchable.includes(token))
        if (!isMatch) return
        visibleIndices.add(row.index)
        if (boqViewMode !== 'summary') {
          for (let i = row.index - 1; i >= 0; i -= 1) {
            if (boqRowData[i]?.tone === 'SECTION') {
              visibleIndices.add(i)
              break
            }
          }
        }
      })
    } else {
      baseRows.forEach((row) => visibleIndices.add(row.index))
    }

    return boqRowData.filter((row) => visibleIndices.has(row.index))
  }, [boqRowData, boqSearch, boqViewMode])

  const isContractLocked = formMode === 'edit' && Boolean(editingItem?.contractItemId)
  const isQuantityDisabled = formState.tone !== 'ITEM'
  const canDragSort = sortEnabled && boqViewMode === 'full' && !boqSearch.trim()

  const persistSortOrder = async (orderedIds: number[]) => {
    if (!selectedProjectId) return
    setSavingSort(true)
    try {
      const response = await fetch('/api/value/boq-items/sort', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(selectedProjectId),
          orderedIds,
        }),
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as { items?: BoqItemRecord[]; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.messages.loadError)
      }
      if (result.items) {
        setBoqItems(result.items)
      }
      addToast(copy.messages.sortSaved, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSavingSort(false)
    }
  }

  const handleDragStart = (id: number) => {
    if (!canDragSort) return
    setDraggingId(id)
  }

  const handleDragOver = (event: DragEvent<HTMLTableRowElement>, id: number) => {
    if (!canDragSort || draggingId === null || draggingId === id) return
    event.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = async (id: number) => {
    if (!canDragSort || draggingId === null || draggingId === id) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    const ordered = [...boqRowData]
    const fromIndex = ordered.findIndex((row) => row.id === draggingId)
    const toIndex = ordered.findIndex((row) => row.id === id)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    const updated = ordered.map((row, index) => ({
      ...row,
      sortOrder: (index + 1) * 10,
    }))
    setBoqItems(updated)
    setDraggingId(null)
    setDragOverId(null)
    await persistSortOrder(updated.map((row) => row.id))
  }

  if (permissionDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['value:view']}
        hint={unauthorizedMessage}
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
                { label: copy.breadcrumbs.home, href: '/' },
                { label: copy.breadcrumbs.value, href: '/value' },
                { label: copy.breadcrumbs.boq, href: '/value?tab=boq' },
                { label: copy.title },
              ]}
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{copy.title}</h1>
              <p className="text-sm text-slate-600">{copy.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              {[
                { key: 'production', label: tabCopy.tabs.production, href: '/value' },
                { key: 'completion', label: tabCopy.tabs.completion, href: '/value?tab=completion' },
                { key: 'boq', label: tabCopy.tabs.boq, href: '/value?tab=boq' },
                { key: 'manage', label: tabCopy.tabs.manage, href: '/value/prices' },
              ].map((tab) => {
                const isActive = tab.key === 'boq'
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold text-slate-700">
                <span className="mb-1 block">{copy.form.project}</span>
                <select
                  className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {!boqProjects.length ? <option value="">{copy.form.project}</option> : null}
                  {boqProjects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                <span className="mb-1 block">{copy.actions.searchLabel}</span>
                <input
                  type="search"
                  className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={boqSearch}
                  onChange={(event) => setBoqSearch(event.target.value)}
                  placeholder={copy.actions.searchPlaceholder}
                />
              </label>
              <div className="text-sm font-semibold text-slate-700">
                <span className="mb-1 block">{copy.actions.viewLabel}</span>
                <div className="flex items-center rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setBoqViewMode('full')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      boqViewMode === 'full'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    {copy.actions.viewAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoqViewMode('summary')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      boqViewMode === 'summary'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    {copy.actions.viewSummary}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`inline-flex items-center rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                  sortEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
                onClick={() => setSortEnabled((prev) => !prev)}
                disabled={savingSort}
              >
                {copy.actions.sortToggle}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5"
                onClick={openCreateModal}
              >
                {copy.actions.newItem}
              </button>
              <Link
                href="/value?tab=boq"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                {copy.actions.back}
              </Link>
            </div>
          </div>

          <div className="mt-4 space-y-1 text-xs text-slate-500">
            {boqProjectsStatus === 'loading' && <p>{copy.messages.loading}</p>}
            {boqProjectsStatus === 'error' && (
              <p className="text-rose-600">{boqProjectsError ?? copy.messages.loadError}</p>
            )}
            {boqItemsStatus === 'loading' && <p>{copy.messages.loading}</p>}
            {boqItemsStatus === 'error' && (
              <p className="text-rose-600">{boqItemsError ?? copy.messages.loadError}</p>
            )}
          </div>

          {displayRows.length ? (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100/70">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="w-[8%] px-3 py-3 text-left">{copy.tableHeaders.code}</th>
                    <th className="px-3 py-3 text-left">{copy.tableHeaders.designation}</th>
                    <th className="w-[8%] px-3 py-3 text-left">{copy.tableHeaders.unit}</th>
                    <th className="w-[12%] px-3 py-3 text-right">{copy.tableHeaders.unitPrice}</th>
                    <th className="w-[10%] px-3 py-3 text-right">{copy.tableHeaders.quantity}</th>
                    <th className="w-[12%] px-3 py-3 text-right">{copy.tableHeaders.totalPrice}</th>
                  </tr>
	                </thead>
	                <tbody className="divide-y divide-slate-200/70">
	                  {displayRows.map((row) => {
	                    const normalizedCode = normalizeBoqCode(row.code)
	                    const displayOnly =
	                      row.tone === 'SECTION' ||
	                      (row.tone === 'SUBSECTION' &&
	                        !isMajorSubsectionCode(normalizedCode) &&
	                        !isVatCode(normalizedCode))
	                    return (
	                      <tr
	                        key={row.id}
	                        draggable={canDragSort}
	                        onDragStart={() => handleDragStart(row.id)}
	                        onDragOver={(event) => handleDragOver(event, row.id)}
	                        onDrop={() => handleDrop(row.id)}
	                        onDragEnd={() => {
	                          setDraggingId(null)
	                          setDragOverId(null)
	                        }}
	                        onClick={() => openEditModal(row)}
	                        className={`transition ${
	                          row.tone === 'ITEM' ? 'hover:bg-slate-50' : ''
	                        } ${boqRowToneStyles[row.tone]} ${
	                          draggingId === row.id
	                            ? 'opacity-60'
	                            : dragOverId === row.id
	                              ? 'ring-2 ring-emerald-200'
	                              : ''
	                        }`}
	                      >
	                        <td className="whitespace-nowrap px-3 py-3 text-xs tracking-[0.2em]">
	                          {row.code}
	                        </td>
	                        <td className="whitespace-pre-line px-3 py-3 leading-relaxed">
	                          <div className="text-sm">{row.designation}</div>
	                        </td>
	                        <td className="whitespace-nowrap px-3 py-3">
	                          {formatBoqCell(displayOnly ? null : row.unit)}
	                        </td>
	                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
	                          {formatBoqCell(displayOnly ? null : row.unitPrice, localeId)}
	                        </td>
	                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
	                          {formatBoqCell(displayOnly ? null : row.quantity, localeId)}
	                        </td>
	                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
	                          {formatBoqCell(
	                            displayOnly ? null : resolveRowTotalPrice(row),
	                            localeId,
	                          )}
	                        </td>
	                      </tr>
	                    )
	                  })}
	                </tbody>
	              </table>
	            </div>
	          ) : (
            <p className="mt-4 text-sm text-slate-500">{copy.messages.empty}</p>
          )}
          <div className="mt-4 text-xs text-slate-500">{copy.actions.sortHint}</div>
        </div>
      </section>

      {showFormModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {formMode === 'create' ? copy.form.createTitle : copy.form.editTitle}
              </h2>
              <div className="flex items-center gap-2">
                {formMode === 'edit' && editingItem && editingItem.tone === 'ITEM' ? (
                  <button
                    type="button"
                    className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => openLetterModal(editingItem)}
                  >
                    {copy.letters.title}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                  onClick={() => setShowFormModal(false)}
                >
                  {copy.form.cancel}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.project}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.projectId}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, projectId: event.target.value }))
                  }
                  disabled={isContractLocked}
                >
                  {boqProjects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.code}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.code}
                  onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
                  disabled={isContractLocked}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.designationZh}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.designationZh}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, designationZh: event.target.value }))
                  }
                  disabled={isContractLocked}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.designationFr}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.designationFr}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, designationFr: event.target.value }))
                  }
                  disabled={isContractLocked}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.unit}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.unit}
                  onChange={(event) => setFormState((prev) => ({ ...prev, unit: event.target.value }))}
                  disabled={isContractLocked}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.unitPrice}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.unitPrice}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, unitPrice: event.target.value }))
                  }
                  disabled={isContractLocked}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.quantity}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.quantity}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  disabled={isQuantityDisabled}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.form.tone}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={formState.tone}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, tone: event.target.value as BoqItemTone }))
                  }
                  disabled={isContractLocked}
                >
                  {(['SECTION', 'SUBSECTION', 'ITEM', 'TOTAL'] as BoqItemTone[]).map((tone) => (
                    <option key={tone} value={tone}>
                      {copy.tone[tone]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:bg-white"
                onClick={() => setShowFormModal(false)}
                disabled={savingItem}
              >
                {copy.form.cancel}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSaveItem}
                disabled={savingItem}
              >
                {savingItem ? copy.messages.saving : copy.form.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLetterModal && letterItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{copy.letters.title}</h2>
                <p className="text-xs text-slate-500">
                  {letterScope === 'boq' && letterItem
                    ? `${letterItem.code} · ${
                        letterItem.designation ??
                        (locale === 'fr'
                          ? letterItem.designationFr
                          : letterItem.designationZh)
                      }`
                    : selectedProject?.name ?? '—'}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                onClick={() => setShowLetterModal(false)}
              >
                {copy.letters.cancel}
              </button>
            </div>

            <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.subject}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.subject}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, subject: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.senderOrg}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.senderOrg}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, senderOrg: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.recipientOrg}
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.recipientOrg}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, recipientOrg: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.binding}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                  value={letterDraft.boqItemId}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, boqItemId: event.target.value }))
                  }
                  disabled={letterScope === 'boq'}
                >
                  {letterScope === 'project' ? (
                    <option value="">{copy.letters.unbound}</option>
                  ) : null}
                  {letterScope === 'boq' && letterItem ? (
                    <option value={String(letterItem.id)}>
                      {letterItem.code} ·{' '}
                      {letterItem.designation ??
                        (locale === 'fr'
                          ? letterItem.designationFr
                          : letterItem.designationZh)}
                    </option>
                  ) : null}
                  {letterScope === 'project'
                    ? letterBoqOptions.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.code} ·{' '}
                          {locale === 'fr' ? item.designationFr : item.designationZh}
                        </option>
                      ))
                    : null}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.issuedAt}
                <input
                  type="date"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.issuedAt}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, issuedAt: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.receivedAt}
                <input
                  type="date"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.receivedAt}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, receivedAt: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {copy.letters.status}
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={letterDraft.status}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({
                      ...prev,
                      status: event.target.value as LetterFormState['status'],
                    }))
                  }
                >
                  <option value="DRAFT">{copy.status.draft}</option>
                  <option value="FINAL">{copy.status.final}</option>
                  <option value="ARCHIVED">{copy.status.archived}</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500 sm:col-span-3">
                {copy.letters.remark}
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  rows={2}
                  value={letterDraft.remark}
                  onChange={(event) =>
                    setLetterDraft((prev) => ({ ...prev, remark: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:-translate-y-0.5 hover:bg-white"
                onClick={() => {
                  setLetterMode('create')
                  setEditingLetterId(null)
                  setLetterDraft({
                    subject: '',
                    senderOrg: '',
                    recipientOrg: '',
                    issuedAt: '',
                    receivedAt: '',
                    remark: '',
                    status: 'DRAFT',
                    boqItemId: letterScope === 'boq' && letterItem ? String(letterItem.id) : '',
                  })
                }}
                disabled={savingLetter}
              >
                {copy.letters.new}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleLetterSave}
                disabled={savingLetter}
              >
                {savingLetter ? copy.messages.saving : copy.letters.save}
              </button>
            </div>

            <div className="mt-6">
              {lettersStatus === 'loading' && (
                <p className="text-xs text-slate-500">{copy.messages.loading}</p>
              )}
              {lettersStatus === 'error' && (
                <p className="text-xs text-rose-600">{lettersError ?? copy.messages.loadError}</p>
              )}
              {lettersStatus === 'success' && !letters.length ? (
                <p className="text-xs text-slate-500">{copy.letters.empty}</p>
              ) : null}
            </div>

            {letters.length ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100/70">
                    <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="w-[8%] px-3 py-3 text-left">{copy.letters.number}</th>
                      <th className="w-[16%] px-3 py-3 text-left">{copy.letters.code}</th>
                      <th className="px-3 py-3 text-left">{copy.letters.subject}</th>
                      {letterScope === 'project' ? (
                        <th className="w-[18%] px-3 py-3 text-left">{copy.letters.binding}</th>
                      ) : null}
                      <th className="w-[10%] px-3 py-3 text-left">{copy.letters.status}</th>
                      <th className="w-[10%] px-3 py-3 text-left">{copy.letters.attachments}</th>
                      <th className="w-[16%] px-3 py-3 text-left">{copy.letters.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {letters.map((letter) => (
                      <tr key={letter.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold">
                          {letter.letterNumber}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                          {letter.documentCode}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-800">{letter.subject}</td>
                        {letterScope === 'project' ? (
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {letter.boqItemCode
                              ? `${letter.boqItemCode} · ${
                                  locale === 'fr'
                                    ? letter.boqItemDesignationFr ?? ''
                                    : letter.boqItemDesignationZh ?? ''
                                }`
                              : '—'}
                          </td>
                        ) : null}
                        <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                          {letter.status === 'FINAL'
                            ? copy.status.final
                            : letter.status === 'ARCHIVED'
                            ? copy.status.archived
                            : copy.status.draft}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {letter.attachmentCount}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => handleEditLetter(letter)}
                            >
                              {copy.letters.edit}
                            </button>
                            <label className="cursor-pointer rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50">
                              {uploadingLetterId === letter.id ? copy.messages.saving : copy.letters.upload}
                              <input
                                type="file"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  if (file) {
                                    handleUploadLetterFile(letter, file)
                                  }
                                  event.target.value = ''
                                }}
                              />
                            </label>
                            {letter.status !== 'ARCHIVED' ? (
                              <button
                                type="button"
                                className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                                onClick={() => handleArchiveLetter(letter)}
                              >
                                {copy.letters.archive}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
