'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import Link from 'next/link'

import { AccessDenied } from '@/components/AccessDenied'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import {
  DEFAULT_FINANCE_SORT_STACK,
  type FinanceSortField,
  type FinanceSortSpec,
} from '@/lib/finance/constants'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type FinanceCategoryDTO = {
  key: string
  parentKey: string | null
  labelZh: string
  labelEn?: string | null
  labelFr?: string | null
  isActive?: boolean
  code?: string | null
  sortOrder: number
  children?: FinanceCategoryDTO[]
}

type Project = { id: number; name: string; code: string | null; isActive: boolean }
type Unit = { id: number; name: string; symbol: string | null; isActive: boolean }
type PaymentType = { id: number; name: string; isActive: boolean }
type Handler = { id: number; name: string; username: string }
type PaymentStatus = 'PENDING' | 'PAID'

type Metadata = {
  projects: Project[]
  units: Unit[]
  paymentTypes: PaymentType[]
  categories: FinanceCategoryDTO[]
  handlers: Handler[]
  creators: Handler[]
  updaters: Handler[]
}

type FinanceEntry = {
  id: number
  sequence: number
  projectId: number
  projectName: string
  reason: string
  categoryKey: string
  categoryPath: { key: string; label: string }[]
  amount: number
  unitId: number
  unitName: string
  paymentTypeId: number
  paymentTypeName: string
  handlerId: number | null
  handlerName?: string | null
  handlerUsername?: string | null
  paymentDate: string
  paymentStatus: PaymentStatus
  tva?: number
  remark?: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  createdById?: number | null
  createdByName?: string | null
  createdByUsername?: string | null
  updatedById?: number | null
  updatedByName?: string | null
  updatedByUsername?: string | null
}

type FinanceInsights = {
  totalAmount: number
  entryCount: number
  averageAmount: number
  latestPaymentDate?: string | null
  topCategories: { key: string; label: string; amount: number; count: number; share: number }[]
  paymentBreakdown: { id: number; name: string; amount: number; count: number; share: number }[]
  paymentStatusBreakdown: { status: PaymentStatus; amount: number; count: number; share: number }[]
  monthlyTrend: { month: string; amount: number; count: number }[]
  categoryBreakdown: {
    key: string
    label: string
    parentKey: string | null
    parentKeys: string[]
    amount: number
    count: number
    share: number
  }[]
}

type EntryForm = {
  projectId: number | ''
  reason: string
  categoryKey: string
  amount: string
  unitId: number | ''
  paymentTypeId: number | ''
  handlerId: number | ''
  paymentDate: string
  paymentStatus: PaymentStatus
  tva: string
  remark: string
}

type BulkEntryPatch = Partial<{
  projectId: number
  reason: string
  categoryKey: string
  amount: string
  unitId: number
  paymentTypeId: number
  handlerId: number
  paymentDate: string
  paymentStatus: PaymentStatus
  tva: string
  remark: string
}>

type ListFilters = {
  projectIds: number[]
  categoryKeys: string[]
  paymentTypeIds: number[]
  paymentStatuses: PaymentStatus[]
  unitIds: number[]
  handlerIds: number[]
  createdByIds: number[]
  updatedByIds: number[]
  reasonKeyword: string
  remarkKeyword: string
  amountMin: string
  amountMax: string
  taxMin: string
  taxMax: string
  sequenceMin: string
  sequenceMax: string
  dateFrom: string
  dateTo: string
  updatedFrom: string
  updatedTo: string
  sortStack: FinanceSortSpec[]
  page: number
  pageSize: number
}

const formatDateInput = (iso: string) => iso.split('T')[0]

const isPaymentStatus = (value: string): value is PaymentStatus =>
  value === 'PAID' || value === 'PENDING'

const parseNumberList = (values: string[]) =>
  values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

const formatUserLabel = (user: { name: string; username: string }) => {
  const name = user.name.trim()
  if (name) {
    return user.username && user.username !== name ? `${name} (${user.username})` : name
  }
  return user.username
}

const buildCategoryOptions = (nodes: FinanceCategoryDTO[], parentLabel: string): { key: string; label: string }[] =>
  nodes.flatMap((node) => {
    const label = parentLabel ? `${parentLabel} / ${node.labelZh}` : node.labelZh
    const children = node.children?.length ? buildCategoryOptions(node.children, label) : []
    if (node.children?.length) return children
    return [{ key: node.key, label }]
  })

const buildCategoryOptionsWithParents = (nodes: FinanceCategoryDTO[], parentLabel: string): { key: string; label: string }[] =>
  nodes.flatMap((node) => {
    const label = parentLabel ? `${parentLabel} / ${node.labelZh}` : node.labelZh
    const self = [{ key: node.key, label }]
    const children = node.children?.length ? buildCategoryOptionsWithParents(node.children, label) : []
    return [...self, ...children]
  })

const findCategoryNode = (nodes: FinanceCategoryDTO[], key: string): FinanceCategoryDTO | null => {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children?.length) {
      const found = findCategoryNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

const paymentStatusOptions: { value: PaymentStatus; label: string }[] = [
  { value: 'PAID', label: '已支付' },
  { value: 'PENDING', label: '待支付' },
]

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PAID: '已支付',
  PENDING: '待支付',
}

const paymentStatusBadgeStyles: Record<PaymentStatus, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
}

const paymentStatusBarStyles: Record<PaymentStatus, string> = {
  PAID: 'linear-gradient(90deg, rgba(16,185,129,0.85) 0%, rgba(14,165,233,0.6) 100%)',
  PENDING: 'linear-gradient(90deg, rgba(245,158,11,0.85) 0%, rgba(251,191,36,0.6) 100%)',
}

const COLUMN_STORAGE_KEY = 'finance-visible-columns'
const COLUMN_STORAGE_VERSION_KEY = 'finance-visible-columns-version'
const COLUMN_STORAGE_VERSION = 2
const defaultVisibleColumns = [
  'sequence',
  'project',
  'paymentDate',
  'paymentStatus',
  'reason',
  'amount',
  'handler',
  'action',
] as const

