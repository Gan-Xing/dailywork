import { promises as fs } from 'fs'
import path from 'path'

import type {
  ApiSemanticCatalog,
  ApiSemanticEntry,
  ApiSemanticParamLocation,
  ApiSemanticReturnType,
  SemanticStatus,
} from './semanticTypes'

const SEMANTIC_PATH = path.join(process.cwd(), 'docs', 'api-semantic.json')

const emptyCatalog = (): ApiSemanticCatalog => ({
  updatedAt: new Date(0).toISOString(),
  entries: {},
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const cleanList = (value: unknown, limit = 6) => {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  const unique = Array.from(new Set(cleaned))
  return unique.slice(0, limit)
}

const normalizeStatus = (value: unknown): SemanticStatus => {
  if (value === 'verified') return 'verified'
  return 'draft'
}

const normalizeReturnType = (value: unknown): ApiSemanticReturnType | undefined => {
  const allowed: ApiSemanticReturnType[] = ['list', 'detail', 'summary', 'action', 'export']
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return allowed.includes(normalized as ApiSemanticReturnType)
    ? (normalized as ApiSemanticReturnType)
    : undefined
}

const normalizeParamLocation = (value: unknown): ApiSemanticParamLocation | undefined => {
  if (value === 'path' || value === 'query') return value
  return undefined
}

const normalizeStringField = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export const normalizeSemanticEntry = (
  key: string,
  entry: Partial<ApiSemanticEntry>,
  updatedBy?: string,
): ApiSemanticEntry => {
  const summary = typeof entry.summary === 'string' ? entry.summary.trim() : ''
  return {
    key,
    summary: summary || undefined,
    intents: cleanList(entry.intents, 8),
    examples: cleanList(entry.examples, 6),
    inputNotes: cleanList(entry.inputNotes, 6),
    outputNotes: cleanList(entry.outputNotes, 6),
    returnType: normalizeReturnType(entry.returnType),
    idField: normalizeStringField(entry.idField),
    detailEndpointKey: normalizeStringField(entry.detailEndpointKey),
    detailParam: normalizeStringField(entry.detailParam),
    detailParamLocation: normalizeParamLocation(entry.detailParamLocation),
    evidenceFields: cleanList(entry.evidenceFields, 8),
    detailKeys: cleanList(entry.detailKeys, 6),
    status: normalizeStatus(entry.status),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy?.trim() || entry.updatedBy,
  }
}

export const readSemanticCatalog = async (): Promise<ApiSemanticCatalog> => {
  try {
    const raw = await fs.readFile(SEMANTIC_PATH, 'utf8')
    const parsed = JSON.parse(raw) as ApiSemanticCatalog
    if (!parsed || !isRecord(parsed.entries)) return emptyCatalog()
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      entries: parsed.entries,
    }
  } catch {
    return emptyCatalog()
  }
}

const ensureSemanticDir = async () => {
  const dir = path.dirname(SEMANTIC_PATH)
  await fs.mkdir(dir, { recursive: true })
}

const writeSemanticCatalog = async (catalog: ApiSemanticCatalog) => {
  await ensureSemanticDir()
  await fs.writeFile(SEMANTIC_PATH, JSON.stringify(catalog, null, 2), 'utf8')
}

export const upsertSemanticEntry = async (
  key: string,
  patch: Partial<ApiSemanticEntry>,
  updatedBy?: string,
) => {
  const catalog = await readSemanticCatalog()
  const existing = catalog.entries[key] ?? { key }
  const merged = normalizeSemanticEntry(key, { ...existing, ...patch }, updatedBy)
  catalog.entries[key] = merged
  catalog.updatedAt = merged.updatedAt ?? new Date().toISOString()
  await writeSemanticCatalog(catalog)
  return merged
}
