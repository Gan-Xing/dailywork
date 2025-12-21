export type NormalizedChineseProfile = {
  frenchName: string | null
  idNumber: string | null
  passportNumber: string | null
  educationAndMajor: string | null
  certifications: string[]
  domesticMobile: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  redBookValidYears: number | null
  cumulativeAbroadYears: number | null
  birthplace: string | null
  residenceInChina: string | null
  medicalHistory: string | null
  healthStatus: string | null
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[\/,，;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const parseOptionalInt = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const parsed = Number.parseInt(String(value).trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const normalizeChineseProfile = (raw: unknown): NormalizedChineseProfile => {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    frenchName: normalizeString(source.frenchName),
    idNumber: normalizeString(source.idNumber),
    passportNumber: normalizeString(source.passportNumber),
    educationAndMajor: normalizeString(source.educationAndMajor),
    certifications: normalizeStringArray(source.certifications),
    domesticMobile: normalizeString(source.domesticMobile),
    emergencyContactName: normalizeString(source.emergencyContactName),
    emergencyContactPhone: normalizeString(source.emergencyContactPhone),
    redBookValidYears: parseOptionalInt(source.redBookValidYears),
    cumulativeAbroadYears: parseOptionalInt(source.cumulativeAbroadYears),
    birthplace: normalizeString(source.birthplace),
    residenceInChina: normalizeString(source.residenceInChina),
    medicalHistory: normalizeString(source.medicalHistory),
    healthStatus: normalizeString(source.healthStatus),
  }
}

export const hasChineseProfileData = (profile: NormalizedChineseProfile) => {
  return (
    Boolean(profile.frenchName) ||
    Boolean(profile.idNumber) ||
    Boolean(profile.passportNumber) ||
    Boolean(profile.educationAndMajor) ||
    profile.certifications.length > 0 ||
    Boolean(profile.domesticMobile) ||
    Boolean(profile.emergencyContactName) ||
    Boolean(profile.emergencyContactPhone) ||
    profile.redBookValidYears !== null ||
    profile.cumulativeAbroadYears !== null ||
    Boolean(profile.birthplace) ||
    Boolean(profile.residenceInChina) ||
    Boolean(profile.medicalHistory) ||
    Boolean(profile.healthStatus)
  )
}
