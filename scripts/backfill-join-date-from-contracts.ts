/**
 * Backfill User.joinDate using the earliest contract start date.
 *
 * Usage:
 *   npx tsx scripts/backfill-join-date-from-contracts.ts
 *   npx tsx scripts/backfill-join-date-from-contracts.ts --confirm
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const resolveEarliestContractStart = (
  changes: Array<{ startDate: Date | null; changeDate: Date }>,
  profileStart: Date | null,
) => {
  let earliest: Date | null = null
  for (const change of changes) {
    const start = change.startDate ?? change.changeDate
    if (!start) continue
    if (!earliest || start.getTime() < earliest.getTime()) {
      earliest = start
    }
  }
  if (profileStart) {
    if (!earliest) {
      earliest = profileStart
    } else if (profileStart.getTime() < earliest.getTime()) {
      earliest = profileStart
    }
  }
  return earliest
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')

  const users = await prisma.user.findMany({
    where: { nationality: { not: 'china' } },
    select: {
      id: true,
      username: true,
      name: true,
      joinDate: true,
      expatProfile: { select: { contractStartDate: true } },
      contractChanges: { select: { startDate: true, changeDate: true } },
    },
  })

  const updates: Array<{ id: number; username: string; from: Date | null; to: Date }> = []

  users.forEach((user) => {
    const earliest = resolveEarliestContractStart(
      user.contractChanges ?? [],
      user.expatProfile?.contractStartDate ?? null,
    )
    if (!earliest) return
    if (!user.joinDate || user.joinDate.getTime() !== earliest.getTime()) {
      updates.push({
        id: user.id,
        username: user.username,
        from: user.joinDate,
        to: earliest,
      })
    }
  })

  if (updates.length === 0) {
    console.log('No joinDate updates required.')
    return
  }

  console.log(`JoinDate updates needed: ${updates.length}`)
  updates.slice(0, 20).forEach((item) => {
    console.log(
      `- ${item.username} (#${item.id}) ${item.from?.toISOString() ?? 'null'} -> ${item.to.toISOString()}`,
    )
  })
  if (updates.length > 20) {
    console.log(`...and ${updates.length - 20} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.user.update({
        where: { id: item.id },
        data: { joinDate: item.to },
      }),
    ),
  )

  console.log(`Updated ${updates.length} users.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
