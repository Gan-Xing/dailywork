/**
 * Backfill missing team/position on contract change records.
 *
 * Rules:
 * - Position: fill from current user.position when contract change position is empty.
 * - Team: fill from latest contract change for the same user when supervisor matches.
 * - Team: fill from supervisor -> team mapping only if the supervisor maps to exactly one team.
 * - Special cases (only when team is empty):
 *   - 田都娃 and endDate < 2025-09-30 => BITUME BONDOUKOU
 *   - 姚国防 and endDate < 2025-09-30 => LABO
 *   - 王栋 and endDate < 2025-09-30 => TOPO
 *   - 周泽华 (no date limit) => CARRIERE 1
 *
 * Usage:
 *   npx tsx scripts/backfill-contract-change-team-position.ts
 *   npx tsx scripts/backfill-contract-change-team-position.ts --confirm
 *   npx tsx scripts/backfill-contract-change-team-position.ts --limit 200
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SPECIAL_CUTOFF = new Date(Date.UTC(2025, 8, 30, 0, 0, 0))

const SUPERVISOR_RULES: Array<{
  name: string
  matches: string[]
  team: string
  requiresBeforeCutoff: boolean
}> = [
  {
    name: '田都娃',
    matches: ['田都娃', 'tianduwa'],
    team: 'BITUME BONDOUKOU',
    requiresBeforeCutoff: true,
  },
  {
    name: '姚国防',
    matches: ['姚国防', 'yaoguofang'],
    team: 'LABO',
    requiresBeforeCutoff: true,
  },
  {
    name: '王栋',
    matches: ['王栋', 'wangdong'],
    team: 'TOPO',
    requiresBeforeCutoff: true,
  },
  {
    name: '周泽华',
    matches: ['周泽华', 'zhouzehua'],
    team: 'CARRIERE 1',
    requiresBeforeCutoff: false,
  },
]

const parseLimit = () => {
  const args = process.argv
  const index = args.indexOf('--limit')
  if (index === -1) return null
  const raw = args[index + 1]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const matchesAny = (value: string | null | undefined, keywords: string[]) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return keywords.some((keyword) => {
    if (!keyword) return false
    const lowerKeyword = keyword.toLowerCase()
    return value.includes(keyword) || lower.includes(lowerKeyword)
  })
}

type Change = {
  id: number
  userId: number
  contractNumber: string | null
  team: string | null
  position: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  endDate: Date | null
}

type LatestChange = {
  id: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  startDate: Date | null
  changeDate: Date
}

type UpdateItem = {
  id: number
  userId: number
  contractNumber: string | null
  team: string | null
  position: string | null
  nextTeam: string | null
  nextPosition: string | null
  teamSource: 'supervisor' | 'special' | 'latest' | null
}

const normalizeName = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed.toLowerCase() : null
}

const hasSameSupervisor = (left: Change, right: LatestChange | null) => {
  if (!right) return false
  if (
    left.chineseSupervisorId !== null &&
    right.chineseSupervisorId !== null
  ) {
    return left.chineseSupervisorId === right.chineseSupervisorId
  }
  const leftName = normalizeName(left.chineseSupervisorName)
  const rightName = normalizeName(right.chineseSupervisorName)
  if (!leftName || !rightName) return false
  return leftName === rightName
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const limit = parseLimit()

  const changes = await prisma.userContractChange.findMany({
    where: {
      OR: [
        { team: null },
        { team: '' },
        { position: null },
        { position: '' },
      ],
    },
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      team: true,
      position: true,
      chineseSupervisorId: true,
      chineseSupervisorName: true,
      endDate: true,
    },
    orderBy: [{ userId: 'asc' }, { id: 'asc' }],
  })

  if (changes.length === 0) {
    console.log('No contract change records with empty team/position.')
    return
  }

  const userIds = Array.from(new Set(changes.map((change) => change.userId)))
  const supervisorIds = Array.from(
    new Set(
      changes
        .map((change) => change.chineseSupervisorId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  const { users, supervisors, bindings, latestCandidates } =
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, position: true },
      })
      const supervisors = supervisorIds.length
        ? await tx.user.findMany({
            where: { id: { in: supervisorIds } },
            select: {
              id: true,
              name: true,
              username: true,
              chineseProfile: { select: { frenchName: true } },
            },
          })
        : []
      const bindings = supervisorIds.length
        ? await tx.teamSupervisor.findMany({
            where: { supervisorId: { in: supervisorIds } },
            select: { supervisorId: true, team: true },
          })
        : []
      const latestCandidates = userIds.length
        ? await tx.userContractChange.findMany({
            where: { userId: { in: userIds } },
            select: {
              id: true,
              userId: true,
              team: true,
              chineseSupervisorId: true,
              chineseSupervisorName: true,
              startDate: true,
              changeDate: true,
            },
            orderBy: [
              { userId: 'asc' },
              { startDate: 'desc' },
              { changeDate: 'desc' },
              { id: 'desc' },
            ],
          })
        : []
      return { users, supervisors, bindings, latestCandidates }
    })

  const userMap = new Map(users.map((user) => [user.id, user]))
  const supervisorMap = new Map(
    supervisors.map((supervisor) => [
      supervisor.id,
      {
        name: supervisor.name,
        username: supervisor.username,
        frenchName: supervisor.chineseProfile?.frenchName ?? null,
      },
    ]),
  )

  const teamsBySupervisor = new Map<number, Set<string>>()
  bindings.forEach((binding) => {
    const team = normalizeOptionalText(binding.team)
    if (!team) return
    const set = teamsBySupervisor.get(binding.supervisorId) ?? new Set<string>()
    set.add(team)
    teamsBySupervisor.set(binding.supervisorId, set)
  })

  const uniqueTeamBySupervisor = new Map<number, string>()
  teamsBySupervisor.forEach((teams, supervisorId) => {
    if (teams.size === 1) {
      uniqueTeamBySupervisor.set(supervisorId, Array.from(teams)[0])
    }
  })

  const latestByUser = new Map<number, LatestChange>()
  latestCandidates.forEach((change) => {
    if (!latestByUser.has(change.userId)) {
      latestByUser.set(change.userId, change)
    }
  })

  const updates: UpdateItem[] = []
  let positionUpdates = 0
  let teamUpdates = 0
  let specialTeamUpdates = 0
  let latestTeamUpdates = 0
  let supervisorTeamUpdates = 0

  changes.forEach((change) => {
    const currentTeam = normalizeOptionalText(change.team)
    const currentPosition = normalizeOptionalText(change.position)
    const user = userMap.get(change.userId)
    const nextPosition =
      currentPosition ?? normalizeOptionalText(user?.position ?? null)

    let nextTeam: string | null = currentTeam
    let teamSource: UpdateItem['teamSource'] = null
    if (!currentTeam) {
      const supervisor =
        change.chineseSupervisorId !== null
          ? supervisorMap.get(change.chineseSupervisorId)
          : null
      const namesToCheck = [
        change.chineseSupervisorName,
        supervisor?.name ?? null,
        supervisor?.username ?? null,
        supervisor?.frenchName ?? null,
      ]

      const matchedRule = SUPERVISOR_RULES.find((rule) =>
        namesToCheck.some((value) => matchesAny(value, rule.matches)),
      )

      if (matchedRule) {
        const beforeCutoff =
          !matchedRule.requiresBeforeCutoff ||
          (change.endDate &&
            change.endDate.getTime() < SPECIAL_CUTOFF.getTime())
        if (beforeCutoff) {
          nextTeam = matchedRule.team
          teamSource = 'special'
        }
      }

      if (!teamSource) {
        const latest = latestByUser.get(change.userId) ?? null
        const latestTeam = normalizeOptionalText(latest?.team ?? null)
        if (latestTeam && hasSameSupervisor(change, latest)) {
          nextTeam = latestTeam
          teamSource = 'latest'
        }
      }

      if (
        !teamSource &&
        change.chineseSupervisorId !== null &&
        uniqueTeamBySupervisor.has(change.chineseSupervisorId)
      ) {
        nextTeam = uniqueTeamBySupervisor.get(change.chineseSupervisorId) ?? null
        teamSource = nextTeam ? 'supervisor' : null
      }
    }

    const shouldUpdateTeam = !currentTeam && nextTeam
    const shouldUpdatePosition = !currentPosition && nextPosition

    if (!shouldUpdateTeam && !shouldUpdatePosition) return

    if (shouldUpdatePosition) positionUpdates += 1
    if (shouldUpdateTeam) {
      teamUpdates += 1
      if (teamSource === 'special') specialTeamUpdates += 1
      if (teamSource === 'latest') latestTeamUpdates += 1
      if (teamSource === 'supervisor') supervisorTeamUpdates += 1
    }

    updates.push({
      id: change.id,
      userId: change.userId,
      contractNumber: change.contractNumber ?? null,
      team: change.team ?? null,
      position: change.position ?? null,
      nextTeam: shouldUpdateTeam ? nextTeam : change.team ?? null,
      nextPosition: shouldUpdatePosition ? nextPosition : change.position ?? null,
      teamSource,
    })
  })

  console.log(`Contract changes scanned: ${changes.length}`)
  console.log(`Updates needed: ${updates.length}`)
  console.log(`- position updates: ${positionUpdates}`)
  console.log(
    `- team updates: ${teamUpdates} (special: ${specialTeamUpdates}, latest: ${latestTeamUpdates}, unique supervisor: ${supervisorTeamUpdates})`,
  )

  const preview = limit ? updates.slice(0, limit) : updates
  preview.forEach((item) => {
    console.log(
      `- #${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `team: ${item.team ?? 'null'} -> ${item.nextTeam ?? 'null'} ` +
        `position: ${item.position ?? 'null'} -> ${item.nextPosition ?? 'null'} ` +
        (item.teamSource ? `[team:${item.teamSource}]` : ''),
    )
  })
  if (limit && updates.length > limit) {
    console.log(`...and ${updates.length - limit} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  if (updates.length === 0) {
    console.log('No updates to apply.')
    return
  }

  const batchSize = 100
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userContractChange.update({
          where: { id: item.id },
          data: {
            ...(normalizeOptionalText(item.team)
              ? {}
              : item.nextTeam
                ? { team: item.nextTeam }
                : {}),
            ...(normalizeOptionalText(item.position)
              ? {}
              : item.nextPosition
                ? { position: item.nextPosition }
                : {}),
          },
        }),
      ),
    )
  }

  console.log(`Updated ${updates.length} contract change records.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
