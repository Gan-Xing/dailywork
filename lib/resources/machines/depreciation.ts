const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

const round2 = (value: number) => Math.round(value * 100) / 100

const parseDateKey = (value: string) => {
  const text = value.trim()
  if (!DATE_KEY_RE.test(text)) {
    return null
  }
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(5, 7)) // 1-12
  const day = Number(text.slice(8, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

const monthKey = (year: number, month: number) => year * 12 + (month - 1)

const daysInMonthUtc = (year: number, month: number) => {
  // month is 1-12. Passing `month` as the next-month index makes day 0 the last day of desired month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const parseIsoMonthKey = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  return monthKey(year, month)
}

export const computeMachineDailyDepreciation = ({
  dateKey,
  registrationDate,
  originalValue,
  usedMonths,
}: {
  dateKey: string
  registrationDate: string | null
  originalValue: number | null
  usedMonths: number | null
}): number | null => {
  const parts = parseDateKey(dateKey)
  if (!parts) return null

  if (originalValue == null || !Number.isFinite(originalValue)) return null

  const months = usedMonths == null || !Number.isFinite(usedMonths) ? null : Math.max(0, Math.round(usedMonths))
  if (!months) return null

  const dim = daysInMonthUtc(parts.year, parts.month)
  if (!dim || !Number.isFinite(dim)) return null

  const monthly = originalValue / months
  if (!Number.isFinite(monthly)) return null

  const dateMonthKey = monthKey(parts.year, parts.month)
  const regMonthKey = registrationDate ? parseIsoMonthKey(registrationDate) : null

  if (regMonthKey != null) {
    const diff = dateMonthKey - regMonthKey
    if (diff < 0) return 0
    if (diff >= months) return 0
  }

  return round2(monthly / dim)
}

