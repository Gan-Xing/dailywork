/**
 * Derive team supervisor bindings from existing expat profiles.
 *
 * Usage:
 *   npx tsx scripts/backfill-team-supervisor-bindings.ts
 *   npx tsx scripts/backfill-team-supervisor-bindings.ts --confirm
 */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'

type TeamLabelStat = { count: number; lastSeenAt: Date }
type SupervisorStat = { count: number; lastSeenAt: Date }

type TeamStats = {
  teamLabels: Map<string, TeamLabelStat>
  supervisorStats: Map<number, SupervisorStat>
}

type CandidateBinding = {
  teamKey: string
  team: string
  supervisorId: number
  count: number
  total: number
}

type ConflictInfo = {
  teamKey: string
  team: string
  selectedSupervisorId: number
  counts: Array<{ supervisorId: number; count: number; lastSeenAt: Date }>
}

const prisma = new PrismaClient()

const pickMostFrequentSupervisor = (
  stats: Map<number, SupervisorStat>,
): { supervisorId: number; count: number; lastSeenAt: Date } | null => {
  let result: { supervisorId: number; count: number; lastSeenAt: Date } | null = null
  stats.forEach((stat, id) => {
    if (!result) {
      result = { supervisorId: id, count: stat.count, lastSeenAt: stat.lastSeenAt }
      return
    }
    if (stat.count > result.count) {
      result = { supervisorId: id, count: stat.count, lastSeenAt: stat.lastSeenAt }
      return
    }
    if (stat.count === result.count) {
      const statTime = stat.lastSeenAt.getTime()
      const selectedTime = result.lastSeenAt.getTime()
      if (statTime > selectedTime || (statTime === selectedTime && id < result.supervisorId)) {
        result = { supervisorId: id, count: stat.count, lastSeenAt: stat.lastSeenAt }
      }
    }
  })
  return result
}

