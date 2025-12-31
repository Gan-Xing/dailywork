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
  position?: string | null
}

const resolveLatestContractChange = async (tx: Prisma.TransactionClient, userId: number) => {
  return tx.userContractChange.findFirst({
    where: { userId },
    orderBy: [{ startDate: 'desc' }, { changeDate: 'desc' }, { id: 'desc' }],
  })
}

const resolveEarliestContractStart = (
  changes: Array<{ startDate: Date | null; changeDate: Date }>,
) => {
  let earliest: Date | null = null
  for (const change of changes) {
    const candidate = change.startDate ?? change.changeDate
    if (!candidate) continue
    if (!earliest || candidate.getTime() < earliest.getTime()) {
      earliest = candidate
    }
  }
  return earliest
}

export const applyLatestContractSnapshot = async (
  tx: Prisma.TransactionClient,
  userId: number,
) => {
  const latest = await resolveLatestContractChange(tx, userId)
  if (!latest) return null
  await tx.userExpatProfile.upsert({
    where: { userId },
    create: {
      userId,
      chineseSupervisorId: latest.chineseSupervisorId,
      contractNumber: latest.contractNumber,
      contractType: latest.contractType,
      salaryCategory: latest.salaryCategory,
      prime: latest.prime,
      baseSalaryAmount: latest.salaryAmount,
      baseSalaryUnit: latest.salaryUnit,
      contractStartDate: latest.startDate,
      contractEndDate: latest.endDate,
    },
    update: {
      chineseSupervisorId: latest.chineseSupervisorId,
      contractNumber: latest.contractNumber,
      contractType: latest.contractType,
      salaryCategory: latest.salaryCategory,
      prime: latest.prime,
      baseSalaryAmount: latest.salaryAmount,
      baseSalaryUnit: latest.salaryUnit,
      contractStartDate: latest.startDate,
      contractEndDate: latest.endDate,
    },
  })
  return latest
}

export const syncJoinDateFromContracts = async (
  tx: Prisma.TransactionClient,
  userId: number,
) => {
  const changes = await tx.userContractChange.findMany({
    where: { userId },
    select: { startDate: true, changeDate: true },
  })
  const earliest = resolveEarliestContractStart(changes)
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { joinDate: true },
  })
  if (!user) return null
  if (earliest) {
    const earliestTime = earliest.getTime()
    if (!user.joinDate || user.joinDate.getTime() !== earliestTime) {
      await tx.user.update({
        where: { id: userId },
        data: { joinDate: earliest },
      })
      return earliest
    }
  }
  return user.joinDate ?? earliest
}

export const syncPositionFromContracts = async (
  tx: Prisma.TransactionClient,
  userId: number,
) => {
  const latest = await resolveLatestContractChange(tx, userId)
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { position: true },
  })
  if (!user) return null
  const latestPosition = latest?.position ?? null
  if (latestPosition === null) {
    return user.position ?? null
  }
  if (user.position !== latestPosition) {
    await tx.user.update({
      where: { id: userId },
      data: { position: latestPosition },
    })
  }
  return latestPosition
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
  {
    userId,
    expatProfile,
    joinDate = null,
    fallbackChangeDate = null,
    reason = null,
    position = null,
  }: InitialContractChangeParams,
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
      position,
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
