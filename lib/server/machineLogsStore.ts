import { Prisma } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey, normalizeText } from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'
import { resolveTeamDefaults } from '@/lib/server/teamSupervisors'
import { listMachineAssets } from '@/lib/server/machineStore'
import type {
  FuelSource,
  MachineDailyLog,
  MachineFuelEvent,
  MachineLogsPageData,
  ProjectOption,
  TeamSupervisorOption,
  UserOption,
} from '@/types/machineLogs'

const assertModels = () => {
  const client = prisma as unknown as Record<string, unknown>
  if (!client.machineDailyLog || !client.machineFuelEvent || !client.fuelSource) {
    throw new Error('Prisma Client 未包含机械日志模型，请先执行 `prisma migrate deploy && prisma generate`')
  }
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export const parseDateKey = (value: string) => {
  if (!DATE_KEY_RE.test(value)) {
    throw new Error('日期格式应为 YYYY-MM-DD')
  }
  return new Date(`${value}T00:00:00.000Z`)
}

const formatDateKey = (value: Date) => value.toISOString().split('T')[0]

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const toNumber = (value: Prisma.Decimal | number | null): number | null => {
  if (value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  return new Prisma.Decimal(value).toNumber()
}

const round2 = (value: number) => Math.round(value * 100) / 100

const toMoney = (value: number | null) => (value == null ? null : round2(value))

const formatUserLabel = (user: { name: string | null; username: string }) => {
  const name = normalizeText(user.name)
  const username = normalizeText(user.username)
  if (name && username) return `${name} / ${username}`
  return name || username
}

const listTeamSupervisors = async (): Promise<TeamSupervisorOption[]> => {
  const bindings = await prisma.teamSupervisor.findMany({
    orderBy: { teamKey: 'asc' },
    include: {
      supervisor: {
        select: {
          id: true,
          username: true,
          name: true,
          chineseProfile: { select: { frenchName: true } },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    },
  })

  return bindings.map((binding) => {
    const label =
      formatSupervisorLabel({
        name: binding.supervisor.name,
        frenchName: binding.supervisor.chineseProfile?.frenchName ?? null,
        username: binding.supervisor.username,
      }) || binding.supervisorName || binding.supervisor.username

    return {
      id: binding.id,
      team: binding.team,
      teamZh: binding.teamZh ?? null,
      teamKey: binding.teamKey,
      supervisorId: binding.supervisorId,
      supervisorLabel: label,
      project: binding.project
        ? {
            id: binding.project.id,
            name: binding.project.name,
            code: binding.project.code,
            isActive: binding.project.isActive,
          }
        : null,
    }
  })
}

const listProjects = async (): Promise<ProjectOption[]> => {
  const projects = await prisma.project.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  })

  return projects
}

const listChineseSupervisors = async (): Promise<UserOption[]> => {
  const users = await prisma.user.findMany({
    where: { nationality: 'china', employmentStatus: 'ACTIVE' },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      name: true,
      nationality: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    name: user.name,
    nationality: user.nationality ?? null,
    label:
      formatSupervisorLabel({
        name: user.name,
        frenchName: user.chineseProfile?.frenchName ?? null,
        username: user.username,
      }) || user.username,
  }))
}

const listOperators = async (): Promise<UserOption[]> => {
  const users = await prisma.user.findMany({
    where: { employmentStatus: 'ACTIVE' },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      name: true,
      nationality: true,
    },
  })

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    name: user.name,
    nationality: user.nationality ?? null,
    label: formatUserLabel({ name: user.name, username: user.username }),
  }))
}

const listFuelSources = async (
  { includeIds }: { includeIds?: number[] } = {},
): Promise<FuelSource[]> => {
  const ids = Array.from(
    new Set((includeIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)),
  )
  const where = ids.length
    ? { OR: [{ isActive: true }, { id: { in: ids } }] }
    : { isActive: true }

  const sources = await prisma.fuelSource.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    include: {
      machine: {
        select: {
          id: true,
          assetNumber: true,
          assetName: true,
          alias: true,
          plateNumber: true,
        },
      },
    },
  })

  return sources.map((source) => ({
    id: source.id,
    type: source.type,
    code: source.code,
    name: source.name,
    machineId: source.machineId ?? null,
    isActive: source.isActive,
    machine: source.machine
      ? {
          id: source.machine.id,
          assetNumber: source.machine.assetNumber,
          assetName: source.machine.assetName,
          alias: source.machine.alias,
          plateNumber: source.machine.plateNumber,
        }
      : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }))
}

