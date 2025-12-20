import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from './DocumentsAccessDenied'
import { DocumentsHubClient } from './DocumentsHubClient'

export default async function DocumentsPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const hasDocumentAccess = permissions.some((perm) =>
    [
      'submission:view',
      'submission:create',
      'submission:update',
      'submission:delete',
      'submission:manage',
      'template:view',
      'template:create',
      'template:update',
      'template:delete',
    ].includes(perm),
  )
  if (!sessionUser || !hasDocumentAccess) {
    return (
      <DocumentsAccessDenied permissions={['submission:view', 'template:view']} variant="hub" />
    )
  }

  const canViewSubmissions =
    permissions.includes('submission:view') || permissions.includes('submission:update')
  const canCreateSubmission = permissions.includes('submission:create')
  const canViewTemplates =
    permissions.includes('template:view') || permissions.includes('template:update')

  return (
    <DocumentsHubClient
      canViewSubmissions={canViewSubmissions}
      canCreateSubmission={canCreateSubmission}
      canViewTemplates={canViewTemplates}
    />
  )
}
