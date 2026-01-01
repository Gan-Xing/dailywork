import type { PrismaClient } from '@prisma/client'

import { normalizeTeamKey, normalizeText } from '@/lib/members/utils'

export type ContractAuditRow = {
  row: number
  team: string | null
  contractNumber: string | null
  name: string | null
  birthDate: Date | null
}

export type ContractAuditResult = {
  row: number
  team: string | null
  contractNumber: string | null
  name: string | null
  birthDate: string | null
  status: string | null
  userId: number | null
  username: string | null
  matchStatus: 'matched' | 'missing' | 'ambiguous'
  latestContractNumber: string | null
  isLatest: 'YES' | 'NO' | 'UNKNOWN'
  latestTeam: string | null
  teamMatch: 'YES' | 'NO' | 'UNKNOWN'
  birthDateMatch: 'YES' | 'NO' | 'UNKNOWN'
  contractMatch: 'YES' | 'NO' | 'UNKNOWN'
  notes: string[]
}

export type ContractAuditSummary = {
  total: number
  matched: number
  missing: number
  ambiguous: number
  latestYes: number
  latestNo: number
  latestUnknown: number
  teamMatchYes: number
  teamMatchNo: number
  teamMatchUnknown: number
  birthMatchYes: number
  birthMatchNo: number
  birthMatchUnknown: number
  contractMatchYes: number
  contractMatchNo: number
  contractMatchUnknown: number
}

type ContractChange = {
  id: number
  userId: number
  contractNumber: string | null
  team: string | null
  startDate: Date | null
  changeDate: Date
}

const normalizeName = (value: string | null | undefined) =>
  normalizeText(value ?? '').replace(/\s+/g, ' ')

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '在职',
  TERMINATED: '离职',
  ON_LEAVE: '休假',
}

const formatStatusLabel = (value: string | null | undefined) => {
  if (!value) return null
  return STATUS_LABELS[value] ?? value
}

