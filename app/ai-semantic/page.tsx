import { SemanticCatalogClient } from './SemanticCatalogClient'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export default async function AiSemanticPage() {
  const sessionUser = await getSessionUser()
  const canView = sessionUser ? await hasPermission('permission:view') : false
  const canEdit = sessionUser ? await hasPermission('permission:update') : false

  return (
    <SemanticCatalogClient
      sessionUser={sessionUser ? { id: sessionUser.id, username: sessionUser.username } : null}
      canView={canView}
      canEdit={canEdit}
    />
  )
}
