import { prisma } from '@/lib/prisma'
import { normalizeTeamKey } from '@/lib/members/utils'

type TeamSupervisorBinding = {
  teamKey: string
  supervisorId: number
}

export const resolveTeamSupervisorId = async (
  team?: string | null,
): Promise<number | null> => {
  const teamKey = normalizeTeamKey(team ?? null)
  if (!teamKey) return null
  const binding = await prisma.teamSupervisor.findUnique({
    where: { teamKey },
    select: { supervisorId: true },
  })
  return binding?.supervisorId ?? null
}

export const buildTeamSupervisorMap = async (
  teams: Array<string | null | undefined>,
): Promise<Map<string, TeamSupervisorBinding>> => {
  const keys = Array.from(
    new Set(
      teams
        .map((team) => normalizeTeamKey(team ?? null))
        .filter((key) => key.length > 0),
    ),
  )
  if (keys.length === 0) return new Map()
  const bindings = await prisma.teamSupervisor.findMany({
    where: { teamKey: { in: keys } },
    select: { teamKey: true, supervisorId: true },
  })
  return new Map(bindings.map((binding) => [binding.teamKey, binding]))
}
