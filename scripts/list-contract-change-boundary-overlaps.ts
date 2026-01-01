/**
 * List contract change pairs where previous endDate is on/after next startDate.
 *
 * Usage:
 *   npx tsx scripts/list-contract-change-boundary-overlaps.ts
 *   npx tsx scripts/list-contract-change-boundary-overlaps.ts --limit 200
 *   npx tsx scripts/list-contract-change-boundary-overlaps.ts --user 123
 *   npx tsx scripts/list-contract-change-boundary-overlaps.ts --confirm
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

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

const parseUserId = () => {
  const args = process.argv
  const index = args.indexOf('--user')
  if (index === -1) return null
  const raw = args[index + 1]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

const parseConfirm = () => process.argv.includes('--confirm')

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

const sameUtcDay = (left: Date, right: Date) =>
  left.getUTCFullYear() === right.getUTCFullYear() &&
  left.getUTCMonth() === right.getUTCMonth() &&
  left.getUTCDate() === right.getUTCDate()

type Change = {
  id: number
  userId: number
  contractNumber: string | null
  contractType: string | null
  startDate: Date | null
  endDate: Date | null
  changeDate: Date
}

const resolveStart = (change: Change) => change.startDate ?? change.changeDate

const buildEndBeforeNext = (nextStart: Date) => {
  const year = nextStart.getUTCFullYear()
  const month = nextStart.getUTCMonth()
  const day = nextStart.getUTCDate()
  return new Date(Date.UTC(year, month, day - 1, 23, 59, 59, 0))
}

const main = async () => {
  const limit = parseLimit()
  const userId = parseUserId()
  const confirm = parseConfirm()

  const changes = await prisma.userContractChange.findMany({
    where: userId ? { userId } : undefined,
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      contractType: true,
      startDate: true,
      endDate: true,
      changeDate: true,
    },
    orderBy: [{ userId: 'asc' }, { changeDate: 'asc' }, { id: 'asc' }],
  })

  const byUser = new Map<number, Change[]>()
  changes.forEach((change) => {
    const list = byUser.get(change.userId) ?? []
    list.push(change)
    byUser.set(change.userId, list)
  })

  const flagged: Array<{
    userId: number
    prev: Change
    next: Change
    nextStart: Date
    prevStart: Date
  }> = []

  byUser.forEach((list) => {
    const sorted = list.slice().sort((left, right) => {
      const leftStart = resolveStart(left).getTime()
      const rightStart = resolveStart(right).getTime()
      if (leftStart !== rightStart) return leftStart - rightStart
      const leftChange = left.changeDate.getTime()
      const rightChange = right.changeDate.getTime()
      if (leftChange !== rightChange) return leftChange - rightChange
      return left.id - right.id
    })

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const prev = sorted[i]
      const next = sorted[i + 1]
      if (!prev.endDate) continue
      const nextStart = resolveStart(next)
      const prevStart = resolveStart(prev)
      if (prev.endDate.getTime() >= nextStart.getTime()) {
        flagged.push({ userId: prev.userId, prev, next, nextStart, prevStart })
      }
    }
  })

  console.log(
    `Found ${flagged.length} contract change boundary overlaps (endDate >= next startDate).`,
  )
  if (flagged.length === 0) return

  const list = limit ? flagged.slice(0, limit) : flagged
  const updates: Array<{ id: number; userId: number; oldEnd: Date; newEnd: Date }> = []
  const skipped: Array<{
    id: number
    userId: number
    prevStart: Date
    nextStart: Date
    prev: Change
    next: Change
  }> = []

  list.forEach((item) => {
    const isSameDay = sameUtcDay(item.prev.endDate as Date, item.nextStart)
    const newEnd = buildEndBeforeNext(item.nextStart)
    if (newEnd.getTime() < item.prevStart.getTime()) {
      skipped.push({
        id: item.prev.id,
        userId: item.userId,
        prevStart: item.prevStart,
        nextStart: item.nextStart,
        prev: item.prev,
        next: item.next,
      })
    } else {
      updates.push({
        id: item.prev.id,
        userId: item.userId,
        oldEnd: item.prev.endDate as Date,
        newEnd,
      })
    }
    console.log(
      `user=${item.userId} ` +
        `prev#${item.prev.id} ${item.prev.contractNumber ?? 'no-contract'} ` +
        `${item.prev.contractType ?? 'unknown'} ` +
        `end=${formatDate(item.prev.endDate)} ` +
        `next#${item.next.id} ${item.next.contractNumber ?? 'no-contract'} ` +
        `${item.next.contractType ?? 'unknown'} ` +
        `start=${formatDate(item.nextStart)} ` +
        `-> newEnd=${formatDate(newEnd)} ` +
        (isSameDay ? '[same-day]' : ''),
    )
  })

  if (limit && flagged.length > limit) {
    console.log(`...and ${flagged.length - limit} more (increase with --limit).`)
  }

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} updates where new end < previous start.`)
    const printedUsers = new Set<number>()
    skipped.forEach((item) => {
      if (printedUsers.has(item.userId)) return
      printedUsers.add(item.userId)
      const list = byUser.get(item.userId) ?? []
      const sorted = list.slice().sort((left, right) => {
        const leftStart = resolveStart(left).getTime()
        const rightStart = resolveStart(right).getTime()
        if (leftStart !== rightStart) return leftStart - rightStart
        const leftChange = left.changeDate.getTime()
        const rightChange = right.changeDate.getTime()
        if (leftChange !== rightChange) return leftChange - rightChange
        return left.id - right.id
      })
      console.log(
        `skip user=${item.userId} prev#${item.prev.id} next#${item.next.id} ` +
          `prevStart=${formatDate(item.prevStart)} nextStart=${formatDate(item.nextStart)}`,
      )
      console.log('related contract changes:')
      sorted.forEach((change) => {
        console.log(
          `#${change.id} ${change.contractNumber ?? 'no-contract'} ` +
            `${change.contractType ?? 'unknown'} ` +
            `change=${formatDate(change.changeDate)} ` +
            `start=${formatDate(change.startDate)} ` +
            `end=${formatDate(change.endDate)}`,
        )
      })
    })
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply endDate updates.')
    return
  }

  if (updates.length === 0) {
    console.log('No updates to apply.')
    return
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.userContractChange.update({
        where: { id: update.id },
        data: { endDate: update.newEnd },
      }),
    ),
  )

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
