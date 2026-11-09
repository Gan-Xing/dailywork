/** Signed document values are decimal strings. A blank source cell is null, never zero. */
export type BillJson = null | boolean | number | string | BillJson[] | { [key: string]: BillJson }
export type BillEvidence = { [key: string]: BillJson }
export type SignedBillStatus = 'DRAFT' | 'SIGNED'
export type SignedBillAdjustmentKind =
  | 'ADVANCE_RECOVERY'
  | 'RETENTION_WITHHELD'
  | 'RETENTION_RELEASE'
  | 'MATERIAL_DEDUCTION'
  | 'OTHER'

export interface SignedBillLine {
  key: string
  /** Optional printed subtotals/notes are preserved but excluded from engineering totals. */
  rowType?: 'ITEM' | 'SUBTOTAL' | 'NOTE'
  boqItemId: number | null
  sourceCode: string | null
  designation: string
  unit: string | null
  unitPrice: string | null
  previousQuantity: string | null
  quantity: string | null
  cumulativeQuantity: string | null
  previousAmount: string | null
  amount: string | null
  cumulativeAmount: string | null
  evidence?: BillEvidence
}

export interface SignedBillAdjustment {
  key: string
  kind: SignedBillAdjustmentKind
  label: string
  effectHt: string
  evidence?: BillEvidence
}

export interface SignedBillSummary {
  previousGrossHt?: string | null
  cumulativeGrossHt?: string | null
  previousNetHt?: string | null
  cumulativeNetHt?: string | null
  previousNetTtc?: string | null
  cumulativeNetTtc?: string | null
  /** Fractional VAT rate, for example "0.18" for 18%. */
  vatRate?: string | null
  includesAdvancePeriodZero?: boolean
  history?: BillJson
}

export interface SignedBillSource {
  files?: Array<{ fileId: number; sha256?: string | null; role?: string; locators?: BillJson }>
  notes?: string[]
  verification?: string
  importId?: string
  [key: string]: BillJson | undefined
}

export interface SignedBillFileDto {
  id: number
  role: 'SIGNED_PDF' | 'CALCULATION' | 'EVIDENCE'
  originalName: string
  mimeType: string
  size: number
  checksum: string | null
  /** GET this API, then open response.file.url. The URL expires after five minutes. */
  downloadApiUrl: string
}

export interface SignedBillReconciliation {
  lineAmountTotal: string | null
  knownLineAmountTotal: string
  missingLineAmountCount: number
  adjustmentTotalHt: string
  computedNetHt: string | null
  computedVatAmount: string | null
  computedNetTtc: string | null
  lineGrossDifferenceHt: string | null
  netHtDifference: string | null
  vatDifference: string | null
  netTtcDifference: string | null
}

export interface SignedBillRevisionDto {
  id: number
  projectId: number
  periodIndex: number
  revision: number
  status: SignedBillStatus
  isCurrent: boolean
  currency: string
  signedAt: string | null
  signedPdfFileId: number | null
  calculationFileId: number | null
  grossHt: string | null
  netHt: string | null
  vatAmount: string | null
  netTtc: string | null
  lines: SignedBillLine[]
  adjustments: SignedBillAdjustment[]
  summary: SignedBillSummary
  source: SignedBillSource
  changeReason: string
  contentSha256: string
  createdAt: string
  createdById: number
  verifiedAt: string | null
  verifiedById: number | null
  activatedAt: string | null
  activatedById: number | null
  files: SignedBillFileDto[]
  reconciliation: SignedBillReconciliation
}

export interface CreateSignedBillInput {
  projectId: number
  periodIndex: number
  status?: SignedBillStatus
  currency?: string
  signedAt?: string | null
  signedPdfFileId?: number | null
  calculationFileId?: number | null
  grossHt?: string | null
  netHt?: string | null
  vatAmount?: string | null
  netTtc?: string | null
  lines?: SignedBillLine[]
  adjustments?: SignedBillAdjustment[]
  summary?: SignedBillSummary
  source?: SignedBillSource
  changeReason: string
  fromMeasurement?: boolean
  /** Reuse the exact period's bill-pdf and calculation-xlsx links if IDs are absent. */
  reusePeriodFiles?: boolean
  isSignedConfirmed?: boolean
  activate?: boolean
  /** Required when activate=true, including explicit null for a first activation. */
  expectedCurrentRevisionId?: number | null
}

