import { buildSystemPrompt } from './prompt'
import { runPlanner } from './planner'
import { readSemanticCatalog } from './semanticStore'
import { clampMessageLength, extractJsonObject, normalizeWhitespace, safeJsonParse } from './utils'
import type {
  ChatMessage,
  ChatRunOptions,
  ChatRunResult,
  ChatStreamEvent,
  ChatTool,
  ChatToolCallRecord,
  ChatToolContext,
  ChatToolResult,
  ModelResponsePayload,
  PlannerPayload,
  PermissionChecker,
  PlanPayload,
  PlanStep,
  StepDonePayload,
  ToolCallPayload,
} from './types'

const DEFAULT_MAX_TURNS = 6
const DEFAULT_MAX_STEPS = 8
const DEFAULT_MAX_STEP_TURNS = 6
const SUMMARY_MAX_ITEMS = 6
const SUMMARY_TAIL_MESSAGES = 14
const SUMMARY_MAX_CHARS = 1200

const fallbackAnswer = (locale: string) =>
  locale === 'fr'
    ? "Désolé, je n'ai pas pu terminer la demande. Reformulez votre question ou réessayez plus tard."
    : '抱歉，系统未能完成请求，请简化问题或稍后再试。'

const hasRequiredPermissions = async (
  tool: ChatTool,
  permissions: string[],
  permissionChecker?: PermissionChecker,
) => {
  const required = tool.requiredPermissions ?? []
  if (!required.length) return true
  if (!permissions.length && !permissionChecker) return false
  const mode = tool.permissionMode ?? 'all'
  const checks = await Promise.all(
    required.map(async (permission) => {
      if (!permissionChecker) return permissions.includes(permission)
      return permissionChecker(permission)
    }),
  )
  return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
}

const resolveAllowedTools = async (
  tools: ChatTool[],
  permissions: string[],
  permissionChecker?: PermissionChecker,
) => {
  const results: ChatTool[] = []
  for (const tool of tools) {
    if (await hasRequiredPermissions(tool, permissions, permissionChecker)) {
      results.push(tool)
    }
  }
  return results
}

const parseModelPayload = (content: string): ModelResponsePayload | null => {
  const candidate = extractJsonObject(content)
  if (!candidate) return null
  return safeJsonParse<ModelResponsePayload>(candidate)
}

const formatToolResultMessage = (tool: ChatTool, result: ChatToolResult) => {
  if (tool.formatResult) return tool.formatResult(result)
  const summarized = summarizeToolResult(result)
  return `TOOL_RESULT ${tool.name}: ${JSON.stringify(summarized)}`
}

const buildToolContext = (options: ChatRunOptions): ChatToolContext => ({
  session: options.session,
  locale: options.locale ?? 'zh',
  request: options.request,
  permissionChecker: options.permissionChecker,
})

const buildToolLabelMap = async () => {
  const catalog = await readSemanticCatalog()
  const map = new Map<string, string>()
  Object.values(catalog.entries ?? {}).forEach((entry) => {
    if (!entry?.key) return
    if (entry.summary) {
      map.set(entry.key, entry.summary)
      return
    }
    if (entry.intents && entry.intents.length > 0) {
      map.set(entry.key, entry.intents[0])
    }
  })
  return map
}

const resolveToolLabel = (
  tool: string,
  args: Record<string, unknown>,
  locale: string,
  apiLabels: Map<string, string>,
) => {
  if (tool === 'call_api') {
    const key = typeof args.key === 'string' ? args.key.trim() : ''
    if (key) {
      const label = apiLabels.get(key)
      if (label) return label
    }
    return locale === 'fr' ? 'Requête de données' : '查询系统数据'
  }
  const toolLabels: Record<string, { zh: string; fr: string }> = {
    get_system_time: { zh: '获取系统时间', fr: "Heure système" },
    list_api_catalog: { zh: '加载 API 目录', fr: 'Catalogue API' },
    list_road_sections: { zh: '查询路段列表', fr: 'Sections routières' },
    list_active_members: { zh: '查询在职人员', fr: 'Membres actifs' },
    count_members_by_project: { zh: '统计项目人员', fr: 'Effectifs par projet' },
    list_boq_projects: { zh: '查询清单项目', fr: 'Projets BOQ' },
    list_reports: { zh: '查询日报列表', fr: 'Rapports journaliers' },
  }
  const fallback = toolLabels[tool]
  if (fallback) return locale === 'fr' ? fallback.fr : fallback.zh
  return tool
}

const appendMessage = (messages: ChatMessage[], message: ChatMessage) => {
  messages.push(message)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeToolCallArguments = (payload: ToolCallPayload) =>
  typeof payload.arguments === 'object' && payload.arguments !== null
    ? (payload.arguments as Record<string, unknown>)
    : {}

const isInternalUserMessage = (content: string) => {
  if (!content) return false
  if (content.startsWith('TOOL_RESULT ')) return true
  if (content.startsWith('工具摘要:') || content.startsWith('Résumé outils:')) return true
  if (content.startsWith('历史摘要') || content.startsWith('Résumé historique')) return true
  if (content.includes('如需工具请用 tool_call') || content.includes('请按 final JSON')) return true
  if (content.includes('执行第 ') || content.includes('Exécute l\'étape')) return true
  if (content.includes('必须覆盖的 API') || content.includes('Endpoints requis')) return true
  if (content.includes('本次可用 API') || content.includes('Endpoints autorisés')) return true
  if (content.includes('成本/费用类问题必须调用')) return true
  return false
}

const extractFinalAnswer = (content: string) => {
  const candidate = extractJsonObject(content)
  if (!candidate) return null
  const payload = safeJsonParse<{ type?: string; answer?: string }>(candidate)
  if (payload?.type !== 'final') return null
  const answer = typeof payload.answer === 'string' ? payload.answer.trim() : ''
  return answer || null
}

const stripAnswerMeta = (answer: string) => {
  const lines = answer.split('\n')
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

const buildHistorySummary = (history: ChatMessage[], locale: string) => {
  let lastQuestion = ''
  const items: string[] = []
  history.forEach((message) => {
    if (message.role === 'user') {
      if (!isInternalUserMessage(message.content)) {
        lastQuestion = message.content.trim()
      }
      return
    }
    if (message.role !== 'assistant') return
    const answer = extractFinalAnswer(message.content)
    if (!answer || !lastQuestion) return
    const cleanedAnswer = stripAnswerMeta(answer)
    if (!cleanedAnswer) return
    const questionText = clampMessageLength(lastQuestion, 120)
    const answerText = clampMessageLength(cleanedAnswer, 200)
    if (locale === 'fr') {
      items.push(`Q: ${questionText} | R: ${answerText}`)
    } else {
      items.push(`问：${questionText} | 答：${answerText}`)
    }
    lastQuestion = ''
  })
  if (!items.length) return ''
  const summaryItems = items.slice(-SUMMARY_MAX_ITEMS)
  const prefix = locale === 'fr' ? 'Résumé historique' : '历史摘要'
  const summary = summaryItems.map((item) => `- ${item}`).join('\n')
  const merged = `${prefix}:\n${summary}`
  return clampMessageLength(merged, SUMMARY_MAX_CHARS)
}

const MAX_TOOL_RESULT_CHARS = 4000
const MAX_SUMMARY_ROWS = 1000
const MAX_VALUE_BUCKETS = 20
const MAX_SAMPLE_ROWS = 3
const MAX_SAMPLE_KEYS = 8

const formatPreviewValue = (value: unknown) => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) return `[${value.length}]`
  if (typeof value === 'object') return '{...}'
  return String(value)
}

