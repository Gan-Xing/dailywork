/**
 * Normalize overlapping contract changes by trimming each previous end date
 * to the day before the next contract start (23:59:59 UTC).
 *
 * Usage:
 *   npx tsx scripts/normalize-contract-change-overlaps.ts
 *   npx tsx scripts/normalize-contract-change-overlaps.ts --confirm
 *   npx tsx scripts/normalize-contract-change-overlaps.ts --confirm --sync-profiles
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { applyLatestContractSnapshot } from '@/lib/server/contractChanges'

const prisma = new PrismaClient()

type ContractChange = {
  id: number
  userId: number
  contractNumber: string | null
  contractType: string | null
  startDate: Date | null
  changeDate: Date
  endDate: Date | null
}

const resolveEffectiveStart = (change: ContractChange) =>
  change.startDate ?? change.changeDate

const toEndOfPreviousDayUtc = (startDate: Date) => {
  const year = startDate.getUTCFullYear()
  const month = startDate.getUTCMonth()
  const day = startDate.getUTCDate()
  return new Date(Date.UTC(year, month, day - 1, 23, 59, 59))
}

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const syncProfiles = process.argv.includes('--sync-profiles')

  const changes = await prisma.userContractChange.findMany({
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      contractType: true,
      startDate: true,
      changeDate: true,
      endDate: true,
    },
    orderBy: [{ userId: 'asc' }, { changeDate: 'asc' }, { id: 'asc' }],
  })

  const changesByUser = new Map<number, ContractChange[]>()
  changes.forEach((change) => {
    const list = changesByUser.get(change.userId) ?? []
    list.push(change)
    changesByUser.set(change.userId, list)
  })

  const updates: Array<{
    id: number
    userId: number
    contractNumber: string | null
    from: Date | null
    to: Date
    nextStart: Date
    adjustStart: boolean
    changeDate: Date
  }> = []

  changesByUser.forEach((list) => {
    const sorted = list.slice().sort((left, right) => {
      const leftStart = resolveEffectiveStart(left).getTime()
      const rightStart = resolveEffectiveStart(right).getTime()
      if (leftStart !== rightStart) return leftStart - rightStart
      const leftChange = left.changeDate.getTime()
      const rightChange = right.changeDate.getTime()
      if (leftChange !== rightChange) return leftChange - rightChange
      return left.id - right.id
    })

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i]
      const next = sorted[i + 1]
      const currentStart = resolveEffectiveStart(current)
      const nextStart = resolveEffectiveStart(next)
      const nextStartTime = nextStart.getTime()
      const currentStartTime = currentStart.getTime()
      const isSameStart = currentStartTime === nextStartTime
      if (currentStartTime > nextStartTime) continue
      if (isSameStart && current.changeDate.getTime() >= nextStartTime) continue
      const proposedEnd = toEndOfPreviousDayUtc(nextStart)
      if (proposedEnd.getTime() < currentStartTime && !isSameStart) continue
      const shouldUpdate =
        current.endDate === null || current.endDate.getTime() >= nextStartTime
      if (!shouldUpdate) continue
      if (current.endDate && current.endDate.getTime() === proposedEnd.getTime()) continue
      const shouldAdjustStart =
        Boolean(current.startDate) &&
        proposedEnd.getTime() < (current.startDate?.getTime() ?? 0) &&
        current.changeDate.getTime() <= proposedEnd.getTime()
      if (!shouldAdjustStart && proposedEnd.getTime() < currentStartTime) {
        continue
      }
      updates.push({
        id: current.id,
        userId: current.userId,
        contractNumber: current.contractNumber,
        from: current.endDate,
        to: proposedEnd,
        nextStart,
        adjustStart: shouldAdjustStart,
        changeDate: current.changeDate,
      })
    }
  })

  if (updates.length === 0) {
    console.log('No overlapping contract changes found.')
    return
  }

  console.log(`Contract changes to update: ${updates.length}`)
  updates.slice(0, 20).forEach((item) => {
    console.log(
      `- #${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `${item.from?.toISOString() ?? 'null'} -> ${item.to.toISOString()} ` +
        `(next ${item.nextStart.toISOString()})` +
        (item.adjustStart ? ' [adjust startDate]' : ''),
    )
  })
  if (updates.length > 20) {
    console.log(`...and ${updates.length - 20} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  const batches = chunk(updates, 200)
  for (const batch of batches) {
    await prisma.$transaction(
      batch.map((item) => {
        const data: { endDate: Date; startDate?: Date } = { endDate: item.to }
        if (item.adjustStart) {
          data.startDate = item.changeDate
        }
        return prisma.userContractChange.update({
          where: { id: item.id },
          data,
        })
      }),
    )
  }
  console.log(`Updated ${updates.length} contract change records.`)

  if (!syncProfiles) return

  const userIds = Array.from(new Set(updates.map((item) => item.userId)))
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