const dateKey = (value: Date) => {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const resolveLatestChange = (changes: ContractChange[]) => {
  if (!changes.length) return null
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

export const auditContractRows = async (
  prisma: PrismaClient,
  rows: ContractAuditRow[],
) => {
  const names = Array.from(new Set(rows.map((row) => normalizeName(row.name))))
  const contractNumbers = Array.from(
    new Set(
      rows
        .map((row) => row.contractNumber)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const users = await prisma.user.findMany({
    where: { name: { in: names.filter(Boolean) } },
    select: {
      id: true,
      name: true,
      username: true,
      birthDate: true,
      employmentStatus: true,
    },
  })
  const userIds = users.map((user) => user.id)

  const changes = await prisma.userContractChange.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
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

  const profiles = await prisma.userExpatProfile.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { contractNumber: { in: contractNumbers } },
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
    const key = normalizeName(user.name)
    const list = usersByName.get(key) ?? []
    list.push(user)
    usersByName.set(key, list)
  })

  const userById = new Map(users.map((user) => [user.id, user]))

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

  const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]))
  const profileByContract = new Map(
    profiles
      .filter((profile) => profile.contractNumber)
      .map((profile) => [profile.contractNumber ?? '', profile]),
  )

  const results: ContractAuditResult[] = []
  const summary: ContractAuditSummary = {
    total: rows.length,
    matched: 0,
    missing: 0,
    ambiguous: 0,
    latestYes: 0,
    latestNo: 0,
    latestUnknown: 0,
    teamMatchYes: 0,
    teamMatchNo: 0,
    teamMatchUnknown: 0,
    birthMatchYes: 0,
    birthMatchNo: 0,
    birthMatchUnknown: 0,
    contractMatchYes: 0,
    contractMatchNo: 0,
    contractMatchUnknown: 0,
  }

  rows.forEach((row) => {
    const notes: string[] = []
    const normalizedName = normalizeName(row.name)
    let candidates = normalizedName ? usersByName.get(normalizedName) ?? [] : []
    let userId: number | null = null
    let matchStatus: ContractAuditResult['matchStatus'] = 'missing'

    if (row.birthDate) {
      const birthKey = dateKey(row.birthDate)
      candidates = candidates.filter((user) =>
        user.birthDate ? dateKey(user.birthDate) === birthKey : false,
      )
    }

    if (candidates.length === 1) {
      userId = candidates[0].id
      matchStatus = 'matched'
    } else if (candidates.length > 1) {
      matchStatus = 'ambiguous'
      notes.push('ambiguous-name')
    } else if (row.contractNumber) {
      const matches = changesByContract.get(row.contractNumber) ?? []
      const uniqueUsers = Array.from(new Set(matches.map((change) => change.userId)))
      if (uniqueUsers.length === 1) {
        userId = uniqueUsers[0]
        matchStatus = 'matched'
        notes.push('matched-by-contract')
      } else if (uniqueUsers.length > 1) {
        matchStatus = 'ambiguous'
        notes.push('ambiguous-contract')
      } else {
        const profile = profileByContract.get(row.contractNumber)
        if (profile) {
          userId = profile.userId
          matchStatus = 'matched'
          notes.push('matched-by-profile')
        }
      }
    } else if (normalizedName && usersByName.get(normalizedName)?.length === 1) {
      userId = usersByName.get(normalizedName)?.[0]?.id ?? null
      matchStatus = userId ? 'matched' : 'missing'
    }

    if (matchStatus === 'missing') {
      summary.missing += 1
      notes.push('user-not-found')
    } else if (matchStatus === 'ambiguous') {
      summary.ambiguous += 1
    } else {
      summary.matched += 1
    }

    const user = userId ? userById.get(userId) ?? null : null
    const userBirthDate = user?.birthDate ?? null
    const status = formatStatusLabel(user?.employmentStatus ?? null)

    const birthDateMatch: ContractAuditResult['birthDateMatch'] = row.birthDate
      ? userBirthDate
        ? dateKey(row.birthDate) === dateKey(userBirthDate)
          ? 'YES'
          : 'NO'
        : 'UNKNOWN'
      : 'UNKNOWN'

    if (birthDateMatch === 'YES') summary.birthMatchYes += 1
    else if (birthDateMatch === 'NO') summary.birthMatchNo += 1
    else summary.birthMatchUnknown += 1

    const userChanges = userId ? changesByUser.get(userId) ?? [] : []
    const latestChange = resolveLatestChange(userChanges)
    const profile = userId ? profileByUser.get(userId) ?? null : null
    const latestContractNumber =
      latestChange?.contractNumber ?? profile?.contractNumber ?? null
    const latestTeam = latestChange?.team ?? profile?.team ?? null

    const isLatest: ContractAuditResult['isLatest'] = row.contractNumber
      ? latestContractNumber
        ? row.contractNumber === latestContractNumber
          ? 'YES'
          : 'NO'
        : 'UNKNOWN'
      : 'UNKNOWN'

    if (isLatest === 'YES') summary.latestYes += 1
    else if (isLatest === 'NO') summary.latestNo += 1
    else summary.latestUnknown += 1

    const teamMatch: ContractAuditResult['teamMatch'] =
      row.team && latestTeam
        ? normalizeTeamKey(row.team) === normalizeTeamKey(latestTeam)
          ? 'YES'
          : 'NO'
        : 'UNKNOWN'

    if (teamMatch === 'YES') summary.teamMatchYes += 1
    else if (teamMatch === 'NO') summary.teamMatchNo += 1
    else summary.teamMatchUnknown += 1

    let contractMatch: ContractAuditResult['contractMatch'] = 'UNKNOWN'
    if (row.contractNumber) {
      const hasContract =
        userChanges.some((change) => change.contractNumber === row.contractNumber) ||
        (profile?.contractNumber ?? null) === row.contractNumber
      contractMatch = hasContract ? 'YES' : 'NO'
    }

    if (contractMatch === 'YES') summary.contractMatchYes += 1
    else if (contractMatch === 'NO') summary.contractMatchNo += 1
    else summary.contractMatchUnknown += 1

    if (isLatest === 'NO') notes.push('not-latest')
    if (teamMatch === 'NO') notes.push('team-mismatch')
    if (birthDateMatch === 'NO') notes.push('birthdate-mismatch')
    if (contractMatch === 'NO') notes.push('contract-not-in-history')

    results.push({
      row: row.row,
      team: row.team,
      contractNumber: row.contractNumber,
      name: row.name,
      birthDate: row.birthDate ? dateKey(row.birthDate) : null,
      status,
      userId: userId ?? null,
      username: user?.username ?? null,
      matchStatus,
      latestContractNumber,
      isLatest,
      latestTeam,
      teamMatch,
      birthDateMatch,
      contractMatch,
      notes,
    })
  })

  const latestTeamCounts = new Map<string, number>()
  results.forEach((result) => {
    if (!result.latestTeam) return
    const key = normalizeText(result.latestTeam)
    latestTeamCounts.set(key, (latestTeamCounts.get(key) ?? 0) + 1)
  })

  const inputTeamCounts = new Map<string, number>()
  results.forEach((result) => {
    if (!result.team) return
    const key = normalizeText(result.team)
    inputTeamCounts.set(key, (inputTeamCounts.get(key) ?? 0) + 1)
  })

  return { results, summary, latestTeamCounts, inputTeamCounts }
}