const buildArrayValueCounts = (rows: unknown[]) => {
  const counts = new Map<string, Map<string, number>>()
  const overflowKeys = new Set<string>()
  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return
    Object.entries(row as Record<string, unknown>).forEach(([key, value]) => {
      if (overflowKeys.has(key)) return
      if (value === null || value === undefined) return
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return
      }
      const map = counts.get(key) ?? new Map<string, number>()
      const label = String(value)
      map.set(label, (map.get(label) ?? 0) + 1)
      if (map.size > MAX_VALUE_BUCKETS) {
        overflowKeys.add(key)
        counts.delete(key)
        return
      }
      counts.set(key, map)
    })
  })
  const output: Record<string, Record<string, number>> = {}
  counts.forEach((map, key) => {
    if (map.size <= 1) return
    output[key] = Object.fromEntries(map.entries())
  })
  return output
}

const buildArraySample = (rows: unknown[]) =>
  rows.slice(0, MAX_SAMPLE_ROWS).map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row
    const record = row as Record<string, unknown>
    const preview: Record<string, unknown> = {}
    Object.keys(record)
      .slice(0, MAX_SAMPLE_KEYS)
      .forEach((key) => {
        preview[key] = formatPreviewValue(record[key])
      })
    return preview
  })

const summarizeToolResult = (result: ChatToolResult): ChatToolResult => {
  if (!result.data) return result
  try {
    const serialized = JSON.stringify(result.data)
    if (serialized.length <= MAX_TOOL_RESULT_CHARS) return result
    const data = result.data
    let summary: Record<string, unknown> = {}
    if (Array.isArray(data)) {
      const rows = data.slice(0, MAX_SUMMARY_ROWS)
      summary = {
        kind: 'array',
        length: data.length,
        sample: buildArraySample(rows),
        valueCounts: buildArrayValueCounts(rows),
      }
    } else if (data && typeof data === 'object') {
      const keys = Object.keys(data as Record<string, unknown>)
      const preview = keys.slice(0, MAX_SAMPLE_KEYS).reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = formatPreviewValue((data as Record<string, unknown>)[key])
        return acc
      }, {})
      const arraySummaries: Record<string, unknown> = {}
      keys.slice(0, 6).forEach((key) => {
        const value = (data as Record<string, unknown>)[key]
        if (!Array.isArray(value)) return
        const rows = value.slice(0, MAX_SUMMARY_ROWS)
        arraySummaries[key] = {
          length: value.length,
          sample: buildArraySample(rows),
          valueCounts: buildArrayValueCounts(rows),
        }
      })
      summary = {
        kind: 'object',
        keys: keys.slice(0, 12),
        preview,
        ...(Object.keys(arraySummaries).length > 0 ? { arraySummaries } : {}),
      }
    } else {
      summary = { kind: typeof data, value: data }
    }
    return {
      ...result,
      data: {
        summary,
        truncated: true,
      },
    }
  } catch {
    return result
  }
}

const TOOL_TIMEOUT_MS = 15000
const TOOL_MAX_RETRIES = 1

const stableStringify = (value: unknown): string => {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
  return `{${entries.join(',')}}`
}

const buildToolCacheKey = (tool: string, args: Record<string, unknown>) =>
  `${tool}:${stableStringify(args)}`

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('tool_timeout'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const extractLastUserMessage = (messages: ChatMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return messages[i].content
    }
  }
  return ''
}

const extractMonthYearHint = (content: string) => {
  const monthMatch = content.match(/(\d{1,2})\s*月/)
  const yearMatch = content.match(/(\d{4})\s*年/)
  const isoMatch = content.match(/(\d{4})[-/](\d{1,2})/)
  const month = monthMatch ? Number(monthMatch[1]) : isoMatch ? Number(isoMatch[2]) : undefined
  const year = yearMatch ? Number(yearMatch[1]) : isoMatch ? Number(isoMatch[1]) : undefined
  if (month && (month < 1 || month > 12)) return { month: undefined, year }
  return { month, year }
}

const extractFinanceSubject = (content: string) => {
  const match = content.match(/[和与](.+?)(有关|相关|的)?成本/)
  if (!match) return ''
  return match[1]?.trim() ?? ''
}

const isFinanceQuestion = (content: string) => {
  const text = content.toLowerCase()
  const keywords = [
    '成本',
    '费用',
    '支出',
    '开支',
    '财务',
    '付款',
    'payment',
    'expense',
    'cost',
    'finance',
    'insights',
  ]
  return keywords.some((keyword) => text.includes(keyword))
}

const isWorkContentQuestion = (content: string) => {
  const text = content.toLowerCase()
  const keywords = [
    '工作内容',
    '主要工作',
    '做了什么',
    '做哪些工作',
    '做什么工作',
    '现场工作',
    '施工内容',
    '施工情况',
    '现场情况',
    '原始日志',
    '领导日志',
    'journal de chantier',
    'travaux',
    'chantier',
  ]
  if (keywords.some((keyword) => text.includes(keyword))) return true
  return /工作/.test(content) && /(什么|哪些|主要|情况)/.test(content)
}

const isCapabilityQuestion = (content: string) => {
  const text = content.toLowerCase()
  const keywords = [
    '能做什么',
    '能做哪些',
    '可以做什么',
    '可以做哪些',
    '有哪些功能',
    '功能有哪些',
    '支持什么',
    '能帮我什么',
    '你能做什么',
    '你能做哪些',
    '你可以做什么',
    '你可以做哪些',
    'what can you do',
    'what can i ask',
    'what can you help',
    'capability',
    'capabilities',
  ]
  return keywords.some((keyword) => text.includes(keyword))
}

