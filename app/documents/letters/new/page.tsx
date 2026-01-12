import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { NewLetterPageClient } from './NewLetterPageClient'

export default async function NewLetterPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canCreate = permissions.includes('submission:create')
  const canDelete = permissions.includes('submission:delete')

  if (!sessionUser || !canCreate) {
    return <DocumentsAccessDenied permissions={['submission:create']} variant="letterCreate" />
  }

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return <NewLetterPageClient projects={projects} canEdit={canCreate} canDelete={canDelete} />
}
