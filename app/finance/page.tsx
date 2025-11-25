'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

type Metadata = {
  projects: Project[]
  units: Unit[]
  paymentTypes: PaymentType[]
  categories: FinanceCategoryDTO[]
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
  paymentDate: string
  tva?: number
  remark?: string | null
  isDeleted: boolean
}

type EntryForm = {
  projectId: number | ''
  reason: string
  categoryKey: string
  amount: string
  unitId: number | ''
  paymentTypeId: number | ''
  paymentDate: string
  tva: string
  remark: string
}

type ListFilters = {
  categoryKey: string
  paymentTypeId: number | ''
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

export default function FinancePage() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [entries, setEntries] = useState<FinanceEntry[]>([])
const [filters, setFilters] = useState<{ projectId?: number }>({})
  const [listFilters, setListFilters] = useState<ListFilters>({
    categoryKey: '',
    paymentTypeId: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    sortField: 'paymentDate',
    sortDir: 'desc',
  })
  const [listDraft, setListDraft] = useState<ListFilters>({
    categoryKey: '',
    paymentTypeId: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    sortField: 'paymentDate',
    sortDir: 'desc',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EntryForm>({
    projectId: '',
    reason: '',
    categoryKey: '',
    amount: '',
    unitId: '',
    paymentTypeId: '',
    paymentDate: formatDateInput(new Date().toISOString()),
    tva: '',
    remark: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
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

  const canView = session?.permissions.includes('finance:view')
  const canEdit = session?.permissions.includes('finance:edit')
  const canManage = session?.permissions.includes('finance:manage')

  const categoryOptions = useMemo(
    () => (metadata ? buildCategoryOptions(metadata.categories, '') : []),
    [metadata],
  )
  const categoryOptionsWithParents = useMemo(
    () => (metadata ? buildCategoryOptionsWithParents(metadata.categories, '') : []),
    [metadata],
  )
  const filteredEntries = useMemo(() => {
    let result = [...entries]
    if (listFilters.categoryKey) {
      result = result.filter((e) => e.categoryKey === listFilters.categoryKey)
    }
    if (listFilters.paymentTypeId) {
      result = result.filter((e) => e.paymentTypeId === Number(listFilters.paymentTypeId))
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

  const loadSession = async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = (await res.json()) as { user: SessionUser | null }
      setSession(data.user)
    } catch (error) {
      console.error(error)
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
      })
      const defaultProject = data.projects.find((p) => p.name === '邦杜库市政路项目')
      const defaultPayment = data.paymentTypes.find((p) => p.name === '现金支票')
      const defaultUnit = data.units.find((u) => u.name === '西法')
      const defaultCategory = buildCategoryOptions(data.categories, '')[0]?.key
      setForm((prev) => ({
        ...prev,
        projectId: defaultProject?.id ?? prev.projectId,
        paymentTypeId: defaultPayment?.id ?? prev.paymentTypeId,
        unitId: defaultUnit?.id ?? prev.unitId,
        categoryKey: defaultCategory ?? prev.categoryKey,
        paymentDate: prev.paymentDate || formatDateInput(new Date().toISOString()),
      }))
      setListDraft((prev) => {
        const defaults = {
          categoryKey: '',
          paymentTypeId: '',
          amountMin: prev.amountMin,
          amountMax: prev.amountMax,
          dateFrom: prev.dateFrom,
          dateTo: prev.dateTo,
          sortField: prev.sortField,
          sortDir: prev.sortDir,
        } satisfies ListFilters
        setListFilters(defaults)
        return defaults
      })
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [])

  const loadEntries = useCallback(
    async (projectId?: number) => {
      if (!canView) return
      setLoading(true)
      setMessage(null)
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', String(projectId))
      try {
        const res = await fetch(`/api/finance/entries?${params.toString()}`, { credentials: 'include' })
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

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    if (canView) {
      void loadMetadata()
      void loadEntries(filters.projectId)
    }
  }, [canView, filters.projectId, loadEntries, loadMetadata])

  const resetForm = () => {
    setForm({
      projectId: metadata?.projects.find((p) => p.name === '邦杜库市政路项目')?.id ?? '',
      reason: '',
      categoryKey: categoryOptions[0]?.key ?? '',
      amount: '',
      unitId: metadata?.units.find((u) => u.name === '西法')?.id ?? '',
      paymentTypeId: metadata?.paymentTypes.find((p) => p.name === '现金支票')?.id ?? '',
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
      await loadEntries(filters.projectId)
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
      paymentDate: formatDateInput(entry.paymentDate),
      tva: entry.tva != null ? String(entry.tva) : '',
      remark: entry.remark ?? '',
    })
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
      await loadEntries(filters.projectId)
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
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={filters.projectId ?? ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined
                setFilters({ projectId: value })
                void loadEntries(value)
              }}
            >
              <option value="">全部项目</option>
              {metadata?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => void loadEntries(filters.projectId)}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              刷新列表
            </button>
            {canManage && (
              <button
                onClick={() => setShowManage(true)}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                主数据管理
              </button>
            )}
          </div>

          {canEdit && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">{editingId ? '编辑记录' : '新增记录'}</h2>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
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
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="事由"
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                />
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
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
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border px-3 py-2 text-sm"
                    placeholder="金额"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                  <select
                    className="rounded border px-3 py-2 text-sm"
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
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded border px-3 py-2 text-sm"
                    value={form.paymentTypeId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, paymentTypeId: e.target.value ? Number(e.target.value) : '' }))
                    }
                  >
                    <option value="">支付方式</option>
                    {metadata?.paymentTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border px-3 py-2 text-sm"
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border px-3 py-2 text-sm"
                    placeholder="税费 (可选)"
                    value={form.tva}
                    onChange={(e) => setForm((prev) => ({ ...prev, tva: e.target.value }))}
                  />
                  <input
                    className="rounded border px-3 py-2 text-sm"
                    placeholder="备注 (可选)"
                    value={form.remark}
                    onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {editingId ? '保存修改' : '新增'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {canView && (
            <div className="space-y-3 rounded-lg bg-white p-4 shadow">
              <h2 className="text-lg font-semibold">记录列表</h2>
              <div className="grid gap-2 md:grid-cols-4">
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={listDraft.categoryKey}
                  onChange={(e) => setListDraft((prev) => ({ ...prev, categoryKey: e.target.value }))}
                >
                  <option value="">全部分类</option>
                  {categoryOptionsWithParents.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={listDraft.paymentTypeId}
                  onChange={(e) =>
                    setListDraft((prev) => ({
                      ...prev,
                      paymentTypeId: e.target.value ? Number(e.target.value) : '',
                    }))
                  }
                >
                  <option value="">全部支付方式</option>
                  {metadata?.paymentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="金额最小"
                    value={listDraft.amountMin}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, amountMin: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="金额最大"
                    value={listDraft.amountMax}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, amountMax: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    type="date"
                    value={listDraft.dateFrom}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    type="date"
                    value={listDraft.dateTo}
                    onChange={(e) => setListDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <button
                    onClick={() => setListFilters(listDraft)}
                    className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    应用筛选
                  </button>
                  <button
                    onClick={() => {
                      const reset = {
                        categoryKey: '',
                        paymentTypeId: '',
                        amountMin: '',
                        amountMax: '',
                        dateFrom: '',
                        dateTo: '',
                        sortField: 'paymentDate',
                        sortDir: 'desc',
                      } satisfies ListFilters
                      setListDraft(reset)
                      setListFilters(reset)
                    }}
                    className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    重置筛选
                  </button>
                </div>
              </div>
              {loading && <p className="text-sm text-slate-600">加载中...</p>}
              <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-2">序号</th>
                  <th className="px-3 py-2">项目</th>
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
                  <th className="px-3 py-2">事由</th>
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
                  <th className="px-3 py-2">支付方式</th>
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
                    支付日期 {listFilters.sortField === 'paymentDate' ? (listFilters.sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-3 py-2 w-36">操作</th>
                  <th className="px-3 py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className={`border-b ${entry.isDeleted ? 'text-slate-400 line-through' : ''}`}>
                    <td className="px-3 py-2">{entry.sequence}</td>
                    <td className="px-3 py-2">{entry.projectName}</td>
                    <td className="px-3 py-2">
                      {entry.categoryPath.map((c) => c.label).join(' / ')}
                    </td>
                    <td className="px-3 py-2">{entry.reason}</td>
                    <td className="px-3 py-2">
                      {entry.amount} {entry.unitName}
                    </td>
                    <td className="px-3 py-2">{entry.paymentTypeName}</td>
                    <td className="px-3 py-2">{formatDateInput(entry.paymentDate)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
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
                    <td className="px-3 py-2">{entry.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
