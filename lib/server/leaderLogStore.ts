import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DATE_KEY_REGEX } from '@/lib/reportUtils'
import { formatSupervisorLabel } from '@/lib/members/utils'

export const LEADER_ROLE_NAME = '施工负责人'

export type LeaderLogItem = {
  id: number
  date: string
  supervisorId: number
  supervisorName: string
  contentRaw: string
  photoCount: number
  createdAt: string
  updatedAt: string
}

export type LeaderUserItem = {
  id: number
  username: string
  name: string
  frenchName: string | null
  label: string
}

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/

const formatDateKey = (value: Date) => value.toISOString().split('T')[0]

const toDateTime = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`)

const toMonthRange = (monthKey: string) => {
  if (!MONTH_KEY_REGEX.test(monthKey)) {
    throw new Error('Invalid month key')
  }
  const [year, month] = monthKey.split('-').map((item) => Number(item))
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

const mapLeaderLog = (record: {
  id: number
  logDate: Date
  supervisorId: number
  supervisorName: string
  contentRaw: string
  createdAt: Date
  updatedAt: Date
}): LeaderLogItem => ({
  id: record.id,
  date: formatDateKey(record.logDate),
  supervisorId: record.supervisorId,
  supervisorName: record.supervisorName,
  contentRaw: record.contentRaw,
  photoCount: 0,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

const selectLeaderLog = {
  id: true,
  logDate: true,
  supervisorId: true,
  supervisorName: true,
  contentRaw: true,
  createdAt: true,
  updatedAt: true,
}

const listLeaderLogPhotoCounts = async (logIds: number[]) => {
  if (logIds.length === 0) return new Map<string, number>()
  const links = await prisma.fileAssetLink.findMany({
    where: {
      entityType: 'leader-log',
      entityId: { in: logIds.map((id) => String(id)) },
      file: { category: 'site-photo' },
    },
    select: { entityId: true },
  })
  const counts = new Map<string, number>()
  links.forEach((link) => {
    counts.set(link.entityId, (counts.get(link.entityId) ?? 0) + 1)
  })
  return counts
}

const attachPhotoCounts = async (logs: LeaderLogItem[]) => {
  if (!logs.length) return logs
  const counts = await listLeaderLogPhotoCounts(logs.map((log) => log.id))
  return logs.map((log) => ({
    ...log,
    photoCount: counts.get(String(log.id)) ?? 0,
  }))
}

export const hasLeaderLogPhotos = async (logId: number) => {
  const count = await prisma.fileAssetLink.count({
    where: {
      entityType: 'leader-log',
      entityId: String(logId),
      file: { category: 'site-photo' },
    },
  })
  return count > 0
}

const fetchLeaderUser = async (supervisorId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: {
      id: true,
      username: true,
      name: true,
      chineseProfile: { select: { frenchName: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  })
  if (!user) return null
  const hasLeaderRole = user.roles.some((entry) => entry.role.name === LEADER_ROLE_NAME)
  if (!hasLeaderRole) return null
  const label =
    formatSupervisorLabel({
      name: user.name,
      frenchName: user.chineseProfile?.frenchName ?? null,
      username: user.username,
    }) || user.username
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    frenchName: user.chineseProfile?.frenchName ?? null,
    label,
  }
}

export const listLeaderUsers = async () => {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: { name: LEADER_ROLE_NAME } } } },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      name: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    name: user.name,
    frenchName: user.chineseProfile?.frenchName ?? null,
    label:
      formatSupervisorLabel({
        name: user.name,
        frenchName: user.chineseProfile?.frenchName ?? null,
        username: user.username,
      }) || user.username,
  }))
}

export const listLeaderLogsForDate = async (dateKey: string, supervisorId?: number) => {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error('Invalid date key')
  }
  const hasSupervisor = Number.isFinite(supervisorId) && (supervisorId as number) > 0
  const records = await prisma.$queryRaw<
    Array<{
      id: number
      logDate: Date
      supervisorId: number
      supervisorName: string
      contentRaw: string
      createdAt: Date
      updatedAt: Date
    }>
  >`
    SELECT
      id,
      "logDate",
      "supervisorId",
      "supervisorName",
      "contentRaw",
      "createdAt",
      "updatedAt"
    FROM "LeaderDailyLog"
    WHERE to_char("logDate", 'YYYY-MM-DD') = ${dateKey}
    ${hasSupervisor ? Prisma.sql`AND "supervisorId" = ${supervisorId}` : Prisma.empty}
    ORDER BY "supervisorName" ASC
  `
  const logs = records.map((record) => mapLeaderLog(record))
  return attachPhotoCounts(logs)
}

export const listLeaderLogDatesForMonth = async (monthKey: string, supervisorId?: number) => {
  const { start, end } = toMonthRange(monthKey)
  const hasSupervisor = Number.isFinite(supervisorId) && (supervisorId as number) > 0
  const records = await prisma.$queryRaw<Array<{ logDate: string }>>`
    SELECT DISTINCT to_char(log."logDate", 'YYYY-MM-DD') AS "logDate"
    FROM "LeaderDailyLog" log
    WHERE log."logDate" >= ${start} AND log."logDate" < ${end}
      AND (
        btrim(log."contentRaw") <> ''
        OR EXISTS (
          SELECT 1
          FROM "FileAssetLink" link
          JOIN "FileAsset" file ON file."id" = link."fileId"
          WHERE link."entityType" = 'leader-log'
            AND link."entityId" = CAST(log."id" AS TEXT)
            AND file."category" = 'site-photo'
        )
      )
      ${hasSupervisor ? Prisma.sql`AND log."supervisorId" = ${supervisorId}` : Prisma.empty}
  `
  return records.map((record) => record.logDate)
}

export const listRecentLeaderLogs = async (limit = 5, supervisorId?: number) => {
  const hasSupervisor = Number.isFinite(supervisorId) && (supervisorId as number) > 0
  const records = await prisma.$queryRaw<
    Array<{
      id: number
      logDate: Date
      supervisorId: number
      supervisorName: string
      contentRaw: string
      createdAt: Date
      updatedAt: Date
    }>
  >`
    SELECT
      log."id",
      log."logDate",
      log."supervisorId",
      log."supervisorName",
      log."contentRaw",
      log."createdAt",
      log."updatedAt"
    FROM "LeaderDailyLog" log
    WHERE (
      btrim(log."contentRaw") <> ''
      OR EXISTS (
        SELECT 1
        FROM "FileAssetLink" link
        JOIN "FileAsset" file ON file."id" = link."fileId"
        WHERE link."entityType" = 'leader-log'
          AND link."entityId" = CAST(log."id" AS TEXT)
          AND file."category" = 'site-photo'
      )
    )
    ${hasSupervisor ? Prisma.sql`AND log."supervisorId" = ${supervisorId}` : Prisma.empty}
    ORDER BY log."updatedAt" DESC
    LIMIT ${limit}
  `
  const logs = records.map((record) => mapLeaderLog(record))
  return attachPhotoCounts(logs)
}

export const getLeaderLogById = async (id: number) => {
  const record = await prisma.leaderDailyLog.findUnique({
    where: { id },
    select: selectLeaderLog,
  })
  if (!record) return null
  const log = mapLeaderLog(record)
  const withCounts = await attachPhotoCounts([log])
  return withCounts[0] ?? log
}

export const createLeaderLog = async (input: {
  dateKey: string
  supervisorId: number
  contentRaw: string
  userId?: number | null
}) => {
  if (!DATE_KEY_REGEX.test(input.dateKey)) {
    throw new Error('Invalid date key')
  }
  if (!Number.isFinite(input.supervisorId)) {
    throw new Error('Invalid supervisor')
  }
  const supervisor = await fetchLeaderUser(input.supervisorId)
  if (!supervisor) {
    throw new Error('Leader not found')
  }

  const record = await prisma.leaderDailyLog.create({
    data: {
      logDate: toDateTime(input.dateKey),
      supervisorId: supervisor.id,
      supervisorName: supervisor.label,
      contentRaw: input.contentRaw,
      createdById: input.userId ?? undefined,
      updatedById: input.userId ?? undefined,
    },
    select: selectLeaderLog,
  })
  return mapLeaderLog(record)
}

export const updateLeaderLog = async (input: {
  id: number
  contentRaw: string
  userId?: number | null
}) => {
  const record = await prisma.leaderDailyLog.update({
    where: { id: input.id },
    data: {
      contentRaw: input.contentRaw,
      updatedById: input.userId ?? undefined,
    },
    select: selectLeaderLog,
  })
  return mapLeaderLog(record)
}

export const deleteLeaderLog = async (input: { id: number }) => {
  await prisma.leaderDailyLog.delete({
    where: { id: input.id },
  })
}