const pickMostFrequentTeamLabel = (
  stats: Map<string, TeamLabelStat>,
): { team: string; count: number; lastSeenAt: Date } | null => {
  let result: { team: string; count: number; lastSeenAt: Date } | null = null
  stats.forEach((stat, label) => {
    if (!result) {
      result = { team: label, count: stat.count, lastSeenAt: stat.lastSeenAt }
      return
    }
    if (stat.count > result.count) {
      result = { team: label, count: stat.count, lastSeenAt: stat.lastSeenAt }
      return
    }
    if (stat.count === result.count) {
      const statTime = stat.lastSeenAt.getTime()
      const selectedTime = result.lastSeenAt.getTime()
      if (statTime > selectedTime || (statTime === selectedTime && label < result.team)) {
        result = { team: label, count: stat.count, lastSeenAt: stat.lastSeenAt }
      }
    }
  })
  return result
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')

  const profiles = await prisma.userExpatProfile.findMany({
    where: {
      team: { not: null },
      chineseSupervisorId: { not: null },
    },
    select: {
      userId: true,
      team: true,
      chineseSupervisorId: true,
      updatedAt: true,
      chineseSupervisor: {
        select: {
          id: true,
          nationality: true,
          name: true,
          username: true,
          chineseProfile: { select: { frenchName: true } },
        },
      },
    },
  })

  const teamStats = new Map<string, TeamStats>()
  const invalidProfiles: Array<{ userId: number; team: string; supervisorId: number }> = []

  profiles.forEach((profile) => {
    const teamValue = typeof profile.team === 'string' ? profile.team.trim() : ''
    if (!teamValue) return
    const teamKey = normalizeTeamKey(teamValue)
    if (!teamKey) return
    const supervisorId = profile.chineseSupervisorId
    if (!supervisorId) return
    if (!profile.chineseSupervisor || profile.chineseSupervisor.nationality !== 'china') {
      invalidProfiles.push({ userId: profile.userId, team: teamValue, supervisorId })
      return
    }

    const stats = teamStats.get(teamKey) ?? {
      teamLabels: new Map<string, TeamLabelStat>(),
      supervisorStats: new Map<number, SupervisorStat>(),
    }

    const teamLabelStat = stats.teamLabels.get(teamValue) ?? {
      count: 0,
      lastSeenAt: profile.updatedAt,
    }
    teamLabelStat.count += 1
    if (profile.updatedAt > teamLabelStat.lastSeenAt) {
      teamLabelStat.lastSeenAt = profile.updatedAt
    }
    stats.teamLabels.set(teamValue, teamLabelStat)

    const supervisorStat = stats.supervisorStats.get(supervisorId) ?? {
      count: 0,
      lastSeenAt: profile.updatedAt,
    }
    supervisorStat.count += 1
    if (profile.updatedAt > supervisorStat.lastSeenAt) {
      supervisorStat.lastSeenAt = profile.updatedAt
    }
    stats.supervisorStats.set(supervisorId, supervisorStat)

    teamStats.set(teamKey, stats)
  })

  if (teamStats.size === 0) {
    console.log('No teams with supervisor bindings found in expat profiles.')
    return
  }

  const candidates: CandidateBinding[] = []
  const conflicts: ConflictInfo[] = []

  teamStats.forEach((stats, teamKey) => {
    const teamPick = pickMostFrequentTeamLabel(stats.teamLabels)
    const supervisorPick = pickMostFrequentSupervisor(stats.supervisorStats)
    if (!teamPick || !supervisorPick) return

    let total = 0
    stats.supervisorStats.forEach((stat) => {
      total += stat.count
    })

    candidates.push({
      teamKey,
      team: teamPick.team,
      supervisorId: supervisorPick.supervisorId,
      count: supervisorPick.count,
      total,
    })

    if (stats.supervisorStats.size > 1) {
      const counts: ConflictInfo['counts'] = []
      stats.supervisorStats.forEach((stat, id) => {
        counts.push({
          supervisorId: id,
          count: stat.count,
          lastSeenAt: stat.lastSeenAt,
        })
      })
      conflicts.push({
        teamKey,
        team: teamPick.team,
        selectedSupervisorId: supervisorPick.supervisorId,
        counts,
      })
    }
  })

  const supervisorIds = Array.from(new Set(candidates.map((item) => item.supervisorId)))
  const supervisors = await prisma.user.findMany({
    where: { id: { in: supervisorIds } },
    select: {
      id: true,
      name: true,
      username: true,
      nationality: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })

  const supervisorById = new Map(
    supervisors.map((supervisor) => [supervisor.id, supervisor]),
  )

  const existingBindings = await prisma.teamSupervisor.findMany({
    select: {
      id: true,
      teamKey: true,
      team: true,
      supervisorId: true,
      supervisorName: true,
    },
  })
  const existingByKey = new Map(
    existingBindings.map((binding) => [binding.teamKey, binding]),
  )

  const toCreate: Array<{
    team: string
    teamKey: string
    supervisorId: number
    supervisorName: string
  }> = []
  const toUpdate: Array<{
    id: number
    team: string
    teamKey: string
    supervisorId: number
    supervisorName: string
  }> = []
  const skipped: Array<{ teamKey: string; team: string; reason: string }> = []

  candidates.forEach((candidate) => {
    const supervisor = supervisorById.get(candidate.supervisorId)
    if (!supervisor || supervisor.nationality !== 'china') {
      skipped.push({
        teamKey: candidate.teamKey,
        team: candidate.team,
        reason: 'Supervisor is missing or not Chinese.',
      })
      return
    }
    const supervisorName =
      formatSupervisorLabel({
        name: supervisor.name,
        frenchName: supervisor.chineseProfile?.frenchName ?? null,
        username: supervisor.username,
      }) || supervisor.username

    const existing = existingByKey.get(candidate.teamKey)
    if (!existing) {
      toCreate.push({
        team: candidate.team,
        teamKey: candidate.teamKey,
        supervisorId: candidate.supervisorId,
        supervisorName,
      })
      return
    }

    const needsUpdate =
      existing.supervisorId !== candidate.supervisorId ||
      existing.team !== candidate.team ||
      existing.supervisorName !== supervisorName

    if (needsUpdate) {
      toUpdate.push({
        id: existing.id,
        team: candidate.team,
        teamKey: candidate.teamKey,
        supervisorId: candidate.supervisorId,
        supervisorName,
      })
    }
  })

  console.log(`Profiles scanned: ${profiles.length}`)
  console.log(`Teams derived: ${candidates.length}`)
  console.log(`Existing bindings: ${existingBindings.length}`)
  console.log(`Creates: ${toCreate.length}`)
  console.log(`Updates: ${toUpdate.length}`)
  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.length}`)
  }
  if (invalidProfiles.length > 0) {
    console.log(`Profiles skipped due to non-Chinese supervisor: ${invalidProfiles.length}`)
  }
  if (conflicts.length > 0) {
    console.log(`Conflicts resolved by most frequent supervisor: ${conflicts.length}`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  const operations = [
    ...toCreate.map((item) =>
      prisma.teamSupervisor.create({
        data: {
          team: item.team,
          teamKey: item.teamKey,
          supervisorId: item.supervisorId,
          supervisorName: item.supervisorName,
        },
      }),
    ),
    ...toUpdate.map((item) =>
      prisma.teamSupervisor.update({
        where: { id: item.id },
        data: {
          team: item.team,
          teamKey: item.teamKey,
          supervisorId: item.supervisorId,
          supervisorName: item.supervisorName,
        },
      }),
    ),
  ]

  if (operations.length === 0) {
    console.log('No changes to apply.')
    return
  }

  await prisma.$transaction(operations)
  console.log(`Applied ${operations.length} team supervisor binding changes.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
