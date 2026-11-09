export type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413; message: string }

export const MAX_AI_CHAT_BODY_BYTES = 512 * 1024

export const readAiChatJsonBody = async <T>(request: Request): Promise<JsonBodyResult<T>> => {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_AI_CHAT_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Request body is too large' }
  }
  if (!request.body) {
    return { ok: false, status: 400, message: 'Invalid JSON body' }
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>
  try {
    reader = request.body.getReader()
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON body' }
  }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let raw = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_AI_CHAT_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, status: 413, message: 'Request body is too large' }
      }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, status: 400, message: 'Invalid JSON body' }
    }
    return { ok: true, value: value as T }
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON body' }
  } finally {
    reader.releaseLock()
  }
}
