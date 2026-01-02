/**
 * Backfill member project assignments from team supervisor bindings.
 *
 * Usage:
 *   npx tsx scripts/backfill-member-project-assignments.ts
 *   npx tsx scripts/backfill-member-project-assignments.ts --confirm
 */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { normalizeTeamKey } from '@/lib/members/utils'

type CandidateUpdate = {
  userId: number
  projectId: number
  startDate: Date
  fallbackStartDate: Date | null
  source: 'team' | 'supervisor'
}

type TeamBinding = {
  teamKey: string
  projectId: number | null
  supervisorId: number
}

type UserSnapshot = {
  id: number
  joinDate: Date | null
  expatProfile: { team: string | null } | null
  projectAssignments: Array<{ projectId: number }>
}

const prisma = new PrismaClient()

const buildTeamMaps = (bindings: TeamBinding[]) => {
  const teamProjectMap = new Map<string, number>()
  const supervisorProjects = new Map<number, Set<number>>()
  bindings.forEach((binding) => {
    if (binding.projectId) {
      teamProjectMap.set(binding.teamKey, binding.projectId)
      const set = supervisorProjects.get(binding.supervisorId) ?? new Set<number>()
      set.add(binding.projectId)
      supervisorProjects.set(binding.supervisorId, set)
    }
  })
  return { teamProjectMap, supervisorProjects }
}

const resolveTeamProject = (team: string | null, teamProjectMap: Map<string, number>) => {
  const teamKey = normalizeTeamKey(team)
  if (!teamKey) return null
  return teamProjectMap.get(teamKey) ?? null
}

const resolveSupervisorProject = (
  userId: number,
  supervisorProjects: Map<number, Set<number>>,
) => {
  const set = supervisorProjects.get(userId)
  if (!set || set.size === 0) return { projectId: null, conflict: false }
  if (set.size > 1) return { projectId: null, conflict: true }
  return { projectId: Array.from(set)[0] ?? null, conflict: false }
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const bindings = await prisma.teamSupervisor.findMany({
    select: { teamKey: true, projectId: true, supervisorId: true },
  })

  if (bindings.length === 0) {
    console.log('No team supervisor bindings found.')
    return
  }

  const { teamProjectMap, supervisorProjects } = buildTeamMaps(bindings)

  const users = await prisma.user.findMany({
    select: {
      id: true,
      joinDate: true,
      expatProfile: { select: { team: true } },
      projectAssignments: {
        where: { endDate: null },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { projectId: true },
      },
    },
  })

  const updates: CandidateUpdate[] = []
  const conflictSupervisors: number[] = []
  const missingTeamProjects: number[] = []
  const mismatchedAssignments: Array<{ userId: number; current: number; resolved: number }> = []
  let activeAssignments = 0

  users.forEach((user) => {
    const currentProjectId = user.projectAssignments[0]?.projectId ?? null
    const teamProjectId = resolveTeamProject(user.expatProfile?.team ?? null, teamProjectMap)
    const supervisorResult = resolveSupervisorProject(user.id, supervisorProjects)
    const resolvedProjectId = teamProjectId ?? supervisorResult.projectId ?? null
    const source = teamProjectId ? 'team' : supervisorResult.projectId ? 'supervisor' : null

    if (supervisorResult.conflict) {
      conflictSupervisors.push(user.id)
    }

    if (!teamProjectId && user.expatProfile?.team) {
      missingTeamProjects.push(user.id)
    }

    if (currentProjectId) {
      activeAssignments += 1
      if (resolvedProjectId && currentProjectId !== resolvedProjectId) {
        mismatchedAssignments.push({
          userId: user.id,
          current: currentProjectId,
          resolved: resolvedProjectId,
        })
      }
      return
    }

    if (resolvedProjectId && source) {
      updates.push({
        userId: user.id,
        projectId: resolvedProjectId,
        startDate: new Date(),
        fallbackStartDate: user.joinDate ?? null,
        source,
      })
    }
  })

  console.log(`Users scanned: ${users.length}`)
  console.log(`Current assignments present: ${activeAssignments}`)
  console.log(`Users without assignment: ${users.length - activeAssignments}`)
  console.log(`Assignments to add: ${updates.length}`)
  console.log(`Team bindings missing project: ${missingTeamProjects.length}`)
  console.log(`Supervisor project conflicts: ${conflictSupervisors.length}`)
  console.log(`Existing assignment mismatches: ${mismatchedAssignments.length}`)

  if (updates.length === 0) {
    console.log('No assignments to apply.')
    return
  }

  if (!confirm) {
    const preview = updates.slice(0, 5).map((item) => ({
      userId: item.userId,
      projectId: item.projectId,
      source: item.source,
    }))
    console.log('Dry run preview:', preview)
    console.log('Re-run with --confirm to apply changes.')
    return
  }

  const payloads = updates.map((item) => ({
    userId: item.userId,
    projectId: item.projectId,
    startDate: item.fallbackStartDate ?? item.startDate,
  }))
  const result = await prisma.userProjectAssignment.createMany({
    data: payloads,
  })
  console.log(`Applied ${result.count} project assignments.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
