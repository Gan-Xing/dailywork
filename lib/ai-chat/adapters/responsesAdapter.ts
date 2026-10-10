import type { AdapterGenerateParams, ModelAdapter } from '../types'

type ResponsesAdapterOptions = {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type ResponsesPayload = {
  status?: string
  model?: string
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
  output_text?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
  error?: { message?: string; code?: string }
}

export class ResponsesAdapterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'ResponsesAdapterError'
  }
}

const extractOutputText = (payload: ResponsesPayload) => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
}

export const createResponsesAdapter = ({
  baseUrl,
  apiKey,
  model,
  timeoutMs = 45_000,
  fetchImpl = fetch,
}: ResponsesAdapterOptions): ModelAdapter => {
  const parsedBaseUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/`)
  const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(parsedBaseUrl.hostname)
  if (parsedBaseUrl.protocol !== 'https:' && !(parsedBaseUrl.protocol === 'http:' && localHost)) {
    throw new ResponsesAdapterError('AI chat gateway must use HTTPS or a loopback address.')
  }
  const endpoint = new URL('responses', parsedBaseUrl).toString()
  if (!apiKey.trim()) throw new ResponsesAdapterError('AI chat gateway key is not configured.')
  if (!model.trim()) throw new ResponsesAdapterError('AI chat gateway model is not configured.')

  return {
    name: `responses:${model}`,
    generate: async ({ messages, responseFormat, signal }: AdapterGenerateParams) => {
      const timeoutSignal = AbortSignal.timeout(timeoutMs)
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal
      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: messages.map(({ role, content }) => ({ role, content })),
            stream: false,
            ...(responseFormat === 'json_object'
              ? { text: { format: { type: 'json_object' } } }
              : {}),
          }),
          signal: requestSignal,
        })
      } catch (error) {
        if (requestSignal.aborted) {
          throw new ResponsesAdapterError('AI chat gateway request timed out or was cancelled.')
        }
        throw new ResponsesAdapterError(
          `AI chat gateway request failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      let payload: ResponsesPayload
      try {
        payload = (await response.json()) as ResponsesPayload
      } catch {
        throw new ResponsesAdapterError('AI chat gateway returned invalid JSON.', response.status)
      }
      if (!response.ok || payload.error) {
        const code = payload.error?.code ? ` (${payload.error.code})` : ''
        throw new ResponsesAdapterError(
          `AI chat gateway returned HTTP ${response.status}${code}.`,
          response.status,
        )
      }
      const content = extractOutputText(payload)
      if (!content) {
        throw new ResponsesAdapterError('AI chat gateway returned no text.', response.status)
      }
      return {
        content,
        model: payload.model ?? model,
        usage: payload.usage
          ? {
              promptTokens: payload.usage.input_tokens ?? 0,
              completionTokens: payload.usage.output_tokens ?? 0,
              totalTokens: payload.usage.total_tokens ?? 0,
            }
          : undefined,
      }
    },
  }
}
