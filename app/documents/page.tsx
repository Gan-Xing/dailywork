import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from './DocumentsAccessDenied'
import { DocumentsHubClient } from './DocumentsHubClient'

export default async function DocumentsPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const hasDocumentAccess = permissions.some((perm) =>
    [
      'file:view',
      'file:upload',
      'file:update',
      'file:delete',
      'file:manage',
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
      <DocumentsAccessDenied permissions={['submission:view', 'template:view', 'file:view']} variant="hub" />
    )
  }

  const canViewSubmissions =
    permissions.includes('submission:view') || permissions.includes('submission:update')
  const canCreateSubmission = permissions.includes('submission:create')
  const canViewLetters =
    permissions.includes('submission:view') || permissions.includes('submission:update')
  const canCreateLetter = permissions.includes('submission:create')
  const canViewTemplates =
    permissions.includes('template:view') || permissions.includes('template:update')
  const canViewFiles = permissions.includes('file:view') || permissions.includes('file:manage')

  return (
    <DocumentsHubClient
      canViewSubmissions={canViewSubmissions}
      canCreateSubmission={canCreateSubmission}
      canViewLetters={canViewLetters}
      canCreateLetter={canCreateLetter}
      canViewTemplates={canViewTemplates}
      canViewFiles={canViewFiles}
    />
  )
}
