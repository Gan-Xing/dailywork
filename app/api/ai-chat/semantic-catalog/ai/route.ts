import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

import { dailyworkApiCatalog } from '@/lib/ai-chat/adapters/dailywork/apiCatalog'
import { getDailyworkChatAdapter } from '@/lib/ai-chat/adapters/dailywork'
import { normalizeSemanticEntry } from '@/lib/ai-chat/semanticStore'
import type { ApiSemanticEntry } from '@/lib/ai-chat/semanticTypes'
import { extractJsonObject, safeJsonParse } from '@/lib/ai-chat/utils'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export const dynamic = 'force-dynamic'

type AiRequestBody = {
  key?: string
  locale?: string
}

const MAX_SOURCE_CHARS = 6000

const buildPrompt = (input: {
  key: string
  method: string
  path: string
  description: string
  permissions: string[]
  queryParams: unknown
  bodyFields: unknown
  responseSchema: unknown
  sourcePath: string
  sourceSnippet: string
  locale: string
}) => {
  const locale = input.locale === 'fr' ? 'fr' : 'zh'
  const instructions =
    locale === 'fr'
      ? [
          'Génère une fiche sémantique courte pour un endpoint API.',
          'Réponds uniquement en JSON.',
          'Les champs doivent être utiles pour un assistant IA, pas une doc technique complète.',
          'Limite les exemples et intentions (pas plus de 6 éléments par liste).',
          'Si un champ est inconnu, laisse-le vide.',
          'Indique returnType (list/detail/summary/action/export) si possible.',
          'Indique detailEndpointKey/detailParam/detailParamLocation si l’endpoint est une liste.',
          'Indique evidenceFields et detailKeys si utiles pour vérifier des réponses.',
        ]
      : [
          '为一个 API 端点生成简短语义维护信息。',
          '只输出 JSON。',
          '字段用于帮助 AI 选择接口，不是完整文档。',
          '每个列表最多 6 条。',
          '不确定的字段可以留空。',
          '尽量填写 returnType（list/detail/summary/action/export）。',
          '若是列表接口，填写 detailEndpointKey/detailParam/detailParamLocation。',
          '补充 evidenceFields 与 detailKeys 以便验证答案。',
        ]
  const schema =
    locale === 'fr'
      ? `Sortie JSON: {"summary":"...","intents":["..."],"examples":["..."],"inputNotes":["..."],"outputNotes":["..."],"returnType":"list","detailEndpointKey":"...","detailParam":"...","detailParamLocation":"query","evidenceFields":["..."],"detailKeys":["..."],"status":"draft"}`
      : `输出 JSON: {"summary":"...","intents":["..."],"examples":["..."],"inputNotes":["..."],"outputNotes":["..."],"returnType":"list","detailEndpointKey":"...","detailParam":"...","detailParamLocation":"query","evidenceFields":["..."],"detailKeys":["..."],"status":"draft"}`
  return [
    instructions.join('\n'),
    schema,
    '',
    `key: ${input.key}`,
    `method: ${input.method}`,
    `path: ${input.path}`,
    `description: ${input.description}`,
    `permissions: ${input.permissions.join(', ') || 'none'}`,
    `queryParams: ${JSON.stringify(input.queryParams)}`,
    `bodyFields: ${JSON.stringify(input.bodyFields)}`,
    `responseSchema: ${JSON.stringify(input.responseSchema)}`,
    `source: ${input.sourcePath}`,
    `sourceSnippet:\n${input.sourceSnippet}`,
  ].join('\n')
}

export async function POST(request: Request) {
  if (!(await hasPermission('permission:update'))) {
    return NextResponse.json({ message: '缺少 permission:update 权限' }, { status: 403 })
  }

  let payload: AiRequestBody
  try {
    payload = (await request.json()) as AiRequestBody
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const key = typeof payload.key === 'string' ? payload.key.trim() : ''
  if (!key) {
    return NextResponse.json({ message: 'Missing key' }, { status: 400 })
  }

  const entry = dailyworkApiCatalog.find((item) => item.key === key)
  if (!entry) {
    return NextResponse.json({ message: 'API entry not found' }, { status: 404 })
  }

  const sourcePath = path.join(process.cwd(), entry.source)
  let sourceSnippet = ''
  try {
    const raw = await fs.readFile(sourcePath, 'utf8')
    sourceSnippet = raw.slice(0, MAX_SOURCE_CHARS)
  } catch {
    sourceSnippet = ''
  }

  const locale = payload.locale === 'fr' ? 'fr' : 'zh'
  const prompt = buildPrompt({
    key: entry.key,
    method: entry.method,
    path: entry.path,
    description: entry.description,
    permissions: entry.permissions,
    queryParams: entry.queryParams,
    bodyFields: entry.bodyFields,
    responseSchema: entry.responseSchema,
    sourcePath: entry.source,
    sourceSnippet,
    locale,
  })

  const adapter = getDailyworkChatAdapter()
  const response = await adapter.generate({
    messages: [
      { role: 'system', content: locale === 'fr' ? 'Tu es un assistant de documentation API.' : '你是 API 语义助手。' },
      { role: 'user', content: prompt },
    ],
    responseFormat: 'json_object',
  })

  const raw = extractJsonObject(response.content) ?? response.content
  const parsed = safeJsonParse<Partial<ApiSemanticEntry>>(raw)
  if (!parsed) {
    return NextResponse.json({ message: 'Failed to parse AI response' }, { status: 502 })
  }

  const sessionUser = await getSessionUser()
  const normalized = normalizeSemanticEntry(key, parsed, sessionUser?.username)
  return NextResponse.json({ suggestion: normalized })
}
