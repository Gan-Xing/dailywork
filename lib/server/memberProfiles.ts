import type { ContractType, SalaryUnit } from '@prisma/client'

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

export type NormalizedExpatProfile = {
  team: string | null
  contractNumber: string | null
  contractType: ContractType | null
  salaryCategory: string | null
  prime: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: SalaryUnit | null
  netMonthlyAmount: string | null
  netMonthlyUnit: SalaryUnit | null
  maritalStatus: string | null
  childrenCount: number | null
  cnpsNumber: string | null
  cnpsDeclarationCode: string | null
  provenance: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
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

const parseContractType = (value: unknown): ContractType | null => {
  if (typeof value !== 'string') return null
  const text = value.trim().toUpperCase()
  if (!text) return null
  if (text === 'CTJ') return 'CTJ'
  if (text === 'CDD') return 'CDD'
  return null
}

const parseSalaryUnit = (value: unknown): SalaryUnit | null => {
  if (typeof value !== 'string') return null
  const text = value.trim().toUpperCase()
  if (!text) return null
  if (text === 'MONTH') return 'MONTH'
  if (text === 'HOUR') return 'HOUR'
  if (text.includes('/H') || text === 'H' || text.endsWith('H')) return 'HOUR'
  if (text.includes('/M') || text.includes('MOIS') || text === 'M' || text.endsWith('M')) {
    return 'MONTH'
  }
  return null
}

const parseNumberValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  let normalized = trimmed.replace(/\s+/g, '')
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '')
  } else if (normalized.includes(',')) {
    const parts = normalized.split(',')
    const last = parts[parts.length - 1] ?? ''
    if (last.length > 0 && last.length <= 2) {
      normalized = `${parts.slice(0, -1).join('')}.${last}`
    } else {
      normalized = parts.join('')
    }
  }
  normalized = normalized.replace(/[^\d.-]/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const parseSalaryInput = (value: unknown): { amount: string; unit: SalaryUnit | null } | null => {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  const normalized = raw.toUpperCase().replace(/\bNET\b/g, '').trim()
  if (!normalized) return null
  const fallbackUnit = parseSalaryUnit(normalized)
  const segments = normalized
    .split(/[-–—]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const candidates: Array<{ amount: number; unit: SalaryUnit | null }> = []
  segments.forEach((segment) => {
    const unit = parseSalaryUnit(segment) ?? fallbackUnit
    const matches = segment.match(/\d[\d\s,\.]*/g) ?? []
    matches.forEach((match) => {
      const parsed = parseNumberValue(match)
      if (parsed !== null) {
        candidates.push({ amount: parsed, unit })
      }
    })
  })
  if (candidates.length === 0) return null
  const best = candidates.reduce((prev, next) => (next.amount > prev.amount ? next : prev))
  return { amount: String(best.amount), unit: best.unit }
}

const parseMaritalStatusInput = (value: unknown) => {
  if (typeof value !== 'string') return { status: null, childrenCount: null }
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return { status: null, childrenCount: null }
  const countMatch = normalized.match(/(\d+)/)
  const childrenCount = countMatch ? Number.parseInt(countMatch[1], 10) : null
  const status = normalized
    .replace(/\d+/g, '')
    .replace(/\bENFANTS?\b/gi, '')
    .trim()
  return { status: status || null, childrenCount }
}

const parseCnpsNumber = (value: unknown) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const parts = text.split('/')
  const tail = parts[parts.length - 1] ?? ''
  const digits = tail.replace(/\D/g, '')
  return digits || null
}

const parseCnpsDeclarationCode = (value: unknown) => {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  return digits ? digits : null
}

const parseEmergencyContactInput = (value: unknown) => {
  if (typeof value !== 'string') return { name: null, phone: null }
  const text = value.trim()
  if (!text) return { name: null, phone: null }
  const match = text.match(/^([+\d][\d\s-]{4,})(.*)$/)
  if (match) {
    const phone = match[1]?.trim() ?? ''
    const name = match[2]?.trim() ?? ''
    return { name: name || null, phone: phone || null }
  }
  return { name: text, phone: null }
}

const parseDateParts = (year: number, month: number, day: number) => {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export const parseBirthDateInput = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (!match) return null
  const [, year, month, day] = match
  return parseDateParts(Number(year), Number(month), Number(day))
}

export const parseChineseIdBirthDate = (value: unknown) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (/^\d{17}[\dXx]$/.test(text)) {
    const digits = text.slice(6, 14)
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    return parseDateParts(year, month, day)
  }
  if (/^\d{15}$/.test(text)) {
    const digits = `19${text.slice(6, 12)}`
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    return parseDateParts(year, month, day)
  }
  return null
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

export const normalizeExpatProfile = (raw: unknown): NormalizedExpatProfile => {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const directSalaryAmount = parseNumberValue(String(source.baseSalaryAmount ?? '').trim())
  const directSalaryUnit = parseSalaryUnit(source.baseSalaryUnit)
  const parsedSalary = parseSalaryInput(source.baseSalary)
  const baseSalaryAmount = directSalaryAmount !== null ? String(directSalaryAmount) : parsedSalary?.amount ?? null
  const baseSalaryUnit = directSalaryUnit ?? parsedSalary?.unit ?? null

  const directNetAmount = parseNumberValue(String(source.netMonthlyAmount ?? '').trim())
  const parsedNet = parseSalaryInput(source.netMonthly)
  const netMonthlyAmount = directNetAmount !== null ? String(directNetAmount) : parsedNet?.amount ?? null
  let netMonthlyUnit = parseSalaryUnit(source.netMonthlyUnit) ?? parsedNet?.unit ?? null
  if (netMonthlyAmount && netMonthlyUnit !== 'MONTH') {
    netMonthlyUnit = 'MONTH'
  }

  const childrenFromField = parseOptionalInt(source.childrenCount)
  const parsedMarital = parseMaritalStatusInput(source.maritalStatus)
  const maritalStatus = normalizeString(source.maritalStatus) ?? parsedMarital.status
  const childrenCount = childrenFromField ?? parsedMarital.childrenCount

  let emergencyContactName = normalizeString(source.emergencyContactName)
  let emergencyContactPhone = normalizeString(source.emergencyContactPhone)
  if (!emergencyContactName && !emergencyContactPhone && source.emergencyContact) {
    const parsedEmergency = parseEmergencyContactInput(source.emergencyContact)
    emergencyContactName = parsedEmergency.name
    emergencyContactPhone = parsedEmergency.phone
  }

  return {
    team: normalizeString(source.team),
    contractNumber: normalizeString(source.contractNumber),
    contractType: parseContractType(source.contractType),
    salaryCategory: normalizeString(source.salaryCategory),
    prime: normalizeString(String(source.prime ?? '')),
    baseSalaryAmount,
    baseSalaryUnit,
    netMonthlyAmount,
    netMonthlyUnit,
    maritalStatus,
    childrenCount,
    cnpsNumber: parseCnpsNumber(source.cnpsNumber),
    cnpsDeclarationCode: parseCnpsDeclarationCode(source.cnpsDeclarationCode),
    provenance: normalizeString(source.provenance),
    emergencyContactName,
    emergencyContactPhone,
  }
}

export const hasExpatProfileData = (profile: NormalizedExpatProfile) => {
  return (
    Boolean(profile.team) ||
    Boolean(profile.contractNumber) ||
    Boolean(profile.contractType) ||
    Boolean(profile.salaryCategory) ||
    Boolean(profile.prime) ||
    Boolean(profile.baseSalaryAmount) ||
    Boolean(profile.baseSalaryUnit) ||
    Boolean(profile.netMonthlyAmount) ||
    Boolean(profile.netMonthlyUnit) ||
    Boolean(profile.maritalStatus) ||
    profile.childrenCount !== null ||
    Boolean(profile.cnpsNumber) ||
    Boolean(profile.cnpsDeclarationCode) ||
    Boolean(profile.provenance) ||
    Boolean(profile.emergencyContactName) ||
    Boolean(profile.emergencyContactPhone)
  )
}
