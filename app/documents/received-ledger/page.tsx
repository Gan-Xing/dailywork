import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'
import { listReceivedDocumentLedgers } from '@/lib/server/receivedDocumentLedgerStore'
import { listRoadSections } from '@/lib/server/roadStore'

import { DocumentsAccessDenied } from '../DocumentsAccessDenied'
import { ReceivedLedgerPageClient } from './ReceivedLedgerPageClient'

const HIDDEN_PROJECT_CODES = new Set(['project-tieb-highway', 'project-abidjan-office'])
const HIDDEN_PROJECT_NAME_KEYWORDS = ['铁布高速项目', '阿比让办事处']

const isHiddenProject = (project: { code: string | null; name: string }) =>
  Boolean(project.code && HIDDEN_PROJECT_CODES.has(project.code)) ||
  HIDDEN_PROJECT_NAME_KEYWORDS.some((keyword) => project.name.includes(keyword))

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

  const [projectsRaw, roadSectionsRaw, users, sourceOrgRows] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    listRoadSections(),
    prisma.user.findMany({
      select: { id: true, name: true, username: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.receivedDocumentLedger.findMany({
      where: { sourceOrg: { not: null } },
      select: { sourceOrg: true },
      distinct: ['sourceOrg'],
      orderBy: [{ sourceOrg: 'asc' }],
    }),
  ])

  const hiddenProjectIds = projectsRaw
    .filter((project) => isHiddenProject(project))
    .map((project) => project.id)
  const hiddenProjectIdSet = new Set(hiddenProjectIds)

  const projects = projectsRaw.filter((project) => !hiddenProjectIdSet.has(project.id))
  const roadSections = roadSectionsRaw.filter(
    (section) => !section.projectId || !hiddenProjectIdSet.has(section.projectId),
  )
  roadSections.sort(
    (left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN') || left.id - right.id,
  )

  const initialResult = await listReceivedDocumentLedgers({
    page: 1,
    pageSize: 20,
    excludeProjectIds: hiddenProjectIds,
  })

  const sourceOrgOptions = sourceOrgRows
    .map((row) => row.sourceOrg?.trim() ?? '')
    .filter((item): item is string => Boolean(item))

  return (
    <ReceivedLedgerPageClient
      initialResult={initialResult}
      projects={projects}
      roadSections={roadSections}
      users={users}
      hiddenProjectIds={hiddenProjectIds}
      sourceOrgOptions={sourceOrgOptions}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
