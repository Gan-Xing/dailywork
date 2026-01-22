import { promises as fs } from 'fs'
import path from 'path'

import type { ApiCatalogEntry } from '@/lib/ai-chat/adapters/dailywork/apiCatalog'
import { dailyworkApiCatalog } from '@/lib/ai-chat/adapters/dailywork/apiCatalog'
import type {
  ApiSemanticCatalog,
  ApiSemanticEntry,
  ApiSemanticReturnType,
} from '@/lib/ai-chat/semanticTypes'

type Args = {
  limit?: number
  offset?: number
  dryRun?: boolean
}

const SEMANTIC_PATH = path.join(process.cwd(), 'docs', 'api-semantic.json')

const parseArgs = (): Args => {
  const args: Args = {}
  process.argv.slice(2).forEach((arg) => {
    if (arg === '--dry-run') args.dryRun = true
    if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1])
    if (arg.startsWith('--offset=')) args.offset = Number(arg.split('=')[1])
  })
  return args
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const normalizeList = (value: string[] | undefined) =>
  (value ?? []).map((item) => item.trim()).filter(Boolean)

const detectReturnType = (entry: ApiCatalogEntry): ApiSemanticReturnType => {
  const pathLower = entry.path.toLowerCase()
  const method = entry.method.toUpperCase()
  if (pathLower.includes('/export') || pathLower.includes('/pdf') || pathLower.includes('/download')) {
    return 'export'
  }
  if (pathLower.includes('template-preview')) return 'export'
  if (method === 'GET') {
    if (
      pathLower.includes('/summary') ||
      pathLower.includes('/insights') ||
      pathLower.includes('/stats') ||
      pathLower.includes('/overview')
    ) {
      return 'summary'
    }
    if (/\/:[^/]+/.test(entry.path)) return 'detail'
    return 'list'
  }
  return 'action'
}

const extractPathParam = (pathValue: string) => {
  const match = pathValue.match(/:([a-zA-Z0-9_]+)/)
  return match ? match[1] : ''
}

const buildDetailMap = (catalog: ApiCatalogEntry[]) => {
  const map = new Map<string, ApiCatalogEntry[]>()
  catalog.forEach((entry) => {
    if (entry.method !== 'GET') return
    if (!/\/:[^/]+/.test(entry.path)) return
    const basePath = entry.path.replace(/\/:[^/]+.*$/, '')
    const list = map.get(basePath) ?? []
    list.push(entry)
    map.set(basePath, list)
  })
  return map
}

const pickDetailEndpoint = (
  entry: ApiCatalogEntry,
  detailMap: Map<string, ApiCatalogEntry[]>,
) => {
  const basePath = entry.path.replace(/\/$/, '')
  const candidates = detailMap.get(basePath) ?? []
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const priority = ['id', 'date', 'slug', 'code', 'number']
  for (const key of priority) {
    const found = candidates.find((item) => extractPathParam(item.path) === key)
    if (found) return found
  }
  return candidates[0]
}

const detectEvidenceFields = (entry: ApiCatalogEntry, returnType: ApiSemanticReturnType) => {
  const fields = entry.responseSchema?.fields?.map((field) => field.name) ?? []
  if (!fields.length) return []
  const candidates = fields.filter((field) => field && typeof field === 'string')
  const lower = candidates.map((field) => field.toLowerCase())
  const pick = (keyword: string) => {
    const idx = lower.findIndex((item) => item.includes(keyword))
    return idx >= 0 ? candidates[idx] : ''
  }
  if (returnType === 'summary') {
    const summaryFields = ['total', 'amount', 'count', 'summary', 'insight']
    const picked = summaryFields.map((key) => pick(key)).filter(Boolean)
    return Array.from(new Set(picked)).slice(0, 3)
  }
  if (returnType === 'list') {
    const pluralHints = ['items', 'logs', 'reports', 'entries', 'projects', 'sections', 'members', 'categories', 'units', 'dates']
    const match = pluralHints.map((key) => pick(key)).find(Boolean)
    return match ? [match] : candidates.slice(0, 1)
  }
  if (returnType === 'detail') {
    const detailHints = ['detail', 'item', 'record', 'entry', 'report']
    const match = detailHints.map((key) => pick(key)).filter(Boolean)
    return match.length ? match.slice(0, 2) : candidates.slice(0, 2)
  }
  return candidates.slice(0, 1)
}

