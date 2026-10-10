import { createDeepseekAdapter } from '../deepseekAdapter'
import { createResponsesAdapter } from '../responsesAdapter'
import { buildDailyworkTools } from './tools'

export const getDailyworkChatAdapter = () => {
  const provider = process.env.AI_CHAT_PROVIDER ?? 'deepseek'
  if (provider === 'responses') {
    return createResponsesAdapter({
      baseUrl: process.env.AI_CHAT_BASE_URL ?? 'http://127.0.0.1:8320/v1',
      apiKey: process.env.AI_CHAT_API_KEY ?? '',
      model: process.env.AI_CHAT_MODEL ?? '',
    })
  }
  if (provider !== 'deepseek') {
    throw new Error(`Unsupported AI chat provider: ${provider}`)
  }
  return createDeepseekAdapter({
    temperature: 0.2,
    maxTokens: 1200,
    topP: 0.9,
  })
}

export const getDailyworkChatTools = () => buildDailyworkTools()
