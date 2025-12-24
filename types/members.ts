import { type EmploymentStatus } from '@/lib/i18n/members'

export type PermissionStatus = 'ACTIVE' | 'ARCHIVED'

export type ChineseProfile = {
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

export type ExpatProfile = {
  team: string | null
  contractNumber: string | null
  contractType: 'CTJ' | 'CDD' | null
  salaryCategory: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: 'MONTH' | 'HOUR' | null
  netMonthlyAmount: string | null
  netMonthlyUnit: 'MONTH' | 'HOUR' | null
  maritalStatus: string | null
  childrenCount: number | null
  cnpsNumber: string | null
  cnpsDeclarationCode: string | null
  provenance: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  createdAt?: string
  updatedAt?: string
}

export type Member = {
  id: number
  name: string | null
  username: string
  gender: string | null
  nationality: string | null
  phones: string[]
  joinDate: string | null
  birthDate: string | null
  terminationDate: string | null
  terminationReason: string | null
  position: string | null
  employmentStatus: EmploymentStatus
  roles: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
  chineseProfile?: ChineseProfile | null
  expatProfile?: ExpatProfile | null
}

export type Role = {
  id: number
  name: string
  permissions: { id: number; code: string; name: string; status?: PermissionStatus }[]
}

export type Permission = {
  id: number
  code: string
  name: string
  status: PermissionStatus
}

export type ChineseProfileForm = {
  frenchName: string
  idNumber: string
  passportNumber: string
  educationAndMajor: string
  certifications: string[]
  domesticMobile: string
  emergencyContactName: string
  emergencyContactPhone: string
  redBookValidYears: string
  cumulativeAbroadYears: string
  birthplace: string
  residenceInChina: string
  medicalHistory: string
  healthStatus: string
}

export type ExpatProfileForm = {
  team: string
  contractNumber: string
  contractType: '' | 'CTJ' | 'CDD'
  salaryCategory: string
  baseSalaryAmount: string
  baseSalaryUnit: '' | 'MONTH' | 'HOUR'
  netMonthlyAmount: string
  netMonthlyUnit: '' | 'MONTH'
  maritalStatus: string
  childrenCount: string
  cnpsNumber: string
  cnpsDeclarationCode: string
  provenance: string
  emergencyContactName: string
  emergencyContactPhone: string
}

export type MemberFormState = {
  id?: number
  username: string
  password: string
  name: string
  gender: string
  nationality: string
  phones: string[]
  joinDate: string
  birthDate: string
  terminationDate: string
  terminationReason: string
  position: string
  employmentStatus: EmploymentStatus
  roleIds: number[]
  chineseProfile: ChineseProfileForm
  expatProfile: ExpatProfileForm
}
