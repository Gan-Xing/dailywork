'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'

type RoadmapStatus = 'PENDING' | 'DONE'

type RoadmapItem = {
  id: number
  title: string
  details: string | null
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)

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
  const doneItems = useMemo(
    () => items.filter((item) => item.status === 'DONE'),
    [items]
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
        body: JSON.stringify({ title, details }),
      })
      const data = (await res.json()) as { item?: RoadmapItem; message?: string }
      if (!res.ok || !data.item) {
        throw new Error(data.message ?? '保存失败')
      }
      setItems((prev) => [data.item!, ...prev])
      setTitle('')
      setDetails('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
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

        <section className='mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
          {sessionLoaded && canCreateRoadmap ? (
            <form
              onSubmit={submitIdea}
              className='rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'
            >
              <div className='flex items-center justify-between gap-3'>
                <div className='space-y-1'>
                  <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                    新想法
                  </p>
                  <h2 className='text-xl font-semibold text-slate-50'>写下要做的模块</h2>
                </div>
                <span className='rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
                  保存到数据库
                </span>
              </div>
              <div className='mt-6 space-y-4'>
                <label className='flex flex-col gap-2 text-sm text-slate-100'>
                  标题
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className='rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none'
                    placeholder='例如：增加质量巡检检查项、导出中心批量模板...'
                    required
                  />
                </label>
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
                <div className='flex items-center gap-3'>
                  <button
                    type='submit'
                    className='inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/20 transition hover:-translate-y-0.5 hover:shadow-emerald-400/30 disabled:opacity-60'
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存到路线'}
                  </button>
                  <span className='text-xs text-slate-300/80'>
                    支持随时追加想法，完成后可在列表中标记完成。
                  </span>
                </div>
              </div>
            </form>
          ) : (
            <div className='flex flex-col justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'>
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
              <div className='inline-flex items-center gap-2 text-xs text-slate-300/80'>
                <span className='h-2 w-2 rounded-full bg-amber-300' />
                {sessionLoaded ? '当前仅可查看待开发和已完成内容' : '正在加载权限...'}
              </div>
            </div>
          )}

          <div className='space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
                  路线进展
                </p>
                <h2 className='text-lg font-semibold text-slate-50'>
                  待开发（{pendingItems.length}）
                </h2>
              </div>
              <span className='rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
                实时状态
              </span>
            </div>
            <div className='space-y-3'>
              {loading ? (
                <p className='text-sm text-slate-200'>加载中...</p>
              ) : pendingItems.length === 0 ? (
                <p className='text-sm text-slate-300/80'>暂时没有待开发想法。</p>
              ) : (
                pendingItems.map((item) => (
                  <article
                    key={item.id}
                    className='rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/40'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-xs uppercase tracking-wide text-slate-300/80'>
                          {statusLabels[item.status]}
                        </p>
                        <h3 className='text-base font-semibold text-slate-50'>
                          {item.title}
                        </h3>
                      </div>
                      <button
                        type='button'
                        onClick={() => toggleStatus(item)}
                        className='rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-emerald-50 disabled:opacity-60'
                        disabled={updatingId === item.id || !canUpdateRoadmap}
                      >
                        {updatingId === item.id ? '更新中...' : '标记完成'}
                      </button>
                    </div>
                    {item.details ? (
                      <p className='mt-2 text-sm text-slate-200/80'>{item.details}</p>
                    ) : null}
                    <div className='mt-3 flex items-center gap-3 text-[11px] text-slate-400'>
                      <span>记录时间 {formatDate(item.createdAt)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className='space-y-2 border-t border-white/10 pt-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-semibold text-slate-50'>
                  已完成（{doneItems.length}）
                </h3>
                <span className='rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100'>
                  归档可追溯
                </span>
              </div>
              <div className='space-y-3'>
                {loading ? (
                  <p className='text-sm text-slate-200'>加载中...</p>
                ) : doneItems.length === 0 ? (
                  <p className='text-sm text-slate-300/80'>还没有完成的条目。</p>
                ) : (
                  doneItems.map((item) => (
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
        </section>
      </div>
    </main>
  )
}
