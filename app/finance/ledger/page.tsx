'use client'

import { FinanceLedgerCaseStatus, FinanceLedgerStage } from '@prisma/client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import {
  DEFAULT_FINANCE_LEDGER_SORT_STACK,
  FINANCE_LEDGER_STAGES,
  type FinanceLedgerSortField,
  type FinanceLedgerSortSpec,
} from '@/lib/finance/ledgerConstants'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type LedgerProject = {
  id: number
  name: string
  code: string | null
}

type LedgerSection = {
  id: number
  projectId: number | null
  slug: string
  name: string
  labels: { zh: string; fr: string }
  startPk: string
  endPk: string
}

type LedgerEvent = {
  id: number
  caseId: number
  stage: FinanceLedgerStage
  occurredAt: string
  note: string | null
  payload: Record<string, unknown>
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
}

type LedgerCase = {
  id: number
  sequence: number
  projectId: number
  projectName: string
  projectCode: string | null
  sectionId: number | null
  sectionName: string | null
  sectionSlug: string | null
  sectionLabelFr: string | null
  periodIndex: number
  status: FinanceLedgerCaseStatus
  currentStage: FinanceLedgerStage | null
  nextStage: FinanceLedgerStage | null
  enteredCurrentStageAt: string | null
  accountAmount: number | null
  invoiceAmount: number | null
  advanceAmount: number | null
  chequeAmount: number | null
  invoiceNumber: string | null
  receiptChequeNumber: string | null
  remark: string | null
  waitingDays: number
  overdueDays: number
  isOverdue: boolean
  cycleDays: number | null
  stageDates: Record<FinanceLedgerStage, string | null>
  events: LedgerEvent[]
  createdAt: string
  updatedAt: string
}

type LedgerInsights = {
  summary: {
    caseCount: number
    totalAccountAmount: number
    totalInvoiceAmount: number
    totalChequeAmount: number
    receiptRate: number
    averageCycleDays: number
    overdueCount: number
  }
  stageFunnel: {
    stage: FinanceLedgerStage
    count: number
    amount: number
  }[]
  projectProgress: {
    projectId: number
    projectName: string
    projectCode: string | null
    stageCounts: { stage: FinanceLedgerStage; count: number; amount: number }[]
  }[]
  monthlyFlow: {
    month: string
    invoiceAmount: number
    chequeAmount: number
    cumulativeInvoiceAmount: number
    cumulativeChequeAmount: number
  }[]
  agingBuckets: {
    bucket: '0-7' | '8-15' | '16-30' | '31-60' | '60+'
    count: number
    amount: number
  }[]
  transitionStats: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
  bottlenecks: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
}

type LedgerMetadata = {
  projects: LedgerProject[]
  sections: LedgerSection[]
  stages: FinanceLedgerStage[]
  statuses: FinanceLedgerCaseStatus[]
}

type LedgerFilters = {
  projectId: string
  sectionId: string
  status: 'all' | FinanceLedgerCaseStatus
  stage: 'all' | FinanceLedgerStage
  overdue: 'all' | 'true' | 'false'
  search: string
  page: number
  pageSize: number
  sortStack: FinanceLedgerSortSpec[]
}

type LedgerCreateForm = {
  projectId: string
  periodIndex: string
  sectionId: string
}

type LedgerCaseForm = {
  sectionId: string
  status: FinanceLedgerCaseStatus
  accountAmount: string
  invoiceAmount: string
  advanceAmount: string
  chequeAmount: string
  invoiceNumber: string
  receiptChequeNumber: string
  remark: string
}

type LedgerEventForm = {
  stage: FinanceLedgerStage
  occurredAt: string
  note: string
  accountAmount: string
  invoiceAmount: string
  advanceAmount: string
  chequeAmount: string
  invoiceNumber: string
  receiptChequeNumber: string
  remark: string
}

type PageTab = 'liste' | 'progression' | 'delais'

const pageSizeOptions = [10, 20, 50, 100]

const containsCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const frProjectNameByCode: Record<string, string> = {
  'project-bondoukou-city': 'Projet municipal de Bondoukou',
  'project-bondoukou-border': 'Projet frontalier de Bondoukou',
  'project-bondoukou-supply': "Projet d'approvisionnement de Bondoukou",
  'project-tanda-city': 'Projet municipal de Tanda',
  'project-anibilekrou-city': "Projet municipal d'Agnibilékrou",
  'project-abidjan-office': "Bureau d'Abidjan",
}

