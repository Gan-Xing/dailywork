import { clampMessageLength, normalizeWhitespace } from '@/lib/ai-chat/utils'
import { readSemanticCatalog } from '@/lib/ai-chat/semanticStore'
import type {
  ApiSemanticEntry,
  ApiSemanticParamLocation,
  ApiSemanticReturnType,
} from '@/lib/ai-chat/semanticTypes'

import { dailyworkApiCatalog } from './apiCatalog'

type SemanticContextOptions = {
  query: string
  locale: string
  permissions?: string[]
  maxEntries?: number
}

type ScoredEntry = {
  entry: ApiSemanticEntry
  method: string
  path: string
  score: number
}

export type SemanticCandidate = {
  key: string
  score: number
  returnType?: ApiSemanticReturnType
  idField?: string
  detailEndpointKey?: string
  detailParam?: string
  detailParamLocation?: ApiSemanticParamLocation
  evidenceFields?: string[]
  detailKeys?: string[]
}

export type SemanticContext = {
  message: string | null
  candidates: SemanticCandidate[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeText = (value: string) => value.trim().toLowerCase()

const searchTokens = (value: string) => {
  const tokens = new Set<string>()
  const normalized = value.toLowerCase().replace(/查询|查看|获取|请问|本月|最近/g, ' ')
  for (const part of normalized.match(/[\u3400-\u9fff]+|[a-z0-9]+/g) ?? []) {
    if (/^[\u3400-\u9fff]+$/.test(part)) {
      if (part.length === 1) continue
      for (let index = 0; index < part.length - 1; index += 1) {
        tokens.add(part.slice(index, index + 2))
      }
    } else if (part.length >= 3) {
      tokens.add(part)
    }
  }
  return tokens
}

const matchScore = (query: string, candidate?: string, weight = 1) => {
  if (!candidate) return 0
  const normalizedCandidate = normalizeText(candidate)
  if (!normalizedCandidate) return 0
  if (query.includes(normalizedCandidate) || normalizedCandidate.includes(query)) return weight
  const questionTokens = searchTokens(query)
  const candidateTokens = searchTokens(normalizedCandidate)
  if (!questionTokens.size || !candidateTokens.size) return 0
  const overlap = Array.from(questionTokens).filter((token) => candidateTokens.has(token)).length
  return overlap ? (overlap / questionTokens.size) * weight : 0
}

const routeTerms: Record<string, string> = {
  finance: '财务 费用 成本 收支 finance dépense',
  ledger: '台账 记账 财务账目 ledger comptabilité',
  payroll: '工资 薪酬 发薪 payroll salaire',
  compensation: '工资 薪酬 劳务报酬 compensation salaire',
  members: '人员 员工 成员 工人 members employés',
  reports: '日报 报告 施工记录 reports rapport',
  'leader-logs': '领导日志 工作日志 现场工作 journal chantier',
  value: '产值 工程量 计量 清单 value métrés',
  'weekly-plans': '周计划 周交付 计划 weekly plan',
  inspections: '检查 巡检 验收 inspections contrôle',
  roads: '道路 路段 桩号 roads routes',
  resources: '资源 设备 材料 resources matériel',
  machines: '机械 设备 machines engins',
  documents: '文件 文档 资料 documents',
  progress: '进度 施工进展 progress avancement',
  insights: '统计 分析 汇总 insights résumé',
  summary: '统计 汇总 摘要 summary résumé',
  boq: '工程量清单 清单 BOQ bordereau',
}

const buildRouteSearchText = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .flatMap((segment) => [segment.replace(/[-_]/g, ' '), routeTerms[segment] ?? ''])
    .filter(Boolean)
    .join(' ')

const scoreRouteHints = (query: string, path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => {
      const hints = routeTerms[segment]?.split(' ') ?? []
      const matches = hints.filter((hint) => hint.length >= 2 && query.includes(hint.toLowerCase()))
      return score + Math.min(matches.length, 2) * 4
    }, 0)

const scoreList = (query: string, list: string[] | undefined, weight: number) => {
  if (!list || list.length === 0) return 0
  return list.reduce((total, item) => total + matchScore(query, item, weight), 0)
}

const canAccess = (permissions: string[] | undefined, required: string[]) => {
  if (!required.length) return true
  if (!permissions || permissions.length === 0) return false
  return required.some((permission) => permissions.includes(permission))
}

const scoreEntry = (query: string, entry: ApiSemanticEntry, path: string) => {
  let score = 0
  score += scoreRouteHints(query, path)
  score += matchScore(query, entry.summary, 2)
  score += scoreList(query, entry.intents, 4)
  score += scoreList(query, entry.examples, 3)
  score += matchScore(query, buildRouteSearchText(path), 2)
  if (score <= 0) return 0
  if (entry.status === 'verified') score += 1
  return score
}

const formatList = (label: string, list?: string[]) => {
  if (!list || list.length === 0) return ''
  return `${label}: ${list.slice(0, 6).join(' / ')}`
}

export const buildSemanticContext = async ({
  query,
  locale,
  permissions,
  maxEntries = 6,
}: SemanticContextOptions): Promise<SemanticContext> => {
  const trimmedQuery = normalizeText(query)
  if (!trimmedQuery) return { message: null, candidates: [] }

  const semanticCatalog = await readSemanticCatalog()
  if (!isRecord(semanticCatalog.entries)) {
    return { message: null, candidates: [] }
  }

  const catalogMap = new Map(dailyworkApiCatalog.map((entry) => [entry.key, entry]))
  const scored: ScoredEntry[] = []

  dailyworkApiCatalog.forEach((catalogEntry) => {
    if (catalogEntry.method !== 'GET' || catalogEntry.mode !== 'read') return
    if (!canAccess(permissions, catalogEntry.permissions)) return
    const entry = semanticCatalog.entries[catalogEntry.key] ?? {
      key: catalogEntry.key,
      summary: buildRouteSearchText(catalogEntry.path),
      status: 'draft',
    }
    const score = scoreEntry(trimmedQuery, entry, catalogEntry.path)
    if (score <= 0) return
    scored.push({ entry, method: catalogEntry.method, path: catalogEntry.path, score })
  })

  if (scored.length === 0) return { message: null, candidates: [] }

  scored.sort((a, b) => b.score - a.score)
  const topEntries = scored.slice(0, maxEntries)
  const candidateMap = new Map<string, SemanticCandidate>()
  const addCandidate = (entry: ApiSemanticEntry, score: number) => {
    if (!entry.key) return
    const existing = candidateMap.get(entry.key)
    const candidate: SemanticCandidate = {
      key: entry.key,
      score: existing ? Math.max(existing.score, score) : score,
      returnType: entry.returnType,
      idField: entry.idField,
      detailEndpointKey: entry.detailEndpointKey,
      detailParam: entry.detailParam,
      detailParamLocation: entry.detailParamLocation,
      evidenceFields: entry.evidenceFields,
      detailKeys: entry.detailKeys,
    }
    candidateMap.set(entry.key, candidate)
  }

  topEntries.forEach(({ entry, score }) => {
    addCandidate(entry, score)
    if (entry.detailEndpointKey) {
      const detailCatalogEntry = catalogMap.get(entry.detailEndpointKey)
      if (
        detailCatalogEntry &&
        detailCatalogEntry.mode === 'read' &&
        canAccess(permissions, detailCatalogEntry.permissions)
      ) {
        const detailEntry = semanticCatalog.entries[entry.detailEndpointKey]
        if (detailEntry) {
          addCandidate(detailEntry, Math.max(score - 1, 1))
        } else {
          addCandidate(
            {
              key: entry.detailEndpointKey,
              returnType: 'detail',
            },
            Math.max(score - 1, 1),
          )
        }
      }
    }
  })
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score)

  const header =
    locale === 'fr'
      ? 'Guide sémantique API (priorisez ces endpoints, utilisez call_api avec key):'
      : 'API 语义指引（优先使用这些端点，通过 call_api 使用 key）：'

  const lines = topEntries.map(({ entry, method, path }) => {
    const summary = entry.summary ? `summary: ${clampMessageLength(entry.summary, 120)}` : ''
    const intents = formatList('intents', entry.intents)
    const examples = formatList('examples', entry.examples)
    const inputNotes = formatList('inputNotes', entry.inputNotes)
    const outputNotes = formatList('outputNotes', entry.outputNotes)
    const returnType = entry.returnType ? `returns: ${entry.returnType}` : ''
    const idField = entry.idField ? `idField: ${entry.idField}` : ''
    const detailEndpoint = entry.detailEndpointKey ? `detail: ${entry.detailEndpointKey}` : ''
    const detailParam = entry.detailParam
      ? `detailParam: ${entry.detailParam} (${entry.detailParamLocation ?? 'query'})`
      : ''
    const evidenceFields = entry.evidenceFields?.length
      ? `evidence: ${entry.evidenceFields.slice(0, 4).join(' / ')}`
      : ''
    const detailKeys = entry.detailKeys?.length
      ? `detailKeys: ${entry.detailKeys.slice(0, 4).join(' / ')}`
      : ''
    const status = entry.status ?? 'draft'
    const parts = [
      summary,
      intents,
      examples,
      inputNotes,
      outputNotes,
      returnType,
      idField,
      detailEndpoint,
      detailParam,
      evidenceFields,
      detailKeys,
    ]
      .filter(Boolean)
      .join(' | ')
    return `- ${entry.key} (${method} ${path}) [${status}] ${parts}`.trim()
  })

  return {
    message: normalizeWhitespace([header, ...lines].join('\n')),
    candidates,
  }
}

export const buildSemanticContextMessage = async (
  options: SemanticContextOptions,
): Promise<string | null> => {
  const result = await buildSemanticContext(options)
  return result.message
}
