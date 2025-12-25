import type { ChineseProfile, ChineseProfileForm, ExpatProfile, ExpatProfileForm } from './types'

export const normalizeText = (value?: string | null) => (value ?? '').trim()

export const normalizeProfileNumber = (value: string) => {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const parseBirthDateFromIdNumber = (value: string) => {
  const text = value.trim()
  if (!text) return ''
  let digits = ''
  if (/^\d{17}[\dXx]$/.test(text)) {
    digits = text.slice(6, 14)
  } else if (/^\d{15}$/.test(text)) {
    digits = `19${text.slice(6, 12)}`
  } else {
    return ''
  }
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return ''
  }
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(day).padStart(2, '0')
  return `${year}-${paddedMonth}-${paddedDay}`
}

export const toProfileNumberString = (value?: number | null) =>
  value === null || value === undefined ? '' : String(value)

export const buildChineseProfileForm = (profile?: ChineseProfile | null): ChineseProfileForm => ({
  frenchName: profile?.frenchName ?? '',
  idNumber: profile?.idNumber ?? '',
  passportNumber: profile?.passportNumber ?? '',
  educationAndMajor: profile?.educationAndMajor ?? '',
  certifications: profile?.certifications ?? [],
  domesticMobile: profile?.domesticMobile ?? '',
  emergencyContactName: profile?.emergencyContactName ?? '',
  emergencyContactPhone: profile?.emergencyContactPhone ?? '',
  redBookValidYears: toProfileNumberString(profile?.redBookValidYears ?? null),
  cumulativeAbroadYears: toProfileNumberString(profile?.cumulativeAbroadYears ?? null),
  birthplace: profile?.birthplace ?? '',
  residenceInChina: profile?.residenceInChina ?? '',
  medicalHistory: profile?.medicalHistory ?? '',
  healthStatus: profile?.healthStatus ?? '',
})

export const buildExpatProfileForm = (profile?: ExpatProfile | null): ExpatProfileForm => ({
  team: profile?.team ?? '',
  contractNumber: profile?.contractNumber ?? '',
  contractType: profile?.contractType ?? '',
  salaryCategory: profile?.salaryCategory ?? '',
  prime: profile?.prime ?? '',
  baseSalaryAmount: profile?.baseSalaryAmount ?? '',
  baseSalaryUnit: profile?.baseSalaryUnit ?? '',
  netMonthlyAmount: profile?.netMonthlyAmount ?? '',
  netMonthlyUnit: profile?.netMonthlyUnit === 'MONTH' ? 'MONTH' : '',
  maritalStatus: profile?.maritalStatus ?? '',
  childrenCount:
    profile?.childrenCount === null || profile?.childrenCount === undefined
      ? ''
      : String(profile.childrenCount),
  cnpsNumber: profile?.cnpsNumber ?? '',
  cnpsDeclarationCode: profile?.cnpsDeclarationCode ?? '',
  provenance: profile?.provenance ?? '',
  emergencyContactName: profile?.emergencyContactName ?? '',
  emergencyContactPhone: profile?.emergencyContactPhone ?? '',
})
