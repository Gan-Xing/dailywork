import { NextResponse } from 'next/server'
import type { EmploymentStatus as PrismaEmploymentStatus } from '@prisma/client'

import { hashPassword } from '@/lib/auth/password'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const PHONE_PATTERN = /^[+\d][\d\s-]{4,}$/
const EMPLOYMENT_STATUSES: Set<PrismaEmploymentStatus> = new Set([
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
])

type ImportMemberInput = {
  row?: number
  username?: string
  password?: string
  name?: string
  gender?: string | null
  nationality?: string | null
  phones?: string[] | string | null
  joinDate?: string | null
  position?: string | null
  employmentStatus?: string | null
  roleIds?: number[]
}

type ImportErrorCode =
  | 'missing_username'
  | 'missing_password'
  | 'duplicate_username'
  | 'username_exists'
  | 'invalid_gender'
  | 'invalid_phone'
  | 'invalid_status'
  | 'invalid_join_date'
  | 'role_not_found'

type ImportError = {
  row: number
  code: ImportErrorCode
  value?: string
}

export async function POST(request: Request) {
  if (!(await hasPermission('member:manage'))) {
    return NextResponse.json({ error: '缺少成员管理权限' }, { status: 403 })
  }
  const canManageRole = await hasPermission('role:manage')
  const body = await request.json().catch(() => null)
  const ignoreErrors = Boolean(body?.ignoreErrors)
  const members = Array.isArray(body?.members) ? (body?.members as ImportMemberInput[]) : []
  if (members.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const errors: ImportError[] = []
  const invalidRows = new Set<number>()
  const prepared: Array<{
    row: number
    username: string
    password: string
    name: string
    gender: string | null
    nationality: string | null
    phones: string[]
    joinDate: Date | null
    position: string | null
    employmentStatus: PrismaEmploymentStatus | null
    roleIds: number[]
  }> = []
  const seenUsernames = new Set<string>()

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
    const gender = typeof member.gender === 'string' ? member.gender.trim() : null
    const nationality = typeof member.nationality === 'string' ? member.nationality.trim() : null
    const phones = normalizePhoneList(member.phones)
    const position =
      typeof member.position === 'string' && member.position.trim().length ? member.position.trim() : null
    const employmentStatus =
      typeof member.employmentStatus === 'string' && member.employmentStatus.trim().length
        ? (member.employmentStatus.trim() as PrismaEmploymentStatus)
        : null
    const roleIds =
      canManageRole && Array.isArray(member.roleIds)
        ? member.roleIds.map((value: unknown) => Number(value)).filter(Boolean)
        : []
    const uniqueRoleIds = Array.from(new Set(roleIds))

    let hasRowError = false
    if (!username) {
      errors.push({ row, code: 'missing_username' })
      invalidRows.add(row)
      hasRowError = true
    } else if (seenUsernames.has(username)) {
      errors.push({ row, code: 'duplicate_username' })
      invalidRows.add(row)
      hasRowError = true
    } else {
      seenUsernames.add(username)
    }
    if (!password) {
      errors.push({ row, code: 'missing_password' })
      invalidRows.add(row)
      hasRowError = true
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

    if (!hasRowError) {
      prepared.push({
        row,
        username,
        password,
        name: typeof member.name === 'string' ? member.name.trim() : '',
        gender,
        nationality,
        phones,
        joinDate,
        position,
        employmentStatus,
        roleIds: uniqueRoleIds,
      })
    }
  })

  if (errors.length > 0 && !ignoreErrors) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }
  if (prepared.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 })
  }

  const existingUsers =
    await prisma.user.findMany({
      where: {
        OR: prepared.map((member) => ({
          username: { equals: member.username, mode: 'insensitive' },
        })),
      },
      select: { username: true },
    })
  if (existingUsers.length > 0) {
    const existing = new Set(existingUsers.map((user) => user.username.toLowerCase()))
    prepared.forEach((member) => {
      if (existing.has(member.username)) {
        errors.push({ row: member.row, code: 'username_exists', value: member.username })
        invalidRows.add(member.row)
      }
    })
  }

  if (canManageRole) {
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
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'IMPORT_VALIDATION_FAILED', errors }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const member of candidates) {
      await tx.user.create({
        data: {
          username: member.username,
          passwordHash: hashPassword(member.password),
          name: member.name ?? '',
          gender: member.gender ?? null,
          nationality: member.nationality ?? null,
          phones: member.phones,
          joinDate: member.joinDate ?? new Date(),
          position: member.position ?? null,
          employmentStatus: member.employmentStatus ?? 'ACTIVE',
          roles:
            canManageRole && member.roleIds.length > 0
              ? {
                  create: member.roleIds.map((id) => ({
                    role: { connect: { id } },
                  })),
                }
              : undefined,
        },
      })
    }
  })

  return NextResponse.json({ imported: candidates.length, errors: errors.length ? errors : undefined })
}
