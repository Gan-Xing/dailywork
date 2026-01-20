export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatLocale = 'zh' | 'fr' | string

export type ChatToolSchema = {
  type: 'object'
  properties: Record<string, { type: string; description?: string; enum?: string[] }>
  required?: string[]
}

export type ChatToolPermissionMode = 'all' | 'any'

export type ChatToolResult = {
  ok: boolean
  content: string
  data?: unknown
  error?: string
}

export type ChatToolContext = {
  session: ChatSession | null
  locale: ChatLocale
  request?: {
    origin: string
    cookie?: string
  }
  permissionChecker?: PermissionChecker
}

export type ChatTool = {
  name: string
  description: string
  schema: ChatToolSchema
  requiredPermissions?: string[]
  permissionMode?: ChatToolPermissionMode
  handler: (args: Record<string, unknown>, context: ChatToolContext) => Promise<ChatToolResult>
  formatResult?: (result: ChatToolResult) => string
}

export type ToolCallPayload = {
  type: 'tool_call'
  tool: string
  arguments?: Record<string, unknown>
  reason?: string
}

export type PlanStep = {
  id: string
  title: string
  tools?: string[]
}

export type PlanPayload = {
  type: 'plan'
  goal: string
  steps: PlanStep[]
}

export type StepDonePayload = {
  type: 'step_done'
  summary?: string
}

export type FinalAnswerPayload = {
  type: 'final'
  answer: string
  followUp?: string[]
  sources?: string[]
}

export type ModelResponsePayload = ToolCallPayload | PlanPayload | StepDonePayload | FinalAnswerPayload

export type ChatSession = {
  id: number
  username: string
  permissions: string[]
}

export type AdapterGenerateParams = {
  messages: ChatMessage[]
  responseFormat?: 'text' | 'json_object'
}

export type AdapterGenerateResult = {
  content: string
  model?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  raw?: unknown
}

export type ModelAdapter = {
  name: string
  generate: (params: AdapterGenerateParams) => Promise<AdapterGenerateResult>
}

export type PermissionChecker = (permission: string) => Promise<boolean>

export type ChatToolCallRecord = {
  tool: string
  arguments: Record<string, unknown>
  result: ChatToolResult
}

export type ChatStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'plan'; plan: PlanPayload }
  | { type: 'step'; step: PlanStep; index: number; total: number }
  | { type: 'tool_call'; tool: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: ChatToolResult }
  | { type: 'step_done'; summary?: string }
  | {
      type: 'final'
      answer: string
      plan?: PlanPayload
      stepSummaries?: string[]
      toolCalls?: ChatToolCallRecord[]
    }
  | { type: 'error'; message: string }

export type ChatRunOptions = {
  adapter: ModelAdapter
  tools: ChatTool[]
  session: ChatSession | null
  locale?: ChatLocale
  messages: ChatMessage[]
  maxTurns?: number
  maxSteps?: number
  maxStepTurns?: number
  enablePlanning?: boolean
  permissionChecker?: PermissionChecker
  request?: {
    origin: string
    cookie?: string
  }
  onEvent?: (event: ChatStreamEvent) => void
}

export type ChatRunResult = {
  answer: string
  toolCalls: ChatToolCallRecord[]
  plan?: PlanPayload
  stepSummaries?: string[]
  usage?: AdapterGenerateResult['usage']
}
