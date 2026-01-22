import { buildPlannerPrompt } from './prompt'
import { extractJsonObject, safeJsonParse } from './utils'
import type { ChatLocale, ModelAdapter, PlannerPayload } from './types'

type PlannerOptions = {
  adapter: ModelAdapter
  locale: ChatLocale
  question: string
  candidates: string[]
  contextMessage?: string
  maxSteps?: number
}

const normalizeList = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

const normalizeSteps = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null
      const record = step as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title.trim() : ''
      if (!title) return null
      const id =
        typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id.trim()
          : `step-${index + 1}`
      const apis = normalizeList(record.apis)
      return apis.length ? { id, title, apis } : { id, title }
    })
    .filter((step): step is NonNullable<typeof step> => Boolean(step))
}

const normalizePlannerPayload = (
  payload: PlannerPayload | null,
  fallback: PlannerPayload,
): PlannerPayload => {
  if (!payload || payload.type !== 'plan') return fallback
  const goal = typeof payload.goal === 'string' ? payload.goal.trim() : ''
  const steps = normalizeSteps(payload.steps)
  if (!goal || steps.length === 0) return fallback
  return {
    ...payload,
    goal,
    steps,
    dataRequirements: normalizeList(payload.dataRequirements),
    candidateApis: normalizeList(payload.candidateApis),
    requiredApis: normalizeList(payload.requiredApis),
    evidenceFields: normalizeList(payload.evidenceFields),
    detailKeys: normalizeList(payload.detailKeys),
    minApiCalls: Number.isFinite(payload.minApiCalls) ? Math.max(1, Number(payload.minApiCalls)) : undefined,
  }
}

const buildFallbackPlan = (question: string, candidates: string[]): PlannerPayload => {
  const trimmedQuestion = question.trim()
  const primaryCandidates = candidates.slice(0, 4)
  const minApiCalls = primaryCandidates.length >= 2 ? 2 : primaryCandidates.length || 1
  const steps = [
    {
      id: 'step-1',
      title: '调用候选API获取数据',
      apis: primaryCandidates,
    },
    {
      id: 'step-2',
      title: '汇总结果并回答问题',
    },
  ]
  return {
    type: 'plan',
    goal: trimmedQuestion || '获取所需数据并回答问题',
    dataRequirements: trimmedQuestion ? [trimmedQuestion] : [],
    candidateApis: primaryCandidates,
    requiredApis: primaryCandidates.slice(0, minApiCalls),
    minApiCalls,
    steps,
  }
}

export const runPlanner = async (options: PlannerOptions): Promise<PlannerPayload> => {
  const question = options.question.trim()
  const candidateKeys = options.candidates
  const fallbackPlan = buildFallbackPlan(question, candidateKeys)
  if (!question) return fallbackPlan

  const plannerPrompt = buildPlannerPrompt({
    locale: options.locale,
    candidates: candidateKeys,
    maxSteps: options.maxSteps ?? 4,
  })

  const messages = [
    { role: 'system' as const, content: plannerPrompt },
    ...(options.contextMessage
      ? [{ role: 'system' as const, content: options.contextMessage }]
      : []),
    { role: 'user' as const, content: question },
  ]

  try {
    const response = await options.adapter.generate({
      messages,
      responseFormat: 'json_object',
    })
    const raw = extractJsonObject(response.content)
    const parsed = raw ? safeJsonParse<PlannerPayload>(raw) : null
    return normalizePlannerPayload(parsed, fallbackPlan)
  } catch {
    return fallbackPlan
  }
}
