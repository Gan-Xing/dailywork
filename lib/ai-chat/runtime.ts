import { buildSystemPrompt } from './prompt'
import { extractJsonObject, normalizeWhitespace, safeJsonParse } from './utils'
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
  PermissionChecker,
  PlanPayload,
  PlanStep,
  StepDonePayload,
  ToolCallPayload,
} from './types'

const DEFAULT_MAX_TURNS = 4
const DEFAULT_MAX_STEPS = 6
const DEFAULT_MAX_STEP_TURNS = 4

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
  return `TOOL_RESULT ${tool.name}: ${JSON.stringify(result)}`
}

const buildToolContext = (options: ChatRunOptions): ChatToolContext => ({
  session: options.session,
  locale: options.locale ?? 'zh',
  request: options.request,
  permissionChecker: options.permissionChecker,
})

const appendMessage = (messages: ChatMessage[], message: ChatMessage) => {
  messages.push(message)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeToolCallArguments = (payload: ToolCallPayload) =>
  typeof payload.arguments === 'object' && payload.arguments !== null
    ? (payload.arguments as Record<string, unknown>)
    : {}

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

const hasFinanceInsightsCall = (toolCalls: ChatToolCallRecord[]) =>
  toolCalls.some((call) => {
    if (call.tool !== 'call_api') return false
    const key = typeof call.arguments?.key === 'string' ? call.arguments.key : ''
    return key === 'get:/api/finance/insights'
  })

const hasSystemTimeCall = (toolCalls: ChatToolCallRecord[]) =>
  toolCalls.some((call) => call.tool === 'get_system_time' && call.result?.ok)

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
      if (tools.length) {
        return { id, title, tools }
      }
      return { id, title }
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

  if (locale === 'fr') {
    return normalizeWhitespace(
      `Exécute l'étape ${index + 1}/${total}: ${step.title}. ${toolHint} ` +
        'Si un outil est nécessaire, réponds avec tool_call. Quand l\'étape est terminée, réponds avec step_done.',
    )
  }

  return normalizeWhitespace(
    `执行第 ${index + 1}/${total} 步：${step.title}。${toolHint} ` +
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
  const allowedTools = await resolveAllowedTools(
    options.tools,
    sessionPermissions,
    options.permissionChecker,
  )
  const toolMap = new Map(allowedTools.map((tool) => [tool.name, tool]))
  const systemPrompt = buildSystemPrompt({ tools: allowedTools, locale, enablePlanning })
  const conversation: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...options.messages]
  const toolCalls: ChatToolCallRecord[] = []
  const stepSummaries: string[] = []
  let plan: PlanPayload | undefined
  let lastUsage: ChatRunResult['usage']
  let financeGuardApplied = false

  const emitEvent = (event: ChatStreamEvent) => {
    if (!options.onEvent) return
    try {
      options.onEvent(event)
    } catch {
      // ignore stream failures
    }
  }

  const finalizeAnswer = (answer: string): ChatRunResult => {
    const result: ChatRunResult = {
      answer,
      toolCalls,
      plan,
      stepSummaries,
      usage: lastUsage,
    }
    emitEvent({
      type: 'final',
      answer,
      plan,
      stepSummaries,
      toolCalls,
    })
    return result
  }

  const executeToolCall = async (payload: ToolCallPayload) => {
    const tool = toolMap.get(payload.tool)
    const args = normalizeToolCallArguments(payload)
    emitEvent({ type: 'tool_call', tool: payload.tool, arguments: args })
    appendMessage(conversation, { role: 'assistant', content: JSON.stringify(payload) })

    if (!tool) {
      const result: ChatToolResult = {
        ok: false,
        content: 'Tool not available for this user.',
        error: 'tool_not_allowed',
      }
      toolCalls.push({ tool: payload.tool, arguments: args, result })
      emitEvent({ type: 'tool_result', tool: payload.tool, result })
      appendMessage(conversation, {
        role: 'user',
        content: `TOOL_RESULT ${payload.tool}: ${JSON.stringify(result)}`,
      })
      return
    }

    let result: ChatToolResult
    try {
      result = await tool.handler(args, buildToolContext(options))
    } catch (error) {
      result = {
        ok: false,
        content: 'Tool execution failed.',
        error: error instanceof Error ? error.message : String(error),
      }
    }
    toolCalls.push({ tool: tool.name, arguments: args, result })
    emitEvent({ type: 'tool_result', tool: tool.name, result })
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

  const handleFinalPayload = (payload: { answer?: string }): FinalHandling => {
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
          messages: conversation,
          responseFormat: 'json_object',
        })
        lastUsage = response.usage
        const payload = parseModelPayload(response.content)
        if (!payload) {
          return finalizeAnswer(response.content.trim())
        }

        if (payload.type === 'final') {
          const outcome = handleFinalPayload(payload)
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
        appendMessage(conversation, { role: 'user', content: replanMessage })
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
          messages: conversation,
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
          const outcome = handleFinalPayload(payload)
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
      appendMessage(conversation, { role: 'user', content: replanMessage })
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
        messages: conversation,
        responseFormat: 'json_object',
      })
      lastUsage = response.usage
      const payload = parseModelPayload(response.content)
      if (!payload) {
        return finalizeAnswer(response.content.trim())
      }

      if (payload.type === 'final') {
        const outcome = handleFinalPayload(payload)
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
      appendMessage(conversation, { role: 'user', content: replanMessage })
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
