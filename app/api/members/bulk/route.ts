import { Prisma, type ContractType, type EmploymentStatus, type SalaryUnit } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { normalizeTagsInput } from '@/lib/members/utils'
import { hasPermission } from '@/lib/server/authSession'
import { isDecimalEqual, resolveSupervisorSnapshot } from '@/lib/server/compensation'
import {
  normalizeChineseProfile,
  normalizeExpatProfile,
  parseChineseIdBirthDate,
} from '@/lib/server/memberProfiles'
import { prisma } from '@/lib/prisma'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasField = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

const normalizeNullableString = (value: unknown) => {
  if (value === null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

type ExpatSnapshot = {
  contractNumber: string | null
  contractType: ContractType | null
  contractStartDate: Date | null
  contractEndDate: Date | null
  salaryCategory: string | null
  prime: string | null
  baseSalaryAmount: string | null
  baseSalaryUnit: SalaryUnit | null
  netMonthlyAmount: string | null
  netMonthlyUnit: SalaryUnit | null
  team: string | null
  chineseSupervisorId: number | null
}

export async function POST(request: NextRequest) {
  const canUpdateMember =
    (await hasPermission('member:update')) ||
    (await hasPermission('member:edit')) ||
    (await hasPermission('member:manage'))
  if (!canUpdateMember) {
    return NextResponse.json({ error: 'Missing member update permission' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Missing bulk update payload' }, { status: 400 })
  }

  const results: Array<{ id: number; ok: boolean; error?: string }> = []

  for (const item of items) {
    const userId = Number(item?.id)
    if (!userId) {
      results.push({ id: userId || 0, ok: false, error: 'Missing member ID' })
      continue
    }

    const patch = isRecord(item?.patch) ? item.patch : null
    if (!patch) {
      results.push({ id: userId, ok: false, error: 'Missing update payload' })
      continue
    }

    if (
      hasField(patch, 'name') ||
      hasField(patch, 'username') ||
      hasField(patch, 'password') ||
      hasField(patch, 'birthDate')
    ) {
      results.push({ id: userId, ok: false, error: 'Payload includes non-editable fields' })
      continue
    }

    const expatPatch = isRecord(patch.expatProfile) ? patch.expatProfile : null
    const chinesePatch = isRecord(patch.chineseProfile) ? patch.chineseProfile : null

    if (expatPatch && hasField(expatPatch, 'contractNumber')) {
      results.push({ id: userId, ok: false, error: 'Contract number is not bulk-editable' })
      continue
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          gender: true,
          nationality: true,
          phones: true,
          tags: true,
          joinDate: true,
          birthDate: true,
          position: true,
          employmentStatus: true,
          terminationDate: true,
          terminationReason: true,
          chineseProfile: {
            select: {
              frenchName: true,
              idNumber: true,
              passportNumber: true,
              educationAndMajor: true,
              certifications: true,
              domesticMobile: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
              redBookValidYears: true,
              cumulativeAbroadYears: true,
              birthplace: true,
              residenceInChina: true,
              medicalHistory: true,
              healthStatus: true,
            },
          },
          expatProfile: {
            select: {
              chineseSupervisorId: true,
              team: true,
              contractNumber: true,
              contractType: true,
              contractStartDate: true,
              contractEndDate: true,
              salaryCategory: true,
              prime: true,
              baseSalaryAmount: true,
              baseSalaryUnit: true,
              netMonthlyAmount: true,
              netMonthlyUnit: true,
              maritalStatus: true,
              childrenCount: true,
              cnpsNumber: true,
              cnpsDeclarationCode: true,
              provenance: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
            },
          },
        },
      })

      if (!existingUser) {
        results.push({ id: userId, ok: false, error: 'Member not found' })
        continue
      }

      const userUpdates: Prisma.UserUpdateInput = {}
      const resolvedNationality = hasField(patch, 'nationality')
        ? normalizeNullableString(patch.nationality)
        : existingUser.nationality
      const isChinese = resolvedNationality === 'china'

      if (hasField(patch, 'gender')) {
        userUpdates.gender = normalizeNullableString(patch.gender)
      }

      if (hasField(patch, 'nationality')) {
        userUpdates.nationality = resolvedNationality
      }

      if (hasField(patch, 'phones')) {
        const phones = patch.phones
        const phoneList: string[] = Array.isArray(phones)
          ? phones.filter(Boolean)
          : typeof phones === 'string'
            ? phones
                .split(/[,\uFF0C;\/]/)
                .map((item) => item.trim())
                .filter(Boolean)
            : []
        userUpdates.phones = phoneList
      }

      if (hasField(patch, 'tags')) {
        userUpdates.tags = normalizeTagsInput(patch.tags as string[] | string | null)
      }

      if (hasField(patch, 'position')) {
        const position = normalizeNullableString(patch.position)
        userUpdates.position = position
      }

      let resolvedJoinDate = existingUser.joinDate ?? null
      if (hasField(patch, 'joinDate')) {
        const parsedJoinDate = parseOptionalDate(patch.joinDate)
        if (patch.joinDate !== null && parsedJoinDate === null) {
          results.push({ id: userId, ok: false, error: 'Invalid join date' })
          continue
        }
        resolvedJoinDate = parsedJoinDate ?? null
        userUpdates.joinDate = resolvedJoinDate
      }

      const statusInputProvided = hasField(patch, 'employmentStatus')
      const resolvedEmploymentStatus: EmploymentStatus = statusInputProvided
        ? (patch.employmentStatus as EmploymentStatus)
        : existingUser.employmentStatus

      let resolvedTerminationDate = existingUser.terminationDate ?? null
      let resolvedTerminationReason = existingUser.terminationReason ?? null

      if (hasField(patch, 'terminationDate')) {
        const parsedTerminationDate = parseOptionalDate(patch.terminationDate)
        if (patch.terminationDate !== null && parsedTerminationDate === null) {
          results.push({ id: userId, ok: false, error: 'Invalid termination date' })
          continue
        }
        resolvedTerminationDate = parsedTerminationDate ?? null
        userUpdates.terminationDate = resolvedTerminationDate
      }

      if (hasField(patch, 'terminationReason')) {
        resolvedTerminationReason = normalizeNullableString(patch.terminationReason)
        userUpdates.terminationReason = resolvedTerminationReason
      }

      if (statusInputProvided) {
        if (resolvedEmploymentStatus !== 'TERMINATED') {
          resolvedTerminationDate = null
          resolvedTerminationReason = null
          userUpdates.terminationDate = null
          userUpdates.terminationReason = null
        }
      }

      if (resolvedEmploymentStatus === 'TERMINATED') {
        if (!resolvedTerminationDate) {
          results.push({ id: userId, ok: false, error: 'Termination date required' })
          continue
        }
        if (!resolvedTerminationReason) {
          results.push({ id: userId, ok: false, error: 'Termination reason required' })
          continue
        }
      } else if (
        (hasField(patch, 'terminationDate') && resolvedTerminationDate) ||
        (hasField(patch, 'terminationReason') && resolvedTerminationReason)
      ) {
        results.push({
          id: userId,
          ok: false,
          error: 'Termination fields require terminated status',
        })
        continue
      }

      let resolvedBirthDate = existingUser.birthDate
      if (!resolvedBirthDate && isChinese) {
        const fallbackBirthDate = parseChineseIdBirthDate(
          existingUser.chineseProfile?.idNumber ?? null,
        )
        resolvedBirthDate = fallbackBirthDate
      }
      if (!resolvedBirthDate) {
        results.push({ id: userId, ok: false, error: 'Birth date required' })
        continue
      }

      const existingExpat = existingUser.expatProfile
      const nextExpat: ExpatSnapshot = {
        contractNumber: existingExpat?.contractNumber ?? null,
        contractType: existingExpat?.contractType ?? null,
        contractStartDate: existingExpat?.contractStartDate ?? null,
        contractEndDate: existingExpat?.contractEndDate ?? null,
        salaryCategory: existingExpat?.salaryCategory ?? null,
        prime: existingExpat?.prime?.toString() ?? null,
        baseSalaryAmount: existingExpat?.baseSalaryAmount?.toString() ?? null,
        baseSalaryUnit: existingExpat?.baseSalaryUnit ?? null,
        netMonthlyAmount: existingExpat?.netMonthlyAmount?.toString() ?? null,
        netMonthlyUnit: existingExpat?.netMonthlyUnit ?? null,
        team: existingExpat?.team ?? null,
        chineseSupervisorId: existingExpat?.chineseSupervisorId ?? null,
      }

      const expatUpdates: Prisma.UserExpatProfileUncheckedUpdateWithoutUserInput = {}
      let expatCreateData: Prisma.UserExpatProfileUncheckedCreateWithoutUserInput | null = null

      if (expatPatch) {
        const normalizedExpat = normalizeExpatProfile(expatPatch)
        const expatHas = (key: string) => hasField(expatPatch, key)
        const baseSalaryProvided =
          expatHas('baseSalary') || expatHas('baseSalaryAmount') || expatHas('baseSalaryUnit')
        const netMonthlyProvided =
          expatHas('netMonthly') || expatHas('netMonthlyAmount') || expatHas('netMonthlyUnit')
        const hasContractStart = expatHas('contractStartDate')
        const hasContractEnd = expatHas('contractEndDate')

        if (expatHas('team')) {
          expatUpdates.team = normalizedExpat.team
          nextExpat.team = normalizedExpat.team
        }
        if (expatHas('chineseSupervisorId')) {
          expatUpdates.chineseSupervisorId = normalizedExpat.chineseSupervisorId
          nextExpat.chineseSupervisorId = normalizedExpat.chineseSupervisorId
        }
        if (expatHas('contractType')) {
          expatUpdates.contractType = normalizedExpat.contractType
          nextExpat.contractType = normalizedExpat.contractType
        }
        if (expatHas('salaryCategory')) {
          expatUpdates.salaryCategory = normalizedExpat.salaryCategory
          nextExpat.salaryCategory = normalizedExpat.salaryCategory
        }
        if (expatHas('prime')) {
          expatUpdates.prime = normalizedExpat.prime
          nextExpat.prime = normalizedExpat.prime
        }
        if (expatHas('maritalStatus')) expatUpdates.maritalStatus = normalizedExpat.maritalStatus
        if (expatHas('childrenCount')) expatUpdates.childrenCount = normalizedExpat.childrenCount
        if (expatHas('cnpsNumber')) expatUpdates.cnpsNumber = normalizedExpat.cnpsNumber
        if (expatHas('cnpsDeclarationCode'))
          expatUpdates.cnpsDeclarationCode = normalizedExpat.cnpsDeclarationCode
        if (expatHas('provenance')) expatUpdates.provenance = normalizedExpat.provenance
        if (expatHas('emergencyContactName'))
          expatUpdates.emergencyContactName = normalizedExpat.emergencyContactName
        if (expatHas('emergencyContactPhone'))
          expatUpdates.emergencyContactPhone = normalizedExpat.emergencyContactPhone

        if (baseSalaryProvided) {
          expatUpdates.baseSalaryAmount = normalizedExpat.baseSalaryAmount
          expatUpdates.baseSalaryUnit = normalizedExpat.baseSalaryUnit
          nextExpat.baseSalaryAmount = normalizedExpat.baseSalaryAmount
          nextExpat.baseSalaryUnit = normalizedExpat.baseSalaryUnit
        }
        if (netMonthlyProvided) {
          expatUpdates.netMonthlyAmount = normalizedExpat.netMonthlyAmount
          expatUpdates.netMonthlyUnit = normalizedExpat.netMonthlyUnit
          nextExpat.netMonthlyAmount = normalizedExpat.netMonthlyAmount
          nextExpat.netMonthlyUnit = normalizedExpat.netMonthlyUnit
        }

        const addOneYear = (date: Date) => {
          const next = new Date(date)
          next.setFullYear(next.getFullYear() + 1)
          return next
        }
        let resolvedContractStartDate = nextExpat.contractStartDate
        let resolvedContractEndDate = nextExpat.contractEndDate

        if (hasContractStart) {
          resolvedContractStartDate = normalizedExpat.contractStartDate
        }
        if (hasContractEnd) {
          resolvedContractEndDate = normalizedExpat.contractEndDate
        }

        if (!existingExpat) {
          if (!hasContractStart) {
            resolvedContractStartDate = resolvedJoinDate
          }
          if (!hasContractEnd) {
            resolvedContractEndDate = resolvedContractStartDate
              ? addOneYear(resolvedContractStartDate)
              : null
          }
        } else if (hasContractStart && !hasContractEnd) {
          resolvedContractEndDate = resolvedContractStartDate
            ? addOneYear(resolvedContractStartDate)
            : null
        }

        if (hasContractStart || !existingExpat) {
          expatUpdates.contractStartDate = resolvedContractStartDate
        }
        if (hasContractEnd || hasContractStart || !existingExpat) {
          expatUpdates.contractEndDate = resolvedContractEndDate
        }
        nextExpat.contractStartDate = resolvedContractStartDate
        nextExpat.contractEndDate = resolvedContractEndDate

        if (
          !isChinese &&
          (expatHas('contractType') || baseSalaryProvided || !existingExpat) &&
          nextExpat.contractType === 'CDD' &&
          nextExpat.baseSalaryUnit === 'HOUR'
        ) {
          results.push({ id: userId, ok: false, error: 'CDD base salary must be monthly' })
          continue
        }

        expatCreateData = {
          team: normalizedExpat.team,
          chineseSupervisorId: normalizedExpat.chineseSupervisorId,
          contractNumber: existingExpat?.contractNumber ?? null,
          contractType: normalizedExpat.contractType,
          contractStartDate: resolvedContractStartDate,
          contractEndDate: resolvedContractEndDate,
          salaryCategory: normalizedExpat.salaryCategory,
          prime: normalizedExpat.prime,
          baseSalaryAmount: normalizedExpat.baseSalaryAmount,
          baseSalaryUnit: normalizedExpat.baseSalaryUnit,
          netMonthlyAmount: normalizedExpat.netMonthlyAmount,
          netMonthlyUnit: normalizedExpat.netMonthlyUnit,
          maritalStatus: normalizedExpat.maritalStatus,
          childrenCount: normalizedExpat.childrenCount,
          cnpsNumber: normalizedExpat.cnpsNumber,
          cnpsDeclarationCode: normalizedExpat.cnpsDeclarationCode,
          provenance: normalizedExpat.provenance,
          emergencyContactName: normalizedExpat.emergencyContactName,
          emergencyContactPhone: normalizedExpat.emergencyContactPhone,
        }

        if (normalizedExpat.chineseSupervisorId) {
          const supervisor = await prisma.user.findUnique({
            where: { id: normalizedExpat.chineseSupervisorId },
            select: { nationality: true },
          })
          if (!supervisor || supervisor.nationality !== 'china') {
            results.push({
              id: userId,
              ok: false,
              error: 'Chinese supervisor must be a Chinese national',
            })
            continue
          }
        }
      }

      let chineseCreateData: Prisma.UserChineseProfileCreateWithoutUserInput | null = null
      const chineseUpdates: Prisma.UserChineseProfileUpdateWithoutUserInput = {}
      if (chinesePatch) {
        const normalizedChinese = normalizeChineseProfile(chinesePatch)
        const chineseHas = (key: string) => hasField(chinesePatch, key)

        if (chineseHas('frenchName')) chineseUpdates.frenchName = normalizedChinese.frenchName
        if (chineseHas('idNumber')) chineseUpdates.idNumber = normalizedChinese.idNumber
        if (chineseHas('passportNumber'))
          chineseUpdates.passportNumber = normalizedChinese.passportNumber
        if (chineseHas('educationAndMajor'))
          chineseUpdates.educationAndMajor = normalizedChinese.educationAndMajor
        if (chineseHas('certifications'))
          chineseUpdates.certifications = normalizedChinese.certifications
        if (chineseHas('domesticMobile'))
          chineseUpdates.domesticMobile = normalizedChinese.domesticMobile
        if (chineseHas('emergencyContactName'))
          chineseUpdates.emergencyContactName = normalizedChinese.emergencyContactName
        if (chineseHas('emergencyContactPhone'))
          chineseUpdates.emergencyContactPhone = normalizedChinese.emergencyContactPhone
        if (chineseHas('redBookValidYears'))
          chineseUpdates.redBookValidYears = normalizedChinese.redBookValidYears
        if (chineseHas('cumulativeAbroadYears'))
          chineseUpdates.cumulativeAbroadYears = normalizedChinese.cumulativeAbroadYears
        if (chineseHas('birthplace')) chineseUpdates.birthplace = normalizedChinese.birthplace
        if (chineseHas('residenceInChina'))
          chineseUpdates.residenceInChina = normalizedChinese.residenceInChina
        if (chineseHas('medicalHistory'))
          chineseUpdates.medicalHistory = normalizedChinese.medicalHistory
        if (chineseHas('healthStatus')) chineseUpdates.healthStatus = normalizedChinese.healthStatus

        chineseCreateData = {
          frenchName: normalizedChinese.frenchName,
          idNumber: normalizedChinese.idNumber,
          passportNumber: normalizedChinese.passportNumber,
          educationAndMajor: normalizedChinese.educationAndMajor,
          certifications: normalizedChinese.certifications,
          domesticMobile: normalizedChinese.domesticMobile,
          emergencyContactName: normalizedChinese.emergencyContactName,
          emergencyContactPhone: normalizedChinese.emergencyContactPhone,
          redBookValidYears: normalizedChinese.redBookValidYears,
          cumulativeAbroadYears: normalizedChinese.cumulativeAbroadYears,
          birthplace: normalizedChinese.birthplace,
          residenceInChina: normalizedChinese.residenceInChina,
          medicalHistory: normalizedChinese.medicalHistory,
          healthStatus: normalizedChinese.healthStatus,
        }
      }

      if (expatPatch && Object.keys(expatUpdates).length > 0 && expatCreateData) {
        userUpdates.expatProfile = {
          upsert: {
            create: expatCreateData,
            update: expatUpdates,
          },
        }
      }

      if (chinesePatch && Object.keys(chineseUpdates).length > 0 && chineseCreateData) {
        userUpdates.chineseProfile = {
          upsert: {
            create: chineseCreateData,
            update: chineseUpdates,
          },
        }
      }
      const isSameDate = (left?: Date | null, right?: Date | null) => {
        if (!left && !right) return true
        if (!left || !right) return false
        return left.getTime() === right.getTime()
      }

      const contractChanged =
        existingExpat?.contractNumber !== nextExpat.contractNumber ||
        existingExpat?.contractType !== nextExpat.contractType ||
        !isSameDate(existingExpat?.contractStartDate, nextExpat.contractStartDate) ||
        !isSameDate(existingExpat?.contractEndDate, nextExpat.contractEndDate)

      const payrollChanged =
        existingExpat?.salaryCategory !== nextExpat.salaryCategory ||
        !isDecimalEqual(existingExpat?.prime?.toString() ?? null, nextExpat.prime ?? null) ||
        !isDecimalEqual(
          existingExpat?.baseSalaryAmount?.toString() ?? null,
          nextExpat.baseSalaryAmount ?? null,
        ) ||
        existingExpat?.baseSalaryUnit !== nextExpat.baseSalaryUnit ||
        !isDecimalEqual(
          existingExpat?.netMonthlyAmount?.toString() ?? null,
          nextExpat.netMonthlyAmount ?? null,
        ) ||
        existingExpat?.netMonthlyUnit !== nextExpat.netMonthlyUnit

      const shouldTrackExpatChanges = Boolean(userUpdates.expatProfile) || Boolean(existingExpat)
      const supervisorSnapshot = await resolveSupervisorSnapshot(nextExpat.chineseSupervisorId)

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...userUpdates,
            name: existingUser.name ?? '',
            birthDate: resolvedBirthDate,
            employmentStatus: resolvedEmploymentStatus,
            terminationDate: resolvedTerminationDate,
            terminationReason: resolvedTerminationReason,
          },
        })

        if (!isChinese && shouldTrackExpatChanges && contractChanged) {
          await tx.userContractChange.create({
            data: {
              userId,
              chineseSupervisorId: supervisorSnapshot.id,
              chineseSupervisorName: supervisorSnapshot.name,
              contractNumber: nextExpat.contractNumber,
              contractType: nextExpat.contractType,
              salaryCategory: nextExpat.salaryCategory,
              salaryAmount: nextExpat.baseSalaryAmount,
              salaryUnit: nextExpat.baseSalaryUnit,
              prime: nextExpat.prime,
              startDate: nextExpat.contractStartDate,
              endDate: nextExpat.contractEndDate,
            },
          })
        }

        if (!isChinese && shouldTrackExpatChanges && payrollChanged) {
          await tx.userPayrollChange.create({
            data: {
              userId,
              team: nextExpat.team,
              chineseSupervisorId: supervisorSnapshot.id,
              chineseSupervisorName: supervisorSnapshot.name,
              salaryCategory: nextExpat.salaryCategory,
              salaryAmount: nextExpat.baseSalaryAmount,
              salaryUnit: nextExpat.baseSalaryUnit,
              prime: nextExpat.prime,
              baseSalaryAmount: nextExpat.baseSalaryAmount,
              baseSalaryUnit: nextExpat.baseSalaryUnit,
              netMonthlyAmount: nextExpat.netMonthlyAmount,
              netMonthlyUnit: nextExpat.netMonthlyUnit,
            },
          })
        }
      })

      results.push({ id: userId, ok: true })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        results.push({ id: userId, ok: false, error: 'Duplicate field value; update failed' })
      } else {
        results.push({
          id: userId,
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to update member',
        })
      }
    }
  }

  return NextResponse.json({ results })
}
