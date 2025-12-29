import type { ContractType, SalaryUnit } from '@prisma/client'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'
import {
  normalizeOptionalDate,
  normalizeOptionalDecimal,
  normalizeOptionalText,
  parseContractType,
  parseSalaryUnit,
} from '@/lib/server/compensation'
import { createInitialContractChangeIfMissing } from '@/lib/server/contractChanges'
import { formatSupervisorLabel } from '@/lib/members/utils'

const canManageCompensation = async () => {
  return (
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  )
}

const hasField = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

const addOneYear = (date: Date) => {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

type ImportItem = {
  row?: number
  name?: string
  birthDate?: string
  changeDate?: string
  contractNumber?: string
  contractType?: string
  salaryCategory?: string
  salaryAmount?: string
  salaryUnit?: string
  prime?: string
  startDate?: string
  endDate?: string
  chineseSupervisor?: string
  reason?: string
}

type ImportErrorCode =
  | 'missing_name'
  | 'missing_birth_date'
  | 'invalid_birth_date'
  | 'member_not_found'
  | 'duplicate_identity'
  | 'chinese_member'
  | 'invalid_contract_type'
  | 'invalid_salary_unit'
  | 'invalid_base_salary_unit'
  | 'invalid_change_date'
  | 'invalid_start_date'
  | 'invalid_end_date'
  | 'invalid_chinese_supervisor'
  | 'contract_number_exists'
  | 'duplicate_contract_number'
  | 'missing_change_fields'
  | 'import_failed'

type ImportError = {
  row: number
  code: ImportErrorCode
  value?: string
}

type PreparedRow = {
  row: number
  name: string
  birthDate: Date
  changeDate: Date
  contractNumber: string | null
  contractType: ContractType | null
  salaryCategory: string | null
  salaryAmount: string | null
  salaryUnit: SalaryUnit | null
  prime: string | null
  startDate: Date | null
  endDate: Date | null
  chineseSupervisor: string | null
  reason: string | null
  hasContractNumber: boolean
  hasContractType: boolean
  hasSalaryCategory: boolean
  hasSalaryAmount: boolean
  hasSalaryUnit: boolean
  hasPrime: boolean
  hasStartDate: boolean
  hasEndDate: boolean
  hasChineseSupervisor: boolean
}

type ExpatSnapshot = {
  contractNumber: string | null
  contractType: ContractType | null
  salaryCategory: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: SalaryUnit | null
  prime: string | null
  contractStartDate: Date | null
  contractEndDate: Date | null
  chineseSupervisorId: number | null
}

const buildSnapshot = (profile?: {
  contractNumber: string | null
  contractType: ContractType | null
  salaryCategory: string | null
  baseSalaryAmount: { toString: () => string } | null
  baseSalaryUnit: SalaryUnit | null
  prime: { toString: () => string } | null
  contractStartDate: Date | null
  contractEndDate: Date | null
  chineseSupervisorId: number | null
} | null): ExpatSnapshot => ({
  contractNumber: profile?.contractNumber ?? null,
  contractType: profile?.contractType ?? null,
  salaryCategory: profile?.salaryCategory ?? null,
  baseSalaryAmount: profile?.baseSalaryAmount?.toString() ?? null,
  baseSalaryUnit: profile?.baseSalaryUnit ?? null,
  prime: profile?.prime?.toString() ?? null,
  contractStartDate: profile?.contractStartDate ?? null,
  contractEndDate: profile?.contractEndDate ?? null,
  chineseSupervisorId: profile?.chineseSupervisorId ?? null,
})

const formatSupervisorName = (user: {
  name: string
  username: string
  chineseProfile?: { frenchName: string | null } | null
}) => {
  const label = formatSupervisorLabel({
    name: user.name,
    frenchName: user.chineseProfile?.frenchName ?? null,
    username: user.username,
  })
  return label || null
}

export async function POST(request: Request) {
  if (!(await canManageCompensation())) {
    return NextResponse.json({ error: '缺少成员更新权限' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const ignoreErrors = Boolean(body?.ignoreErrors)
  const items = Array.isArray(body?.items) ? (body?.items as ImportItem[]) : []
  if (items.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const errors: ImportError[] = []
  const invalidRows = new Set<number>()
  const prepared: PreparedRow[] = []

  const addError = (row: number, code: ImportErrorCode, value?: string) => {
    errors.push({ row, code, value })
    invalidRows.add(row)
  }

  items.forEach((item, index) => {
    const row = Number(item?.row) || index + 2
    const name = normalizeOptionalText(item?.name)
    if (!name) {
      addError(row, 'missing_name')
    }
    const birthDateInput = item?.birthDate ?? null
    const birthDate =
      birthDateInput === null || birthDateInput === undefined || birthDateInput === ''
        ? null
        : normalizeOptionalDate(birthDateInput)
    if (!birthDateInput) {
      addError(row, 'missing_birth_date')
    } else if (!birthDate) {
      addError(row, 'invalid_birth_date')
    }

    const hasContractNumber = hasField(item as Record<string, unknown>, 'contractNumber')
    const hasContractType = hasField(item as Record<string, unknown>, 'contractType')
    const hasSalaryCategory = hasField(item as Record<string, unknown>, 'salaryCategory')
    const hasSalaryAmount = hasField(item as Record<string, unknown>, 'salaryAmount')
    const hasSalaryUnit = hasField(item as Record<string, unknown>, 'salaryUnit')
    const hasPrime = hasField(item as Record<string, unknown>, 'prime')
    const hasStartDate = hasField(item as Record<string, unknown>, 'startDate')
    const hasEndDate = hasField(item as Record<string, unknown>, 'endDate')
    const hasChineseSupervisor = hasField(item as Record<string, unknown>, 'chineseSupervisor')

    const contractNumber = hasContractNumber ? normalizeOptionalText(item?.contractNumber) : null
    const contractType = hasContractType ? parseContractType(item?.contractType) : null
    if (hasContractType && item?.contractType && !contractType) {
      addError(row, 'invalid_contract_type', String(item?.contractType))
    }
    const salaryCategory = hasSalaryCategory ? normalizeOptionalText(item?.salaryCategory) : null
    const salaryAmount = hasSalaryAmount ? normalizeOptionalDecimal(item?.salaryAmount) : null
    const salaryUnit = hasSalaryUnit ? parseSalaryUnit(item?.salaryUnit) : null
    const prime = hasPrime ? normalizeOptionalDecimal(item?.prime) : null
    if (hasSalaryUnit && item?.salaryUnit && !salaryUnit) {
      addError(row, 'invalid_salary_unit', String(item?.salaryUnit))
    }

    const changeDateInput = hasField(item as Record<string, unknown>, 'changeDate')
      ? item?.changeDate
      : null
    const changeDate =
      changeDateInput === null || changeDateInput === undefined || changeDateInput === ''
        ? null
        : normalizeOptionalDate(changeDateInput)
    if (changeDateInput && !changeDate) {
      addError(row, 'invalid_change_date', String(changeDateInput))
    }

    const startDateInput = hasField(item as Record<string, unknown>, 'startDate')
      ? item?.startDate
      : null
    const startDate =
      startDateInput === null || startDateInput === undefined || startDateInput === ''
        ? null
        : normalizeOptionalDate(startDateInput)
    if (startDateInput && !startDate) {
      addError(row, 'invalid_start_date', String(startDateInput))
    }

    const endDateInput = hasField(item as Record<string, unknown>, 'endDate')
      ? item?.endDate
      : null
    const endDate =
      endDateInput === null || endDateInput === undefined || endDateInput === ''
        ? null
        : normalizeOptionalDate(endDateInput)
    if (endDateInput && !endDate) {
      addError(row, 'invalid_end_date', String(endDateInput))
    }

    const chineseSupervisor = hasChineseSupervisor
      ? normalizeOptionalText(item?.chineseSupervisor)
      : null
    const reason = normalizeOptionalText(item?.reason)

    const hasPayload =
      Boolean(contractNumber) ||
      Boolean(contractType) ||
      Boolean(salaryCategory) ||
      Boolean(salaryAmount) ||
      Boolean(salaryUnit) ||
      Boolean(prime) ||
      Boolean(startDate) ||
      Boolean(endDate)
    if (!hasPayload) {
      addError(row, 'missing_change_fields')
    }

    if (invalidRows.has(row) || !name || !birthDate) {
      return
    }

    prepared.push({
      row,
      name,
      birthDate,
      changeDate: changeDate ?? new Date(),
      contractNumber,
      contractType,
      salaryCategory,
      salaryAmount,
      salaryUnit,
      prime,
      startDate,
      endDate,
      chineseSupervisor,
      reason,
      hasContractNumber,
      hasContractType,
      hasSalaryCategory,
      hasSalaryAmount,
      hasSalaryUnit,
      hasPrime,
      hasStartDate,
      hasEndDate,
      hasChineseSupervisor,
    })
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }
  if (prepared.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const identityKey = (name: string, birthDate: Date) =>
    `${name}\u0000${birthDate.toISOString().slice(0, 10)}`
  const identityMap = new Map<string, { name: string; birthDate: Date }>()
  prepared.forEach((row) => {
    identityMap.set(identityKey(row.name, row.birthDate), {
      name: row.name,
      birthDate: row.birthDate,
    })
  })
  const identityFilters = Array.from(identityMap.values())
  const existingUsers = identityFilters.length
    ? await prisma.user.findMany({
        where: {
          OR: identityFilters.map((identity) => ({
            name: identity.name,
            birthDate: identity.birthDate,
          })),
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
          nationality: true,
          joinDate: true,
          expatProfile: {
            select: {
              chineseSupervisorId: true,
              contractNumber: true,
              contractType: true,
              contractStartDate: true,
              contractEndDate: true,
              salaryCategory: true,
              baseSalaryAmount: true,
              baseSalaryUnit: true,
              prime: true,
            },
          },
        },
      })
    : []
  const matchesByIdentity = new Map<
    string,
    Array<{
      id: number
      nationality: string | null
      expatProfile: (typeof existingUsers)[number]['expatProfile']
    }>
  >()
  existingUsers.forEach((user) => {
    if (!user.birthDate) return
    const key = identityKey(user.name, user.birthDate)
    const list = matchesByIdentity.get(key) ?? []
    list.push({
      id: user.id,
      nationality: user.nationality,
      expatProfile: user.expatProfile,
    })
    matchesByIdentity.set(key, list)
  })

  const matchByRow = new Map<number, (typeof existingUsers)[number] | null>()
  prepared.forEach((row) => {
    const key = identityKey(row.name, row.birthDate)
    const matches = matchesByIdentity.get(key) ?? []
    if (matches.length > 1) {
      addError(row.row, 'duplicate_identity')
      matchByRow.set(row.row, null)
      return
    }
    const match = existingUsers.find(
      (user) =>
        user.birthDate &&
        identityKey(user.name, user.birthDate) === key,
    )
    if (!match) {
      addError(row.row, 'member_not_found')
      matchByRow.set(row.row, null)
      return
    }
    if (match.nationality === 'china') {
      addError(row.row, 'chinese_member')
      matchByRow.set(row.row, null)
      return
    }
    matchByRow.set(row.row, match)
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const candidates = ignoreErrors ? prepared.filter((row) => !invalidRows.has(row.row)) : prepared
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const supervisorTokens = Array.from(
    new Set(
      candidates
        .map((row) => row.chineseSupervisor?.trim().toLowerCase() ?? '')
        .filter(Boolean),
    ),
  )
  const supervisors = supervisorTokens.length
    ? await prisma.user.findMany({
        where: {
          OR: supervisorTokens.flatMap((token) => [
            { username: { equals: token, mode: 'insensitive' } },
            { name: { equals: token, mode: 'insensitive' } },
          ]),
        },
        select: {
          id: true,
          username: true,
          name: true,
          nationality: true,
          chineseProfile: { select: { frenchName: true } },
        },
      })
    : []

  const supervisorByToken = new Map<string, { id: number; label: string | null }>()
  supervisorTokens.forEach((token) => {
    const matches = supervisors.filter((user) => {
      const usernameMatch = user.username.toLowerCase() === token
      const nameMatch = user.name?.toLowerCase() === token
      return usernameMatch || nameMatch
    })
    const chineseMatches = matches.filter((user) => user.nationality === 'china')
    if (chineseMatches.length !== 1) {
      candidates
        .filter((row) => row.chineseSupervisor?.trim().toLowerCase() === token)
        .forEach((row) => addError(row.row, 'invalid_chinese_supervisor', row.chineseSupervisor ?? ''))
      return
    }
    const supervisor = chineseMatches[0]
    supervisorByToken.set(token, {
      id: supervisor.id,
      label: formatSupervisorName(supervisor),
    })
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const contractNumbers = Array.from(
    new Set(
      candidates
        .map((row) => row.contractNumber?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const existingContractNumbers = contractNumbers.length
    ? await prisma.userExpatProfile.findMany({
        where: {
          OR: contractNumbers.map((value) => ({
            contractNumber: { equals: value, mode: 'insensitive' },
          })),
        },
        select: { userId: true, contractNumber: true },
      })
    : []
  const contractOwnerByValue = new Map(
    existingContractNumbers.flatMap((item) =>
      item.contractNumber ? [[item.contractNumber.toLowerCase(), item.userId] as const] : [],
    ),
  )
  const contractOwnerByImport = new Map<string, number>()

  candidates.forEach((row) => {
    const match = matchByRow.get(row.row)
    if (!match) return
    if (!row.contractNumber) return
    const key = row.contractNumber.toLowerCase()
    const existingOwner = contractOwnerByValue.get(key)
    if (existingOwner && existingOwner !== match.id) {
      addError(row.row, 'contract_number_exists', row.contractNumber)
      return
    }
    const plannedOwner = contractOwnerByImport.get(key)
    if (plannedOwner && plannedOwner !== match.id) {
      addError(row.row, 'duplicate_contract_number', row.contractNumber)
      return
    }
    contractOwnerByImport.set(key, match.id)
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const validRows = ignoreErrors ? candidates.filter((row) => !invalidRows.has(row.row)) : candidates
  if (validRows.length === 0) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const rowsByUserId = new Map<number, PreparedRow[]>()
  validRows.forEach((row) => {
    const match = matchByRow.get(row.row)
    if (!match) return
    const list = rowsByUserId.get(match.id) ?? []
    list.push(row)
    rowsByUserId.set(match.id, list)
  })

  const supervisorIds = new Set<number>()
  validRows.forEach((row) => {
    if (row.chineseSupervisor) {
      const token = row.chineseSupervisor.trim().toLowerCase()
      const supervisor = supervisorByToken.get(token)
      if (supervisor) supervisorIds.add(supervisor.id)
    }
  })
  existingUsers.forEach((user) => {
    if (user.expatProfile?.chineseSupervisorId) {
      supervisorIds.add(user.expatProfile.chineseSupervisorId)
    }
  })

  const supervisorSnapshots = supervisorIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(supervisorIds) } },
        select: {
          id: true,
          username: true,
          name: true,
          chineseProfile: { select: { frenchName: true } },
        },
      })
    : []
  const supervisorLabelById = new Map(
    supervisorSnapshots.map((user) => [user.id, formatSupervisorName(user)] as const),
  )

  let imported = 0

  const rowsByUserEntries: Array<[number, PreparedRow[]]> = []
  rowsByUserId.forEach((rows, userId) => {
    rowsByUserEntries.push([userId, rows])
  })

  for (const [userId, rows] of rowsByUserEntries) {
    const user = existingUsers.find((item) => item.id === userId)
    if (!user) continue
    const sorted = [...rows].sort(
      (left, right) => left.changeDate.getTime() - right.changeDate.getTime(),
    )
    let snapshot = buildSnapshot(user.expatProfile)
    const initialSnapshot = snapshot
    const fallbackChangeDate = sorted[0]?.changeDate ?? null
    try {
      let created = 0
      await prisma.$transaction(async (tx) => {
        let baselineChecked = false
        const ensureBaseline = async () => {
          if (baselineChecked) return
          baselineChecked = true
          await createInitialContractChangeIfMissing(tx, {
            userId,
            expatProfile: initialSnapshot,
            joinDate: user.joinDate ?? null,
            fallbackChangeDate,
          })
        }

        for (const row of sorted) {
          const supervisorToken = row.chineseSupervisor?.trim().toLowerCase() ?? null
          const supervisorOverride = supervisorToken
            ? supervisorByToken.get(supervisorToken) ?? null
            : null
          const nextSupervisorId = row.hasChineseSupervisor
            ? supervisorOverride?.id ?? null
            : snapshot.chineseSupervisorId

          const resolvedStartDate = row.startDate ?? row.changeDate
          const resolvedEndDate = row.endDate ?? addOneYear(resolvedStartDate)

          const nextSnapshot: ExpatSnapshot = {
            contractNumber: row.hasContractNumber ? row.contractNumber : snapshot.contractNumber,
            contractType: row.hasContractType ? row.contractType : snapshot.contractType,
            salaryCategory: row.hasSalaryCategory ? row.salaryCategory : snapshot.salaryCategory,
            baseSalaryAmount: row.hasSalaryAmount ? row.salaryAmount : snapshot.baseSalaryAmount,
            baseSalaryUnit: row.hasSalaryUnit ? row.salaryUnit : snapshot.baseSalaryUnit,
            prime: row.hasPrime ? row.prime : snapshot.prime,
            contractStartDate: resolvedStartDate,
            contractEndDate: resolvedEndDate,
            chineseSupervisorId: nextSupervisorId ?? null,
          }

          if (nextSnapshot.contractType === 'CDD' && nextSnapshot.baseSalaryUnit === 'HOUR') {
            addError(row.row, 'invalid_base_salary_unit')
            continue
          }

          await ensureBaseline()
          await tx.userContractChange.create({
            data: {
              userId,
              chineseSupervisorId: nextSnapshot.chineseSupervisorId,
              chineseSupervisorName:
                (nextSnapshot.chineseSupervisorId
                  ? supervisorLabelById.get(nextSnapshot.chineseSupervisorId)
                  : null) ?? null,
              contractNumber: nextSnapshot.contractNumber,
              contractType: nextSnapshot.contractType,
              salaryCategory: nextSnapshot.salaryCategory,
              salaryAmount: nextSnapshot.baseSalaryAmount,
              salaryUnit: nextSnapshot.baseSalaryUnit,
              prime: nextSnapshot.prime,
              startDate: resolvedStartDate,
              endDate: resolvedEndDate,
              changeDate: row.changeDate,
              reason: row.reason,
            },
          })
          snapshot = nextSnapshot
          created += 1
        }

        await tx.userExpatProfile.upsert({
          where: { userId },
          create: {
            userId,
            chineseSupervisorId: snapshot.chineseSupervisorId,
            contractNumber: snapshot.contractNumber,
            contractType: snapshot.contractType,
            salaryCategory: snapshot.salaryCategory,
            prime: snapshot.prime,
            baseSalaryAmount: snapshot.baseSalaryAmount,
            baseSalaryUnit: snapshot.baseSalaryUnit,
            contractStartDate: snapshot.contractStartDate,
            contractEndDate: snapshot.contractEndDate,
          },
          update: {
            chineseSupervisorId: snapshot.chineseSupervisorId,
            contractNumber: snapshot.contractNumber,
            contractType: snapshot.contractType,
            salaryCategory: snapshot.salaryCategory,
            prime: snapshot.prime,
            baseSalaryAmount: snapshot.baseSalaryAmount,
            baseSalaryUnit: snapshot.baseSalaryUnit,
            contractStartDate: snapshot.contractStartDate,
            contractEndDate: snapshot.contractEndDate,
          },
        })
      })
      imported += created
    } catch {
      const fallbackRow = sorted[0]
      if (fallbackRow) {
        addError(fallbackRow.row, 'import_failed')
      }
    }
  }

  return NextResponse.json({
    imported,
    errors: errors.length ? errors : undefined,
  })
}
