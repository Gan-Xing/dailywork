import { AccessDenied } from '@/components/AccessDenied'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'
import { listSiteVariationRawRecords } from '@/lib/server/siteVariationRawRecordStore'

import VariationRawRecordsClient from './VariationRawRecordsClient'

export default async function VariationRawRecordsPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('value:view') || sessionUser?.roles.some((role) => role.name === 'Admin')
  const canUpdate =
    permissions.includes('value:update') || sessionUser?.roles.some((role) => role.name === 'Admin')

  if (!sessionUser || !canView) {
    return <AccessDenied locale="zh" permissions={['value:view']} hint="需“产值查看”权限才能查看现场变更原始记录" />
  }

  const [projects, roadSections, initialResult] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.roadSection.findMany({
      select: { id: true, name: true, slug: true, projectId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    listSiteVariationRawRecords({ page: 1, pageSize: 20, sortBy: 'id', sortDir: 'asc' }),
  ])

  return (
    <VariationRawRecordsClient
      initialResult={initialResult}
      projects={projects}
      roadSections={roadSections}
      canUpdate={Boolean(canUpdate)}
    />
  )
}
