import type { ChatLocale, ChatTool } from './types'

const localeInstruction = (locale: ChatLocale) => {
  if (locale === 'fr') return 'Respond in French.'
  return 'Respond in Chinese.'
}

const formatToolList = (tools: ChatTool[]) => {
  if (!tools.length) {
    return 'No tools are available for this user.'
  }
  return tools
    .map((tool) => {
      const schema = JSON.stringify(tool.schema)
      return `- ${tool.name}: ${tool.description}\n  schema: ${schema}`
    })
    .join('\n')
}

export const buildSystemPrompt = ({
  tools,
  locale,
  enablePlanning = false,
}: {
  tools: ChatTool[]
  locale: ChatLocale
  enablePlanning?: boolean
}) => {
  const planningProtocol = enablePlanning
    ? [
        '',
        'Planning protocol (use only when the task needs multiple steps or more than one tool call):',
        '1) Respond with a plan JSON first.',
        '2) The plan must be concise and avoid chain-of-thought.',
        '3) After receiving a step instruction, use tools as needed and then return step_done.',
        '',
        'Plan format:',
        '{"type":"plan","goal":"...","steps":[{"id":"step-1","title":"...","tools":["tool_name"]}]}',
        '',
        'Step done format:',
        '{"type":"step_done","summary":"..."}',
      ]
    : []

  return [
    'You are an AI assistant for a project management system.',
    'Your job is to answer questions by using available tools when needed.',
    'You may receive an extra system message with API semantic guidance; treat it as the primary source for choosing endpoints.',
    'Prefer call_api with a catalog key over custom list_* tools when an API endpoint exists for the request.',
    'Only use list_api_catalog when no relevant semantic guidance is available.',
    localeInstruction(locale),
    'Do not expose chain-of-thought. Provide concise answers with clear results.',
    'If data is unavailable or permissions are insufficient, explain the limitation and suggest next steps.',
    'Before finalizing, verify the answer fully addresses the question. If not, return an updated plan and continue.',
    'Finance/cost questions: always call the finance insights API (key: get:/api/finance/insights) before answering. If date range is missing, ask for it or call get_system_time to build the current month range.',
    'Summary/comparison/detail questions should combine multiple relevant APIs when needed; if one API already provides sufficient evidence, answer directly.',
    'Work content questions: prefer leader logs (key: get:/api/leader-logs). Daily report drafts may return exists=false and should not be treated as actual work content.',
    'If evidence fields are missing in tool results, continue calling detail endpoints using available identifiers.',
    'When a list endpoint provides identifiers, follow its detail endpoint to retrieve evidence fields.',
    '',
    'Response protocol:',
    '1) Always respond with a JSON object only.',
    '2) The JSON must match one of the formats below.',
    '3) Do not include Markdown, code fences, or additional text.',
    '',
    'Tool call format:',
    '{"type":"tool_call","tool":"tool_name","arguments":{...},"reason":"why"}',
    '',
    'Final answer format:',
    '{"type":"final","answer":"...","followUp":["..."]}',
    ...planningProtocol,
    '',
    'Available tools:',
    formatToolList(tools),
  ].join('\n')
}

export const buildPlannerPrompt = ({
  locale,
  candidates,
  maxSteps = 4,
}: {
  locale: ChatLocale
  candidates: string[]
  maxSteps?: number
}) => {
  const candidateLine = candidates.length
    ? locale === 'fr'
      ? `Endpoints suggérés (utilise ces clés si pertinentes): ${candidates.join(', ')}.`
      : `候选 API（优先从这些 key 选择）：${candidates.join('、')}。`
    : locale === 'fr'
      ? 'Aucune suggestion d’endpoint fournie.'
      : '当前没有提供候选 API。'

  const instructions =
    locale === 'fr'
      ? [
          'Tu es un planificateur. Tu ne réponds pas à la question.',
          'Produis uniquement un JSON avec le plan d’exécution.',
          'N’inclus aucune chaîne de raisonnement.',
          'Le plan doit décrire: objectif, besoins de données, endpoints candidats, endpoints requis, champs de preuve attendus, clés de détail, nombre minimal d’appels API, et étapes.',
          `Limite les étapes à ${maxSteps}.`,
        ]
      : [
          '你是规划器，不直接回答问题。',
          '只输出 JSON 计划。',
          '不要输出思维链。',
          '计划需包含：目标、数据需求、候选API、必需API、证据字段、详情键、最少API调用数、步骤。',
          `步骤不超过 ${maxSteps}。`,
        ]

  const format =
    locale === 'fr'
      ? [
          'Format JSON:',
          '{"type":"plan","goal":"...","dataRequirements":["..."],"candidateApis":["..."],"requiredApis":["..."],"evidenceFields":["content"],"detailKeys":["date","id"],"minApiCalls":2,"steps":[{"id":"step-1","title":"...","apis":["get:/api/..."]}]}',
        ]
      : [
          'JSON 格式：',
          '{"type":"plan","goal":"...","dataRequirements":["..."],"candidateApis":["..."],"requiredApis":["..."],"evidenceFields":["content"],"detailKeys":["date","id"],"minApiCalls":2,"steps":[{"id":"step-1","title":"...","apis":["get:/api/..."]}]}',
        ]

  return [
    ...instructions,
    candidateLine,
    ...format,
  ].join('\n')
}
