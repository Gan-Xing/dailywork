import { DocumentStatus, DocumentType } from '@prisma/client'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type LetterDetail = {
  id: number
  documentId: number
  documentCode: string
  status: DocumentStatus
  projectId: number
  boqItemId: number | null
  boqItemCode: string | null
  boqItemDesignationZh: string | null
  boqItemDesignationFr: string | null
  letterNumber: number
  subject: string
  senderOrg: string | null
  recipientOrg: string | null
  issuedAt: Date | null
  receivedAt: Date | null
  remark: string | null
  createdAt: Date
  updatedAt: Date
}

const resolveProjectCode = (project: { id: number; code: string | null }) =>
  project.code && project.code.trim().length ? project.code.trim() : `P${project.id}`

const buildLetterDocumentCode = (project: { id: number; code: string | null }, letterNumber: number) => {
  const year = new Date().getFullYear()
  return `N°${String(letterNumber).padStart(3, '0')}/${year}/DG/BDK/CRBC`
}

const buildLetterData = (input: {
  content?: string | null
  senderName?: string | null
  recipientName?: string | null
}): Prisma.InputJsonValue | undefined => {
  const data: Record<string, unknown> = {}
  if (input.content !== undefined) {
    data.content = input.content ?? ''
  }
  if (input.senderName !== undefined) {
    data.senderName = input.senderName ?? ''
  }
  if (input.recipientName !== undefined) {
    data.recipientName = input.recipientName ?? ''
  }
  return Object.keys(data).length ? (data as Prisma.InputJsonValue) : undefined
}

const mergeLetterData = (
  current: unknown,
  input: { content?: string | null; senderName?: string | null; recipientName?: string | null },
): Prisma.InputJsonValue => {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {}
  if (input.content !== undefined) base.content = input.content ?? ''
  if (input.senderName !== undefined) base.senderName = input.senderName ?? ''
  if (input.recipientName !== undefined) base.recipientName = input.recipientName ?? ''
  return base as Prisma.InputJsonValue
}

const mapLetterDetail = (letter: {
  id: number
  documentId: number
  projectId: number
  boqItemId: number | null
  letterNumber: number
  subject: string
  senderOrg: string | null
  recipientOrg: string | null
  issuedAt: Date | null
  receivedAt: Date | null
  remark: string | null
  createdAt: Date
  updatedAt: Date
  document: { code: string; status: DocumentStatus }
  boqItem?: { code: string; designationZh: string; designationFr: string } | null
}): LetterDetail => ({
  id: letter.id,
  documentId: letter.documentId,
  documentCode: letter.document.code,
  status: letter.document.status,
  projectId: letter.projectId,
  boqItemId: letter.boqItemId ?? null,
  boqItemCode: letter.boqItem?.code ?? null,
  boqItemDesignationZh: letter.boqItem?.designationZh ?? null,
  boqItemDesignationFr: letter.boqItem?.designationFr ?? null,
  letterNumber: letter.letterNumber,
  subject: letter.subject,
  senderOrg: letter.senderOrg ?? null,
  recipientOrg: letter.recipientOrg ?? null,
  issuedAt: letter.issuedAt ?? null,
  receivedAt: letter.receivedAt ?? null,
  remark: letter.remark ?? null,
  createdAt: letter.createdAt,
  updatedAt: letter.updatedAt,
})

export const listLettersByBoqItem = async (boqItemId: number): Promise<LetterDetail[]> => {
  const letters = await prisma.letter.findMany({
    where: { boqItemId },
    include: {
      document: { select: { id: true, code: true, status: true } },
      boqItem: { select: { code: true, designationZh: true, designationFr: true } },
    },
    orderBy: [{ letterNumber: 'desc' }, { id: 'desc' }],
  })
  return letters.map(mapLetterDetail)
}

export const listLettersByProject = async (projectId: number): Promise<LetterDetail[]> => {
  const letters = await prisma.letter.findMany({
    where: { projectId },
    include: {
      document: { select: { id: true, code: true, status: true } },
      boqItem: { select: { code: true, designationZh: true, designationFr: true } },
    },
    orderBy: [{ letterNumber: 'desc' }, { id: 'desc' }],
  })
  return letters.map(mapLetterDetail)
}

