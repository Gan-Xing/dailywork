'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type FinanceCategoryDTO = {
  key: string
  parentKey: string | null
  labelZh: string
  code?: string | null
  sortOrder: number
  children?: FinanceCategoryDTO[]
}

type Project = { id: number; name: string; code: string | null; isActive: boolean }
type Unit = { id: number; name: string; symbol: string | null; isActive: boolean }
type PaymentType = { id: number; name: string; isActive: boolean }
type Handler = { id: number; name: string; username: string }

type Metadata = {
  projects: Project[]
  units: Unit[]
  paymentTypes: PaymentType[]
  categories: FinanceCategoryDTO[]
  handlers: Handler[]
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
  tva?: number
  remark?: string | null
  isDeleted: boolean
}

type FinanceInsights = {
  totalAmount: number
  entryCount: number
  averageAmount: number
  latestPaymentDate?: string | null
  topCategories: { key: string; label: string; amount: number; count: number; share: number }[]
  paymentBreakdown: { id: number; name: string; amount: number; count: number; share: number }[]
  monthlyTrend: { month: string; amount: number; count: number }[]
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
  tva: string
  remark: string
}

type ListFilters = {
  projectIds: number[]
  categoryKeys: string[]
  paymentTypeIds: number[]
  handlerIds: number[]
  reasonKeyword: string
  amountMin: string
  amountMax: string
  dateFrom: string
  dateTo: string
  sortField: 'paymentDate' | 'amount' | 'category'
  sortDir: 'asc' | 'desc'
}

const formatDateInput = (iso: string) => iso.split('T')[0]

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

const toggleValue = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const COLUMN_STORAGE_KEY = 'finance-visible-columns'
const defaultVisibleColumns = ['sequence', 'project', 'reason', 'amount', 'unit', 'handler', 'action'] as const

