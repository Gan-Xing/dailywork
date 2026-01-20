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
    localeInstruction(locale),
    'Do not expose chain-of-thought. Provide concise answers with clear results.',
    'If data is unavailable or permissions are insufficient, explain the limitation and suggest next steps.',
    'Before finalizing, verify the answer fully addresses the question. If not, return an updated plan and continue.',
    'Finance/cost questions: always call the finance insights API (key: get:/api/finance/insights) before answering. If date range is missing, ask for it or call get_system_time to build the current month range.',
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
