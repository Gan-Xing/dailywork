import { Prisma, DocumentStatus } from '@prisma/client'

import { prisma } from '../prisma'

const generateCode = async () => {
  const latest = await prisma.document.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  const next = (latest?.id ?? 0) + 1
  return `SUB-${String(next).padStart(3, '0')}`
}

const submissionInclude = {
  template: { select: { id: true, name: true, version: true, status: true } },
  createdBy: { select: { id: true, username: true } },
  updatedBy: { select: { id: true, username: true } },
  submission: true,
  items: { orderBy: { order: 'asc' } },
} as const

const normalizeSubmissionIdentifier = (value: string | number): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const trimmed = value.trim()
  const withoutPrefix = trimmed.toUpperCase().startsWith('SUB-') ? trimmed.slice(4) : trimmed
  const num = Number(withoutPrefix)
  return Number.isFinite(num) ? num : null
}

type SubmissionHead = {
  submissionNumber?: number
  projectName: string
  projectCode: string
  contractNumbers: string[]
  bordereauNumber: number
  subject: string
  senderOrg: string
  senderDate: string
  senderLastName: string
  senderFirstName: string
  senderSignature?: string | null
  senderTime?: string | null
  recipientOrg: string
  recipientDate: string
  recipientLastName: string
  recipientFirstName: string
  recipientSignature?: string | null
  recipientTime?: string | null
  comments?: string | null
}

type SubmissionItemInput = {
  designation: string
  quantity?: number | null
  observation?: string | null
  order?: number | null
}

const extractHead = (data: any): SubmissionHead => {
  const meta = data?.documentMeta ?? {}
  const sender = data?.parties?.sender ?? {}
  const recipient = data?.parties?.recipient ?? {}
  const resolvedSubmissionNumber =
    meta.submissionNumber !== undefined && meta.submissionNumber !== null && meta.submissionNumber !== ''
      ? Number(meta.submissionNumber)
      : meta.bordereauNumber !== undefined && meta.bordereauNumber !== null && meta.bordereauNumber !== ''
        ? Number(meta.bordereauNumber)
        : undefined
  return {
    submissionNumber: resolvedSubmissionNumber && resolvedSubmissionNumber > 0 ? resolvedSubmissionNumber : undefined,
    projectName: meta.projectName ?? '',
    projectCode: meta.projectCode ?? '',
    contractNumbers: Array.isArray(meta.contractNumbers) ? meta.contractNumbers : [],
    bordereauNumber: Number(meta.bordereauNumber) || 0,
    subject: meta.subject ?? '',
    senderOrg: sender.organization ?? '',
    senderDate: sender.date ?? '',
    senderLastName: sender.lastName ?? '',
    senderFirstName: sender.firstName ?? '',
    senderSignature: sender.signature ?? null,
    senderTime: sender.time ?? null,
    recipientOrg: recipient.organization ?? '',
    recipientDate: recipient.date ?? '',
    recipientLastName: recipient.lastName ?? '',
    recipientFirstName: recipient.firstName ?? '',
    recipientSignature: recipient.signature ?? null,
    recipientTime: recipient.time ?? null,
    comments: data?.comments ?? null,
  }
}

const extractItems = (data: any): SubmissionItemInput[] => {
  const items = Array.isArray(data?.items) ? data.items : []
  return items.map((item: any, idx: number) => ({
    designation: item?.designation ?? '',
    quantity: item?.quantity ?? null,
    observation: item?.observation ?? null,
    order: idx + 1,
  }))
}

export type SubmissionDocInput = {
  title?: string | null
  status?: DocumentStatus
  data?: Prisma.InputJsonValue | null
  templateId?: string | null
  templateVersion?: number | null
}

export const createSubmissionDoc = async (input: SubmissionDocInput, userId?: number | null) => {
  const code = await generateCode()
  const head = extractHead(input.data ?? {})
  const items = extractItems(input.data ?? {})
  const nextNumber =
    head.submissionNumber && head.submissionNumber > 0
      ? head.submissionNumber
      : ((await prisma.submission.findFirst({ orderBy: { submissionNumber: 'desc' }, select: { submissionNumber: true } }))?.submissionNumber ??
          0) + 1

  const document = await prisma.document.create({
    data: {
      code,
      title: input.title ?? undefined,
      status: input.status ?? DocumentStatus.DRAFT,
      data: input.data ?? undefined,
      templateId: input.templateId ?? undefined,
      templateVersion: input.templateVersion ?? undefined,
      createdById: userId ?? undefined,
      updatedById: userId ?? undefined,
      submission: {
        create: { ...head, submissionNumber: nextNumber },
      },
      items: items.length
        ? {
            createMany: {
              data: items,
            },
          }
        : undefined,
    },
    include: {
      submission: true,
    },
  })
  return document
}

export const updateSubmissionDoc = async (id: number, input: SubmissionDocInput, userId?: number | null) => {
  const head = extractHead(input.data ?? {})
  const items = extractItems(input.data ?? {})

  const nextNumber =
    head.submissionNumber && head.submissionNumber > 0
      ? head.submissionNumber
      : undefined

  const document = await prisma.document.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      status: input.status ?? undefined,
      data: input.data ?? undefined,
      templateId: input.templateId ?? undefined,
      templateVersion: input.templateVersion ?? undefined,
      updatedById: userId ?? undefined,
      submission: {
        upsert: {
          update: { ...head, submissionNumber: nextNumber ?? undefined },
          create: { ...head, submissionNumber: nextNumber ?? 1 },
        },
      },
      items: {
        deleteMany: { documentId: id },
        createMany: items.length
          ? {
              data: items,
            }
          : undefined,
      },
    },
    include: { submission: true },
  })
  return document
}

export const getSubmissionDoc = async (id: number) => {
  return prisma.document.findUnique({
    where: { id },
    include: submissionInclude,
  })
}

export const findSubmissionDocByIdentifier = async (identifier: string | number) => {
  const maybeNumber = normalizeSubmissionIdentifier(identifier)

  if (maybeNumber !== null) {
    const bySubmissionNumber = await prisma.document.findFirst({
      where: { submission: { submissionNumber: maybeNumber } },
      include: submissionInclude,
    })
    if (bySubmissionNumber) return bySubmissionNumber
  }

  if (typeof identifier === 'string' && identifier.trim()) {
    const trimmed = identifier.trim()
    const byCode = await prisma.document.findFirst({
      where: { code: trimmed },
      include: submissionInclude,
    })
    if (byCode) return byCode
  }

  if (maybeNumber !== null) {
    return prisma.document.findUnique({
      where: { id: maybeNumber },
      include: submissionInclude,
    })
  }

  return null
}

export const listSubmissionDocs = async () => {
  return prisma.document.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      template: { select: { id: true, name: true, version: true } },
      createdBy: { select: { id: true, username: true } },
      submission: { select: { submissionNumber: true } },
    },
  })
}
