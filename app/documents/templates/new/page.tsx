import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { NewTemplatePageClient } from './NewTemplatePageClient'

export default async function NewTemplatePage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canCreate = permissions.includes('template:create')

  if (!sessionUser || !canCreate) {
    return <DocumentsAccessDenied permissions={['template:create']} variant="templateCreate" />
  }

  return <NewTemplatePageClient />
}
