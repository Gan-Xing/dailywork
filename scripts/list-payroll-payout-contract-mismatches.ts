/**
 * List members whose payroll payout team/supervisor does not match the
 * contract change that covers the payout date.
 *
 * Usage:
 *   npx tsx scripts/list-payroll-payout-contract-mismatches.ts
 *   npx tsx scripts/list-payroll-payout-contract-mismatches.ts --limit 200
 *   npx tsx scripts/list-payroll-payout-contract-mismatches.ts --only-team-supervisor
 *   npx tsx scripts/list-payroll-payout-contract-mismatches.ts --output reports/payout-mismatches.txt
 */
/* eslint-disable no-console */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

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

const parseOutputPath = () => {
  const args = process.argv
  const index = args.indexOf('--output')
  if (index === -1) return null
  const raw = args[index + 1]
  if (!raw) return null
  return raw
}

const parseOnlyTeamSupervisor = () =>
  process.argv.includes('--only-team-supervisor')

const normalizeKey = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed.toLowerCase() : null
}

type ContractChange = {
  id: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  startDate: Date | null
  endDate: Date | null
  changeDate: Date
}

type PayrollPayout = {
  id: number
  userId: number
  payoutDate: Date
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
}

const resolveStart = (change: ContractChange) => change.startDate ?? change.changeDate

const resolveActiveChange = (changes: ContractChange[], date: Date) => {
  let current: ContractChange | null = null
  for (const change of changes) {
    const start = resolveStart(change)
    if (start.getTime() > date.getTime()) break
    current = change
  }
  if (!current) return null
  if (current.endDate && current.endDate.getTime() < date.getTime()) {
    return null
  }
  return current
}

const formatDate = (value?: Date | null) => (value ? value.toISOString() : 'null')

const formatSupervisor = (id: number | null, name: string | null) => {
  if (id !== null && id !== undefined) {
    return `${name ?? 'unknown'}(#${id})`
  }
  return name ?? 'null'
}

const isTeamMatch = (left: string | null, right: string | null) => {
  const leftKey = normalizeKey(left)
  const rightKey = normalizeKey(right)
  return leftKey === rightKey
}

const isSupervisorMatch = (
  leftId: number | null,
  leftName: string | null,
  rightId: number | null,
  rightName: string | null,
) => {
  if (leftId !== null && rightId !== null) {
    return leftId === rightId
  }
  const leftKey = normalizeKey(leftName)
  const rightKey = normalizeKey(rightName)
  if (!leftKey && !rightKey) return true
  return leftKey === rightKey
}

