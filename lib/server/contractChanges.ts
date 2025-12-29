import type { ContractType, Prisma, SalaryUnit } from '@prisma/client'

import { formatSupervisorLabel } from '@/lib/members/utils'

type ExpatContractSnapshot = {
  chineseSupervisorId?: number | null
  contractNumber?: string | null
  contractType?: ContractType | null
  salaryCategory?: string | null
  baseSalaryAmount?: Prisma.Decimal | string | null
  baseSalaryUnit?: SalaryUnit | null
  prime?: Prisma.Decimal | string | null
  contractStartDate?: Date | null
  contractEndDate?: Date | null
}

type InitialContractChangeParams = {
  userId: number
  expatProfile: ExpatContractSnapshot | null | undefined
  joinDate?: Date | null
  fallbackChangeDate?: Date | null
  reason?: string | null
}

const addOneYear = (date: Date) => {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

const resolveBaselineChangeDate = (
  expatProfile: ExpatContractSnapshot,
  joinDate: Date | null,
  fallbackChangeDate: Date | null,
) => {
  const candidates: Date[] = []
  if (expatProfile.contractStartDate) candidates.push(expatProfile.contractStartDate)
  if (joinDate) candidates.push(joinDate)
  if (fallbackChangeDate) candidates.push(fallbackChangeDate)
  if (candidates.length === 0) return new Date()
  const earliest = Math.min(...candidates.map((value) => value.getTime()))
  return new Date(earliest)
}

const resolveSupervisorSnapshot = async (
  tx: Prisma.TransactionClient,
  supervisorId: number | null,
) => {
  if (!supervisorId) return { id: null, name: null }
  const supervisor = await tx.user.findUnique({
    where: { id: supervisorId },
    select: {
      id: true,
      username: true,
      name: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  if (!supervisor) return { id: null, name: null }
  const label =
    formatSupervisorLabel({
      name: supervisor.name,
      frenchName: supervisor.chineseProfile?.frenchName ?? null,
      username: supervisor.username,
    }) ?? null
  return { id: supervisor.id, name: label }
}

export const createInitialContractChangeIfMissing = async (
  tx: Prisma.TransactionClient,
  { userId, expatProfile, joinDate = null, fallbackChangeDate = null, reason = null }: InitialContractChangeParams,
) => {
  if (!expatProfile) return false
  const existing = await tx.userContractChange.findFirst({
    where: { userId },
    select: { id: true },
  })
  if (existing) return false

  const supervisor = await resolveSupervisorSnapshot(
    tx,
    expatProfile.chineseSupervisorId ?? null,
  )
  const changeDate = resolveBaselineChangeDate(
    expatProfile,
    joinDate,
    fallbackChangeDate,
  )
  const startDate = expatProfile.contractStartDate ?? changeDate
  const endDate = expatProfile.contractEndDate ?? addOneYear(startDate)

  await tx.userContractChange.create({
    data: {
      userId,
      chineseSupervisorId: supervisor.id,
      chineseSupervisorName: supervisor.name,
      contractNumber: expatProfile.contractNumber ?? null,
      contractType: expatProfile.contractType ?? null,
      salaryCategory: expatProfile.salaryCategory ?? null,
      salaryAmount: expatProfile.baseSalaryAmount ?? null,
      salaryUnit: expatProfile.baseSalaryUnit ?? null,
      prime: expatProfile.prime ?? null,
      startDate,
      endDate,
      changeDate,
      reason,
    },
  })

  return true
}
