import { NextResponse } from 'next/server'
import type { EmploymentStatus as PrismaEmploymentStatus } from '@prisma/client'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import {
  hasExpatProfileData,
  hasChineseProfileData,
  normalizeExpatProfile,
  normalizeChineseProfile,
  parseBirthDateInput,
  parseChineseIdBirthDate,
} from '@/lib/server/memberProfiles'
import { normalizeTagsInput } from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'

const PHONE_PATTERN = /^[+\d][\d\s-]{4,}$/
const EMPLOYMENT_STATUSES = new Set<PrismaEmploymentStatus>([
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
])
const IMPORT_BATCH_SIZE = 20
const IMPORT_TRANSACTION_MAX_WAIT_MS = 5_000
const IMPORT_TRANSACTION_TIMEOUT_MS = 120_000

type ImportMemberInput = {
  row?: number
  username?: string
  password?: string
  name?: string
  gender?: string | null
  nationality?: string | null
  phones?: string[] | string | null
  joinDate?: string | null
  birthDate?: string | null
  tags?: string[] | string | null
  terminationDate?: string | null
  terminationReason?: string | null
  position?: string | null
  employmentStatus?: string | null
  roleIds?: number[]
  team?: string | null
  chineseSupervisor?: string | null
  contractNumber?: string | null
  contractType?: string | null
  contractStartDate?: string | null
  contractEndDate?: string | null
  salaryCategory?: string | null
  prime?: string | null
  baseSalary?: string | null
  netMonthly?: string | null
  maritalStatus?: string | null
  childrenCount?: number | string | null
  cnpsNumber?: string | null
  cnpsDeclarationCode?: string | null
  provenance?: string | null
  emergencyContact?: string | null
  frenchName?: string | null
  idNumber?: string | null
  passportNumber?: string | null
  educationAndMajor?: string | null
  certifications?: string[] | string | null
  domesticMobile?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  redBookValidYears?: number | string | null
  cumulativeAbroadYears?: number | string | null
  birthplace?: string | null
  residenceInChina?: string | null
  medicalHistory?: string | null
  healthStatus?: string | null
}

type ImportErrorCode =
  | 'missing_name'
  | 'missing_username'
  | 'missing_password'
  | 'duplicate_username'
  | 'duplicate_identity'
  | 'username_exists'
  | 'invalid_gender'
  | 'invalid_phone'
  | 'invalid_contract_type'
  | 'invalid_base_salary_unit'
  | 'invalid_status'
  | 'invalid_join_date'
  | 'missing_birth_date'
  | 'invalid_birth_date'
  | 'missing_termination_date'
  | 'missing_termination_reason'
  | 'invalid_termination_date'
  | 'invalid_chinese_supervisor'
  | 'duplicate_contract_number'
  | 'contract_number_exists'
  | 'role_not_found'

type ImportError = {
  row: number
  code: ImportErrorCode
  value?: string
}