const mapFuelEvent = (event: {
  id: number
  dailyLogId: number
  fuelSourceId: number
  amount: Prisma.Decimal
  note: string | null
  createdAt: Date
}): MachineFuelEvent => ({
  id: event.id,
  dailyLogId: event.dailyLogId,
  fuelSourceId: event.fuelSourceId,
  amount: toMoney(toNumber(event.amount)) ?? 0,
  note: event.note,
  createdAt: event.createdAt.toISOString(),
})

const mapDailyLog = (log: {
  id: number
  machineId: number
  logDate: Date
  team: string | null
  teamKey: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  projectId: number | null
  operatorId: number | null
  operatorName: string | null
  workContent: string | null
  fuelRemainingEnd: Prisma.Decimal | null
  dailyDepreciation: Prisma.Decimal | null
  meta: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
  fuelEvents: Array<{
    id: number
    dailyLogId: number
    fuelSourceId: number
    amount: Prisma.Decimal
    note: string | null
    createdAt: Date
  }>
}): MachineDailyLog => ({
  id: log.id,
  machineId: log.machineId,
  logDate: formatDateKey(log.logDate),
  team: log.team,
  teamKey: log.teamKey,
  chineseSupervisorId: log.chineseSupervisorId,
  chineseSupervisorName: log.chineseSupervisorName,
  projectId: log.projectId,
  operatorId: log.operatorId,
  operatorName: log.operatorName,
  workContent: log.workContent,
  fuelRemainingEnd: toMoney(toNumber(log.fuelRemainingEnd)),
  dailyDepreciation: toMoney(toNumber(log.dailyDepreciation)),
  meta: log.meta ?? undefined,
  fuelEvents: log.fuelEvents.map(mapFuelEvent),
  createdAt: log.createdAt.toISOString(),
  updatedAt: log.updatedAt.toISOString(),
})

export async function getMachineLogsPageData(dateKey: string): Promise<MachineLogsPageData> {
  assertModels()

  const start = parseDateKey(dateKey)
  const end = addUtcDays(start, 1)
  const prevStart = addUtcDays(start, -1)
  const prevEnd = start

  const [machines, logs, prevLogs, teamSupervisors, supervisors, operators, projects] = await Promise.all([
    listMachineAssets(),
    prisma.machineDailyLog.findMany({
      where: { logDate: { gte: start, lt: end } },
      orderBy: [{ machineId: 'asc' }, { id: 'asc' }],
      include: { fuelEvents: { orderBy: { id: 'asc' } } },
    }),
    prisma.machineDailyLog.findMany({
      where: { logDate: { gte: prevStart, lt: prevEnd } },
      select: { machineId: true, fuelRemainingEnd: true },
    }),
    listTeamSupervisors(),
    listChineseSupervisors(),
    listOperators(),
    listProjects(),
  ])

  const referencedFuelSourceIds = logs.flatMap((log) => log.fuelEvents.map((event) => event.fuelSourceId))
  const fuelSources = await listFuelSources({ includeIds: referencedFuelSourceIds })

  const prevFuelByMachineId: Record<string, number | null> = {}
  prevLogs.forEach((log) => {
    prevFuelByMachineId[String(log.machineId)] = toMoney(toNumber(log.fuelRemainingEnd))
  })

  return {
    date: dateKey,
    machines,
    logs: logs.map(mapDailyLog),
    prevFuelByMachineId,
    fuelSources,
    options: {
      teamSupervisors,
      supervisors,
      operators,
      projects,
    },
  }
}

