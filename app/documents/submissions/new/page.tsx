import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { NewSubmissionPageClient } from './NewSubmissionPageClient'

export default async function NewSubmissionPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canCreate = permissions.includes('submission:create')
  const canManage = permissions.includes('submission:manage')

  if (!sessionUser || !canCreate) {
    return <DocumentsAccessDenied permissions={['submission:create']} variant="submissionCreate" />
  }

  return (
    <NewSubmissionPageClient canManage={canManage} canEdit={canCreate} currentUser={sessionUser} />
  )
}