export default function FinancePage() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [listFilters, setListFilters] = useState<ListFilters>({
    projectIds: [],
    categoryKeys: [],
    paymentTypeIds: [],
    handlerIds: [],
    reasonKeyword: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    sortField: 'paymentDate',
    sortDir: 'desc',
  })
  const [listDraft, setListDraft] = useState<ListFilters>({
    projectIds: [],
    categoryKeys: [],
    paymentTypeIds: [],
    handlerIds: [],
    reasonKeyword: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    sortField: 'paymentDate',
    sortDir: 'desc',
  })
  const [categorySearch, setCategorySearch] = useState('')
  const [projectOpen, setProjectOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [handlerOpen, setHandlerOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'charts'>('table')
  const [insights, setInsights] = useState<FinanceInsights | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...defaultVisibleColumns])
  const [form, setForm] = useState<EntryForm>({
    projectId: '',
    reason: '',
    categoryKey: '',
    amount: '',
    unitId: '',
    paymentTypeId: '',
    handlerId: '',
    paymentDate: formatDateInput(new Date().toISOString()),
    tva: '',
    remark: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [manageProject, setManageProject] = useState({ name: '', code: '' })
  const [manageUnit, setManageUnit] = useState({ name: '', symbol: '' })
  const [managePayment, setManagePayment] = useState({ name: '' })
  const [manageCategory, setManageCategory] = useState({
    key: '',
    parentKey: '',
    labelZh: '',
    sortOrder: '',
  })
  const [showManage, setShowManage] = useState(false)
  const [showColumnChooser, setShowColumnChooser] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<{ entry: FinanceEntry; displayIndex: number } | null>(null)

  const canView = session?.permissions.includes('finance:view') ?? false
  const canEdit = session?.permissions.includes('finance:edit') ?? false
  const canManage = session?.permissions.includes('finance:manage') ?? false
  const shouldShowAccessDenied = authLoaded && !canView

  const categoryOptions = useMemo(
    () => (metadata ? buildCategoryOptions(metadata.categories, '') : []),
    [metadata],
  )
  const categoryOptionsWithParents = useMemo(
    () => (metadata ? buildCategoryOptionsWithParents(metadata.categories, '') : []),
    [metadata],
  )
  const filteredCategoryOptions = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase()
    if (!keyword) return categoryOptionsWithParents
    return categoryOptionsWithParents.filter((cat) => cat.label.toLowerCase().includes(keyword))
  }, [categoryOptionsWithParents, categorySearch])

  const defaultHandlerId = useMemo(() => {
    const match = metadata?.handlers.find((handler) => handler.name === '何柳琴' || handler.username === '何柳琴')
    return match?.id ?? ''
  }, [metadata?.handlers])

  const projectLabel = useMemo(() => {
    if (!metadata?.projects?.length || !listDraft.projectIds.length) return '全部项目'
    const names = metadata.projects
      .filter((project) => listDraft.projectIds.includes(project.id))
      .map((project) => project.name)
    if (!names.length) return '全部项目'
    return names.length <= 2 ? names.join('、') : `${names[0]}等${names.length}个`
  }, [listDraft.projectIds, metadata?.projects])

  const paymentLabel = useMemo(() => {
    if (!metadata?.paymentTypes?.length || !listDraft.paymentTypeIds.length) return '全部支付方式'
    const names = metadata.paymentTypes
      .filter((type) => listDraft.paymentTypeIds.includes(type.id))
      .map((type) => type.name)
    if (!names.length) return '全部支付方式'
    return names.length <= 2 ? names.join('、') : `${names[0]}等${names.length}个`
  }, [listDraft.paymentTypeIds, metadata?.paymentTypes])

  const handlerLabel = useMemo(() => {
    if (!metadata?.handlers?.length || !listDraft.handlerIds.length) return '全部经办人'
    const names = metadata.handlers
      .filter((handler) => listDraft.handlerIds.includes(handler.id))
      .map((handler) => handler.name || handler.username)
    if (!names.length) return '全部经办人'
    return names.length <= 2 ? names.join('、') : `${names[0]}等${names.length}个`
  }, [listDraft.handlerIds, metadata?.handlers])

  const categoryLabel = useMemo(() => {
    if (!categoryOptionsWithParents.length || !listDraft.categoryKeys.length) return '全部分类'
    const labels = categoryOptionsWithParents
      .filter((cat) => listDraft.categoryKeys.includes(cat.key))
      .map((cat) => cat.label)
    if (!labels.length) return '全部分类'
    return labels.length <= 2 ? labels.join('、') : `${labels[0]}等${labels.length}个`
  }, [categoryOptionsWithParents, listDraft.categoryKeys])

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

  const filteredEntries = useMemo(() => {
    let result = [...entries]
    if (listFilters.categoryKeys.length) {
      result = result.filter((e) => e.categoryPath.some((c) => listFilters.categoryKeys.includes(c.key)))
    }
    if (listFilters.projectIds.length) {
      result = result.filter((e) => listFilters.projectIds.includes(e.projectId))
    }
    if (listFilters.paymentTypeIds.length) {
      result = result.filter((e) => listFilters.paymentTypeIds.includes(e.paymentTypeId))
    }
    if (listFilters.handlerIds.length) {
      result = result.filter((e) => (e.handlerId ? listFilters.handlerIds.includes(e.handlerId) : false))
    }
    if (listFilters.reasonKeyword.trim()) {
      const keyword = listFilters.reasonKeyword.trim().toLowerCase()
      result = result.filter((e) => e.reason.toLowerCase().includes(keyword))
    }
    if (listFilters.amountMin !== '') {
      const min = Number(listFilters.amountMin)
      if (Number.isFinite(min)) result = result.filter((e) => e.amount >= min)
    }
    if (listFilters.amountMax !== '') {
      const max = Number(listFilters.amountMax)
      if (Number.isFinite(max)) result = result.filter((e) => e.amount <= max)
    }
    if (listFilters.dateFrom) {
      const from = new Date(listFilters.dateFrom).getTime()
      result = result.filter((e) => new Date(e.paymentDate).getTime() >= from)
    }
    if (listFilters.dateTo) {
      const to = new Date(listFilters.dateTo).getTime()
      result = result.filter((e) => new Date(e.paymentDate).getTime() <= to)
    }

    const sorters: Record<ListFilters['sortField'], (a: FinanceEntry, b: FinanceEntry) => number> = {
      paymentDate: (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
      amount: (a, b) => a.amount - b.amount,
      category: (a, b) =>
        a.categoryPath.map((c) => c.label).join(' / ').localeCompare(b.categoryPath.map((c) => c.label).join(' / ')),
    }
    const sortFn = sorters[listFilters.sortField]
    result.sort((a, b) => {
      const val = sortFn(a, b)
      return listFilters.sortDir === 'asc' ? val : -val
    })
    return result
  }, [entries, listFilters])

  const tableRows = useMemo(
    () => filteredEntries.map((entry, index) => ({ entry, displayIndex: index + 1 })),
    [filteredEntries],
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
    { key: 'handler', label: '经办人' },
    { key: 'remark', label: '备注' },
    { key: 'tax', label: '税费' },
    { key: 'action', label: '操作' },
  ]

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }

  const buildFilterParams = (filtersInput: ListFilters) => {
    const params = new URLSearchParams()
    filtersInput.projectIds.forEach((id) => params.append('projectId', String(id)))
    filtersInput.categoryKeys.forEach((key) => params.append('categoryKey', key))
    filtersInput.paymentTypeIds.forEach((id) => params.append('paymentTypeId', String(id)))
    filtersInput.handlerIds.forEach((id) => params.append('handlerId', String(id)))
    if (filtersInput.reasonKeyword.trim()) params.set('reasonKeyword', filtersInput.reasonKeyword.trim())
    if (filtersInput.amountMin !== '') params.set('amountMin', filtersInput.amountMin)
    if (filtersInput.amountMax !== '') params.set('amountMax', filtersInput.amountMax)
    if (filtersInput.dateFrom) params.set('dateFrom', filtersInput.dateFrom)
    if (filtersInput.dateTo) params.set('dateTo', filtersInput.dateTo)
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
      })
      const defaultProject = data.projects.find((p) => p.name === '邦杜库市政路项目')
      const defaultPayment = data.paymentTypes.find((p) => p.name === '现金支票')
      const defaultUnit = data.units.find((u) => u.name === '西法')
      const defaultCategory = buildCategoryOptions(data.categories, '')[0]?.key
      const defaultHandler =
        data.handlers?.find((handler) => handler.name === '何柳琴' || handler.username === '何柳琴')
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
        projectIds: defaultProject?.id ? [defaultProject.id] : [],
        categoryKeys: [],
        paymentTypeIds: defaultPayment?.id ? [defaultPayment.id] : [],
        handlerIds: [],
        reasonKeyword: '',
        amountMin: '',
        amountMax: '',
        dateFrom: '',
        dateTo: '',
        sortField: 'paymentDate',
        sortDir: 'desc',
      }
      setListDraft(defaults)
      setListFilters(defaults)
      setRefreshKey((prevKey) => prevKey + 1)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [])

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
        const data = (await res.json()) as { entries?: FinanceEntry[]; message?: string }
        if (!res.ok) {
          setMessage(data.message ?? '加载失败')
          return
        }
        setEntries(data.entries ?? [])
      } catch (error) {
        setMessage((error as Error).message)
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
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) {
          setVisibleColumns(parsed)
        }
      }
    } catch (error) {
      console.error('Failed to load visible columns', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns))
    } catch (error) {
      console.error('Failed to persist visible columns', error)
    }
  }, [visibleColumns])

  useEffect(() => {
    if (canView) {
      void loadMetadata()
    }
  }, [canView, loadMetadata])

  const {
    projectIds: filtersProjectIds,
    categoryKeys: filtersCategoryKeys,
    paymentTypeIds: filtersPaymentTypeIds,
    handlerIds: filtersHandlerIds,
    reasonKeyword: filtersReasonKeyword,
    amountMin: filtersAmountMin,
    amountMax: filtersAmountMax,
    dateFrom: filtersDateFrom,
    dateTo: filtersDateTo,
    sortField,
    sortDir,
  } = listFilters

  useEffect(() => {
    if (!canView) return
    const currentFilters: ListFilters = {
      projectIds: filtersProjectIds,
      categoryKeys: filtersCategoryKeys,
      paymentTypeIds: filtersPaymentTypeIds,
      handlerIds: filtersHandlerIds,
      reasonKeyword: filtersReasonKeyword,
      amountMin: filtersAmountMin,
      amountMax: filtersAmountMax,
      dateFrom: filtersDateFrom,
      dateTo: filtersDateTo,
      sortField,
      sortDir,
    }
    void loadEntries(currentFilters)
    void loadInsights(currentFilters)
  }, [
    canView,
    refreshKey,
    filtersProjectIds,
    filtersCategoryKeys,
    filtersPaymentTypeIds,
    filtersHandlerIds,
    filtersReasonKeyword,
    filtersAmountMin,
    filtersAmountMax,
    filtersDateFrom,
    filtersDateTo,
    sortField,
    sortDir,
    loadEntries,
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
    setForm({
      projectId: metadata?.projects.find((p) => p.name === '邦杜库市政路项目')?.id ?? '',
      reason: '',
      categoryKey: categoryOptions[0]?.key ?? '',
      amount: '',
      unitId: metadata?.units.find((u) => u.name === '西法')?.id ?? '',
      paymentTypeId: metadata?.paymentTypes.find((p) => p.name === '现金支票')?.id ?? '',
      handlerId: defaultHandlerId || '',
      paymentDate: formatDateInput(new Date().toISOString()),
      tva: '',
      remark: '',
    })
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!canEdit) return
    if (!form.projectId || !form.reason || !form.categoryKey || !form.amount || !form.unitId || !form.paymentTypeId) {
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
      tva: entry.tva != null ? String(entry.tva) : '',
      remark: entry.remark ?? '',
    })
    setShowEntryModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!canEdit) return
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
      setMessage('已软删除')
      await loadEntries(listFilters)
      await loadInsights(listFilters)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const manageCall = async (path: string, body: Record<string, unknown>) => {
    setLoading(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '保存失败')
        return
      }
      setMessage('已更新主数据')
      await loadMetadata()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (key: string) => {
    if (!key) {
      setMessage('请先填写分类 key')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/finance/categories', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setMessage(data.message ?? '停用分类失败')
        return
      }
      setMessage('已停用分类')
      await loadMetadata()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied
        permissions={['finance:view']}
        hint="请先登录并开通 finance:view 权限以查看财务流水。"
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">财务记账</h1>
          <p className="text-sm text-slate-600">
            按项目录入流水，支持分类、金额单位、支付方式与软删。
          </p>
        </div>
        <div className="text-sm text-slate-600">
          {session ? `已登录：${session.username}` : '未登录'}
        </div>
      </div>

      {!canView && <p className="text-red-600">缺少 finance:view 权限，无法查看财务数据。</p>}
      {message && <p className="rounded bg-yellow-100 px-3 py-2 text-sm text-yellow-800">{message}</p>}

      {canView && (
        <div className="space-y-3 rounded-lg bg-white p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">筛选与操作</h2>
              <p className="text-sm text-slate-600">选择范围后应用筛选并刷新列表。</p>
            </div>
            <div className="flex gap-2">
              {canManage && (
                <button
                  onClick={() => setShowManage(true)}
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
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">项目</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProjectOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="truncate">{projectLabel}</span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {projectOpen && (
                    <div
                      className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setProjectOpen(false)}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                        <span>已选 {listDraft.projectIds.length || '全部'}</span>
                        <div className="flex gap-2">
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              setListDraft((prev) => ({
                                ...prev,
                                projectIds: metadata?.projects.map((p) => p.id) ?? [],
                              }))
                            }
                          >
                            全选
                          </button>
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setListDraft((prev) => ({ ...prev, projectIds: [] }))}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        {metadata?.projects.map((project) => (
                          <label
                            key={project.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={listDraft.projectIds.includes(project.id)}
                              onChange={() =>
                                setListDraft((prev) => ({
                                  ...prev,
                                  projectIds: toggleValue(prev.projectIds, project.id),
                                }))
                              }
                            />
                            <span className="truncate">{project.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="md:col-span-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">支付方式</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPaymentOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="truncate">{paymentLabel}</span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {paymentOpen && (
                    <div
                      className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setPaymentOpen(false)}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                        <span>已选 {listDraft.paymentTypeIds.length || '全部'}</span>
                        <div className="flex gap-2">
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              setListDraft((prev) => ({
                                ...prev,
                                paymentTypeIds: metadata?.paymentTypes.map((p) => p.id) ?? [],
                              }))
                            }
                          >
                            全选
                          </button>
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setListDraft((prev) => ({ ...prev, paymentTypeIds: [] }))}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        {metadata?.paymentTypes.map((type) => (
                          <label
                            key={type.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={listDraft.paymentTypeIds.includes(type.id)}
                              onChange={() =>
                                setListDraft((prev) => ({
                                  ...prev,
                                  paymentTypeIds: toggleValue(prev.paymentTypeIds, type.id),
                                }))
                              }
                            />
                            <span className="truncate">{type.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="md:col-span-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">经办人</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHandlerOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="truncate">{handlerLabel}</span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {handlerOpen && (
                    <div
                      className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setHandlerOpen(false)}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                        <span>已选 {listDraft.handlerIds.length || '全部'}</span>
                        <div className="flex gap-2">
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              setListDraft((prev) => ({
                                ...prev,
                                handlerIds: metadata?.handlers.map((h) => h.id) ?? [],
                              }))
                            }
                          >
                            全选
                          </button>
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setListDraft((prev) => ({ ...prev, handlerIds: [] }))}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        {metadata?.handlers.map((handler) => (
                          <label
                            key={handler.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={listDraft.handlerIds.includes(handler.id)}
                              onChange={() =>
                                setListDraft((prev) => ({
                                  ...prev,
                                  handlerIds: toggleValue(prev.handlerIds, handler.id),
                                }))
                              }
                            />
                            <span className="truncate">{handler.name || handler.username}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="md:col-span-3">
              <div className="relative space-y-1 text-sm">
                <span className="text-slate-700">显示列</span>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowColumnChooser((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    <span className="truncate">
                      {visibleColumns.length ? `已选 ${visibleColumns.length} 列` : '未选择列'}
                    </span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {showColumnChooser && (
                    <div
                      className="absolute z-30 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setShowColumnChooser(false)}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                        <button
                          className="text-emerald-700 hover:underline"
                          onClick={() => setVisibleColumns(columnOptions.map((opt) => opt.key))}
                        >
                          全选
                        </button>
                        <div className="flex gap-2">
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setVisibleColumns([...defaultVisibleColumns])}
                          >
                            恢复默认
                          </button>
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setVisibleColumns([])}
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

            <div className="md:col-span-8">
              <label className="space-y-1 text-sm">
                <span className="text-slate-700">分类</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <span className="truncate">{categoryLabel}</span>
                    <span className="text-xs text-slate-500">⌕</span>
                  </button>
                  {categoryOpen && (
                    <div
                      className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseLeave={() => setCategoryOpen(false)}
                    >
                      <div className="border-b border-slate-100 p-2">
                        <input
                          className="w-full rounded border px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                          placeholder="搜索分类"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                        />
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              setListDraft((prev) => ({
                                ...prev,
                                categoryKeys: filteredCategoryOptions.map((cat) => cat.key),
                              }))
                            }
                          >
                            当前搜索全选
                          </button>
                          <button
                            className="text-slate-600 hover:underline"
                            onClick={() => setListDraft((prev) => ({ ...prev, categoryKeys: [] }))}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-sm">
                        <button
                          className="block w-full rounded px-2 py-1 text-left hover:bg-slate-50"
                          onClick={() => {
                            setListDraft((prev) => ({ ...prev, categoryKeys: [] }))
                            setCategoryOpen(false)
                          }}
                        >
                          全部分类
                        </button>
                        {filteredCategoryOptions.map((cat) => (
                          <label
                            key={cat.key}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-emerald-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={listDraft.categoryKeys.includes(cat.key)}
                              onChange={() =>
                                setListDraft((prev) => ({
                                  ...prev,
                                  categoryKeys: toggleValue(prev.categoryKeys, cat.key),
                                }))
                              }
                            />
                            <span className="truncate">{cat.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="md:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 shadow-sm">
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

            <div className="md:col-span-12 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">日期范围</span>
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
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="flex w-full items-center gap-2 text-sm">
                  <span className="shrink-0 text-slate-700">事由</span>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="模糊搜索事由"
                    value={listDraft.reasonKeyword}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, reasonKeyword: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setListFilters({ ...listDraft })
                    setProjectOpen(false)
                    setPaymentOpen(false)
                    setHandlerOpen(false)
                    setCategoryOpen(false)
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
                      handlerIds: [],
                      reasonKeyword: '',
                      amountMin: '',
                      amountMax: '',
                      dateFrom: '',
                      dateTo: '',
                      sortField: 'paymentDate',
                      sortDir: 'desc',
                    } satisfies ListFilters
                    setListDraft(reset)
                    setListFilters(reset)
                    setProjectOpen(false)
                    setPaymentOpen(false)
                    setHandlerOpen(false)
                    setCategoryOpen(false)
                    setShowColumnChooser(false)
                    setRefreshKey((prev) => prev + 1)
                  }}
                  className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  重置筛选
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">数据视图</h3>
              <p className="text-xs text-slate-500">切换表格/图表，序号按当前筛选从 1 递增</p>
            </div>
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
          {loading && <p className="text-sm text-slate-600">加载中...</p>}
          {viewMode === 'table' ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {visibleColumns.includes('sequence') && <th className="px-3 py-2">序号</th>}
                    {visibleColumns.includes('project') && <th className="px-3 py-2">项目</th>}
                    {visibleColumns.includes('category') && (
                      <th
                        className="px-3 py-2 cursor-pointer select-none"
                        onClick={() =>
                          setListFilters((prev) => {
                            const dir = prev.sortField === 'category' && prev.sortDir === 'asc' ? 'desc' : 'asc'
                            setListDraft((draft) => ({ ...draft, sortField: 'category', sortDir: dir }))
                            return { ...prev, sortField: 'category', sortDir: dir }
                          })
                        }
                      >
                        分类 {listFilters.sortField === 'category' ? (listFilters.sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    )}
                    {visibleColumns.includes('reason') && <th className="px-3 py-2">事由</th>}
                    {visibleColumns.includes('amount') && (
                      <th
                        className="px-3 py-2 cursor-pointer select-none"
                        onClick={() =>
                          setListFilters((prev) => {
                            const dir = prev.sortField === 'amount' && prev.sortDir === 'asc' ? 'desc' : 'asc'
                            setListDraft((draft) => ({ ...draft, sortField: 'amount', sortDir: dir }))
                            return { ...prev, sortField: 'amount', sortDir: dir }
                          })
                        }
                      >
                        金额 {listFilters.sortField === 'amount' ? (listFilters.sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    )}
                    {visibleColumns.includes('unit') && <th className="px-3 py-2">单位</th>}
                    {visibleColumns.includes('paymentType') && <th className="px-3 py-2">支付方式</th>}
                    {visibleColumns.includes('paymentDate') && (
                      <th
                        className="px-3 py-2 cursor-pointer select-none"
                        onClick={() =>
                          setListFilters((prev) => {
                            const dir = prev.sortField === 'paymentDate' && prev.sortDir === 'asc' ? 'desc' : 'asc'
                            setListDraft((draft) => ({ ...draft, sortField: 'paymentDate', sortDir: dir }))
                            return { ...prev, sortField: 'paymentDate', sortDir: dir }
                          })
                        }
                      >
                        支付日期{' '}
                        {listFilters.sortField === 'paymentDate' ? (listFilters.sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    )}
                    {visibleColumns.includes('handler') && <th className="px-3 py-2">经办人</th>}
                    {visibleColumns.includes('remark') && <th className="px-3 py-2">备注</th>}
                    {visibleColumns.includes('tax') && <th className="px-3 py-2">税费</th>}
                    {visibleColumns.includes('action') && <th className="w-36 px-3 py-2">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ entry, displayIndex }) => (
                    <tr key={entry.id} className={`border-b ${entry.isDeleted ? 'text-slate-400 line-through' : ''}`}>
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
                      {visibleColumns.includes('handler') && (
                        <td className="px-3 py-2">{entry.handlerName || entry.handlerUsername || '—'}</td>
                      )}
                      {visibleColumns.includes('remark') && <td className="px-3 py-2">{entry.remark ?? '—'}</td>}
                      {visibleColumns.includes('tax') && <td className="px-3 py-2">{entry.tva ?? '—'}</td>}
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
                                onClick={() => handleDelete(entry.id)}
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
                      <td colSpan={visibleColumns.length || 1} className="px-3 py-6 text-center text-slate-500">
                        暂无数据，调整筛选试试。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                                  setListDraft((prev) => ({ ...prev, categoryKeys: node.key ? [node.key] : [] }))
                                  setListFilters((prev) => ({ ...prev, categoryKeys: node.key ? [node.key] : [] }))
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
                                setListDraft((prev) => ({ ...prev, categoryKeys: [cat.key] }))
                                setListFilters((prev) => ({ ...prev, categoryKeys: [cat.key] }))
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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
                    <div className="mt-3 space-y-2">
                      {insights.paymentBreakdown.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setListDraft((prev) => ({ ...prev, paymentTypeIds: [item.id] }))
                            setListFilters((prev) => ({ ...prev, paymentTypeIds: [item.id] }))
                            setViewMode('table')
                            setRefreshKey((prev) => prev + 1)
                          }}
                          className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2 font-medium text-slate-900">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: ['#0ea5e9', '#10b981', '#f97316', '#6366f1', '#f43f5e'][idx % 5] }}
                              />
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-600">
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

                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">近期待办</p>
                      <p className="text-xs text-slate-500">高金额条目可快速核查</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Top 5</span>
                  </div>
                  {filteredEntries.length ? (
                    <div className="mt-3 space-y-2">
                      {[...filteredEntries]
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
                            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                              <span>{entry.categoryPath.map((c) => c.label).join(' / ')}</span>
                              <span className="font-semibold text-emerald-700">
                                {entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} {entry.unitName}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">暂无条目</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {canEdit && showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-8">
          <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 max-h-[90vh]">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 px-6 py-4 text-white">
              <div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide">
                  {editingId ? '编辑模式' : '快速新增'}
                </span>
                <h2 className="mt-2 text-xl font-semibold">{editingId ? '编辑财务记录' : '新增财务记录'}</h2>
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

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">分类</span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={form.categoryKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, categoryKey: e.target.value }))}
                >
                  <option value="">选择分类</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
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
              </div>

              <div className="grid gap-3 md:grid-cols-2">
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

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">税费 (可选)</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="0.00"
                    value={form.tva}
                    onChange={(e) => setForm((prev) => ({ ...prev, tva: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">备注 (可选)</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="发票号/供应商"
                    value={form.remark}
                    onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                  />
                </label>
              </div>

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

      {viewingEntry && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-8">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
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
                  <p className="mt-2 text-xs text-slate-500">支付日期：{formatDateInput(viewingEntry.entry.paymentDate)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">经办人</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {viewingEntry.entry.handlerName || viewingEntry.entry.handlerUsername || '—'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">编号：{viewingEntry.entry.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-lg font-semibold">主数据管理</h2>
              <button
                onClick={() => setShowManage(false)}
                className="rounded-full px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
              >
                关闭
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">项目</h3>
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
                <button
                  onClick={() =>
                    manageCall('/api/finance/projects', { name: manageProject.name, code: manageProject.code || null })
                  }
                  className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  新增项目
                </button>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">金额单位</h3>
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
                <button
                  onClick={() =>
                    manageCall('/api/finance/units', {
                      name: manageUnit.name,
                      symbol: manageUnit.symbol || null,
                    })
                  }
                  className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  新增金额单位
                </button>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">支付方式</h3>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="支付方式名称"
                  value={managePayment.name}
                  onChange={(e) => setManagePayment((prev) => ({ ...prev, name: e.target.value }))}
                />
                <button
                  onClick={() => manageCall('/api/finance/payment-types', { name: managePayment.name })}
                  className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  新增支付方式
                </button>
              </div>
              <div className="space-y-2 rounded border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">分类树</h3>
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
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      manageCall('/api/finance/categories', {
                        key: manageCategory.key,
                        parentKey: manageCategory.parentKey || null,
                        labelZh: manageCategory.labelZh,
                        sortOrder: manageCategory.sortOrder ? Number(manageCategory.sortOrder) : 0,
                      })
                    }
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    新增/更新分类
                  </button>
                  <button
                    onClick={() => deleteCategory(manageCategory.key)}
                    className="rounded border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    停用
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
