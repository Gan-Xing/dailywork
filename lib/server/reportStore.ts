import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { DailyReport, MaterialStock } from '@/lib/reportState'
import {
  cloneReport,
  createReportForDate,
  DATE_KEY_REGEX,
  clonePersonnelMap,
  cloneExpatriateCount,
  inheritPreviousMaterials,
  normalizeReportForDate,
  recalcReportMaterials,
  recalcAllMaterials,
} from '@/lib/reportUtils'

export interface ReportSummary {
  date: string
  createdAt: string
  updatedAt: string
}

interface ReportRecord {
  id: number
  reportDate: Date
  payload: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}

const reportSelection = {
  id: true,
  reportDate: true,
  payload: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DailyReportSelect

const formatDateKey = (value: Date) => value.toISOString().split('T')[0]

const toDateTime = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`)

const clonePayload = (payload: Prisma.JsonValue | null | undefined): DailyReport => {
  if (!payload) {
    throw new Error('Missing report payload')
  }
  return cloneReport(payload as unknown as DailyReport)
}

const toJsonPayload = (report: DailyReport): Prisma.JsonObject =>
  JSON.parse(JSON.stringify(report)) as Prisma.JsonObject

const buildMonthRange = (monthKey: string) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return null
  }
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) - 1
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return null
  }
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  return { start, end }
}

export const listReports = async (options: { month?: string | null; limit?: number | null } = {}) => {
  const where: Prisma.DailyReportWhereInput = {}
  if (options.month) {
    const range = buildMonthRange(options.month)
    if (!range) {
      throw new Error('Invalid month parameter')
    }
    where.reportDate = {
      gte: range.start,
      lt: range.end,
    }
  }

  const take = options.limit && options.limit > 0 ? Math.min(options.limit, 50) : undefined

  const records = await prisma.dailyReport.findMany({
    where,
    orderBy: { reportDate: 'desc' },
    take,
    select: {
      reportDate: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return records.map<ReportSummary>((record) => ({
    date: formatDateKey(record.reportDate),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }))
}

export const getReportByDate = async (dateKey: string) => {
  const result = await prepareReportForDate(dateKey)
  return result.report
}

export const prepareReportForDate = async (dateKey: string) => {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error('Invalid date parameter')
  }

  const targetDate = toDateTime(dateKey)
  const record = await prisma.dailyReport.findUnique({
    where: { reportDate: targetDate },
    select: reportSelection,
  })

  if (record) {
    const report = mapRecordToReport(record, dateKey)
    return {
      report,
      exists: true,
      previousDate: await findPreviousDateKey(dateKey),
    }
  }

  const previousRecord = await prisma.dailyReport.findFirst({
    where: { reportDate: { lt: targetDate } },
    orderBy: { reportDate: 'desc' },
    select: reportSelection,
  })

  let draft = createReportForDate(dateKey)
  draft = recalcReportMaterials(draft)

  if (previousRecord) {
    const previousReport = mapRecordToReport(previousRecord, formatDateKey(previousRecord.reportDate))
    draft = {
      ...draft,
      materials: inheritPreviousMaterials(draft.materials, previousReport.materials),
      personnel: clonePersonnelMap(previousReport.personnel),
      expatriate: cloneExpatriateCount(previousReport.expatriate),
    }
  }

  return {
    report: draft,
    exists: false,
    previousDate: previousRecord ? formatDateKey(previousRecord.reportDate) : null,
  }
}

export const saveReportForDate = async (dateKey: string, report: DailyReport) => {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error('Invalid date parameter')
  }

  const result = await prisma.$transaction(async (tx) => {
    const normalized = normalizeReportForDate(cloneReport(report), dateKey)
    normalized.materials = recalcAllMaterials(normalized.materials)

    const saved = await tx.dailyReport.upsert({
      where: { reportDate: toDateTime(dateKey) },
      create: {
        reportDate: toDateTime(dateKey),
        payload: toJsonPayload(normalized),
      },
      update: {
        payload: toJsonPayload(normalized),
      },
    })

    await cascadeMaterialAdjustments(tx, dateKey, normalized.materials)

    return {
      report: normalized,
      summary: {
        date: formatDateKey(saved.reportDate),
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      } satisfies ReportSummary,
    }
  })

  return result
}

const mapRecordToReport = (record: ReportRecord, dateKey: string): DailyReport => {
  const report = recalcReportMaterials(clonePayload(record.payload))
  return normalizeReportForDate(report, dateKey)
}

const findPreviousDateKey = async (dateKey: string) => {
  const targetDate = toDateTime(dateKey)
  const previous = await prisma.dailyReport.findFirst({
    where: { reportDate: { lt: targetDate } },
    orderBy: { reportDate: 'desc' },
    select: { reportDate: true },
  })
  return previous ? formatDateKey(previous.reportDate) : null
}

const cascadeMaterialAdjustments = async (
  tx: Prisma.TransactionClient,
  startDateKey: string,
  referenceMaterials: Record<string, MaterialStock>,
) => {
  const subsequent = await tx.dailyReport.findMany({
    where: { reportDate: { gt: toDateTime(startDateKey) } },
    orderBy: { reportDate: 'asc' },
    select: reportSelection,
  })

  let previousMaterials = referenceMaterials

  for (const record of subsequent) {
    const dateKey = formatDateKey(record.reportDate)
    const report = mapRecordToReport(record as ReportRecord, dateKey)
    report.materials = inheritPreviousMaterials(report.materials, previousMaterials)
    previousMaterials = report.materials
    await tx.dailyReport.update({
      where: { id: record.id },
      data: { payload: toJsonPayload(report) },
    })
  }
}