export const createLetter = async (input: {
  projectId?: number
  boqItemId?: number | null
  subject: string
  senderOrg?: string | null
  recipientOrg?: string | null
  issuedAt?: Date | null
  receivedAt?: Date | null
  remark?: string | null
  status?: DocumentStatus
  documentCode?: string | null
  content?: string | null
  senderName?: string | null
  recipientName?: string | null
  userId?: number | null
}): Promise<LetterDetail> => {
  return prisma.$transaction(async (tx) => {
    let resolvedProjectId = input.projectId ?? null
    let resolvedBoqItemId: number | null = null
    let boqItemDetail:
      | {
          id: number
          projectId: number
          code: string
          designationZh: string
          designationFr: string
        }
      | null = null

    if (input.boqItemId !== undefined && input.boqItemId !== null) {
      const boqItem = await tx.boqItem.findUnique({
        where: { id: input.boqItemId },
        select: {
          id: true,
          projectId: true,
          code: true,
          designationZh: true,
          designationFr: true,
        },
      })
      if (!boqItem) {
        throw new Error('工程量清单条目无效')
      }
      if (resolvedProjectId && resolvedProjectId !== boqItem.projectId) {
        throw new Error('项目与清单条目不匹配')
      }
      resolvedProjectId = boqItem.projectId
      resolvedBoqItemId = boqItem.id
      boqItemDetail = boqItem
    }
    if (!resolvedProjectId) {
      throw new Error('项目编号无效')
    }

    const project = await tx.project.findUnique({
      where: { id: resolvedProjectId },
      select: { id: true, code: true },
    })
    if (!project) {
      throw new Error('项目不存在')
    }

    const latest = await tx.letter.findFirst({
      where: { projectId: resolvedProjectId },
      orderBy: { letterNumber: 'desc' },
      select: { letterNumber: true },
    })
    const nextNumber = (latest?.letterNumber ?? 0) + 1
    const documentCode =
      input.documentCode?.trim() || buildLetterDocumentCode(project, nextNumber)

    const document = await tx.document.create({
      data: {
        code: documentCode,
        type: DocumentType.LETTER,
        status: input.status ?? DocumentStatus.DRAFT,
        title: input.subject,
        remark: input.remark ?? undefined,
        data: buildLetterData({
          content: input.content,
          senderName: input.senderName,
          recipientName: input.recipientName,
        }),
        createdById: input.userId ?? undefined,
        updatedById: input.userId ?? undefined,
      },
      select: { id: true, code: true, status: true },
    })

    const letter = await tx.letter.create({
      data: {
        documentId: document.id,
        projectId: resolvedProjectId,
        boqItemId: resolvedBoqItemId,
        letterNumber: nextNumber,
        subject: input.subject,
        senderOrg: input.senderOrg ?? null,
        recipientOrg: input.recipientOrg ?? null,
        issuedAt: input.issuedAt ?? null,
        receivedAt: input.receivedAt ?? null,
        remark: input.remark ?? null,
      },
      include: {
        boqItem: { select: { code: true, designationZh: true, designationFr: true } },
      },
    })

    return {
      id: letter.id,
      documentId: document.id,
      documentCode: document.code,
      status: document.status,
      projectId: letter.projectId,
      boqItemId: letter.boqItemId ?? null,
      boqItemCode: letter.boqItem?.code ?? boqItemDetail?.code ?? null,
      boqItemDesignationZh: letter.boqItem?.designationZh ?? boqItemDetail?.designationZh ?? null,
      boqItemDesignationFr: letter.boqItem?.designationFr ?? boqItemDetail?.designationFr ?? null,
      letterNumber: letter.letterNumber,
      subject: letter.subject,
      senderOrg: letter.senderOrg ?? null,
      recipientOrg: letter.recipientOrg ?? null,
      issuedAt: letter.issuedAt ?? null,
      receivedAt: letter.receivedAt ?? null,
      remark: letter.remark ?? null,
      createdAt: letter.createdAt,
      updatedAt: letter.updatedAt,
    }
  })
}

