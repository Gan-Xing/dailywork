import { DocumentType, TemplateStatus } from '@prisma/client'

import { extractPlaceholderKeys } from '@/lib/documents/templateLoader'

import { prisma } from '../prisma'

export const listTemplates = async () => {
  return prisma.documentTemplate.findMany({
    orderBy: [{ updatedAt: 'desc' }],
  })
}

export const getTemplate = async (id: string) => {
  if (!id) return null
  return prisma.documentTemplate.findUnique({
    where: { id },
  })
}

type CreateTemplateInput = {
  name: string
  html: string
  status?: TemplateStatus
  language?: string
  version?: number
  type?: DocumentType
  userId?: number | null
}

export const createTemplate = async (input: CreateTemplateInput) => {
  const placeholders = extractPlaceholderKeys(input.html)
  return prisma.documentTemplate.create({
    data: {
      name: input.name,
      html: input.html,
      placeholders,
      status: input.status ?? TemplateStatus.DRAFT,
      language: input.language ?? 'fr',
      version: input.version ?? 1,
      type: input.type ?? DocumentType.SUBMISSION,
      createdById: input.userId ?? undefined,
      updatedById: input.userId ?? undefined,
    },
  })
}

type UpdateTemplateInput = {
  name?: string
  html?: string
  status?: TemplateStatus
  language?: string
  version?: number
  type?: DocumentType
  userId?: number | null
}

export const updateTemplate = async (id: string, input: UpdateTemplateInput) => {
  if (!id) throw new Error('id 必填')
  const data: any = {
    name: input.name ?? undefined,
    status: input.status ?? undefined,
    language: input.language ?? undefined,
    version: input.version ?? undefined,
    type: input.type ?? undefined,
    updatedById: input.userId ?? undefined,
  }
  if (input.html !== undefined) {
    data.html = input.html
    data.placeholders = extractPlaceholderKeys(input.html)
  }
  return prisma.documentTemplate.update({
    where: { id },
    data,
  })
}

export const archiveTemplate = async (id: string, userId?: number | null) => {
  return prisma.documentTemplate.update({
    where: { id },
    data: { status: TemplateStatus.ARCHIVED, updatedById: userId ?? undefined },
  })
}

export const deleteTemplate = async (id: string) => {
  return prisma.documentTemplate.delete({ where: { id } })
}
