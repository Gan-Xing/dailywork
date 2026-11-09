import 'dotenv/config'

import { prisma } from '../lib/prisma'
import { runOneAiPdfJob } from '../lib/server/aiChatJobWorker'

let stopping = false
process.on('SIGTERM', () => { stopping = true })
process.on('SIGINT', () => { stopping = true })

const main = async () => {
  do {
    try {
      const worked = await runOneAiPdfJob()
      if (process.argv.includes('--once')) break
      if (!worked) await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      if (process.argv.includes('--once')) throw error
      console.error('[ai-chat-worker] pass failed; durable tasks retained')
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  } while (!stopping)
}

main().catch((error) => {
  console.error('[ai-chat-worker]', error instanceof Error ? error.name : 'Error')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
