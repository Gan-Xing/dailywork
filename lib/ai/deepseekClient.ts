const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface CallDeepseekParams {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  responseFormat?: 'text' | 'json_object'
}

export interface CallDeepseekResult {
  id: string
  model: string
  content: string
  finishReason: string | null
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  raw: DeepseekApiResponse
}

export class DeepseekConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeepseekConfigError'
  }
}

export class DeepseekRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: unknown,
  ) {
    super(message)
    this.name = 'DeepseekRequestError'
  }
}

export const callDeepseek = async ({
  messages,
  model = DEFAULT_MODEL,
  temperature = 0.2,
  maxTokens = 1024,
  topP = 0.9,
  responseFormat = 'text',
}: CallDeepseekParams): Promise<CallDeepseekResult> => {
  if (!messages?.length) {
    throw new DeepseekRequestError('Deepseek requires at least one chat message.')
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new DeepseekConfigError('Missing DEEPSEEK_API_KEY. Add it to your .env file.')
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    stream: false,
  }

  if (responseFormat !== 'text') {
    body.response_format = { type: responseFormat }
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = await response.text()
    }

    throw new DeepseekRequestError('Deepseek request failed.', response.status, payload)
  }

  const data = (await response.json()) as DeepseekApiResponse
  const [choice] = data.choices ?? []

  if (!choice?.message?.content) {
    throw new DeepseekRequestError('Deepseek response is missing content.', response.status, data)
  }

  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined

  return {
    id: data.id,
    model: data.model,
    content: choice.message.content.trim(),
    finishReason: choice.finish_reason ?? null,
    usage,
    raw: data,
  }
}

interface DeepseekApiResponse {
  id: string
  model: string
  created: number
  choices: Array<DeepseekApiChoice>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface DeepseekApiChoice {
  index: number
  finish_reason: string | null
  message?: {
    role?: ChatRole
    content?: string
  }
}
