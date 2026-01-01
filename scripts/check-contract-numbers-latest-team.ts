/**
 * Check whether provided contract numbers are the latest for each member
 * and report the latest team per member.
 *
 * Usage:
 *   npx tsx scripts/check-contract-numbers-latest-team.ts
 *   npx tsx scripts/check-contract-numbers-latest-team.ts --output reports/contract-number-latest-check.txt
 */
/* eslint-disable no-console */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const parseOutputPath = () => {
  const args = process.argv
  const index = args.indexOf('--output')
  if (index === -1) return null
  const raw = args[index + 1]
  if (!raw) return null
  return raw
}

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

const inputLines = `
MBDKO022	KESSE TIEMOKO JEROME
MBDKO093	KONE MOUSSA
MBDKO109	TOURE NANFOURDY
MBDKO111	KOFFI KOUADIO PATRICE
MBDKO133	CAMARA MOHAMED
JBDKO376	KONAN N'DRI JORES
JBDKO560	OKA KOUAME JEAN LOUIS
JBDKO679	BOITRIN KOUAME PRINCE
JBDKO680	SOUMAHORO ABOU
JBDKO682	YAO KOUAME ROLAND LOUIS
JBDKO683	KOUADIO KOUADIO THEODORE
JBDKO684	ADJOUMANI KOFFI GILBERT
JBDKO746	DEMBELE LAMINE
JBDKO752	SORO DOULAYE
JBDKO755	KONAN N'GESSAN PARFAIT
JBDKO756	KOUAKOU YAO BENJAMIN
JBDKO760	KRA KOUASSI ANANI EMERSON
JBDKO761	OUATTARA MOHAMED
JBDKO764	KOMOE DAOUDA OUATTARA
JBDKO772	KPONVI YAO RAPHAEL
JBDKO797	KOUAME KOUADIO PACOME
JBDKO798	KOUADIO KOUADIO LUCIEN
JBDKO800	KAMBIRE SANSAN SAMUEL
JBDKO801	OUATTARA EL-ASSOUMY
JBDKO859	OUATTARA SOUADIKOU
JBDKO860	KAMBIRE FIRKONTE DENIS
JBDKO885	SOVIDE FRANCK DANIEL
`

const parseEntries = () =>
  inputLines
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [contractNumber, ...nameParts] = line.split(/\s+/)
      return {
        contractNumber: normalizeText(contractNumber ?? ''),
        name: normalizeText(nameParts.join(' ')),
      }
    })

type ContractChange = {
  id: number
  userId: number
  contractNumber: string | null
  team: string | null
  startDate: Date | null
  changeDate: Date
}

const resolveLatestChange = (changes: ContractChange[]) => {
  if (changes.length === 0) return null
  return changes
    .slice()
    .sort((left, right) => {
      const leftStart = (left.startDate ?? left.changeDate).getTime()
      const rightStart = (right.startDate ?? right.changeDate).getTime()
      if (leftStart !== rightStart) return rightStart - leftStart
      const leftChange = left.changeDate.getTime()
      const rightChange = right.changeDate.getTime()
      if (leftChange !== rightChange) return rightChange - leftChange
      return right.id - left.id
    })[0]
}

