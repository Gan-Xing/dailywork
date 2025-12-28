import { prisma } from '@/lib/prisma'
import { formatSupervisorLabel } from '@/lib/members/utils'

type SupervisorSnapshot = {
  id: number | null
  name: string | null
}

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

export const resolveSupervisorSnapshot = async (
  supervisorId: number | null,
): Promise<SupervisorSnapshot> => {
  if (!supervisorId) {
    return { id: null, name: null }
  }
  const supervisor = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: {
      id: true,
      username: true,
      name: true,
      nationality: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  if (!supervisor) {
    throw new Error('中方负责人不存在')
  }
  if (supervisor.nationality !== 'china') {
    throw new Error('中方负责人必须为中国籍成员')
  }
  return { id: supervisor.id, name: formatSupervisorName(supervisor) }
}

export const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export const normalizeOptionalDecimal = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return null
}

export const normalizeOptionalDate = (value: unknown) => {
  if (!value) return null
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '') return null
  const parsed = raw instanceof Date ? raw : new Date(raw as string)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export const parseContractType = (value: unknown) => {
  if (typeof value !== 'string') return null
  const text = value.trim().toUpperCase()
  if (!text) return null
  if (text === 'CTJ') return 'CTJ'
  if (text === 'CDD') return 'CDD'
  return null
}

export const parseSalaryUnit = (value: unknown) => {
  if (typeof value !== 'string') return null
  const text = value.trim().toUpperCase()
  if (!text) return null
  if (text === 'MONTH') return 'MONTH'
  if (text === 'HOUR') return 'HOUR'
  return null
}

export const isDecimalEqual = (left: unknown, right: unknown) => {
  if (left === null || left === undefined || left === '') {
    return right === null || right === undefined || right === ''
  }
  if (right === null || right === undefined || right === '') return false
  const leftNum = Number.parseFloat(String(left))
  const rightNum = Number.parseFloat(String(right))
  if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) {
    return String(left) === String(right)
  }
  return Math.abs(leftNum - rightNum) < 0.0001
}
