import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

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

export const canViewPayroll = async () =>
  (await hasPermission('payroll:view')) || (await hasPermission('payroll:manage'))

export const canManagePayroll = async () => await hasPermission('payroll:manage')

export const ensurePayrollRuns = async (year: number, month: number) => {
  const existing = await prisma.payrollRun.findMany({
    where: { year, month },
    orderBy: { sequence: 'asc' },
  })
  const existingSequences = new Set(existing.map((run) => run.sequence))
  const [firstDate, secondDate] = getDefaultRunDates(year, month)
  const createPayload: Array<{ sequence: number; payoutDate: Date }> = []
  if (!existingSequences.has(1)) {
    createPayload.push({ sequence: 1, payoutDate: firstDate })
  }
  if (!existingSequences.has(2)) {
    createPayload.push({ sequence: 2, payoutDate: secondDate })
  }
  if (createPayload.length > 0) {
    try {
      await prisma.payrollRun.createMany({
        data: createPayload.map((item) => ({
          year,
          month,
          sequence: item.sequence,
          payoutDate: item.payoutDate,
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
