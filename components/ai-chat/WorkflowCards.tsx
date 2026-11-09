'use client'

import { useEffect, useRef, useState } from 'react'

type Job = {
  id: string
  kind: string
  status: string
  input: {
    planId: number; title: string; signed?: boolean
    preview?: Array<{ type: string; itemId?: number; before?: Record<string, unknown>; changes: Record<string, unknown> }>
  }
  result?: { fileAssetId?: number; message?: string } | null
  error?: string | null
  capabilities?: { confirm: boolean; cancel: boolean; retry: boolean; download: boolean }
}

const labels: Record<string, string> = {
  goodsName: '物资', plannedQty: '数量', unit: '单位', deliveryDate: '送达日期', supplier: '供应商',
  transporter: '运输方', headPlateNumber: '车头', tailPlateNumber: '车尾', phone: '目的地', model: '规格', note: '备注', status: '状态',
}
const states: Record<string, string> = {
  CONFIRMATION_REQUIRED: '待你确认，尚未执行', QUEUED: '已排队', RUNNING: '正在生成',
  SUCCEEDED: '已完成', FAILED: '未完成', CANCELLED: '已取消',
}
const display = (value: unknown) => value === null || value === undefined ? '空' : typeof value === 'object' ? JSON.stringify(value) : String(value)

export function WorkflowCards({ sessionId, busy, locale, onCompleted }: {
  sessionId: string | null; busy: boolean; locale: string; onCompleted: () => Promise<void>
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [revision, setRevision] = useState(0)
  const known = useRef(new Map<string, string>())
  const completedCallback = useRef(onCompleted)
  completedCallback.current = onCompleted

  useEffect(() => {
    if (!sessionId) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai-chat/jobs?sessionId=${encodeURIComponent(sessionId)}`, { signal: abort.signal, cache: 'no-store' })
        if (response.status === 403) { setJobs([]); return }
        if (!response.ok) throw new Error(locale === 'fr' ? 'Tâches indisponibles.' : '任务状态暂不可用，请稍后重试。')
        const data = await response.json() as { jobs: Job[] }
        if (abort.signal.aborted) return
        setJobs(data.jobs)
        setError('')
        let changed = false
        for (const job of data.jobs) {
          if (known.current.has(job.id) && known.current.get(job.id) !== job.status &&
              ['SUCCEEDED', 'FAILED'].includes(job.status)) changed = true
          known.current.set(job.id, job.status)
        }
        if (changed && !busy) await completedCallback.current()
      } catch (error) {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Task read failed.')
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 5000)
    }
    setJobs([])
    void poll()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [sessionId, busy, locale, revision])

  const act = async (id: string, action: string) => {
    if (pending) return
    setPending(id)
    try {
      const response = await fetch(`/api/ai-chat/jobs/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const data = await response.json() as { message?: string; job?: Job }
      if (!response.ok) throw new Error(data.message ?? 'Operation failed.')
      if (data.job) known.current.set(data.job.id, data.job.status)
      if (!busy) await completedCallback.current()
      setError('')
      setRevision((value) => value + 1)
    } catch (error) { setError(error instanceof Error ? error.message : 'Operation failed.') }
    finally { setPending('') }
  }

  if (!jobs.length && !error) return null
  return <div className="max-h-80 space-y-2 overflow-y-auto border-t border-slate-200 px-5 py-3" aria-live="polite">
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {jobs.filter((job) => job.status !== 'CANCELLED').slice(0, 12).map((job) => <section key={job.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <p className="font-semibold">{locale === 'fr' ? 'Plan' : '周计划'} #{job.input.planId} · {job.input.title}</p>
      <p className="text-slate-600">{states[job.status] ?? job.status}</p>
      {job.kind === 'WEEKLY_PLAN_CHANGE' && job.status === 'CONFIRMATION_REQUIRED' ? <ul className="my-2 space-y-1">
        {job.input.preview?.map((operation, index) => <li key={index}>
          <span className="font-medium">{operation.type === 'append' ? '末尾新增' : `修改行 #${operation.itemId}`}：</span>
          {Object.entries(operation.changes).map(([field, value]) => `${labels[field] ?? field}：${operation.type === 'update' ? `${display(operation.before?.[field])} → ` : ''}${display(value)}`).join('；')}
        </li>)}
      </ul> : null}
      {job.kind === 'WEEKLY_PDF' ? <p>{job.input.signed ? '签字版PDF' : '无签字版PDF'}，生成后提供下载链接</p> : null}
      {job.result?.message ? <p>{job.result.message}</p> : null}
      {job.error ? <p className="text-red-700">{job.error}</p> : null}
      <div className="mt-2 flex gap-3">
        {job.capabilities?.confirm ? <>
          <button type="button" disabled={!!pending || busy} onClick={() => void act(job.id, 'confirm')} className="rounded-lg bg-slate-900 px-3 py-1 text-white disabled:opacity-50">{locale === 'fr' ? 'Confirmer' : '确认执行'}</button>
        </> : null}
        {job.capabilities?.cancel ? <button type="button" disabled={!!pending} onClick={() => void act(job.id, 'cancel')}>{locale === 'fr' ? 'Annuler' : '取消'}</button> : null}
        {job.capabilities?.retry ?
          <button type="button" disabled={!!pending || busy} onClick={() => void act(job.id, 'retry')}>{locale === 'fr' ? 'Réessayer' : '重试'}</button> : null}
        {job.capabilities?.download ? <a className="text-blue-700 underline" href={`/api/ai-chat/jobs/${job.id}/artifact`} target="_blank" rel="noopener noreferrer">PDF</a> : null}
      </div>
    </section>)}
  </div>
}