export interface ActivateSignedBillInput {
  expectedCurrentRevisionId: number | null
  reason: string
}

export const SIGNED_BILL_ENTITY_TYPE = 'signed-bill-revision'
export const SIGNED_BILL_PERIOD_ENTITY_TYPE = 'boq-bill-period'

export class SignedBillError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'SignedBillError'
  }
}

export const positiveBillInteger = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new SignedBillError(`${label}必须为正整数`)
  }
  return value
}

export const billPeriodIndex = (value: unknown): number => {
  const period = positiveBillInteger(value, '期次')
  if (period > 10000) throw new SignedBillError('期次超出范围')
  return period
}

export const billDecimal = (value: unknown, label: string, scale = 18): string | null => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new SignedBillError(`${label}须为不含千分位或指数的十进制字符串`)
  }
  const [integer, fraction = ''] = value.replace(/^-/, '').split('.')
  if (integer.length > 20 || fraction.length > scale) {
    throw new SignedBillError(`${label}超出精度范围`)
  }
  return value
}

export const billText = (value: unknown, label: string, max = 2000): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new SignedBillError(`${label}不能为空或超出长度限制`)
  }
  return value.trim()
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SignedBillError(`${label}须为对象`)
  return value as Record<string, unknown>
}

export const billJson = (value: unknown, label: string, depth = 0): BillJson => {
  if (depth > 12) throw new SignedBillError(`${label}嵌套过深`)
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((entry) => billJson(entry, label, depth + 1))
  const record = object(value, label)
  const entries = Object.entries(record).map(([key, entry]) => [key, billJson(entry, label, depth + 1)])
  return Object.fromEntries(entries)
}

const nullableText = (value: unknown, label: string) => value == null || value === '' ? null : billText(value, label)
const nullableId = (value: unknown, label: string) => value == null ? null : positiveBillInteger(value, label)
const evidence = (value: unknown): BillEvidence | undefined => value === undefined ? undefined : billJson(object(value, '证据'), '证据') as BillEvidence

export const parseSignedBillLines = (value: unknown): SignedBillLine[] => {
  if (!Array.isArray(value) || value.length > 5000) throw new SignedBillError('账单行无效或超过5000行')
  const keys = new Set<string>()
  return value.map((entry) => {
    const row = object(entry, '账单行')
    const key = billText(row.key, '行键', 200)
    if (keys.has(key)) throw new SignedBillError(`重复账单行键：${key}`)
    keys.add(key)
    if (row.rowType !== undefined && !['ITEM', 'SUBTOTAL', 'NOTE'].includes(String(row.rowType))) throw new SignedBillError('账单行类型无效')
    return {
      key,
      ...(row.rowType === undefined ? {} : { rowType: row.rowType as 'ITEM' | 'SUBTOTAL' | 'NOTE' }),
      boqItemId: nullableId(row.boqItemId, '清单ID'),
      sourceCode: nullableText(row.sourceCode, '源价号'),
      designation: billText(row.designation, '清单名称'),
      unit: nullableText(row.unit, '单位'),
      unitPrice: billDecimal(row.unitPrice, '单价'),
      previousQuantity: billDecimal(row.previousQuantity, '以前工程量'),
      quantity: billDecimal(row.quantity, '本期工程量'),
      cumulativeQuantity: billDecimal(row.cumulativeQuantity, '累计工程量'),
      previousAmount: billDecimal(row.previousAmount, '以前金额'),
      amount: billDecimal(row.amount, '本期金额'),
      cumulativeAmount: billDecimal(row.cumulativeAmount, '累计金额'),
      ...(row.evidence === undefined ? {} : { evidence: evidence(row.evidence) }),
    }
  })
}

const ADJUSTMENT_KINDS: SignedBillAdjustmentKind[] = ['ADVANCE_RECOVERY', 'RETENTION_WITHHELD', 'RETENTION_RELEASE', 'MATERIAL_DEDUCTION', 'OTHER']

