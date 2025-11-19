import { config } from 'dotenv'

import { callDeepseek } from '@/lib/ai/deepseekClient'

config()

const prompt =
  process.argv.slice(2).join(' ') ||
  '请简要说明你是谁，并确认这是一条 DeepSeek 连接性测试消息。'

const main = async () => {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('Missing DEEPSEEK_API_KEY. Please add it to your .env file before running the test.')
  }

  console.log('🔍 Running DeepSeek connectivity smoke test…')

  const result = await callDeepseek({
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that only returns concise answers.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    maxTokens: 200,
  })

  console.log('\n✅ DeepSeek responded successfully:')
  console.log(result.content)

  if (result.usage) {
    console.log('\n📊 Token usage:', result.usage)
  }
}

main().catch((error) => {
  console.error('\n❌ DeepSeek test failed')
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exit(1)
})
