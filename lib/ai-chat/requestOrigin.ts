import { AiBusinessError } from './weeklyPlanChanges'

export const assertChatSameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  if (!origin) return
  const expected = new URL(request.url).origin
  const publicOrigin = process.env.SITE_BASE_URL ? new URL(process.env.SITE_BASE_URL).origin : expected
  let originHost: string
  try { originHost = new URL(origin).host } catch { throw new AiBusinessError('Invalid origin.', 403) }
  if (origin !== expected && origin !== publicOrigin && originHost !== request.headers.get('host')) {
    throw new AiBusinessError('Cross-origin request refused.', 403)
  }
}

export const requireUuid = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AiBusinessError('Invalid identifier.')
  }
  return value
}
