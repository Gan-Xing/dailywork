export type MaterialModelDimension = {
  label: string
  value: string
  unit?: string
}

export type MaterialModel = {
  dimensions: MaterialModelDimension[]
}

export const WEEKLY_PLAN_ITEM_STATUSES = ['planned', 'in_transit', 'arrived', 'cancelled'] as const

export type WeeklyPlanItemStatus = (typeof WEEKLY_PLAN_ITEM_STATUSES)[number]

const EMPTY_DIMENSION_LABEL = ''

const normalizeText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function normalizeWeeklyPlanItemStatus(value: unknown): WeeklyPlanItemStatus {
  if (typeof value !== 'string') return 'planned'
  if (WEEKLY_PLAN_ITEM_STATUSES.includes(value as WeeklyPlanItemStatus)) {
    return value as WeeklyPlanItemStatus
  }
  return 'planned'
}

export function normalizeGoodsName(goodsName: string | null | undefined): string | null {
  const normalized = goodsName?.trim().replace(/\s+/g, ' ') ?? ''
  if (!normalized) return null
  return normalized
}

export function buildGoodsNameKey(goodsName: string | null | undefined): string | null {
  const normalized = normalizeGoodsName(goodsName)
  if (!normalized) return null
  return normalized.toLowerCase()
}

export function normalizeMaterialModel(modelJson: unknown): MaterialModel | null {
  if (!modelJson || typeof modelJson !== 'object') return null

  const legacyRaw = normalizeText((modelJson as { raw?: unknown }).raw)
  if (legacyRaw) {
    return {
      dimensions: [{ label: EMPTY_DIMENSION_LABEL, value: legacyRaw }],
    }
  }

  if (Array.isArray((modelJson as { dimensions?: unknown }).dimensions)) {
    const dimensions = ((modelJson as { dimensions: unknown[] }).dimensions ?? [])
      .map((dimension) => {
        if (!dimension || typeof dimension !== 'object') return null
        const label = normalizeText((dimension as { label?: unknown; name?: unknown }).label ?? (dimension as { label?: unknown; name?: unknown }).name)
        const value = normalizeText((dimension as { value?: unknown }).value)
        const unit = normalizeText((dimension as { unit?: unknown }).unit)
        if (!label && !value) return null
        return {
          label: label || EMPTY_DIMENSION_LABEL,
          value,
          ...(unit ? { unit } : {}),
        } satisfies MaterialModelDimension
      })
      .filter((dimension): dimension is MaterialModelDimension => Boolean(dimension && dimension.value))

    return dimensions.length > 0 ? { dimensions } : null
  }

  const dimensions = Object.entries(modelJson as Record<string, unknown>)
    .map(([key, rawValue]) => {
      const value = normalizeText(rawValue)
      if (!value) return null
      return {
        label: key,
        value,
      } satisfies MaterialModelDimension
    })
    .filter((dimension): dimension is MaterialModelDimension => Boolean(dimension))

  return dimensions.length > 0 ? { dimensions } : null
}

const canonicalizeMaterialModel = (modelJson: unknown): unknown => {
  const normalized = normalizeMaterialModel(modelJson)
  if (!normalized) return null

  return {
    dimensions: [...normalized.dimensions]
      .map((dimension) => ({
        label: normalizeText(dimension.label),
        value: normalizeText(dimension.value),
        ...(normalizeText(dimension.unit) ? { unit: normalizeText(dimension.unit) } : {}),
      }))
      .sort((a, b) => {
        const aKey = `${a.label.toLowerCase()}|${a.value.toLowerCase()}|${a.unit?.toLowerCase() ?? ''}`
        const bKey = `${b.label.toLowerCase()}|${b.value.toLowerCase()}|${b.unit?.toLowerCase() ?? ''}`
        return aKey.localeCompare(bKey)
      }),
  }
}

export function buildMaterialModelKey(modelJson: unknown): string {
  const canonical = canonicalizeMaterialModel(modelJson)
  if (!canonical) return ''
  return stableStringify(canonical)
}

export function formatMaterialModel(_goodsName: string | null, modelJson: unknown): string {
  const normalized = normalizeMaterialModel(modelJson)
  if (!normalized) return ''

  return normalized.dimensions
    .map((dimension) => `${dimension.value}${dimension.unit ?? ''}`)
    .filter(Boolean)
    .join('*')
}

export function createEmptyMaterialModel(): MaterialModel {
  return {
    dimensions: [{ label: '', value: '', unit: '' }],
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateInput(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function calculateWeekEndDate(startDate: Date | string | null | undefined): Date | null {
  const parsed = startDate instanceof Date ? startDate : parseDateInput(startDate)
  if (!parsed) return null
  return addDays(parsed, 7)
}

export function formatPlanDateRange(startDate: Date | string | null | undefined, endDate: Date | string | null | undefined): string {
  const start = formatDateInput(startDate)
  const end = formatDateInput(endDate)
  if (!start && !end) return ''
  if (!end) return start
  if (!start) return end
  return `${start} ~ ${end}`
}

export function combinePlateNumbers(
  headPlateNumber: string | null | undefined,
  tailPlateNumber: string | null | undefined,
): string {
  const head = normalizeText(headPlateNumber)
  const tail = normalizeText(tailPlateNumber)
  if (head && tail) return `${head}-${tail}`
  return head || tail
}
