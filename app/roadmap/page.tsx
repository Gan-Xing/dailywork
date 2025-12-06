'use client'

import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'

type RoadmapStatus = 'PENDING' | 'DONE'

type RoadmapItem = {
  id: number
  title: string
  details: string | null
  priority: number
  importance: number
  difficulty: number
  status: RoadmapStatus
  createdAt: string
  completedAt: string | null
}

type SessionUser = {
  permissions: string[]
}

const statusLabels: Record<RoadmapStatus, string> = {
  PENDING: '待开发',
  DONE: '已完成',
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState(3)
  const [importance, setImportance] = useState(3)
  const [difficulty, setDifficulty] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [sortKey, setSortKey] = useState<'priority' | 'importance' | 'difficulty' | 'createdAt'>('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [pendingWidth, setPendingWidth] = useState(55)
  const [editingItem, setEditingItem] = useState<{
    id: number
    title: string
    details: string
    priority: number
    importance: number
    difficulty: number
  } | null>(null)

  const canViewRoadmap = session?.permissions.includes('roadmap:view') ?? false
  const canCreateRoadmap = session?.permissions.includes('roadmap:create') ?? false
  const canUpdateRoadmap = session?.permissions.includes('roadmap:update') ?? false

  const fetchItems = useCallback(async () => {
    if (!sessionLoaded) return
    if (!canViewRoadmap) {
      setItems([])
      setLoading(false)
      setError(session ? '缺少开发路线查看权限' : '请登录后查看开发路线')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roadmap', { credentials: 'include' })
      const data = (await res.json()) as { items?: RoadmapItem[]; message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? '加载失败')
      }
      setItems(data.items ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [canViewRoadmap, session, sessionLoaded])

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        const data = (await res.json()) as { user?: SessionUser | null }
        setSession(data.user ?? null)
      } catch {
        setSession(null)
      } finally {
        setSessionLoaded(true)
      }
    }
    loadSession()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === 'PENDING'),
    [items]
  )
  const sortedPendingItems = useMemo(() => {
    const list = [...pendingItems]
    const direction = sortOrder === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (sortKey === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
      }
      return (a[sortKey] - b[sortKey]) * direction
    })
  }, [pendingItems, sortKey, sortOrder])

  const doneItems = useMemo(
    () => items.filter((item) => item.status === 'DONE'),
    [items]
  )
  const sortedDoneItems = useMemo(() => {
    const list = [...doneItems]
    const direction = sortOrder === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (sortKey === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
      }
      return (a[sortKey] - b[sortKey]) * direction
    })
  }, [doneItems, sortKey, sortOrder])
  const columnTemplate = useMemo(
    () => `${pendingWidth}% ${100 - pendingWidth}%`,
    [pendingWidth]
  )
  const columnStyles = useMemo(
    () => ({ '--roadmap-columns': columnTemplate } as CSSProperties),
    [columnTemplate]
  )

  const submitIdea = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canCreateRoadmap) {
      setError('缺少开发路线编辑权限')
      return
    }
    if (!title.trim()) {
      setError('请输入想法标题')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          details,
          priority,
          importance,
          difficulty,
        }),
      })
      const data = (await res.json()) as { item?: RoadmapItem; message?: string }
      if (!res.ok || !data.item) {
        throw new Error(data.message ?? '保存失败')
      }
      setItems((prev) => [data.item!, ...prev])
      setTitle('')
      setDetails('')
      setPriority(3)
      setImportance(3)
      setDifficulty(3)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: RoadmapItem) => {
    setEditingItem({
      id: item.id,
      title: item.title,
      details: item.details ?? '',
      priority: item.priority,
      importance: item.importance,
      difficulty: item.difficulty,
    })
  }

  const cancelEdit = () => {
    setEditingItem(null)
  }

  const saveEdit = async () => {
    if (!editingItem) return
    if (!canUpdateRoadmap) {
      setError('缺少开发路线编辑权限')
      return
    }
    if (!editingItem.title.trim()) {
      setError('请输入标题')
      return
    }
    setUpdatingId(editingItem.id)
    setError(null)
    try {
      const res = await fetch(`/api/roadmap/${editingItem.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingItem.title,
          details: editingItem.details,
          priority: editingItem.priority,
          importance: editingItem.importance,
          difficulty: editingItem.difficulty,
        }),
      })
      const data = (await res.json()) as { item?: RoadmapItem; message?: string }
      if (!res.ok || !data.item) {
        throw new Error(data.message ?? '更新失败')
      }
      setItems((prev) =>
        prev.map((entry) => (entry.id === data.item!.id ? data.item! : entry))
      )
      setEditingItem(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleStatus = async (item: RoadmapItem) => {
    if (!canUpdateRoadmap) {
      setError('缺少开发路线编辑权限')
      return
    }
    const nextStatus: RoadmapStatus = item.status === 'DONE' ? 'PENDING' : 'DONE'
    setUpdatingId(item.id)
    setError(null)
    try {
      const res = await fetch(`/api/roadmap/${item.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = (await res.json()) as { item?: RoadmapItem; message?: string }
      if (!res.ok || !data.item) {
        throw new Error(data.message ?? '更新失败')
      }
      setItems((prev) =>
        prev.map((entry) => (entry.id === data.item!.id ? data.item! : entry))
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className='relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50'>
      <div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.12),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.14),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.12),transparent_25%)]' />
      <div className='absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl' />

      <div className='relative mx-auto max-w-5xl px-6 py-16 sm:px-8 lg:px-10'>
        <header className='flex flex-col gap-4'>
          <Breadcrumbs
            items={[
              { label: '首页', href: '/' },
              { label: '开发路线' },
            ]}
            variant='dark'
          />
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold leading-tight sm:text-4xl'>
              开发路线：记录想法、排定上线、完成收尾
            </h1>
            <p className='max-w-2xl text-slate-200/80'>
              每个灵感都会落库保存，方便后续排期、讨论与跟踪。完成后勾选状态即可留存闭环记录。
            </p>
          </div>
          <div className='flex flex-wrap gap-3 text-xs text-slate-200'>
            <span className='rounded-full bg-white/10 px-3 py-1'>
              待开发：{pendingItems.length}
            </span>
            <span className='rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-50'>
              已完成：{doneItems.length}
            </span>
            <button
              type='button'
              onClick={() => fetchItems()}
              className='rounded-full border border-white/20 px-3 py-1 text-xs transition hover:border-white/40 hover:bg-white/10'
              disabled={loading || !sessionLoaded || !canViewRoadmap}
            >
              {loading ? '刷新中...' : '刷新列表'}
            </button>
          </div>
        </header>

        {error ? (
          <p className='mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100'>
            {error}
          </p>
        ) : null}

        <section className='mt-10 space-y-6'>
        {sessionLoaded && canCreateRoadmap ? (
          <form
            onSubmit={submitIdea}
            className='w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'
          >
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='space-y-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                  新想法
                </p>
                <h2 className='text-xl font-semibold text-slate-50'>写下要做的模块</h2>
              </div>
            </div>
            <div className='mt-6 flex flex-col gap-4'>
              <div className='flex flex-col gap-3 md:flex-row md:items-start'>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className='flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                  placeholder='例如：增加质量巡检检查项、导出中心批量模板...'
                  required
                />
                <button
                  type='submit'
                  className='inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/20 transition hover:-translate-y-0.5 hover:shadow-emerald-400/30 disabled:opacity-60 md:min-w-[160px]'
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存到路线'}
                </button>
              </div>
              <div className='grid gap-3 sm:grid-cols-3'>
                <label className='flex flex-col gap-2 text-sm text-slate-100'>
                  优先级
                  <select
                    value={priority}
                    onChange={(event) => setPriority(Number(event.target.value))}
                    className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value} className='text-slate-900'>
                        {value}（{value === 5 ? '最高' : value === 1 ? '最低' : '中'}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className='flex flex-col gap-2 text-sm text-slate-100'>
                  重要度
                  <select
                    value={importance}
                    onChange={(event) => setImportance(Number(event.target.value))}
                    className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value} className='text-slate-900'>
                        {value}（{value === 5 ? '最高' : value === 1 ? '最低' : '中'}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className='flex flex-col gap-2 text-sm text-slate-100'>
                  难度
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(Number(event.target.value))}
                    className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value} className='text-slate-900'>
                        {value}（{value === 5 ? '最高' : value === 1 ? '最低' : '中'}）
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className='flex flex-col gap-2 text-sm text-slate-100'>
                细节 / 备注（可选）
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={4}
                  className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                  placeholder='补充验收标准、接口需求、预期上线时间等'
                />
              </label>
            </div>
          </form>
          ) : (
            <div className='w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'>
              <div className='space-y-2'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                  新想法
                </p>
                <h2 className='text-xl font-semibold text-slate-50'>
                  {sessionLoaded ? '需要编辑权限' : '加载权限中'}
                </h2>
                <p className='text-sm text-slate-200/80'>
                  {sessionLoaded
                    ? '只有拥有开发路线编辑权限的成员可以新增想法；您可以联系管理员开通权限后再尝试。'
                    : '正在确认当前登录状态与权限，请稍候或尝试刷新。'}
                </p>
              </div>
              <div className='mt-3 inline-flex items-center gap-2 text-xs text-slate-300/80'>
                <span className='h-2 w-2 rounded-full bg-amber-300' />
                {sessionLoaded ? '当前仅可查看待开发和已完成内容' : '正在加载权限...'}
              </div>
            </div>
          )}
        </section>

        <div className='mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-950/30 backdrop-blur'>
          <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200'>
            <div className='flex flex-wrap items-center gap-3'>
              <span className='text-xs uppercase tracking-[0.2em] text-slate-300'>
                排序
              </span>
              <div className='flex items-center gap-2'>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='sortKey'
                    value='priority'
                    checked={sortKey === 'priority'}
                    onChange={() => setSortKey('priority')}
                    className='accent-emerald-400'
                  />
                  优先级
                </label>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='sortKey'
                    value='importance'
                    checked={sortKey === 'importance'}
                    onChange={() => setSortKey('importance')}
                    className='accent-emerald-400'
                  />
                  重要度
                </label>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='sortKey'
                    value='difficulty'
                    checked={sortKey === 'difficulty'}
                    onChange={() => setSortKey('difficulty')}
                    className='accent-emerald-400'
                  />
                  难度
                </label>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='sortKey'
                    value='createdAt'
                    checked={sortKey === 'createdAt'}
                    onChange={() => setSortKey('createdAt')}
                    className='accent-emerald-400'
                  />
                  最新时间
                </label>
              </div>
            </div>
            <div className='flex items-center gap-2 text-xs text-slate-200'>
              <span>顺序</span>
              <button
                type='button'
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className='inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10'
              >
                {sortOrder === 'desc' ? '降序' : '升序'}
                <span aria-hidden>{sortOrder === 'desc' ? '↓' : '↑'}</span>
              </button>
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs'>
              <span>列宽调节（在路上 / 已登场）</span>
              <input
                type='range'
                min={35}
                max={65}
                step={1}
                value={pendingWidth}
                onChange={(event) => setPendingWidth(Number(event.target.value))}
                className='h-1 w-32 cursor-pointer accent-emerald-400'
              />
              <span className='tabular-nums'>{pendingWidth}% / {100 - pendingWidth}%</span>
            </div>
          </div>
        </div>

        <div
          className='mt-4 grid gap-6 lg:[grid-template-columns:var(--roadmap-columns)]'
          style={columnStyles}
        >
          <div className='space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                  在路上
                </p>
                <h2 className='text-lg font-semibold text-slate-50'>
                  需要开发的内容（{pendingItems.length}）
                </h2>
              </div>
              <span className='rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
                待交付
              </span>
            </div>
            <div className='space-y-3'>
              {loading ? (
                <p className='text-sm text-slate-200'>加载中...</p>
              ) : pendingItems.length === 0 ? (
                <p className='text-sm text-slate-300/80'>暂时没有待开发想法。</p>
              ) : (
                sortedPendingItems.map((item) => {
                  const isEditing = editingItem?.id === item.id
                  return (
                    <article
                      key={item.id}
                      className='rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/40'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex-1'>
                          <p className='text-xs uppercase tracking-wide text-slate-300/80'>
                            {statusLabels[item.status]}
                          </p>
                          {isEditing ? (
                            <input
                              value={editingItem.title}
                              onChange={(event) =>
                                setEditingItem((prev) =>
                                  prev ? { ...prev, title: event.target.value } : prev
                                )
                              }
                              className='mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                              placeholder='请输入标题'
                            />
                          ) : (
                            <h3 className='text-base font-semibold text-slate-50'>
                              {item.title}
                            </h3>
                          )}
                          <div className='mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300/90'>
                            {isEditing ? (
                              <>
                                <select
                                  value={editingItem.priority}
                                  onChange={(event) =>
                                    setEditingItem((prev) =>
                                      prev
                                        ? { ...prev, priority: Number(event.target.value) }
                                        : prev
                                    )
                                  }
                                  className='rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-50 focus:border-emerald-300 focus:outline-none'
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value} className='text-slate-900'>
                                      优先级 {value}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={editingItem.importance}
                                  onChange={(event) =>
                                    setEditingItem((prev) =>
                                      prev
                                        ? { ...prev, importance: Number(event.target.value) }
                                        : prev
                                    )
                                  }
                                  className='rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-50 focus:border-emerald-300 focus:outline-none'
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value} className='text-slate-900'>
                                      重要度 {value}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={editingItem.difficulty}
                                  onChange={(event) =>
                                    setEditingItem((prev) =>
                                      prev
                                        ? { ...prev, difficulty: Number(event.target.value) }
                                        : prev
                                    )
                                  }
                                  className='rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-50 focus:border-emerald-300 focus:outline-none'
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value} className='text-slate-900'>
                                      难度 {value}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <>
                                <span className='rounded-full border border-white/15 px-2 py-1'>
                                  优先级 {item.priority}
                                </span>
                                <span className='rounded-full border border-white/15 px-2 py-1'>
                                  重要度 {item.importance}
                                </span>
                                <span className='rounded-full border border-white/15 px-2 py-1'>
                                  难度 {item.difficulty}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className='flex flex-col gap-2'>
                          {isEditing ? (
                            <>
                              <button
                                type='button'
                                onClick={saveEdit}
                                className='rounded-full border border-emerald-300/80 bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-50 transition hover:border-emerald-200 disabled:opacity-60'
                                disabled={updatingId === item.id || !canUpdateRoadmap}
                              >
                                {updatingId === item.id ? '保存中...' : '保存'}
                              </button>
                              <button
                                type='button'
                                onClick={cancelEdit}
                                className='rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-60'
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type='button'
                                onClick={() => toggleStatus(item)}
                                className='rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-50 disabled:opacity-60'
                                disabled={updatingId === item.id || !canUpdateRoadmap}
                              >
                                {updatingId === item.id ? '更新中...' : '标记完成'}
                              </button>
                              <button
                                type='button'
                                onClick={() => startEdit(item)}
                                className='rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-white/40 disabled:opacity-60'
                                disabled={!canUpdateRoadmap}
                              >
                                编辑
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editingItem.details}
                          onChange={(event) =>
                            setEditingItem((prev) =>
                              prev ? { ...prev, details: event.target.value } : prev
                            )
                          }
                          rows={3}
                          className='mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                          placeholder='补充细节'
                        />
                      ) : item.details ? (
                        <p className='mt-2 text-sm text-slate-200/80'>{item.details}</p>
                      ) : null}
                      <div className='mt-3 flex items-center gap-3 text-[11px] text-slate-400'>
                        <span>记录时间 {formatDate(item.createdAt)}</span>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>

          <div className='space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                  已登场
                </p>
                <h2 className='text-lg font-semibold text-slate-50'>
                  已经实现的内容（{doneItems.length}）
                </h2>
              </div>
              <span className='rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
                可回溯
                </span>
              </div>
              <div className='space-y-3'>
                {loading ? (
                  <p className='text-sm text-slate-200'>加载中...</p>
                ) : doneItems.length === 0 ? (
                  <p className='text-sm text-slate-300/80'>还没有完成的条目。</p>
                ) : (
                  sortedDoneItems.map((item) => (
                    <article
                      key={item.id}
                      className='rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 shadow-inner shadow-emerald-500/10'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='text-xs uppercase tracking-wide text-emerald-100'>
                            {statusLabels[item.status]}
                          </p>
                          <h3 className='text-base font-semibold text-slate-50'>
                            {item.title}
                          </h3>
                          <div className='mt-2 flex flex-wrap gap-2 text-[11px] text-emerald-50/90'>
                            <span className='rounded-full border border-emerald-400/40 px-2 py-1'>
                              优先级 {item.priority}
                            </span>
                            <span className='rounded-full border border-emerald-400/40 px-2 py-1'>
                              重要度 {item.importance}
                            </span>
                            <span className='rounded-full border border-emerald-400/40 px-2 py-1'>
                              难度 {item.difficulty}
                            </span>
                          </div>
                        </div>
                        <button
                          type='button'
                          onClick={() => toggleStatus(item)}
                        className='rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 disabled:opacity-60'
                        disabled={updatingId === item.id || !canUpdateRoadmap}
                      >
                        {updatingId === item.id ? '更新中...' : '重新打开'}
                      </button>
                    </div>
                    {item.details ? (
                      <p className='mt-2 text-sm text-slate-100/90'>{item.details}</p>
                    ) : null}
                    <div className='mt-3 flex items-center gap-3 text-[11px] text-slate-200/80'>
                      <span>记录时间 {formatDate(item.createdAt)}</span>
                      <span>完成 {formatDate(item.completedAt)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