const shouldUseMultipleSources = (
  content: string,
  candidates: Array<{ key: string }>,
) => {
  if (candidates.length < 2) return false
  const text = content.toLowerCase()
  const hints = [
    '汇总',
    '统计',
    '对比',
    '分别',
    '同时',
    '以及',
    '并且',
    '全部',
    '所有',
    '总览',
    '明细',
    '详情',
    '列表',
    'compare',
    'summary',
    'breakdown',
    'detail',
    'list',
    'and',
  ]
  return hints.some((hint) => text.includes(hint))
}

const deriveEvidenceFields = (
  question: string,
  plannerFields: string[] | undefined,
  candidateMeta: Map<string, { evidenceFields?: string[] }>,
  requiredKeys: string[],
) => {
  const provided = (plannerFields ?? []).map((field) => field.trim()).filter(Boolean)
  if (provided.length > 0) return provided
  const fromCandidates = requiredKeys
    .map((key) => candidateMeta.get(key)?.evidenceFields ?? [])
    .flat()
    .map((field) => field.trim())
    .filter(Boolean)
  if (fromCandidates.length > 0) return Array.from(new Set(fromCandidates))
  const text = question.toLowerCase()
  const detailHints = ['内容', '详情', '明细', '主要', 'summary', 'detail', 'breakdown', 'list']
  if (!detailHints.some((hint) => text.includes(hint))) return []
  return ['content', 'description', 'detail', 'items', 'logs', 'entries', 'summary']
}

const normalizeFieldName = (value: string) => value.toLowerCase()

const isValuePresent = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return false
}

const collectEvidenceMatches = (
  value: unknown,
  fields: string[],
  found: Set<string>,
  depth = 0,
) => {
  if (depth > 4) return
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach((item) => collectEvidenceMatches(item, fields, found, depth + 1))
    return
  }
  if (typeof value !== 'object') return
  const record = value as Record<string, unknown>
  Object.entries(record).forEach(([key, fieldValue]) => {
    const normalizedKey = normalizeFieldName(key)
    fields.forEach((field) => {
      const normalizedField = normalizeFieldName(field)
      if (
        normalizedKey === normalizedField ||
        normalizedKey.includes(normalizedField)
      ) {
        if (isValuePresent(fieldValue)) {
          found.add(field)
        }
      }
    })
    collectEvidenceMatches(fieldValue, fields, found, depth + 1)
  })
}

const evaluateEvidence = (toolCalls: ChatToolCallRecord[], fields: string[]) => {
  if (!fields.length) {
    return { missing: [], found: [] }
  }
  const found = new Set<string>()
  toolCalls.forEach((call) => {
    collectEvidenceMatches(call.result?.data, fields, found)
  })
  const missing = fields.filter((field) => !found.has(field))
  return { missing, found: Array.from(found) }
}

const extractIdentifiers = (value: unknown, detailKeys: string[], results: Map<string, Set<string>>) => {
  const maxDepth = 4
  const walk = (node: unknown, depth: number) => {
    if (depth > maxDepth || node === null || node === undefined) return
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1))
      return
    }
    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>
    Object.entries(record).forEach(([key, fieldValue]) => {
      const normalizedKey = normalizeFieldName(key)
      detailKeys.forEach((detailKey) => {
        const normalizedDetail = normalizeFieldName(detailKey)
        if (normalizedKey === normalizedDetail || normalizedKey.includes(normalizedDetail)) {
          if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
            const bucket = results.get(detailKey) ?? new Set<string>()
            bucket.add(String(fieldValue))
            results.set(detailKey, bucket)
          } else if (Array.isArray(fieldValue)) {
            const bucket = results.get(detailKey) ?? new Set<string>()
            fieldValue.forEach((item) => {
              if (typeof item === 'string' || typeof item === 'number') {
                bucket.add(String(item))
              }
            })
            results.set(detailKey, bucket)
          }
        }
      })
      walk(fieldValue, depth + 1)
    })
  }
  walk(value, 0)
}

const collectIdentifierHints = (toolCalls: ChatToolCallRecord[], detailKeys: string[]) => {
  if (!detailKeys.length) return {}
  const results = new Map<string, Set<string>>()
  toolCalls.forEach((call) => {
    extractIdentifiers(call.result?.data, detailKeys, results)
  })
  const output: Record<string, string[]> = {}
  results.forEach((set, key) => {
    output[key] = Array.from(set).slice(0, 6)
  })
  return output
}

const collectIdentifiersFromData = (data: unknown, detailKeys: string[]) => {
  if (!detailKeys.length) return {}
  const results = new Map<string, Set<string>>()
  extractIdentifiers(data, detailKeys, results)
  const output: Record<string, string[]> = {}
  results.forEach((set, key) => {
    output[key] = Array.from(set).slice(0, 6)
  })
  return output
}

const buildAutoDetailCalls = (input: {
  toolCalls: ChatToolCallRecord[]
  candidateMeta: Map<string, {
    detailEndpointKey?: string
    detailParam?: string
    detailParamLocation?: 'path' | 'query'
    idField?: string
    detailKeys?: string[]
  }>
  fallbackDetailKeys: string[]
  maxCalls: number
  cache: Set<string>
}): ToolCallPayload[] => {
  const calls: ToolCallPayload[] = []
  for (const call of input.toolCalls) {
    if (calls.length >= input.maxCalls) break
    if (call.tool !== 'call_api') continue
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    if (!key) continue
    const meta = input.candidateMeta.get(key)
    if (!meta?.detailEndpointKey) continue
    const detailKey = meta.detailEndpointKey
    const detailParam = meta.detailParam || meta.idField || 'id'
    const location = meta.detailParamLocation ?? 'query'
    const detailKeys = Array.from(
      new Set(
        (meta.detailKeys ?? []).concat(meta.idField ? [meta.idField] : [], input.fallbackDetailKeys),
      ),
    ).filter(Boolean)
    const identifiers = collectIdentifiersFromData(call.result?.data, detailKeys)
    const primaryValues =
      identifiers[detailParam] ??
      identifiers[meta.idField ?? ''] ??
      Object.values(identifiers)[0] ??
      []
    for (const value of primaryValues) {
      if (calls.length >= input.maxCalls) break
      const args =
        location === 'path'
          ? { key: detailKey, params: { [detailParam]: value } }
          : { key: detailKey, query: { [detailParam]: value } }
      const cacheKey = buildToolCacheKey('call_api', args)
      if (input.cache.has(cacheKey)) continue
      input.cache.add(cacheKey)
      calls.push({ type: 'tool_call', tool: 'call_api', arguments: args })
    }
  }
  return calls
}

const hasFinanceInsightsCall = (toolCalls: ChatToolCallRecord[]) =>
  toolCalls.some((call) => {
    if (call.tool !== 'call_api') return false
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    return key === 'get:/api/finance/insights'
  })

const hasSystemTimeCall = (toolCalls: ChatToolCallRecord[]) =>
  toolCalls.some((call) => call.tool === 'get_system_time' && call.result?.ok)

