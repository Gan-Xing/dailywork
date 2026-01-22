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

const matchScore = (query: string, candidate?: string, weight = 1) => {
  if (!candidate) return 0
  const normalizedCandidate = normalizeText(candidate)
  if (!normalizedCandidate) return 0
  return query.includes(normalizedCandidate) || normalizedCandidate.includes(query) ? weight : 0
}

const scoreList = (query: string, list: string[] | undefined, weight: number) => {
  if (!list || list.length === 0) return 0
  return list.reduce((total, item) => total + matchScore(query, item, weight), 0)
}

const hasContent = (entry: ApiSemanticEntry) =>
  Boolean(
    entry.summary ||
      entry.intents?.length ||
      entry.examples?.length ||
      entry.inputNotes?.length ||
      entry.outputNotes?.length ||
      entry.returnType ||
      entry.detailEndpointKey ||
      entry.evidenceFields?.length,
  )

const canAccess = (permissions: string[] | undefined, required: string[]) => {
  if (!required.length) return true
  if (!permissions || permissions.length === 0) return false
  return required.some((permission) => permissions.includes(permission))
}

const scoreEntry = (query: string, entry: ApiSemanticEntry) => {
  let score = 0
  score += matchScore(query, entry.summary, 2)
  score += scoreList(query, entry.intents, 4)
  score += scoreList(query, entry.examples, 3)
  score += scoreList(query, entry.inputNotes, 1)
  score += scoreList(query, entry.outputNotes, 1)
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

  Object.values(semanticCatalog.entries).forEach((entry) => {
    if (!entry?.key) return
    if (!hasContent(entry)) return
    const catalogEntry = catalogMap.get(entry.key)
    if (!catalogEntry) return
    if (catalogEntry.mode === 'write') return
    if (!canAccess(permissions, catalogEntry.permissions)) return
    const score = scoreEntry(trimmedQuery, entry)
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
        detailCatalogEntry.mode !== 'write' &&
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
