export const extractJsonObject = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed) return null
  let candidate = trimmed
  if (candidate.startsWith('```')) {
    const fenceMatch = candidate.match(/```(?:json)?\n([\s\S]*?)```/i)
    if (fenceMatch?.[1]) {
      candidate = fenceMatch[1].trim()
    }
  }
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return candidate.slice(start, end + 1)
}

export const safeJsonParse = <T = unknown>(input: string): T | null => {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

export const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

export const clampMessageLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}
