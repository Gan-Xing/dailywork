import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { SubmissionsPageClient } from './SubmissionsPageClient'
import type { SubmissionRow } from './SubmissionsTable'

function formatDate(value?: Date | null) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

type QueryParams = {
  search?: string
  status?: string | string[]
  templateId?: string | string[]
  createdBy?: string | string[]
  submissionNumber?: string | string[]
  updatedFrom?: string
  updatedTo?: string
}

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const query = await searchParams
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('submission:view') || permissions.includes('submission:update')
  const canCreate = permissions.includes('submission:create')
  const canUpdate = permissions.includes('submission:update')
  const canDelete = permissions.includes('submission:delete')
  const canViewTemplates = permissions.includes('template:view') || permissions.includes('template:update')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['submission:view']} variant="submissionsList" />
  }
  const parseList = (value?: string | string[]) => {
    if (!value) return []
    const arr = Array.isArray(value) ? value : [value]
    return arr
      .join(',')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const statusList = parseList(query.status).filter((item) => item !== 'ALL')
  const templateIds = parseList(query.templateId).map((item) => Number(item)).filter((id) => Number.isFinite(id))
  const creatorIds = parseList(query.createdBy).map((item) => Number(item)).filter((id) => Number.isFinite(id))
  const submissionNumbers = parseList(query.submissionNumber)
    .map((item) => Number(item))
    .filter((id) => Number.isFinite(id))

  const where: any = {}
  if (query.search) {
    where.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { createdBy: { username: { contains: query.search, mode: 'insensitive' } } },
    ]
  }
  if (statusList.length) {
    where.status = { in: statusList }
  }
  if (templateIds.length) {
    where.templateId = { in: templateIds }
  }
  if (creatorIds.length) {
    where.createdById = { in: creatorIds }
  }
  if (submissionNumbers.length) {
    where.submission = { submissionNumber: { in: submissionNumbers } }
  }
  if (query.updatedFrom || query.updatedTo) {
    where.updatedAt = {}
    if (query.updatedFrom) where.updatedAt.gte = new Date(query.updatedFrom)
    if (query.updatedTo) where.updatedAt.lte = new Date(query.updatedTo)
  }
  const submissions = await prisma.document.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      template: { select: { name: true, version: true } },
      createdBy: { select: { username: true, name: true } },
      updatedBy: { select: { username: true, name: true } },
      submission: true,
      items: { select: { id: true, order: true, designation: true, quantity: true, observation: true, createdAt: true, updatedAt: true } },
    },
  })

  const [templates, creators] = await Promise.all([
    prisma.documentTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ select: { id: true, username: true, name: true }, orderBy: { username: 'asc' } }),
  ])

  const fallbackCreator = sessionUser?.username ?? ''

  const rows: SubmissionRow[] = submissions.flatMap<SubmissionRow>((row) => {
    const meta = (row.data as any)?.documentMeta ?? {}
    const sender = (row.data as any)?.parties?.sender ?? {}
    const recipient = (row.data as any)?.parties?.recipient ?? {}
    const submission = row.submission ?? null
    const contractNumbers =
      Array.isArray(submission?.contractNumbers) && submission?.contractNumbers.length
        ? (submission.contractNumbers as string[])
        : normalizeStringArray(meta.contractNumbers)
    const submissionNumber =
      submission?.submissionNumber ??
      (meta.submissionNumber !== undefined && meta.submissionNumber !== null && meta.submissionNumber !== ''
        ? Number(meta.submissionNumber)
        : null)
    const metaBordereauNumber =
      meta.bordereauNumber !== undefined && meta.bordereauNumber !== null && meta.bordereauNumber !== ''
        ? Number(meta.bordereauNumber)
        : null
    const base = {
      docId: row.id,
      itemId: null,
      itemOrder: null,
      code: submissionNumber ? `SUB-${submissionNumber}` : row.code,
      rawCode: row.code,
      title: row.title || meta.subject || '',
      status: row.status,
      templateId: row.templateId ?? null,
      templateName: row.template?.name ?? null,
      templateVersion: row.template?.version ?? row.templateVersion ?? null,
      documentType: row.type,
      documentRemark: row.remark ?? '',
      documentData: row.data ?? null,
      documentFiles: row.files ?? null,
      documentCreatedAt: formatDate(row.createdAt),
      documentUpdatedAt: formatDate(row.updatedAt),
      createdBy: row.createdBy?.name || row.createdBy?.username || fallbackCreator,
      createdById: row.createdById ?? null,
      updatedBy: row.updatedBy?.name || row.updatedBy?.username || '',
      updatedById: row.updatedById ?? null,
      submissionNumber,
      projectName: submission?.projectName ?? meta.projectName ?? '',
      projectCode: submission?.projectCode ?? meta.projectCode ?? '',
      contractNumbers,
      bordereauNumber: submission?.bordereauNumber ?? metaBordereauNumber,
      subject: submission?.subject ?? meta.subject ?? '',
      senderOrg: submission?.senderOrg ?? sender.organization ?? '',
      senderDate: submission?.senderDate ?? sender.date ?? '',
      senderLastName: submission?.senderLastName ?? sender.lastName ?? '',
      senderFirstName: submission?.senderFirstName ?? sender.firstName ?? '',
      senderTime: submission?.senderTime ?? sender.time ?? '',
      recipientOrg: submission?.recipientOrg ?? recipient.organization ?? '',
      recipientDate: submission?.recipientDate ?? recipient.date ?? '',
      recipientLastName: submission?.recipientLastName ?? recipient.lastName ?? '',
      recipientFirstName: submission?.recipientFirstName ?? recipient.firstName ?? '',
      recipientTime: submission?.recipientTime ?? recipient.time ?? '',
      comments: submission?.comments ?? (row.data as any)?.comments ?? '',
      submissionCreatedAt: formatDate(submission?.createdAt ?? null),
      submissionUpdatedAt: formatDate(submission?.updatedAt ?? null),
    }
    if (!row.items?.length) {
      return [{ ...base, designation: '', quantity: null, observation: '', itemCreatedAt: '', itemUpdatedAt: '' }]
    }
    return row.items.map((item) => ({
      ...base,
      itemId: item.id,
      itemOrder: item.order ?? null,
      designation: item.designation ?? '',
      quantity: item.quantity ?? null,
      observation: item.observation ?? '',
      itemCreatedAt: formatDate(item.createdAt),
      itemUpdatedAt: formatDate(item.updatedAt),
    }))
  })

  return (
    <SubmissionsPageClient
      query={query}
      templates={templates}
      creators={creators}
      statusList={statusList}
      submissionNumbers={submissionNumbers}
      rows={rows}
      canViewTemplates={canViewTemplates}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canView={canView}
    />
  )
}
