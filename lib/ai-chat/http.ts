import type { ChatToolCallRecord, PlanPayload } from './types'

export type ChatApiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatApiRequest = {
  input: string
  history?: ChatApiMessage[]
  locale?: string
  memoryContext?: string
}

export type ChatApiResponse = {
  answer: string
  toolCalls?: ChatToolCallRecord[]
  plan?: PlanPayload
  stepSummaries?: string[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
