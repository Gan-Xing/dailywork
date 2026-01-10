import type { IntervalSide } from '@/lib/progressTypes'

type Operator = '+' | '-' | '*' | '/' | 'NEG'

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: Operator }
  | { type: 'paren'; value: '(' | ')' }

type ParseResult = { rpn: Token[] } | { error: string }

const operatorPrecedence: Record<Operator, number> = {
  NEG: 3,
  '*': 2,
  '/': 2,
  '+': 1,
  '-': 1,
}

const operatorAssociativity: Record<Operator, 'left' | 'right'> = {
  NEG: 'right',
  '*': 'left',
  '/': 'left',
  '+': 'left',
  '-': 'left',
}

const isOperator = (token: Token): token is { type: 'operator'; value: Operator } =>
  token.type === 'operator'

const isValueToken = (token: Token) => token.type === 'number' || token.type === 'identifier'

const tokenizeExpression = (expression: string): Token[] | { error: string } => {
  const tokens: Token[] = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1
      while (end < expression.length && /[0-9.]/.test(expression[end])) {
        end += 1
      }
      const raw = expression.slice(index, end)
      if (!raw || raw === '.' || raw.split('.').length > 2) {
        return { error: `数字格式无效：${raw || char}` }
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        return { error: `数字格式无效：${raw}` }
      }
      tokens.push({ type: 'number', value })
      index = end
      continue
    }

    if (/[a-zA-Z_]/.test(char)) {
      let end = index + 1
      while (end < expression.length && /[a-zA-Z0-9_]/.test(expression[end])) {
        end += 1
      }
      const identifier = expression.slice(index, end)
      tokens.push({ type: 'identifier', value: identifier })
      index = end
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index += 1
      continue
    }

    return { error: `无法识别的字符：${char}` }
  }

  return tokens
}

const toRpn = (tokens: Token[]): ParseResult => {
  const output: Token[] = []
  const stack: Token[] = []
  let prev: 'start' | 'operator' | 'value' | 'paren' = 'start'

  for (const token of tokens) {
    if (isValueToken(token)) {
      output.push(token)
      prev = 'value'
      continue
    }

    if (token.type === 'paren') {
      if (token.value === '(') {
        stack.push(token)
        prev = 'paren'
        continue
      }
      let found = false
      while (stack.length) {
        const top = stack.pop()
        if (!top) break
        if (top.type === 'paren' && top.value === '(') {
          found = true
          break
        }
        output.push(top)
      }
      if (!found) {
        return { error: '括号不匹配' }
      }
      prev = 'value'
      continue
    }

    if (token.type === 'operator') {
      let op: Operator = token.value
      if (op === '-' && (prev === 'start' || prev === 'operator' || prev === 'paren')) {
        op = 'NEG'
      }
      const opToken: Token = { type: 'operator', value: op }
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (!top || !isOperator(top)) break
        const topOp = top.value
        const shouldPop =
          operatorAssociativity[op] === 'left'
            ? operatorPrecedence[op] <= operatorPrecedence[topOp]
            : operatorPrecedence[op] < operatorPrecedence[topOp]
        if (!shouldPop) break
        output.push(stack.pop() as Token)
      }
      stack.push(opToken)
      prev = 'operator'
      continue
    }
  }

  while (stack.length) {
    const top = stack.pop()
    if (!top) break
    if (top.type === 'paren') {
      return { error: '括号不匹配' }
    }
    output.push(top)
  }

  if (!output.length) {
    return { error: '公式为空' }
  }

  return { rpn: output }
}

const evaluateRpn = (
  rpn: Token[],
  variables: Record<string, number>,
): { value: number | null; error?: string } => {
  const stack: number[] = []

  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(token.value)
      continue
    }
    if (token.type === 'identifier') {
      const value = variables[token.value]
      if (!Number.isFinite(value)) {
        return { value: null, error: `缺少变量：${token.value}` }
      }
      stack.push(value)
      continue
    }
    if (token.type === 'operator') {
      if (token.value === 'NEG') {
        const current = stack.pop()
        if (current === undefined) {
          return { value: null, error: '公式缺少操作数' }
        }
        stack.push(-current)
        continue
      }
      const right = stack.pop()
      const left = stack.pop()
      if (left === undefined || right === undefined) {
        return { value: null, error: '公式缺少操作数' }
      }
      let next: number
      switch (token.value) {
        case '+':
          next = left + right
          break
        case '-':
          next = left - right
          break
        case '*':
          next = left * right
          break
        case '/':
          if (right === 0) {
            return { value: null, error: '公式除数为 0' }
          }
          next = left / right
          break
        default:
          return { value: null, error: '未知运算符' }
      }
      if (!Number.isFinite(next)) {
        return { value: null, error: '计算结果无效' }
      }
      stack.push(next)
    }
  }

  if (stack.length !== 1) {
    return { value: null, error: '公式无法完成计算' }
  }

  return { value: stack[0] }
}

export const parseFormulaExpression = (expression: string): ParseResult => {
  const trimmed = expression.trim()
  if (!trimmed) {
    return { error: '公式为空' }
  }
  const tokens = tokenizeExpression(trimmed)
  if (Array.isArray(tokens)) {
    return toRpn(tokens)
  }
  return tokens
}

export const evaluateFormulaExpression = (
  expression: string,
  variables: Record<string, number>,
): { value: number | null; error?: string } => {
  const parsed = parseFormulaExpression(expression)
  if ('error' in parsed) {
    return { value: null, error: parsed.error }
  }
  return evaluateRpn(parsed.rpn, variables)
}

export const buildFormulaVariables = (params: {
  startPk: number
  endPk: number
  side: IntervalSide
  values?: Record<string, unknown> | null
}) => {
  const raw = Math.abs(params.endPk - params.startPk)
  const base = raw === 0 ? 1 : Math.max(raw, 0)
  const sideFactor = params.side === 'BOTH' ? 2 : 1
  const length = base * sideFactor

  const variables: Record<string, number> = {
    startPk: params.startPk,
    endPk: params.endPk,
    rawLength: raw,
    sideFactor,
    length,
    pointCount: 1,
  }

  const source = params.values ?? {}
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.entries(source).forEach(([key, value]) => {
      if (!key) return
      const normalized =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : Number.NaN
      if (Number.isFinite(normalized)) {
        variables[key] = normalized
      }
    })
  }

  return variables
}

export const normalizeInputValues = (values: unknown) => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return {}
  }
  const normalized: Record<string, number> = {}
  Object.entries(values).forEach(([key, value]) => {
    if (!key) return
    const numberValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN
    if (Number.isFinite(numberValue)) {
      normalized[key] = numberValue
    }
  })
  return normalized
}
