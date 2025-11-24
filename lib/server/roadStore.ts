import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { RoadSectionDTO, RoadSectionPayload } from '@/lib/progressTypes'
import { resolveRoadLabels } from '@/lib/i18n/roadDictionary'

const normalizeValue = (value: string) => value.trim()

const normalizePayload = (payload: RoadSectionPayload): RoadSectionPayload => ({
  slug: normalizeValue(payload.slug),
  name: normalizeValue(payload.name),
  startPk: normalizeValue(payload.startPk),
  endPk: normalizeValue(payload.endPk),
})

const validatePayload = (payload: RoadSectionPayload) => {
  if (!payload.slug) {
    throw new Error('路由标识不能为空')
  }
  if (!/^[a-z0-9-]+$/.test(payload.slug)) {
    throw new Error('路由标识仅允许小写字母、数字和连字符')
  }
  if (!payload.name) {
    throw new Error('路段名称不能为空')
  }
  if (!payload.startPk || !payload.endPk) {
    throw new Error('起点和终点不能为空')
  }
  if (payload.name.length > 120) {
    throw new Error('路段名称请控制在 120 字以内')
  }
  if (payload.startPk.length > 60 || payload.endPk.length > 60) {
    throw new Error('起点或终点字段过长')
  }
}

const mapToDTO = (row: {
  id: number
  slug: string
  name: string
  startPk: string
  endPk: string
  createdAt: Date
  updatedAt: Date
}): RoadSectionDTO => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  labels: resolveRoadLabels({ slug: row.slug, name: row.name }),
  startPk: row.startPk,
  endPk: row.endPk,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const listRoadSections = async () => {
  const rows = await prisma.roadSection.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapToDTO)
}

export const createRoadSection = async (payload: RoadSectionPayload) => {
  const normalized = normalizePayload(payload)
  validatePayload(normalized)
  const created = await prisma.roadSection.create({
    data: normalized,
  })
  return mapToDTO(created)
}

export const updateRoadSection = async (id: number, payload: RoadSectionPayload) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的路段 ID')
  }
  const normalized = normalizePayload(payload)
  validatePayload(normalized)
  const updated = await prisma.roadSection.update({
    where: { id },
    data: normalized,
  })
  return mapToDTO(updated)
}

export const deleteRoadSection = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的路段 ID')
  }
  await prisma.roadSection.delete({
    where: { id },
  })
}

export const isRecordNotFound = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export const isUniqueConstraintError = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export const getRoadBySlug = async (slug: string) => {
  const row = await prisma.roadSection.findUnique({
    where: { slug },
  })
  return row ? mapToDTO(row) : null
}
