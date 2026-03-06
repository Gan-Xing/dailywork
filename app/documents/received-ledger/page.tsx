import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'
import { listReceivedDocumentLedgers } from '@/lib/server/receivedDocumentLedgerStore'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { ReceivedLedgerPageClient } from './ReceivedLedgerPageClient'

export default async function ReceivedLedgerPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('file:view') || permissions.includes('file:manage')
  const canCreate =
    permissions.includes('file:upload') ||
    permissions.includes('file:update') ||
    permissions.includes('file:manage')
  const canUpdate = permissions.includes('file:update') || permissions.includes('file:manage')
  const canDelete = permissions.includes('file:delete') || permissions.includes('file:manage')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['file:view']} variant="receivedLedgerList" />
  }

  const [projects, roadSections, users, initialResult] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.roadSection.findMany({
      select: { id: true, name: true, projectId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.user.findMany({
      select: { id: true, name: true, username: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    listReceivedDocumentLedgers({ page: 1, pageSize: 20 }),
  ])

  return (
    <ReceivedLedgerPageClient
      initialResult={initialResult}
      projects={projects}
      roadSections={roadSections}
      users={users}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
