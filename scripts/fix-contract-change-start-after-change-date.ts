/**
 * Fix contract change records where startDate > changeDate.
 *
 * Rules:
 * - changeDate stays unchanged.
 * - startDate becomes changeDate.
 * - endDate becomes oldStartDate - 1 day 23:59:59 UTC.
 *
 * Usage:
 *   npx tsx scripts/fix-contract-change-start-after-change-date.ts
 *   npx tsx scripts/fix-contract-change-start-after-change-date.ts --confirm
 *   npx tsx scripts/fix-contract-change-start-after-change-date.ts --confirm --sync-profiles
 *   npx tsx scripts/fix-contract-change-start-after-change-date.ts --confirm --limit 200
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { applyLatestContractSnapshot } from '@/lib/server/contractChanges'

const prisma = new PrismaClient()

const parseLimit = () => {
  const args = process.argv
  const index = args.indexOf('--limit')
  if (index === -1) return null
  const raw = args[index + 1]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

const toEndOfPreviousDayUtc = (value: Date) => {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth()
  const day = value.getUTCDate()
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
  const limit = parseLimit()

  const changes = await prisma.userContractChange.findMany({
    where: {
      startDate: { not: null },
    },
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

  const suspicious = changes.filter((change) => {
    if (!change.startDate) return false
    return change.startDate.getTime() > change.changeDate.getTime()
  })

  const earliestByUser = new Map<number, typeof suspicious[number]>()
  suspicious.forEach((change) => {
    const existing = earliestByUser.get(change.userId)
    if (!existing) {
      earliestByUser.set(change.userId, change)
      return
    }
    const currentTime = change.changeDate.getTime()
    const existingTime = existing.changeDate.getTime()
    if (currentTime < existingTime || (currentTime === existingTime && change.id < existing.id)) {
      earliestByUser.set(change.userId, change)
    }
  })

  const filtered = Array.from(earliestByUser.values())
  const list = limit ? filtered.slice(0, limit) : filtered

  console.log(
    `Found ${suspicious.length} contract change records where startDate > changeDate.`,
  )
  console.log(
    `Keeping ${filtered.length} earliest changeDate record(s) per user.`,
  )
  if (list.length === 0) return

  const updates = list
    .map((item) => {
      if (!item.startDate) return null
      const nextEnd = toEndOfPreviousDayUtc(item.startDate)
      if (nextEnd.getTime() < item.changeDate.getTime()) return null
      return {
        id: item.id,
        userId: item.userId,
        contractNumber: item.contractNumber,
        contractType: item.contractType,
        fromStart: item.startDate,
        fromEnd: item.endDate,
        changeDate: item.changeDate,
        nextStart: item.changeDate,
        nextEnd,
      }
    })
    .filter(Boolean) as Array<{
    id: number
    userId: number
    contractNumber: string | null
    contractType: string | null
    fromStart: Date
    fromEnd: Date | null
    changeDate: Date
    nextStart: Date
    nextEnd: Date
  }>

  if (updates.length === 0) {
    console.log('No valid updates after applying guardrails.')
    return
  }

  console.log(`Records to update: ${updates.length}`)
  updates.slice(0, 20).forEach((item) => {
    console.log(
      `- #${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `${item.contractType ?? 'unknown'} ` +
        `change=${formatDate(item.changeDate)} start=${formatDate(item.fromStart)} end=${formatDate(item.fromEnd)} ` +
        `=> start=${formatDate(item.nextStart)} end=${formatDate(item.nextEnd)}`,
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
      batch.map((item) =>
        prisma.userContractChange.update({
          where: { id: item.id },
          data: {
            startDate: item.nextStart,
            endDate: item.nextEnd,
          },
        }),
      ),
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
