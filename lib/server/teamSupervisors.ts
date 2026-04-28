import { Prisma } from '@prisma/client'

import type { Locale } from '@/lib/i18n'
import { normalizeTeamKey, normalizeText, resolveTeamDisplayName } from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'

type TeamSupervisorClient = Prisma.TransactionClient | typeof prisma

type TeamSupervisorBinding = {
  teamKey: string
  teamFr?: string | null
  teamZh?: string | null
  supervisorId: number
  supervisorName?: string | null
  projectId: number | null
}

type TeamSupervisorHistoryPayload = {
  teamSupervisorId?: number | null
  team: string
  teamFr?: string | null
  teamZh?: string | null
  teamKey: string
  supervisorId: number
  supervisorName?: string | null
  projectId?: number | null
}

type TeamDisplayAtDateInput = {
  team?: string | null
  at?: Date | string | null
}

const normalizeHistoryDate = (value?: Date | string | null) => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.toISOString().slice(0, 10))
}

export const buildTeamHistoryLookupKey = (
  team?: string | null,
  at?: Date | string | null,
) => {
  const teamKey = normalizeTeamKey(team ?? null)
  const normalizedDate = normalizeHistoryDate(at)
  if (!teamKey || !normalizedDate) return ''
  return `${teamKey}::${normalizedDate.toISOString().slice(0, 10)}`
}

const toBindingMap = (
  rows: Array<{
    teamKey: string
    team?: string | null
    teamFr?: string | null
    teamZh?: string | null
    supervisorId?: number | null
    supervisorName?: string | null
    projectId?: number | null
  }>,
) =>
  new Map(
    rows.map((row) => [
      row.teamKey,
      {
        teamKey: row.teamKey,
        teamFr: row.teamFr ?? null,
        teamZh: row.teamZh ?? null,
        supervisorId: row.supervisorId ?? 0,
        supervisorName: row.supervisorName ?? null,
        projectId: row.projectId ?? null,
      } satisfies TeamSupervisorBinding,
    ]),
  )

export const resolveTeamDefaults = async (
  team?: string | null,
  client: TeamSupervisorClient = prisma,
): Promise<{ supervisorId: number | null; projectId: number | null }> => {
  const teamKey = normalizeTeamKey(team ?? null)
  if (!teamKey) return { supervisorId: null, projectId: null }
  const binding = await client.teamSupervisor.findUnique({
    where: { teamKey },
    select: { supervisorId: true, projectId: true },
  })
  return {
    supervisorId: binding?.supervisorId ?? null,
    projectId: binding?.projectId ?? null,
  }
}

export const resolveTeamSupervisorId = async (
  team?: string | null,
  client: TeamSupervisorClient = prisma,
): Promise<number | null> => {
  const defaults = await resolveTeamDefaults(team ?? null, client)
  return defaults.supervisorId ?? null
}

export const buildTeamSupervisorMap = async (
  teams: Array<string | null | undefined>,
  client: TeamSupervisorClient = prisma,
): Promise<Map<string, TeamSupervisorBinding>> => {
  const keys = Array.from(
    new Set(
      teams
        .map((team) => normalizeTeamKey(team ?? null))
        .filter((key) => key.length > 0),
    ),
  )
  if (keys.length === 0) return new Map()
  const bindings = await client.teamSupervisor.findMany({
    where: { teamKey: { in: keys } },
    select: {
      teamKey: true,
      teamFr: true,
      teamZh: true,
      supervisorId: true,
      supervisorName: true,
      projectId: true,
    },
  })
  return toBindingMap(bindings)
}

export const createTeamSupervisorHistory = async (
  client: TeamSupervisorClient,
  payload: TeamSupervisorHistoryPayload,
  effectiveFrom: Date = new Date(),
) =>
  client.teamSupervisorHistory.create({
    data: {
      teamSupervisorId: payload.teamSupervisorId ?? null,
      team: payload.team,
      teamFr: payload.teamFr ?? null,
      teamZh: payload.teamZh ?? null,
      teamKey: payload.teamKey,
      supervisorId: payload.supervisorId,
      supervisorName: payload.supervisorName ?? null,
      projectId: payload.projectId ?? null,
      effectiveFrom,
      effectiveTo: null,
    },
  })

