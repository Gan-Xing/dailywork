export type WeeklyPlanSignerOption = {
  id: number
  name: string | null
  frenchName: string | null
  username: string
  employmentStatus: string
  label: string
}

const normalizeLookupValue = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().replace(/\s+/g, ' ') ?? ''
  return trimmed ? trimmed.toLowerCase() : null
}

export const matchWeeklyPlanSignerId = (
  value: string | null | undefined,
  options: WeeklyPlanSignerOption[],
): string => {
  const normalized = normalizeLookupValue(value)
  if (!normalized) return ''

  const matches = options.filter((option) => {
    const candidates = [option.name, option.frenchName, option.username, option.label]
    return candidates.some((candidate) => normalizeLookupValue(candidate) === normalized)
  })

  return matches.length === 1 ? String(matches[0].id) : ''
}
