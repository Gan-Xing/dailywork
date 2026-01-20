'use client'

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import type { Locale } from '@/lib/i18n'
import type { AiChatCopy } from '@/lib/i18n/aiChat'
import type { ChatApiMessage, ChatApiRequest } from '@/lib/ai-chat/http'
import type { ChatStreamEvent, ChatToolCallRecord, PlanPayload } from '@/lib/ai-chat/types'

type ChatPanelProps = {
  locale: Locale
  endpoint: string
  labels: AiChatCopy
}

type FetchState = 'idle' | 'loading' | 'error'

type ChatMessage = ChatApiMessage

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const buildRequestBody = (input: string, history: ChatMessage[], locale: Locale): ChatApiRequest => ({
  input,
  history,
  locale,
})

const formatPlanSummary = (plan: PlanPayload | undefined, stepSummaries: string[] | undefined, locale: Locale) => {
  if (!plan?.steps?.length) return ''
  const lines: string[] = []
  const title = locale === 'fr' ? 'Plan' : '计划'
  if (plan.goal) {
    lines.push(`${title}: ${plan.goal}`)
  } else {
    lines.push(`${title}:`)
  }
  plan.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}`)
  })
  if (stepSummaries && stepSummaries.length > 0) {
    lines.push('')
    lines.push(locale === 'fr' ? 'Résumé des étapes:' : '步骤执行摘要:')
    stepSummaries.forEach((summary) => {
      if (summary) {
        lines.push(`- ${summary}`)
      }
    })
  }
  return lines.join('\n')
}

const truncateText = (value: string, max = 400) =>
  value.length <= max ? value : `${value.slice(0, max)}...`

const summarizeToolData = (call: ChatToolCallRecord) => {
  const data = call.result?.data
  if (!data) return ''
  const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
  if (key === 'get:/api/finance/insights' && isRecord(data) && isRecord(data.insights)) {
    const insights = data.insights as Record<string, unknown>
    const total = typeof insights.totalAmount === 'number' ? insights.totalAmount : 0
    const count = typeof insights.entryCount === 'number' ? insights.entryCount : 0
    return `insights.totalAmount=${total} entryCount=${count}`
  }
  if (typeof data === 'string') return truncateText(data, 200)
  return truncateText(JSON.stringify(data), 200)
}

const formatToolCalls = (toolCalls: ChatToolCallRecord[] | undefined, locale: Locale) => {
  if (!toolCalls || toolCalls.length === 0) return ''
  const lines: string[] = []
  lines.push(locale === 'fr' ? 'Outils utilisés:' : '工具调用:')
  toolCalls.forEach((call) => {
    const args = call.arguments ?? {}
    const parts: string[] = []
    if (typeof args.key === 'string') parts.push(`key=${args.key}`)
    if (args.params) parts.push(`params=${truncateText(JSON.stringify(args.params))}`)
    if (args.query) parts.push(`query=${truncateText(JSON.stringify(args.query))}`)
    if (args.body) parts.push(`body=${truncateText(JSON.stringify(args.body))}`)
    const resultText = call.result?.content ? truncateText(call.result.content, 200) : ''
    const dataSummary = summarizeToolData(call)
    const status = call.result?.ok ? 'ok' : 'fail'
    const detail = parts.length ? ` ${parts.join(' ')}` : ''
    const dataText = dataSummary ? ` data=${dataSummary}` : ''
    lines.push(
      `- ${call.tool}${detail} -> ${status}${resultText ? ` (${resultText})` : ''}${dataText}`,
    )
  })
  return lines.join('\n')
}

export function ChatPanel({ locale, endpoint, labels }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<FetchState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [progressEnabled, setProgressEnabled] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])

  useEffect(() => {
    const stored = window.localStorage.getItem('aiChatDebug')
    if (stored === '1') setDebugEnabled(true)
    const progressStored = window.localStorage.getItem('aiChatProgress')
    if (progressStored === '1') setProgressEnabled(true)
  }, [])

  const canSend = input.trim().length > 0 && status !== 'loading'

  const updateAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.role === 'assistant') {
        updated[updated.length - 1] = { role: 'assistant', content }
      } else {
        updated.push({ role: 'assistant', content })
      }
      return updated
    })
  }, [])

  const onClear = useCallback(() => {
    setMessages([])
    setInput('')
    setStatus('idle')
    setError(null)
    setProgressLog([])
  }, [])

  const onSubmit = useCallback(async () => {
    if (!canSend) return
    const trimmed = input.trim()
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user' as const, content: trimmed },
    ]
    setMessages([...nextMessages, { role: 'assistant' as const, content: labels.thinking }])
    setInput('')
    setStatus('loading')
    setError(null)
    setProgressLog([])

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(trimmed, messages, locale)),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message ?? labels.error)
      }
      if (!res.body) {
        throw new Error(labels.error)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let plan: PlanPayload | undefined
      let stepSummaries: string[] = []
      let toolCalls: ChatToolCallRecord[] = []
      const pendingToolCalls: Array<{ tool: string; arguments: Record<string, unknown> }> = []
      let answer = ''
      let statusMessage = ''
      let gotFinal = false
      let hasError = false
      const appendProgress = (line: string) => {
        if (!line) return
        setProgressLog((prev) => {
          const next = [...prev, line]
          return next.length > 200 ? next.slice(next.length - 200) : next
        })
      }

      const rebuildContent = () => {
        const planSummary = formatPlanSummary(plan, stepSummaries, locale)
        const toolSummary = debugEnabled ? formatToolCalls(toolCalls, locale) : ''
        const content = [statusMessage, planSummary, answer, toolSummary].filter(Boolean).join('\n\n')
        updateAssistantMessage(content || labels.thinking)
      }

      const handleEvent = (event: ChatStreamEvent) => {
        if (!event || typeof event !== 'object') return
        switch (event.type) {
          case 'status':
            statusMessage = event.message
            appendProgress(event.message)
            break
          case 'plan':
            plan = event.plan
            if (event.plan.goal) {
              appendProgress(
                locale === 'fr' ? `Plan: ${event.plan.goal}` : `计划: ${event.plan.goal}`,
              )
            } else {
              appendProgress(locale === 'fr' ? 'Plan défini.' : '计划已生成。')
            }
            event.plan.steps.forEach((stepItem, stepIndex) => {
              appendProgress(
                locale === 'fr'
                  ? `- Étape ${stepIndex + 1}: ${stepItem.title}`
                  : `- 步骤 ${stepIndex + 1}: ${stepItem.title}`,
              )
            })
            break
          case 'step':
            statusMessage =
              locale === 'fr'
                ? `Étape ${event.index + 1}/${event.total}: ${event.step.title}`
                : `执行中：第 ${event.index + 1}/${event.total} 步 ${event.step.title}`
            appendProgress(statusMessage)
            break
          case 'step_done':
            if (event.summary) stepSummaries.push(event.summary)
            statusMessage =
              locale === 'fr' ? 'Étape terminée.' : '步骤完成。'
            appendProgress(event.summary || statusMessage)
            break
          case 'tool_call':
            pendingToolCalls.push({ tool: event.tool, arguments: event.arguments })
            appendProgress(
              locale === 'fr' ? `Appel d'outil: ${event.tool}` : `调用工具: ${event.tool}`,
            )
            break
          case 'tool_result': {
            const pendingIndex = pendingToolCalls.findIndex((call) => call.tool === event.tool)
            const pending =
              pendingIndex >= 0 ? pendingToolCalls.splice(pendingIndex, 1)[0] : undefined
            toolCalls.push({
              tool: event.tool,
              arguments: pending?.arguments ?? {},
              result: event.result,
            })
            appendProgress(
              locale === 'fr'
                ? `Résultat outil: ${event.tool} (${event.result.ok ? 'ok' : 'fail'})`
                : `工具结果: ${event.tool} (${event.result.ok ? '成功' : '失败'})`,
            )
            break
          }
          case 'final':
            gotFinal = true
            answer = event.answer
            if (event.plan) plan = event.plan
            if (event.stepSummaries) stepSummaries = event.stepSummaries
            if (event.toolCalls) toolCalls = event.toolCalls
            statusMessage = ''
            setStatus('idle')
            appendProgress(locale === 'fr' ? 'Réponse prête.' : '答复已完成。')
            break
          case 'error':
            setError(event.message)
            statusMessage = event.message
            setStatus('error')
            hasError = true
            appendProgress(event.message)
            break
          default:
            break
        }
        rebuildContent()
      }

      const processBuffer = () => {
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        parts.forEach((part) => {
          const line = part
            .split('\n')
            .find((row) => row.startsWith('data:'))
          if (!line) return
          const json = line.replace(/^data:\s*/, '')
          if (!json) return
          try {
            const event = JSON.parse(json) as ChatStreamEvent
            handleEvent(event)
          } catch {
            // ignore malformed chunk
          }
        })
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        processBuffer()
      }
      if (buffer.trim()) {
        processBuffer()
      }

      if (!gotFinal && !hasError) {
        const message = labels.error
        setError(message)
        updateAssistantMessage(message)
        setStatus('error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : labels.error
      setError(message)
      updateAssistantMessage(message)
      setStatus('error')
    }
  }, [
    canSend,
    debugEnabled,
    endpoint,
    input,
    labels.error,
    labels.thinking,
    locale,
    messages,
    updateAssistantMessage,
  ])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        onSubmit()
      }
    },
    [onSubmit],
  )

  const helperText = useMemo(() => {
    if (status === 'loading') return labels.thinking
    if (error) return error
    return labels.helper
  }, [error, labels.helper, labels.thinking, status])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{labels.title}</h1>
          <p className="text-sm text-slate-600">{labels.description}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <p>{helperText}</p>
            <button
              type="button"
              onClick={() => {
                const next = !debugEnabled
                setDebugEnabled(next)
                window.localStorage.setItem('aiChatDebug', next ? '1' : '0')
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                debugEnabled
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {locale === 'fr' ? 'Debug' : '调试'}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !progressEnabled
                setProgressEnabled(next)
                window.localStorage.setItem('aiChatProgress', next ? '1' : '0')
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                progressEnabled
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {locale === 'fr' ? 'Suivi' : '详细过程'}
            </button>
          </div>
        </div>
      </div>

      {progressEnabled && progressLog.length > 0 ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            {locale === 'fr' ? 'Suivi en direct' : '进度日志'}
          </div>
          <div className="space-y-1 whitespace-pre-wrap">
            {progressLog.map((line, index) => (
              <div key={`${line}-${index}`}>- {line}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                {labels.emptyState}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {message.content}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="flex flex-col gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={labels.inputPlaceholder}
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none"
              />
              <div className="flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                  {labels.clear}
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSend}
                  className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {labels.send}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
