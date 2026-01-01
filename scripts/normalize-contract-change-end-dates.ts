/**
 * Normalize contract change + expat profile end dates to 2026-03-20 23:59:59 (UTC) when they exceed it.
 *
 * Usage:
 *   npx tsx scripts/normalize-contract-change-end-dates.ts
 *   npx tsx scripts/normalize-contract-change-end-dates.ts --confirm
 *   npx tsx scripts/normalize-contract-change-end-dates.ts --confirm --sync-profiles
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { applyLatestContractSnapshot } from '@/lib/server/contractChanges'

const prisma = new PrismaClient()

const cutoffUtc = new Date(Date.UTC(2026, 2, 20, 23, 59, 59))

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const syncProfiles = process.argv.includes('--sync-profiles')

  const changes = await prisma.userContractChange.findMany({
    where: { endDate: { gt: cutoffUtc } },
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      endDate: true,
    },
    orderBy: { endDate: 'desc' },
  })

  const profiles = await prisma.userExpatProfile.findMany({
    where: { contractEndDate: { gt: cutoffUtc } },
    select: {
      userId: true,
      contractNumber: true,
      contractEndDate: true,
    },
    orderBy: { contractEndDate: 'desc' },
  })

  if (changes.length === 0 && profiles.length === 0) {
    console.log('No contract change or expat profile end dates exceed the cutoff.')
    return
  }

  if (changes.length > 0) {
    console.log(`Contract changes to update: ${changes.length}`)
    changes.slice(0, 20).forEach((change) => {
      console.log(
        `- #${change.id} user=${change.userId} ${change.contractNumber ?? 'no-contract'} ` +
          `${change.endDate?.toISOString() ?? 'null'} -> ${cutoffUtc.toISOString()}`,
      )
    })
    if (changes.length > 20) {
      console.log(`...and ${changes.length - 20} more`)
    }
  }

  if (profiles.length > 0) {
    console.log(`Expat profiles to update: ${profiles.length}`)
    profiles.slice(0, 20).forEach((profile) => {
      console.log(
        `- user=${profile.userId} ${profile.contractNumber ?? 'no-contract'} ` +
          `${profile.contractEndDate?.toISOString() ?? 'null'} -> ${cutoffUtc.toISOString()}`,
      )
    })
    if (profiles.length > 20) {
      console.log(`...and ${profiles.length - 20} more`)
    }
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  if (changes.length > 0) {
    const result = await prisma.userContractChange.updateMany({
      where: { endDate: { gt: cutoffUtc } },
      data: { endDate: cutoffUtc },
    })
    console.log(`Updated ${result.count} contract change records.`)
  }

  if (profiles.length > 0) {
    const result = await prisma.userExpatProfile.updateMany({
      where: { contractEndDate: { gt: cutoffUtc } },
      data: { contractEndDate: cutoffUtc },
    })
    console.log(`Updated ${result.count} expat profiles.`)
  }

  if (!syncProfiles) return

  const userIds = Array.from(new Set(changes.map((change) => change.userId)))
  for (const userId of userIds) {
    await prisma.$transaction(async (tx) => {
      await applyLatestContractSnapshot(tx, userId)
    })
  }
  console.log(`Synced ${userIds.length} expat profiles.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
