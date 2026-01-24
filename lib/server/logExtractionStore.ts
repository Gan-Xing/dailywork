import { prisma } from '@/lib/prisma'
import { DEFAULT_LOG_EXTRACTION_PROMPT } from '@/lib/logExtraction'

export const LOG_EXTRACTION_CONFIG_KEY = 'daily-report-extractor'

export type LogExtractionConfigRecord = {
  id: number
  key: string
  promptText: string
  updatedById: number | null
  createdAt: Date
  updatedAt: Date
}

export const getLogExtractionConfig = async () => {
  return prisma.logExtractionConfig.findUnique({
    where: { key: LOG_EXTRACTION_CONFIG_KEY },
  })
}

export const getEffectiveLogExtractionPrompt = async () => {
  const config = await getLogExtractionConfig()
  return config?.promptText?.trim() || DEFAULT_LOG_EXTRACTION_PROMPT
}

export const upsertLogExtractionConfig = async (promptText: string, userId?: number | null) => {
  const trimmed = promptText.trim() || DEFAULT_LOG_EXTRACTION_PROMPT
  return prisma.logExtractionConfig.upsert({
    where: { key: LOG_EXTRACTION_CONFIG_KEY },
    create: {
      key: LOG_EXTRACTION_CONFIG_KEY,
      promptText: trimmed,
      updatedById: userId ?? null,
    },
    update: {
      promptText: trimmed,
      updatedById: userId ?? null,
    },
  })
}
