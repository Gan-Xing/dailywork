import type { ChineseProfileForm, ExpatProfileForm } from './types'

export const emptyChineseProfile: ChineseProfileForm = {
  frenchName: '',
  idNumber: '',
  passportNumber: '',
  educationAndMajor: '',
  certifications: [],
  domesticMobile: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  redBookValidYears: '',
  cumulativeAbroadYears: '',
  birthplace: '',
  residenceInChina: '',
  medicalHistory: '',
  healthStatus: '',
}

export const emptyExpatProfile: ExpatProfileForm = {
  team: '',
  chineseSupervisorId: '',
  contractNumber: '',
  contractType: '',
  salaryCategory: '',
  prime: '',
  baseSalaryAmount: '',
  baseSalaryUnit: '',
  netMonthlyAmount: '',
  netMonthlyUnit: '',
  maritalStatus: '',
  childrenCount: '',
  cnpsNumber: '',
  cnpsDeclarationCode: '',
  provenance: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
}