const hasLeaderLogsCall = (toolCalls: ChatToolCallRecord[]) =>
  toolCalls.some((call) => {
    if (call.tool !== 'call_api') return false
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    return key === 'get:/api/leader-logs'
  })

const extractLeaderLogsData = (toolCalls: ChatToolCallRecord[]) => {
  const dates: string[] = []
  const logs: Array<{
    date?: string
    contentRaw?: string
    photoCount?: number
    supervisorId?: number
    supervisorName?: string
  }> = []
  toolCalls.forEach((call) => {
    if (call.tool !== 'call_api') return
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    if (key !== 'get:/api/leader-logs') return
    const data = call.result?.data
    if (!isRecord(data)) return
    if (Array.isArray(data.dates)) {
      data.dates.forEach((date) => {
        if (typeof date === 'string') dates.push(date)
      })
    }
    if (Array.isArray(data.logs)) {
      data.logs.forEach((item) => {
        if (!isRecord(item)) return
        logs.push({
          date: typeof item.date === 'string' ? item.date : undefined,
          contentRaw: typeof item.contentRaw === 'string' ? item.contentRaw : undefined,
          photoCount: typeof item.photoCount === 'number' ? item.photoCount : undefined,
          supervisorId: typeof item.supervisorId === 'number' ? item.supervisorId : undefined,
          supervisorName:
            typeof item.supervisorName === 'string' ? item.supervisorName : undefined,
        })
      })
    }
  })
  return {
    dates: Array.from(new Set(dates)),
    logs,
    hasContent: logs.some((log) => (log.contentRaw ?? '').trim().length > 0 || (log.photoCount ?? 0) > 0),
  }
}

const collectCallApiKeys = (toolCalls: ChatToolCallRecord[]) => {
  const keys = new Set<string>()
  toolCalls.forEach((call) => {
    if (call.tool !== 'call_api') return
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    if (key) keys.add(key)
  })
  return keys
}

const extractReportCallStatus = (toolCalls: ChatToolCallRecord[]) => {
  const lastCall = [...toolCalls].reverse().find((call) => {
    if (call.tool !== 'call_api') return false
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    return key === 'get:/api/reports/:date'
  })
  if (!lastCall) return null
  const data = lastCall.result?.data
  const exists = isRecord(data) && typeof data.exists === 'boolean' ? data.exists : null
  const params = isRecord(lastCall.arguments?.params) ? lastCall.arguments?.params : null
  const date = params && typeof params.date === 'string' ? params.date : null
  return { exists, date }
}

const financeInsightsQueryMissingRange = (toolCalls: ChatToolCallRecord[]) => {
  const lastCall = [...toolCalls].reverse().find((call) => {
    if (call.tool !== 'call_api') return false
    return call.arguments?.key === 'get:/api/finance/insights'
  })
  if (!lastCall) return true
  const query = lastCall.arguments?.query
  if (!query || typeof query !== 'object') return true
  const queryKeys = Object.keys(query as Record<string, unknown>)
  return !queryKeys.includes('dateFrom') || !queryKeys.includes('dateTo')
}

const extractFinanceInsightResults = (toolCalls: ChatToolCallRecord[]) => {
  return toolCalls
    .filter((call) => call.tool === 'call_api' && call.arguments?.key === 'get:/api/finance/insights')
    .map((call) => {
      const query = isRecord(call.arguments?.query) ? call.arguments?.query : undefined
      const data = call.result?.data
      const insights = isRecord(data) && isRecord(data.insights) ? data.insights : undefined
      const totalAmount = typeof insights?.totalAmount === 'number' ? insights.totalAmount : 0
      const entryCount = typeof insights?.entryCount === 'number' ? insights.entryCount : 0
      const filtered = Boolean(
        query &&
          (query.reasonKeyword ||
            query.remarkKeyword ||
            query.categoryKey ||
            query.categoryKeys),
      )
      return { query, totalAmount, entryCount, filtered }
    })
}

const normalizePlanPayload = (payload: PlanPayload): PlanPayload | null => {
  if (!payload || payload.type !== 'plan') return null
  const goal = typeof payload.goal === 'string' ? payload.goal.trim() : ''
  const steps = Array.isArray(payload.steps) ? payload.steps : []
  const normalizedSteps: PlanStep[] = steps
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null
      const title = typeof step.title === 'string' ? step.title.trim() : ''
      if (!title) return null
      const id =
        typeof step.id === 'string' && step.id.trim().length > 0
          ? step.id.trim()
          : `step-${index + 1}`
      const tools = Array.isArray(step.tools)
        ? step.tools
            .filter((tool) => typeof tool === 'string')
            .map((tool) => tool.trim())
            .filter((tool) => tool.length > 0)
        : []
      const apis = Array.isArray((step as Record<string, unknown>).apis)
        ? (step as Record<string, unknown>).apis
            ?.filter((api) => typeof api === 'string')
            .map((api) => api.trim())
            .filter((api) => api.length > 0)
        : []
      if (tools.length) {
        return apis.length ? { id, title, tools, apis } : { id, title, tools }
      }
      return apis.length ? { id, title, apis } : { id, title }
    })
    .filter((step): step is PlanStep => Boolean(step))

  if (!normalizedSteps.length) return null
  return { type: 'plan', goal, steps: normalizedSteps }
}

const buildStepInstruction = (step: PlanStep, index: number, total: number, locale: string) => {
  const toolHint = step.tools?.length
    ? locale === 'fr'
      ? `Outils suggérés: ${step.tools.join(', ')}.`
      : `可用工具：${step.tools.join('、')}。`
    : ''
  const apiHint = step.apis?.length
    ? locale === 'fr'
      ? `Endpoints suggérés: ${step.apis.join(', ')}.`
      : `候选API：${step.apis.join('、')}。`
    : ''
  const combinedHint = [toolHint, apiHint].filter(Boolean).join(' ')

  if (locale === 'fr') {
    return normalizeWhitespace(
      `Exécute l'étape ${index + 1}/${total}: ${step.title}. ${combinedHint} ` +
        'Si un outil est nécessaire, réponds avec tool_call. Quand l\'étape est terminée, réponds avec step_done.',
    )
  }

  return normalizeWhitespace(
    `执行第 ${index + 1}/${total} 步：${step.title}。${combinedHint} ` +
      '如需工具请用 tool_call JSON，完成后返回 step_done JSON。',
  )
}

const buildFinalInstruction = (locale: string, note?: string) => {
  if (locale === 'fr') {
    return normalizeWhitespace(
      `Donne la réponse finale au format JSON (type=final).${note ? ` ${note}` : ''}`,
    )
  }
  return normalizeWhitespace(
    `请按 final JSON 格式给出最终答复。${note ? ` ${note}` : ''}`,
  )
}

