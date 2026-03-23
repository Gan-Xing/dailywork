import type { Prisma } from '@prisma/client'

import { formatSupervisorLabel } from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'

const weeklyPlanSignerSelect = {
  id: true,
  name: true,
  username: true,
  nationality: true,
  employmentStatus: true,
  chineseProfile: {
    select: {
      frenchName: true,
    },
  },
} satisfies Prisma.UserSelect

type WeeklyPlanSignerRecord = Prisma.UserGetPayload<{ select: typeof weeklyPlanSignerSelect }>

export type WeeklyPlanSignerOption = {
  id: number
  name: string | null
  frenchName: string | null
  username: string
  employmentStatus: string
  label: string
}

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed ? trimmed : null
}

const toSignerOption = (user: WeeklyPlanSignerRecord): WeeklyPlanSignerOption => {
  const name = normalizeText(user.name)
  const frenchName = normalizeText(user.chineseProfile?.frenchName)
  const username = normalizeText(user.username) ?? ''

  return {
    id: user.id,
    name,
    frenchName,
    username,
    employmentStatus: user.employmentStatus,
    label: formatSupervisorLabel({ name, frenchName, username }) ?? username,
  }
}

const buildSnapshotName = (user: WeeklyPlanSignerRecord | null | undefined): string | null => {
  if (!user) return null
  return normalizeText(user.name) ?? normalizeText(user.chineseProfile?.frenchName) ?? normalizeText(user.username)
}

const normalizeOptionalUserId = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export const listWeeklyPlanSignerUsers = async (): Promise<WeeklyPlanSignerOption[]> => {
  const users = await prisma.user.findMany({
    where: { nationality: 'china' },
    select: weeklyPlanSignerSelect,
    orderBy: [{ name: 'asc' }, { username: 'asc' }, { id: 'asc' }],
  })

  return users.map(toSignerOption)
}

export const resolveWeeklyPlanSignerInput = async (input: {
  approverUserId?: unknown
  editorUserId?: unknown
  approverName?: string | null
  editorName?: string | null
}) => {
  const approverUserId = normalizeOptionalUserId(input.approverUserId)
  const editorUserId = normalizeOptionalUserId(input.editorUserId)
  const signerIds = Array.from(new Set([approverUserId, editorUserId].filter((value): value is number => value != null)))

  const users = signerIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: signerIds },
          nationality: 'china',
        },
        select: weeklyPlanSignerSelect,
      })
    : []

  const userMap = new Map(users.map((user) => [user.id, user]))
  if (userMap.size !== signerIds.length) {
    throw new Error('INVALID_WEEKLY_PLAN_SIGNER')
  }

  return {
    approverUserId,
    editorUserId,
    approverName: approverUserId
      ? buildSnapshotName(userMap.get(approverUserId) ?? null) ?? null
      : normalizeText(input.approverName),
    editorName: editorUserId
      ? buildSnapshotName(userMap.get(editorUserId) ?? null) ?? null
      : normalizeText(input.editorName),
  }
}