const detectDetailKeys = (entry: ApiCatalogEntry, idField?: string, detailParam?: string) => {
  const keys = [idField, detailParam].filter(Boolean) as string[]
  const queryNames = entry.queryParams?.map((param) => param.name) ?? []
  if (queryNames.includes('date')) keys.push('date')
  if (!keys.length) keys.push('id')
  return Array.from(new Set(keys))
}

const detectQueryParam = (entry: ApiCatalogEntry) => {
  const queryNames = entry.queryParams?.map((param) => param.name) ?? []
  if (queryNames.includes('id')) return 'id'
  if (queryNames.includes('date')) return 'date'
  return queryNames[0] ?? ''
}

const updateEntry = (
  entry: ApiCatalogEntry,
  existing: ApiSemanticEntry | undefined,
  detailMap: Map<string, ApiCatalogEntry[]>,
  now: string,
) => {
  const updated: ApiSemanticEntry = { ...(existing ?? { key: entry.key }) }
  let changed = false

  if (!updated.returnType) {
    updated.returnType = detectReturnType(entry)
    changed = true
  }

  if (!updated.idField) {
    const idField = extractPathParam(entry.path)
    if (idField) {
      updated.idField = idField
      changed = true
    }
  }

  if (!updated.detailEndpointKey && updated.returnType === 'list') {
    const detailEntry = pickDetailEndpoint(entry, detailMap)
    if (detailEntry) {
      updated.detailEndpointKey = detailEntry.key
      const param = extractPathParam(detailEntry.path)
      if (!updated.detailParam && param) updated.detailParam = param
      if (!updated.detailParamLocation && param) updated.detailParamLocation = 'path'
      if (!updated.idField && param) updated.idField = param
      changed = true
    } else {
      const queryParam = detectQueryParam(entry)
      if (queryParam) {
        updated.detailEndpointKey = entry.key
        updated.detailParam = queryParam
        updated.detailParamLocation = 'query'
        if (!updated.idField) updated.idField = queryParam
        changed = true
      }
    }
  }

  if (!updated.detailParam && updated.detailEndpointKey) {
    const param = extractPathParam(entry.path) || updated.idField || detectQueryParam(entry)
    if (param) {
      updated.detailParam = param
      if (!updated.detailParamLocation) {
        updated.detailParamLocation = /\/:[^/]+/.test(entry.path) ? 'path' : 'query'
      }
      changed = true
    }
  }

  if (!updated.detailParamLocation && updated.detailParam) {
    updated.detailParamLocation = /\/:[^/]+/.test(entry.path) ? 'path' : 'query'
    changed = true
  }

  if (!updated.evidenceFields || updated.evidenceFields.length === 0) {
    const evidence = detectEvidenceFields(entry, updated.returnType ?? 'list')
    if (evidence.length) {
      updated.evidenceFields = evidence
      changed = true
    }
  }

  if (!updated.detailKeys || updated.detailKeys.length === 0) {
    const keys = detectDetailKeys(entry, updated.idField, updated.detailParam)
    if (keys.length) {
      updated.detailKeys = keys
      changed = true
    }
  }

  if (changed) {
    updated.updatedAt = now
    updated.updatedBy = 'AutoFill'
  }

  return { entry: updated, changed }
}

const main = async () => {
  const args = parseArgs()
  const raw = await fs.readFile(SEMANTIC_PATH, 'utf8')
  const semantic = JSON.parse(raw) as ApiSemanticCatalog
  const entries = semantic.entries ?? {}
  const detailMap = buildDetailMap(dailyworkApiCatalog)
  const now = new Date().toISOString()

  const catalog = dailyworkApiCatalog.slice().sort((a, b) => a.key.localeCompare(b.key))
  const offset = isFiniteNumber(args.offset) ? Math.max(args.offset, 0) : 0
  const limit = isFiniteNumber(args.limit) ? Math.max(args.limit, 0) : catalog.length

  let updatedCount = 0

  catalog.slice(offset, offset + limit).forEach((catalogEntry) => {
    const existing = entries[catalogEntry.key]
    const { entry, changed } = updateEntry(catalogEntry, existing, detailMap, now)
    entries[catalogEntry.key] = entry
    if (changed) updatedCount += 1
  })

  if (updatedCount > 0) {
    semantic.entries = entries
    semantic.updatedAt = now
  }

  if (!args.dryRun) {
    await fs.writeFile(SEMANTIC_PATH, JSON.stringify(semantic, null, 2), 'utf8')
  }

  const result = {
    updated: updatedCount,
    total: catalog.length,
    offset,
    limit,
    dryRun: Boolean(args.dryRun),
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})
