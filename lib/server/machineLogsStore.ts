import { Prisma } from '@prisma/client'

import type { Locale } from '@/lib/i18n'
import {
  formatSupervisorLabel,
  normalizeTeamKey,
  normalizeText,
  resolveTeamDisplayName,
} from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'
import {
  getMachineEquipmentTypeLabel,
  isMachineEquipmentTypeKey,
  resolveMachineEquipmentTypeKey,
} from '@/lib/resources/machines/equipmentTypes'
import { computeMachineDailyDepreciation } from '@/lib/resources/machines/depreciation'
import { normalizeMachineUsageStatus } from '@/lib/resources/machines/usageStatus'
import { resolveTeamDefaults } from '@/lib/server/teamSupervisors'
import { listMachineAssets } from '@/lib/server/machineStore'
import type {
  FuelSource,
  MachineDailyLog,
  MachineLogEffectiveBinding,
  MachineLogGroupBy,
  MachineLogGroupSummary,
  MachineLogsGroupPageData,
  MachineFuelEvent,
  MachineLogsPageData,
  MachineLogsSummaryPageData,
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

export const MACHINE_LOG_GROUP_BY_VALUES = [
  'none',
  'category',
  'supervisor',
  'team',
  'equipmentType',
] as const satisfies MachineLogGroupBy[]

export const parseMachineLogGroupBy = (value: string | null | undefined): MachineLogGroupBy => {
  const raw = (value ?? '').trim()
  if ((MACHINE_LOG_GROUP_BY_VALUES as readonly string[]).includes(raw)) {
    return raw as MachineLogGroupBy
  }
  return 'supervisor'
}

const parseLocale = (value: string | null | undefined): Locale => {
  const raw = (value ?? '').trim().toLowerCase()
  return raw === 'fr' ? 'fr' : 'zh'
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
      teamFr: binding.teamFr ?? null,
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

const buildTeamLabelMap = (teamSupervisors: TeamSupervisorOption[], locale: Locale) => {
  const map = new Map<string, string>()
  teamSupervisors.forEach((binding) => {
    const label = resolveTeamDisplayName(binding.team, locale, new Map([[binding.teamKey, binding]]))
    map.set(binding.teamKey, label)
  })
  return map
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const extractUsageStatusFromMeta = (meta: Prisma.JsonValue | null) => {
  const record = asRecord(meta)
  if (!record) return null
  return normalizeMachineUsageStatus(record.usageStatus)
}

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
  usageStatus: extractUsageStatusFromMeta(log.meta),
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

type MachineDepreciationInputs = {
  registrationDate: string | null
  originalValue: number | null
  usedMonths: number | null
}

const buildDepreciationInputsByMachineId = (
  machines: Array<{ id: number; registrationDate: string | null; originalValue: number | null; usedMonths: number | null }>,
) => {
  const map = new Map<number, MachineDepreciationInputs>()
  machines.forEach((machine) => {
    map.set(machine.id, {
      registrationDate: machine.registrationDate ?? null,
      originalValue: machine.originalValue ?? null,
      usedMonths: machine.usedMonths ?? null,
    })
  })
  return map
}

const applyComputedDailyDepreciation = (
  logs: MachineDailyLog[],
  inputsByMachineId: Map<number, MachineDepreciationInputs>,
): MachineDailyLog[] => {
  return logs.map((log) => {
    const inputs = inputsByMachineId.get(log.machineId)
    const computed = computeMachineDailyDepreciation({
      dateKey: log.logDate,
      registrationDate: inputs?.registrationDate ?? null,
      originalValue: inputs?.originalValue ?? null,
      usedMonths: inputs?.usedMonths ?? null,
    })
    return { ...log, dailyDepreciation: computed }
  })
}

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

  const depreciationInputsByMachineId = buildDepreciationInputsByMachineId(machines)
  const mappedLogs = applyComputedDailyDepreciation(logs.map(mapDailyLog), depreciationInputsByMachineId)

  return {
    date: dateKey,
    machines,
    logs: mappedLogs,
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

type AssignmentSnapshot = {
  logDate: Date
  team: string | null
  teamKey: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  projectId: number | null
  operatorId: number | null
  operatorName: string | null
}

const listLastAssignmentsBefore = async (start: Date): Promise<Map<number, AssignmentSnapshot>> => {
  const records = await prisma.machineDailyLog.findMany({
    where: { logDate: { lt: start } },
    orderBy: [{ machineId: 'asc' }, { logDate: 'desc' }, { id: 'desc' }],
    distinct: ['machineId'],
    select: {
      machineId: true,
      logDate: true,
      team: true,
      teamKey: true,
      chineseSupervisorId: true,
      chineseSupervisorName: true,
      projectId: true,
      operatorId: true,
      operatorName: true,
    },
  })

  const map = new Map<number, AssignmentSnapshot>()
  records.forEach((record) => {
    map.set(record.machineId, {
      logDate: record.logDate,
      team: record.team,
      teamKey: record.teamKey,
      chineseSupervisorId: record.chineseSupervisorId,
      chineseSupervisorName: record.chineseSupervisorName,
      projectId: record.projectId,
      operatorId: record.operatorId,
      operatorName: record.operatorName,
    })
  })
  return map
}

const computeEffectiveBindings = ({
  dateKey,
  machines,
  todayLogs,
  historyAssignments,
  teamSupervisors,
}: {
  dateKey: string
  machines: Array<{ id: number }>
  todayLogs: Map<number, MachineDailyLog>
  historyAssignments: Map<number, AssignmentSnapshot>
  teamSupervisors: TeamSupervisorOption[]
}): Record<string, MachineLogEffectiveBinding> => {
  const bindingMap = new Map(teamSupervisors.map((item) => [item.teamKey, item]))
  const effective: Record<string, MachineLogEffectiveBinding> = {}

  machines.forEach((machine) => {
    const today = todayLogs.get(machine.id) ?? null
    const history = historyAssignments.get(machine.id) ?? null
    const base = today
      ? {
          sourceDate: dateKey,
          isFromToday: true,
          team: today.team,
          teamKey: today.teamKey,
          chineseSupervisorId: today.chineseSupervisorId,
          chineseSupervisorName: today.chineseSupervisorName,
          projectId: today.projectId,
          operatorId: today.operatorId,
          operatorName: today.operatorName,
        }
      : history
        ? {
            sourceDate: formatDateKey(history.logDate),
            isFromToday: false,
            team: history.team,
            teamKey: history.teamKey ?? (history.team ? normalizeTeamKey(history.team) : null),
            chineseSupervisorId: history.chineseSupervisorId,
            chineseSupervisorName: history.chineseSupervisorName,
            projectId: history.projectId,
            operatorId: history.operatorId,
            operatorName: history.operatorName,
          }
        : {
            sourceDate: null,
            isFromToday: false,
            team: null,
            teamKey: null,
            chineseSupervisorId: null,
            chineseSupervisorName: null,
            projectId: null,
            operatorId: null,
            operatorName: null,
          }

    const resolvedTeamKey = base.teamKey ?? (base.team ? normalizeTeamKey(base.team) : null)
    const binding = resolvedTeamKey ? (bindingMap.get(resolvedTeamKey) ?? null) : null

    const fallbackSupervisorId = binding?.supervisorId ?? null
    const fallbackSupervisorName = binding?.supervisorLabel ?? null
    const fallbackProjectId = binding?.project?.id ?? null

    effective[String(machine.id)] = {
      ...base,
      teamKey: resolvedTeamKey,
      chineseSupervisorId: base.chineseSupervisorId ?? fallbackSupervisorId,
      chineseSupervisorName: base.chineseSupervisorName ?? fallbackSupervisorName,
      projectId: base.projectId ?? fallbackProjectId,
    }
  })

  return effective
}

const groupLabelForUnassigned = (groupBy: MachineLogGroupBy, locale: Locale) => {
  if (groupBy === 'supervisor') {
    return locale === 'fr' ? 'Responsable vide' : '未填负责人'
  }
  if (groupBy === 'team') {
    return locale === 'fr' ? 'Équipe vide' : '未填队伍'
  }
  if (groupBy === 'category') {
    return locale === 'fr' ? 'Catégorie vide' : '未分类'
  }
  if (groupBy === 'equipmentType') {
    return locale === 'fr' ? 'Type non classé' : '未分类'
  }
  return locale === 'fr' ? 'Tous' : '全部'
}

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

const buildGroupSummary = ({
  dateKey,
  locale,
  groupBy,
  groupKey,
  groupLabel,
  machines,
  todayLogs,
  prevFuelByMachineId,
}: {
  dateKey: string
  locale: Locale
  groupBy: MachineLogGroupBy
  groupKey: string
  groupLabel: string
  machines: MachineLogsPageData['machines']
  todayLogs: Map<number, MachineDailyLog>
  prevFuelByMachineId: Record<string, number | null>
}): MachineLogGroupSummary => {
  let filledCount = 0
  let missingCount = 0
  let fuelAddedTotal = 0
  let depreciationTotal = 0
  let consumedSum = 0
  let consumedCount = 0
  let negativeFuelConsumedCount = 0
  let missingFuelRemainingEndCount = 0

  machines.forEach((machine) => {
    const shouldTrackFuel = (() => {
      const resolved = resolveMachineEquipmentTypeKey(machine)
      return resolved.key !== 'survey' && resolved.key !== 'lab'
    })()

    const log = todayLogs.get(machine.id) ?? null
    if (!log) {
      missingCount += 1
      return
    }

    filledCount += 1

    const fuelAdded = shouldTrackFuel
      ? Array.isArray(log.fuelEvents)
        ? log.fuelEvents.reduce((acc, event) => acc + (Number(event.amount) || 0), 0)
        : 0
      : 0
    if (shouldTrackFuel) {
      fuelAddedTotal += fuelAdded
    }

    const dep = log.dailyDepreciation ?? null
    if (dep != null && Number.isFinite(dep)) {
      depreciationTotal += dep
    }

    if (shouldTrackFuel) {
      const prev = prevFuelByMachineId[String(machine.id)] ?? null
      const end = log.fuelRemainingEnd ?? null
      if (end == null) {
        missingFuelRemainingEndCount += 1
      }
      if (prev != null && end != null) {
        const consumed = prev + fuelAdded - end
        if (Number.isFinite(consumed)) {
          consumedSum += consumed
          consumedCount += 1
          if (consumed < -0.0001) negativeFuelConsumedCount += 1
        }
      }
    }
  })

  return {
    groupBy,
    groupKey,
    groupLabel,
    machineCount: machines.length,
    filledCount,
    missingCount,
    fuelAddedTotal: round2(fuelAddedTotal),
    fuelConsumedTotal: consumedCount > 0 ? round2(consumedSum) : null,
    dailyDepreciationTotal: round2(depreciationTotal),
    issues: {
      negativeFuelConsumedCount,
      missingFuelRemainingEndCount,
    },
  }
}

const sortGroups = (groups: MachineLogGroupSummary[]) => {
  const specialKeys = new Set(['unassigned', 'unclassified', 'all'])
  return [...groups].sort((a, b) => {
    const aSpecial = specialKeys.has(a.groupKey)
    const bSpecial = specialKeys.has(b.groupKey)
    if (aSpecial && !bSpecial) return 1
    if (!aSpecial && bSpecial) return -1
    return a.groupLabel.localeCompare(b.groupLabel, undefined, { numeric: true, sensitivity: 'base' })
  })
}

const resolveGroupForMachine = ({
  machine,
  effective,
  teamLabelByKey,
  locale,
  groupBy,
}: {
  machine: (MachineLogsPageData['machines'][number] & { equipmentTypeKey?: string | null }) | { id: number; assetCategoryName?: string | null; equipmentTypeKey?: string | null; assetName?: string | null; specModel?: string | null; alias?: string | null }
  effective: MachineLogEffectiveBinding
  teamLabelByKey: Map<string, string>
  locale: Locale
  groupBy: MachineLogGroupBy
}): { key: string; label: string } => {
  if (groupBy === 'none') {
    return { key: 'all', label: locale === 'fr' ? 'Tous' : '全部' }
  }

  if (groupBy === 'category') {
    const label = (machine as any).assetCategoryName ? String((machine as any).assetCategoryName).trim() : ''
    if (!label) return { key: 'unclassified', label: groupLabelForUnassigned('category', locale) }
    const key = `cat_${Buffer.from(label, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`
    return { key, label }
  }

  if (groupBy === 'equipmentType') {
    const resolved = resolveMachineEquipmentTypeKey(machine as any)
    return {
      key: resolved.key,
      label: getMachineEquipmentTypeLabel(locale, resolved.key),
    }
  }

  if (groupBy === 'team') {
    const key = effective.teamKey ? effective.teamKey : 'unassigned'
    if (key === 'unassigned') return { key, label: groupLabelForUnassigned('team', locale) }
    return { key, label: teamLabelByKey.get(key) ?? effective.team ?? key }
  }

  if (groupBy === 'supervisor') {
    const supervisorId = effective.chineseSupervisorId ?? null
    if (!supervisorId) return { key: 'unassigned', label: groupLabelForUnassigned('supervisor', locale) }
    return {
      key: String(supervisorId),
      label: effective.chineseSupervisorName ?? String(supervisorId),
    }
  }

  return { key: 'all', label: locale === 'fr' ? 'Tous' : '全部' }
}

export async function getMachineLogsSummaryPageData({
  dateKey,
  groupBy,
  projectId = null,
  mineOnly = false,
  mineUserId = null,
  locale: localeRaw,
}: {
  dateKey: string
  groupBy: MachineLogGroupBy
  projectId?: number | null
  mineOnly?: boolean
  mineUserId?: number | null
  locale?: string | null
}): Promise<MachineLogsSummaryPageData> {
  assertModels()

  const locale = parseLocale(localeRaw)

  const start = parseDateKey(dateKey)
  const end = addUtcDays(start, 1)
  const prevStart = addUtcDays(start, -1)
  const prevEnd = start

  const [machines, logs, prevFuelLogs, teamSupervisors, historyAssignments, projects] = await Promise.all([
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
    listLastAssignmentsBefore(start),
    listProjects(),
  ])

  const depreciationInputsByMachineId = buildDepreciationInputsByMachineId(machines)
  const mappedLogs = applyComputedDailyDepreciation(logs.map(mapDailyLog), depreciationInputsByMachineId)

  const todayLogs = new Map<number, MachineDailyLog>()
  mappedLogs.forEach((log) => todayLogs.set(log.machineId, log))

  const prevFuelByMachineId: Record<string, number | null> = {}
  prevFuelLogs.forEach((log) => {
    prevFuelByMachineId[String(log.machineId)] = toMoney(toNumber(log.fuelRemainingEnd))
  })

  const effectiveByMachineId = computeEffectiveBindings({
    dateKey,
    machines,
    todayLogs,
    historyAssignments,
    teamSupervisors,
  })

  const teamLabelByKey = buildTeamLabelMap(teamSupervisors, locale)

  const mineId = mineOnly && mineUserId && mineUserId > 0 ? mineUserId : null
  const safeProjectId = projectId && projectId > 0 ? projectId : null

  const groupToMachines = new Map<string, { label: string; machines: MachineLogsPageData['machines'] }>()

  machines.forEach((machine) => {
    const effective = effectiveByMachineId[String(machine.id)]
    if (mineId && effective?.chineseSupervisorId !== mineId) return
    if (safeProjectId && effective?.projectId !== safeProjectId) return

    const group = resolveGroupForMachine({ machine, effective, teamLabelByKey, locale, groupBy })
    const entry = groupToMachines.get(group.key) ?? { label: group.label, machines: [] }
    entry.label = group.label
    entry.machines.push(machine)
    groupToMachines.set(group.key, entry)
  })

  const summaries: MachineLogGroupSummary[] = []
  groupToMachines.forEach((value, key) => {
    summaries.push(
      buildGroupSummary({
        dateKey,
        locale,
        groupBy,
        groupKey: key,
        groupLabel: value.label,
        machines: value.machines,
        todayLogs,
        prevFuelByMachineId,
      }),
    )
  })

  return {
    date: dateKey,
    locale,
    groupBy,
    mine: Boolean(mineId),
    projectId: safeProjectId,
    groups: sortGroups(summaries),
    options: {
      projects,
    },
  }
}

export async function getMachineLogsGroupPageData({
  dateKey,
  groupBy,
  groupKey,
  projectId = null,
  mineOnly = false,
  mineUserId = null,
  locale: localeRaw,
}: {
  dateKey: string
  groupBy: MachineLogGroupBy
  groupKey: string
  projectId?: number | null
  mineOnly?: boolean
  mineUserId?: number | null
  locale?: string | null
}): Promise<MachineLogsGroupPageData> {
  assertModels()

  const locale = parseLocale(localeRaw)

  const start = parseDateKey(dateKey)
  const end = addUtcDays(start, 1)
  const prevStart = addUtcDays(start, -1)
  const prevEnd = start

  const [machines, logs, prevFuelLogs, teamSupervisors, supervisors, operators, projects, historyAssignments] =
    await Promise.all([
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
      listLastAssignmentsBefore(start),
    ])

  const depreciationInputsByMachineId = buildDepreciationInputsByMachineId(machines)
  const mappedLogs = applyComputedDailyDepreciation(logs.map(mapDailyLog), depreciationInputsByMachineId)

  const todayLogs = new Map<number, MachineDailyLog>()
  mappedLogs.forEach((log) => todayLogs.set(log.machineId, log))

  const prevFuelByMachineId: Record<string, number | null> = {}
  prevFuelLogs.forEach((log) => {
    prevFuelByMachineId[String(log.machineId)] = toMoney(toNumber(log.fuelRemainingEnd))
  })

  const effectiveByMachineIdAll = computeEffectiveBindings({
    dateKey,
    machines,
    todayLogs,
    historyAssignments,
    teamSupervisors,
  })

  const teamLabelByKey = buildTeamLabelMap(teamSupervisors, locale)
  const mineId = mineOnly && mineUserId && mineUserId > 0 ? mineUserId : null
  const safeProjectId = projectId && projectId > 0 ? projectId : null

  const selectedMachines: MachineLogsPageData['machines'] = []
  const selectedLogs: MachineDailyLog[] = []
  const effectiveByMachineId: Record<string, MachineLogEffectiveBinding> = {}

  machines.forEach((machine) => {
    const effective = effectiveByMachineIdAll[String(machine.id)]
    if (mineId && effective?.chineseSupervisorId !== mineId) return
    if (safeProjectId && effective?.projectId !== safeProjectId) return

    const group = resolveGroupForMachine({ machine, effective, teamLabelByKey, locale, groupBy })
    if (group.key !== groupKey) return

    selectedMachines.push(machine)
    effectiveByMachineId[String(machine.id)] = effective
    const log = todayLogs.get(machine.id) ?? null
    if (log) selectedLogs.push(log)
  })

  // Determine display label from the actual group members when possible.
  const resolvedLabel = (() => {
    if (selectedMachines.length > 0) {
      const first = selectedMachines[0]
      return resolveGroupForMachine({
        machine: first,
        effective: effectiveByMachineId[String(first.id)],
        teamLabelByKey,
        locale,
        groupBy,
      }).label
    }

    if (groupBy === 'none') return groupLabelForUnassigned('none', locale)
    if (groupBy === 'equipmentType') {
      return isMachineEquipmentTypeKey(groupKey)
        ? getMachineEquipmentTypeLabel(locale, groupKey)
        : groupLabelForUnassigned('equipmentType', locale)
    }
    if (groupBy === 'category') {
      if (groupKey === 'unclassified') return groupLabelForUnassigned('category', locale)
      const raw = groupKey.startsWith('cat_') ? decodeBase64Url(groupKey.slice(4)) : null
      return raw?.trim() || groupKey
    }
    if (groupBy === 'team') {
      if (groupKey === 'unassigned') return groupLabelForUnassigned('team', locale)
      return teamLabelByKey.get(groupKey) ?? groupKey
    }
    if (groupBy === 'supervisor') {
      if (groupKey === 'unassigned') return groupLabelForUnassigned('supervisor', locale)
      const id = Number(groupKey)
      if (!Number.isFinite(id) || id <= 0) return groupKey
      return supervisors.find((item) => item.id === id)?.label ?? groupKey
    }
    return groupKey
  })()

  const summary = buildGroupSummary({
    dateKey,
    locale,
    groupBy,
    groupKey,
    groupLabel: resolvedLabel,
    machines: selectedMachines,
    todayLogs,
    prevFuelByMachineId,
  })

  const referencedFuelSourceIds = selectedLogs.flatMap((log) => log.fuelEvents.map((event) => event.fuelSourceId))
  const fuelSources = await listFuelSources({ includeIds: referencedFuelSourceIds })

  return {
    date: dateKey,
    locale,
    groupBy,
    groupKey,
    groupLabel: resolvedLabel,
    mine: Boolean(mineId),
    projectId: safeProjectId,
    summary,
    machines: selectedMachines,
    logs: selectedLogs,
    prevFuelByMachineId,
    effectiveByMachineId,
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
  usageStatus?: string | null
  team?: string | null
  chineseSupervisorId?: number | null
  projectId?: number | null
  operatorId?: number | null
  workContent?: string | null
  fuelRemainingEnd?: number | null
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
  const hasUsageStatusInput = Object.prototype.hasOwnProperty.call(input, 'usageStatus')
  const hasMetaInput = Object.prototype.hasOwnProperty.call(input, 'meta')
  const usageStatus = normalizeMachineUsageStatus(input.usageStatus)

  const machineSnapshot = await prisma.machineAsset.findUnique({
    where: { id: machineId },
    select: {
      id: true,
      registrationDate: true,
      originalValue: true,
      usedMonths: true,
    },
  })

  if (!machineSnapshot) {
    throw new Error('机械不存在')
  }

  const computedDailyDepreciation = computeMachineDailyDepreciation({
    dateKey: input.date,
    registrationDate: machineSnapshot.registrationDate ? machineSnapshot.registrationDate.toISOString() : null,
    originalValue: toNumber(machineSnapshot.originalValue),
    usedMonths: machineSnapshot.usedMonths ?? null,
  })

  const dailyDepreciationDecimal =
    computedDailyDepreciation == null
      ? null
      : new Prisma.Decimal(toMoney(computedDailyDepreciation) ?? 0)

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

  const workContent = typeof input.workContent === 'string' ? input.workContent.trim() : null

  const fuelEvents = Array.isArray(input.fuelEvents) ? input.fuelEvents : []
  const existingMeta = hasUsageStatusInput
    ? await prisma.machineDailyLog.findUnique({
        where: { machineId_logDate: { machineId, logDate: start } },
        select: { meta: true },
      })
    : null

  const metaToWrite = (() => {
    if (!hasUsageStatusInput) {
      return hasMetaInput ? ((input.meta as Prisma.InputJsonValue) ?? undefined) : undefined
    }

    const source = hasMetaInput ? input.meta : existingMeta?.meta ?? null
    const sourceRecord = asRecord(source)
    const next: Record<string, unknown> = sourceRecord ? { ...sourceRecord } : {}
    if (usageStatus) {
      next.usageStatus = usageStatus
    } else {
      delete next.usageStatus
    }
    return next as Prisma.InputJsonValue
  })()

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
        dailyDepreciation: dailyDepreciationDecimal,
        meta: metaToWrite,
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
        dailyDepreciation: dailyDepreciationDecimal,
        meta: metaToWrite,
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

    const latestLog = await tx.machineDailyLog.findFirst({
      where: { machineId },
      orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
      select: { meta: true },
    })
    const latestUsageStatus = extractUsageStatusFromMeta(latestLog?.meta ?? null)
    await tx.machineAsset.update({
      where: { id: machineId },
      data: {
        usageStatus: latestUsageStatus,
        updatedBy: updatedById == null ? { disconnect: true } : { connect: { id: updatedById } },
      },
    })

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
