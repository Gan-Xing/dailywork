/**
 * Backfill chineseSupervisorName snapshots with unified formatting.
 *
 * Usage:
 *   npx tsx scripts/backfill-supervisor-names.ts
 */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { formatSupervisorLabel } from '@/lib/members/utils'

const prisma = new PrismaClient()

const collectSupervisorIds = async () => {
  const [contractIds, payrollIds, payoutIds] = await prisma.$transaction([
    prisma.userContractChange.findMany({
      where: { chineseSupervisorId: { not: null } },
      select: { chineseSupervisorId: true },
      distinct: ['chineseSupervisorId'],
    }),
    prisma.userPayrollChange.findMany({
      where: { chineseSupervisorId: { not: null } },
      select: { chineseSupervisorId: true },
      distinct: ['chineseSupervisorId'],
    }),
    prisma.userPayrollPayout.findMany({
      where: { chineseSupervisorId: { not: null } },
      select: { chineseSupervisorId: true },
      distinct: ['chineseSupervisorId'],
    }),
  ])

  const ids = new Set<number>()
  contractIds.forEach((item) => {
    if (item.chineseSupervisorId) ids.add(item.chineseSupervisorId)
  })
  payrollIds.forEach((item) => {
    if (item.chineseSupervisorId) ids.add(item.chineseSupervisorId)
  })
  payoutIds.forEach((item) => {
    if (item.chineseSupervisorId) ids.add(item.chineseSupervisorId)
  })
  return Array.from(ids)
}

const main = async () => {
  const supervisorIds = await collectSupervisorIds()
  if (supervisorIds.length === 0) {
    console.log('No supervisor snapshots to update.')
    return
  }

  const supervisors = await prisma.user.findMany({
    where: { id: { in: supervisorIds } },
    select: {
      id: true,
      name: true,
      username: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })

  let updatedRecords = 0
  for (const supervisor of supervisors) {
    const label =
      formatSupervisorLabel({
        name: supervisor.name,
        frenchName: supervisor.chineseProfile?.frenchName ?? null,
        username: supervisor.username,
      }) || null
    if (!label) continue
    const [contractResult, payrollResult, payoutResult] = await prisma.$transaction([
      prisma.userContractChange.updateMany({
        where: { chineseSupervisorId: supervisor.id },
        data: { chineseSupervisorName: label },
      }),
      prisma.userPayrollChange.updateMany({
        where: { chineseSupervisorId: supervisor.id },
        data: { chineseSupervisorName: label },
      }),
      prisma.userPayrollPayout.updateMany({
        where: { chineseSupervisorId: supervisor.id },
        data: { chineseSupervisorName: label },
      }),
    ])
    updatedRecords +=
      contractResult.count + payrollResult.count + payoutResult.count
  }

  console.log(`Updated ${updatedRecords} supervisor name snapshots.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
