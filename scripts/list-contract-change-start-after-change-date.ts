/**
 * List contract change records where startDate is after changeDate.
 *
 * Usage:
 *   npx tsx scripts/list-contract-change-start-after-change-date.ts
 *   npx tsx scripts/list-contract-change-start-after-change-date.ts --limit 200
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

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

const main = async () => {
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
    if (!change.startDate || !change.changeDate) return false
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

  console.log(
    `Found ${suspicious.length} contract change records where startDate > changeDate.`,
  )
  console.log(
    `Keeping ${filtered.length} earliest changeDate record(s) per user.`,
  )
  if (filtered.length === 0) return

  const list = limit ? filtered.slice(0, limit) : filtered
  list.forEach((item) => {
    console.log(
      `#${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `${item.contractType ?? 'unknown'} ` +
        `change=${formatDate(item.changeDate)} start=${formatDate(item.startDate)} end=${formatDate(item.endDate)}`,
    )
  })

  if (limit && suspicious.length > limit) {
    console.log(`...and ${suspicious.length - limit} more (increase with --limit).`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
