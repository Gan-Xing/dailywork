/**
 * Fix payroll payouts to match the active contract change's team/supervisor
 * for selected supervisors.
 *
 * Targets:
 * - 甘星 / Franck
 * - 何柳琴 / HeLiuqin
 * - 刘晓杰 / LiuXiaojie
 * - 周泽华 / ZhouZehua
 * - 陈智 / ChenZhi
 *
 * Usage:
 *   npx tsx scripts/fix-payouts-by-contract-for-supervisors.ts
 *   npx tsx scripts/fix-payouts-by-contract-for-supervisors.ts --confirm
 *   npx tsx scripts/fix-payouts-by-contract-for-supervisors.ts --limit 200
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { formatSupervisorLabel } from '@/lib/members/utils'

const prisma = new PrismaClient()

const TARGET_KEYWORDS = [
  '甘星',
  'franck',
  '何柳琴',
  'heliuqin',
  '刘晓杰',
  'liuxiaojie',
  '周泽华',
  'zhouzehua',
  '陈智',
  'chenzhi',
  '姚国防',
  'yaoguofang',
  '王栋',
  'wangdong',
  '田都娃',
  'tianduwa',
  '杜钦',
  'duqin',
  'chris',
]

const parseLimit = () => {
  const args = process.argv
  const index = args.indexOf('--limit')
  if (index === -1) return null
  const raw = args[index + 1]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

const normalizeKey = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed.toLowerCase() : null
}

const matchesTarget = (value: string | null) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return TARGET_KEYWORDS.some((keyword) => lower.includes(keyword))
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

const resolveSupervisorLabel = (
  id: number | null,
  name: string | null,
  supervisorMap: Map<number, string | null>,
) => {
  if (name) return name
  if (id === null) return null
  return supervisorMap.get(id) ?? null
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
  const confirm = process.argv.includes('--confirm')
  const limit = parseLimit()

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
  const changes = await prisma.userContractChange.findMany({
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
  })

  const supervisorIds = Array.from(
    new Set(
      payouts
        .map((payout) => payout.chineseSupervisorId)
        .concat(changes.map((change) => change.chineseSupervisorId))
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  const supervisors = supervisorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: supervisorIds } },
        select: {
          id: true,
          name: true,
          username: true,
          chineseProfile: { select: { frenchName: true } },
        },
      })
    : []

  const supervisorMap = new Map(
    supervisors.map((supervisor) => [
      supervisor.id,
      formatSupervisorLabel({
        name: supervisor.name,
        frenchName: supervisor.chineseProfile?.frenchName ?? null,
        username: supervisor.username,
      }) ?? null,
    ]),
  )

  const changesByUser = new Map<number, ContractChange[]>()
  changes.forEach((change) => {
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

  const updates: Array<{
    payoutId: number
    userId: number
    payoutDate: Date
    fromTeam: string | null
    toTeam: string | null
    fromSupervisorId: number | null
    toSupervisorId: number | null
    toSupervisorName: string | null
  }> = []

  payoutsByUser.forEach((userPayouts, userId) => {
    const userChanges = changesByUser.get(userId) ?? []
    if (userChanges.length === 0) return

    let changeIndex = 0
    let active: ContractChange | null = null

    userPayouts.forEach((payout) => {
      while (
        changeIndex < userChanges.length &&
        resolveStart(userChanges[changeIndex]).getTime() <=
          payout.payoutDate.getTime()
      ) {
        active = userChanges[changeIndex]
        changeIndex += 1
      }

      if (!active) return
      if (active.endDate && active.endDate.getTime() < payout.payoutDate.getTime()) {
        return
      }

      const teamMatch = isTeamMatch(payout.team, active.team)
      const supervisorMatch = isSupervisorMatch(
        payout.chineseSupervisorId,
        payout.chineseSupervisorName,
        active.chineseSupervisorId,
        active.chineseSupervisorName,
      )
      if (teamMatch && supervisorMatch) return

      const payoutLabel = resolveSupervisorLabel(
        payout.chineseSupervisorId,
        payout.chineseSupervisorName ?? null,
        supervisorMap,
      )
      const contractLabel = resolveSupervisorLabel(
        active.chineseSupervisorId,
        active.chineseSupervisorName ?? null,
        supervisorMap,
      )

      if (!matchesTarget(payoutLabel) && !matchesTarget(contractLabel)) {
        return
      }

      updates.push({
        payoutId: payout.id,
        userId,
        payoutDate: payout.payoutDate,
        fromTeam: payout.team ?? null,
        toTeam: active.team ?? null,
        fromSupervisorId: payout.chineseSupervisorId ?? null,
        toSupervisorId: active.chineseSupervisorId ?? null,
        toSupervisorName: active.chineseSupervisorName ?? null,
      })
    })
  })

  console.log(`Payouts scanned: ${payouts.length}`)
  console.log(`Updates needed: ${updates.length}`)

  const preview = limit ? updates.slice(0, limit) : updates
  preview.forEach((item) => {
    console.log(
      `- payout#${item.payoutId} user=${item.userId} date=${item.payoutDate.toISOString()} ` +
        `team ${item.fromTeam ?? 'null'} -> ${item.toTeam ?? 'null'} ` +
        `supervisor ${item.fromSupervisorId ?? 'null'} -> ${item.toSupervisorId ?? 'null'}`,
    )
  })
  if (limit && updates.length > limit) {
    console.log(`...and ${updates.length - limit} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  if (updates.length === 0) {
    console.log('No updates to apply.')
    return
  }

  const batchSize = 100
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userPayrollPayout.update({
          where: { id: item.payoutId },
          data: {
            team: item.toTeam,
            chineseSupervisorId: item.toSupervisorId,
            chineseSupervisorName: item.toSupervisorName,
          },
        }),
      ),
    )
  }

  console.log(`Updated ${updates.length} payroll payout records.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