export const updateLetter = async (
  letterId: number,
  input: {
    subject?: string
    senderOrg?: string | null
    recipientOrg?: string | null
    issuedAt?: Date | null
    receivedAt?: Date | null
    remark?: string | null
    boqItemId?: number | null
    status?: DocumentStatus
    documentCode?: string | null
    content?: string | null
    senderName?: string | null
    recipientName?: string | null
    userId?: number | null
  },
): Promise<LetterDetail> => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.letter.findUnique({
      where: { id: letterId },
      include: {
        document: { select: { id: true, code: true, status: true, data: true } },
        boqItem: { select: { code: true, designationZh: true, designationFr: true } },
      },
    })
    if (!existing) {
      throw new Error('函件不存在')
    }

    let nextBoqItemId: number | null | undefined = undefined
    let nextBoqItemDetail:
      | { code: string; designationZh: string; designationFr: string }
      | null
      | undefined = undefined
    if (input.boqItemId !== undefined) {
      if (input.boqItemId === null) {
        nextBoqItemId = null
        nextBoqItemDetail = null
      } else if (!Number.isInteger(input.boqItemId) || input.boqItemId <= 0) {
        throw new Error('工程量清单条目无效')
      } else {
        const boqItem = await tx.boqItem.findUnique({
          where: { id: input.boqItemId },
          select: { id: true, projectId: true, code: true, designationZh: true, designationFr: true },
        })
        if (!boqItem) {
          throw new Error('工程量清单条目无效')
        }
        if (boqItem.projectId !== existing.projectId) {
          throw new Error('项目与清单条目不匹配')
        }
        nextBoqItemId = boqItem.id
        nextBoqItemDetail = {
          code: boqItem.code,
          designationZh: boqItem.designationZh,
          designationFr: boqItem.designationFr,
        }
      }
    }

    const shouldUpdateDocument =
      input.status !== undefined ||
      input.userId !== undefined ||
      input.subject !== undefined ||
      input.remark !== undefined ||
      input.documentCode !== undefined ||
      input.content !== undefined ||
      input.senderName !== undefined ||
      input.recipientName !== undefined
    const updatedDocument = shouldUpdateDocument
      ? await tx.document.update({
          where: { id: existing.documentId },
          data: {
            code: input.documentCode === undefined ? undefined : input.documentCode?.trim(),
            status: input.status ?? undefined,
            title: input.subject ?? undefined,
            remark: input.remark === undefined ? undefined : input.remark,
            data:
              input.content !== undefined ||
              input.senderName !== undefined ||
              input.recipientName !== undefined
                ? mergeLetterData(existing.document.data, {
                    content: input.content,
                    senderName: input.senderName,
                    recipientName: input.recipientName,
                  })
                : undefined,
            updatedById: input.userId ?? undefined,
          },
          select: { id: true, code: true, status: true, data: true },
        })
      : existing.document

    const updatedLetter = await tx.letter.update({
      where: { id: letterId },
      data: {
        subject: input.subject ?? undefined,
        senderOrg: input.senderOrg === undefined ? undefined : input.senderOrg,
        recipientOrg: input.recipientOrg === undefined ? undefined : input.recipientOrg,
        issuedAt: input.issuedAt === undefined ? undefined : input.issuedAt,
        receivedAt: input.receivedAt === undefined ? undefined : input.receivedAt,
        remark: input.remark === undefined ? undefined : input.remark,
        boqItemId: nextBoqItemId === undefined ? undefined : nextBoqItemId,
      },
      include: { boqItem: { select: { code: true, designationZh: true, designationFr: true } } },
    })

    return {
      id: updatedLetter.id,
      documentId: updatedDocument.id,
      documentCode: updatedDocument.code,
      status: updatedDocument.status,
      projectId: updatedLetter.projectId,
      boqItemId: updatedLetter.boqItemId ?? null,
      boqItemCode:
        updatedLetter.boqItem?.code ??
        nextBoqItemDetail?.code ??
        existing.boqItem?.code ??
        null,
      boqItemDesignationZh:
        updatedLetter.boqItem?.designationZh ??
        nextBoqItemDetail?.designationZh ??
        existing.boqItem?.designationZh ??
        null,
      boqItemDesignationFr:
        updatedLetter.boqItem?.designationFr ??
        nextBoqItemDetail?.designationFr ??
        existing.boqItem?.designationFr ??
        null,
      letterNumber: updatedLetter.letterNumber,
      subject: updatedLetter.subject,
      senderOrg: updatedLetter.senderOrg ?? null,
      recipientOrg: updatedLetter.recipientOrg ?? null,
      issuedAt: updatedLetter.issuedAt ?? null,
      receivedAt: updatedLetter.receivedAt ?? null,
      remark: updatedLetter.remark ?? null,
      createdAt: updatedLetter.createdAt,
      updatedAt: updatedLetter.updatedAt,
    }
  })
}