export const closeActiveTeamSupervisorHistory = async (
  client: TeamSupervisorClient,
  teamSupervisorId: number,
  effectiveTo: Date = new Date(),
) =>
  client.teamSupervisorHistory.updateMany({
    where: {
      teamSupervisorId,
      effectiveTo: null,
    },
    data: { effectiveTo },
  })

export const buildTeamHistoryMapAtDates = async (
  inputs: TeamDisplayAtDateInput[],
  client: TeamSupervisorClient = prisma,
) => {
  const groupedKeys = new Map<string, { at: Date; teamKeys: Set<string> }>()
  const allTeamKeys = new Set<string>()

  inputs.forEach((input) => {
    const lookupKey = buildTeamHistoryLookupKey(input.team, input.at)
    if (!lookupKey) return
    const [teamKey, day] = lookupKey.split('::')
    if (!teamKey || !day) return
    allTeamKeys.add(teamKey)
    const existing = groupedKeys.get(day)
    if (existing) {
      existing.teamKeys.add(teamKey)
      return
    }
    const at = normalizeHistoryDate(day)
    if (!at) return
    groupedKeys.set(day, { at, teamKeys: new Set([teamKey]) })
  })

  if (groupedKeys.size === 0) return new Map<string, TeamSupervisorBinding>()

  const fallbackBindings = allTeamKeys.size
    ? await buildTeamSupervisorMap(Array.from(allTeamKeys), client)
    : new Map<string, TeamSupervisorBinding>()

  const result = new Map<string, TeamSupervisorBinding>()

  const tasks = Array.from(groupedKeys.entries()).map(async ([day, group]) => {
    const keys = Array.from(group.teamKeys.values())
    const rows = await client.teamSupervisorHistory.findMany({
      where: {
        teamKey: { in: keys },
        effectiveFrom: { lte: group.at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: group.at } }],
      },
      orderBy: [{ teamKey: 'asc' }, { effectiveFrom: 'desc' }, { id: 'desc' }],
      select: {
        teamKey: true,
        teamFr: true,
        teamZh: true,
        supervisorId: true,
        supervisorName: true,
        projectId: true,
      },
    })

    const resolvedForDay = new Map<string, TeamSupervisorBinding>()
    rows.forEach((row) => {
      if (!resolvedForDay.has(row.teamKey)) {
        resolvedForDay.set(row.teamKey, {
          teamKey: row.teamKey,
          teamFr: row.teamFr ?? null,
          teamZh: row.teamZh ?? null,
          supervisorId: row.supervisorId,
          supervisorName: row.supervisorName ?? null,
          projectId: row.projectId ?? null,
        })
      }
    })

    keys.forEach((teamKey) => {
      const binding = resolvedForDay.get(teamKey) ?? fallbackBindings.get(teamKey)
      if (!binding) return
      result.set(`${teamKey}::${day}`, binding)
    })
  })

  await Promise.all(tasks)

  return result
}

export const resolveHistoricalTeamDisplayName = (
  team: string | null | undefined,
  at: Date | string | null | undefined,
  locale: Locale,
  historyMap: Map<string, TeamSupervisorBinding>,
) => {
  const lookupKey = buildTeamHistoryLookupKey(team, at)
  if (!lookupKey) return normalizeText(team ?? null)
  const teamKey = normalizeTeamKey(team ?? null)
  const binding = historyMap.get(lookupKey)
  if (!binding || !teamKey) {
    return normalizeText(team ?? null)
  }
  return (
    resolveTeamDisplayName(
      team,
      locale,
      new Map([[teamKey, binding]]),
    ) || normalizeText(team ?? null)
  )
}
