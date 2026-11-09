type AdvanceDraft = { amount?: string; note?: string }
type AdvanceRecord = { amount: string | null; note: string | null } | undefined

export function buildAdvanceMeasurementEntry(period: string, draft: AdvanceDraft, record: AdvanceRecord) {
  const note = draft.note ?? record?.note ?? null
  if (draft.amount === undefined) return { period, amount: record?.amount ?? null, note }
  if (draft.amount === '') return { period, amount: null, note }
  const raw = draft.amount.trim().replace(/,/g, '')
  const parsed = raw ? Number(raw) : Number.NaN
  // Preserve the existing explicit-edit rounding rule, never apply it to a note-only edit.
  const amount = Number.isFinite(parsed) ? (Math.round(parsed * 10) / 10).toFixed(1) : draft.amount
  return { period, amount, note }
}
