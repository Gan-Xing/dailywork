import { createDeepseekAdapter } from '../deepseekAdapter'
import { buildDailyworkTools } from './tools'

export const getDailyworkChatAdapter = () =>
  createDeepseekAdapter({
    temperature: 0.2,
    maxTokens: 1200,
    topP: 0.9,
  })

export const getDailyworkChatTools = () => buildDailyworkTools()