export const parseSignedBillAdjustments = (value: unknown): SignedBillAdjustment[] => {
  if (!Array.isArray(value) || value.length > 100) throw new SignedBillError('扣款列表无效')
  const keys = new Set<string>()
  return value.map((entry) => {
    const row = object(entry, '扣款')
    const key = billText(row.key, '扣款行键', 200)
    if (keys.has(key)) throw new SignedBillError(`重复扣款行键：${key}`)
    keys.add(key)
    if (!ADJUSTMENT_KINDS.includes(row.kind as SignedBillAdjustmentKind)) throw new SignedBillError('扣款类型无效')
    const kind = row.kind as SignedBillAdjustmentKind
    const effectHt = billDecimal(row.effectHt, '扣款金额')
    if (effectHt === null) throw new SignedBillError('扣款金额不能为空')
    if (kind === 'RETENTION_RELEASE' && effectHt.startsWith('-') && /[1-9]/.test(effectHt)) throw new SignedBillError('质保金返还须为正值')
    if (['ADVANCE_RECOVERY', 'RETENTION_WITHHELD', 'MATERIAL_DEDUCTION'].includes(kind) && !effectHt.startsWith('-') && /[1-9]/.test(effectHt)) throw new SignedBillError('扣回或扣留须为负值')
    return { key, kind, label: billText(row.label, '扣款说明'), effectHt, ...(row.evidence === undefined ? {} : { evidence: evidence(row.evidence) }) }
  })
}

export const parseSignedBillSummary = (value: unknown): SignedBillSummary => {
  const row = object(value ?? {}, '汇总')
  const result: SignedBillSummary = {}
  for (const key of ['previousGrossHt', 'cumulativeGrossHt', 'previousNetHt', 'cumulativeNetHt', 'previousNetTtc', 'cumulativeNetTtc', 'vatRate'] as const) {
    if (row[key] !== undefined) result[key] = billDecimal(row[key], key)
  }
  if (row.includesAdvancePeriodZero !== undefined) {
    if (typeof row.includesAdvancePeriodZero !== 'boolean') throw new SignedBillError('第0期标记无效')
    result.includesAdvancePeriodZero = row.includesAdvancePeriodZero
  }
  if (row.history !== undefined) result.history = billJson(row.history, '历史汇总')
  return result
}

export const parseSignedBillSource = (value: unknown): SignedBillSource => {
  const source = billJson(object(value ?? {}, '来源'), '来源') as SignedBillSource
  if (JSON.stringify(source).length > 1000000) throw new SignedBillError('来源证据过大')
  if (source.files !== undefined) {
    if (!Array.isArray(source.files) || source.files.length > 200) throw new SignedBillError('来源文件列表无效')
    const ids = new Set<number>()
    for (const file of source.files) {
      object(file, '来源文件')
      positiveBillInteger(file.fileId, '来源文件ID')
      if (ids.has(file.fileId)) throw new SignedBillError('来源文件ID重复，请将多个定位放入同一文件的locators')
      ids.add(file.fileId)
      if (file.sha256 != null && (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.sha256))) throw new SignedBillError('来源SHA256无效')
      if (file.role !== undefined) billText(file.role, '来源文件角色', 200)
    }
  }
  if (source.notes !== undefined && (!Array.isArray(source.notes) || source.notes.length > 200 || source.notes.some((note) => typeof note !== 'string' || note.length > 20000))) throw new SignedBillError('来源备注须为文本列表')
  if (source.verification !== undefined) billText(source.verification, '来源核实范围', 20000)
  if (source.importId !== undefined) billText(source.importId, '导入标识', 200)
  return source
}

/** Deterministic ordering is used for content idempotency, not as proof of signature. */
export const canonicalBillJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalBillJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalBillJson(entry)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export const assertSignedBillActivation = (target: { status: string }, currentId: number | null, expectedId: number | null) => {
  if (target.status !== 'SIGNED') throw new SignedBillError('草稿不能设为正式版本', 409)
  if (currentId !== expectedId) throw new SignedBillError('当前版本已变化，请刷新后重试', 409)
}

/** Only current SIGNED snapshots participate. Each project+period must occur once. */
export const currentSignedBills = <T extends { projectId: number; periodIndex: number; status: string; isCurrent: boolean }>(rows: T[]): T[] => {
  const keys = new Set<string>()
  return rows.filter((row) => {
    if (!row.isCurrent || row.status !== 'SIGNED') return false
    const key = `${row.projectId}:${row.periodIndex}`
    if (keys.has(key)) throw new SignedBillError('同一期存在多个当前正式版本', 409)
    keys.add(key)
    return true
  })
}
