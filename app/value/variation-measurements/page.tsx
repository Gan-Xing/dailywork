import { AccessDenied } from '@/components/AccessDenied'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'
import { listSiteVariationMeasurements } from '@/lib/server/siteVariationMeasurementStore'

import VariationMeasurementsClient from './VariationMeasurementsClient'

export default async function VariationMeasurementsPage() {
  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('value:view') || sessionUser?.roles.some((role) => role.name === 'Admin')
  const canUpdate =
    permissions.includes('value:update') || sessionUser?.roles.some((role) => role.name === 'Admin')
  const canUpload =
    permissions.includes('file:upload') ||
    permissions.includes('file:manage') ||
    sessionUser?.roles.some((role) => role.name === 'Admin')

  if (!sessionUser || !canView) {
    return <AccessDenied locale="zh" permissions={['value:view']} hint="需“产值查看”权限才能查看现场变更计量台账" />
  }

  const [projects, roadSections, boqItems, initialResult] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.roadSection.findMany({
      select: { id: true, name: true, slug: true, projectId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.boqItem.findMany({
      where: {
        sheetType: 'ACTUAL',
        tone: 'ITEM',
        isActive: true,
        NOT: { code: 'AVANCE' },
      },
      select: {
        id: true,
        projectId: true,
        code: true,
        designationZh: true,
        designationFr: true,
        unit: true,
        unitPrice: true,
      },
      orderBy: [{ projectId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    }),
    listSiteVariationMeasurements({ page: 1, pageSize: 20 }),
  ])

  return (
    <VariationMeasurementsClient
      initialResult={initialResult}
      projects={projects}
      roadSections={roadSections}
      boqItems={boqItems.map((item) => ({
        ...item,
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
      }))}
      canUpdate={Boolean(canUpdate)}
      canUpload={Boolean(canUpload)}
    />
  )
}
