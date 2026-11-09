import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_AI_CHAT_BODY_BYTES, readAiChatJsonBody } from '../lib/ai-chat/requestBody'

test('AI chat body reader accepts JSON objects and rejects malformed shapes', async () => {
  const valid = await readAiChatJsonBody<{ input: string }>(new Request('http://localhost/chat', {
    method: 'POST',
    body: JSON.stringify({ input: 'hello' }),
  }))
  assert.deepEqual(valid, { ok: true, value: { input: 'hello' } })

  for (const body of ['not json', '[]', 'null']) {
    const result = await readAiChatJsonBody(new Request('http://localhost/chat', {
      method: 'POST',
      body,
    }))
    assert.deepEqual(result, { ok: false, status: 400, message: 'Invalid JSON body' })
  }
})

test('AI chat body reader enforces the byte limit without relying on Content-Length', async () => {
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_AI_CHAT_BODY_BYTES))
      controller.enqueue(new Uint8Array(1))
      controller.close()
    },
  })
  const request = new Request('http://localhost/chat', {
    method: 'POST',
    body: oversized,
    duplex: 'half',
  } as RequestInit)
  const result = await readAiChatJsonBody(request)
  assert.deepEqual(result, { ok: false, status: 413, message: 'Request body is too large' })
})