const stageLabels: Record<Locale, Record<FinanceLedgerStage, string>> = {
  fr: {
    SITE_SIGNED: 'Signature site PTO',
    HQ_BILL_RECEIVED: 'Réception décompte siège',
    BE_CONFIRMED: 'BE confirmé',
    BE_DELIVERED: 'BE transmis',
    HQ_INVOICE_RECEIVED: 'Réception facture siège',
    CHEQUE_ISSUED: 'Chèque émis',
    CHEQUE_RECEIVED: 'Chèque reçu',
  },
  zh: {
    SITE_SIGNED: 'PTO 现场签字',
    HQ_BILL_RECEIVED: '总部收到账单',
    BE_CONFIRMED: 'BE 确认',
    BE_DELIVERED: 'BE 送达',
    HQ_INVOICE_RECEIVED: '总部收票',
    CHEQUE_ISSUED: '支票开具',
    CHEQUE_RECEIVED: '支票收款',
  },
}

const statusLabels: Record<Locale, Record<FinanceLedgerCaseStatus, string>> = {
  fr: {
    IN_PROGRESS: 'En cours',
    DONE: 'Terminé',
    BLOCKED: 'Bloqué',
  },
  zh: {
    IN_PROGRESS: '进行中',
    DONE: '已完成',
    BLOCKED: '阻塞',
  },
}

const stageTone: Record<FinanceLedgerCaseStatus, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  BLOCKED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
}

const formatDateInput = (value: string | null) => (value ? value.split('T')[0] : '')

const formatNumber = (value: number | null | undefined, locale: Locale) => {
  if (value == null || !Number.isFinite(value)) return '—'
  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  return new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(value)
}

const parseMaybeNumber = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

const toInputNumberOrNull = (value: string) => {
  const parsed = parseMaybeNumber(value)
  if (parsed === undefined) return null
  if (!Number.isFinite(parsed)) return NaN
  return parsed
}

const resolveProjectName = (project: LedgerProject, locale: Locale) => {
  if (locale !== 'fr') return project.name
  if (project.code && frProjectNameByCode[project.code]) return frProjectNameByCode[project.code]
  if (!containsCjk(project.name)) return project.name
  if (project.code) return humanizeIdentifier(project.code)
  return `Projet #${project.id}`
}

const resolveCaseProjectName = (item: LedgerCase, locale: Locale) => {
  if (locale !== 'fr') return item.projectName
  if (item.projectCode && frProjectNameByCode[item.projectCode]) return frProjectNameByCode[item.projectCode]
  if (!containsCjk(item.projectName)) return item.projectName
  if (item.projectCode) return humanizeIdentifier(item.projectCode)
  return `Projet #${item.projectId}`
}

const resolveSectionName = (section: LedgerSection, locale: Locale) => {
  if (locale === 'fr') return section.labels.fr || section.name
  return section.labels.zh || section.name
}

const resolveCaseSectionName = (item: LedgerCase, locale: Locale) => {
  if (locale === 'fr') return item.sectionLabelFr || item.sectionName || '—'
  return item.sectionName || '—'
}

const defaultCreateForm: LedgerCreateForm = {
  projectId: '',
  periodIndex: '',
  sectionId: '',
}

const defaultCaseForm: LedgerCaseForm = {
  sectionId: '',
  status: 'IN_PROGRESS',
  accountAmount: '',
  invoiceAmount: '',
  advanceAmount: '',
  chequeAmount: '',
  invoiceNumber: '',
  receiptChequeNumber: '',
  remark: '',
}

const defaultEventForm = (stage: FinanceLedgerStage): LedgerEventForm => ({
  stage,
  occurredAt: formatDateInput(new Date().toISOString()),
  note: '',
  accountAmount: '',
  invoiceAmount: '',
  advanceAmount: '',
  chequeAmount: '',
  invoiceNumber: '',
  receiptChequeNumber: '',
  remark: '',
})

const defaultFilters: LedgerFilters = {
  projectId: 'all',
  sectionId: 'all',
  status: 'all',
  stage: 'all',
  overdue: 'all',
  search: '',
  page: 1,
  pageSize: 20,
  sortStack: DEFAULT_FINANCE_LEDGER_SORT_STACK,
}

