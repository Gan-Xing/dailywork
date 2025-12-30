/**
 * Backfill expatProfile.chineseSupervisorId from team supervisor bindings.
 *
 * Usage:
 *   npx tsx scripts/backfill-team-supervisors.ts
 *   npx tsx scripts/backfill-team-supervisors.ts --confirm
 */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { normalizeTeamKey } from '@/lib/members/utils'

const prisma = new PrismaClient()

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const bindings = await prisma.teamSupervisor.findMany({
    select: { teamKey: true, supervisorId: true },
  })

  if (bindings.length === 0) {
    console.log('No team supervisor bindings found.')
    return
  }

  const bindingMap = new Map<string, number>()
  bindings.forEach((binding) => {
    if (binding.teamKey) bindingMap.set(binding.teamKey, binding.supervisorId)
  })

  const profiles = await prisma.userExpatProfile.findMany({
    select: { userId: true, team: true, chineseSupervisorId: true },
  })

  const updates: Array<{ userId: number; from: number | null; to: number }> = []
  profiles.forEach((profile) => {
    const teamKey = normalizeTeamKey(profile.team)
    if (!teamKey) return
    const supervisorId = bindingMap.get(teamKey)
    if (!supervisorId) return
    if (profile.chineseSupervisorId !== supervisorId) {
      updates.push({
        userId: profile.userId,
        from: profile.chineseSupervisorId ?? null,
        to: supervisorId,
      })
    }
  })

  if (updates.length === 0) {
    console.log('No expat profiles require supervisor updates.')
    return
  }

  if (!confirm) {
    console.log(`Dry run: ${updates.length} profiles would be updated.`)
    console.log('Re-run with --confirm to apply changes.')
    return
  }

  const results = await prisma.$transaction(
    updates.map((item) =>
      prisma.userExpatProfile.update({
        where: { userId: item.userId },
        data: { chineseSupervisorId: item.to },
      }),
    ),
  )

  console.log(`Updated ${results.length} expat profiles.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
