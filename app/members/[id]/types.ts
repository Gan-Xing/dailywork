import type { EmploymentStatus } from '@/lib/i18n/members'

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
  chineseSupervisorId?: number | null
  chineseSupervisor?: {
    id: number
    name: string | null
    username: string
    chineseProfile?: { frenchName: string | null } | null
  } | null
  contractNumber: string | null
  contractType: 'CTJ' | 'CDD' | null
  contractStartDate: string | null
  contractEndDate: string | null
  salaryCategory: string | null
  prime: string | null
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
}

export type Member = {
  id: number
  name: string | null
  username: string
  gender: string | null
  nationality: string | null
  phones: string[]
  tags: string[]
  joinDate: string | null
  birthDate: string | null
  terminationDate: string | null
  terminationReason: string | null
  position: string | null
  employmentStatus: EmploymentStatus
  roles: { id: number; name: string }[]
  project?: {
    id: number
    name: string
    code: string | null
    isActive: boolean
  } | null
  chineseProfile?: ChineseProfile | null
  expatProfile?: ExpatProfile | null
}

export type Role = {
  id: number
  name: string
}

export type MemberOption = {
  id: number
  username: string
  name?: string | null
  nationality: string | null
  chineseProfile?: {
    frenchName?: string | null
  } | null
  expatProfile?: {
    team?: string | null
  } | null
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
  chineseSupervisorId: string
  contractNumber: string
  contractType: '' | 'CTJ' | 'CDD'
  contractStartDate: string
  contractEndDate: string
  salaryCategory: string
  prime: string
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

export type FormState = {
  username: string
  password: string
  name: string
  gender: string
  nationality: string
  phones: string[]
  tags: string[]
  joinDate: string
  birthDate: string
  terminationDate: string
  terminationReason: string
  position: string
  employmentStatus: EmploymentStatus
  roleIds: number[]
  skipChangeHistory: boolean
  projectId: string
  chineseProfile: ChineseProfileForm
  expatProfile: ExpatProfileForm
}
