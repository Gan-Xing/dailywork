import assert from 'node:assert/strict'
import test from 'node:test'

import { createAiChatRequestGuard } from '../lib/ai-chat/requestGuard'

test('AI chat guard limits concurrent requests per account and releases once', () => {
  const guard = createAiChatRequestGuard({
    maxConcurrentPerUser: 1,
    maxConcurrentGlobal: 3,
  })
  const first = guard.acquire(1, 100_000)
  assert.equal(first.ok, true)
  const blocked = guard.acquire(1, 100_001)
  assert.deepEqual(blocked, {
    ok: false,
    reason: 'user_concurrency',
    retryAfterSeconds: 5,
  })
  if (!first.ok) return
  first.release()
  first.release()
  const second = guard.acquire(1, 100_002)
  assert.equal(second.ok, true)
  if (second.ok) second.release()
})

test('AI chat guard applies a sliding request window without counting rejected calls', () => {
  const guard = createAiChatRequestGuard({
    windowMs: 60_000,
    maxPerWindow: 2,
  })
  const first = guard.acquire(1, 100_000)
  assert.equal(first.ok, true)
  if (first.ok) first.release()
  const second = guard.acquire(1, 100_100)
  assert.equal(second.ok, true)
  if (second.ok) second.release()
  const blocked = guard.acquire(1, 100_200)
  assert.deepEqual(blocked, {
    ok: false,
    reason: 'user_rate',
    retryAfterSeconds: 60,
  })
  const afterWindow = guard.acquire(1, 160_001)
  assert.equal(afterWindow.ok, true)
  if (afterWindow.ok) afterWindow.release()
})

test('AI chat guard also limits total concurrent requests across accounts', () => {
  const guard = createAiChatRequestGuard({
    maxConcurrentPerUser: 2,
    maxConcurrentGlobal: 2,
  })
  const first = guard.acquire(1, 100_000)
  const second = guard.acquire(2, 100_001)
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual(guard.acquire(3, 100_002), {
    ok: false,
    reason: 'global_concurrency',
    retryAfterSeconds: 5,
  })
  if (first.ok) first.release()
  const third = guard.acquire(3, 100_003)
  assert.equal(third.ok, true)
  if (second.ok) second.release()
  if (third.ok) third.release()
  assert.throws(() => guard.acquire(0, 100_004))
})