export type MachineDailyLogSaveInput = {
  date: string
  machineId: number
  team?: string | null
  chineseSupervisorId?: number | null
  projectId?: number | null
  operatorId?: number | null
  workContent?: string | null
  fuelRemainingEnd?: number | null
  dailyDepreciation?: number | null
  meta?: unknown
  fuelEvents?: Array<{ fuelSourceId: number; amount: number; note?: string | null }>
}

export async function saveMachineDailyLog(
  input: MachineDailyLogSaveInput,
  { updatedById }: { updatedById: number | null },
): Promise<MachineDailyLog> {
  assertModels()

  const machineId = Number(input.machineId)
  if (!Number.isFinite(machineId) || machineId <= 0) {
    throw new Error('machineId 无效')
  }

  const start = parseDateKey(input.date)

  const normalizedTeam = typeof input.team === 'string' ? normalizeText(input.team) : ''
  const team = normalizedTeam || null
  const teamKey = team ? normalizeTeamKey(team) : null

  const defaults = team ? await resolveTeamDefaults(team) : { supervisorId: null, projectId: null }

  const supervisorIdRaw = input.chineseSupervisorId
  const projectIdRaw = input.projectId

  const resolvedSupervisorId =
    supervisorIdRaw === undefined
      ? defaults.supervisorId
      : supervisorIdRaw === null
        ? null
        : Number(supervisorIdRaw)

  const resolvedProjectId =
    projectIdRaw === undefined
      ? defaults.projectId
      : projectIdRaw === null
        ? null
        : Number(projectIdRaw)

  const operatorIdRaw = input.operatorId
  const operatorId =
    operatorIdRaw === undefined ? null : operatorIdRaw === null ? null : Number(operatorIdRaw)

  if (resolvedSupervisorId !== null && resolvedSupervisorId !== undefined && !Number.isFinite(resolvedSupervisorId)) {
    throw new Error('chineseSupervisorId 无效')
  }
  if (resolvedProjectId !== null && resolvedProjectId !== undefined && !Number.isFinite(resolvedProjectId)) {
    throw new Error('projectId 无效')
  }
  if (operatorId !== null && !Number.isFinite(operatorId)) {
    throw new Error('operatorId 无效')
  }

  const safeSupervisorId = resolvedSupervisorId && resolvedSupervisorId > 0 ? resolvedSupervisorId : null
  const safeProjectId = resolvedProjectId && resolvedProjectId > 0 ? resolvedProjectId : null
  const safeOperatorId = operatorId && operatorId > 0 ? operatorId : null

  const fuelRemainingEnd =
    input.fuelRemainingEnd === undefined || input.fuelRemainingEnd === null
      ? null
      : Number(input.fuelRemainingEnd)
  if (fuelRemainingEnd !== null && !Number.isFinite(fuelRemainingEnd)) {
    throw new Error('fuelRemainingEnd 无效')
  }

  const dailyDepreciation =
    input.dailyDepreciation === undefined || input.dailyDepreciation === null
      ? null
      : Number(input.dailyDepreciation)
  if (dailyDepreciation !== null && !Number.isFinite(dailyDepreciation)) {
    throw new Error('dailyDepreciation 无效')
  }

  const workContent = typeof input.workContent === 'string' ? input.workContent.trim() : null

  const fuelEvents = Array.isArray(input.fuelEvents) ? input.fuelEvents : []

  const supervisorSnapshot = safeSupervisorId
    ? await prisma.user.findUnique({
        where: { id: safeSupervisorId },
        select: {
          id: true,
          username: true,
          name: true,
          nationality: true,
          chineseProfile: { select: { frenchName: true } },
        },
      })
    : null

  if (safeSupervisorId && !supervisorSnapshot) {
    throw new Error('中方负责人不存在')
  }

  if (supervisorSnapshot && supervisorSnapshot.nationality !== 'china') {
    throw new Error('中方负责人必须为中国籍成员')
  }

  const operatorSnapshot = safeOperatorId
    ? await prisma.user.findUnique({
        where: { id: safeOperatorId },
        select: { id: true, username: true, name: true },
      })
    : null

  if (safeOperatorId && !operatorSnapshot) {
    throw new Error('绑定人员不存在')
  }

  if (safeProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: safeProjectId },
      select: { id: true },
    })
    if (!project) throw new Error('项目不存在')
  }

  const supervisorName = supervisorSnapshot
    ? formatSupervisorLabel({
        name: supervisorSnapshot.name,
        frenchName: supervisorSnapshot.chineseProfile?.frenchName ?? null,
        username: supervisorSnapshot.username,
      }) || supervisorSnapshot.username
    : null

  const operatorName = operatorSnapshot
    ? formatUserLabel({ name: operatorSnapshot.name, username: operatorSnapshot.username })
    : null

  const fuelSourceIds = Array.from(
    new Set(
      fuelEvents
        .map((event) => Number(event?.fuelSourceId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  if (fuelEvents.length > 0 && fuelSourceIds.length === 0) {
    throw new Error('加油记录缺少来源')
  }

  const sources = fuelSourceIds.length
    ? await prisma.fuelSource.findMany({
        where: { id: { in: fuelSourceIds } },
        select: { id: true, isActive: true },
      })
    : []

  const sourceMap = new Map(sources.map((source) => [source.id, source]))

  fuelEvents.forEach((event, index) => {
    const fuelSourceId = Number(event?.fuelSourceId)
    if (!Number.isFinite(fuelSourceId) || fuelSourceId <= 0) {
      throw new Error(`第 ${index + 1} 条加油记录来源无效`)
    }
    const source = sourceMap.get(fuelSourceId)
    if (!source) {
      throw new Error(`第 ${index + 1} 条加油记录来源不存在`)
    }
    if (!source.isActive) {
      throw new Error(`第 ${index + 1} 条加油记录来源已停用`)
    }

    const amount = Number(event?.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`第 ${index + 1} 条加油量无效`)
    }
  })

  const saved = await prisma.$transaction(async (tx) => {
    const daily = await tx.machineDailyLog.upsert({
      where: { machineId_logDate: { machineId, logDate: start } },
      create: {
        machineId,
        logDate: start,
        team,
        teamKey,
        chineseSupervisorId: safeSupervisorId,
        chineseSupervisorName: supervisorName,
        projectId: safeProjectId,
        operatorId: safeOperatorId,
        operatorName,
        workContent,
        fuelRemainingEnd:
          fuelRemainingEnd == null ? null : new Prisma.Decimal(toMoney(fuelRemainingEnd) ?? 0),
        dailyDepreciation:
          dailyDepreciation == null ? null : new Prisma.Decimal(toMoney(dailyDepreciation) ?? 0),
        meta: (input.meta as Prisma.InputJsonValue) ?? undefined,
        createdById: updatedById ?? null,
        updatedById: updatedById ?? null,
      },
      update: {
        team,
        teamKey,
        chineseSupervisorId: safeSupervisorId,
        chineseSupervisorName: supervisorName,
        projectId: safeProjectId,
        operatorId: safeOperatorId,
        operatorName,
        workContent,
        fuelRemainingEnd:
          fuelRemainingEnd == null ? null : new Prisma.Decimal(toMoney(fuelRemainingEnd) ?? 0),
        dailyDepreciation:
          dailyDepreciation == null ? null : new Prisma.Decimal(toMoney(dailyDepreciation) ?? 0),
        meta: (input.meta as Prisma.InputJsonValue) ?? undefined,
        updatedById: updatedById ?? null,
      },
      select: { id: true },
    })

    await tx.machineFuelEvent.deleteMany({ where: { dailyLogId: daily.id } })

    if (fuelEvents.length > 0) {
      await tx.machineFuelEvent.createMany({
        data: fuelEvents.map((event) => ({
          dailyLogId: daily.id,
          fuelSourceId: Number(event.fuelSourceId),
          amount: new Prisma.Decimal(toMoney(Number(event.amount)) ?? 0),
          note: typeof event.note === 'string' ? event.note.trim() : null,
        })),
      })
    }

    const record = await tx.machineDailyLog.findUnique({
      where: { id: daily.id },
      include: { fuelEvents: { orderBy: { id: 'asc' } } },
    })

    if (!record) {
      throw new Error('保存失败')
    }

    return record
  })

  return mapDailyLog(saved)
}
