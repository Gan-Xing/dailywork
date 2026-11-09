import type { ChatSource, ChatToolCallRecord } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const collectSuccessfulSources = (calls: ChatToolCallRecord[]): ChatSource[] => {
  const sources = new Map<string, ChatSource>()
  calls.forEach((call) => {
    if (call.result.ok && call.result.sources) {
      call.result.sources.forEach((source) => {
        if (/^\/(?:api\/|value\/|resources\/)/.test(source.url) &&
            !/[\\\r\n]/.test(source.url)) {
          sources.set(source.url, source)
        }
      })
    }
    if (call.tool !== 'call_api' || !call.result.ok) return
    const key = typeof call.arguments.key === 'string' ? call.arguments.key : ''
    if (!key.startsWith('get:/api/')) return
    const params = isRecord(call.arguments.params) ? call.arguments.params : {}
    const query = isRecord(call.arguments.query) ? call.arguments.query : {}
    let path = key.slice(4)
    path = path.replace(/:([a-zA-Z0-9_]+)\*?/g, (match, name: string) => {
      const value = params[name]
      if (value === undefined || value === null || value === '') return match
      if (Array.isArray(value)) return value.map((item) => encodeURIComponent(String(item))).join('/')
      return encodeURIComponent(String(value))
    })
    if (path.includes(':')) return
    const search = new URLSearchParams()
    Object.entries(query).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') return
      const values = Array.isArray(value) ? value : [value]
      values.forEach((item) => search.append(name, String(item)))
    })
    const url = `${path}${search.size ? `?${search}` : ''}`
    if (!sources.has(url)) sources.set(url, { key, url })
  })
  return Array.from(sources.values()).slice(0, 8)
}
