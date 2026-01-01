/**
 * Backfill missing team/position on the latest contract change per user
 * using current expat profile team + user position.
 *
 * Usage:
 *   npx tsx scripts/backfill-latest-contract-change-team-position.ts
 *   npx tsx scripts/backfill-latest-contract-change-team-position.ts --confirm
 *   npx tsx scripts/backfill-latest-contract-change-team-position.ts --confirm --sync-profiles
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { applyLatestContractSnapshot } from '@/lib/server/contractChanges'

const prisma = new PrismaClient()

type LatestChange = {
  id: number
  userId: number
  contractNumber: string | null
  team: string | null
  position: string | null
  changeDate: Date
  startDate: Date | null
}

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const syncProfiles = process.argv.includes('--sync-profiles')

  const changes = await prisma.userContractChange.findMany({
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      team: true,
      position: true,
      changeDate: true,
      startDate: true,
    },
    orderBy: [
      { userId: 'asc' },
      { startDate: 'desc' },
      { changeDate: 'desc' },
      { id: 'desc' },
    ],
  })

  const latestByUser = new Map<number, LatestChange>()
  changes.forEach((change) => {
    if (!latestByUser.has(change.userId)) {
      latestByUser.set(change.userId, change)
    }
  })

  if (latestByUser.size === 0) {
    console.log('No contract changes found.')
    return
  }

  const userIds = Array.from(latestByUser.keys())
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      position: true,
      expatProfile: { select: { team: true } },
    },
  })
  const userMap = new Map(users.map((user) => [user.id, user]))

  const updates: Array<{
    id: number
    userId: number
    contractNumber: string | null
    team: string | null
    position: string | null
    nextTeam: string | null
    nextPosition: string | null
  }> = []

  latestByUser.forEach((latest, userId) => {
    const user = userMap.get(userId)
    if (!user) return
    const currentTeam = normalizeOptionalText(latest.team)
    const currentPosition = normalizeOptionalText(latest.position)
    const profileTeam = normalizeOptionalText(user.expatProfile?.team ?? null)
    const profilePosition = normalizeOptionalText(user.position ?? null)

    const nextTeam = currentTeam ?? profileTeam
    const nextPosition = currentPosition ?? profilePosition

    if (!currentTeam && nextTeam) {
      updates.push({
        id: latest.id,
        userId,
        contractNumber: latest.contractNumber ?? null,
        team: latest.team,
        position: latest.position,
        nextTeam,
        nextPosition: currentPosition ?? nextPosition,
      })
      return
    }

    if (!currentPosition && nextPosition) {
      updates.push({
        id: latest.id,
        userId,
        contractNumber: latest.contractNumber ?? null,
        team: latest.team,
        position: latest.position,
        nextTeam,
        nextPosition,
      })
    }
  })

  console.log(`Latest contract changes scanned: ${latestByUser.size}`)
  console.log(`Updates needed: ${updates.length}`)

  updates.slice(0, 20).forEach((item) => {
    console.log(
      `- #${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `team: ${item.team ?? 'null'} -> ${item.nextTeam ?? 'null'} ` +
        `position: ${item.position ?? 'null'} -> ${item.nextPosition ?? 'null'}`,
    )
  })
  if (updates.length > 20) {
    console.log(`...and ${updates.length - 20} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  if (updates.length === 0) {
    console.log('No updates to apply.')
    return
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.userContractChange.update({
        where: { id: item.id },
        data: {
          ...(normalizeOptionalText(item.team) ? {} : item.nextTeam ? { team: item.nextTeam } : {}),
          ...(normalizeOptionalText(item.position)
            ? {}
            : item.nextPosition
              ? { position: item.nextPosition }
              : {}),
        },
      }),
    ),
  )

  console.log(`Updated ${updates.length} contract change records.`)

  if (!syncProfiles) return

  const updatedUserIds = Array.from(new Set(updates.map((item) => item.userId)))
  for (const userId of updatedUserIds) {
    await prisma.$transaction(async (tx) => {
      await applyLatestContractSnapshot(tx, userId)
    })
  }
  console.log(`Synced ${updatedUserIds.length} expat profiles.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
