export type ContractChange = {
  id: number
  userId: number
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  contractNumber: string | null
  contractType: 'CTJ' | 'CDD' | null
  salaryCategory: string | null
  salaryAmount: string | null
  salaryUnit: 'MONTH' | 'HOUR' | null
  prime: string | null
  startDate: string | null
  endDate: string | null
  changeDate: string
  reason: string | null
  createdAt: string
  updatedAt: string
}

export type PayrollChange = {
  id: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  salaryCategory: string | null
  salaryAmount: string | null
  salaryUnit: 'MONTH' | 'HOUR' | null
  prime: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: 'MONTH' | 'HOUR' | null
  netMonthlyAmount: string | null
  netMonthlyUnit: 'MONTH' | 'HOUR' | null
  changeDate: string
  createdAt: string
  updatedAt: string
}

export type PayrollPayout = {
  id: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  payoutDate: string
  amount: string
  currency: string
  note: string | null
  createdAt: string
  updatedAt: string
}

export type SupervisorOption = {
  value: string
  label: string
}