export const runChat = async (options: ChatRunOptions): Promise<ChatRunResult> => {
  const locale = options.locale ?? 'zh'
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS
  const maxStepTurns = options.maxStepTurns ?? DEFAULT_MAX_STEP_TURNS
  const enablePlanning = options.enablePlanning ?? false
  const lastUserQuestion = extractLastUserMessage(options.messages)
  const needsFinanceInsights = isFinanceQuestion(lastUserQuestion)
  const financeSubject = extractFinanceSubject(lastUserQuestion)
  const monthHint = extractMonthYearHint(lastUserQuestion)
  const sessionPermissions = options.session?.permissions ?? []
  const contextCandidates = options.contextCandidates ?? []
  const candidateMeta = new Map(
    contextCandidates.map((item) => [item.key, item]),
  )
  const detailEndpointKeys = new Set(
    contextCandidates
      .map((item) => item.detailEndpointKey)
      .filter((value): value is string => Boolean(value)),
  )
  const primaryCandidates = contextCandidates.filter(
    (item) => item.key && !detailEndpointKeys.has(item.key),
  )
  const candidateKeys = Array.from(
    new Set(
      (primaryCandidates.length > 0 ? primaryCandidates : contextCandidates)
        .map((item) => item.key)
        .filter((value): value is string => Boolean(value)),
    ),
  )
  let plannerPlan: PlannerPayload | undefined
  const allowedToolsBase = await resolveAllowedTools(
    options.tools,
    sessionPermissions,
    options.permissionChecker,
  )
  const emitEvent = (event: ChatStreamEvent) => {
    if (!options.onEvent) return
    try {
      options.onEvent(event)
    } catch {
      // ignore stream failures
    }
  }

  const apiLabelMap = await buildToolLabelMap()

  emitEvent({
    type: 'status',
    message: locale === 'fr' ? 'Génération du plan…' : '正在生成计划…',
  })

  plannerPlan = await runPlanner({
    adapter: options.adapter,
    locale,
    question: lastUserQuestion,
    candidates: candidateKeys,
    contextMessage: options.contextMessage ?? undefined,
    maxSteps: Math.min(maxSteps, 6),
  })

  if (plannerPlan) {
    emitEvent({ type: 'plan', plan: plannerPlan })
  }

  const plannedCandidates = plannerPlan?.candidateApis?.length
    ? plannerPlan.candidateApis
    : candidateKeys
  const uniqueCandidates = Array.from(new Set(plannedCandidates.filter(Boolean)))
  const candidateForHeuristic = primaryCandidates.length > 0 ? primaryCandidates : contextCandidates
  const heuristicMinCalls = shouldUseMultipleSources(lastUserQuestion, candidateForHeuristic) ? 2 : 1
  const minApiCallsBase = plannerPlan?.minApiCalls ?? heuristicMinCalls
  const requiredApiKeysRaw = plannerPlan?.requiredApis?.length
    ? plannerPlan.requiredApis
    : uniqueCandidates.slice(0, minApiCallsBase)
  const requiredApiKeys = requiredApiKeysRaw.filter((key) => uniqueCandidates.includes(key))
  const minApiCalls = Math.max(minApiCallsBase, requiredApiKeys.length || 1)
  const evidenceFields = deriveEvidenceFields(
    lastUserQuestion,
    plannerPlan?.evidenceFields,
    candidateMeta,
    requiredApiKeys,
  )
  const detailKeys = (plannerPlan?.detailKeys ?? [])
    .filter(Boolean)
    .concat(
      requiredApiKeys
        .map((key) => candidateMeta.get(key)?.detailKeys ?? [])
        .flat(),
    )
  const uniqueDetailKeys = Array.from(new Set(detailKeys))
  const allowedTools = allowedToolsBase

  const toolMap = new Map(allowedTools.map((tool) => [tool.name, tool]))
  const systemPrompt = buildSystemPrompt({ tools: allowedTools, locale, enablePlanning })
  const conversation: ChatMessage[] = [{ role: 'system', content: systemPrompt }]
  if (options.contextMessage) {
    conversation.push({ role: 'system', content: options.contextMessage })
  }
  if (uniqueCandidates.length > 0) {
    const candidateMessage =
      locale === 'fr'
        ? `Endpoints suggérés pour cette demande: ${uniqueCandidates.join(', ')}.`
        : `本次候选 API key：${uniqueCandidates.join('、')}。`
    conversation.push({ role: 'system', content: candidateMessage })
  }
  if (requiredApiKeys.length > 0) {
    const requiredMessage =
      locale === 'fr'
        ? `Endpoints requis: ${requiredApiKeys.join(', ')}. Minimum d'appels API: ${minApiCalls}.`
        : `必须覆盖的 API：${requiredApiKeys.join('、')}。最少调用 ${minApiCalls} 个 API。`
    conversation.push({ role: 'system', content: requiredMessage })
  }
  conversation.push(...options.messages)

  const baseSystemMessages = conversation.filter((message) => message.role === 'system')
  const userQuestionMessage: ChatMessage = { role: 'user', content: lastUserQuestion }

  const buildToolSummaryForModel = (records: ChatToolCallRecord[]) => {
    if (records.length === 0) return ''
    const summary = records.map((call) => {
      const args = call.arguments ?? {}
      const normalized = summarizeToolResult(call.result ?? { ok: false, content: '' })
      return {
        tool: call.tool,
        key: typeof args.key === 'string' ? args.key : undefined,
        params: args.params,
        query: args.query,
        ok: call.result?.ok ?? false,
        content: call.result?.content,
        data: normalized.data,
      }
    })
    const prefix = locale === 'fr' ? 'Résumé outils:' : '工具摘要:'
    return `${prefix} ${JSON.stringify(summary)}`
  }

  const resetConversationForReplan = (note?: string) => {
    conversation.length = 0
    conversation.push(...baseSystemMessages)
    if (userQuestionMessage.content) {
      conversation.push(userQuestionMessage)
    }
    const toolSummary = buildToolSummaryForModel(toolCalls)
    if (toolSummary) {
      conversation.push({ role: 'user', content: toolSummary })
    }
    if (note) {
      conversation.push({ role: 'user', content: note })
    }
  }

  const buildModelMessages = () => {
    const maxMessages = 40
    if (conversation.length <= maxMessages) return conversation
    let index = 0
    while (index < conversation.length && conversation[index].role === 'system') {
      index += 1
    }
    const systemMessages = conversation.slice(0, index)
    const history = conversation.slice(index)
    const remaining = Math.max(maxMessages - systemMessages.length, 0)
    if (history.length <= remaining) {
      return [...systemMessages, ...history]
    }
    const tailCount = Math.min(SUMMARY_TAIL_MESSAGES, remaining)
    const tail = history.slice(-tailCount)
    const head = history.slice(0, Math.max(history.length - tailCount, 0))
    const summary = buildHistorySummary(head, locale)
    if (summary) {
      return [...systemMessages, { role: 'system', content: summary }, ...tail]
    }
    return [...systemMessages, ...tail]
  }
  const toolCalls: ChatToolCallRecord[] = []
  const toolResultCache = new Map<string, ChatToolResult>()
  const autoDetailCache = new Set<string>()
  const stepSummaries: string[] = []
  let plan: PlanPayload | undefined
  let lastUsage: ChatRunResult['usage']
  let financeGuardApplied = false

  if (plannerPlan) {
    const normalizedPlannerPlan = normalizePlanPayload(plannerPlan)
    if (normalizedPlannerPlan) {
      plan = normalizedPlannerPlan
      appendMessage(conversation, { role: 'assistant', content: JSON.stringify(normalizedPlannerPlan) })
    }
  }

  const finalizeAnswer = (answer: string): ChatRunResult => {
    const usedApiKeys = Array.from(collectCallApiKeys(toolCalls))
    const hasSources =
      /来源|sources?:/i.test(answer)
    const sourceLine =
      usedApiKeys.length > 0 && !hasSources
        ? locale === 'fr'
          ? `\n\nSources: ${usedApiKeys.join(', ')}`
          : `\n\n来源: ${usedApiKeys.join('、')}`
        : ''
    const finalAnswer = `${answer}${sourceLine}`.trim()
    const result: ChatRunResult = {
      answer: finalAnswer,
      toolCalls,
      plan,
      stepSummaries,
      usage: lastUsage,
    }
    emitEvent({
      type: 'final',
      answer: finalAnswer,
      plan,
      stepSummaries,
      toolCalls,
    })
    return result
  }

  const executeToolCall = async (payload: ToolCallPayload) => {
    const tool = toolMap.get(payload.tool)
    const args = normalizeToolCallArguments(payload)
    const toolLabel = resolveToolLabel(payload.tool, args, locale, apiLabelMap)
    emitEvent({ type: 'tool_call', tool: payload.tool, arguments: args, label: toolLabel })
    appendMessage(conversation, { role: 'assistant', content: JSON.stringify(payload) })

    if (!tool) {
      const result: ChatToolResult = {
        ok: false,
        content: 'Tool not available for this user.',
        error: 'tool_not_allowed',
      }
      toolCalls.push({ tool: payload.tool, arguments: args, result })
      emitEvent({ type: 'tool_result', tool: payload.tool, result, label: toolLabel })
      appendMessage(conversation, {
        role: 'user',
        content: `TOOL_RESULT ${payload.tool}: ${JSON.stringify(result)}`,
      })
      return
    }

    const cacheKey = buildToolCacheKey(tool.name, args)
    const cachedResult = toolResultCache.get(cacheKey)
    if (cachedResult) {
      toolCalls.push({ tool: tool.name, arguments: args, result: cachedResult })
      emitEvent({ type: 'tool_result', tool: tool.name, result: cachedResult, label: toolLabel })
      appendMessage(conversation, { role: 'user', content: formatToolResultMessage(tool, cachedResult) })
      return
    }

    let result: ChatToolResult
    try {
      let attempt = 0
      while (true) {
        try {
          result = await withTimeout(tool.handler(args, buildToolContext(options)), TOOL_TIMEOUT_MS)
          break
        } catch (error) {
          if (attempt >= TOOL_MAX_RETRIES) {
            throw error
          }
          attempt += 1
        }
      }
    } catch (error) {
      result = {
        ok: false,
        content: 'Tool execution failed.',
        error: error instanceof Error ? error.message : String(error),
      }
    }
    toolResultCache.set(cacheKey, result)
    toolCalls.push({ tool: tool.name, arguments: args, result })
    emitEvent({ type: 'tool_result', tool: tool.name, result, label: toolLabel })
    appendMessage(conversation, { role: 'user', content: formatToolResultMessage(tool, result) })
  }

  const applyPlan = (nextPlan: PlanPayload, resetSummaries = false) => {
    plan = nextPlan
    if (resetSummaries) stepSummaries.length = 0
    emitEvent({ type: 'plan', plan: nextPlan })
    appendMessage(conversation, { role: 'assistant', content: JSON.stringify(nextPlan) })
  }

  const hasFinanceSubjectFilter = (subject: string, records: ChatToolCallRecord[]) => {
    const cleaned = subject.trim()
    if (!cleaned) return true
    const lowered = cleaned.toLowerCase()
    return records.some((record) => {
      if (record.tool !== 'call_api') return false
      const key = typeof record.arguments?.key === 'string' ? record.arguments.key : ''
      if (key !== 'get:/api/finance/insights') return false
      const query = record.arguments?.query
      if (!query || typeof query !== 'object') return false
      const queryRecord = query as Record<string, unknown>
      if (queryRecord.categoryKey || queryRecord.categoryKeys) return true
      const reason = typeof queryRecord.reasonKeyword === 'string' ? queryRecord.reasonKeyword : ''
      const remark = typeof queryRecord.remarkKeyword === 'string' ? queryRecord.remarkKeyword : ''
      return reason.toLowerCase().includes(lowered) || remark.toLowerCase().includes(lowered)
    })
  }

  const buildReplanMessage = () => {
    const hints: string[] = []
    const capabilityQuestion = isCapabilityQuestion(lastUserQuestion)
    if (needsFinanceInsights && financeSubject && !hasFinanceSubjectFilter(financeSubject, toolCalls)) {
      hints.push(
        locale === 'fr'
          ? `Ajoute un filtre pour "${financeSubject}" (reasonKeyword/remarkKeyword, ou categoryKey).`
          : `补充“${financeSubject}”相关过滤（reasonKeyword/remarkKeyword 或 categoryKey）。`,
      )
    }
    if (needsFinanceInsights && monthHint.month && !monthHint.year && !hasSystemTimeCall(toolCalls)) {
      hints.push(
        locale === 'fr'
          ? "Le mois n'a pas d'année. Appelle get_system_time puis calcule dateFrom/dateTo."
          : '月份未给年份，先调用 get_system_time 再推算 dateFrom/dateTo。',
      )
    }
    if (needsFinanceInsights && financeInsightsQueryMissingRange(toolCalls)) {
      hints.push(
        locale === 'fr'
          ? 'Ajoute dateFrom/dateTo pour la période demandée.'
          : '补充对应时间范围的 dateFrom/dateTo。',
      )
    }
    if (needsFinanceInsights && financeSubject) {
      const insightResults = extractFinanceInsightResults(toolCalls)
      const filteredResults = insightResults.filter((result) => result.filtered)
      const hasPositive = filteredResults.some(
        (result) => result.totalAmount > 0 || result.entryCount > 0,
      )
      if (filteredResults.length > 0 && !hasPositive) {
        hints.push(
          locale === 'fr'
            ? `Aucun résultat trouvé pour \"${financeSubject}\". Essaie get:/api/finance/categories pour trouver le categoryKey, puis relance insights avec categoryKey.`
            : `未找到“${financeSubject}”相关结果，可先调用 get:/api/finance/categories 找到 categoryKey，再用 categoryKey 重新查询。`,
        )
      }
    }
    let evidence: { missing: string[]; found: string[] } | null = null
    if (evidenceFields.length > 0) {
      evidence = evaluateEvidence(toolCalls, evidenceFields)
      if (evidence.missing.length > 0) {
        if (!capabilityQuestion || toolCalls.length === 0) {
          const idHints = collectIdentifierHints(
            toolCalls,
            uniqueDetailKeys.length ? uniqueDetailKeys : ['date', 'id'],
          )
          const idHintText = Object.keys(idHints).length
            ? locale === 'fr'
              ? `Identifiants trouvés: ${Object.entries(idHints)
                  .map(([key, values]) => `${key}=${values.join(', ')}`)
                  .join(' ; ')}.`
              : `已发现标识符：${Object.entries(idHints)
                  .map(([key, values]) => `${key}=${values.join('、')}`)
                  .join('；')}。`
            : ''
          hints.push(
            locale === 'fr'
              ? `Preuves manquantes (${evidence.missing.join(', ')}). Utilise les identifiants disponibles pour récupérer les détails via un endpoint adapté. ${idHintText}`
              : `证据字段缺失（${evidence.missing.join('、')}），请使用可用标识符调用合适的详情端点获取内容。${idHintText}`,
          )
        }
      }
    }
    if (!capabilityQuestion && (requiredApiKeys.length > 0 || minApiCalls > 1)) {
      const usedKeys = collectCallApiKeys(toolCalls)
      const missingRequired =
        requiredApiKeys.length > 0
          ? requiredApiKeys.filter((key) => !usedKeys.has(key))
          : []
      const evidenceOk = !evidence || evidence.missing.length === 0
      if (missingRequired.length > 0) {
        hints.push(
          locale === 'fr'
            ? `Endpoints requis manquants: ${missingRequired.join(', ')}.`
            : `缺少必需 API：${missingRequired.join('、')}。`,
        )
      }
      const shouldEnforceMinCalls =
        minApiCalls > usedKeys.size &&
        !(evidenceOk && missingRequired.length === 0 && usedKeys.size >= 1)
      if (shouldEnforceMinCalls) {
        const needed = minApiCalls - usedKeys.size
        hints.push(
          locale === 'fr'
            ? `Appelle encore ${needed} endpoint(s) pertinent(s) et synthétise.`
            : `请补充调用 ${needed} 个相关端点并综合结果。`,
        )
      }
    }
    if (isWorkContentQuestion(lastUserQuestion) && !hasLeaderLogsCall(toolCalls)) {
      const reportStatus = extractReportCallStatus(toolCalls)
      if (reportStatus?.exists === false) {
        const dateHint = reportStatus.date
          ? locale === 'fr'
            ? `Utilise la même date (${reportStatus.date}).`
            : `使用同一日期（${reportStatus.date}）。`
          : ''
        hints.push(
          locale === 'fr'
            ? `Le rapport renvoyé est un brouillon automatique (exists=false). Appelle get:/api/leader-logs pour récupérer les journaux bruts. ${dateHint}`
            : `日报返回exists=false为自动草稿，请改用 get:/api/leader-logs 查询原始日志。${dateHint}`,
        )
      } else if (!reportStatus) {
        hints.push(
          locale === 'fr'
            ? 'Pour les questions sur le contenu des travaux, utilise get:/api/leader-logs pour les journaux bruts.'
            : '工作内容类问题优先使用 get:/api/leader-logs 查询原始日志。',
        )
      }
    }
    if (!hints.length) return ''
    return locale === 'fr'
      ? `La réponse actuelle ne couvre pas la demande. ${hints.join(' ')} Réévalue le plan et continue.`
      : `当前结果未覆盖问题。${hints.join(' ')}请更新计划并继续执行。`
  }

  const maybeEnforceFinanceGuard = () => {
    if (!needsFinanceInsights || financeGuardApplied) return false
    if (hasFinanceInsightsCall(toolCalls)) return false
    financeGuardApplied = true
    const subjectHint = financeSubject
      ? locale === 'fr'
        ? `Pour le terme "${financeSubject}", cherche d'abord la catégorie via get:/api/finance/categories, puis utilise reasonKeyword/remarkKeyword.`
        : `关于“${financeSubject}”可先调用 get:/api/finance/categories 寻找分类，再用 reasonKeyword/remarkKeyword 过滤。`
      : locale === 'fr'
        ? 'Si la question vise une catégorie précise, commence par get:/api/finance/categories, puis filtre via reasonKeyword/remarkKeyword.'
        : '如需按具体材料/项目筛选，先调用 get:/api/finance/categories，再用 reasonKeyword/remarkKeyword 过滤。'
    const monthHintText =
      monthHint.month && !monthHint.year && !hasSystemTimeCall(toolCalls)
        ? locale === 'fr'
          ? 'La question mentionne un mois sans année. Appelle get_system_time pour déduire l’année courante.'
          : '问题包含月份但未给年份，请先调用 get_system_time 推断当前年份。'
        : ''
    const guardMessage =
      locale === 'fr'
        ? `Pour les questions de coûts/finances, appelle obligatoirement get:/api/finance/insights avec dateFrom/dateTo. ${monthHintText} ${subjectHint}`
        : `成本/费用类问题必须调用 get:/api/finance/insights，并提供 dateFrom/dateTo。${monthHintText} ${subjectHint}`
    appendMessage(conversation, { role: 'user', content: guardMessage })
    return true
  }

  type FinalHandling =
    | { type: 'continue' }
    | { type: 'replan'; message: string }
    | { type: 'result'; result: ChatRunResult }

  const handleFinalPayload = async (payload: { answer?: string }): Promise<FinalHandling> => {
    if (maybeEnforceFinanceGuard()) {
      return { type: 'continue' }
    }
    if (needsFinanceInsights && monthHint.month && financeInsightsQueryMissingRange(toolCalls)) {
      appendMessage(conversation, {
        role: 'user',
        content:
          locale === 'fr'
            ? 'La demande mentionne un mois. Appelle get:/api/finance/insights avec dateFrom/dateTo correspondant au mois.'
            : '问题包含月份，请用对应月份的 dateFrom/dateTo 调用 get:/api/finance/insights。',
      })
      return { type: 'continue' }
    }
    const replanMessage = buildReplanMessage()
    const evidence = evidenceFields.length > 0 ? evaluateEvidence(toolCalls, evidenceFields) : null
    if (replanMessage && evidence && evidence.missing.length > 0) {
      const autoCalls = buildAutoDetailCalls({
        toolCalls,
        candidateMeta,
        fallbackDetailKeys: uniqueDetailKeys.length ? uniqueDetailKeys : ['date', 'id'],
        maxCalls: 5,
        cache: autoDetailCache,
      })
      if (autoCalls.length > 0) {
        for (const call of autoCalls) {
          await executeToolCall(call)
        }
        return { type: 'continue' }
      }
    }
    if (replanMessage) {
      return { type: 'replan', message: replanMessage }
    }
    const answer =
      typeof payload.answer === 'string' && payload.answer.trim().length > 0
        ? payload.answer.trim()
        : fallbackAnswer(locale)
    return { type: 'result', result: finalizeAnswer(answer) }
  }

  const maxReplans = 2
  let replanCount = 0

  while (replanCount <= maxReplans) {
    let replanRequested = false
    let replanMessage = ''

    if (!plan) {
      for (let turn = 0; turn < maxTurns; turn += 1) {
        const response = await options.adapter.generate({
          messages: buildModelMessages(),
          responseFormat: 'json_object',
        })
        lastUsage = response.usage
        const payload = parseModelPayload(response.content)
        if (!payload) {
          return finalizeAnswer(response.content.trim())
        }

        if (payload.type === 'final') {
          const outcome = await handleFinalPayload(payload)
          if (outcome.type === 'continue') {
            continue
          }
          if (outcome.type === 'replan') {
            replanRequested = true
            replanMessage = outcome.message
            break
          }
          return outcome.result
        }

        if (payload.type === 'plan' && enablePlanning) {
          const normalizedPlan = normalizePlanPayload(payload)
          if (normalizedPlan) {
            applyPlan(normalizedPlan, true)
            break
          }
          return finalizeAnswer(fallbackAnswer(locale))
        }

        if (payload.type !== 'tool_call') {
          return finalizeAnswer(response.content.trim())
        }

        await executeToolCall(payload)
      }

      if (replanRequested) {
        replanCount += 1
        plan = undefined
        stepSummaries.length = 0
        resetConversationForReplan(replanMessage)
        emitEvent({
          type: 'status',
          message: locale === 'fr' ? 'Réévaluation du plan…' : '正在重新规划…',
        })
        continue
      }
    }

    if (!plan) {
      return finalizeAnswer(fallbackAnswer(locale))
    }

    const steps = plan.steps.slice(0, maxSteps)
    let stepTimeout = false
    let planUpdated = false

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]
      emitEvent({ type: 'step', step, index, total: steps.length })
      appendMessage(conversation, {
        role: 'user',
        content: buildStepInstruction(step, index, steps.length, locale),
      })

      let stepDone = false

      for (let stepTurn = 0; stepTurn < maxStepTurns; stepTurn += 1) {
        const response = await options.adapter.generate({
          messages: buildModelMessages(),
          responseFormat: 'json_object',
        })
        lastUsage = response.usage
        const payload = parseModelPayload(response.content)
        if (!payload) {
          return finalizeAnswer(response.content.trim())
        }

        if (payload.type === 'tool_call') {
          await executeToolCall(payload)
          continue
        }

        if (payload.type === 'step_done') {
          const summary =
            typeof (payload as StepDonePayload).summary === 'string'
              ? (payload as StepDonePayload).summary?.trim()
              : ''
          if (summary) {
            stepSummaries.push(summary)
          }
          emitEvent({ type: 'step_done', summary })
          appendMessage(conversation, { role: 'assistant', content: JSON.stringify(payload) })
          stepDone = true
          break
        }

        if (payload.type === 'final') {
          const outcome = await handleFinalPayload(payload)
          if (outcome.type === 'continue') {
            continue
          }
          if (outcome.type === 'replan') {
            replanRequested = true
            replanMessage = outcome.message
            break
          }
          return outcome.result
        }

        if (payload.type === 'plan' && enablePlanning) {
          const normalizedPlan = normalizePlanPayload(payload)
          if (normalizedPlan) {
            applyPlan(normalizedPlan, true)
            planUpdated = true
          }
          break
        }

        return finalizeAnswer(response.content.trim())
      }

      if (replanRequested || planUpdated) {
        break
      }

      if (!stepDone) {
        stepTimeout = true
        break
      }
    }

    if (replanRequested) {
      replanCount += 1
      plan = undefined
      stepSummaries.length = 0
      resetConversationForReplan(replanMessage)
      emitEvent({
        type: 'status',
        message: locale === 'fr' ? 'Réévaluation du plan…' : '正在重新规划…',
      })
      continue
    }

    if (planUpdated) {
      continue
    }

    const timeoutNote = stepTimeout
      ? locale === 'fr'
        ? "Limite de tours atteinte. Donne la réponse finale avec les informations disponibles."
        : '已达到步骤执行回合上限，请基于现有信息给出最终答复并说明限制。'
      : undefined

    appendMessage(conversation, {
      role: 'user',
      content: buildFinalInstruction(locale, timeoutNote),
    })

    for (let turn = 0; turn < maxTurns; turn += 1) {
      const response = await options.adapter.generate({
        messages: buildModelMessages(),
        responseFormat: 'json_object',
      })
      lastUsage = response.usage
      const payload = parseModelPayload(response.content)
      if (!payload) {
        return finalizeAnswer(response.content.trim())
      }

      if (payload.type === 'final') {
        const outcome = await handleFinalPayload(payload)
        if (outcome.type === 'continue') {
          continue
        }
        if (outcome.type === 'replan') {
          replanRequested = true
          replanMessage = outcome.message
          break
        }
        return outcome.result
      }

      if (payload.type === 'tool_call') {
        await executeToolCall(payload)
        continue
      }

      if (payload.type === 'plan' && enablePlanning) {
        const normalizedPlan = normalizePlanPayload(payload)
        if (normalizedPlan) {
          applyPlan(normalizedPlan, true)
          planUpdated = true
        }
        break
      }

      return finalizeAnswer(response.content.trim())
    }

    if (replanRequested) {
      replanCount += 1
      plan = undefined
      stepSummaries.length = 0
      resetConversationForReplan(replanMessage)
      emitEvent({
        type: 'status',
        message: locale === 'fr' ? 'Réévaluation du plan…' : '正在重新规划…',
      })
      continue
    }

    if (planUpdated) {
      continue
    }
  }

  return finalizeAnswer(fallbackAnswer(locale))
}
