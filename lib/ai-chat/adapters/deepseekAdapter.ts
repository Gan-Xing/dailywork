import { callDeepseek } from '@/lib/ai/deepseekClient'

import type { AdapterGenerateParams, ModelAdapter } from '../types'

type DeepseekAdapterOptions = {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
}

export const createDeepseekAdapter = (options: DeepseekAdapterOptions = {}): ModelAdapter => {
  return {
    name: 'deepseek',
    generate: async ({ messages, responseFormat }: AdapterGenerateParams) => {
      const result = await callDeepseek({
        messages,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        responseFormat: responseFormat ?? 'text',
      })
      return {
        content: result.content,
        model: result.model,
        usage: result.usage,
        raw: result.raw,
      }
    },
  }
}