export default function FinanceLedgerPage() {
  const { locale, setLocale } = usePreferredLocale('fr', locales)
  const { addToast } = useToast()

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [metadata, setMetadata] = useState<LedgerMetadata | null>(null)
  const [cases, setCases] = useState<LedgerCase[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [filters, setFilters] = useState<LedgerFilters>(defaultFilters)
  const [filterDraft, setFilterDraft] = useState<LedgerFilters>(defaultFilters)
  const [activeTab, setActiveTab] = useState<PageTab>('liste')
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<LedgerInsights | null>(null)
  const [stickyTop, setStickyTop] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState<LedgerCreateForm>(defaultCreateForm)

  const [editingCase, setEditingCase] = useState<LedgerCase | null>(null)
  const [caseSaving, setCaseSaving] = useState(false)
  const [caseForm, setCaseForm] = useState<LedgerCaseForm>(defaultCaseForm)

  const [detailCase, setDetailCase] = useState<LedgerCase | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LedgerEvent | null>(null)
  const [eventForm, setEventForm] = useState<LedgerEventForm>(defaultEventForm('SITE_SIGNED'))
  const [eventSaving, setEventSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const canView = session?.permissions.includes('finance:view') ?? false
  const canEdit = session?.permissions.includes('finance:edit') ?? false

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = (await res.json()) as { user?: SessionUser | null }
      setSession(data.user ?? null)
    } catch {
      setSession(null)
    } finally {
      setAuthLoaded(true)
    }
  }, [])

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/ledger/metadata', { credentials: 'include' })
      const data = (await res.json()) as LedgerMetadata & { message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? 'Impossible de charger les métadonnées')
      }
      setMetadata(data)
      if (data.projects.length && !createForm.projectId) {
        setCreateForm((prev) => ({ ...prev, projectId: String(data.projects[0].id) }))
      }
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [createForm.projectId])

  const buildQuery = useCallback((source: LedgerFilters) => {
    const query = new URLSearchParams()
    if (source.projectId !== 'all') query.append('projectId', source.projectId)
    if (source.sectionId !== 'all') query.append('sectionId', source.sectionId)
    if (source.status !== 'all') query.append('status', source.status)
    if (source.stage !== 'all') query.append('stage', source.stage)
    if (source.overdue !== 'all') query.append('overdue', source.overdue)
    if (source.search.trim()) query.append('search', source.search.trim())
    query.append('page', String(source.page))
    query.append('pageSize', String(source.pageSize))
    source.sortStack.forEach((sort) => query.append('sort', `${sort.field}:${sort.order}`))
    return query
  }, [])

  const fetchCases = useCallback(
    async (source: LedgerFilters) => {
      setLoading(true)
      try {
        const query = buildQuery(source)
        const res = await fetch(`/api/finance/ledger/cases?${query.toString()}`, {
          credentials: 'include',
        })
        const data = (await res.json()) as {
          cases?: LedgerCase[]
          total?: number
          message?: string
        }
        if (!res.ok) {
          throw new Error(data.message ?? 'Impossible de charger la liste')
        }
        setCases(data.cases ?? [])
        setTotalCases(data.total ?? 0)
      } catch (error) {
        setCases([])
        setTotalCases(0)
        setMessage((error as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [buildQuery],
  )

  const fetchInsights = useCallback(
    async (source: LedgerFilters) => {
      setInsightsLoading(true)
      try {
        const query = buildQuery({
          ...source,
          page: 1,
          pageSize: 200,
        })
        const res = await fetch(`/api/finance/ledger/insights?${query.toString()}`, {
          credentials: 'include',
        })
        const data = (await res.json()) as { insights?: LedgerInsights; message?: string }
        if (!res.ok) {
          throw new Error(data.message ?? 'Impossible de charger les analyses')
        }
        setInsights(data.insights ?? null)
      } catch (error) {
        setInsights(null)
        setMessage((error as Error).message)
      } finally {
        setInsightsLoading(false)
      }
    },
    [buildQuery],
  )

  const loadCaseDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${id}`, {
        credentials: 'include',
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? 'Impossible de charger le dossier')
      }
      setDetailCase(data.case ?? null)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDetailLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (!canView) return
    void fetchMetadata()
  }, [canView, fetchMetadata])

  useEffect(() => {
    if (!canView) return
    void fetchCases(filters)
    void fetchInsights(filters)
  }, [canView, filters, fetchCases, fetchInsights])

  useEffect(() => {
    const header = document.querySelector('header.finance-ledger-header') as HTMLElement | null
    if (!header) {
      setStickyTop(0)
      return
    }
    const resolve = () => setStickyTop(Math.ceil(header.getBoundingClientRect().height))
    resolve()
    const observer = new ResizeObserver(resolve)
    observer.observe(header)
    window.addEventListener('resize', resolve)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resolve)
    }
  }, [locale])

  const filteredSections = useMemo(() => {
    if (!metadata?.sections) return []
    if (filterDraft.projectId === 'all') return metadata.sections
    return metadata.sections.filter((section) => String(section.projectId) === filterDraft.projectId)
  }, [filterDraft.projectId, metadata?.sections])

  const createSections = useMemo(() => {
    if (!metadata?.sections || !createForm.projectId) return []
    return metadata.sections.filter((section) => String(section.projectId) === createForm.projectId)
  }, [createForm.projectId, metadata?.sections])

  const detailEventsByStage = useMemo(() => {
    const map = new Map<FinanceLedgerStage, LedgerEvent>()
    detailCase?.events.forEach((event) => map.set(event.stage, event))
    return map
  }, [detailCase?.events])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCases / Math.max(filters.pageSize, 1))),
    [filters.pageSize, totalCases],
  )

  const handleSort = (field: FinanceLedgerSortField) => {
    setFilters((prev) => {
      const existing = prev.sortStack.find((item) => item.field === field)
      const nextOrder: FinanceLedgerSortSpec['order'] = existing?.order === 'asc' ? 'desc' : 'asc'
      const filtered = prev.sortStack.filter((item) => item.field !== field)
      const nextStack: FinanceLedgerSortSpec[] = [{ field, order: nextOrder }, ...filtered].slice(0, 4)
      return { ...prev, sortStack: nextStack, page: 1 }
    })
  }

  const sortIndicator = (field: FinanceLedgerSortField) => {
    const index = filters.sortStack.findIndex((item) => item.field === field)
    if (index < 0) return '↕'
    const arrow = filters.sortStack[index].order === 'asc' ? '↑' : '↓'
    return `${arrow}${index + 1}`
  }

  const sortAria = (field: FinanceLedgerSortField): 'none' | 'ascending' | 'descending' | 'other' => {
    const index = filters.sortStack.findIndex((item) => item.field === field)
    if (index < 0) return 'none'
    if (index > 0) return 'other'
    return filters.sortStack[index].order === 'asc' ? 'ascending' : 'descending'
  }

  const openCreateModal = () => {
    if (!metadata?.projects.length) return
    setCreateForm({
      projectId: String(metadata.projects[0].id),
      periodIndex: '',
      sectionId: '',
    })
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!createForm.projectId || !createForm.periodIndex.trim()) {
      addToast(locale === 'fr' ? 'Projet et période obligatoires' : '项目和期数必填', { tone: 'warning' })
      return
    }
    const periodIndex = Number(createForm.periodIndex)
    if (!Number.isInteger(periodIndex) || periodIndex < 0) {
      addToast(locale === 'fr' ? 'Période invalide' : '期数无效', { tone: 'warning' })
      return
    }

    setCreateSaving(true)
    try {
      const res = await fetch('/api/finance/ledger/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: Number(createForm.projectId),
          periodIndex,
          sectionId: createForm.sectionId ? Number(createForm.sectionId) : null,
        }),
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Création impossible')
      addToast(locale === 'fr' ? 'Dossier créé' : '台账已创建', { tone: 'success' })
      setShowCreateModal(false)
      await fetchCases(filters)
      await fetchInsights(filters)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setCreateSaving(false)
    }
  }

  const openEditCaseModal = (item: LedgerCase) => {
    setEditingCase(item)
    setCaseForm({
      sectionId: item.sectionId ? String(item.sectionId) : '',
      status: item.status,
      accountAmount: item.accountAmount == null ? '' : String(item.accountAmount),
      invoiceAmount: item.invoiceAmount == null ? '' : String(item.invoiceAmount),
      advanceAmount: item.advanceAmount == null ? '' : String(item.advanceAmount),
      chequeAmount: item.chequeAmount == null ? '' : String(item.chequeAmount),
      invoiceNumber: item.invoiceNumber ?? '',
      receiptChequeNumber: item.receiptChequeNumber ?? '',
      remark: item.remark ?? '',
    })
  }

  const handleUpdateCase = async () => {
    if (!editingCase) return
    const accountAmount = toInputNumberOrNull(caseForm.accountAmount)
    const invoiceAmount = toInputNumberOrNull(caseForm.invoiceAmount)
    const advanceAmount = toInputNumberOrNull(caseForm.advanceAmount)
    const chequeAmount = toInputNumberOrNull(caseForm.chequeAmount)
    if ([accountAmount, invoiceAmount, advanceAmount, chequeAmount].some((item) => Number.isNaN(item))) {
      addToast(locale === 'fr' ? 'Montant invalide' : '金额格式错误', { tone: 'warning' })
      return
    }

    setCaseSaving(true)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${editingCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sectionId: caseForm.sectionId ? Number(caseForm.sectionId) : null,
          status: caseForm.status,
          accountAmount,
          invoiceAmount,
          advanceAmount,
          chequeAmount,
          invoiceNumber: caseForm.invoiceNumber || null,
          receiptChequeNumber: caseForm.receiptChequeNumber || null,
          remark: caseForm.remark || null,
        }),
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Mise à jour impossible')
      addToast(locale === 'fr' ? 'Dossier mis à jour' : '台账已更新', { tone: 'success' })
      setEditingCase(null)
      await fetchCases(filters)
      await fetchInsights(filters)
      if (detailCase?.id === editingCase.id) {
        await loadCaseDetail(editingCase.id)
      }
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setCaseSaving(false)
    }
  }

  const handleDeleteCase = async (item: LedgerCase) => {
    const confirmed = window.confirm(
      locale === 'fr'
        ? `Supprimer le dossier #${item.sequence} ?`
        : `确认删除台账 #${item.sequence} 吗？`,
    )
    if (!confirmed) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Suppression impossible')
      addToast(locale === 'fr' ? 'Dossier supprimé' : '台账已删除', { tone: 'success' })
      if (detailCase?.id === item.id) {
        setDetailCase(null)
      }
      await fetchCases(filters)
      await fetchInsights(filters)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDeletingId(null)
    }
  }

  const openCreateEventModal = (stage: FinanceLedgerStage) => {
    setEditingEvent(null)
    setEventForm(defaultEventForm(stage))
    setShowEventModal(true)
  }

  const openEditEventModal = (event: LedgerEvent) => {
    setEditingEvent(event)
    setEventForm({
      stage: event.stage,
      occurredAt: formatDateInput(event.occurredAt),
      note: event.note ?? '',
      accountAmount:
        event.payload.accountAmount == null ? '' : String(event.payload.accountAmount),
      invoiceAmount:
        event.payload.invoiceAmount == null ? '' : String(event.payload.invoiceAmount),
      advanceAmount:
        event.payload.advanceAmount == null ? '' : String(event.payload.advanceAmount),
      chequeAmount:
        event.payload.chequeAmount == null ? '' : String(event.payload.chequeAmount),
      invoiceNumber:
        event.payload.invoiceNumber == null ? '' : String(event.payload.invoiceNumber),
      receiptChequeNumber:
        event.payload.receiptChequeNumber == null ? '' : String(event.payload.receiptChequeNumber),
      remark: event.payload.remark == null ? '' : String(event.payload.remark),
    })
    setShowEventModal(true)
  }

  const handleSaveEvent = async () => {
    if (!detailCase) return
    if (!eventForm.occurredAt) {
      addToast(locale === 'fr' ? 'Date obligatoire' : '日期必填', { tone: 'warning' })
      return
    }
    const accountAmount = toInputNumberOrNull(eventForm.accountAmount)
    const invoiceAmount = toInputNumberOrNull(eventForm.invoiceAmount)
    const advanceAmount = toInputNumberOrNull(eventForm.advanceAmount)
    const chequeAmount = toInputNumberOrNull(eventForm.chequeAmount)
    if ([accountAmount, invoiceAmount, advanceAmount, chequeAmount].some((item) => Number.isNaN(item))) {
      addToast(locale === 'fr' ? 'Montant invalide' : '金额格式错误', { tone: 'warning' })
      return
    }

    setEventSaving(true)
    try {
      const payload = {
        stage: eventForm.stage,
        occurredAt: eventForm.occurredAt,
        note: eventForm.note || null,
        accountAmount,
        invoiceAmount,
        advanceAmount,
        chequeAmount,
        invoiceNumber: eventForm.invoiceNumber || null,
        receiptChequeNumber: eventForm.receiptChequeNumber || null,
        remark: eventForm.remark || null,
      }

      const res = await fetch(
        editingEvent
          ? `/api/finance/ledger/events/${editingEvent.id}`
          : `/api/finance/ledger/cases/${detailCase.id}/events`,
        {
          method: editingEvent ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
      )
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Échec enregistrement étape')
      addToast(locale === 'fr' ? 'Étape enregistrée' : '阶段已保存', { tone: 'success' })
      setShowEventModal(false)
      setEditingEvent(null)
      await fetchCases(filters)
      await fetchInsights(filters)
      await loadCaseDetail(detailCase.id)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setEventSaving(false)
    }
  }

  const applyFilters = () => {
    setFilters((prev) => ({ ...filterDraft, page: 1, pageSize: prev.pageSize }))
  }

  const clearFilters = () => {
    setFilterDraft(defaultFilters)
    setFilters(defaultFilters)
  }

  const changePage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages)
    setFilters((prev) => ({ ...prev, page: next }))
  }

  const changePageSize = (size: number) => {
    setFilters((prev) => ({ ...prev, pageSize: size, page: 1 }))
    setFilterDraft((prev) => ({ ...prev, pageSize: size, page: 1 }))
  }

  const tabs = [
    {
      key: 'entries',
      label: 'Entrées',
      href: '/finance',
      active: false,
    },
    {
      key: 'ledger',
      label: 'Tableau de suivi',
      href: '/finance/ledger',
      active: true,
    },
  ]

  if (authLoaded && !canView) {
    return <AccessDenied permissions={['finance:view']} hint="Veuillez demander la permission finance:view." />
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="finance-ledger-header z-30 py-4"
        breadcrumbs={[
          { label: locale === 'fr' ? 'Accueil' : '首页', href: '/' },
          { label: 'Finance', href: '/finance' },
          { label: 'Tableau de suivi' },
        ]}
        title="Tableau de suivi des factures et encaissements"
        subtitle={
          locale === 'fr'
            ? 'Créer un dossier unique par projet+période, puis renseigner les étapes au fil du temps.'
            : '按“项目+期数”建立唯一台账，并按阶段补录信息。'
        }
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
      />

      <section className="mx-auto w-full max-w-[1700px] space-y-4 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('liste')}
                className={`rounded-md px-3 py-1.5 ${activeTab === 'liste' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('progression')}
                className={`rounded-md px-3 py-1.5 ${
                  activeTab === 'progression' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                Progression
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delais')}
                className={`rounded-md px-3 py-1.5 ${activeTab === 'delais' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
              >
                Délais
              </button>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Nouveau dossier
              </button>
            ) : null}
          </div>

          {insights ? (
            <div className="mb-4 grid gap-3 md:grid-cols-6">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Dossiers</p>
                <p className="mt-1 text-lg font-semibold">{insights.summary.caseCount}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Montant compte</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalAccountAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Montant facture</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalInvoiceAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Montant chèque</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalChequeAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Taux encaissement</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.receiptRate, locale)}%</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Dossiers en retard</p>
                <p className="mt-1 text-lg font-semibold text-rose-700">{insights.summary.overdueCount}</p>
              </article>
            </div>
          ) : null}

          {message ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {message}
            </p>
          ) : null}

          {activeTab === 'liste' ? (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-12">
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Projet</span>
                  <select
                    value={filterDraft.projectId}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        projectId: event.target.value,
                        sectionId: 'all',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous les projets</option>
                    {metadata?.projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {resolveProjectName(project, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Section</span>
                  <select
                    value={filterDraft.sectionId}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        sectionId: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Toutes les sections</option>
                    {filteredSections.map((section) => (
                      <option key={section.id} value={String(section.id)}>
                        {resolveSectionName(section, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</span>
                  <select
                    value={filterDraft.status}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        status: event.target.value as LedgerFilters['status'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous</option>
                    <option value="IN_PROGRESS">{statusLabels[locale].IN_PROGRESS}</option>
                    <option value="DONE">{statusLabels[locale].DONE}</option>
                    <option value="BLOCKED">{statusLabels[locale].BLOCKED}</option>
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Étape</span>
                  <select
                    value={filterDraft.stage}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        stage: event.target.value as LedgerFilters['stage'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Toutes</option>
                    {FINANCE_LEDGER_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[locale][stage]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Retard</span>
                  <select
                    value={filterDraft.overdue}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        overdue: event.target.value as LedgerFilters['overdue'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous</option>
                    <option value="true">En retard</option>
                    <option value="false">Dans le délai</option>
                  </select>
                </label>
                <label className="text-sm md:col-span-8">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Recherche</span>
                  <input
                    value={filterDraft.search}
                    onChange={(event) => setFilterDraft((prev) => ({ ...prev, search: event.target.value }))}
                    placeholder={locale === 'fr' ? 'Projet, section, facture, note…' : '项目、路段、发票号、备注…'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex items-end gap-2 md:col-span-4">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-visible rounded-xl border border-slate-200">
                <table className="min-w-[1300px] text-left text-sm">
                  <thead className="sticky z-20 bg-slate-100/95 shadow-sm" style={{ top: `${stickyTop}px` }}>
                    <tr className="text-xs uppercase tracking-wide text-slate-600">
                      <th className="px-3 py-2" aria-sort={sortAria('sequence')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('sequence')}>
                          Numéro {sortIndicator('sequence')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('project')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('project')}>
                          Projet {sortIndicator('project')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('section')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('section')}>
                          Section {sortIndicator('section')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('period')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('period')}>
                          Période {sortIndicator('period')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('stage')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('stage')}>
                          Étape {sortIndicator('stage')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('accountAmount')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('accountAmount')}>
                          Compte {sortIndicator('accountAmount')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('invoiceAmount')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('invoiceAmount')}>
                          Facture {sortIndicator('invoiceAmount')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('chequeAmount')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('chequeAmount')}>
                          Chèque {sortIndicator('chequeAmount')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('waitingDays')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('waitingDays')}>
                          Attente {sortIndicator('waitingDays')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('overdueDays')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('overdueDays')}>
                          Retard {sortIndicator('overdueDays')}
                        </button>
                      </th>
                      <th className="px-3 py-2" aria-sort={sortAria('remark')}>
                        <button type="button" className="font-semibold" onClick={() => handleSort('remark')}>
                          Note {sortIndicator('remark')}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                          Chargement...
                        </td>
                      </tr>
                    ) : !cases.length ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                          Aucun dossier
                        </td>
                      </tr>
                    ) : (
                      cases.map((item) => (
                        <tr key={item.id} className="bg-white hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-semibold text-slate-800">#{item.sequence}</td>
                          <td className="px-3 py-2">{resolveCaseProjectName(item, locale)}</td>
                          <td className="px-3 py-2">{resolveCaseSectionName(item, locale)}</td>
                          <td className="px-3 py-2">{`P${item.periodIndex}`}</td>
                          <td className="px-3 py-2">
                            {item.currentStage ? (
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${stageTone[item.status]}`}>
                                {stageLabels[locale][item.currentStage]}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2">{formatNumber(item.accountAmount, locale)}</td>
                          <td className="px-3 py-2">{formatNumber(item.invoiceAmount, locale)}</td>
                          <td className="px-3 py-2">{formatNumber(item.chequeAmount, locale)}</td>
                          <td className="px-3 py-2">{item.waitingDays}</td>
                          <td className="px-3 py-2">
                            {item.isOverdue ? (
                              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                                +{item.overdueDays} j
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                OK
                              </span>
                            )}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-2">{item.remark || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => void loadCaseDetail(item.id)}
                                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                Détails
                              </button>
                              {canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditCaseModal(item)}
                                    className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingId === item.id}
                                    onClick={() => void handleDeleteCase(item)}
                                    className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    {deletingId === item.id ? 'Suppression...' : 'Supprimer'}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <p>
                  {totalCases} dossiers · page {filters.page}/{totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <label>
                    <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">Taille</span>
                    <select
                      value={filters.pageSize}
                      onChange={(event) => changePageSize(Number(event.target.value))}
                      className="rounded border border-slate-200 px-2 py-1"
                    >
                      {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => changePage(filters.page - 1)}
                    disabled={filters.page <= 1}
                    className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(filters.page + 1)}
                    disabled={filters.page >= totalPages}
                    className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'progression' ? (
            <div className="space-y-4">
              {insightsLoading ? <p className="text-sm text-slate-500">Analyse en cours...</p> : null}
              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Entonnoir des étapes</h3>
                <div className="mt-3 space-y-2">
                  {insights?.stageFunnel.map((item) => {
                    const maxCount = Math.max(...(insights.stageFunnel.map((entry) => entry.count) || [1]), 1)
                    const width = maxCount ? Math.max((item.count / maxCount) * 100, item.count ? 10 : 0) : 0
                    return (
                      <div key={item.stage} className="grid grid-cols-12 items-center gap-2 text-sm">
                        <span className="col-span-3 text-slate-600">{stageLabels[locale][item.stage]}</span>
                        <div className="col-span-7 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                        </div>
                        <span className="col-span-2 text-right font-semibold">{item.count}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Flux mensuel</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[720px] text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-left">Mois</th>
                        <th className="px-2 py-2 text-right">Facture</th>
                        <th className="px-2 py-2 text-right">Chèque</th>
                        <th className="px-2 py-2 text-right">Cumul facture</th>
                        <th className="px-2 py-2 text-right">Cumul chèque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {insights?.monthlyFlow.length ? (
                        insights.monthlyFlow.map((row) => (
                          <tr key={row.month}>
                            <td className="px-2 py-2">{row.month}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.invoiceAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.chequeAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.cumulativeInvoiceAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.cumulativeChequeAmount, locale)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-2 py-3 text-slate-500" colSpan={5}>
                            Aucune donnée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}

          {activeTab === 'delais' ? (
            <div className="space-y-4">
              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Aging actuel</h3>
                <div className="mt-3 space-y-2">
                  {insights?.agingBuckets.map((bucket) => {
                    const maxCount = Math.max(...(insights.agingBuckets.map((item) => item.count) || [1]), 1)
                    const width = maxCount ? Math.max((bucket.count / maxCount) * 100, bucket.count ? 8 : 0) : 0
                    return (
                      <div key={bucket.bucket} className="grid grid-cols-12 items-center gap-2 text-sm">
                        <span className="col-span-3 text-slate-600">{bucket.bucket} jours</span>
                        <div className="col-span-7 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                        </div>
                        <span className="col-span-2 text-right font-semibold">{bucket.count}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Transitions et SLA</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[920px] text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-left">Transition</th>
                        <th className="px-2 py-2 text-right">Nb</th>
                        <th className="px-2 py-2 text-right">Moyenne</th>
                        <th className="px-2 py-2 text-right">P90</th>
                        <th className="px-2 py-2 text-right">SLA</th>
                        <th className="px-2 py-2 text-right">Retard %</th>
                        <th className="px-2 py-2 text-right">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {insights?.transitionStats.length ? (
                        insights.transitionStats.map((row) => (
                          <tr key={`${row.fromStage}-${row.toStage}`}>
                            <td className="px-2 py-2">
                              {stageLabels[locale][row.fromStage]} → {stageLabels[locale][row.toStage]}
                            </td>
                            <td className="px-2 py-2 text-right">{row.count}</td>
                            <td className="px-2 py-2 text-right">{row.averageDays} j</td>
                            <td className="px-2 py-2 text-right">{row.p90Days} j</td>
                            <td className="px-2 py-2 text-right">{row.slaDays} j</td>
                            <td className="px-2 py-2 text-right">{row.overdueRate}%</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.overdueImpactAmount, locale)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-2 py-3 text-slate-500">
                            Aucune donnée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </section>

      {detailCase ? (
        <aside className="fixed inset-0 z-40 bg-slate-900/40">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
                  <h2 className="text-lg font-semibold text-slate-900">#{detailCase.sequence}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailCase(null)}
                  className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
              {detailLoading ? <p className="mt-2 text-sm text-slate-500">Chargement...</p> : null}
            </div>
            <div className="space-y-5 px-5 py-4">
              <article className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <p>
                  <span className="text-slate-500">Projet: </span>
                  <strong>{resolveCaseProjectName(detailCase, locale)}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Période: </span>
                  <strong>{`P${detailCase.periodIndex}`}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Section: </span>
                  <strong>{resolveCaseSectionName(detailCase, locale)}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Statut: </span>
                  <strong>{statusLabels[locale][detailCase.status]}</strong>
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline des étapes</h3>
                </div>
                <div className="space-y-2">
                  {FINANCE_LEDGER_STAGES.map((stage) => {
                    const event = detailEventsByStage.get(stage)
                    const canFill = !event && detailCase.nextStage === stage && canEdit
                    return (
                      <div key={stage} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800">{stageLabels[locale][stage]}</p>
                            <p className="text-xs text-slate-500">
                              {event ? formatDateInput(event.occurredAt) : 'Non renseigné'}
                            </p>
                            {event?.note ? <p className="mt-1 text-xs text-slate-600">{event.note}</p> : null}
                          </div>
                          {canEdit ? (
                            event ? (
                              <button
                                type="button"
                                onClick={() => openEditEventModal(event)}
                                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                Modifier
                              </button>
                            ) : canFill ? (
                              <button
                                type="button"
                                onClick={() => openCreateEventModal(stage)}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                Renseigner
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </div>
          </div>
        </aside>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="mx-auto mt-10 w-[94%] max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">Nouveau dossier</h2>
              <p className="text-sm text-slate-500">Créer le couple unique Projet + Période.</p>
            </div>
            <div className="max-h-[calc(100vh-6rem)] space-y-3 overflow-y-auto px-5 py-4 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Projet</span>
                <select
                  value={createForm.projectId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      projectId: event.target.value,
                      sectionId: '',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {metadata?.projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {resolveProjectName(project, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Période</span>
                <input
                  type="number"
                  min={0}
                  value={createForm.periodIndex}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, periodIndex: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="0, 1, 2..."
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Section (optionnel)</span>
                <select
                  value={createForm.sectionId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, sectionId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">Aucune</option>
                  {createSections.map((section) => (
                    <option key={section.id} value={String(section.id)}>
                      {resolveSectionName(section, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={createSaving}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createSaving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingCase ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="mx-auto mt-10 w-[94%] max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">Modifier le dossier #{editingCase.sequence}</h2>
            </div>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Section</span>
                  <select
                    value={caseForm.sectionId}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, sectionId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="">Aucune</option>
                    {metadata?.sections
                      .filter((section) => section.projectId === editingCase.projectId)
                      .map((section) => (
                        <option key={section.id} value={String(section.id)}>
                          {resolveSectionName(section, locale)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Statut</span>
                  <select
                    value={caseForm.status}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, status: event.target.value as FinanceLedgerCaseStatus }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="IN_PROGRESS">{statusLabels[locale].IN_PROGRESS}</option>
                    <option value="BLOCKED">{statusLabels[locale].BLOCKED}</option>
                    <option value="DONE">{statusLabels[locale].DONE}</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant compte</span>
                  <input
                    value={caseForm.accountAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, accountAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant facture</span>
                  <input
                    value={caseForm.invoiceAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, invoiceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Acompte</span>
                  <input
                    value={caseForm.advanceAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, advanceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant chèque</span>
                  <input
                    value={caseForm.chequeAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, chequeAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Numéro facture</span>
                  <input
                    value={caseForm.invoiceNumber}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Numéro chèque reçu</span>
                  <input
                    value={caseForm.receiptChequeNumber}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, receiptChequeNumber: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Note</span>
                  <textarea
                    value={caseForm.remark}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, remark: event.target.value }))}
                    className="h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={caseSaving}
                onClick={() => void handleUpdateCase()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {caseSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEventModal ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="mx-auto mt-10 w-[94%] max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingEvent ? 'Modifier étape' : 'Renseigner étape'}: {stageLabels[locale][eventForm.stage]}
              </h2>
            </div>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Date étape</span>
                  <input
                    type="date"
                    value={eventForm.occurredAt}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant compte</span>
                  <input
                    value={eventForm.accountAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, accountAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant facture</span>
                  <input
                    value={eventForm.invoiceAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, invoiceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Acompte</span>
                  <input
                    value={eventForm.advanceAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, advanceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Montant chèque</span>
                  <input
                    value={eventForm.chequeAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, chequeAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Numéro facture</span>
                  <input
                    value={eventForm.invoiceNumber}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Numéro chèque reçu</span>
                  <input
                    value={eventForm.receiptChequeNumber}
                    onChange={(event) =>
                      setEventForm((prev) => ({ ...prev, receiptChequeNumber: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Note</span>
                  <textarea
                    value={eventForm.note}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, note: event.target.value }))}
                    className="h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false)
                  setEditingEvent(null)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={eventSaving}
                onClick={() => void handleSaveEvent()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {eventSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