export async function POST(request: Request) {
  const canCreateMember =
    (await hasPermission('member:create')) || (await hasPermission('member:manage'))
  if (!canCreateMember) {
    return NextResponse.json({ error: '缺少成员新增权限' }, { status: 403 })
  }
  const canAssignRole =
    (await hasPermission('role:update')) || (await hasPermission('role:manage'))
  const body = await request.json().catch(() => null)
  const ignoreErrors = Boolean(body?.ignoreErrors)
  const members = Array.isArray(body?.members) ? (body?.members as ImportMemberInput[]) : []
  if (members.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const supervisorUsernames = Array.from(
    new Set(
      members
        .map((member) =>
          typeof member.chineseSupervisor === 'string' ? member.chineseSupervisor.trim().toLowerCase() : '',
        )
        .filter(Boolean),
    ),
  )
  const supervisorsByUsername = new Map<string, { id: number; nationality: string | null }>()
  if (supervisorUsernames.length > 0) {
    const supervisors = await prisma.user.findMany({
      where: {
        OR: supervisorUsernames.map((username) => ({
          username: { equals: username, mode: 'insensitive' },
        })),
      },
      select: { id: true, username: true, nationality: true },
    })
    supervisors.forEach((supervisor) => {
      supervisorsByUsername.set(supervisor.username.toLowerCase(), {
        id: supervisor.id,
        nationality: supervisor.nationality,
      })
    })
  }

  const errors: ImportError[] = []
  const invalidRows = new Set<number>()
  const prepared: Array<{
    row: number
    username: string | null
    password: string | null
    name: string
    gender: string | null
    nationality: string | null
    phones: string[]
    joinDate: Date | null
    birthDate: Date
    hasBirthDateInput: boolean
    tags?: string[] | null
    hasTagsInput: boolean
    terminationDate: Date | null
    terminationReason: string | null
    position: string | null
    employmentStatus: PrismaEmploymentStatus | null
    hasEmploymentStatusInput: boolean
    roleIds: number[]
    chineseProfile: ReturnType<typeof normalizeChineseProfile>
    hasChineseProfileData: boolean
    expatProfile: ReturnType<typeof normalizeExpatProfile>
    hasExpatProfileData: boolean
  }> = []
  const seenUsernames = new Set<string>()
  const seenContractNumbers = new Set<string>()

  const normalizePhoneList = (value: ImportMemberInput['phones']) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }
    if (typeof value === 'string') {
      return value
        .split(/[\/,，;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
    return []
  }

  members.forEach((member, index) => {
    const row = Number(member.row) || index + 2
    const username = typeof member.username === 'string' ? member.username.trim().toLowerCase() : ''
    const password = typeof member.password === 'string' ? member.password.trim() : ''
    const name = typeof member.name === 'string' ? member.name.trim() : ''
    const gender = typeof member.gender === 'string' ? member.gender.trim() : null
    const nationality = typeof member.nationality === 'string' ? member.nationality.trim() : null
    const supervisorUsername =
      typeof member.chineseSupervisor === 'string' ? member.chineseSupervisor.trim() : ''
    const supervisorRecord = supervisorUsername
      ? supervisorsByUsername.get(supervisorUsername.toLowerCase())
      : null
    const chineseSupervisorId =
      supervisorRecord && supervisorRecord.nationality === 'china' ? supervisorRecord.id : null
    const phones = normalizePhoneList(member.phones)
    const position =
      typeof member.position === 'string' && member.position.trim().length ? member.position.trim() : null
    const employmentStatus =
      typeof member.employmentStatus === 'string' && member.employmentStatus.trim().length
        ? (member.employmentStatus.trim() as PrismaEmploymentStatus)
        : null
    const hasEmploymentStatusInput = Boolean(employmentStatus)
    const contractTypeInput = typeof member.contractType === 'string' ? member.contractType.trim() : ''
    const roleIds =
      canAssignRole && Array.isArray(member.roleIds)
        ? member.roleIds.map((value: unknown) => Number(value)).filter(Boolean)
        : []
    const uniqueRoleIds = Array.from(new Set(roleIds))
    const chineseProfile = normalizeChineseProfile({
      frenchName: member.frenchName,
      idNumber: member.idNumber,
      passportNumber: member.passportNumber,
      educationAndMajor: member.educationAndMajor,
      certifications: member.certifications,
      domesticMobile: member.domesticMobile,
      emergencyContactName: member.emergencyContactName,
      emergencyContactPhone: member.emergencyContactPhone,
      redBookValidYears: member.redBookValidYears,
      cumulativeAbroadYears: member.cumulativeAbroadYears,
      birthplace: member.birthplace,
      residenceInChina: member.residenceInChina,
      medicalHistory: member.medicalHistory,
      healthStatus: member.healthStatus,
    })
    const expatProfile = normalizeExpatProfile({
      team: member.team,
      chineseSupervisorId,
      contractNumber: member.contractNumber,
      contractType: member.contractType,
      contractStartDate: member.contractStartDate,
      contractEndDate: member.contractEndDate,
      salaryCategory: member.salaryCategory,
      prime: member.prime,
      baseSalary: member.baseSalary,
      netMonthly: member.netMonthly,
      maritalStatus: member.maritalStatus,
      childrenCount: member.childrenCount,
      cnpsNumber: member.cnpsNumber,
      cnpsDeclarationCode: member.cnpsDeclarationCode,
      provenance: member.provenance,
      emergencyContact: member.emergencyContact,
      emergencyContactName: member.emergencyContactName,
      emergencyContactPhone: member.emergencyContactPhone,
    })
    const hasBirthDateInput =
      member.birthDate !== null &&
      member.birthDate !== undefined &&
      String(member.birthDate).trim().length > 0
    const parsedBirthDate = parseBirthDateInput(member.birthDate)

    let hasRowError = false
    const terminationReasonText =
      typeof member.terminationReason === 'string' ? member.terminationReason.trim() : ''
    const hasTerminationDateInput =
      typeof member.terminationDate === 'string' && member.terminationDate.trim().length > 0
    let terminationDateValue: Date | null = null
    if (hasTerminationDateInput) {
      const candidate = new Date(member.terminationDate as string)
      if (!Number.isNaN(candidate.getTime())) {
        terminationDateValue = candidate
      } else {
        errors.push({ row, code: 'invalid_termination_date', value: String(member.terminationDate) })
        invalidRows.add(row)
        hasRowError = true
      }
    }
    if (!name) {
      errors.push({ row, code: 'missing_name' })
      invalidRows.add(row)
      hasRowError = true
    }
    if (nationality !== 'china' && supervisorUsername && !chineseSupervisorId) {
      errors.push({ row, code: 'invalid_chinese_supervisor', value: supervisorUsername })
      invalidRows.add(row)
      hasRowError = true
    }
    if (username) {
      if (seenUsernames.has(username)) {
        errors.push({ row, code: 'duplicate_username' })
        invalidRows.add(row)
        hasRowError = true
      } else {
        seenUsernames.add(username)
      }
    }
    if (gender && gender !== '男' && gender !== '女') {
      errors.push({ row, code: 'invalid_gender', value: gender })
      invalidRows.add(row)
      hasRowError = true
    }
    const invalidPhone = phones.find((phone) => !PHONE_PATTERN.test(phone))
    if (invalidPhone) {
      errors.push({ row, code: 'invalid_phone', value: invalidPhone })
      invalidRows.add(row)
      hasRowError = true
    }
    if (employmentStatus && !EMPLOYMENT_STATUSES.has(employmentStatus)) {
      errors.push({ row, code: 'invalid_status', value: employmentStatus })
      invalidRows.add(row)
      hasRowError = true
    }
    if (contractTypeInput && nationality !== 'china' && !expatProfile.contractType) {
      errors.push({ row, code: 'invalid_contract_type', value: contractTypeInput })
      invalidRows.add(row)
      hasRowError = true
    }
    if (
      nationality !== 'china' &&
      expatProfile.contractType === 'CDD' &&
      expatProfile.baseSalaryUnit === 'HOUR'
    ) {
      errors.push({ row, code: 'invalid_base_salary_unit' })
      invalidRows.add(row)
      hasRowError = true
    }
    if (nationality !== 'china' && expatProfile.contractNumber) {
      const contractKey = expatProfile.contractNumber.toLowerCase()
      if (seenContractNumbers.has(contractKey)) {
        errors.push({ row, code: 'duplicate_contract_number', value: expatProfile.contractNumber })
        invalidRows.add(row)
        hasRowError = true
      } else {
        seenContractNumbers.add(contractKey)
      }
    }
    if (hasBirthDateInput && !parsedBirthDate) {
      errors.push({ row, code: 'invalid_birth_date', value: String(member.birthDate ?? '') })
      invalidRows.add(row)
      hasRowError = true
    }

    let joinDate: Date | null = null
    if (typeof member.joinDate === 'string' && member.joinDate.trim().length) {
      const candidate = new Date(member.joinDate)
      if (Number.isNaN(candidate.getTime())) {
        errors.push({ row, code: 'invalid_join_date', value: member.joinDate })
        invalidRows.add(row)
        hasRowError = true
      } else {
        joinDate = candidate
      }
    }

    let resolvedBirthDate = parsedBirthDate
    if (!resolvedBirthDate && nationality === 'china' && !hasBirthDateInput) {
      resolvedBirthDate = parseChineseIdBirthDate(chineseProfile.idNumber)
    }
    if (!hasRowError && !resolvedBirthDate) {
      errors.push({ row, code: 'missing_birth_date' })
      invalidRows.add(row)
      hasRowError = true
    }
    const isTerminated = employmentStatus === 'TERMINATED'
    let resolvedTerminationDate: Date | null = null
    let resolvedTerminationReason: string | null = null
    if (isTerminated) {
      if (!terminationDateValue) {
        errors.push({ row, code: 'missing_termination_date' })
        invalidRows.add(row)
        hasRowError = true
      } else {
        resolvedTerminationDate = terminationDateValue
      }
      if (!terminationReasonText) {
        errors.push({ row, code: 'missing_termination_reason' })
        invalidRows.add(row)
        hasRowError = true
      } else {
        resolvedTerminationReason = terminationReasonText
      }
    }

    if (!hasRowError && resolvedBirthDate) {
      prepared.push({
        row,
        username: username || null,
        password: password || null,
        name,
        gender,
        nationality,
        phones,
        joinDate,
        birthDate: resolvedBirthDate,
        hasBirthDateInput,
        terminationDate: resolvedTerminationDate,
        terminationReason: resolvedTerminationReason,
        position,
        employmentStatus,
        hasEmploymentStatusInput,
        tags: normalizeTagsInput(member.tags),
        hasTagsInput: member.tags !== undefined,
        roleIds: uniqueRoleIds,
        chineseProfile,
        hasChineseProfileData: hasChineseProfileData(chineseProfile),
        expatProfile,
        hasExpatProfileData: hasExpatProfileData(expatProfile),
      })
    }
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }
  if (prepared.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const identityKey = (memberName: string, birthDate: Date) =>
    `${memberName}\u0000${birthDate.toISOString().slice(0, 10)}`
  const identityMap = new Map<string, { name: string; birthDate: Date }>()
  prepared.forEach((member) => {
    identityMap.set(identityKey(member.name, member.birthDate), {
      name: member.name,
      birthDate: member.birthDate,
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
        username: true,
        nationality: true,
        joinDate: true,
      },
      })
    : []
  const matchesByIdentity = new Map<
    string,
    Array<{ id: number; username: string; nationality: string | null; joinDate: Date | null }>
  >()
  existingUsers.forEach((user) => {
    if (!user.birthDate) return
    const key = identityKey(user.name, user.birthDate)
    const list = matchesByIdentity.get(key) ?? []
    list.push({
      id: user.id,
      username: user.username,
      nationality: user.nationality,
      joinDate: user.joinDate,
    })
    matchesByIdentity.set(key, list)
  })

  const usernameValues = Array.from(
    new Set(
      prepared
        .map((member) => member.username)
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const existingUsernames = usernameValues.length
    ? await prisma.user.findMany({
        where: {
          OR: usernameValues.map((value) => ({
            username: { equals: value, mode: 'insensitive' },
          })),
        },
        select: { id: true, username: true },
      })
    : []
  const usernamesByValue = new Map(
    existingUsernames.map((user) => [user.username.toLowerCase(), user.id]),
  )

  const contractNumberValues = Array.from(
    new Set(
      prepared
        .map((member) => member.expatProfile.contractNumber)
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const existingContractNumbers = contractNumberValues.length
    ? await prisma.userExpatProfile.findMany({
        where: {
          OR: contractNumberValues.map((value) => ({
            contractNumber: { equals: value, mode: 'insensitive' },
          })),
        },
        select: { userId: true, contractNumber: true },
      })
    : []
  const contractByValue = new Map(
    existingContractNumbers.flatMap((item) =>
      item.contractNumber ? [[item.contractNumber.toLowerCase(), item.userId] as const] : [],
    ),
  )

  const matchByRow = new Map<
    number,
    { id: number; username: string; nationality: string | null; joinDate: Date | null } | null
  >()
  prepared.forEach((member) => {
    const key = identityKey(member.name, member.birthDate)
    const matches = matchesByIdentity.get(key) ?? []
    if (matches.length > 1) {
      errors.push({ row: member.row, code: 'duplicate_identity' })
      invalidRows.add(member.row)
      matchByRow.set(member.row, null)
      return
    }
    const match = matches[0] ?? null
    matchByRow.set(member.row, match)
    if (!match) {
      if (!member.username) {
        errors.push({ row: member.row, code: 'missing_username' })
        invalidRows.add(member.row)
      }
      if (!member.password) {
        errors.push({ row: member.row, code: 'missing_password' })
        invalidRows.add(member.row)
      }
    }
    if (member.username) {
      const existingUserId = usernamesByValue.get(member.username)
      if (existingUserId && existingUserId !== match?.id) {
        errors.push({ row: member.row, code: 'username_exists', value: member.username })
        invalidRows.add(member.row)
      }
    }
    if (member.expatProfile.contractNumber) {
      const existingUserId = contractByValue.get(member.expatProfile.contractNumber.toLowerCase())
      if (existingUserId && existingUserId !== match?.id) {
        errors.push({
          row: member.row,
          code: 'contract_number_exists',
          value: member.expatProfile.contractNumber,
        })
        invalidRows.add(member.row)
      }
    }
  })

  if (canAssignRole) {
    const roleIds = Array.from(new Set(prepared.flatMap((member) => member.roleIds)))
    if (roleIds.length > 0) {
      const roles = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } })
      const roleSet = new Set(roles.map((role) => role.id))
      prepared.forEach((member) => {
        member.roleIds.forEach((roleId) => {
          if (!roleSet.has(roleId)) {
            errors.push({ row: member.row, code: 'role_not_found', value: String(roleId) })
            invalidRows.add(member.row)
          }
        })
      })
    }
  }

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const candidates = ignoreErrors
    ? prepared.filter((member) => !invalidRows.has(member.row))
    : prepared
  const resolvedCandidates = candidates.map((member) => ({
    member,
    match: matchByRow.get(member.row) ?? null,
    passwordHash: member.password ? hashPassword(member.password) : null,
  }))
  if (resolvedCandidates.length === 0) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  const candidateBatches: typeof resolvedCandidates[] = []
  for (let i = 0; i < resolvedCandidates.length; i += IMPORT_BATCH_SIZE) {
    candidateBatches.push(resolvedCandidates.slice(i, i + IMPORT_BATCH_SIZE))
  }

  for (const batch of candidateBatches) {
    await prisma.$transaction(
      async (tx) => {
      for (const { member, match, passwordHash } of batch) {
        const resolvedNationality = member.nationality ?? match?.nationality ?? null
        const isChinese = resolvedNationality === 'china'
        const shouldUpsertChineseProfile = isChinese && member.hasChineseProfileData
        const shouldUpsertExpatProfile = !isChinese || member.hasExpatProfileData
        const addOneYear = (date: Date) => {
          const next = new Date(date)
          next.setFullYear(next.getFullYear() + 1)
          return next
        }
        const resolvedJoinDate = member.joinDate ?? match?.joinDate ?? null
        const resolvedContractStartDate =
          !isChinese ? member.expatProfile.contractStartDate ?? resolvedJoinDate : null
        const resolvedContractEndDate =
          !isChinese
            ? member.expatProfile.contractEndDate ??
              (resolvedContractStartDate ? addOneYear(resolvedContractStartDate) : null)
            : null
        const shouldUpdateContractDates =
          member.expatProfile.contractStartDate !== null ||
          member.expatProfile.contractEndDate !== null
        const chineseProfileUpdate = {
          ...(member.chineseProfile.frenchName
            ? { frenchName: member.chineseProfile.frenchName }
            : {}),
          ...(member.chineseProfile.idNumber ? { idNumber: member.chineseProfile.idNumber } : {}),
          ...(member.chineseProfile.passportNumber
            ? { passportNumber: member.chineseProfile.passportNumber }
            : {}),
          ...(member.chineseProfile.educationAndMajor
            ? { educationAndMajor: member.chineseProfile.educationAndMajor }
            : {}),
          ...(member.chineseProfile.certifications.length > 0
            ? { certifications: member.chineseProfile.certifications }
            : {}),
          ...(member.chineseProfile.domesticMobile
            ? { domesticMobile: member.chineseProfile.domesticMobile }
            : {}),
          ...(member.chineseProfile.emergencyContactName
            ? { emergencyContactName: member.chineseProfile.emergencyContactName }
            : {}),
          ...(member.chineseProfile.emergencyContactPhone
            ? { emergencyContactPhone: member.chineseProfile.emergencyContactPhone }
            : {}),
          ...(member.chineseProfile.redBookValidYears !== null
            ? { redBookValidYears: member.chineseProfile.redBookValidYears }
            : {}),
          ...(member.chineseProfile.cumulativeAbroadYears !== null
            ? { cumulativeAbroadYears: member.chineseProfile.cumulativeAbroadYears }
            : {}),
          ...(member.chineseProfile.birthplace ? { birthplace: member.chineseProfile.birthplace } : {}),
          ...(member.chineseProfile.residenceInChina
            ? { residenceInChina: member.chineseProfile.residenceInChina }
            : {}),
          ...(member.chineseProfile.medicalHistory
            ? { medicalHistory: member.chineseProfile.medicalHistory }
            : {}),
          ...(member.chineseProfile.healthStatus
            ? { healthStatus: member.chineseProfile.healthStatus }
            : {}),
        }
        const expatProfileUpdate = {
          ...(member.expatProfile.chineseSupervisorId !== null
            ? { chineseSupervisorId: member.expatProfile.chineseSupervisorId }
            : {}),
          ...(member.expatProfile.team ? { team: member.expatProfile.team } : {}),
          ...(member.expatProfile.contractNumber
            ? { contractNumber: member.expatProfile.contractNumber }
            : {}),
          ...(member.expatProfile.contractType
            ? { contractType: member.expatProfile.contractType }
            : {}),
          ...(shouldUpdateContractDates
            ? {
                contractStartDate: resolvedContractStartDate,
                contractEndDate: resolvedContractEndDate,
              }
            : {}),
          ...(member.expatProfile.salaryCategory
            ? { salaryCategory: member.expatProfile.salaryCategory }
            : {}),
          ...(member.expatProfile.prime ? { prime: member.expatProfile.prime } : {}),
          ...(member.expatProfile.baseSalaryAmount
            ? { baseSalaryAmount: member.expatProfile.baseSalaryAmount }
            : {}),
          ...(member.expatProfile.baseSalaryUnit
            ? { baseSalaryUnit: member.expatProfile.baseSalaryUnit }
            : {}),
          ...(member.expatProfile.netMonthlyAmount
            ? { netMonthlyAmount: member.expatProfile.netMonthlyAmount }
            : {}),
          ...(member.expatProfile.netMonthlyUnit
            ? { netMonthlyUnit: member.expatProfile.netMonthlyUnit }
            : {}),
          ...(member.expatProfile.maritalStatus
            ? { maritalStatus: member.expatProfile.maritalStatus }
            : {}),
          ...(member.expatProfile.childrenCount !== null
            ? { childrenCount: member.expatProfile.childrenCount }
            : {}),
          ...(member.expatProfile.cnpsNumber
            ? { cnpsNumber: member.expatProfile.cnpsNumber }
            : {}),
          ...(member.expatProfile.cnpsDeclarationCode
            ? { cnpsDeclarationCode: member.expatProfile.cnpsDeclarationCode }
            : {}),
          ...(member.expatProfile.provenance
            ? { provenance: member.expatProfile.provenance }
            : {}),
          ...(member.expatProfile.emergencyContactName
            ? { emergencyContactName: member.expatProfile.emergencyContactName }
            : {}),
          ...(member.expatProfile.emergencyContactPhone
            ? { emergencyContactPhone: member.expatProfile.emergencyContactPhone }
            : {}),
        }
        if (!match) {
          const resolvedEmploymentStatus = member.employmentStatus ?? 'ACTIVE'
          await tx.user.create({
            data: {
              username: member.username!,
              passwordHash: passwordHash!,
              name: member.name,
              gender: member.gender ?? null,
              nationality: member.nationality ?? null,
              phones: member.phones,
              joinDate: member.joinDate ?? new Date(),
              birthDate: member.birthDate,
              tags: member.tags ?? [],
              terminationDate:
                resolvedEmploymentStatus === 'TERMINATED' ? member.terminationDate : null,
              terminationReason:
                resolvedEmploymentStatus === 'TERMINATED' ? member.terminationReason : null,
              position: member.position ?? null,
              employmentStatus: resolvedEmploymentStatus,
              chineseProfile: shouldUpsertChineseProfile
                ? {
                    create: member.chineseProfile,
                  }
                : undefined,
              expatProfile: shouldUpsertExpatProfile
                ? {
                    create: {
                      ...member.expatProfile,
                      contractStartDate: resolvedContractStartDate,
                      contractEndDate: resolvedContractEndDate,
                    },
                  }
                : undefined,
              roles:
                canAssignRole && member.roleIds.length > 0
                  ? {
                      create: member.roleIds.map((id) => ({
                        role: { connect: { id } },
                      })),
                    }
                  : undefined,
            },
          })
          continue
        }

        const terminationPayload = member.hasEmploymentStatusInput
          ? member.employmentStatus === 'TERMINATED'
            ? {
                terminationDate: member.terminationDate,
                terminationReason: member.terminationReason,
              }
            : { terminationDate: null, terminationReason: null }
          : {}
        await tx.user.update({
          where: { id: match.id },
          data: {
            ...(member.username ? { username: member.username } : {}),
            ...(passwordHash ? { passwordHash } : {}),
            name: member.name,
            ...(member.gender ? { gender: member.gender } : {}),
            ...(member.nationality ? { nationality: member.nationality } : {}),
            ...(member.phones.length > 0 ? { phones: member.phones } : {}),
            ...(member.joinDate ? { joinDate: member.joinDate } : {}),
            ...(member.hasTagsInput ? { tags: member.tags ?? [] } : {}),
            ...(member.hasBirthDateInput ? { birthDate: member.birthDate } : {}),
            ...(member.position ? { position: member.position } : {}),
            ...(member.hasEmploymentStatusInput
              ? { employmentStatus: member.employmentStatus ?? 'ACTIVE' }
              : {}),
            ...terminationPayload,
            chineseProfile: shouldUpsertChineseProfile
              ? {
                  upsert: {
                    create: member.chineseProfile,
                    update: chineseProfileUpdate,
                  },
                }
              : undefined,
            expatProfile: shouldUpsertExpatProfile
              ? {
                  upsert: {
                    create: member.expatProfile,
                    update: expatProfileUpdate,
                  },
                }
              : undefined,
            roles: canAssignRole
              ? member.roleIds.length > 0
                ? {
                    deleteMany: {},
                    create: member.roleIds.map((id) => ({
                      role: { connect: { id } },
                    })),
                  }
                : undefined
              : undefined,
          },
        })
      }
      },
      {
        maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
        timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
      },
    )
  }

  return NextResponse.json({
    imported: resolvedCandidates.length,
    errors: errors.length ? errors : undefined,
  })
}
