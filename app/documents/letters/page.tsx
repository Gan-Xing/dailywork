import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { LettersPageClient, type LetterRow } from './LettersPageClient'

export default async function LettersPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('submission:view') || permissions.includes('submission:update')
  const canCreate = permissions.includes('submission:create')
  const canUpdate = permissions.includes('submission:update')
  const canDelete = permissions.includes('submission:delete')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['submission:view']} variant="lettersList" />
  }

  const letters = await prisma.letter.findMany({
    include: {
      project: { select: { id: true, name: true } },
      document: {
        select: {
          id: true,
          code: true,
          status: true,
          data: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ letterNumber: 'desc' }, { id: 'desc' }],
  })

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  const documentIds = letters.map((letter) => String(letter.documentId))
  const counts = documentIds.length
    ? await prisma.fileAssetLink.groupBy({
        by: ['entityId'],
        where: {
          entityType: 'document',
          entityId: { in: documentIds },
        },
        _count: { _all: true },
      })
    : []
  const countMap = new Map(counts.map((item) => [item.entityId, item._count._all]))

  const rows: LetterRow[] = letters.map((letter) => {
    const data = letter.document.data as Record<string, unknown> | null
    const recipientOrg = letter.recipientOrg ?? ''
    const recipientName = typeof data?.recipientName === 'string' ? data.recipientName : ''
    const recipientLabel = [recipientOrg, recipientName].filter(Boolean).join(' / ')
    return {
      id: letter.id,
      documentId: letter.document.id,
      code: letter.document.code,
      status: letter.document.status,
      subject: letter.subject,
      projectId: letter.projectId,
      projectName: letter.project.name,
      recipientLabel,
      updatedAt: letter.document.updatedAt.toISOString().slice(0, 10),
      attachments: countMap.get(String(letter.documentId)) ?? 0,
    }
  })

  return (
    <LettersPageClient
      rows={rows}
      projects={projects}
      canCreate={canCreate}
      canView={canView}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
