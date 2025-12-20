import { notFound } from 'next/navigation'

import { getTemplate } from '@/lib/server/templateStore'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'
import { getSessionUser } from '@/lib/server/authSession'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { TemplateDetailClient } from './TemplateDetailClient'

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return notFound()

  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('template:view') || permissions.includes('template:update')
  const canUpdate = permissions.includes('template:update')
  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['template:view']} variant="templateDetail" />
  }

  const isFileSource = id === 'file-bordereau'
  const tpl = isFileSource ? await loadBordereauTemplateFromFile() : await getTemplate(id)
  if (!tpl) return notFound()

  const templateDetail = {
    id: String(tpl.id),
    name: tpl.name,
    status: tpl.status,
    version: tpl.version,
    language: tpl.language ?? null,
    html: tpl.html,
    placeholders: tpl.placeholders as Array<{ key: string; path?: string }>,
  }

  return (
    <TemplateDetailClient
      template={templateDetail}
      source={isFileSource ? 'file' : 'database'}
      showEditForm={!isFileSource && canUpdate}
    />
  )
}