export const buildContractAuditReport = (
  results: ContractAuditResult[],
  summary: ContractAuditSummary,
  latestTeamCounts: Map<string, number>,
  inputTeamCounts: Map<string, number>,
) => {
  const lines: string[] = []
  lines.push('Contract Audit Report')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push(`Total rows: ${summary.total}`)
  lines.push(`Matched users: ${summary.matched}`)
  lines.push(`Missing users: ${summary.missing}`)
  lines.push(`Ambiguous users: ${summary.ambiguous}`)
  lines.push(`Latest YES/NO/UNKNOWN: ${summary.latestYes}/${summary.latestNo}/${summary.latestUnknown}`)
  lines.push(`Team match YES/NO/UNKNOWN: ${summary.teamMatchYes}/${summary.teamMatchNo}/${summary.teamMatchUnknown}`)
  lines.push(
    `Birth match YES/NO/UNKNOWN: ${summary.birthMatchYes}/${summary.birthMatchNo}/${summary.birthMatchUnknown}`,
  )
  lines.push(
    `Contract match YES/NO/UNKNOWN: ${summary.contractMatchYes}/${summary.contractMatchNo}/${summary.contractMatchUnknown}`,
  )
  lines.push('')
  lines.push('Input Team Counts')
  Array.from(inputTeamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      lines.push(`- ${team}: ${count}`)
    })
  lines.push('')
  lines.push('Latest Team Counts')
  Array.from(latestTeamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      lines.push(`- ${team}: ${count}`)
    })
  lines.push('')
  lines.push(
    'row | contract | name | birthDate | inputTeam | status | user | latestContract | isLatest | latestTeam | teamMatch | birthMatch | contractMatch | notes',
  )
  results.forEach((result) => {
    lines.push(
      `${result.row} | ${result.contractNumber ?? 'null'} | ${result.name ?? 'null'} | ` +
        `${result.birthDate ?? 'null'} | ${result.team ?? 'null'} | ` +
        `${result.status ?? 'null'} | ${result.userId ?? 'null'} | ` +
        `${result.latestContractNumber ?? 'null'} | ` +
        `${result.isLatest} | ${result.latestTeam ?? 'null'} | ${result.teamMatch} | ` +
        `${result.birthDateMatch} | ${result.contractMatch} | ${result.notes.join(',') || 'none'}`,
    )
  })
  return lines.join('\n')
}
