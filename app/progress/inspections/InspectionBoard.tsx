'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type {
  InspectionListItem,
  RoadSectionWithPhasesDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'

interface Props {
  roads: RoadSectionWithPhasesDTO[]
  loadError: string | null
}

type SortField = 'createdAt' | 'updatedAt'
type SortOrder = 'asc' | 'desc'

const statusCopy: Record<string, string> = {
  PENDING: '待处理',
  IN_PROGRESS: '验收中',
  APPROVED: '已通过',
}

const statusTone: Record<string, string> = {
  PENDING: 'bg-slate-800 text-slate-100 ring-1 ring-white/10',
  IN_PROGRESS: 'bg-amber-200/30 text-amber-100 ring-1 ring-amber-200/50',
  APPROVED: 'bg-emerald-300/20 text-emerald-100 ring-1 ring-emerald-300/40',
}

const sideCopy: Record<string, string> = { LEFT: '左侧', RIGHT: '右侧', BOTH: '双侧' }

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const buildQuery = (params: Record<string, string | number | undefined | (string | number)[]>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)))
    } else {
      search.set(key, String(value))
    }
  })
  return search.toString()
}

export function InspectionBoard({ roads, loadError }: Props) {
  const [roadSlug, setRoadSlug] = useState('')
  const [phaseId, setPhaseId] = useState<number | ''>('')
  const [status, setStatus] = useState<string[]>([])
  const [side, setSide] = useState('')
  const [type, setType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [items, setItems] = useState<InspectionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(loadError)
  const [selected, setSelected] = useState<InspectionListItem | null>(null)

  const phases = useMemo(() => {
    const found = roads.find((road) => road.slug === roadSlug)
    return found?.phases ?? []
  }, [roadSlug, roads])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildQuery({
        roadSlug: roadSlug || undefined,
        phaseId: phaseId || undefined,
        status: status.length ? status : undefined,
        side: side || undefined,
        type: type || undefined,
        keyword: keyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortField,
        sortOrder,
        page,
        pageSize,
      })
      const res = await fetch(`/api/inspections?${query}`)
      const data = (await res.json()) as { message?: string; items?: InspectionListItem[]; total?: number; page?: number }
      if (!res.ok) {
        throw new Error(data.message ?? '加载失败')
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadSlug, phaseId, status, side, type, keyword, startDate, endDate, sortField, sortOrder, page, pageSize])

  const toggleStatus = (value: string) => {
    setPage(1)
    setStatus((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }

  const handleSort = (field: SortField) => {
    setPage(1)
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const resetFilters = () => {
    setRoadSlug('')
    setPhaseId('')
    setStatus([])
    setSide('')
    setType('')
    setKeyword('')
    setStartDate('')
    setEndDate('')
    setSortField('updatedAt')
    setSortOrder('desc')
    setPage(1)
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/15 via-blue-300/10 to-amber-200/10 blur-3xl" />
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">报检列表</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">所有报检记录</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">
            可按道路、分项、状态、侧别、时间等条件筛选，点击表头可排序，点击行查看详情。
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              首页
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              进度管理
            </Link>
            <span className="text-slate-500">/</span>
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
              报检记录
            </span>
          </nav>
          {error ? <p className="text-sm text-amber-200">加载提示：{error}</p> : null}
        </header>

        <section className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-900/30 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              道路
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={roadSlug}
                onChange={(e) => {
                  setRoadSlug(e.target.value)
                  setPhaseId('')
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                {roads.map((road) => (
                  <option key={road.id} value={road.slug}>
                    {resolveRoadName(road, 'zh')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              分项
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={phaseId}
                onChange={(e) => {
                  const value = e.target.value
                  setPhaseId(value ? Number(value) : '')
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              侧别
              <select
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={side}
                onChange={(e) => {
                  setSide(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                <option value="LEFT">左侧</option>
                <option value="RIGHT">右侧</option>
                <option value="BOTH">双侧</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              验收类型
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setPage(1)
                }}
                placeholder="试验验收"
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="whitespace-nowrap">状态</span>
              <div className="flex flex-wrap gap-2">
                {(['PENDING', 'IN_PROGRESS', 'APPROVED'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      status.includes(item)
                        ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                        : 'bg-white/10 text-slate-100'
                    }`}
                    onClick={() => toggleStatus(item)}
                  >
                    {statusCopy[item]}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              开始日期
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              结束日期
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200 md:col-span-2">
              关键字（分项/备注/验收内容）
              <input
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder="输入关键字后自动过滤"
              />
            </label>
            <div className="flex items-center gap-3 md:col-span-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                onClick={resetFilters}
              >
                重置筛选
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
                onClick={() => {
                  setPage(1)
                  fetchData()
                }}
              >
                立即查询
              </button>
              {loading ? <span className="text-xs text-slate-200">加载中...</span> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-slate-900/30">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-100">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-3">道路</th>
                  <th className="px-4 py-3">分项</th>
                  <th className="px-4 py-3">侧别</th>
                  <th className="px-4 py-3">区间</th>
                  <th className="px-4 py-3">验收内容</th>
                  <th className="px-4 py-3">验收类型</th>
                  <th className="px-4 py-3">状态</th>
                  <th
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    提交时间 {sortField === 'createdAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => handleSort('updatedAt')}
                  >
                    更新时间 {sortField === 'updatedAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-300">
                      {loading ? '加载中...' : '暂无记录'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-white/5 bg-white/0 transition hover:bg-white/5"
                      onClick={() => setSelected(item)}
                    >
                      <td className="px-4 py-3">{item.roadName}</td>
                      <td className="px-4 py-3">{item.phaseName}</td>
                      <td className="px-4 py-3">{sideCopy[item.side] ?? item.side}</td>
                      <td className="px-4 py-3">
                        {formatPK(item.startPk)} → {formatPK(item.endPk)}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={item.checks.join(' / ')}>
                        {item.checks.join(' / ')}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={item.types.join(' / ')}>
                        {item.types.join(' / ')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[item.status] ?? 'bg-white/10 text-slate-100'}`}>
                          {statusCopy[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{formatDate(item.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-sm text-slate-200">
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一页
              </button>
            </div>
          </div>
        </section>

        {selected ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-900/50 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">报检详情</p>
                  <h2 className="text-xl font-semibold text-slate-50">
                    {selected.phaseName} · {sideCopy[selected.side] ?? selected.side}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {selected.roadName} · {formatPK(selected.startPk)} → {formatPK(selected.endPk)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                  onClick={() => setSelected(null)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">验收内容</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{selected.checks.join('，')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">验收类型</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{selected.types.join('，')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">状态</p>
                  <p>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[selected.status] ?? 'bg-white/10 text-slate-100'}`}>
                      {statusCopy[selected.status] ?? selected.status}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">提交时间</p>
                  <p>{formatDate(selected.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">更新时间</p>
                  <p>{formatDate(selected.updatedAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">提交人</p>
                  <p>{selected.createdBy?.username ?? '未知'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs text-slate-400">备注</p>
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                    {selected.remark || '无备注'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