const main = async () => {
  const outputPath = parseOutputPath()
  const entries = parseEntries()
  if (entries.length === 0) {
    console.log('No input entries found.')
    return
  }

  const names = Array.from(new Set(entries.map((entry) => entry.name)))
  const contractNumbers = Array.from(
    new Set(entries.map((entry) => entry.contractNumber)),
  )

  const users = await prisma.user.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, username: true },
  })
  const userIdsFromNames = Array.from(new Set(users.map((user) => user.id)))

  const baseChanges = await prisma.userContractChange.findMany({
    where: {
      OR: [
        { userId: { in: userIdsFromNames } },
        { contractNumber: { in: contractNumbers } },
      ],
    },
    select: {
      id: true,
      userId: true,
      contractNumber: true,
      team: true,
      startDate: true,
      changeDate: true,
    },
  })

  const additionalUserIds = Array.from(
    new Set(
      baseChanges
        .map((change) => change.userId)
        .filter((id) => !userIdsFromNames.includes(id)),
    ),
  )

  const extraChanges = additionalUserIds.length
    ? await prisma.userContractChange.findMany({
        where: { userId: { in: additionalUserIds } },
        select: {
          id: true,
          userId: true,
          contractNumber: true,
          team: true,
          startDate: true,
          changeDate: true,
        },
      })
    : []

  const changes = baseChanges.concat(extraChanges)

  const profiles = await prisma.userExpatProfile.findMany({
    where: {
      OR: [
        { contractNumber: { in: contractNumbers } },
        { userId: { in: userIdsFromNames.concat(additionalUserIds) } },
      ],
    },
    select: {
      userId: true,
      contractNumber: true,
      team: true,
    },
  })

  const usersByName = new Map<string, typeof users>()
  users.forEach((user) => {
    const list = usersByName.get(user.name) ?? []
    list.push(user)
    usersByName.set(user.name, list)
  })

  const changesByUser = new Map<number, ContractChange[]>()
  changes.forEach((change) => {
    const list = changesByUser.get(change.userId) ?? []
    list.push(change)
    changesByUser.set(change.userId, list)
  })

  const changesByContract = new Map<string, ContractChange[]>()
  changes.forEach((change) => {
    if (!change.contractNumber) return
    const list = changesByContract.get(change.contractNumber) ?? []
    list.push(change)
    changesByContract.set(change.contractNumber, list)
  })

  const profileByContract = new Map(
    profiles
      .filter((profile) => profile.contractNumber)
      .map((profile) => [profile.contractNumber ?? '', profile]),
  )
  const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]))

  const lines: string[] = []
  lines.push(`Entries: ${entries.length}`)
  lines.push('')

  const teamGroups = new Map<string, string[]>()

  entries.forEach((entry) => {
    const nameMatches = usersByName.get(entry.name) ?? []
    let userId: number | null = null
    let userLabel = entry.name
    if (nameMatches.length === 1) {
      userId = nameMatches[0].id
      userLabel = `${entry.name} (user=${userId})`
    } else if (nameMatches.length > 1) {
      const byContract = nameMatches.find((user) => {
        const list = changesByUser.get(user.id) ?? []
        return list.some((change) => change.contractNumber === entry.contractNumber)
      })
      if (byContract) {
        userId = byContract.id
        userLabel = `${entry.name} (user=${userId})`
      } else {
        userLabel = `${entry.name} (ambiguous: ${nameMatches
          .map((user) => user.id)
          .join(',')})`
      }
    }

    if (!userId) {
      const byContract = changesByContract.get(entry.contractNumber) ?? []
      const uniqueUsers = Array.from(new Set(byContract.map((change) => change.userId)))
      if (uniqueUsers.length === 1) {
        userId = uniqueUsers[0]
        userLabel = `${entry.name} (user=${userId})`
      } else if (uniqueUsers.length > 1) {
        userLabel = `${entry.name} (contract maps to users: ${uniqueUsers.join(',')})`
      } else {
        const profile = profileByContract.get(entry.contractNumber)
        if (profile) {
          userId = profile.userId
          userLabel = `${entry.name} (user=${userId})`
        } else {
          userLabel = `${entry.name} (user not found)`
        }
      }
    }

    let latestContract = null as ContractChange | null
    if (userId !== null) {
      const list = changesByUser.get(userId) ?? []
      latestContract = resolveLatestChange(list)
    }

    const latestContractNumber = latestContract?.contractNumber ?? 'null'
    const isLatest =
      latestContract === null
        ? 'UNKNOWN'
        : latestContract?.contractNumber === entry.contractNumber
          ? 'YES'
          : 'NO'
    const latestTeam =
      latestContract?.team ??
      (userId !== null ? profileByUser.get(userId)?.team ?? null : null) ??
      'null'

    if (latestTeam !== 'null') {
      const list = teamGroups.get(latestTeam) ?? []
      list.push(`${entry.contractNumber} ${entry.name}`)
      teamGroups.set(latestTeam, list)
    }

    lines.push(
      `${entry.contractNumber} | ${userLabel} | latest=${latestContractNumber} | isLatest=${isLatest} | team=${latestTeam}`,
    )
  })

  lines.push('')
  lines.push('Team Summary')
  Array.from(teamGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([team, members]) => {
      lines.push(`- ${team}: ${members.length}`)
    })

  if (outputPath) {
    const dir = path.dirname(outputPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8')
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