const SkeletonBar = ({ className }: { className?: string }) => (
  <div className={`h-3 animate-pulse rounded-full bg-slate-200 ${className ?? ''}`} />
)

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-100 ${className ?? ''}`} />
)

const FinanceSkeleton = () => (
  <div className="space-y-3 rounded-lg bg-white p-4 shadow sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="mt-2 h-5 w-48" />
      </div>
      <SkeletonBar className="h-4 w-24" />
    </div>
    <div className="grid gap-3 md:grid-cols-12">
      {[...Array(4)].map((_, idx) => (
        <SkeletonBlock key={idx} className="h-14 rounded-lg border border-slate-100 md:col-span-3" />
      ))}
      <SkeletonBlock className="h-20 md:col-span-7" />
      <SkeletonBlock className="h-20 md:col-span-5" />
      <SkeletonBlock className="h-16 md:col-span-12" />
    </div>
    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
      {[...Array(6)].map((_, idx) => (
        <div key={idx} className="grid grid-cols-12 items-center gap-3">
          <SkeletonBar className="col-span-2 h-4" />
          <SkeletonBar className="col-span-7 h-4" />
          <SkeletonBar className="col-span-3 h-3" />
        </div>
      ))}
    </div>
  </div>
)

export default function FinancePage() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [listFilters, setListFilters] = useState<ListFilters>({
    projectIds: [],
    categoryKeys: [],
    paymentTypeIds: [],
    paymentStatuses: [],
    unitIds: [],
    handlerIds: [],
    createdByIds: [],
    updatedByIds: [],
    reasonKeyword: '',
    remarkKeyword: '',
    amountMin: '',
    amountMax: '',
    taxMin: '',
    taxMax: '',
    sequenceMin: '',
    sequenceMax: '',
    dateFrom: '',
    dateTo: '',
    updatedFrom: '',
    updatedTo: '',
    sortStack: DEFAULT_FINANCE_SORT_STACK,
    page: 1,
    pageSize: 20,
  })
  const [listDraft, setListDraft] = useState<ListFilters>({
    projectIds: [],
    categoryKeys: [],
    paymentTypeIds: [],
    paymentStatuses: [],
    unitIds: [],
    handlerIds: [],
    createdByIds: [],
    updatedByIds: [],
    reasonKeyword: '',
    remarkKeyword: '',
    amountMin: '',
    amountMax: '',
    taxMin: '',
    taxMax: '',
    sequenceMin: '',
    sequenceMax: '',
    dateFrom: '',
    dateTo: '',
    updatedFrom: '',
    updatedTo: '',
    sortStack: DEFAULT_FINANCE_SORT_STACK,
    page: 1,
    pageSize: 20,
  })
  const [formCategoryOpen, setFormCategoryOpen] = useState(false)
  const [formCategorySearch, setFormCategorySearch] = useState('')
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategorySearch, setBulkCategorySearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'charts'>('table')
  const [insights, setInsights] = useState<FinanceInsights | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...defaultVisibleColumns])
  const [columnsReady, setColumnsReady] = useState(false)
  const persistColumns = (next: string[]) => {
    setVisibleColumns(next)
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next))
      localStorage.setItem(COLUMN_STORAGE_VERSION_KEY, String(COLUMN_STORAGE_VERSION))
    } catch (error) {
      console.error('Failed to persist visible columns', error)
    }
  }
  const [form, setForm] = useState<EntryForm>({
    projectId: '',
    reason: '',
    categoryKey: '',
    amount: '',
    unitId: '',
    paymentTypeId: '',
    handlerId: '',
    paymentDate: formatDateInput(new Date().toISOString()),
    paymentStatus: 'PAID',
    tva: '',
    remark: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [bulkPatch, setBulkPatch] = useState<BulkEntryPatch>({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [manageProject, setManageProject] = useState({ name: '', code: '', isActive: true })
  const [manageUnit, setManageUnit] = useState({ name: '', symbol: '', isActive: true })
  const [managePayment, setManagePayment] = useState({ name: '', isActive: true })
  const [manageCategory, setManageCategory] = useState({
    key: '',
    parentKey: '',
    labelZh: '',
    sortOrder: '',
    isActive: true,
  })
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null)
  const [editingPaymentTypeId, setEditingPaymentTypeId] = useState<number | null>(null)
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [showColumnChooser, setShowColumnChooser] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<{ entry: FinanceEntry; displayIndex: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceEntry | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const columnChooserRef = useRef<HTMLDivElement | null>(null)
  const formCategoryRef = useRef<HTMLDivElement | null>(null)
  const bulkCategoryRef = useRef<HTMLDivElement | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const canView = session?.permissions.includes('finance:view') ?? false
  const canEdit = session?.permissions.includes('finance:edit') ?? false
  const canManage = session?.permissions.includes('finance:manage') ?? false
  const shouldShowAccessDenied = authLoaded && !canView
  const breadcrumbHome = '首页'
  const breadcrumbFinance = '财务记账'

  const categoryOptions = useMemo(
    () => (metadata ? buildCategoryOptions(metadata.categories, '') : []),
    [metadata],
  )
  const categoryOptionsWithParents = useMemo(
    () => (metadata ? buildCategoryOptionsWithParents(metadata.categories, '') : []),
    [metadata],
  )
  const filteredFormCategoryOptions = useMemo(() => {
    const keyword = formCategorySearch.trim().toLowerCase()
    if (!keyword) return categoryOptions
    return categoryOptions.filter((cat) => cat.label.toLowerCase().includes(keyword))
  }, [categoryOptions, formCategorySearch])
  const filteredBulkCategoryOptions = useMemo(() => {
    const keyword = bulkCategorySearch.trim().toLowerCase()
    if (!keyword) return categoryOptions
    return categoryOptions.filter((cat) => cat.label.toLowerCase().includes(keyword))
  }, [bulkCategorySearch, categoryOptions])

  const defaultHandlerId = useMemo(() => {
    if (!metadata?.handlers?.length || !session) return ''
    const byId = metadata.handlers.find((handler) => handler.id === session.id)
    if (byId) return byId.id
    const byUsername = metadata.handlers.find((handler) => handler.username === session.username)
    return byUsername?.id ?? ''
  }, [metadata?.handlers, session])

  const filterControlProps = {
    allLabel: '全部',
    selectedLabel: (count: number) => `已选 ${count} 项`,
    selectAllLabel: '全选',
    clearLabel: '清空',
    noOptionsLabel: '暂无选项',
    searchPlaceholder: '搜索',
  }
  const sharedFilterProps = { ...filterControlProps, className: 'w-full' }

  const projectFilterOptions = useMemo(
    () =>
      metadata?.projects.map((project) => ({ value: String(project.id), label: project.name })) ??
      [],
    [metadata?.projects],
  )
  const categoryFilterOptions = useMemo(
    () => categoryOptionsWithParents.map((cat) => ({ value: cat.key, label: cat.label })),
    [categoryOptionsWithParents],
  )
  const paymentTypeFilterOptions = useMemo(
    () =>
      metadata?.paymentTypes.map((type) => ({ value: String(type.id), label: type.name })) ?? [],
    [metadata?.paymentTypes],
  )
  const unitFilterOptions = useMemo(
    () =>
      metadata?.units.map((unit) => ({
        value: String(unit.id),
        label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
      })) ?? [],
    [metadata?.units],
  )
  const paymentStatusFilterOptions = useMemo(
    () => paymentStatusOptions.map((status) => ({ value: status.value, label: status.label })),
    [],
  )
  const handlerFilterOptions = useMemo(
    () =>
      metadata?.handlers.map((handler) => ({
        value: String(handler.id),
        label: formatUserLabel(handler),
      })) ?? [],
    [metadata?.handlers],
  )
  const creatorFilterOptions = useMemo(
    () =>
      metadata?.creators.map((creator) => ({
        value: String(creator.id),
        label: formatUserLabel(creator),
      })) ?? [],
    [metadata?.creators],
  )
  const updaterFilterOptions = useMemo(
    () =>
      metadata?.updaters.map((updater) => ({
        value: String(updater.id),
        label: formatUserLabel(updater),
      })) ?? [],
    [metadata?.updaters],
  )

  const selectedCategoryLabel = useMemo(() => {
    if (!form.categoryKey) return '选择分类'
    return categoryOptions.find((cat) => cat.key === form.categoryKey)?.label ?? '选择分类'
  }, [categoryOptions, form.categoryKey])
  const selectedBulkCategoryLabel = useMemo(() => {
    if (!bulkPatch.categoryKey) return '选择分类'
    return categoryOptions.find((cat) => cat.key === bulkPatch.categoryKey)?.label ?? '选择分类'
  }, [bulkPatch.categoryKey, categoryOptions])

  const categoryMap = useMemo(() => {
    const map = new Map<string, FinanceCategoryDTO>()
    const walk = (nodes: FinanceCategoryDTO[]) => {
      nodes.forEach((node) => {
        map.set(node.key, node)
        if (node.children?.length) walk(node.children)
      })
    }
    if (metadata?.categories) walk(metadata.categories)
    return map
  }, [metadata])

  const manageCategories = useMemo(() => {
    const list: { key: string; label: string; parentKey: string | null; isActive?: boolean; sortOrder: number }[] = []
    const walk = (nodes: FinanceCategoryDTO[], parentLabel: string) => {
      nodes.forEach((node) => {
        const label = parentLabel ? `${parentLabel} / ${node.labelZh}` : node.labelZh
        list.push({
          key: node.key,
          label,
          parentKey: node.parentKey,
          isActive: node.isActive,
          sortOrder: node.sortOrder,
        })
        if (node.children?.length) walk(node.children, label)
      })
    }
    if (metadata?.categories) walk(metadata.categories, '')
    return list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'zh-CN'))
  }, [metadata?.categories])

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.paymentStatus === 'PENDING'),
    [entries],
  )

  const tableRows = useMemo(() => {
    const offset = (listFilters.page - 1) * listFilters.pageSize
    return entries.map((entry, index) => ({ entry, displayIndex: offset + index + 1 }))
  }, [entries, listFilters.page, listFilters.pageSize])

  const duplicateAmountIds = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<number>()
    tableRows.forEach(({ entry }) => {
      const amountKey = entry.amount.toFixed(2)
      if (seen.has(amountKey)) {
        duplicates.add(entry.id)
      } else {
        seen.add(amountKey)
      }
    })
    return duplicates
  }, [tableRows])

  const selectableEntryIds = useMemo(
    () => entries.filter((entry) => !entry.isDeleted).map((entry) => entry.id),
    [entries],
  )
  const selectedIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds])
  const allSelected =
    selectableEntryIds.length > 0 && selectableEntryIds.every((id) => selectedIdSet.has(id))
  const someSelected = selectableEntryIds.some((id) => selectedIdSet.has(id))
  const tableColumnCount = visibleColumns.length + 1
  const bulkPatchEmpty = useMemo(() => Object.keys(bulkPatch).length === 0, [bulkPatch])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalEntries || 0) / Math.max(listFilters.pageSize, 1))),
    [totalEntries, listFilters.pageSize],
  )

  const columnOptions: { key: string; label: string }[] = [
    { key: 'sequence', label: '序号' },
    { key: 'project', label: '项目' },
    { key: 'category', label: '分类' },
    { key: 'reason', label: '事由' },
    { key: 'amount', label: '金额' },
    { key: 'unit', label: '单位' },
    { key: 'paymentType', label: '支付方式' },
    { key: 'paymentDate', label: '支付日期' },
    { key: 'paymentStatus', label: '支付状态' },
    { key: 'handler', label: '经办人' },
    { key: 'createdBy', label: '创建人' },
    { key: 'updatedBy', label: '更新人' },
    { key: 'remark', label: '备注' },
    { key: 'tax', label: '税费' },
    { key: 'updatedAt', label: '最近更新' },
    { key: 'action', label: '操作' },
  ]
  const pageSizeOptions = [10, 20, 50, 100, 200, 500, 1000]

  const changePage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages || 1)
    setListFilters((prev) => ({ ...prev, page: clamped }))
    setListDraft((prev) => ({ ...prev, page: clamped }))
  }

  const changePageSize = (nextSize: number) => {
    const size = Math.min(Math.max(Math.round(nextSize), 1), 1000)
    setListFilters((prev) => ({ ...prev, pageSize: size, page: 1 }))
    setListDraft((prev) => ({ ...prev, pageSize: size, page: 1 }))
  }

  const buildSortStack = (stack: FinanceSortSpec[], field: FinanceSortField) => {
    const existing = stack.find((item) => item.field === field)
    const nextOrder: FinanceSortSpec['order'] =
      existing ? (existing.order === 'asc' ? 'desc' : 'asc') : 'desc'
    const filtered = stack.filter((item) => item.field !== field)
    return [{ field, order: nextOrder }, ...filtered].slice(0, 4)
  }

  const handleSort = (field: FinanceSortField) => {
    setListFilters((prev) => {
      const nextSortStack = buildSortStack(prev.sortStack, field)
      setListDraft((draft) => ({ ...draft, sortStack: nextSortStack, page: 1 }))
      return { ...prev, sortStack: nextSortStack, page: 1 }
    })
  }

  const sortIndicator = (field: FinanceSortField) => {
    const idx = listFilters.sortStack.findIndex((item) => item.field === field)
    if (idx === -1) return ''
    const arrow = listFilters.sortStack[idx].order === 'asc' ? '↑' : '↓'
    return `${arrow}${idx + 1}`
  }

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
      try {
        localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next))
        localStorage.setItem(COLUMN_STORAGE_VERSION_KEY, String(COLUMN_STORAGE_VERSION))
      } catch (error) {
        console.error('Failed to persist visible columns', error)
      }
      return next
    })
  }

  const buildFilterParams = (filtersInput: ListFilters) => {
    const params = new URLSearchParams()
    filtersInput.projectIds.forEach((id) => params.append('projectId', String(id)))
    filtersInput.categoryKeys.forEach((key) => params.append('categoryKey', key))
    filtersInput.paymentTypeIds.forEach((id) => params.append('paymentTypeId', String(id)))
    filtersInput.paymentStatuses.forEach((status) => params.append('paymentStatus', status))
    filtersInput.unitIds.forEach((id) => params.append('unitId', String(id)))
    filtersInput.handlerIds.forEach((id) => params.append('handlerId', String(id)))
    filtersInput.createdByIds.forEach((id) => params.append('createdBy', String(id)))
    filtersInput.updatedByIds.forEach((id) => params.append('updatedBy', String(id)))
    if (filtersInput.reasonKeyword.trim()) params.set('reasonKeyword', filtersInput.reasonKeyword.trim())
    if (filtersInput.remarkKeyword.trim()) params.set('remarkKeyword', filtersInput.remarkKeyword.trim())
    if (filtersInput.amountMin !== '') params.set('amountMin', filtersInput.amountMin)
    if (filtersInput.amountMax !== '') params.set('amountMax', filtersInput.amountMax)
    if (filtersInput.taxMin !== '') params.set('taxMin', filtersInput.taxMin)
    if (filtersInput.taxMax !== '') params.set('taxMax', filtersInput.taxMax)
    if (filtersInput.sequenceMin !== '') params.set('sequenceMin', filtersInput.sequenceMin)
    if (filtersInput.sequenceMax !== '') params.set('sequenceMax', filtersInput.sequenceMax)
    if (filtersInput.dateFrom) params.set('dateFrom', filtersInput.dateFrom)
    if (filtersInput.dateTo) params.set('dateTo', filtersInput.dateTo)
    if (filtersInput.updatedFrom) params.set('updatedFrom', filtersInput.updatedFrom)
    if (filtersInput.updatedTo) params.set('updatedTo', filtersInput.updatedTo)
    filtersInput.sortStack.forEach((sort) => {
      params.append('sort', `${sort.field}:${sort.order}`)
    })
    params.set('page', String(filtersInput.page))
    params.set('pageSize', String(filtersInput.pageSize))
    return params
  }

  const loadSession = async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = (await res.json()) as { user: SessionUser | null }
      setSession(data.user)
    } catch (error) {
      console.error(error)
    } finally {
      setAuthLoaded(true)
    }
  }

  const loadMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/metadata', { credentials: 'include' })
      const data = (await res.json()) as Metadata & { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '无法加载元数据')
        return
      }
      setMetadata({
        projects: data.projects,
        units: data.units,
        paymentTypes: data.paymentTypes,
        categories: data.categories,
        handlers: data.handlers ?? [],
        creators: data.creators ?? [],
        updaters: data.updaters ?? [],
      })
      const defaultProject = data.projects.find((p) => p.name === '邦杜库市政路项目')
      const defaultPayment = data.paymentTypes.find((p) => p.name === '现金支票') ?? data.paymentTypes[0]
      const defaultUnit = data.units.find((u) => u.name === '西法')
      const defaultCategory = buildCategoryOptions(data.categories, '')[0]?.key
      const defaultHandler = session
        ? data.handlers?.find(
            (handler) => handler.id === session.id || handler.username === session.username,
          )
        : undefined
      setForm((prev) => ({
        ...prev,
        projectId: defaultProject?.id ?? prev.projectId,
        paymentTypeId: defaultPayment?.id ?? prev.paymentTypeId,
        unitId: defaultUnit?.id ?? prev.unitId,
        categoryKey: defaultCategory ?? prev.categoryKey,
        handlerId: defaultHandler?.id ?? prev.handlerId,
        paymentDate: prev.paymentDate || formatDateInput(new Date().toISOString()),
      }))
      const defaults: ListFilters = {
        projectIds: [],
        categoryKeys: [],
        paymentTypeIds: [],
        paymentStatuses: [],
        unitIds: [],
        handlerIds: [],
        createdByIds: [],
        updatedByIds: [],
        reasonKeyword: '',
        remarkKeyword: '',
        amountMin: '',
        amountMax: '',
        taxMin: '',
        taxMax: '',
        sequenceMin: '',
        sequenceMax: '',
        dateFrom: '',
        dateTo: '',
        updatedFrom: '',
        updatedTo: '',
        sortStack: DEFAULT_FINANCE_SORT_STACK,
        page: 1,
        pageSize: 20,
      }
      setListDraft(defaults)
      setListFilters(defaults)
      setRefreshKey((prevKey) => prevKey + 1)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [session])

  const loadEntries = useCallback(
    async (filtersInput: ListFilters) => {
      if (!canView) return
      setLoading(true)
      setMessage(null)
      const params = buildFilterParams(filtersInput)
      const query = params.toString()
      try {
        const res = await fetch(query ? `/api/finance/entries?${query}` : '/api/finance/entries', {
          credentials: 'include',
        })
        const data = (await res.json()) as {
          entries?: FinanceEntry[]
          total?: number
          page?: number
          pageSize?: number
          message?: string
        }
        if (!res.ok) {
          setMessage(data.message ?? '加载失败')
          setTotalEntries(0)
          return
        }
        setEntries(data.entries ?? [])
        setTotalEntries(data.total ?? 0)
      } catch (error) {
        setMessage((error as Error).message)
        setTotalEntries(0)
      } finally {
        setLoading(false)
      }
    },
    [canView],
  )

  const loadInsights = useCallback(
    async (filtersInput: ListFilters) => {
      if (!canView) return
      setInsightsLoading(true)
      const params = buildFilterParams(filtersInput)
      const query = params.toString()
      try {
        const res = await fetch(query ? `/api/finance/insights?${query}` : '/api/finance/insights', {
          credentials: 'include',
        })
        const data = (await res.json()) as { insights?: FinanceInsights; message?: string }
        if (!res.ok) {
          setMessage(data.message ?? '加载分析数据失败')
          return
        }
        setInsights(data.insights ?? null)
      } catch (error) {
        setMessage((error as Error).message)
      } finally {
        setInsightsLoading(false)
      }
    },
    [canView],
  )

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
      const storedVersion = Number(localStorage.getItem(COLUMN_STORAGE_VERSION_KEY) || 0)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) {
          let nextColumns = parsed
          if (storedVersion < COLUMN_STORAGE_VERSION && !parsed.includes('paymentStatus')) {
            nextColumns = [...parsed, 'paymentStatus']
            localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(nextColumns))
          }
          localStorage.setItem(COLUMN_STORAGE_VERSION_KEY, String(COLUMN_STORAGE_VERSION))
          setVisibleColumns(nextColumns)
        }
      } else {
        localStorage.setItem(COLUMN_STORAGE_VERSION_KEY, String(COLUMN_STORAGE_VERSION))
      }
      setColumnsReady(true)
    } catch (error) {
      console.error('Failed to load visible columns', error)
      setColumnsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!columnsReady) return
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns))
      localStorage.setItem(COLUMN_STORAGE_VERSION_KEY, String(COLUMN_STORAGE_VERSION))
    } catch (error) {
      console.error('Failed to persist visible columns', error)
    }
  }, [columnsReady, visibleColumns])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && someSelected
    }
  }, [allSelected, someSelected])

  useEffect(() => {
    setSelectedEntryIds((prev) => prev.filter((id) => selectableEntryIds.includes(id)))
  }, [selectableEntryIds])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (columnChooserRef.current && !columnChooserRef.current.contains(target)) setShowColumnChooser(false)
      if (formCategoryRef.current && !formCategoryRef.current.contains(target)) setFormCategoryOpen(false)
      if (bulkCategoryRef.current && !bulkCategoryRef.current.contains(target)) setBulkCategoryOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (canView) {
      void loadMetadata()
    }
  }, [canView, loadMetadata])

  const {
    projectIds: filtersProjectIds,
    categoryKeys: filtersCategoryKeys,
    paymentTypeIds: filtersPaymentTypeIds,
    paymentStatuses: filtersPaymentStatuses,
    unitIds: filtersUnitIds,
    handlerIds: filtersHandlerIds,
    createdByIds: filtersCreatedByIds,
    updatedByIds: filtersUpdatedByIds,
    reasonKeyword: filtersReasonKeyword,
    remarkKeyword: filtersRemarkKeyword,
    amountMin: filtersAmountMin,
    amountMax: filtersAmountMax,
    taxMin: filtersTaxMin,
    taxMax: filtersTaxMax,
    sequenceMin: filtersSequenceMin,
    sequenceMax: filtersSequenceMax,
    dateFrom: filtersDateFrom,
    dateTo: filtersDateTo,
    updatedFrom: filtersUpdatedFrom,
    updatedTo: filtersUpdatedTo,
    sortStack,
    page,
    pageSize,
  } = listFilters

  useEffect(() => {
    if (!canView) return
    const currentFilters: ListFilters = {
      projectIds: filtersProjectIds,
      categoryKeys: filtersCategoryKeys,
      paymentTypeIds: filtersPaymentTypeIds,
      paymentStatuses: filtersPaymentStatuses,
      unitIds: filtersUnitIds,
      handlerIds: filtersHandlerIds,
      createdByIds: filtersCreatedByIds,
      updatedByIds: filtersUpdatedByIds,
      reasonKeyword: filtersReasonKeyword,
      remarkKeyword: filtersRemarkKeyword,
      amountMin: filtersAmountMin,
      amountMax: filtersAmountMax,
      taxMin: filtersTaxMin,
      taxMax: filtersTaxMax,
      sequenceMin: filtersSequenceMin,
      sequenceMax: filtersSequenceMax,
      dateFrom: filtersDateFrom,
      dateTo: filtersDateTo,
      updatedFrom: filtersUpdatedFrom,
      updatedTo: filtersUpdatedTo,
      sortStack,
      page,
      pageSize,
    }
    void loadEntries(currentFilters)
  }, [
    canView,
    refreshKey,
    filtersProjectIds,
    filtersCategoryKeys,
    filtersPaymentTypeIds,
    filtersPaymentStatuses,
    filtersUnitIds,
    filtersHandlerIds,
    filtersCreatedByIds,
    filtersUpdatedByIds,
    filtersReasonKeyword,
    filtersRemarkKeyword,
    filtersAmountMin,
    filtersAmountMax,
    filtersTaxMin,
    filtersTaxMax,
    filtersSequenceMin,
    filtersSequenceMax,
    filtersDateFrom,
    filtersDateTo,
    filtersUpdatedFrom,
    filtersUpdatedTo,
    sortStack,
    page,
    pageSize,
    loadEntries,
  ])

  useEffect(() => {
    if (!canView || viewMode !== 'charts') return
    const currentFilters: ListFilters = {
      projectIds: filtersProjectIds,
      categoryKeys: filtersCategoryKeys,
      paymentTypeIds: filtersPaymentTypeIds,
      paymentStatuses: filtersPaymentStatuses,
      unitIds: filtersUnitIds,
      handlerIds: filtersHandlerIds,
      createdByIds: filtersCreatedByIds,
      updatedByIds: filtersUpdatedByIds,
      reasonKeyword: filtersReasonKeyword,
      remarkKeyword: filtersRemarkKeyword,
      amountMin: filtersAmountMin,
      amountMax: filtersAmountMax,
      taxMin: filtersTaxMin,
      taxMax: filtersTaxMax,
      sequenceMin: filtersSequenceMin,
      sequenceMax: filtersSequenceMax,
      dateFrom: filtersDateFrom,
      dateTo: filtersDateTo,
      updatedFrom: filtersUpdatedFrom,
      updatedTo: filtersUpdatedTo,
      sortStack,
      page,
      pageSize,
    }
    void loadInsights(currentFilters)
  }, [
    canView,
    viewMode,
    refreshKey,
    filtersProjectIds,
    filtersCategoryKeys,
    filtersPaymentTypeIds,
    filtersPaymentStatuses,
    filtersUnitIds,
    filtersHandlerIds,
    filtersCreatedByIds,
    filtersUpdatedByIds,
    filtersReasonKeyword,
    filtersRemarkKeyword,
    filtersAmountMin,
    filtersAmountMax,
    filtersTaxMin,
    filtersTaxMax,
    filtersSequenceMin,
    filtersSequenceMax,
    filtersDateFrom,
    filtersDateTo,
    filtersUpdatedFrom,
    filtersUpdatedTo,
    sortStack,
    page,
    pageSize,
    loadInsights,
  ])

  const classificationBreakdown = useMemo(() => {
    if (!metadata?.categories) return null
    const rootKey = listFilters.categoryKeys.length === 1 ? listFilters.categoryKeys[0] : null
    const rootLabel =
      listFilters.categoryKeys.length > 1
        ? '已选分类'
        : rootKey
          ? categoryMap.get(rootKey)?.labelZh ?? rootKey
          : '全部分类'
    if (!entries.length) {
      return { rootKey, rootLabel, total: 0, children: [] }
    }

    const childMap = new Map<string, { label: string; amount: number; count: number }>()
    let total = 0

    entries.forEach((entry) => {
      const path = entry.categoryPath
      let childNode = path[0]
      if (rootKey) {
        const idx = path.findIndex((node) => node.key === rootKey)
        if (idx >= 0 && path[idx + 1]) {
          childNode = path[idx + 1]
        } else if (idx >= 0) {
          childNode = path[idx]
        }
      }

      const childKey = childNode?.key ?? entry.categoryKey
      const childLabel = childNode?.label ?? categoryMap.get(childKey)?.labelZh ?? childKey

      const existing = childMap.get(childKey)
      if (existing) {
        existing.amount += entry.amount
        existing.count += 1
      } else {
        childMap.set(childKey, { label: childLabel, amount: entry.amount, count: 1 })
      }

      total += entry.amount
    })

    const children = Array.from(childMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        amount: Math.round(value.amount * 100) / 100,
        count: value.count,
        share: total ? Math.round((value.amount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    return {
      rootKey,
      rootLabel,
      total: Math.round(total * 100) / 100,
      children,
    }
  }, [categoryMap, entries, listFilters.categoryKeys, metadata?.categories])

  const resetForm = () => {
    const defaultPayment = metadata?.paymentTypes.find((p) => p.name === '现金支票') ?? metadata?.paymentTypes[0]
    setForm({
      projectId: metadata?.projects.find((p) => p.name === '邦杜库市政路项目')?.id ?? '',
      reason: '',
      categoryKey: categoryOptions[0]?.key ?? '',
      amount: '',
      unitId: metadata?.units.find((u) => u.name === '西法')?.id ?? '',
      paymentTypeId: defaultPayment?.id ?? '',
      handlerId: defaultHandlerId || '',
      paymentDate: formatDateInput(new Date().toISOString()),
      paymentStatus: 'PAID',
      tva: '',
      remark: '',
    })
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!canEdit) return
    if (
      !form.projectId ||
      !form.reason ||
      !form.categoryKey ||
      !form.amount ||
      !form.unitId ||
      !form.paymentTypeId
    ) {
      setMessage('请填写完整必填字段')
      return
    }

    const payload = {
      projectId: Number(form.projectId),
      reason: form.reason,
      categoryKey: form.categoryKey,
      amount: Number(form.amount),
      unitId: Number(form.unitId),
      paymentTypeId: Number(form.paymentTypeId),
      handlerId: form.handlerId ? Number(form.handlerId) : null,
      paymentDate: form.paymentDate || new Date().toISOString(),
      paymentStatus: form.paymentStatus,
      tva: form.tva ? Number(form.tva) : null,
      remark: form.remark || null,
    }

    const url = editingId ? `/api/finance/entries/${editingId}` : '/api/finance/entries'
    const method = editingId ? 'PUT' : 'POST'

    setLoading(true)
    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '保存失败')
        return
      }
      setMessage('保存成功')
      resetForm()
      setShowEntryModal(false)
      await loadEntries(listFilters)
      await loadInsights(listFilters)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (entry: FinanceEntry) => {
    setEditingId(entry.id)
    setForm({
      projectId: entry.projectId,
      reason: entry.reason,
      categoryKey: entry.categoryKey,
      amount: String(entry.amount),
      unitId: entry.unitId,
      paymentTypeId: entry.paymentTypeId,
      handlerId: entry.handlerId ?? '',
      paymentDate: formatDateInput(entry.paymentDate),
      paymentStatus: entry.paymentStatus,
      tva: entry.tva != null ? String(entry.tva) : '',
      remark: entry.remark ?? '',
    })
    setShowEntryModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!canEdit) return
    setDeletingId(id)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/entries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '删除失败')
        return
      }
      setMessage('删除成功')
      setDeleteTarget(null)
      await loadEntries(listFilters)
      await loadInsights(listFilters)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setDeletingId(null)
      setLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!canEdit || selectedEntryIds.length === 0) return
    const count = selectedEntryIds.length
    if (!confirm(`确认删除已选的 ${count} 条记录吗？删除后无法恢复。`)) return
    setBulkDeleting(true)
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedEntryIds.map(async (id) => {
          const res = await fetch(`/api/finance/entries/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { message?: string }
            throw new Error(data.message ?? `删除失败: ${id}`)
          }
        }),
      )
      const failures = results.filter((result) => result.status === 'rejected')
      setMessage(failures.length ? `批量删除完成，失败 ${failures.length} 条` : '批量删除成功')
      setSelectedEntryIds([])
      await loadEntries(listFilters)
      await loadInsights(listFilters)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBulkDeleting(false)
      setLoading(false)
    }
  }

  const updateBulkPatchField = useCallback(
    (field: keyof BulkEntryPatch, value: BulkEntryPatch[keyof BulkEntryPatch] | undefined) => {
      setBulkPatch((prev) => {
        if (value === undefined) {
          const next = { ...prev } as BulkEntryPatch
          delete next[field]
          return next
        }
        return { ...prev, [field]: value } as BulkEntryPatch
      })
    },
    [],
  )

  const openBulkEdit = () => {
    if (!canEdit) return
    if (selectedEntryIds.length === 0) {
      setMessage('请先选择需要批量修改的记录')
      return
    }
    setBulkPatch({})
    setBulkCategoryOpen(false)
    setBulkCategorySearch('')
    setShowBulkEditModal(true)
  }

  const buildBulkPayload = (patch: BulkEntryPatch) => {
    const payload: Record<string, unknown> = {}
    if (patch.projectId !== undefined) payload.projectId = patch.projectId
    if (patch.reason && patch.reason.trim()) payload.reason = patch.reason.trim()
    if (patch.categoryKey) payload.categoryKey = patch.categoryKey
    if (patch.amount !== undefined) {
      const amount = Number(patch.amount)
      if (!Number.isFinite(amount)) {
        throw new Error('批量修改：金额必须为数字')
      }
      payload.amount = amount
    }
    if (patch.unitId !== undefined) payload.unitId = patch.unitId
    if (patch.paymentTypeId !== undefined) payload.paymentTypeId = patch.paymentTypeId
    if (patch.handlerId !== undefined) payload.handlerId = patch.handlerId
    if (patch.paymentDate && patch.paymentDate.trim()) payload.paymentDate = patch.paymentDate.trim()
    if (patch.paymentStatus) payload.paymentStatus = patch.paymentStatus
    if (patch.tva !== undefined) {
      const tva = Number(patch.tva)
      if (!Number.isFinite(tva)) {
        throw new Error('批量修改：税费必须为数字')
      }
      payload.tva = tva
    }
    if (patch.remark && patch.remark.trim()) payload.remark = patch.remark.trim()
    return payload
  }

  const handleBulkSave = async () => {
    if (!canEdit) return
    if (selectedEntryIds.length === 0) {
      setMessage('请先选择需要批量修改的记录')
      return
    }
    let payload: Record<string, unknown> = {}
    try {
      payload = buildBulkPayload(bulkPatch)
    } catch (error) {
      setMessage((error as Error).message)
      return
    }
    if (Object.keys(payload).length === 0) {
      setMessage('请先填写需要批量修改的字段')
      return
    }
    setBulkSaving(true)
    setLoading(true)
    try {
      const res = await fetch('/api/finance/entries/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedEntryIds.map((id) => ({ id, patch: payload })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        results?: Array<{ id: number; ok: boolean; error?: string }>
        message?: string
      }
      if (!res.ok) {
        setMessage(data.message ?? '批量修改失败')
        return
      }
      const results = Array.isArray(data.results) ? data.results : []
      const failed = results.filter((item) => !item.ok)
      const successCount = results.length - failed.length
      if (failed.length > 0) {
        const failedIds = failed.map((item) => item.id)
        setSelectedEntryIds(failedIds)
        setMessage(`批量修改完成，成功 ${successCount} 条，失败 ${failed.length} 条`)
      } else {
        setMessage(`批量修改成功，共 ${successCount} 条`)
        setSelectedEntryIds([])
        setBulkPatch({})
        setShowBulkEditModal(false)
      }
      if (successCount > 0) {
        await loadEntries(listFilters)
        await loadInsights(listFilters)
      }
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBulkSaving(false)
      setLoading(false)
    }
  }

  const toggleEntrySelection = (entryId: number) => {
    setSelectedEntryIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId],
    )
  }

  const handleRowSelect = (entry: FinanceEntry) => (event: ReactMouseEvent<HTMLTableRowElement>) => {
    if (!canEdit || entry.isDeleted) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, input, select, textarea, label')) return
    toggleEntrySelection(entry.id)
  }

  type ManageRequest = {
    path: string
    method: 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
    successMessage: string
  }

  const manageRequest = async ({ path, method, body, successMessage }: ManageRequest) => {
    setLoading(true)
    const hasBody = body && Object.keys(body).length > 0
    try {
      const res = await fetch(path, {
        method,
        credentials: 'include',
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify(body) : undefined,
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '操作失败')
        return false
      }
      setMessage(successMessage)
      await loadMetadata()
      return true
    } catch (error) {
      setMessage((error as Error).message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (key: string) =>
    manageRequest({
      path: '/api/finance/categories',
      method: 'DELETE',
      body: { key },
      successMessage: '已停用分类',
    })

  const resetManageForms = () => {
    setManageProject({ name: '', code: '', isActive: true })
    setManageUnit({ name: '', symbol: '', isActive: true })
    setManagePayment({ name: '', isActive: true })
    setManageCategory({ key: '', parentKey: '', labelZh: '', sortOrder: '', isActive: true })
    setEditingProjectId(null)
    setEditingUnitId(null)
    setEditingPaymentTypeId(null)
    setEditingCategoryKey(null)
  }

  const saveProject = async () => {
    if (!manageProject.name.trim()) {
      setMessage('请填写项目名称')
      return
    }
    const success = await manageRequest({
      path: editingProjectId ? `/api/finance/projects/${editingProjectId}` : '/api/finance/projects',
      method: editingProjectId ? 'PUT' : 'POST',
      body: { name: manageProject.name.trim(), code: manageProject.code || null, isActive: manageProject.isActive },
      successMessage: '项目已保存',
    })
    if (success) {
      setManageProject({ name: '', code: '', isActive: true })
      setEditingProjectId(null)
    }
  }

  const deleteProject = async (id: number) => {
    if (!confirm('确认删除该项目吗？')) return
    const success = await manageRequest({
      path: `/api/finance/projects/${id}`,
      method: 'DELETE',
      successMessage: '项目已停用',
    })
    if (success && editingProjectId === id) {
      setManageProject({ name: '', code: '', isActive: true })
      setEditingProjectId(null)
    }
  }

  const saveUnit = async () => {
    if (!manageUnit.name.trim()) {
      setMessage('请填写金额单位名称')
      return
    }
    const success = await manageRequest({
      path: editingUnitId ? `/api/finance/units/${editingUnitId}` : '/api/finance/units',
      method: editingUnitId ? 'PUT' : 'POST',
      body: {
        name: manageUnit.name.trim(),
        symbol: manageUnit.symbol || null,
        isActive: manageUnit.isActive,
      },
      successMessage: '金额单位已保存',
    })
    if (success) {
      setManageUnit({ name: '', symbol: '', isActive: true })
      setEditingUnitId(null)
    }
  }

  const deleteUnit = async (id: number) => {
    if (!confirm('确认删除该金额单位吗？')) return
    const success = await manageRequest({
      path: `/api/finance/units/${id}`,
      method: 'DELETE',
      successMessage: '金额单位已停用',
    })
    if (success && editingUnitId === id) {
      setManageUnit({ name: '', symbol: '', isActive: true })
      setEditingUnitId(null)
    }
  }

  const savePaymentType = async () => {
    if (!managePayment.name.trim()) {
      setMessage('请填写支付方式名称')
      return
    }
    const success = await manageRequest({
      path: editingPaymentTypeId ? `/api/finance/payment-types/${editingPaymentTypeId}` : '/api/finance/payment-types',
      method: editingPaymentTypeId ? 'PUT' : 'POST',
      body: { name: managePayment.name.trim(), isActive: managePayment.isActive },
      successMessage: '支付方式已保存',
    })
    if (success) {
      setManagePayment({ name: '', isActive: true })
      setEditingPaymentTypeId(null)
    }
  }

  const deletePaymentType = async (id: number) => {
    if (!confirm('确认删除该支付方式吗？')) return
    const success = await manageRequest({
      path: `/api/finance/payment-types/${id}`,
      method: 'DELETE',
      successMessage: '支付方式已停用',
    })
    if (success && editingPaymentTypeId === id) {
      setManagePayment({ name: '', isActive: true })
      setEditingPaymentTypeId(null)
    }
  }

  const saveCategory = async () => {
    if (!manageCategory.key.trim() || !manageCategory.labelZh.trim()) {
      setMessage('请填写分类 key 和名称')
      return
    }
    const success = await manageRequest({
      path: '/api/finance/categories',
      method: 'POST',
      body: {
        key: manageCategory.key.trim(),
        parentKey: manageCategory.parentKey.trim() || null,
        labelZh: manageCategory.labelZh.trim(),
        sortOrder: manageCategory.sortOrder ? Number(manageCategory.sortOrder) : 0,
        isActive: manageCategory.isActive,
      },
      successMessage: '分类已保存',
    })
    if (success) {
      setManageCategory({ key: '', parentKey: '', labelZh: '', sortOrder: '', isActive: true })
      setEditingCategoryKey(null)
    }
  }

  const deleteCategoryByKey = async (key: string) => {
    if (!confirm('确认删除该分类吗？')) return
    const success = await deleteCategory(key)
    if (success && editingCategoryKey === key) {
      setManageCategory({ key: '', parentKey: '', labelZh: '', sortOrder: '', isActive: true })
      setEditingCategoryKey(null)
    }
  }

  const isPriming = !authLoaded || !metadata || (!entries.length && loading) || (!insights && insightsLoading)

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied
        permissions={['finance:view']}
        hint="请先登录并开通 finance:view 权限以查看财务流水。"
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden p-4 space-y-6 sm:p-6 xl:max-w-[1500px] xl:px-10 xl:py-8 2xl:max-w-[1700px] 2xl:px-12 2xl:py-10">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:bg-slate-50"
        >
          {breadcrumbHome}
        </Link>
        <span className="text-slate-400">/</span>
        <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-slate-800">
          {breadcrumbFinance}
        </span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">财务记账</h1>
          <p className="text-sm text-slate-600">按项目录入流水，支持分类、金额单位与支付方式。</p>
        </div>
        <div className="text-sm text-slate-600">
          {session ? `已登录：${session.username}` : '未登录'}
        </div>
      </div>

      {!canView && authLoaded && (
        <p className="text-red-600">缺少 finance:view 权限，无法查看财务数据。</p>
      )}
      {message && <p className="rounded bg-yellow-100 px-3 py-2 text-sm text-yellow-800">{message}</p>}

      {canView ? (
        isPriming ? (
          <FinanceSkeleton />
        ) : (
          <>
            <div className="space-y-3 rounded-lg bg-white p-4 shadow sm:p-5 overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">筛选与操作</h2>
                  <p className="text-sm text-slate-600">选择范围后应用筛选并刷新列表。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <button
                      onClick={() => {
                        resetManageForms()
                        setShowManage(true)
                      }}
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      主数据管理
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => {
                        resetForm()
                        setShowEntryModal(true)
                      }}
                      className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
                    >
                      新增记录
                    </button>
                  )}
                </div>
              </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-12 xl:gap-4 2xl:gap-5">
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="项目"
                  options={projectFilterOptions}
                  selected={listDraft.projectIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, projectIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="分类"
                  options={categoryFilterOptions}
                  selected={listDraft.categoryKeys}
                  onChange={(values) => setListDraft((prev) => ({ ...prev, categoryKeys: values }))}
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="支付方式"
                  options={paymentTypeFilterOptions}
                  selected={listDraft.paymentTypeIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, paymentTypeIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="支付状态"
                  options={paymentStatusFilterOptions}
                  selected={listDraft.paymentStatuses}
                  onChange={(values) =>
                    setListDraft((prev) => ({
                      ...prev,
                      paymentStatuses: values.filter(isPaymentStatus),
                    }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="金额单位"
                  options={unitFilterOptions}
                  selected={listDraft.unitIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, unitIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="经办人"
                  options={handlerFilterOptions}
                  selected={listDraft.handlerIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, handlerIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="创建人"
                  options={creatorFilterOptions}
                  selected={listDraft.createdByIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, createdByIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <MultiSelectFilter
                  label="更新人"
                  options={updaterFilterOptions}
                  selected={listDraft.updatedByIds.map(String)}
                  onChange={(values) =>
                    setListDraft((prev) => ({ ...prev, updatedByIds: parseNumberList(values) }))
                  }
                  {...sharedFilterProps}
                />
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-4 xl:col-span-3">
                <div className="relative space-y-1 text-sm" ref={columnChooserRef}>
                  <span className="text-slate-700">显示列</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowColumnChooser((prev) => !prev)}
                      className="flex w-full max-w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm hover:bg-slate-50"
                    >
                      <span className="truncate">
                        {visibleColumns.length ? `已选 ${visibleColumns.length} 列` : '未选择列'}
                      </span>
                      <span className="text-xs text-slate-500">⌕</span>
                    </button>
                    {showColumnChooser && (
                      <div
                        className="absolute inset-x-0 z-30 mt-2 w-full max-w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                        onMouseLeave={() => setShowColumnChooser(false)}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() => persistColumns(columnOptions.map((opt) => opt.key))}
                          >
                            全选
                          </button>
                          <div className="flex gap-2">
                            <button
                              className="text-slate-600 hover:underline"
                              onClick={() => persistColumns([...defaultVisibleColumns])}
                            >
                              恢复默认
                            </button>
                            <button
                              className="text-slate-600 hover:underline"
                              onClick={() => persistColumns([])}
                            >
                              清空
                            </button>
                          </div>
                        </div>
                        <div className="max-h-64 space-y-1 overflow-y-auto p-2 text-sm">
                          {columnOptions.map((opt) => (
                            <label
                              key={opt.key}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={visibleColumns.includes(opt.key)}
                                onChange={() => toggleColumn(opt.key)}
                              />
                              <span className="truncate">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-6 xl:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">序号范围</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            sequenceMin: prev.sequenceMin ? String(Number(prev.sequenceMin) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.sequenceMin}
                        placeholder="最小值"
                        onChange={(e) =>
                          setListDraft((prev) => ({ ...prev, sequenceMin: e.target.value }))
                        }
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            sequenceMin: prev.sequenceMin ? String(Number(prev.sequenceMin) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm text-slate-500">—</span>
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            sequenceMax: prev.sequenceMax ? String(Number(prev.sequenceMax) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.sequenceMax}
                        placeholder="最大值"
                        onChange={(e) =>
                          setListDraft((prev) => ({ ...prev, sequenceMax: e.target.value }))
                        }
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            sequenceMax: prev.sequenceMax ? String(Number(prev.sequenceMax) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-6 xl:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">金额范围</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            amountMin: prev.amountMin ? String(Number(prev.amountMin) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.amountMin}
                        placeholder="最小值"
                        onChange={(e) => setListDraft((prev) => ({ ...prev, amountMin: e.target.value }))}
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            amountMin: prev.amountMin ? String(Number(prev.amountMin) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm text-slate-500">—</span>
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            amountMax: prev.amountMax ? String(Number(prev.amountMax) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.amountMax}
                        placeholder="最大值"
                        onChange={(e) => setListDraft((prev) => ({ ...prev, amountMax: e.target.value }))}
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            amountMax: prev.amountMax ? String(Number(prev.amountMax) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-6 xl:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">税费范围</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            taxMin: prev.taxMin ? String(Number(prev.taxMin) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.taxMin}
                        placeholder="最小值"
                        onChange={(e) => setListDraft((prev) => ({ ...prev, taxMin: e.target.value }))}
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            taxMin: prev.taxMin ? String(Number(prev.taxMin) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm text-slate-500">—</span>
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            taxMax: prev.taxMax ? String(Number(prev.taxMax) - 1) : '0',
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        className="w-20 border-x border-slate-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                        type="number"
                        value={listDraft.taxMax}
                        placeholder="最大值"
                        onChange={(e) => setListDraft((prev) => ({ ...prev, taxMax: e.target.value }))}
                      />
                      <button
                        className="px-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          setListDraft((prev) => ({
                            ...prev,
                            taxMax: prev.taxMax ? String(Number(prev.taxMax) + 1) : '1',
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-6 xl:col-span-4 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 shadow-sm md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">支付日期</span>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      type="date"
                      value={listDraft.dateFrom}
                      onChange={(e) => setListDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    />
                    <span className="text-sm text-slate-500">至</span>
                    <input
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      type="date"
                      value={listDraft.dateTo}
                      onChange={(e) => setListDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:col-span-6 lg:col-span-6 xl:col-span-4 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 shadow-sm md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">最近更新</span>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      type="date"
                      value={listDraft.updatedFrom}
                      onChange={(e) => setListDraft((prev) => ({ ...prev, updatedFrom: e.target.value }))}
                    />
                    <span className="text-sm text-slate-500">至</span>
                    <input
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      type="date"
                      value={listDraft.updatedTo}
                      onChange={(e) => setListDraft((prev) => ({ ...prev, updatedTo: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-12 lg:col-span-12 xl:col-span-8 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 shadow-sm md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-sm font-medium text-slate-700">事由</span>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="模糊搜索事由"
                    value={listDraft.reasonKeyword}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, reasonKeyword: e.target.value }))}
                  />
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-sm font-medium text-slate-700">备注</span>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="模糊搜索备注"
                    value={listDraft.remarkKeyword}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, remarkKeyword: e.target.value }))}
                  />
                </div>
              </div>

              <div className="md:col-span-12 lg:col-span-12 xl:col-span-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 p-3 shadow-sm">
                <button
                  onClick={() => {
                    const nextFilters = { ...listDraft, page: 1 }
                    setListDraft(nextFilters)
                    setListFilters(nextFilters)
                    setSelectedEntryIds([])
                    setShowColumnChooser(false)
                    setRefreshKey((prev) => prev + 1)
                  }}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  应用筛选并刷新
                </button>
                <button
                  onClick={() => {
                    const reset = {
                      projectIds: [],
                      categoryKeys: [],
                      paymentTypeIds: [],
                      paymentStatuses: [],
                      unitIds: [],
                      handlerIds: [],
                      createdByIds: [],
                      updatedByIds: [],
                      reasonKeyword: '',
                      remarkKeyword: '',
                      amountMin: '',
                      amountMax: '',
                      taxMin: '',
                      taxMax: '',
                      sequenceMin: '',
                      sequenceMax: '',
                      dateFrom: '',
                      dateTo: '',
                      updatedFrom: '',
                      updatedTo: '',
                      sortStack: DEFAULT_FINANCE_SORT_STACK,
                      page: 1,
                      pageSize: 20,
                    } satisfies ListFilters
                    setListDraft(reset)
                    setListFilters(reset)
                    setSelectedEntryIds([])
                    setShowColumnChooser(false)
                    setRefreshKey((prev) => prev + 1)
                  }}
                  className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  重置筛选
                </button>
              </div>
            </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">数据视图</h3>
              <p className="text-xs text-slate-500">切换表格/图表，序号按当前筛选从 1 递增</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  onClick={openBulkEdit}
                  disabled={bulkSaving || selectedEntryIds.length === 0}
                >
                  批量编辑{selectedEntryIds.length ? ` (${selectedEntryIds.length})` : ''}
                </button>
              )}
              {canEdit && (
                <button
                  className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting || selectedEntryIds.length === 0}
                >
                  批量删除{selectedEntryIds.length ? ` (${selectedEntryIds.length})` : ''}
                </button>
              )}
              <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm">
                <button
                  className={`rounded-full px-3 py-1 transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={() => setViewMode('table')}
                >
                  表格列表
                </button>
                <button
                  className={`rounded-full px-3 py-1 transition ${viewMode === 'charts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={() => setViewMode('charts')}
                >
                  图表分析
                </button>
              </div>
            </div>
          </div>
          {loading && <p className="text-sm text-slate-600">加载中...</p>}
          {viewMode === 'table' ? (
            <>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="w-10 px-3 py-2">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          checked={allSelected}
                          disabled={!canEdit || selectableEntryIds.length === 0}
                          onChange={() =>
                            setSelectedEntryIds(allSelected ? [] : [...selectableEntryIds])
                          }
                          aria-label="全选当前页"
                        />
                      </th>
                      {visibleColumns.includes('sequence') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('sequence')}
                        >
                          序号 {sortIndicator('sequence')}
                        </th>
                      )}
                      {visibleColumns.includes('project') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('project')}
                        >
                          项目 {sortIndicator('project')}
                        </th>
                      )}
                      {visibleColumns.includes('category') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('category')}
                        >
                          分类 {sortIndicator('category')}
                        </th>
                      )}
                      {visibleColumns.includes('reason') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('reason')}
                        >
                          事由 {sortIndicator('reason')}
                        </th>
                      )}
                      {visibleColumns.includes('amount') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('amount')}
                        >
                          金额 {sortIndicator('amount')}
                        </th>
                      )}
                      {visibleColumns.includes('unit') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('unit')}
                        >
                          单位 {sortIndicator('unit')}
                        </th>
                      )}
                      {visibleColumns.includes('paymentType') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('paymentType')}
                        >
                          支付方式 {sortIndicator('paymentType')}
                        </th>
                      )}
                      {visibleColumns.includes('paymentDate') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('paymentDate')}
                        >
                          支付日期 {sortIndicator('paymentDate')}
                        </th>
                      )}
                      {visibleColumns.includes('paymentStatus') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('paymentStatus')}
                        >
                          支付状态 {sortIndicator('paymentStatus')}
                        </th>
                      )}
                      {visibleColumns.includes('handler') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('handler')}
                        >
                          经办人 {sortIndicator('handler')}
                        </th>
                      )}
                      {visibleColumns.includes('createdBy') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('createdBy')}
                        >
                          创建人 {sortIndicator('createdBy')}
                        </th>
                      )}
                      {visibleColumns.includes('updatedBy') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('updatedBy')}
                        >
                          更新人 {sortIndicator('updatedBy')}
                        </th>
                      )}
                      {visibleColumns.includes('remark') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('remark')}
                        >
                          备注 {sortIndicator('remark')}
                        </th>
                      )}
                      {visibleColumns.includes('tax') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('tax')}
                        >
                          税费 {sortIndicator('tax')}
                        </th>
                      )}
                      {visibleColumns.includes('updatedAt') && (
                        <th
                          className="px-3 py-2 cursor-pointer select-none"
                          onClick={() => handleSort('updatedAt')}
                        >
                          最近更新 {sortIndicator('updatedAt')}
                        </th>
                      )}
                      {visibleColumns.includes('action') && <th className="w-36 px-3 py-2">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ entry, displayIndex }) => (
                      <tr
                        key={entry.id}
                        className={`border-b ${
                          !entry.isDeleted && duplicateAmountIds.has(entry.id) ? 'bg-rose-50' : ''
                        } ${entry.isDeleted ? 'text-slate-400 line-through' : ''} ${
                          canEdit && !entry.isDeleted ? 'cursor-pointer' : ''
                        }`}
                        onClick={handleRowSelect(entry)}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                            checked={selectedIdSet.has(entry.id)}
                            disabled={!canEdit || entry.isDeleted}
                            onChange={() => toggleEntrySelection(entry.id)}
                            aria-label={`选择记录 ${displayIndex}`}
                          />
                        </td>
                        {visibleColumns.includes('sequence') && <td className="px-3 py-2">{displayIndex}</td>}
                        {visibleColumns.includes('project') && <td className="px-3 py-2">{entry.projectName}</td>}
                        {visibleColumns.includes('category') && (
                          <td className="px-3 py-2">
                            {entry.categoryPath.map((c) => c.label).join(' / ')}
                          </td>
                        )}
                        {visibleColumns.includes('reason') && <td className="px-3 py-2">{entry.reason}</td>}
                        {visibleColumns.includes('amount') && (
                          <td className="px-3 py-2">
                            {entry.amount}
                          </td>
                        )}
                        {visibleColumns.includes('unit') && <td className="px-3 py-2">{entry.unitName}</td>}
                        {visibleColumns.includes('paymentType') && (
                          <td className="px-3 py-2">{entry.paymentTypeName}</td>
                        )}
                        {visibleColumns.includes('paymentDate') && (
                          <td className="px-3 py-2">{formatDateInput(entry.paymentDate)}</td>
                        )}
                        {visibleColumns.includes('paymentStatus') && (
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${paymentStatusBadgeStyles[entry.paymentStatus]}`}
                            >
                              {paymentStatusLabels[entry.paymentStatus]}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('handler') && (
                          <td className="px-3 py-2">{entry.handlerName || entry.handlerUsername || '—'}</td>
                        )}
                        {visibleColumns.includes('createdBy') && (
                          <td className="px-3 py-2">
                            {entry.createdByName || entry.createdByUsername || '—'}
                          </td>
                        )}
                        {visibleColumns.includes('updatedBy') && (
                          <td className="px-3 py-2">
                            {entry.updatedByName || entry.updatedByUsername || '—'}
                          </td>
                        )}
                        {visibleColumns.includes('remark') && <td className="px-3 py-2">{entry.remark ?? '—'}</td>}
                        {visibleColumns.includes('tax') && <td className="px-3 py-2">{entry.tva ?? '—'}</td>}
                        {visibleColumns.includes('updatedAt') && (
                          <td className="px-3 py-2">
                            {new Date(entry.updatedAt).toLocaleString('zh-CN')}
                          </td>
                        )}
                        {visibleColumns.includes('action') && (
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200"
                                onClick={() => setViewingEntry({ entry, displayIndex })}
                              >
                                查看
                              </button>
                              {canEdit && !entry.isDeleted && (
                                <button
                                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                                  onClick={() => handleEdit(entry)}
                                >
                                  编辑
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                                  onClick={() => setDeleteTarget(entry)}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!tableRows.length && (
                      <tr>
                        <td colSpan={tableColumnCount} className="px-3 py-6 text-center text-slate-500">
                          暂无数据，调整筛选试试。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-sm text-slate-600">
                  共 {totalEntries} 条 · 第 {listFilters.page}/{totalPages} 页
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-600">每页</span>
                  <select
                    className="rounded border border-slate-200 bg-white px-2 py-1 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={listFilters.pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                  >
                    {pageSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size} 条
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded border border-slate-200 px-2 py-1 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={() => changePage(listFilters.page - 1)}
                      disabled={listFilters.page <= 1}
                    >
                      上一页
                    </button>
                    <div className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-sm">
                      {listFilters.page} / {totalPages}
                    </div>
                    <button
                      className="rounded border border-slate-200 px-2 py-1 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={() => changePage(listFilters.page + 1)}
                      disabled={listFilters.page >= totalPages}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-white shadow">
                  <p className="text-xs uppercase tracking-wide text-emerald-50">总金额</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {insights ? insights.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—'}
                  </p>
                  <p className="text-xs text-emerald-50">
                    {insights?.entryCount ? `共 ${insights.entryCount} 笔` : '暂无记录'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-emerald-50">
                  <p className="text-xs font-semibold text-slate-600">平均金额</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {insights ? insights.averageAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {insights?.latestPaymentDate ? `最近支付：${formatDateInput(insights.latestPaymentDate)}` : '等待首笔数据'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-emerald-50">
                  <p className="text-xs font-semibold text-slate-600">高频分类</p>
                  {insights?.topCategories?.length ? (
                    <div className="mt-2 space-y-2">
                      {insights.topCategories.slice(0, 2).map((cat, idx) => (
                        <div key={cat.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-slate-800">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: ['#0f766e', '#0ea5e9', '#f97316'][idx] ?? '#0f172a' }}
                            />
                            {cat.label}
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <div>{cat.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                            <div>{cat.share}% 占比</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">等待分类数据</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">分类占比</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        {(() => {
                          const rootPath: { key: string; label: string }[] = []
                          if (classificationBreakdown?.rootKey) {
                            const buildPath = (key: string) => {
                              const node = categoryMap.get(key)
                              if (node?.parentKey) buildPath(node.parentKey)
                              if (node) rootPath.push({ key: node.key, label: node.labelZh })
                            }
                            buildPath(classificationBreakdown.rootKey)
                          }
                          if (!rootPath.length) {
                            rootPath.push({
                              key: '',
                              label: listFilters.categoryKeys.length > 1 ? '已选分类' : '全部分类',
                            })
                          }
                          return rootPath.map((node, idx) => (
                            <span key={node.key || idx} className="flex items-center gap-1">
                              <button
                                className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                                onClick={() => {
                                  setListDraft((prev) => ({
                                    ...prev,
                                    categoryKeys: node.key ? [node.key] : [],
                                    page: 1,
                                  }))
                                  setListFilters((prev) => ({
                                    ...prev,
                                    categoryKeys: node.key ? [node.key] : [],
                                    page: 1,
                                  }))
                                  setViewMode('charts')
                                }}
                              >
                                {node.label}
                              </button>
                              {idx < rootPath.length - 1 && <span className="text-slate-400">/</span>}
                            </span>
                          ))
                        })()}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      {classificationBreakdown?.rootLabel ?? '全部分类'}
                    </span>
                  </div>
                  {insightsLoading && <p className="text-xs text-slate-500">分析加载中...</p>}
                  {classificationBreakdown ? (
                    classificationBreakdown.children.length ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr]">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const top = classificationBreakdown.children
                            const total = top.reduce((sum, cat) => sum + cat.amount, 0)
                            if (!total) return <p className="text-sm text-slate-500">暂无金额</p>
                            let start = 0
                            const colors = ['#0f766e', '#0ea5e9', '#f97316', '#6366f1', '#f43f5e', '#14b8a6', '#8b5cf6', '#22d3ee']
                            const slices = top.map((cat, idx) => {
                              const angle = (cat.amount / total) * 360
                              const end = start + angle
                              const segment = `${colors[idx % colors.length]} ${start}deg ${end}deg`
                              start = end
                              return segment
                            })
                            return (
                              <div className="relative h-40 w-40">
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{ backgroundImage: `conic-gradient(${slices.join(',')})` }}
                                />
                                <div className="absolute inset-6 rounded-full bg-white shadow-inner" />
                                <div className="absolute inset-10 flex items-center justify-center">
                                  <div className="text-center text-xs text-slate-600">
                                    <p className="font-semibold text-slate-900">总额</p>
                                    <p className="mt-1 text-sm">
                                      {total.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                        <div className="space-y-2">
                          {classificationBreakdown.children.map((cat, idx) => (
                            <button
                              key={cat.key}
                              onClick={() => {
                                setListDraft((prev) => ({ ...prev, categoryKeys: [cat.key], page: 1 }))
                                setListFilters((prev) => ({ ...prev, categoryKeys: [cat.key], page: 1 }))
                                setViewMode('charts')
                              }}
                              className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                      backgroundColor: [
                                        '#0f766e',
                                        '#0ea5e9',
                                        '#f97316',
                                        '#6366f1',
                                        '#f43f5e',
                                        '#14b8a6',
                                        '#8b5cf6',
                                        '#22d3ee',
                                      ][idx % 8],
                                    }}
                                  />
                                  {cat.label}
                                </div>
                                <div className="text-right text-xs text-slate-600">
                                  <p>{cat.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
                                  <p>{cat.share}%</p>
                                </div>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(cat.share, 100)}%`,
                                    background:
                                      'linear-gradient(90deg, rgba(16,185,129,0.8) 0%, rgba(59,130,246,0.7) 100%)',
                                  }}
                                />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">当前筛选下暂无子分类数据</p>
                    )
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">暂无分类数据</p>
                  )}
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">按月趋势</p>
                      <p className="text-xs text-slate-500">金额折线，点按月份可聚焦</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                      {insights?.monthlyTrend.length ?? 0} 个月
                    </span>
                  </div>
                  <div className="mt-3 h-52 w-full overflow-hidden rounded-lg bg-slate-50 p-3">
                    {insights?.monthlyTrend?.length ? (
                      (() => {
                        const trend = insights.monthlyTrend
                        const maxVal = Math.max(...trend.map((item) => item.amount), 1)
                        const points = trend.map((item, idx) => {
                          const x = (idx / Math.max(trend.length - 1, 1)) * 100
                          const y = 100 - (item.amount / maxVal) * 90
                          return `${x},${y}`
                        })
                        return (
                          <svg viewBox="0 0 100 100" className="h-full w-full text-emerald-600">
                            <defs>
                              <linearGradient id="trend" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <polygon
                              fill="url(#trend)"
                              points={`0,100 ${points.join(' ')} 100,100`}
                              className="transition-all"
                            />
                            <polyline
                              fill="none"
                              stroke="url(#trend)"
                              strokeWidth="1.2"
                              points={points.join(' ')}
                              strokeLinecap="round"
                            />
                            {trend.map((item, idx) => {
                              const x = (idx / Math.max(trend.length - 1, 1)) * 100
                              const y = 100 - (item.amount / maxVal) * 90
                              const labelY = Math.max(y - 8, 12)
                              return (
                                <g key={item.month}>
                                  <circle cx={x} cy={y} r={1.4} fill="#0ea5e9" />
                                  <text
                                    x={x}
                                    y={labelY}
                                    textAnchor="middle"
                                    fontSize="6"
                                    fill="#0f172a"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {item.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                                  </text>
                                  <text
                                    x={x}
                                    y={97}
                                    textAnchor="middle"
                                    fontSize="6"
                                    fill="#1f2937"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {item.month.slice(5)}
                                  </text>
                                </g>
                              )
                            })}
                          </svg>
                        )
                      })()
                    ) : (
                      <p className="text-sm text-slate-500">暂无趋势数据</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 min-w-0 md:grid-cols-2 xl:grid-cols-3">
                <div className="w-full min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">支付状态分布</p>
                      <p className="text-xs text-slate-500">含待支付金额，可快速筛选</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {insights?.paymentStatusBreakdown.length ?? 0} 类
                    </span>
                  </div>
                  {insights?.paymentStatusBreakdown?.length ? (
                    <div className="mt-3 space-y-2">
                      {insights.paymentStatusBreakdown.map((item) => (
                        <button
                          key={item.status}
                          onClick={() => {
                            setListDraft((prev) => ({
                              ...prev,
                              paymentStatuses: [item.status],
                              page: 1,
                            }))
                            setListFilters((prev) => ({
                              ...prev,
                              paymentStatuses: [item.status],
                              page: 1,
                            }))
                            setViewMode('table')
                            setRefreshKey((prev) => prev + 1)
                          }}
                          className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusBadgeStyles[item.status]}`}
                              >
                                {paymentStatusLabels[item.status]}
                              </span>
                              <span className="text-xs text-slate-500">{item.count} 笔</span>
                            </div>
                            <div className="text-right text-xs text-slate-600">
                              <div>{item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                              <div>{item.share}%</div>
                            </div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${Math.min(item.share, 100)}%`,
                                background: paymentStatusBarStyles[item.status],
                              }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">暂无状态数据</p>
                  )}
                </div>
                <div className="w-full min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">支付方式分布</p>
                      <p className="text-xs text-slate-500">按金额排序，可快速筛选</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {insights?.paymentBreakdown.length ?? 0} 种
                    </span>
                  </div>
                  {insights?.paymentBreakdown?.length ? (
                    <div className="mt-3 w-full max-w-full space-y-2">
                      {insights.paymentBreakdown.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setListDraft((prev) => ({ ...prev, paymentTypeIds: [item.id], page: 1 }))
                            setListFilters((prev) => ({ ...prev, paymentTypeIds: [item.id], page: 1 }))
                            setViewMode('table')
                            setRefreshKey((prev) => prev + 1)
                          }}
                          className="w-full max-w-full rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2 break-words font-medium text-slate-900">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: ['#0ea5e9', '#10b981', '#f97316', '#6366f1', '#f43f5e'][idx % 5] }}
                              />
                              {item.name}
                            </span>
                            <span className="min-w-[120px] text-right text-xs text-slate-600">
                              {item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} · {item.share}%
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${Math.min(item.share, 100)}%`,
                                background:
                                  'linear-gradient(90deg, rgba(14,165,233,0.85) 0%, rgba(59,130,246,0.7) 100%)',
                              }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">暂无支付方式数据</p>
                  )}
                </div>

                <div className="w-full min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">待支付清单</p>
                      <p className="text-xs text-slate-500">仅展示待支付条目，按金额排序</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Top 5</span>
                  </div>
                  {pendingEntries.length ? (
                    <div className="mt-3 w-full max-w-full space-y-2">
                      {[...pendingEntries]
                        .sort((a, b) => b.amount - a.amount)
                        .slice(0, 5)
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate font-semibold">{entry.reason}</div>
                              <div className="text-xs text-slate-500">{formatDateInput(entry.paymentDate)}</div>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                              <span className="min-w-0 break-words">
                                {entry.categoryPath.map((c) => c.label).join(' / ')}
                              </span>
                              <span className="font-semibold text-emerald-700">
                                {entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} {entry.unitName}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">暂无待支付条目</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      {canEdit && showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-8">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 max-h-[80vh]">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-semibold">{editingId ? '编辑财务记录' : '新增财务记录'}</h2>
              </div>
              <button
                onClick={() => {
                  setShowEntryModal(false)
                  resetForm()
                }}
                className="rounded-full border border-white/30 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">所属项目</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={form.projectId}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value ? Number(e.target.value) : '' }))}
                >
                  <option value="">选择项目</option>
                  {metadata?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">支付方式</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={form.paymentTypeId}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentTypeId: e.target.value ? Number(e.target.value) : '' }))}
                >
                  <option value="">选择支付方式</option>
                  {metadata?.paymentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">事由</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="如：采购油料、支付人工、补贴等"
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </label>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-700">分类</span>
                <div className="relative" ref={formCategoryRef}>
                  <button
                    type="button"
                    onClick={() => setFormCategoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="line-clamp-2 break-words text-slate-900">
                      {selectedCategoryLabel}
                    </span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {formCategoryOpen && (
                    <div
                      className="absolute inset-x-0 z-30 mt-2 rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setFormCategoryOpen(false)}
                    >
                      <div className="border-b border-slate-100 p-2">
                        <input
                          className="w-full rounded border px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                          placeholder="搜索分类"
                          value={formCategorySearch}
                          onChange={(e) => setFormCategorySearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        {filteredFormCategoryOptions.length ? (
                          filteredFormCategoryOptions.map((cat) => (
                            <button
                              key={cat.key}
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition ${
                                form.categoryKey === cat.key ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
                              }`}
                              onClick={() => {
                                setForm((prev) => ({ ...prev, categoryKey: cat.key }))
                                setFormCategoryOpen(false)
                                setFormCategorySearch('')
                              }}
                            >
                              <span className="line-clamp-2 break-words">{cat.label}</span>
                              {form.categoryKey === cat.key && <span className="text-xs">已选</span>}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-3 text-sm text-slate-500">无匹配分类</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">金额</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="请输入金额"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">单位</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={form.unitId}
                    onChange={(e) => setForm((prev) => ({ ...prev, unitId: e.target.value ? Number(e.target.value) : '' }))}
                  >
                    <option value="">金额单位</option>
                    {metadata?.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">税费 (可选)</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="0.00"
                    value={form.tva}
                    onChange={(e) => setForm((prev) => ({ ...prev, tva: e.target.value }))}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">支付日期</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">支付状态</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={form.paymentStatus}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, paymentStatus: e.target.value as PaymentStatus }))
                    }
                  >
                    {paymentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">经办人</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={form.handlerId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        handlerId: e.target.value ? Number(e.target.value) : '',
                      }))
                    }
                  >
                    <option value="">选择经办人</option>
                    {metadata?.handlers.map((handler) => (
                      <option key={handler.id} value={handler.id}>
                        {handler.name || handler.username}（{handler.username}）
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">备注 (可选)</span>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="发票号/供应商"
                  value={form.remark}
                  rows={3}
                  onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  重置
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  确认保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canEdit && showBulkEditModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-8">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 max-h-[80vh]">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-semibold">批量编辑财务记录</h2>
                <p className="text-xs text-emerald-50">
                  已选 {selectedEntryIds.length} 条 · 留空表示不修改
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBulkEditModal(false)
                  setBulkPatch({})
                  setBulkCategoryOpen(false)
                  setBulkCategorySearch('')
                }}
                className="rounded-full border border-white/30 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">所属项目</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={bulkPatch.projectId ? String(bulkPatch.projectId) : ''}
                  onChange={(e) =>
                    updateBulkPatchField(
                      'projectId',
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                >
                  <option value="">不修改</option>
                  {metadata?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">支付方式</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={bulkPatch.paymentTypeId ? String(bulkPatch.paymentTypeId) : ''}
                  onChange={(e) =>
                    updateBulkPatchField(
                      'paymentTypeId',
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                >
                  <option value="">不修改</option>
                  {metadata?.paymentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">事由</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="留空不修改"
                  value={bulkPatch.reason ?? ''}
                  onChange={(e) =>
                    updateBulkPatchField(
                      'reason',
                      e.target.value.trim() ? e.target.value : undefined,
                    )
                  }
                />
              </label>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-700">分类</span>
                <div className="relative" ref={bulkCategoryRef}>
                  <button
                    type="button"
                    onClick={() => setBulkCategoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="line-clamp-2 break-words text-slate-900">
                      {selectedBulkCategoryLabel}
                    </span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {bulkCategoryOpen && (
                    <div
                      className="absolute inset-x-0 z-30 mt-2 rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setBulkCategoryOpen(false)}
                    >
                      <div className="border-b border-slate-100 p-2">
                        <input
                          className="w-full rounded border px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                          placeholder="搜索分类"
                          value={bulkCategorySearch}
                          onChange={(e) => setBulkCategorySearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        {filteredBulkCategoryOptions.length ? (
                          filteredBulkCategoryOptions.map((cat) => (
                            <button
                              key={cat.key}
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition ${
                                bulkPatch.categoryKey === cat.key
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'hover:bg-slate-50'
                              }`}
                              onClick={() => {
                                updateBulkPatchField('categoryKey', cat.key)
                                setBulkCategoryOpen(false)
                                setBulkCategorySearch('')
                              }}
                            >
                              <span className="line-clamp-2 break-words">{cat.label}</span>
                              {bulkPatch.categoryKey === cat.key && <span className="text-xs">已选</span>}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-3 text-sm text-slate-500">无匹配分类</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">金额</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="留空不修改"
                    value={bulkPatch.amount ?? ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'amount',
                        e.target.value.trim() ? e.target.value : undefined,
                      )
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">单位</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={bulkPatch.unitId ? String(bulkPatch.unitId) : ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'unitId',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  >
                    <option value="">不修改</option>
                    {metadata?.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">税费 (可选)</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="留空不修改"
                    value={bulkPatch.tva ?? ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'tva',
                        e.target.value.trim() ? e.target.value : undefined,
                      )
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">支付日期</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    type="date"
                    value={bulkPatch.paymentDate ?? ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'paymentDate',
                        e.target.value ? e.target.value : undefined,
                      )
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">支付状态</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={bulkPatch.paymentStatus ?? ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'paymentStatus',
                        isPaymentStatus(e.target.value) ? e.target.value : undefined,
                      )
                    }
                  >
                    <option value="">不修改</option>
                    {paymentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">经办人</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={bulkPatch.handlerId ? String(bulkPatch.handlerId) : ''}
                    onChange={(e) =>
                      updateBulkPatchField(
                        'handlerId',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  >
                    <option value="">不修改</option>
                    {metadata?.handlers.map((handler) => (
                      <option key={handler.id} value={handler.id}>
                        {handler.name || handler.username}（{handler.username}）
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">备注 (可选)</span>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="留空不修改"
                  value={bulkPatch.remark ?? ''}
                  rows={3}
                  onChange={(e) =>
                    updateBulkPatchField(
                      'remark',
                      e.target.value.trim() ? e.target.value : undefined,
                    )
                  }
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setBulkPatch({})}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  重置
                </button>
                <button
                  onClick={handleBulkSave}
                  disabled={bulkSaving || bulkPatchEmpty}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {bulkSaving ? '正在保存...' : '确认保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">确认删除</p>
                <p className="text-sm text-slate-600">
                  确定删除「{deleteTarget.reason}」吗？删除后无法恢复，请谨慎操作。
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  if (deletingId) return
                  setDeleteTarget(null)
                }}
                aria-label="关闭删除确认"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-slate-700">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 ring-1 ring-amber-100">删除后无法恢复。</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => {
                  if (deletingId) return
                  setDeleteTarget(null)
                }}
                disabled={Boolean(deletingId)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60"
                onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? '正在删除...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingEntry && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-8">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 max-h-[85vh]">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">查看详情</span>
                <h2 className="mt-2 text-xl font-semibold">财务记录 #{viewingEntry.displayIndex}</h2>
              </div>
              <button
                onClick={() => setViewingEntry(null)}
                className="rounded-full border border-white/30 px-3 py-1 text-sm font-medium text-white hover:bg-white/15"
              >
                关闭
              </button>
            </div>
            <div className="space-y-3 p-6 text-sm text-slate-800">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-1">项目：{viewingEntry.entry.projectName}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  分类：{viewingEntry.entry.categoryPath.map((c) => c.label).join(' / ')}
                </span>
                {viewingEntry.entry.isDeleted && (
                  <span className="rounded-full bg-red-50 px-2 py-1 text-red-700 ring-1 ring-red-100">已软删除</span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">事由</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{viewingEntry.entry.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    备注：{viewingEntry.entry.remark ? viewingEntry.entry.remark : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">金额</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-700">
                    {viewingEntry.entry.amount} {viewingEntry.entry.unitName}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">税费：{viewingEntry.entry.tva ?? '—'}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">支付方式</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{viewingEntry.entry.paymentTypeName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>支付日期：{formatDateInput(viewingEntry.entry.paymentDate)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusBadgeStyles[viewingEntry.entry.paymentStatus]}`}
                    >
                      {paymentStatusLabels[viewingEntry.entry.paymentStatus]}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">经办人</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {viewingEntry.entry.handlerName || viewingEntry.entry.handlerUsername || '—'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">编号：{viewingEntry.entry.id}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">创建</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {viewingEntry.entry.createdByName || viewingEntry.entry.createdByUsername || '—'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    时间：{new Date(viewingEntry.entry.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">最近更新</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {viewingEntry.entry.updatedByName ||
                      viewingEntry.entry.updatedByUsername ||
                      viewingEntry.entry.createdByName ||
                      viewingEntry.entry.createdByUsername ||
                      '—'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    时间：{new Date(viewingEntry.entry.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between pb-4">
              <div>
                <h2 className="text-lg font-semibold">主数据管理</h2>
                <p className="text-sm text-slate-600">新增/编辑后自动调用后端并刷新元数据。</p>
              </div>
              <button
                onClick={() => {
                  resetManageForms()
                  setShowManage(false)
                }}
                className="rounded-full px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
              >
                关闭
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">项目</h3>
                  {editingProjectId && <span className="text-xs text-amber-600">编辑中 #{editingProjectId}</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="项目名称"
                    value={manageProject.name}
                    onChange={(e) => setManageProject((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="项目编码 (可选)"
                    value={manageProject.code}
                    onChange={(e) => setManageProject((prev) => ({ ...prev, code: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={manageProject.isActive}
                      onChange={(e) => setManageProject((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    启用
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveProject}
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    {editingProjectId ? '保存项目' : '新增项目'}
                  </button>
                  {editingProjectId && (
                    <button
                      onClick={() => {
                        setManageProject({ name: '', code: '', isActive: true })
                        setEditingProjectId(null)
                      }}
                      className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      取消编辑
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-slate-100 p-2">
                  {metadata?.projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{project.name}</p>
                        <p className="text-xs text-slate-500">
                          {project.code || '—'} {project.isActive ? '' : '（已停用）'}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          className="rounded border px-2 py-1 text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setManageProject({ name: project.name, code: project.code ?? '', isActive: project.isActive })
                            setEditingProjectId(project.id)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                          onClick={() => deleteProject(project.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                  {!metadata?.projects.length && <p className="text-sm text-slate-500">暂无项目</p>}
                </div>
              </div>

              <div className="space-y-3 rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">金额单位</h3>
                  {editingUnitId && <span className="text-xs text-amber-600">编辑中 #{editingUnitId}</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="单位名称"
                    value={manageUnit.name}
                    onChange={(e) => setManageUnit((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="符号 (可选)"
                    value={manageUnit.symbol}
                    onChange={(e) => setManageUnit((prev) => ({ ...prev, symbol: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={manageUnit.isActive}
                      onChange={(e) => setManageUnit((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    启用
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveUnit}
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    {editingUnitId ? '保存金额单位' : '新增金额单位'}
                  </button>
                  {editingUnitId && (
                    <button
                      onClick={() => {
                        setManageUnit({ name: '', symbol: '', isActive: true })
                        setEditingUnitId(null)
                      }}
                      className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      取消编辑
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-slate-100 p-2">
                  {metadata?.units.map((unit) => (
                    <div key={unit.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{unit.name}</p>
                        <p className="text-xs text-slate-500">
                          {unit.symbol || '—'} {unit.isActive ? '' : '（已停用）'}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          className="rounded border px-2 py-1 text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setManageUnit({ name: unit.name, symbol: unit.symbol ?? '', isActive: unit.isActive })
                            setEditingUnitId(unit.id)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                          onClick={() => deleteUnit(unit.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                  {!metadata?.units.length && <p className="text-sm text-slate-500">暂无金额单位</p>}
                </div>
              </div>

              <div className="space-y-3 rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">支付方式</h3>
                  {editingPaymentTypeId && <span className="text-xs text-amber-600">编辑中 #{editingPaymentTypeId}</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="支付方式名称"
                    value={managePayment.name}
                    onChange={(e) => setManagePayment((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={managePayment.isActive}
                      onChange={(e) => setManagePayment((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    启用
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={savePaymentType}
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    {editingPaymentTypeId ? '保存支付方式' : '新增支付方式'}
                  </button>
                  {editingPaymentTypeId && (
                    <button
                      onClick={() => {
                        setManagePayment({ name: '', isActive: true })
                        setEditingPaymentTypeId(null)
                      }}
                      className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      取消编辑
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-slate-100 p-2">
                  {metadata?.paymentTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{type.name}</p>
                        <p className="text-xs text-slate-500">{type.isActive ? '启用中' : '已停用'}</p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          className="rounded border px-2 py-1 text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setManagePayment({ name: type.name, isActive: type.isActive })
                            setEditingPaymentTypeId(type.id)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                          onClick={() => deletePaymentType(type.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                  {!metadata?.paymentTypes.length && <p className="text-sm text-slate-500">暂无支付方式</p>}
                </div>
              </div>

              <div className="space-y-3 rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">分类树</h3>
                  {editingCategoryKey && <span className="text-xs text-amber-600">编辑中 {editingCategoryKey}</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Key（唯一）"
                    value={manageCategory.key}
                    onChange={(e) => setManageCategory((prev) => ({ ...prev, key: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="父级 key（可选）"
                    value={manageCategory.parentKey}
                    onChange={(e) => setManageCategory((prev) => ({ ...prev, parentKey: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="中文名称"
                    value={manageCategory.labelZh}
                    onChange={(e) => setManageCategory((prev) => ({ ...prev, labelZh: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="排序（数字，可选）"
                    value={manageCategory.sortOrder}
                    onChange={(e) => setManageCategory((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={manageCategory.isActive}
                      onChange={(e) => setManageCategory((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    启用
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveCategory}
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    {editingCategoryKey ? '保存分类' : '新增/更新分类'}
                  </button>
                  {(editingCategoryKey || manageCategory.key) && (
                    <button
                      onClick={() => {
                        setManageCategory({ key: '', parentKey: '', labelZh: '', sortOrder: '', isActive: true })
                        setEditingCategoryKey(null)
                      }}
                      className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      清空表单
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-slate-100 p-2">
                  {manageCategories.map((cat) => (
                    <div key={cat.key} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{cat.label}</p>
                        <p className="text-xs text-slate-500">
                          key: {cat.key} {cat.isActive ? '' : '（已停用）'}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          className="rounded border px-2 py-1 text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            const node = categoryMap.get(cat.key)
                            setManageCategory({
                              key: cat.key,
                              parentKey: node?.parentKey ?? '',
                              labelZh: node?.labelZh ?? cat.label.split(' / ').slice(-1)[0] ?? '',
                              sortOrder: String(node?.sortOrder ?? 0),
                              isActive: node?.isActive ?? true,
                            })
                            setEditingCategoryKey(cat.key)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                          onClick={() => deleteCategoryByKey(cat.key)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                  {!manageCategories.length && <p className="text-sm text-slate-500">暂无分类</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
        )
      ) : null}
    </div>
  )
}