const main = async () => {
  const limit = parseLimit()
  const outputPath = parseOutputPath()
  const onlyTeamSupervisor = parseOnlyTeamSupervisor()

  const payouts = await prisma.userPayrollPayout.findMany({
    select: {
      id: true,
      userId: true,
      payoutDate: true,
      team: true,
      chineseSupervisorId: true,
      chineseSupervisorName: true,
    },
    orderBy: [{ userId: 'asc' }, { payoutDate: 'asc' }, { id: 'asc' }],
  })

  if (payouts.length === 0) {
    console.log('No payroll payouts found.')
    return
  }

  const userIds = Array.from(new Set(payouts.map((payout) => payout.userId)))

  const [users, contractChanges] = await prisma.$transaction([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, username: true },
    }),
    prisma.userContractChange.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
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

  const userMap = new Map(users.map((user) => [user.id, user]))

  const changesByUser = new Map<number, ContractChange[]>()
  contractChanges.forEach((change) => {
    const list = changesByUser.get(change.userId) ?? []
    list.push(change)
    changesByUser.set(change.userId, list)
  })

  const payoutsByUser = new Map<number, PayrollPayout[]>()
  payouts.forEach((payout) => {
    const list = payoutsByUser.get(payout.userId) ?? []
    list.push(payout)
    payoutsByUser.set(payout.userId, list)
  })

  const mismatches: Array<{
    userId: number
    userName: string
    payout: PayrollPayout
    change: ContractChange | null
    mismatch: string[]
  }> = []

  const reported = new Set<number>()

  payoutsByUser.forEach((userPayouts, userId) => {
    const changes = changesByUser.get(userId) ?? []
    if (reported.has(userId)) return
    for (const payout of userPayouts) {
      const active = resolveActiveChange(changes, payout.payoutDate)
      if (!active) {
        if (onlyTeamSupervisor) {
          continue
        }
        mismatches.push({
          userId,
          userName:
            userMap.get(userId)?.name ?? userMap.get(userId)?.username ?? 'unknown',
          payout,
          change: null,
          mismatch: ['no-contract'],
        })
        reported.add(userId)
        break
      }
      const teamMatch = isTeamMatch(payout.team, active.team)
      const supervisorMatch = isSupervisorMatch(
        payout.chineseSupervisorId,
        payout.chineseSupervisorName,
        active.chineseSupervisorId,
        active.chineseSupervisorName,
      )
      if (!teamMatch || !supervisorMatch) {
        const mismatch: string[] = []
        if (!teamMatch) mismatch.push('team')
        if (!supervisorMatch) mismatch.push('supervisor')
        mismatches.push({
          userId,
          userName:
            userMap.get(userId)?.name ?? userMap.get(userId)?.username ?? 'unknown',
          payout,
          change: active,
          mismatch,
        })
        reported.add(userId)
        break
      }
    }
  })

  const header = `Found ${mismatches.length} members with payout/contract mismatches.`
  if (mismatches.length === 0) {
    console.log(header)
    return
  }

  const list = limit ? mismatches.slice(0, limit) : mismatches

  const lines: string[] = []
  lines.push(header)
  if (onlyTeamSupervisor) {
    lines.push('Filtered: team/supervisor mismatches only (no-contract excluded).')
  }
  if (limit && mismatches.length > limit) {
    lines.push(`Showing first ${limit} of ${mismatches.length} records.`)
  }
  lines.push('')

  const payoutTeamGroups = new Map<string, number>()
  const contractTeamGroups = new Map<string, number>()
  const payoutSupervisorGroups = new Map<string, number>()
  const contractSupervisorGroups = new Map<string, number>()

  list.forEach((item) => {
    const payout = item.payout
    const change = item.change
    const payoutTeam = payout.team ?? 'null'
    const contractTeam = change?.team ?? 'null'
    const payoutSupervisor = formatSupervisor(
      payout.chineseSupervisorId,
      payout.chineseSupervisorName ?? null,
    )
    const contractSupervisor = change
      ? formatSupervisor(change.chineseSupervisorId, change.chineseSupervisorName ?? null)
      : 'null'

    payoutTeamGroups.set(payoutTeam, (payoutTeamGroups.get(payoutTeam) ?? 0) + 1)
    contractTeamGroups.set(
      contractTeam,
      (contractTeamGroups.get(contractTeam) ?? 0) + 1,
    )
    payoutSupervisorGroups.set(
      payoutSupervisor,
      (payoutSupervisorGroups.get(payoutSupervisor) ?? 0) + 1,
    )
    contractSupervisorGroups.set(
      contractSupervisor,
      (contractSupervisorGroups.get(contractSupervisor) ?? 0) + 1,
    )
  })

  const formatGroup = (title: string, groups: Map<string, number>) => {
    lines.push(title)
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1])
    sorted.forEach(([key, count]) => {
      lines.push(`- ${key}: ${count}`)
    })
    lines.push('')
  }

  formatGroup('Payout Team Counts', payoutTeamGroups)
  formatGroup('Contract Team Counts', contractTeamGroups)
  formatGroup('Payout Supervisor Counts', payoutSupervisorGroups)
  formatGroup('Contract Supervisor Counts', contractSupervisorGroups)

  lines.push('Details')
  list.forEach((item) => {
    const payout = item.payout
    const change = item.change
    lines.push(`user=${item.userId} name=${item.userName}`)
    lines.push(
      `  payout#${payout.id} date=${formatDate(payout.payoutDate)} ` +
        `team=${payout.team ?? 'null'} ` +
        `supervisor=${formatSupervisor(
          payout.chineseSupervisorId,
          payout.chineseSupervisorName ?? null,
        )}`,
    )
    if (!change) {
      lines.push('  contract=none (no active contract for payout date)')
    } else {
      lines.push(
        `  contract#${change.id} start=${formatDate(resolveStart(change))} ` +
          `end=${formatDate(change.endDate)} ` +
          `team=${change.team ?? 'null'} ` +
          `supervisor=${formatSupervisor(
            change.chineseSupervisorId,
            change.chineseSupervisorName ?? null,
          )}`,
      )
    }
    lines.push(`  mismatch=${item.mismatch.join(',')}`)
  })

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
