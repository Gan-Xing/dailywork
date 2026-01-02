/**
 * Fix supervisor snapshots for a given team to match the TeamSupervisor binding.
 *
 * Usage:
 *   npx tsx scripts/fix-team-supervisor-history.ts --team "TOPO"
 *   npx tsx scripts/fix-team-supervisor-history.ts --team "TOPO" --confirm
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'

const prisma = new PrismaClient()

const getArgValue = (flag: string) => {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  const value = process.argv[index + 1]
  return value ? value.trim() : null
}

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const chunkArray = <T,>(items: T[], size: number) => {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const teamInput = normalizeOptionalText(getArgValue('--team'))
  if (!teamInput) {
    console.log('Missing required --team argument.')
    return
  }

  const teamKey = normalizeTeamKey(teamInput)
  if (!teamKey) {
    console.log('Invalid team value.')
    return
  }

  const binding = await prisma.teamSupervisor.findUnique({
    where: { teamKey },
    select: { id: true, team: true, teamKey: true, supervisorId: true, supervisorName: true },
  })
  if (!binding) {
    console.log(`No TeamSupervisor binding found for teamKey=${teamKey}.`)
    return
  }

  const supervisor = await prisma.user.findUnique({
    where: { id: binding.supervisorId },
    select: {
      id: true,
      name: true,
      username: true,
      nationality: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  if (!supervisor || supervisor.nationality !== 'china') {
    console.log('Binding supervisor is missing or not Chinese; aborting.')
    return
  }

  const supervisorLabel =
    normalizeOptionalText(binding.supervisorName) ??
    formatSupervisorLabel({
      name: supervisor.name,
      frenchName: supervisor.chineseProfile?.frenchName ?? null,
      username: supervisor.username,
    }) ??
    supervisor.username

  const matchesTeam = (value: string | null) => normalizeTeamKey(value) === teamKey

  const profiles = await prisma.userExpatProfile.findMany({
    select: { userId: true, team: true, chineseSupervisorId: true },
  })
  const profileUpdates = profiles
    .filter((profile) => matchesTeam(profile.team))
    .filter((profile) => profile.chineseSupervisorId !== binding.supervisorId)
    .map((profile) => ({ userId: profile.userId }))

  const contractChanges = await prisma.userContractChange.findMany({
    where: { team: { not: null } },
    select: { id: true, team: true, chineseSupervisorId: true, chineseSupervisorName: true },
  })
  const contractUpdates = contractChanges
    .filter((record) => matchesTeam(record.team))
    .filter(
      (record) =>
        record.chineseSupervisorId !== binding.supervisorId ||
        record.chineseSupervisorName !== supervisorLabel,
    )
    .map((record) => ({ id: record.id }))

  const payrollChanges = await prisma.userPayrollChange.findMany({
    where: { team: { not: null } },
    select: { id: true, team: true, chineseSupervisorId: true, chineseSupervisorName: true },
  })
  const payrollChangeUpdates = payrollChanges
    .filter((record) => matchesTeam(record.team))
    .filter(
      (record) =>
        record.chineseSupervisorId !== binding.supervisorId ||
        record.chineseSupervisorName !== supervisorLabel,
    )
    .map((record) => ({ id: record.id }))

  const payouts = await prisma.userPayrollPayout.findMany({
    where: { team: { not: null } },
    select: { id: true, team: true, chineseSupervisorId: true, chineseSupervisorName: true },
  })
  const payoutUpdates = payouts
    .filter((record) => matchesTeam(record.team))
    .filter(
      (record) =>
        record.chineseSupervisorId !== binding.supervisorId ||
        record.chineseSupervisorName !== supervisorLabel,
    )
    .map((record) => ({ id: record.id }))

  console.log(`Team binding: ${binding.team} (#${binding.id}) -> ${supervisorLabel}`)
  console.log(`Expat profiles to update: ${profileUpdates.length}`)
  console.log(`Contract changes to update: ${contractUpdates.length}`)
  console.log(`Payroll changes to update: ${payrollChangeUpdates.length}`)
  console.log(`Payroll payouts to update: ${payoutUpdates.length}`)

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  const batchSize = 200
  for (const batch of chunkArray(profileUpdates, batchSize)) {
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userExpatProfile.update({
          where: { userId: item.userId },
          data: { chineseSupervisorId: binding.supervisorId },
        }),
      ),
    )
  }

  for (const batch of chunkArray(contractUpdates, batchSize)) {
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userContractChange.update({
          where: { id: item.id },
          data: {
            chineseSupervisorId: binding.supervisorId,
            chineseSupervisorName: supervisorLabel,
          },
        }),
      ),
    )
  }

  for (const batch of chunkArray(payrollChangeUpdates, batchSize)) {
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userPayrollChange.update({
          where: { id: item.id },
          data: {
            chineseSupervisorId: binding.supervisorId,
            chineseSupervisorName: supervisorLabel,
          },
        }),
      ),
    )
  }

  for (const batch of chunkArray(payoutUpdates, batchSize)) {
    await prisma.$transaction(
      batch.map((item) =>
        prisma.userPayrollPayout.update({
          where: { id: item.id },
          data: {
            chineseSupervisorId: binding.supervisorId,
            chineseSupervisorName: supervisorLabel,
          },
        }),
      ),
    )
  }

  console.log('Update complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
