import { listTemplates } from '@/lib/server/templateStore'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { TemplatesPageClient } from './TemplatesPageClient'

function formatDate(value: Date | null) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

export default async function TemplatesPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('template:view') || permissions.includes('template:update')
  const canCreate = permissions.includes('template:create')
  const canUpdate = permissions.includes('template:update')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['template:view']} variant="templatesList" />
  }

  const templates = await listTemplates()
  const items = templates.length ? templates : [await loadBordereauTemplateFromFile()]
  const templateItems = items.map((tpl) => ({
    id: String(tpl.id),
    name: tpl.name,
    type: (tpl as { type?: string | null }).type ?? null,
    status: tpl.status,
    version: tpl.version,
    language: tpl.language ?? '',
    updatedAt: formatDate(tpl.updatedAt),
  }))

  return (
    <TemplatesPageClient items={templateItems} canCreate={canCreate} canUpdate={canUpdate} />
  )
}
