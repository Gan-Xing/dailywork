/**
 * List contract change records where the supervisor changed between consecutive records.
 *
 * Usage:
 *   npx tsx scripts/list-contract-change-supervisor-changes.ts
 *   npx tsx scripts/list-contract-change-supervisor-changes.ts --limit 200
 *   npx tsx scripts/list-contract-change-supervisor-changes.ts --user 123
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

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

type Change = {
  id: number
  userId: number
  contractNumber: string | null
  contractType: string | null
  team: string | null
  position: string | null
  startDate: Date | null
  endDate: Date | null
  changeDate: Date
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
}

const resolveStart = (change: Change) => change.startDate ?? change.changeDate

const formatSupervisor = (change: Change) => {
  if (change.chineseSupervisorId === null) {
    return 'null'
  }
  return `${change.chineseSupervisorName ?? 'unknown'}(#${change.chineseSupervisorId})`
}

const main = async () => {
  const limit = parseLimit()
  const userId = parseUserId()

  const changes = await prisma.userContractChange.findMany({
    where: userId ? { userId } : undefined,
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      contractType: true,
      team: true,
      position: true,
      startDate: true,
      endDate: true,
      changeDate: true,
      chineseSupervisorId: true,
      chineseSupervisorName: true,
    },
  })

  const byUser = new Map<number, Change[]>()
  changes.forEach((change) => {
    const list = byUser.get(change.userId) ?? []
    list.push(change)
    byUser.set(change.userId, list)
  })

  const pairs: Array<{ userId: number; prev: Change; next: Change }> = []

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
      if (prev.chineseSupervisorId !== next.chineseSupervisorId) {
        pairs.push({ userId: prev.userId, prev, next })
      }
    }
  })

  console.log(`Found ${pairs.length} supervisor changes.`)
  if (pairs.length === 0) return

  const list = limit ? pairs.slice(0, limit) : pairs
  list.forEach((item) => {
    console.log(
      `user=${item.userId} prev#${item.prev.id} -> next#${item.next.id}`,
    )
    console.log(
      `  prev: change=${formatDate(item.prev.changeDate)} ` +
        `start=${formatDate(item.prev.startDate)} end=${formatDate(item.prev.endDate)} ` +
        `contract=${item.prev.contractNumber ?? 'no-contract'} ` +
        `${item.prev.contractType ?? 'unknown'} ` +
        `team=${item.prev.team ?? 'null'} position=${item.prev.position ?? 'null'} ` +
        `supervisor=${formatSupervisor(item.prev)}`,
    )
    console.log(
      `  next: change=${formatDate(item.next.changeDate)} ` +
        `start=${formatDate(item.next.startDate)} end=${formatDate(item.next.endDate)} ` +
        `contract=${item.next.contractNumber ?? 'no-contract'} ` +
        `${item.next.contractType ?? 'unknown'} ` +
        `team=${item.next.team ?? 'null'} position=${item.next.position ?? 'null'} ` +
        `supervisor=${formatSupervisor(item.next)}`,
    )
  })

  if (limit && pairs.length > limit) {
    console.log(`...and ${pairs.length - limit} more (increase with --limit).`)
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
