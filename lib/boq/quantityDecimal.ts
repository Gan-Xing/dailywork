const decimal = /^-?\d+(?:\.\d+)?$/

/** Keep exact decimal strings; quantities must not pass through Number or a money formatter. */
export function formatWorkQuantity(value: string | null | undefined, unknown = '—'): string {
  if (typeof value !== 'string' || !decimal.test(value)) return unknown
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const integer = whole.replace(/^0+(?=\d)/, '')
  const significant = fraction.replace(/0+$/, '')
  const result = significant ? `${integer}.${significant}` : integer
  return negative && /[1-9]/.test(result) ? `-${result}` : result
}

/** Normalize persisted decimal quantities and editable decimal input without a floating-point conversion. */
export function normalizeWorkQuantity(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/,/g, '')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null
  const negative = raw.startsWith('-')
  const [whole = '', fraction = ''] = raw.replace(/^[+-]/, '').split('.')
  return formatWorkQuantity(`${negative ? '-' : ''}${whole || '0'}${fraction ? `.${fraction}` : ''}`)
}

/** Add quantity strings exactly, including signed corrections and all source decimal places. */
export function addWorkQuantities(left: string, right: string): string {
  const a = normalizeWorkQuantity(left)
  const b = normalizeWorkQuantity(right)
  if (a === null || b === null) throw new TypeError('Invalid decimal quantity')
  const parts = [a, b].map((value) => {
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
    return { negative: value.startsWith('-'), whole, fraction }
  })
  const scale = Math.max(parts[0].fraction.length, parts[1].fraction.length)
  const scaled = parts.map(({ negative, whole, fraction }) =>
    BigInt(`${negative ? '-' : ''}${whole}${fraction.padEnd(scale, '0')}`),
  )
  const total = scaled[0] + scaled[1]
  const negative = total < BigInt(0)
  const digits = (negative ? -total : total).toString().padStart(scale + 1, '0')
  const result = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits
  return formatWorkQuantity(`${negative ? '-' : ''}${result}`)
}
