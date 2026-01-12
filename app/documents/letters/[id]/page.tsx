import { notFound } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { LetterDetailClient } from './LetterDetailClient'

export default async function LetterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const letterId = Number(id)
  if (!Number.isInteger(letterId) || letterId <= 0) {
    return notFound()
  }

  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('submission:view') || permissions.includes('submission:update')
  const canEdit = permissions.includes('submission:update')
  const canDelete = permissions.includes('submission:delete')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['submission:view']} variant="letterDetail" />
  }

  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    include: {
      project: { select: { id: true, name: true } },
      document: { select: { id: true, code: true, status: true, data: true, remark: true } },
    },
  })
  if (!letter) return notFound()

  const projects = await prisma.project.findMany({
    where: { OR: [{ isActive: true }, { id: letter.projectId }] },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  const data =
    letter.document.data && typeof letter.document.data === 'object' && !Array.isArray(letter.document.data)
      ? (letter.document.data as Record<string, unknown>)
      : {}
  const senderName = typeof data.senderName === 'string' ? data.senderName : ''
  const recipientName = typeof data.recipientName === 'string' ? data.recipientName : ''
  const content = typeof data.content === 'string' ? data.content : ''

  return (
    <LetterDetailClient
      initialLetter={{
        id: letter.id,
        documentId: letter.document.id,
        projectId: letter.projectId,
        projectName: letter.project.name,
        documentCode: letter.document.code,
        status: letter.document.status,
        subject: letter.subject,
        senderOrg: letter.senderOrg ?? '',
        senderName,
        recipientOrg: letter.recipientOrg ?? '',
        recipientName,
        issuedAt: letter.issuedAt ? letter.issuedAt.toISOString() : '',
        receivedAt: letter.receivedAt ? letter.receivedAt.toISOString() : '',
        content,
        remark: letter.remark ?? letter.document.remark ?? '',
      }}
      projects={projects}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  )
}
