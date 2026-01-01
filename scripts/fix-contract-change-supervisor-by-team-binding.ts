/**
 * Fix contract change supervisors to match the current team binding.
 *
 * Usage:
 *   npx tsx scripts/fix-contract-change-supervisor-by-team-binding.ts
 *   npx tsx scripts/fix-contract-change-supervisor-by-team-binding.ts --confirm
 *   npx tsx scripts/fix-contract-change-supervisor-by-team-binding.ts --limit 200
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'

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

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const limit = parseLimit()

  const bindings = await prisma.teamSupervisor.findMany({
    select: {
      team: true,
      teamKey: true,
      supervisorId: true,
      supervisorName: true,
    },
  })

  const supervisorIds = Array.from(new Set(bindings.map((binding) => binding.supervisorId)))
  const supervisors = await prisma.user.findMany({
    where: { id: { in: supervisorIds } },
    select: {
      id: true,
      name: true,
      username: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  const supervisorMap = new Map(
    supervisors.map((supervisor) => [
      supervisor.id,
      {
        name: supervisor.name,
        username: supervisor.username,
        frenchName: supervisor.chineseProfile?.frenchName ?? null,
      },
    ]),
  )

  const bindingMap = new Map(
    bindings.map((binding) => [binding.teamKey, binding]),
  )

  const supervisorLabelById = new Map<number, string | null>()
  supervisorIds.forEach((id) => {
    const bindingName = bindings.find((binding) => binding.supervisorId === id)
      ?.supervisorName
    const supervisor = supervisorMap.get(id)
    const label =
      normalizeOptionalText(bindingName) ??
      formatSupervisorLabel({
        name: supervisor?.name ?? null,
        frenchName: supervisor?.frenchName ?? null,
        username: supervisor?.username ?? null,
      }) ??
      null
    supervisorLabelById.set(id, label)
  })

  const changes = await prisma.userContractChange.findMany({
    where: {
      team: { not: null },
    },
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      team: true,
      chineseSupervisorId: true,
      chineseSupervisorName: true,
    },
    orderBy: [{ userId: 'asc' }, { id: 'asc' }],
  })

  const updates: Array<{
    id: number
    userId: number
    contractNumber: string | null
    team: string
    fromId: number | null
    fromName: string | null
    toId: number
    toName: string | null
  }> = []

  let missingBinding = 0

  changes.forEach((change) => {
    const teamKey = normalizeTeamKey(change.team ?? null)
    if (!teamKey) return
    const binding = bindingMap.get(teamKey)
    if (!binding) {
      missingBinding += 1
      return
    }
    if (change.chineseSupervisorId === binding.supervisorId) return

    updates.push({
      id: change.id,
      userId: change.userId,
      contractNumber: change.contractNumber ?? null,
      team: binding.team,
      fromId: change.chineseSupervisorId ?? null,
      fromName: change.chineseSupervisorName ?? null,
      toId: binding.supervisorId,
      toName: supervisorLabelById.get(binding.supervisorId) ?? null,
    })
  })

  console.log(`Contract changes scanned: ${changes.length}`)
  console.log(`Updates needed: ${updates.length}`)
  console.log(`Skipped (missing bindings): ${missingBinding}`)

  const preview = limit ? updates.slice(0, limit) : updates
  preview.forEach((item) => {
    console.log(
      `- #${item.id} user=${item.userId} ${item.contractNumber ?? 'no-contract'} ` +
        `team=${item.team} supervisor ${item.fromName ?? 'null'}(#${item.fromId ?? 'null'}) -> ` +
        `${item.toName ?? 'null'}(#${item.toId})`,
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
        prisma.userContractChange.update({
          where: { id: item.id },
          data: {
            chineseSupervisorId: item.toId,
            chineseSupervisorName: item.toName,
          },
        }),
      ),
    )
  }

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
