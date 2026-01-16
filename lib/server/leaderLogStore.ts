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

export const listLeaderLogsForDate = async (dateKey: string) => {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error('Invalid date key')
  }
  const records = await prisma.leaderDailyLog.findMany({
    where: { logDate: toDateTime(dateKey) },
    orderBy: [{ supervisorName: 'asc' }],
    select: selectLeaderLog,
  })
  return records.map((record) => mapLeaderLog(record))
}

export const listLeaderLogDatesForMonth = async (monthKey: string) => {
  const { start, end } = toMonthRange(monthKey)
  const records = await prisma.leaderDailyLog.findMany({
    where: { logDate: { gte: start, lt: end } },
    select: { logDate: true },
    distinct: ['logDate'],
  })
  return records.map((record) => formatDateKey(record.logDate))
}

export const listRecentLeaderLogs = async (limit = 5) => {
  const records = await prisma.leaderDailyLog.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: selectLeaderLog,
  })
  return records.map((record) => mapLeaderLog(record))
}

export const getLeaderLogById = async (id: number) => {
  const record = await prisma.leaderDailyLog.findUnique({
    where: { id },
    select: selectLeaderLog,
  })
  return record ? mapLeaderLog(record) : null
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
