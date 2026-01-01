/**
 * List contract change records where team/supervisor does not match
 * the current TeamSupervisor binding.
 *
 * Usage:
 *   npx tsx scripts/list-contract-change-team-supervisor-mismatches.ts
 *   npx tsx scripts/list-contract-change-team-supervisor-mismatches.ts --output reports/contract-change-team-supervisor-mismatches.txt
 *   npx tsx scripts/list-contract-change-team-supervisor-mismatches.ts --limit 200
 *   npx tsx scripts/list-contract-change-team-supervisor-mismatches.ts --with-history
 */
/* eslint-disable no-console */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { normalizeTeamKey } from '@/lib/members/utils'

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

const parseOutputPath = () => {
  const args = process.argv
  const index = args.indexOf('--output')
  if (index === -1) return null
  const raw = args[index + 1]
  if (!raw) return null
  return raw
}

const parseWithHistory = () => process.argv.includes('--with-history')

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

const formatSupervisor = (id: number | null, name: string | null) => {
  if (id !== null && id !== undefined) {
    return `${name ?? 'unknown'}(#${id})`
  }
  return name ?? 'null'
}

const main = async () => {
  const limit = parseLimit()
  const outputPath = parseOutputPath()
  const withHistory = parseWithHistory()

  const [bindings, changes] = await prisma.$transaction([
    prisma.teamSupervisor.findMany({
      select: {
        team: true,
        teamKey: true,
        supervisorId: true,
        supervisorName: true,
      },
    }),
    prisma.userContractChange.findMany({
      where: {
        team: { not: null },
      },
      select: {
        id: true,
        userId: true,
        contractNumber: true,
        contractType: true,
        team: true,
        chineseSupervisorId: true,
        chineseSupervisorName: true,
        startDate: true,
        endDate: true,
        changeDate: true,
      },
      orderBy: [{ userId: 'asc' }, { changeDate: 'asc' }, { id: 'asc' }],
    }),
  ])

  const bindingMap = new Map(
    bindings.map((binding) => [binding.teamKey, binding]),
  )

  const mismatches: Array<{
    change: typeof changes[number]
    reason: 'missing-binding' | 'supervisor-mismatch'
    binding: typeof bindings[number] | null
  }> = []

  changes.forEach((change) => {
    const key = normalizeTeamKey(change.team ?? null)
    if (!key) return
    const binding = bindingMap.get(key) ?? null
    if (!binding) {
      mismatches.push({ change, reason: 'missing-binding', binding: null })
      return
    }
    if (change.chineseSupervisorId !== binding.supervisorId) {
      mismatches.push({ change, reason: 'supervisor-mismatch', binding })
    }
  })

  const header = `Found ${mismatches.length} contract change records with team/supervisor mismatch.`
  if (mismatches.length === 0) {
    console.log(header)
    return
  }

  const list = limit ? mismatches.slice(0, limit) : mismatches
  const mismatchedUserIds = Array.from(
    new Set(list.map((item) => item.change.userId)),
  )
  const [users, history] = withHistory
    ? await prisma.$transaction([
        prisma.user.findMany({
          where: { id: { in: mismatchedUserIds } },
          select: { id: true, name: true, username: true },
        }),
        prisma.userContractChange.findMany({
          where: { userId: { in: mismatchedUserIds } },
          select: {
            id: true,
            userId: true,
            contractNumber: true,
            contractType: true,
            team: true,
            chineseSupervisorId: true,
            chineseSupervisorName: true,
            startDate: true,
            endDate: true,
            changeDate: true,
          },
          orderBy: [
            { userId: 'asc' },
            { startDate: 'asc' },
            { changeDate: 'asc' },
            { id: 'asc' },
          ],
        }),
      ])
    : [[], []]
  const userMap = new Map(users.map((user) => [user.id, user]))
  const historyByUser = new Map<number, typeof history>()
  if (withHistory) {
    history.forEach((change) => {
      const list = historyByUser.get(change.userId) ?? []
      list.push(change)
      historyByUser.set(change.userId, list)
    })
  }
  const lines: string[] = []
  lines.push(header)
  if (limit && mismatches.length > limit) {
    lines.push(`Showing first ${limit} of ${mismatches.length} records.`)
  }
  lines.push('')

  const reasonCounts = new Map<string, number>()
  list.forEach((item) => {
    reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1)
  })
  lines.push('Reason Counts')
  Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      lines.push(`- ${reason}: ${count}`)
    })
  lines.push('')
  lines.push('Details')

  if (!withHistory) {
    list.forEach((item) => {
      const change = item.change
      const binding = item.binding
      lines.push(
        `#${change.id} user=${change.userId} ${change.contractNumber ?? 'no-contract'} ` +
          `${change.contractType ?? 'unknown'} reason=${item.reason}`,
      )
      lines.push(
        `  change: team=${change.team ?? 'null'} ` +
          `supervisor=${formatSupervisor(
            change.chineseSupervisorId,
            change.chineseSupervisorName ?? null,
          )} ` +
          `start=${formatDate(change.startDate)} end=${formatDate(
            change.endDate,
          )} change=${formatDate(change.changeDate)}`,
      )
      lines.push(
        `  binding: team=${binding?.team ?? 'null'} ` +
          `supervisor=${formatSupervisor(
            binding?.supervisorId ?? null,
            binding?.supervisorName ?? null,
          )}`,
      )
    })
  } else {
    const mismatchesByUser = new Map<number, typeof list>()
    list.forEach((item) => {
      const group = mismatchesByUser.get(item.change.userId) ?? []
      group.push(item)
      mismatchesByUser.set(item.change.userId, group)
    })
    mismatchesByUser.forEach((items, userId) => {
      const user = userMap.get(userId)
      lines.push(
        `user=${userId} name=${user?.name ?? user?.username ?? 'unknown'}`,
      )
      items.forEach((item) => {
        const change = item.change
        const binding = item.binding
        lines.push(
          `  mismatch#${change.id} ${change.contractNumber ?? 'no-contract'} ` +
            `${change.contractType ?? 'unknown'} reason=${item.reason}`,
        )
        lines.push(
          `    change: team=${change.team ?? 'null'} ` +
            `supervisor=${formatSupervisor(
              change.chineseSupervisorId,
              change.chineseSupervisorName ?? null,
            )} ` +
            `start=${formatDate(change.startDate)} end=${formatDate(
              change.endDate,
            )} change=${formatDate(change.changeDate)}`,
        )
        lines.push(
          `    binding: team=${binding?.team ?? 'null'} ` +
            `supervisor=${formatSupervisor(
              binding?.supervisorId ?? null,
              binding?.supervisorName ?? null,
            )}`,
        )
      })
      const historyList = historyByUser.get(userId) ?? []
      if (historyList.length > 0) {
        lines.push('  all contract changes:')
        historyList.forEach((change) => {
          lines.push(
            `    #${change.id} ${change.contractNumber ?? 'no-contract'} ` +
              `${change.contractType ?? 'unknown'} team=${change.team ?? 'null'} ` +
              `supervisor=${formatSupervisor(
                change.chineseSupervisorId,
                change.chineseSupervisorName ?? null,
              )} start=${formatDate(change.startDate)} end=${formatDate(
                change.endDate,
              )} change=${formatDate(change.changeDate)}`,
          )
        })
      }
      lines.push('')
    })
  }

  if (outputPath) {
    const dir = path.dirname(outputPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8')
    console.log(header)
    console.log(`Wrote report to ${outputPath}`)
    return
  }

  console.log(lines.join('\n'))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
