'use client'

import {
  useCallback,
  useEffect,
  Fragment,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

import type { Locale } from '@/lib/i18n'
import type { AiChatCopy } from '@/lib/i18n/aiChat'
import type { ChatApiMessage, ChatApiRequest } from '@/lib/ai-chat/http'
import type { ChatStreamEvent, ChatToolCallRecord, PlanPayload } from '@/lib/ai-chat/types'
import { AlertDialog } from '@/components/AlertDialog'
import {
  appendMessage,
  createSession,
  deleteSession,
  getMemory,
  listMessages,
  listSessions,
  saveMemory,
  updateSession,
  type ChatSessionRecord,
  type MemoryScopeType,
} from '@/lib/ai-chat/localStore'

type ChatPanelProps = {
  locale: Locale
  endpoint: string
  labels: AiChatCopy
  canDebug: boolean
}

type FetchState = 'idle' | 'loading' | 'error'

type ChatMessage = ChatApiMessage

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const buildRequestBody = (
  input: string,
  history: ChatMessage[],
  locale: Locale,
  memoryContext?: string,
): ChatApiRequest => ({
  input,
  history,
  locale,
  memoryContext,
})

const formatPlanSummary = (
  plan: PlanPayload | undefined,
  stepSummaries: string[] | undefined,
  locale: Locale,
) => {
  if (!plan?.steps?.length) return ''
  const lines: string[] = []
  const title = locale === 'fr' ? 'Plan' : '计划'
  if (plan.goal) {
    lines.push(`${title}: ${plan.goal}`)
  } else {
    lines.push(`${title}:`)
  }
  plan.steps.forEach((step, index) => {
    const apiHint = step.apis && step.apis.length > 0 ? ` (${step.apis.join(', ')})` : ''
    lines.push(`${index + 1}. ${step.title}${apiHint}`)
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

const clampText = (value: string, max = 200) =>
  value.length <= max ? value : `${value.slice(0, max)}...`

const formatSessionTime = (value: string, locale: Locale) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const buildSessionSummary = (input: string, plan?: PlanPayload, locale?: Locale) => {
  const goal = plan?.goal?.trim()
  if (goal) return goal
  const cleaned = input.replace(/\s+/g, ' ').trim()
  if (!cleaned) return locale === 'fr' ? 'Nouvelle conversation' : '新对话'
  return clampText(cleaned, 32)
}

const stripHistoryMeta = (value: string) => {
  const lines = value.split('\n')
  const filtered = lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (/^来源[:：]/.test(trimmed)) return false
    if (/^Sources?:/i.test(trimmed)) return false
    if (/^工具提示[:：]?/.test(trimmed)) return false
    if (/^Tool hints?:/i.test(trimmed)) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const buildHistorySummary = (messages: ChatMessage[], locale: Locale) => {
  if (messages.length === 0) return ''
  const lines: string[] = []
  let pendingQuestion = ''
  messages.forEach((message) => {
    if (message.role === 'user') {
      pendingQuestion = message.content.trim()
      return
    }
    if (message.role === 'assistant' && pendingQuestion) {
      const question = clampText(pendingQuestion, 80)
      const cleaned = stripHistoryMeta(message.content.trim())
      if (!cleaned) {
        pendingQuestion = ''
        return
      }
      const answer = clampText(cleaned, 160)
      lines.push(
        locale === 'fr' ? `Q: ${question} | R: ${answer}` : `问：${question} | 答：${answer}`,
      )
      pendingQuestion = ''
    }
  })
  if (!lines.length) return ''
  return lines.slice(-6).join('\n')
}

const compressHistoryForRequest = (messages: ChatMessage[], locale: Locale): ChatMessage[] => {
  const maxTail = 12
  if (messages.length <= maxTail + 4) return messages
  const tail = messages.slice(-maxTail)
  const head = messages.slice(0, -maxTail)
  const summary = buildHistorySummary(head, locale)
  if (!summary) return tail
  const summaryPrefix = locale === 'fr' ? 'Résumé historique' : '历史摘要'
  const summaryMessage: ChatMessage = {
    role: 'user',
    content: `${summaryPrefix}:\n${summary}`,
  }
  return [summaryMessage, ...tail]
}

const renderInlineMarkdown = (text: string) => {
  const nodes: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const start = match.index
    const end = regex.lastIndex
    if (start > lastIndex) {
      nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>)
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`bold-${start}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`code-${start}`}
          className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[12px] text-slate-800"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`em-${start}`} className="text-slate-700">
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = end
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }
  return nodes
}

const renderMessageBlocks = (content: string) => {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listItems: ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null
  let codeLines: string[] = []
  let inCodeBlock = false

  const flushList = () => {
    if (!listItems.length || !listType) return
    const ListTag = listType === 'ol' ? 'ol' : 'ul'
    const listClass =
      listType === 'ol'
        ? 'ml-5 list-inside list-decimal space-y-1 text-slate-800'
        : 'ml-5 list-inside list-disc space-y-1 text-slate-800'
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className={listClass}>
        {listItems}
      </ListTag>,
    )
    listItems = []
    listType = null
  }

  const flushCode = () => {
    if (!codeLines.length) {
      inCodeBlock = false
      return
    }
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-xs text-slate-100"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>,
    )
    codeLines = []
    inCodeBlock = false
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
      } else {
        flushList()
        inCodeBlock = true
      }
      return
    }
    if (inCodeBlock) {
      codeLines.push(line)
      return
    }
    if (!trimmed) {
      flushList()
      blocks.push(<div key={`spacer-${index}`} className="h-2" />)
      return
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const headingClass =
        level === 1
          ? 'text-base font-semibold text-slate-900'
          : level === 2
            ? 'text-sm font-semibold text-slate-900'
            : 'text-sm font-medium text-slate-800'
      blocks.push(
        <h3 key={`heading-${index}`} className={headingClass}>
          {renderInlineMarkdown(headingMatch[2])}
        </h3>,
      )
      return
    }

    const quoteMatch = /^>\s+(.+)$/.exec(trimmed)
    if (quoteMatch) {
      flushList()
      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-slate-300 pl-3 text-sm text-slate-600"
        >
          {renderInlineMarkdown(quoteMatch[1])}
        </blockquote>,
      )
      return
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed)
    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed)
    if (unorderedMatch) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(<li key={`li-${index}`}>{renderInlineMarkdown(unorderedMatch[1])}</li>)
      return
    }
    if (orderedMatch) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(<li key={`li-${index}`}>{renderInlineMarkdown(orderedMatch[2])}</li>)
      return
    }

    flushList()
    blocks.push(
      <p key={`line-${index}`} className="text-sm leading-relaxed text-slate-800">
        {renderInlineMarkdown(trimmed)}
      </p>,
    )
  })

  flushList()
  if (inCodeBlock) flushCode()
  return <div className="space-y-2">{blocks}</div>
}

const formatToolArguments = (tool: string, args?: Record<string, unknown>) => {
  if (!args || tool !== 'call_api') return ''
  const parts: string[] = []
  if (typeof args.key === 'string') parts.push(`key=${args.key}`)
  if (args.params) parts.push(`params=${truncateText(JSON.stringify(args.params), 160)}`)
  if (args.query) parts.push(`query=${truncateText(JSON.stringify(args.query), 160)}`)
  return parts.length > 0 ? parts.join(' ') : ''
}

const formatToolLabel = (tool: string, args?: Record<string, unknown>) => {
  const detail = formatToolArguments(tool, args)
  return detail ? `${tool} ${detail}` : tool
}

const formatFriendlyToolLabel = (tool: string, label: string | undefined, locale: Locale) => {
  if (label) return label
  if (tool === 'call_api') {
    return locale === 'fr' ? 'Requête de données' : '查询系统数据'
  }
  return locale === 'fr' ? 'Action système' : '系统操作'
}

const formatToolResultDetail = (result: { content?: string; error?: string }) => {
  const detail = result.error || result.content
  return detail ? truncateText(detail, 160) : ''
}

const formatFriendlyFailureReason = (result: { content?: string; error?: string }, locale: Locale) => {
  const error = result.error ? result.error.toLowerCase() : ''
  if (error.includes('permission')) return locale === 'fr' ? 'accès refusé' : '权限不足'
  if (error.includes('missing')) return locale === 'fr' ? 'paramètres manquants' : '参数缺失'
  if (error.includes('invalid')) return locale === 'fr' ? 'paramètres invalides' : '参数不正确'
  if (error.includes('write_not_allowed')) return locale === 'fr' ? 'mode lecture seule' : '只读限制'
  if (error.includes('api_not_allowed')) return locale === 'fr' ? 'endpoint non autorisé' : '接口不在允许范围'
  if (error.includes('tool_not_allowed')) return locale === 'fr' ? 'outil indisponible' : '工具不可用'
  if (error.includes('timeout')) return locale === 'fr' ? 'délai dépassé' : '系统超时'
  if (error.includes('not_found')) return locale === 'fr' ? 'endpoint introuvable' : '未找到接口'
  const content = result.content?.trim() ?? ''
  if (
    content &&
    content !== 'API request failed.' &&
    content !== 'Tool execution failed.' &&
    content !== 'API entry not found.' &&
    content !== 'Permission denied for this API.'
  ) {
    return truncateText(content, 120)
  }
  return locale === 'fr' ? 'échec système' : '系统未完成'
}

const buildMemoryContext = (notes: Array<{ title: string; content: string }>, locale: Locale) => {
  if (notes.length === 0) return ''
  const header = locale === 'fr' ? 'Mémoire locale' : '本地记忆'
  const sections = notes.map((note) => `## ${note.title}\n${note.content.trim()}`)
  return [header, ...sections].join('\n\n')
}

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

export function ChatPanel({ locale, endpoint, labels, canDebug }: ChatPanelProps) {
  const pathname = usePathname()
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryScope, setMemoryScope] = useState<MemoryScopeType>('global')
  const [memoryDraft, setMemoryDraft] = useState('')
  const [memoryTitle, setMemoryTitle] = useState('')
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [memoryUpdatedAt, setMemoryUpdatedAt] = useState<string | null>(null)
  const [projectKey, setProjectKey] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [memoryPreview, setMemoryPreview] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<FetchState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [progressEnabled, setProgressEnabled] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const lastUserIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return i
    }
    return -1
  }, [messages])
  const showProgressInline = progressEnabled && (status === 'loading' || progressLog.length > 0)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionRecord | null>(null)
  const requestRegistryRef = useRef(
    new Map<string, { controller: AbortController; requestId: string }>(),
  )
  const activeSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (canDebug) {
      const stored = window.localStorage.getItem('aiChatDebug')
      if (stored === '1') setDebugEnabled(true)
    } else {
      setDebugEnabled(false)
    }
    const progressStored = window.localStorage.getItem('aiChatProgress')
    if (progressStored === '1') setProgressEnabled(true)
    const storedProject = window.localStorage.getItem('aiChatProjectKey')
    if (storedProject) setProjectKey(storedProject)
  }, [canDebug])

  const canSend = input.trim().length > 0 && status !== 'loading'

  const routeKey = useMemo(() => pathname || 'ai-chat', [pathname])

  const loadSession = useCallback(async (sessionId: string) => {
    const storedMessages = await listMessages(sessionId)
    setMessages(storedMessages.map((item) => ({ role: item.role, content: item.content })))
    setActiveSessionId(sessionId)
    setStatus('idle')
    setError(null)
    setProgressLog([])
  }, [])

  const refreshSessions = useCallback(async () => {
    const items = await listSessions()
    setSessions(items)
    if (!activeSessionId && items.length > 0) {
      await loadSession(items[0].id)
    }
    if (items.length === 0) {
      const created = await createSession(labels.newChat)
      setSessions([created])
      setActiveSessionId(created.id)
      setMessages([])
    }
  }, [activeSessionId, labels.newChat, loadSession])

  useEffect(() => {
    refreshSessions().catch(() => undefined)
  }, [refreshSessions])

  useEffect(() => {
    if (!projectKey) return
    window.localStorage.setItem('aiChatProjectKey', projectKey)
  }, [projectKey])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    const registry = requestRegistryRef.current
    return () => {
      registry.forEach(({ controller }) => controller.abort())
      registry.clear()
    }
  }, [])

  const resolveScopeKey = useCallback(
    (scope: MemoryScopeType) => {
      if (scope === 'global') return 'global'
      if (scope === 'project') return projectKey || 'default'
      if (scope === 'route') return routeKey
      if (scope === 'session') return activeSessionId || 'default'
      return 'default'
    },
    [activeSessionId, projectKey, routeKey],
  )

  const cancelSessionRequest = useCallback((sessionId: string) => {
    const current = requestRegistryRef.current.get(sessionId)
    if (!current) return
    current.controller.abort()
    requestRegistryRef.current.delete(sessionId)
  }, [])

  const loadMemoryDraft = useCallback(async () => {
    const scopeKey = resolveScopeKey(memoryScope)
    const record = await getMemory(memoryScope, scopeKey)
    setMemoryTitle(record?.title ?? '')
    setMemoryDraft(record?.content ?? '')
    setMemoryEnabled(record?.enabled ?? true)
    setMemoryUpdatedAt(record?.updatedAt ?? null)
  }, [memoryScope, resolveScopeKey])

  useEffect(() => {
    if (!memoryOpen) return
    loadMemoryDraft().catch(() => undefined)
  }, [loadMemoryDraft, memoryOpen])

  const buildMemoryContextForRequest = useCallback(async () => {
    try {
      const scopedNotes: Array<{ title: string; content: string }> = []
      const scopes: Array<{ scope: MemoryScopeType; key: string; title: string }> = [
        { scope: 'global', key: 'global', title: labels.memoryScopeGlobal },
        {
          scope: 'project',
          key: projectKey || '',
          title: labels.memoryScopeProject,
        },
        { scope: 'route', key: routeKey, title: labels.memoryScopeRoute },
        {
          scope: 'session',
          key: activeSessionId || '',
          title: labels.memoryScopeSession,
        },
      ]

      for (const item of scopes) {
        if (!item.key) continue
        const record = await getMemory(item.scope, item.key)
        if (!record || !record.enabled) continue
        if (!record.content?.trim()) continue
        const title = record.title?.trim() || item.title
        scopedNotes.push({ title, content: record.content.trim() })
      }

      return buildMemoryContext(scopedNotes, locale)
    } catch {
      return ''
    }
  }, [
    activeSessionId,
    labels.memoryScopeGlobal,
    labels.memoryScopeProject,
    labels.memoryScopeRoute,
    labels.memoryScopeSession,
    locale,
    projectKey,
    routeKey,
  ])

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

  const onClearInput = useCallback(() => {
    setInput('')
  }, [])

  const onCreateSession = useCallback(async () => {
    const created = await createSession(labels.newChat)
    const updated = await listSessions()
    setSessions(updated.length ? updated : [created])
    setActiveSessionId(created.id)
    setMessages([])
    setInput('')
    setStatus('idle')
    setError(null)
    setProgressLog([])
    setSidebarOpen(false)
  }, [labels.newChat])

  const onSaveMemory = useCallback(async () => {
    const scopeKey = resolveScopeKey(memoryScope)
    if (!scopeKey) return
    const record = await saveMemory(memoryScope, scopeKey, {
      title: memoryTitle.trim(),
      content: memoryDraft.trim(),
      enabled: memoryEnabled,
    })
    setMemoryUpdatedAt(record.updatedAt)
    setMemoryTitle(record.title)
    setMemoryDraft(record.content)
  }, [memoryDraft, memoryEnabled, memoryScope, memoryTitle, resolveScopeKey])

  const onEditSession = useCallback((session: ChatSessionRecord) => {
    setEditingSessionId(session.id)
    setEditingTitle(session.summary?.trim() || labels.newChat)
  }, [labels.newChat])

  const onCancelEditSession = useCallback(() => {
    setEditingSessionId(null)
    setEditingTitle('')
  }, [])

  const onSelectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId) return
      if (editingSessionId) {
        onCancelEditSession()
      }
      await loadSession(sessionId)
      setSidebarOpen(false)
    },
    [activeSessionId, editingSessionId, loadSession, onCancelEditSession],
  )

  const onSaveSessionTitle = useCallback(async () => {
    if (!editingSessionId) return
    const nextTitle = editingTitle.trim() || labels.newChat
    const updated = await updateSession(editingSessionId, {
      summary: nextTitle,
      summarySource: 'manual',
    })
    setSessions((prev) =>
      prev.map((session) =>
        session.id === editingSessionId
          ? {
              ...session,
              summary: updated.summary,
              updatedAt: updated.updatedAt,
              summarySource: 'manual',
            }
          : session,
      ),
    )
    setEditingSessionId(null)
    setEditingTitle('')
  }, [editingSessionId, editingTitle, labels.newChat])

  const onDeleteSession = useCallback((session: ChatSessionRecord) => {
    setDeleteTarget(session)
  }, [])

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteTarget) return
    const sessionId = deleteTarget.id
    setDeleteTarget(null)
    cancelSessionRequest(sessionId)
    await deleteSession(sessionId)
    const updated = await listSessions()
    setSessions(updated)
    if (sessionId === activeSessionId) {
      if (updated.length > 0) {
        await loadSession(updated[0].id)
      } else {
        const created = await createSession(labels.newChat)
        setSessions([created])
        setActiveSessionId(created.id)
        setMessages([])
      }
    }
    if (editingSessionId === sessionId) {
      onCancelEditSession()
    }
  }, [activeSessionId, cancelSessionRequest, deleteTarget, editingSessionId, labels.newChat, loadSession, onCancelEditSession])

  const onSessionTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onSaveSessionTitle()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelEditSession()
      }
    },
    [onCancelEditSession, onSaveSessionTitle],
  )

  const onSubmit = useCallback(async () => {
    if (!canSend) return
    const trimmed = input.trim()
    const historySnapshot = [...messages]
    setMessages([...historySnapshot, { role: 'user', content: trimmed }, { role: 'assistant', content: labels.thinking }])
    setInput('')
    setStatus('loading')
    setError(null)
    setProgressLog([])

    let sessionId = activeSessionId
    try {
      if (!sessionId) {
        const created = await createSession(labels.newChat)
        setSessions((prev) => (prev.length ? [created, ...prev] : [created]))
        setActiveSessionId(created.id)
        sessionId = created.id
      }
      if (sessionId) {
        await appendMessage({
          sessionId,
          role: 'user',
          content: trimmed,
          createdAt: new Date().toISOString(),
        })
      }
    } catch {
      // ignore local persistence errors
    }

    if (sessionId) {
      cancelSessionRequest(sessionId)
    }

    const historyForRequest = compressHistoryForRequest(historySnapshot, locale)
    const memoryContext = await buildMemoryContextForRequest()

    let requestId: string | null = null
    try {
      const controller = new AbortController()
      requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      if (sessionId) {
        requestRegistryRef.current.set(sessionId, { controller, requestId })
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(trimmed, historyForRequest, locale, memoryContext)),
        signal: controller.signal,
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
      const pendingToolCalls: Array<{
        tool: string
        arguments: Record<string, unknown>
        label?: string
      }> = []
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
        if (!sessionId) return
        const current = requestRegistryRef.current.get(sessionId)
        if (!current || current.requestId !== requestId) return
        const isActiveSession = activeSessionIdRef.current === sessionId
        switch (event.type) {
          case 'status':
            statusMessage = event.message
            if (isActiveSession) appendProgress(event.message)
            break
          case 'plan':
            plan = event.plan
            if (isActiveSession) {
              if (event.plan.goal) {
                appendProgress(locale === 'fr' ? `Plan: ${event.plan.goal}` : `计划: ${event.plan.goal}`)
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
            }
            break
          case 'step':
            statusMessage =
              locale === 'fr'
                ? `Étape ${event.index + 1}/${event.total}: ${event.step.title}`
                : `执行中：第 ${event.index + 1}/${event.total} 步 ${event.step.title}`
            if (isActiveSession) appendProgress(statusMessage)
            break
          case 'step_done':
            if (event.summary) stepSummaries.push(event.summary)
            statusMessage = locale === 'fr' ? 'Étape terminée.' : '步骤完成。'
            if (isActiveSession) appendProgress(event.summary || statusMessage)
            break
          case 'tool_call':
            pendingToolCalls.push({ tool: event.tool, arguments: event.arguments, label: event.label })
            if (isActiveSession) {
              appendProgress(
                debugEnabled
                  ? locale === 'fr'
                    ? `Appel d'outil: ${formatToolLabel(event.tool, event.arguments)}`
                    : `调用工具: ${formatToolLabel(event.tool, event.arguments)}`
                  : locale === 'fr'
                    ? `Appel: ${formatFriendlyToolLabel(event.tool, event.label, locale)}`
                    : `正在${formatFriendlyToolLabel(event.tool, event.label, locale)}`,
              )
            }
            break
          case 'tool_result': {
            const pendingIndex = pendingToolCalls.findIndex((call) => call.tool === event.tool)
            const pending = pendingIndex >= 0 ? pendingToolCalls.splice(pendingIndex, 1)[0] : undefined
            toolCalls.push({
              tool: event.tool,
              arguments: pending?.arguments ?? {},
              result: event.result,
            })
            const detail = formatToolLabel(event.tool, pending?.arguments)
            const resultDetail = formatToolResultDetail(event.result)
            const friendlyLabel = formatFriendlyToolLabel(event.tool, event.label ?? pending?.label, locale)
            const friendlyReason = formatFriendlyFailureReason(event.result, locale)
            if (isActiveSession) {
              appendProgress(
                debugEnabled
                  ? locale === 'fr'
                    ? `Résultat outil: ${detail} (${event.result.ok ? 'ok' : 'fail'})${resultDetail ? ` ${resultDetail}` : ''}`
                    : `工具结果: ${detail} (${event.result.ok ? '成功' : '失败'})${resultDetail ? ` ${resultDetail}` : ''}`
                  : locale === 'fr'
                    ? event.result.ok
                      ? `Terminé: ${friendlyLabel}`
                      : `Échec: ${friendlyLabel}${friendlyReason ? ` (${friendlyReason})` : ''}`
                    : event.result.ok
                      ? `已完成：${friendlyLabel}`
                      : `未能完成：${friendlyLabel}${friendlyReason ? `（${friendlyReason}）` : ''}`,
              )
            }
            break
          }
          case 'final':
            gotFinal = true
            answer = event.answer
            if (event.plan) plan = event.plan
            if (event.stepSummaries) stepSummaries = event.stepSummaries
            if (event.toolCalls) toolCalls = event.toolCalls
            statusMessage = ''
            if (isActiveSession) {
              setStatus('idle')
              appendProgress(locale === 'fr' ? 'Réponse prête.' : '答复已完成。')
            }
            break
          case 'error':
            statusMessage = event.message
            hasError = true
            if (isActiveSession) {
              setError(event.message)
              setStatus('error')
              appendProgress(event.message)
            }
            break
          default:
            break
        }
        if (isActiveSession) rebuildContent()
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

      const currentRequest =
        sessionId && requestId && requestRegistryRef.current.get(sessionId)?.requestId === requestId
      if (!gotFinal && !hasError && currentRequest && activeSessionIdRef.current === sessionId) {
        const message = labels.error
        setError(message)
        updateAssistantMessage(message)
        setStatus('error')
      }

      try {
        if (sessionId && currentRequest) {
          const assistantContent = answer || (hasError ? labels.error : '')
          if (assistantContent) {
            await appendMessage({
              sessionId,
              role: 'assistant',
              content: assistantContent,
              createdAt: new Date().toISOString(),
            })
          }
          const currentSession = sessions.find((item) => item.id === sessionId)
          if (!currentSession || currentSession.summarySource !== 'manual') {
            const summary = buildSessionSummary(trimmed, plan, locale)
            await updateSession(sessionId, { summary, summarySource: 'auto' })
          }
          await refreshSessions()
        }
      } catch {
        // ignore local persistence errors
      } finally {
        if (sessionId && currentRequest) {
          requestRegistryRef.current.delete(sessionId)
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : labels.error
      if (sessionId && requestId && requestRegistryRef.current.get(sessionId)?.requestId === requestId) {
        requestRegistryRef.current.delete(sessionId)
      }
      if (activeSessionIdRef.current === sessionId) {
        setError(message)
        updateAssistantMessage(message)
        setStatus('error')
      }
      try {
        if (sessionId) {
          await appendMessage({
            sessionId,
            role: 'assistant',
            content: message,
            createdAt: new Date().toISOString(),
          })
          await refreshSessions()
        }
      } catch {
        // ignore persistence errors
      }
    }
  }, [
    activeSessionId,
    buildMemoryContextForRequest,
    cancelSessionRequest,
    canSend,
    debugEnabled,
    endpoint,
    input,
    labels.error,
    labels.newChat,
    labels.thinking,
    locale,
    messages,
    sessions,
    refreshSessions,
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

  const filteredSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return sessions
    return sessions.filter((session) => session.summary.toLowerCase().includes(term))
  }, [searchTerm, sessions])

  const memoryUpdatedLabel = memoryUpdatedAt
    ? formatSessionTime(memoryUpdatedAt, locale)
    : '--'

  const canSaveMemory = memoryScope !== 'project' || projectKey.trim().length > 0

  return (
    <div className="relative flex h-[calc(100vh-150px)] min-h-[640px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`fixed inset-0 z-20 bg-slate-900/20 backdrop-blur-sm transition lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex min-h-0 w-72 flex-col border-r border-slate-200 bg-slate-50/90 backdrop-blur transition lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {labels.sessionsTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateSession}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            {labels.newChat}
          </button>
        </div>
        <div className="px-4 py-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none"
          />
        </div>
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-4">
          {filteredSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-500">
              {labels.emptyState}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const summary = session.summary?.trim() || labels.newChat
              const isActive = session.id === activeSessionId
              const isEditing = session.id === editingSessionId
              const actionVisible = isActive || isEditing
              return (
                <div
                  key={session.id}
                  className={`group w-full rounded-2xl border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <input
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onKeyDown={onSessionTitleKeyDown}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-slate-300 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className={`min-w-0 flex-1 text-left text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-800'}`}
                      >
                        <span className="block truncate">{summary}</span>
                      </button>
                    )}
                    <div
                      className={`flex items-center gap-2 text-[11px] font-semibold transition ${
                        actionVisible
                          ? 'opacity-100'
                          : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onSaveSessionTitle()
                            }}
                            className={`whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-700'} hover:text-slate-900`}
                          >
                            {labels.save}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onCancelEditSession()
                            }}
                            className={`whitespace-nowrap ${isActive ? 'text-blue-100' : 'text-slate-500'} hover:text-slate-700`}
                          >
                            {labels.cancel}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onEditSession(session)
                            }}
                            className={`whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-600'} hover:text-slate-900`}
                          >
                            {labels.rename}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteSession(session)
                            }}
                            className={`whitespace-nowrap ${isActive ? 'text-blue-100' : 'text-slate-500'} hover:text-rose-600`}
                          >
                            {labels.delete}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`mt-1 text-[11px] ${
                      isActive ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {formatSessionTime(session.updatedAt, locale)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/90 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="mt-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900 lg:hidden"
                aria-label={labels.toggleSidebar}
              >
                {labels.sessionsTitle}
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{labels.title}</h1>
                <p className="text-xs text-slate-600">{labels.description}</p>
                <p className="mt-1 text-xs text-slate-500">{helperText}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canDebug ? (
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
              ) : null}
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
              <button
                type="button"
                onClick={() => setMemoryOpen(true)}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300"
                aria-label={labels.toggleMemory}
              >
                {labels.memoryTitle}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {labels.emptyState}
                </div>
              ) : (
                messages.map((message, index) => (
                  <Fragment key={`${message.role}-${index}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        message.role === 'user'
                          ? 'ml-auto bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {message.role === 'assistant'
                        ? renderMessageBlocks(message.content)
                        : message.content}
                    </div>
                    {showProgressInline && index === lastUserIndex ? (
                      <div className="max-w-[85%] rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900 shadow-sm">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                          </span>
                          <span>{locale === 'fr' ? 'Réflexion en cours' : '思考中'}</span>
                          <span className="ml-auto text-[10px] text-emerald-700">
                            {locale === 'fr' ? 'Détails' : '详细过程'}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 whitespace-pre-wrap text-emerald-900/80">
                          {progressLog.length === 0 ? (
                            <div>{locale === 'fr' ? 'Analyse en cours…' : '正在整理…'}</div>
                          ) : (
                            progressLog.map((line, progressIndex) => (
                              <div key={`${line}-${progressIndex}`}>- {line}</div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={labels.inputPlaceholder}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onClearInput}
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

      <div
        className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition ${
          memoryOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMemoryOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-xl transition ${
          memoryOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{labels.memoryTitle}</p>
            <p className="text-xs text-slate-500">{labels.memoryDescription}</p>
          </div>
          <button
            type="button"
            onClick={() => setMemoryOpen(false)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
          >
            {locale === 'fr' ? 'Fermer' : '关闭'}
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {locale === 'fr' ? 'Portée' : '作用范围'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'global', label: labels.memoryScopeGlobal },
                { key: 'project', label: labels.memoryScopeProject },
                { key: 'route', label: labels.memoryScopeRoute },
                { key: 'session', label: labels.memoryScopeSession },
              ] as Array<{ key: MemoryScopeType; label: string }>).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMemoryScope(item.key)
                    setMemoryPreview(false)
                  }}
                  className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                    memoryScope === item.key
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {memoryScope === 'project' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                {labels.memoryProjectKeyLabel}
              </label>
              <input
                value={projectKey}
                onChange={(event) => setProjectKey(event.target.value)}
                placeholder={labels.memoryProjectKeyPlaceholder}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">{labels.memoryTitleLabel}</label>
            <input
              value={memoryTitle}
              onChange={(event) => setMemoryTitle(event.target.value)}
              placeholder={labels.memoryTitlePlaceholder}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMemoryPreview(false)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  !memoryPreview
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {labels.memoryEdit}
              </button>
              <button
                type="button"
                onClick={() => setMemoryPreview(true)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  memoryPreview
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {labels.memoryPreview}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(event) => setMemoryEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              {labels.memoryEnabled}
            </label>
          </div>

          <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            {memoryPreview ? (
              memoryDraft.trim() ? (
                renderMessageBlocks(memoryDraft)
              ) : (
                <p className="text-sm text-slate-400">{labels.memoryContentPlaceholder}</p>
              )
            ) : (
              <textarea
                value={memoryDraft}
                onChange={(event) => setMemoryDraft(event.target.value)}
                placeholder={labels.memoryContentPlaceholder}
                rows={8}
                className="w-full resize-none bg-transparent text-sm text-slate-700 focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {labels.memoryUpdatedLabel}: {memoryUpdatedLabel}
            </span>
            <button
              type="button"
              onClick={onSaveMemory}
              disabled={!canSaveMemory}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {labels.memorySave}
            </button>
          </div>
        </div>
      </aside>
      <AlertDialog
        open={Boolean(deleteTarget)}
        title={labels.delete}
        description={labels.deleteConfirm}
        body={
          deleteTarget ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/90">
              {deleteTarget.summary?.trim() || labels.newChat}
            </div>
          ) : null
        }
        tone="danger"
        actionLabel={labels.delete}
        cancelLabel={labels.cancel}
        onAction={confirmDeleteSession}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
