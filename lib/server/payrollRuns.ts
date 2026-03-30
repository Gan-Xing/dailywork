import type { ContractType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

type PayrollDbClient = Prisma.TransactionClient | typeof prisma

type PayrollContractChangeEntry = {
  contractNumber: string | null
  contractType: ContractType | null
  startDate: Date | null
  endDate: Date | null
  changeDate: Date
}

type PayrollContractChangeRecord = PayrollContractChangeEntry & {
  userId: number
}

export type PayrollContractSnapshot = {
  contractNumber: string | null
  contractType: ContractType | null
}

const toUtcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

const getLastFriday = (year: number, month: number) => {
  const date = new Date(Date.UTC(year, month, 0))
  while (date.getUTCDay() !== 5) {
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return date
}

export const getDefaultRunDates = (year: number, month: number) => {
  const first = toUtcDate(year, month, 15)
  const second = getLastFriday(year, month)
  return [first, second]
}

const getDefaultAttendanceCutoffDates = (year: number, month: number) => {
  const first = toUtcDate(year, month, 5)
  const second = toUtcDate(year, month, 20)
  return [first, second]
}

export const canViewPayroll = async () =>
  (await hasPermission('payroll:view')) || (await hasPermission('payroll:manage'))

export const canManagePayroll = async () => await hasPermission('payroll:manage')

export const resolvePayrollContractSnapshot = (
  changes: PayrollContractChangeEntry[],
  cutoffDate: Date,
): PayrollContractSnapshot | null => {
  if (changes.length === 0) return null
  const cutoffTime = cutoffDate.getTime()
  const byPeriod = changes
    .filter((change) => change.startDate && change.startDate.getTime() <= cutoffTime)
    .filter((change) => !change.endDate || change.endDate.getTime() >= cutoffTime)
    .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))
  const match = byPeriod[0]
  if (match) {
    return {
      contractNumber: match.contractNumber ?? null,
      contractType: match.contractType ?? null,
    }
  }
  const byChangeDate = changes
    .filter((change) => change.changeDate.getTime() <= cutoffTime)
    .sort((a, b) => b.changeDate.getTime() - a.changeDate.getTime())
  const fallback = byChangeDate[0]
  if (!fallback) return null
  return {
    contractNumber: fallback.contractNumber ?? null,
    contractType: fallback.contractType ?? null,
  }
}

export const listPayrollContractSnapshotsForUsers = async (
  db: PayrollDbClient,
  userIds: number[],
  cutoffDate: Date,
) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  const snapshots = new Map<number, PayrollContractSnapshot>()
  if (uniqueUserIds.length === 0) return snapshots

  const [expatProfiles, contractChanges] = await Promise.all([
    db.userExpatProfile.findMany({
      where: { userId: { in: uniqueUserIds } },
      select: {
        userId: true,
        contractNumber: true,
        contractType: true,
      },
    }),
    db.userContractChange.findMany({
      where: { userId: { in: uniqueUserIds } },
      select: {
        userId: true,
        contractNumber: true,
        contractType: true,
        startDate: true,
        endDate: true,
        changeDate: true,
      },
    }),
  ])

  const changesByUser = new Map<number, PayrollContractChangeEntry[]>()
  contractChanges.forEach((change: PayrollContractChangeRecord) => {
    const list = changesByUser.get(change.userId) ?? []
    list.push(change)
    changesByUser.set(change.userId, list)
  })

  const profilesByUser = new Map(expatProfiles.map((profile) => [profile.userId, profile]))
  uniqueUserIds.forEach((userId) => {
    const profile = profilesByUser.get(userId)
    const snapshot = resolvePayrollContractSnapshot(
      changesByUser.get(userId) ?? [],
      cutoffDate,
    )
    if (!snapshot && !profile) return
    snapshots.set(userId, {
      contractNumber: snapshot?.contractNumber ?? profile?.contractNumber ?? null,
      contractType: snapshot?.contractType ?? profile?.contractType ?? null,
    })
  })

  return snapshots
}

export const ensurePayrollRuns = async (year: number, month: number) => {
  const existing = await prisma.payrollRun.findMany({
    where: { year, month },
    orderBy: { sequence: 'asc' },
  })
  const existingSequences = new Set(existing.map((run) => run.sequence))
  const [firstDate, secondDate] = getDefaultRunDates(year, month)
  const [firstCutoff, secondCutoff] = getDefaultAttendanceCutoffDates(year, month)
  const createPayload: Array<{
    sequence: number
    payoutDate: Date
    attendanceCutoffDate: Date
  }> = []
  if (!existingSequences.has(1)) {
    createPayload.push({
      sequence: 1,
      payoutDate: firstDate,
      attendanceCutoffDate: firstCutoff,
    })
  }
  if (!existingSequences.has(2)) {
    createPayload.push({
      sequence: 2,
      payoutDate: secondDate,
      attendanceCutoffDate: secondCutoff,
    })
  }
  if (createPayload.length > 0) {
    try {
      await prisma.payrollRun.createMany({
        data: createPayload.map((item) => ({
          year,
          month,
          sequence: item.sequence,
          payoutDate: item.payoutDate,
          attendanceCutoffDate: item.attendanceCutoffDate,
        })),
        skipDuplicates: true,
      })
    } catch {
      // Ignore conflicts; we will re-fetch below.
    }
  }
  return prisma.payrollRun.findMany({
    where: { year, month },
    orderBy: { sequence: 'asc' },
  })
}

export const parseYearMonth = (params: { year?: string | null; month?: string | null }) => {
  const now = new Date()
  const fallbackYear = now.getUTCFullYear()
  const fallbackMonth = now.getUTCMonth() + 1
  const year = Number(params.year ?? fallbackYear)
  const month = Number(params.month ?? fallbackMonth)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { year: fallbackYear, month: fallbackMonth, isValid: false }
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { year: fallbackYear, month: fallbackMonth, isValid: false }
  }
  return { year, month, isValid: true }
}
